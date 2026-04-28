import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/auth-js";
import { NextResponse, type NextRequest } from "next/server";

export const RENTULO_ADMIN_BAN_DURATION = "876000h";

export type RentuloAdminUserState = "active" | "suspended" | "blocked" | "deleted";

type AdminContext =
  | {
      ok: true;
      adminUserId: string;
      supabase: SupabaseClient;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

export function buildServiceSupabaseClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization")?.trim() ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function normalizeStoredUserState(value: unknown): RentuloAdminUserState | null {
  if (value === "active" || value === "suspended" || value === "blocked") {
    return value;
  }

  return null;
}

function isFutureIsoDate(value: string | null | undefined) {
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function getAdminUserState(user: Pick<User, "app_metadata" | "banned_until" | "deleted_at"> | null) {
  if (!user) {
    return "active" as const;
  }

  if (user.deleted_at) {
    return "deleted" as const;
  }

  const storedState = normalizeStoredUserState(user.app_metadata?.rentulo_admin_state);
  if (storedState) {
    return storedState;
  }

  if (isFutureIsoDate(user.banned_until)) {
    return "blocked" as const;
  }

  return "active" as const;
}

export async function requireAdminRoute(req: NextRequest): Promise<AdminContext> {
  const supabase = buildServiceSupabaseClient();

  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase service role is not configured on the server." },
        { status: 500 }
      ),
    };
  }

  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing bearer token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile || profile.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    adminUserId: user.id,
    supabase,
    user,
  };
}

export async function listAllAuthUsers(supabase: SupabaseClient) {
  const users: User[] = [];
  let page = 1;

  while (true) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: 200 });

    if (result.error) {
      throw new Error(result.error.message);
    }

    const nextUsers = result.data.users ?? [];
    users.push(...nextUsers);

    if (!result.data.nextPage || nextUsers.length === 0) {
      break;
    }

    page = result.data.nextPage;
  }

  return users;
}

export async function bestEffortLogAdminAction(
  supabase: SupabaseClient,
  actionType: string,
  targetTable: string,
  targetId: string
) {
  try {
    const { error } = await supabase.from("admin_actions").insert({
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId,
    });

    if (error) {
      console.warn("admin_actions insert skipped:", error.message);
    }
  } catch (error) {
    console.warn("admin_actions insert failed:", error);
  }
}
