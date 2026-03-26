import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

const ALLOWED_ADMIN_IDS = [
  "d6701707-527c-4b58-a6b7-27d05c03fdb8",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { actorUserId, targetUserId, newPassword } = body ?? {};

    if (!actorUserId || !targetUserId || !newPassword) {
      return NextResponse.json({ error: "Chýbajú údaje." }, { status: 400 });
    }

    if (!ALLOWED_ADMIN_IDS.includes(actorUserId)) {
      return NextResponse.json({ error: "Nemáš oprávnenie." }, { status: 403 });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Heslo musí mať aspoň 8 znakov." },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}