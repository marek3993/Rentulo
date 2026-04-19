"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { NOTIFICATIONS_REFRESH_EVENT } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUnreadCount = useEffectEvent(async (explicitUserId?: string | null) => {
    const nextUserId =
      explicitUserId ??
      (await supabase.auth.getSession()).data.session?.user.id ??
      null;

    setUserId(nextUserId);

    if (!nextUserId) {
      setCount(0);
      return;
    }

    const { count: unreadCount, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", nextUserId)
      .eq("is_read", false);

    if (error) {
      setCount(0);
      return;
    }

    setCount(unreadCount ?? 0);
  });

  const scheduleLoadUnreadCount = useEffectEvent((explicitUserId?: string | null) => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadUnreadCount(explicitUserId);
    }, 150);
  });

  useEffect(() => {
    void loadUnreadCount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      scheduleLoadUnreadCount(nextUserId);
    });

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }

      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const handleFocus = () => {
      scheduleLoadUnreadCount(userId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleLoadUnreadCount(userId);
      }
    };

    const handleNotificationsRefresh = () => {
      scheduleLoadUnreadCount(userId);
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
          scheduleLoadUnreadCount(userId);
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
    <Link
      href="/notifications"
      className="relative rounded-xl border border-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
      aria-label="Upozornenia"
      title="Upozornenia"
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
    </Link>
  );
}
