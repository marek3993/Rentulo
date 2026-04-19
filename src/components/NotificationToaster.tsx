"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import {
  dispatchNotificationsRefresh,
  type ToastNotification,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationToaster() {
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useEffectEvent((row: ToastNotification) => {
    setToast({
      id: row.id,
      title: row.title,
      body: row.body ?? null,
      link: row.link ?? null,
    });

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }

    hideTimer.current = setTimeout(() => {
      setToast(null);
    }, 6000);
  });

  const markToastRead = async (notificationId: number) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (!error) {
      dispatchNotificationsRefresh();
    }
  };

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const cleanupChannel = () => {
      if (!channel) return;
      supabase.removeChannel(channel);
      channel = null;
    };

    const setup = async (explicitUserId?: string | null) => {
      cleanupChannel();

      const userId =
        explicitUserId ??
        (await supabase.auth.getSession()).data.session?.user.id ??
        null;

      if (!active || !userId) return;

      channel = supabase
        .channel(`notifications-toast-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as ToastNotification;
            showToast(row);
          }
        )
        .subscribe();
    };

    void setup();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToast(null);
      void setup(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      subscription.unsubscribe();
      cleanupChannel();
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/15 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">🔔 {toast.title}</div>
          {toast.body ? <div className="text-sm text-white/75">{toast.body}</div> : null}
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Zavrieť
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {toast.link ? (
          <Link
            href={toast.link}
            className="rounded bg-white px-3 py-2 text-sm font-medium text-black hover:bg-white/90"
            onClick={() => {
              void markToastRead(toast.id);
              setToast(null);
            }}
          >
            Otvoriť
          </Link>
        ) : null}

        <Link
          href="/notifications"
          className="rounded border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
          onClick={() => setToast(null)}
        >
          Všetky upozornenia
        </Link>
      </div>
    </div>
  );
}
