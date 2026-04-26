const configuredBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "";

export function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveAuthBaseUrl() {
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return "";
}

export function sanitizeInternalPath(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function buildAuthCallbackUrl(options?: { next?: string | null }) {
  const nextPath = sanitizeInternalPath(options?.next) ?? "/";
  const baseUrl = resolveAuthBaseUrl();

  if (!baseUrl) {
    return `/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }

  const url = new URL("/auth/callback", `${baseUrl}/`);
  url.searchParams.set("next", nextPath);
  return url.toString();
}
