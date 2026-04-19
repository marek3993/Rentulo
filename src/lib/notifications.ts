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

export const NOTIFICATIONS_REFRESH_EVENT = "rentulo:notifications-refresh";

export function dispatchNotificationsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT));
}

export function formatNotificationDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("sk-SK");
}

export function notificationTypeLabel(type: string) {
  if (type === "dispute") return "Reklamacia";
  if (type === "payment") return "Platba";
  if (type === "message") return "Správa";
  if (type === "reservation") return "Rezervácia";
  if (type === "verification") return "Overenie";
  return type;
}

export function notificationTypeBadgeClass(type: string) {
  if (type === "dispute") return "bg-rose-500/15 text-rose-300";
  if (type === "payment") return "bg-emerald-500/15 text-emerald-300";
  if (type === "message") return "bg-indigo-500/15 text-indigo-300";
  if (type === "reservation") return "bg-sky-500/15 text-sky-300";
  if (type === "verification") return "bg-amber-500/15 text-amber-300";
  return "bg-white/10 text-white/75";
}
