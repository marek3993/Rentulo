import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { ok: false, reason: "stripe_disabled_for_demo" },
    { status: 501 }
  );
}
