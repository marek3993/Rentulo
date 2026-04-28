import { NextResponse, type NextRequest } from "next/server";

import { bestEffortLogAdminAction, requireAdminRoute } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  action: "set_visibility";
  visibility: "visible" | "hidden";
};

function getBaseReviewType(revieweeType: string) {
  if (revieweeType === "item" || revieweeType === "item_hidden") return "item";
  if (revieweeType === "owner" || revieweeType === "owner_hidden") return "owner";
  return null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const reviewId = Number(id);
  const body = (await req.json()) as PatchBody;

  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json({ error: "Invalid review id." }, { status: 400 });
  }

  if (body.action !== "set_visibility") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const { data: review, error: reviewError } = await admin.supabase
    .from("reviews")
    .select("id,reviewee_type")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const baseType = getBaseReviewType(review.reviewee_type);

  if (!baseType) {
    return NextResponse.json({ error: "Unsupported review type." }, { status: 400 });
  }

  const nextRevieweeType =
    body.visibility === "hidden" ? `${baseType}_hidden` : baseType;

  const { error } = await admin.supabase
    .from("reviews")
    .update({ reviewee_type: nextRevieweeType })
    .eq("id", reviewId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await bestEffortLogAdminAction(
    admin.supabase,
    body.visibility === "hidden" ? "review_hidden" : "review_restored",
    "reviews",
    String(reviewId)
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const reviewId = Number(id);

  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json({ error: "Invalid review id." }, { status: 400 });
  }

  const { error } = await admin.supabase.from("reviews").delete().eq("id", reviewId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await bestEffortLogAdminAction(admin.supabase, "review_deleted", "reviews", String(reviewId));

  return NextResponse.json({ ok: true });
}
