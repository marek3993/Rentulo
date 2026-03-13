"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("sk-SK");
}

export default function NotificationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [status, setStatus] = useState("Načítavam...");

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,link,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as NotificationRow[]);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markOneRead = async (id: number) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (!error) {
      setRows((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    }
  };

  const markAllRead = async () => {
    setStatus("Označujem ako prečítané...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setStatus("");
  };

  const unreadCount = rows.filter((r) => !r.is_read).length;

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Upozornenia</h1>
            <p className="mt-1 text-white/60">
              Prehľad všetkých systémových udalostí a zmien rezervácií.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded border border-white/15 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              type="button"
            >
              Označiť všetko ako prečítané
            </button>

            <Link
              href="/"
              className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            >
              Domov
            </Link>
          </div>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {rows.length === 0 && !status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
          Zatiaľ nemáš žiadne upozornenia.
        </div>
      ) : null}

      <ul className="space-y-3">
        {rows.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border p-5 ${
              n.is_read
                ? "border-white/10 bg-white/5"
                : "border-white/20 bg-white/10"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-base">{n.title}</strong>
                  {!n.is_read ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                      nové
                    </span>
                  ) : null}
                </div>

                {n.body ? <div className="text-white/80">{n.body}</div> : null}

                <div className="text-sm text-white/50">
                  {formatDate(n.created_at)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!n.is_read ? (
                  <button
                    className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                    onClick={() => markOneRead(n.id)}
                    type="button"
                  >
                    Označiť ako prečítané
                  </button>
                ) : null}

                {n.link ? (
                  <Link
                    href={n.link}
                    className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                    onClick={() => {
                      if (!n.is_read) {
                        markOneRead(n.id);
                      }
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