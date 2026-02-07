import { NextResponse } from "next/server";

export async function POST() {
  // Stripe zatiaľ nie je nakonfigurovaný
  return NextResponse.json(
    { ok: false, reason: "payments_not_configured" },
    { status: 501 }
  );
}
