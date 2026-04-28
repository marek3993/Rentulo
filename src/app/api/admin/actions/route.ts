import { NextResponse, type NextRequest } from "next/server";

import { requireAdminRoute } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ActionRow = {
  id: number;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  created_at: string;
};

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const page = parsePage(req.nextUrl.searchParams.get("page"));
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await admin.supabase
    .from("admin_actions")
    .select("id,action_type,target_table,target_id,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: (data ?? []) as ActionRow[],
    total: count ?? 0,
    page,
    pageSize,
  });
}
