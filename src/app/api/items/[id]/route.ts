import { NextResponse, type NextRequest } from "next/server";

import { buildServiceSupabaseClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

type ItemDetailRow = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  owner_id: string;
  is_active: boolean;
  delivery_mode: string | null;
  delivery_rate_per_km: number | null;
  delivery_fee_cap: number | null;
  delivery_max_radius_km: number | null;
};

const ITEM_DETAIL_SELECT =
  "id,title,description,price_per_day,city,owner_id,is_active,delivery_mode,delivery_rate_per_km,delivery_fee_cap,delivery_max_radius_km";

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization")?.trim() ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

async function getViewerContext(req: NextRequest) {
  const supabase = buildServiceSupabaseClient();

  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Supabase service role is not configured on the server." },
        { status: 500 }
      ),
    };
  }

  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: true as const,
      supabase,
      viewerUserId: null,
      viewerRole: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: true as const,
      supabase,
      viewerUserId: null,
      viewerRole: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  return {
    ok: true as const,
    supabase,
    viewerUserId: user.id,
    viewerRole: profile?.role ?? null,
  };
}

function buildInvalidItemIdResponse() {
  return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
}

export async function GET(req: NextRequest, { params }: Params) {
  const viewer = await getViewerContext(req);

  if (!viewer.ok) {
    return viewer.response;
  }

  const { id } = await params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return buildInvalidItemIdResponse();
  }

  const { data, error } = await viewer.supabase
    .from("items")
    .select(ITEM_DETAIL_SELECT)
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const item = data as ItemDetailRow;
  const canSeeInactive =
    Boolean(viewer.viewerUserId) &&
    (item.owner_id === viewer.viewerUserId || viewer.viewerRole === "admin");

  if (!item.is_active && !canSeeInactive) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ item });
}
