import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Stripe nie je zatiaľ nastavený.", demo: true },
    { status: 501 }
  );
}