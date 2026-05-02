import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { bestEffortLogAdminAction, requireAdminRoute } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

type AdminItemRow = {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  category: string | null;
  city: string | null;
  postal_code: string | null;
  is_active: boolean;
};

type RequestBody =
  | {
      action: "set_visibility";
      isActive: boolean;
    }
  | {
      action: "update_item";
      payload: {
        title: string;
        description: string;
        pricePerDay: number;
        category: string;
        city: string;
        postalCode: string;
        isActive: boolean;
      };
    };

const ADMIN_ITEM_SELECT = "id,owner_id,title,description,price_per_day,category,city,postal_code,is_active";

async function getItemById(itemId: number, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("items")
    .select(ADMIN_ITEM_SELECT)
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as AdminItemRow | null;
}

function buildInvalidItemIdResponse() {
  return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
}

function trimToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return buildInvalidItemIdResponse();
  }

  try {
    const item = await getItemById(itemId, admin.supabase);

    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return buildInvalidItemIdResponse();
  }

  const body = (await req.json()) as RequestBody;

  if (body.action === "set_visibility") {
    const { data, error } = await admin.supabase
      .from("items")
      .update({ is_active: body.isActive })
      .eq("id", itemId)
      .select("id,is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    await bestEffortLogAdminAction(
      admin.supabase,
      body.isActive ? "item_visibility_restored" : "item_hidden",
      "items",
      String(itemId)
    );

    return NextResponse.json({
      ok: true,
      item: data,
    });
  }

  if (body.action !== "update_item") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const payload = body.payload;
  if (!payload) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const title = payload.title?.trim() ?? "";
  const category = payload.category?.trim() ?? "";
  const city = payload.city?.trim() ?? "";
  const postalCode = payload.postalCode?.trim() ?? "";
  const pricePerDay = Number(payload.pricePerDay);

  if (!title) {
    return NextResponse.json({ error: "Missing title." }, { status: 400 });
  }

  if (!category) {
    return NextResponse.json({ error: "Missing category." }, { status: 400 });
  }

  if (!city) {
    return NextResponse.json({ error: "Missing city." }, { status: 400 });
  }

  if (!postalCode) {
    return NextResponse.json({ error: "Missing postal code." }, { status: 400 });
  }

  if (!Number.isFinite(pricePerDay) || pricePerDay < 0) {
    return NextResponse.json({ error: "Invalid price per day." }, { status: 400 });
  }

  try {
    const existingItem = await getItemById(itemId, admin.supabase);

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const { data, error } = await admin.supabase
      .from("items")
      .update({
        title,
        description: trimToNull(payload.description ?? ""),
        price_per_day: pricePerDay,
        category,
        city,
        postal_code: postalCode,
        is_active: Boolean(payload.isActive),
      })
      .eq("id", itemId)
      .select(ADMIN_ITEM_SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    if (existingItem.is_active !== Boolean(payload.isActive)) {
      await bestEffortLogAdminAction(
        admin.supabase,
        payload.isActive ? "item_visibility_restored" : "item_hidden",
        "items",
        String(itemId)
      );
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
