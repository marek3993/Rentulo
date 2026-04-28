"use client";

import { supabase } from "@/lib/supabaseClient";

async function buildHeaders(extraHeaders?: HeadersInit) {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;

  if (!accessToken) {
    throw new Error("Missing session.");
  }

  const headers = new Headers(extraHeaders);
  headers.set("authorization", `Bearer ${accessToken}`);

  return headers;
}

export async function adminApiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = await buildHeaders(init?.headers);
  const response = await fetch(input, {
    ...init,
    headers,
  });

  const json = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(json?.error || `Admin request failed with status ${response.status}.`);
  }

  return json as T;
}
