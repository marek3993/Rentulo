import { supabase } from "@/lib/supabaseClient";

export type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type ToastNotification = Pick<NotificationRow, "id" | "title" | "body" | "link">;

export const NOTIFICATIONS_PAGE_PATH = "/notifications";
export const NOTIFICATION_DROPDOWN_LIMIT = 8;
export const NOTIFICATION_SELECT_COLUMNS = "id,type,title,body,link,is_read,created_at";

type InsertNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

export const NOTIFICATIONS_REFRESH_EVENT = "rentulo:notifications-refresh";

export function dispatchNotificationsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT));
}

export async function countUnreadNotifications(userId: string) {
  return supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

export async function listNotificationsForUser(userId: string, limit?: number) {
  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  return query;
}

export async function markNotificationRead(notificationId: number) {
  const result = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (!result.error) {
    dispatchNotificationsRefresh();
  }

  return result;
}

export async function markAllNotificationsRead(userId: string) {
  const result = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (!result.error) {
    dispatchNotificationsRefresh();
  }

  return result;
}

export async function insertNotification({
  userId,
  type,
  title,
  body = null,
  link = null,
}: InsertNotificationInput) {
  if (!userId) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    link,
    is_read: false,
  });

  if (error) {
    console.error("Failed to insert notification", error);
  }
}

export function formatNotificationDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("sk-SK");
}

export function getNotificationHref(link: string | null) {
  return link ?? NOTIFICATIONS_PAGE_PATH;
}

export function getNotificationPreview(body: string | null, maxLength = 96) {
  if (!body) return "";

  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function notificationTypeLabel(type: string) {
  if (type === "dispute") return "Reklamácia";
  if (type === "payment") return "Platba";
  if (type === "message") return "Správa";
  if (type === "reservation") return "Rezervácia";
  if (type === "verification") return "Overenie";
  if (type.startsWith("dispute_")) return notificationTypeLabel("dispute");
  if (type.startsWith("payment_")) return notificationTypeLabel("payment");
  if (type.startsWith("message_")) return notificationTypeLabel("message");
  if (type.startsWith("reservation_")) return notificationTypeLabel("reservation");
  if (type.startsWith("verification_")) return notificationTypeLabel("verification");
  return "Upozornenie";
}

export function notificationTypeBadgeClass(type: string) {
  if (type === "dispute") return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20";
  if (type === "payment") return "bg-emerald-500/15 text-emerald-300";
  if (type === "message") return "bg-indigo-500/15 text-indigo-300";
  if (type === "reservation") return "bg-sky-500/15 text-sky-300";
  if (type === "verification") return "bg-amber-500/15 text-amber-300";
  return "bg-white/10 text-white/75";
}

export function notificationCardClass(type: string, isRead: boolean) {
  if (isRead) return "border-white/10 bg-white/5";
  if (type === "dispute") return "border-rose-400/20 bg-rose-500/[0.08]";
  return "border-indigo-400/20 bg-indigo-500/[0.07]";
}
