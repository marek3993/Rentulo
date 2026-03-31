"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="rounded-xl border border-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
      href={href}
    >
      {children}
    </Link>
  );
}

function SecondaryNavLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      className={
        primary
          ? "rounded-xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90"
          : "rounded-xl px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
      }
      href={href}
    >
      {children}
    </Link>
  );
}

function MessagesNavLink() {
  const [unreadCount, setUnreadCount] = useState(0);
  const loadIdRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUnreadCount = async () => {
    const loadId = ++loadIdRef.current;

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (loadId !== loadIdRef.current) return;

    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("messages")
      .select("id,conversations!inner(owner_id,renter_id)", { count: "exact", head: true })
      .neq("sender_id", userId)
      .is("read_at", null)
      .or(`owner_id.eq.${userId},renter_id.eq.${userId}`, { foreignTable: "conversations" });

    if (loadId !== loadIdRef.current) return;

    if (error) {
      setUnreadCount(0);
      return;
    }

    setUnreadCount(count ?? 0);
  };

  const scheduleLoadUnreadCount = () => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadUnreadCount();
    }, 150);
  };

  useEffect(() => {
    let active = true;

    void loadUnreadCount();

    const handleFocus = () => {
      if (!active) return;
      scheduleLoadUnreadCount();
    };

    const handleVisibilityChange = () => {
      if (!active) return;

      if (document.visibilityState === "visible") {
        scheduleLoadUnreadCount();
      }
    };

    const handleMessagesRefresh = () => {
      if (!active) return;
      scheduleLoadUnreadCount();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("rentulo:messages-unread-refresh", handleMessagesRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel("nav-messages-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          scheduleLoadUnreadCount();
        }
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      scheduleLoadUnreadCount();
    });

    return () => {
      active = false;

      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }

      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("rentulo:messages-unread-refresh", handleMessagesRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Link
      className="relative rounded-xl border border-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
      href="/messages"
    >
      Správy
      {unreadCount > 0 ? (
        <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-xs font-semibold text-black">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export default function ClientNav() {
  const [hidden, setHidden] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const isMobile = window.innerWidth < 1024;

      if (!isMobile) {
        setHidden(false);
        lastY = currentY;
        return;
      }

      if (currentY <= 20) {
        setHidden(false);
        lastY = currentY;
        return;
      }

      if (currentY > lastY + 8) {
        setHidden(true);
      } else if (currentY < lastY - 8) {
        setHidden(false);
      }

      lastY = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAuthState = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!active) return;

      setIsLoggedIn(!!userId);

      if (!userId) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data.role === "admin");
    };

    void loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAuthState();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b border-white/10 bg-neutral-950/85 backdrop-blur transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Rentulo
          </Link>

          <div className="text-sm text-white/50 lg:hidden">
            Prenájom vecí jednoducho
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:flex-1 lg:pl-6">
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink href="/items">Ponuky</NavLink>

            {isLoggedIn ? (
              <>
                <NavLink href="/reservations">Moje rezervácie</NavLink>
                <NavLink href="/owner/items">Prenajímam</NavLink>
                <MessagesNavLink />
                <NavLink href="/profile">Profil</NavLink>
                <NavLink href="/verification">Overenie</NavLink>

                {isAdmin ? <NavLink href="/admin">Administrácia</NavLink> : null}

                <NotificationBell />
              </>
            ) : null}
          </nav>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {isLoggedIn ? (
              <button
                type="button"
                className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Odhlasujem..." : "Odhlásiť"}
              </button>
            ) : (
              <>
                <SecondaryNavLink href="/login">Prihlásiť</SecondaryNavLink>
                <SecondaryNavLink href="/register" primary>
                  Registrovať
                </SecondaryNavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}