import { NextRequest, NextResponse } from "next/server";

import {
  isNotificationEmailMirrorConfigured,
  sendNotificationMirrorEmail,
  type NotificationEmailRecipient,
  type NotificationEmailRow,
} from "@/lib/notificationEmailMirror";
import { buildServiceSupabaseClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const DEFAULT_LOOKBACK_MINUTES = 360;
const DEFAULT_BATCH_SIZE = 100;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getLookbackMinutes() {
  const value = Number(process.env.NOTIFICATION_EMAIL_LOOKBACK_MINUTES ?? "");

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LOOKBACK_MINUTES;
  }

  return Math.floor(value);
}

function getBatchSize() {
  const value = Number(process.env.NOTIFICATION_EMAIL_BATCH_SIZE ?? "");

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.floor(value);
}

function resolveSiteUrl(req: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ?? process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.trim() || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return normalizeBaseUrl(req.nextUrl.origin);
}

function isAuthorized(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = req.headers.get("authorization")?.trim();
  return authorization === `Bearer ${expectedSecret}`;
}

async function loadRecentNotifications(lookbackMinutes: number, batchSize: number) {
  const supabase = buildServiceSupabaseClient();

  if (!supabase) {
    return {
      supabase: null,
      notifications: [] as NotificationEmailRow[],
      error: "Supabase service role is not configured on the server.",
    };
  }

  const sinceIso = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,type,title,body,link,created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    return {
      supabase,
      notifications: [] as NotificationEmailRow[],
      error: error.message,
    };
  }

  return {
    supabase,
    notifications: (data ?? []) as NotificationEmailRow[],
    error: null,
  };
}

async function loadProfileNameMap(userIds: string[]) {
  const supabase = buildServiceSupabaseClient();

  if (!supabase || userIds.length === 0) {
    return new Map<string, string | null>();
  }

  const { data } = await supabase.from("profiles").select("id,full_name").in("id", userIds);

  const map = new Map<string, string | null>();

  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
    map.set(row.id, row.full_name ?? null);
  }

  return map;
}

async function resolveRecipient(
  userId: string,
  fullName: string | null
): Promise<NotificationEmailRecipient | null> {
  const supabase = buildServiceSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user?.email) {
    return null;
  }

  return {
    email: data.user.email,
    fullName,
  };
}

async function handleRequest(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isNotificationEmailMirrorConfigured()) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "notification_email_mirror_not_configured",
      },
      { status: 200 }
    );
  }

  const lookbackMinutes = getLookbackMinutes();
  const batchSize = getBatchSize();
  const siteUrl = resolveSiteUrl(req);

  const {
    supabase,
    notifications,
    error: notificationsError,
  } = await loadRecentNotifications(lookbackMinutes, batchSize);

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase service role is not configured on the server.",
      },
      { status: 500 }
    );
  }

  if (notificationsError) {
    return NextResponse.json(
      {
        ok: false,
        error: notificationsError,
      },
      { status: 500 }
    );
  }

  if (notifications.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      lookbackMinutes,
      batchSize,
    });
  }

  const userIds = Array.from(new Set(notifications.map((row) => row.user_id).filter(Boolean)));
  const profileNameMap = await loadProfileNameMap(userIds);
  const recipientCache = new Map<string, NotificationEmailRecipient | null>();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const errors: Array<{ notificationId: number; reason: string }> = [];

  for (const notification of notifications) {
    if (!notification.user_id) {
      skipped += 1;
      errors.push({
        notificationId: notification.id,
        reason: "Missing notification user_id.",
      });
      continue;
    }

    let recipient: NotificationEmailRecipient | null;

    if (recipientCache.has(notification.user_id)) {
      recipient = recipientCache.get(notification.user_id) ?? null;
    } else {
      recipient = await resolveRecipient(
        notification.user_id,
        profileNameMap.get(notification.user_id) ?? null
      );
      recipientCache.set(notification.user_id, recipient);
    }

    if (!recipient?.email) {
      skipped += 1;
      errors.push({
        notificationId: notification.id,
        reason: "Recipient email was not found.",
      });
      continue;
    }

    const result = await sendNotificationMirrorEmail({
      notification,
      recipient,
      siteUrl,
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;
    errors.push({
      notificationId: notification.id,
      reason: result.error,
    });
  }

  return NextResponse.json({
    ok: failed === 0,
    processed: notifications.length,
    sent,
    skipped,
    failed,
    lookbackMinutes,
    batchSize,
    errors: errors.slice(0, 50),
  });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
