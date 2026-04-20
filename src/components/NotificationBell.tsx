"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  NOTIFICATIONS_PAGE_PATH,
  NOTIFICATIONS_REFRESH_EVENT,
  NOTIFICATION_DROPDOWN_LIMIT,
  countUnreadNotifications,
  formatNotificationDate,
  getNotificationHref,
  getNotificationPreview,
  listNotificationsForUser,
  markNotificationRead,
  notificationCardClass,
  type NotificationRow,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationBell() {
  const pathname = usePathname();
  const router = useRouter();

  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countLoadIdRef = useRef(0);
  const previewLoadIdRef = useRef(0);
  const isDropdownOpen = openPathname === pathname;

  const resolveUserId = useEffectEvent(async (explicitUserId?: string | null) => {
    if (typeof explicitUserId !== "undefined") {
      return explicitUserId;
    }

    return (await supabase.auth.getSession()).data.session?.user.id ?? null;
  });

  const loadUnreadCount = useEffectEvent(async (explicitUserId?: string | null) => {
    const loadId = ++countLoadIdRef.current;
    const nextUserId = await resolveUserId(explicitUserId);

    if (loadId !== countLoadIdRef.current) return;

    setUserId(nextUserId);

    if (!nextUserId) {
      setCount(0);
      return;
    }

    const { count: unreadCount, error } = await countUnreadNotifications(nextUserId);

    if (loadId !== countLoadIdRef.current) return;

    if (error) {
      setCount(0);
      return;
    }

    setCount(unreadCount ?? 0);
  });

  const loadPreview = useEffectEvent(async (explicitUserId?: string | null) => {
    const loadId = ++previewLoadIdRef.current;
    const nextUserId = await resolveUserId(explicitUserId);

    if (loadId !== previewLoadIdRef.current) return;

    setUserId(nextUserId);

    if (!nextUserId) {
      setRows([]);
      setPreviewError(null);
      setIsLoadingPreview(false);
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    const { data, error } = await listNotificationsForUser(
      nextUserId,
      NOTIFICATION_DROPDOWN_LIMIT
    );

    if (loadId !== previewLoadIdRef.current) return;

    if (error) {
      setRows([]);
      setPreviewError(`Chyba: ${error.message}`);
      setIsLoadingPreview(false);
      return;
    }

    setRows((data ?? []) as NotificationRow[]);
    setPreviewError(null);
    setIsLoadingPreview(false);
  });

  const scheduleLoadUnreadCount = useEffectEvent((explicitUserId?: string | null) => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadUnreadCount(explicitUserId);
    }, 150);
  });

  const refreshBell = useEffectEvent((explicitUserId?: string | null) => {
    scheduleLoadUnreadCount(explicitUserId);

    if (isDropdownOpen) {
      void loadPreview(explicitUserId);
    }
  });

  const handleNotificationClick = async (notification: NotificationRow) => {
    const href = getNotificationHref(notification.link);

    setOpenPathname(null);
    setActiveNotificationId(notification.id);

    if (!notification.is_read) {
      const { error } = await markNotificationRead(notification.id);

      if (!error) {
        setRows((prev) =>
          prev.map((row) => (row.id === notification.id ? { ...row, is_read: true } : row))
        );
        setCount((prev) => Math.max(0, prev - 1));
      }
    }

    setActiveNotificationId(null);
    router.push(href);
  };

  useEffect(() => {
    void loadUnreadCount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      setRows([]);
      setPreviewError(null);
      setOpenPathname(null);
      refreshBell(nextUserId);
    });

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }

      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPathname(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPathname(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    void loadPreview(userId);
  }, [isDropdownOpen, userId]);

  useEffect(() => {
    if (!userId) return;

    const handleFocus = () => {
      refreshBell(userId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshBell(userId);
      }
    };

    const handleNotificationsRefresh = () => {
      refreshBell(userId);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handleNotificationsRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel(`notification-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refreshBell(userId);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handleNotificationsRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative rounded-xl border border-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
        aria-label="Upozornenia"
        title="Upozornenia"
        aria-expanded={isDropdownOpen}
        aria-haspopup="dialog"
        onClick={() => setOpenPathname((value) => (value === pathname ? null : pathname))}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">🔔</span>
          <span>Upozornenia</span>
        </span>

        {count > 0 ? (
          <span className="absolute -right-2 -top-2 min-w-[22px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {isDropdownOpen ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[24rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">Upozornenia</div>
                <div className="mt-1 text-xs text-white/50">
                  Posledných {NOTIFICATION_DROPDOWN_LIMIT}
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                {count === 0 ? "Bez nových" : `${count > 99 ? "99+" : count} nových`}
              </div>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto p-2">
            {isLoadingPreview ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/70">
                Načítavam upozornenia...
              </div>
            ) : null}

            {!isLoadingPreview && previewError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-6 text-sm text-rose-100">
                {previewError}
              </div>
            ) : null}

            {!isLoadingPreview && !previewError && rows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/60">
                Zatiaľ nemáš žiadne upozornenia.
              </div>
            ) : null}

            {!isLoadingPreview && !previewError && rows.length > 0 ? (
              <ul className="space-y-2">
                {rows.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`w-full rounded-2xl border p-3 text-left transition hover:border-white/20 hover:bg-white/10 ${notificationCardClass(
                        notification.type,
                        notification.is_read
                      )}`}
                      onClick={() => void handleNotificationClick(notification)}
                      disabled={activeNotificationId === notification.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                notification.is_read
                                  ? "bg-white/10 text-white/55"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {notification.is_read ? "prečítané" : "nové"}
                            </span>
                          </div>

                          <div className="truncate text-sm font-semibold text-white">
                            {notification.title}
                          </div>

                          <div className="text-sm text-white/65">
                            {getNotificationPreview(notification.body, 88) || "Bez detailu"}
                          </div>
                        </div>

                        <div className="shrink-0 text-right text-xs text-white/45">
                          {formatNotificationDate(notification.created_at)}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-2">
            <Link
              href={NOTIFICATIONS_PAGE_PATH}
              className="block rounded-xl px-3 py-2.5 text-center text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
              onClick={() => setOpenPathname(null)}
            >
              Zobraziť všetky
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
