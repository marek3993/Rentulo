import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminUserState,
  listAllAuthUsers,
  requireAdminRoute,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  role: string;
  created_at: string;
};

type ItemOwnerRow = {
  id: number;
  owner_id: string;
  is_active: boolean;
};

type UserListRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  role: string;
  created_at: string;
  email: string | null;
  admin_state: "active" | "suspended" | "blocked" | "deleted";
  banned_until: string | null;
  deleted_at: string | null;
  total_items: number;
  active_items: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function matchesQuery(row: UserListRow, query: string) {
  if (!query) return true;

  const haystack = [
    row.full_name ?? "",
    row.city ?? "",
    row.id,
    row.email ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const page = parsePage(req.nextUrl.searchParams.get("page"));
  const query = normalize(req.nextUrl.searchParams.get("q") ?? "");
  const roleFilter = req.nextUrl.searchParams.get("role") ?? "all";
  const stateFilter = req.nextUrl.searchParams.get("state") ?? "all";
  const sort = req.nextUrl.searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const pageSize = 12;

  const [profilesResult, authUsers, itemsResult] = await Promise.all([
    admin.supabase
      .from("profiles")
      .select("id,full_name,city,role,created_at")
      .order("created_at", { ascending: sort === "oldest" }),
    listAllAuthUsers(admin.supabase),
    admin.supabase.from("items").select("id,owner_id,is_active"),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }

  if (itemsResult.error) {
    return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });
  }

  const authUserMap = new Map(authUsers.map((user) => [user.id, user]));
  const itemCounts = new Map<string, { total: number; active: number }>();

  for (const item of (itemsResult.data ?? []) as ItemOwnerRow[]) {
    const current = itemCounts.get(item.owner_id) ?? { total: 0, active: 0 };
    current.total += 1;
    if (item.is_active) {
      current.active += 1;
    }
    itemCounts.set(item.owner_id, current);
  }

  const mergedRows = ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => {
    const authUser = authUserMap.get(profile.id);
    const counts = itemCounts.get(profile.id) ?? { total: 0, active: 0 };

    return {
      id: profile.id,
      full_name: profile.full_name,
      city: profile.city,
      role: profile.role,
      created_at: profile.created_at,
      email: authUser?.email ?? null,
      admin_state: getAdminUserState(authUser ?? null),
      banned_until: authUser?.banned_until ?? null,
      deleted_at: authUser?.deleted_at ?? null,
      total_items: counts.total,
      active_items: counts.active,
    } satisfies UserListRow;
  });

  const filteredRows = mergedRows.filter((row) => {
    if (roleFilter !== "all" && row.role !== roleFilter) {
      return false;
    }

    if (stateFilter !== "all" && row.admin_state !== stateFilter) {
      return false;
    }

    return matchesQuery(row, query);
  });

  const from = (page - 1) * pageSize;
  const pagedRows = filteredRows.slice(from, from + pageSize);

  return NextResponse.json({
    rows: pagedRows,
    total: filteredRows.length,
    page,
    pageSize,
  });
}
