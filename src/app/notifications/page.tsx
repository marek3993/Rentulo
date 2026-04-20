"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  formatNotificationDate,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  notificationCardClass,
  notificationTypeBadgeClass,
  notificationTypeLabel,
  type NotificationRow,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [status, setStatus] = useState("Načítavam...");
  const [authChecked, setAuthChecked] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadIdRef = useRef(0);

  const load = async () => {
    const loadId = ++loadIdRef.current;
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (loadId !== loadIdRef.current) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data, error } = await listNotificationsForUser(userId);

    if (loadId !== loadIdRef.current) return;

    if (error) {
      setStatus("Chyba: " + error.message);
      setAuthChecked(true);
      return;
    }

    setRows((data ?? []) as NotificationRow[]);
    setStatus("");
    setAuthChecked(true);
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    const setup = async () => {
      await load();

      if (!active) return;

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) return;

      channel = supabase
        .channel(`notifications-page-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          async () => {
            await load();
          }
        )
        .subscribe();
    };

    setup();

    const handleFocus = () => {
      load();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markOneRead = async (id: number) => {
    const { error } = await markNotificationRead(id);

    if (!error) {
      setRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setStatus("Označujem ako prečítané...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { error } = await markAllNotificationsRead(userId);

    if (error) {
      setStatus("Chyba: " + error.message);
      setMarkingAll(false);
      return;
    }

    setRows((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setStatus("");
    setMarkingAll(false);
  };

  const unreadCount = rows.filter((r) => !r.is_read).length;

  if (!authChecked) {
    return (
      <main className="space-y-6">
        <div className="rentulo-card p-6">Načítavam...</div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo centrum upozornení
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Upozornenia</h1>

            <p className="mt-2 leading-7 text-white/70">
              Prehľad správ, platieb, rezervácií a ďalších systémových udalostí.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rentulo-btn-secondary px-4 py-2.5 text-sm disabled:opacity-50"
              onClick={markAllRead}
              disabled={unreadCount === 0 || markingAll}
              type="button"
            >
              {markingAll ? "Označujem..." : "Označiť všetko ako prečítané"}
            </button>

            <Link href="/" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Domov
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Spolu</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Všetky upozornenia</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Neprečítané</div>
          <div className="mt-2 text-3xl font-semibold">{unreadCount}</div>
          <div className="mt-1 text-sm text-white/50">Vyžadujú tvoju pozornosť</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Prečítané</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length - unreadCount}</div>
          <div className="mt-1 text-sm text-white/50">Už spracované</div>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      {rows.length === 0 && !status ? (
        <div className="rentulo-card p-8 text-center text-white/60">
          Zatiaľ nemáš žiadne upozornenia.
        </div>
      ) : null}

      <ul className="space-y-3">
        {rows.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border p-5 transition ${notificationCardClass(n.type, n.is_read)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${notificationTypeBadgeClass(
                      n.type
                    )}`}
                  >
                    {notificationTypeLabel(n.type)}
                  </span>

                  {!n.is_read ? (
                    <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-medium text-white">
                      nové
                    </span>
                  ) : null}
                </div>

                <div className="text-lg font-semibold text-white">{n.title}</div>

                {n.body ? <div className="leading-7 text-white/75">{n.body}</div> : null}

                <div className="text-sm text-white/50">{formatNotificationDate(n.created_at)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!n.is_read ? (
                  <button
                    className="rentulo-btn-secondary px-4 py-2 text-sm"
                    onClick={() => markOneRead(n.id)}
                    type="button"
                  >
                    Označiť ako prečítané
                  </button>
                ) : null}

                {n.link ? (
                  <Link
                    href={n.link}
                    className="rentulo-btn-primary px-4 py-2 text-sm"
                    onClick={() => {
                      if (!n.is_read) markOneRead(n.id);
                    }}
                  >
                    Otvoriť
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
