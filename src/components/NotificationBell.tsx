"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  const loadUnreadCount = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      setCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (!error) {
      setCount(count ?? 0);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

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