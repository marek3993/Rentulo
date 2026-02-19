import { NextResponse } from "next/server";

export async function POST() {
  // demo mode: maintenance disabled without service role key
  return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
}
