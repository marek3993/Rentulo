"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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
      className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
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
          ? "rounded-full bg-white px-3.5 py-2 text-sm font-medium text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)] transition hover:bg-white/90"
          : "rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/[0.08] hover:text-white"
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

  const loadUnreadCount = useEffectEvent(async () => {
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
  });

  const scheduleLoadUnreadCount = useEffectEvent(() => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadUnreadCount();
    }, 150);
  });

  useEffect(() => {
    let active = true;

    scheduleLoadUnreadCount();

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
      className="relative rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
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
      className={`sticky top-0 z-50 px-3 pt-3 transition-transform duration-300 sm:px-4 lg:px-6 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 rounded-[1.6rem] border border-white/10 bg-neutral-950/75 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(99,102,241,0.35),rgba(217,70,239,0.2))] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.25)]">
              R
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight text-white">
                Rentulo
              </span>
              <span className="hidden text-xs uppercase tracking-[0.22em] text-white/40 sm:block">
                Trust-first marketplace
              </span>
            </span>
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

                {isAdmin ? <NavLink href="/admin">Administrácia</NavLink> : null}

                <NotificationBell />
              </>
            ) : null}
          </nav>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {isLoggedIn ? (
              <button
                type="button"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)] transition hover:bg-white/90 disabled:opacity-50"
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
