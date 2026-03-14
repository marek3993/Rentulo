"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ToastNotification = {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
};

export default function NotificationToaster() {
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) return;

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
            const row = payload.new as {
              id: number;
              title: string;
              body: string | null;
              link: string | null;
            };

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
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
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
            onClick={() => setToast(null)}
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
