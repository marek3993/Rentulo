import { NextResponse, type NextRequest } from "next/server";

import {
  RENTULO_ADMIN_BAN_DURATION,
  bestEffortLogAdminAction,
  requireAdminRoute,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

type ItemVisibilityRow = {
  id: number;
};

type RequestBody =
  | {
      action: "set_role";
      role: "user" | "admin";
    }
  | {
      action: "set_state";
      state: "active" | "suspended" | "blocked";
    }
  | {
      action: "soft_delete";
    };

async function deactivateUserItems(ownerId: string, req: Awaited<ReturnType<typeof requireAdminRoute>>) {
  if (!req.ok) {
    return 0;
  }

  const { data, error } = await req.supabase
    .from("items")
    .update({ is_active: false })
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ItemVisibilityRow[]).length;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const { id: targetUserId } = await params;
  const body = (await req.json()) as RequestBody;

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  const { data: targetProfile, error: targetProfileError } = await admin.supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetProfileError) {
    return NextResponse.json({ error: targetProfileError.message }, { status: 500 });
  }

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (body.action === "set_role") {
    if (targetUserId === admin.adminUserId) {
      return NextResponse.json({ error: "You cannot change your own role here." }, { status: 400 });
    }

    const { error } = await admin.supabase.rpc("set_user_role", {
      target_user_id: targetUserId,
      new_role: body.role,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await bestEffortLogAdminAction(admin.supabase, "user_role_changed", "profiles", targetUserId);

    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_state") {
    if (targetUserId === admin.adminUserId && body.state !== "active") {
      return NextResponse.json({ error: "You cannot suspend or block yourself." }, { status: 400 });
    }

    const {
      data: { user: targetAuthUser },
      error: targetAuthUserError,
    } = await admin.supabase.auth.admin.getUserById(targetUserId);

    if (targetAuthUserError || !targetAuthUser) {
      return NextResponse.json(
        { error: targetAuthUserError?.message || "Auth user not found." },
        { status: 404 }
      );
    }

    const nextAppMetadata = {
      ...(targetAuthUser.app_metadata ?? {}),
      rentulo_admin_state: body.state,
      rentulo_admin_updated_at: new Date().toISOString(),
      rentulo_admin_updated_by: admin.adminUserId,
    };

    const { error } = await admin.supabase.auth.admin.updateUserById(targetUserId, {
      app_metadata: nextAppMetadata,
      ban_duration: body.state === "active" ? "none" : RENTULO_ADMIN_BAN_DURATION,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let hiddenItems = 0;
    if (body.state !== "active") {
      hiddenItems = await deactivateUserItems(targetUserId, admin);
    }

    await bestEffortLogAdminAction(
      admin.supabase,
      `user_${body.state}`,
      "profiles",
      targetUserId
    );

    return NextResponse.json({
      ok: true,
      hiddenItems,
    });
  }

  if (body.action === "soft_delete") {
    if (targetUserId === admin.adminUserId) {
      return NextResponse.json({ error: "You cannot delete yourself." }, { status: 400 });
    }

    if (targetProfile.role === "admin") {
      return NextResponse.json(
        { error: "Remove admin role before soft deleting this user." },
        { status: 400 }
      );
    }

    const hiddenItems = await deactivateUserItems(targetUserId, admin);
    const { error } = await admin.supabase.auth.admin.deleteUser(targetUserId, true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await bestEffortLogAdminAction(admin.supabase, "user_soft_deleted", "profiles", targetUserId);

    return NextResponse.json({
      ok: true,
      hiddenItems,
    });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
