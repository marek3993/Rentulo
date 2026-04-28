import { NextResponse, type NextRequest } from "next/server";

import { requireAdminRoute } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ReviewRow = {
  id: number;
  reservation_id: number;
  item_id: number | null;
  reviewer_id: string;
  reviewee_id: string;
  reviewee_type: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type ItemRow = {
  id: number;
  title: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
};

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getBaseReviewType(revieweeType: string) {
  if (revieweeType === "item" || revieweeType === "item_hidden") return "item";
  if (revieweeType === "owner" || revieweeType === "owner_hidden") return "owner";
  return revieweeType;
}

function getReviewVisibility(revieweeType: string) {
  return revieweeType.endsWith("_hidden") ? "hidden" : "visible";
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const page = parsePage(req.nextUrl.searchParams.get("page"));
  const pageSize = 12;
  const query = normalize(req.nextUrl.searchParams.get("q") ?? "");
  const visibilityFilter = req.nextUrl.searchParams.get("visibility") ?? "all";

  const { data: reviews, error } = await admin.supabase
    .from("reviews")
    .select("id,reservation_id,item_id,reviewer_id,reviewee_id,reviewee_type,rating,comment,created_at")
    .in("reviewee_type", ["item", "item_hidden", "owner", "owner_hidden"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const typedReviews = (reviews ?? []) as ReviewRow[];
  const itemIds = Array.from(
    new Set(typedReviews.map((review) => review.item_id).filter((value): value is number => Number.isInteger(value)))
  );
  const profileIds = Array.from(
    new Set(
      typedReviews.flatMap((review) => [review.reviewer_id, review.reviewee_id]).filter(Boolean)
    )
  );

  const [itemsResult, profilesResult] = await Promise.all([
    itemIds.length > 0
      ? admin.supabase.from("items").select("id,title").in("id", itemIds)
      : Promise.resolve({ data: [] as ItemRow[], error: null }),
    profileIds.length > 0
      ? admin.supabase.from("profiles").select("id,full_name,city").in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (itemsResult.error) {
    return NextResponse.json({ error: itemsResult.error.message }, { status: 500 });
  }

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }

  const itemMap = new Map(((itemsResult.data ?? []) as ItemRow[]).map((item) => [item.id, item]));
  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const mergedRows = typedReviews.map((review) => {
    const reviewer = profileMap.get(review.reviewer_id);
    const reviewee = profileMap.get(review.reviewee_id);
    const item = review.item_id ? itemMap.get(review.item_id) : null;

    return {
      id: review.id,
      reservation_id: review.reservation_id,
      item_id: review.item_id,
      item_title: item?.title ?? null,
      reviewer_id: review.reviewer_id,
      reviewer_name: reviewer?.full_name ?? null,
      reviewee_id: review.reviewee_id,
      reviewee_name: reviewee?.full_name ?? null,
      base_type: getBaseReviewType(review.reviewee_type),
      visibility: getReviewVisibility(review.reviewee_type),
      reviewee_type: review.reviewee_type,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
    };
  });

  const filteredRows = mergedRows.filter((row) => {
    if (visibilityFilter !== "all" && row.visibility !== visibilityFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      row.item_title ?? "",
      row.reviewer_name ?? "",
      row.reviewee_name ?? "",
      row.comment ?? "",
      row.reviewer_id,
      row.reviewee_id,
      String(row.reservation_id),
      String(row.id),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
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
