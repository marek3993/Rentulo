"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | string;

function ActionLink({
  href,
  children,
  primary = false,
  muted = false,
  title,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  muted?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const className = primary
    ? muted
      ? "inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-3.5 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-500/15"
      : "inline-flex items-center rounded-full bg-white px-3.5 py-2 text-sm font-medium text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)] transition hover:bg-white/90"
    : "inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white";

  return (
    <Link aria-label={ariaLabel} className={className} href={href} title={title}>
      {children}
    </Link>
  );
}

function DropdownLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      className="block rounded-xl px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/8 hover:text-white"
      href={href}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

function verificationLabel(status: VerificationStatus) {
  if (status === "verified" || status === "approved") return "Overený profil";
  if (status === "pending") return "Čaká na overenie";
  if (status === "rejected") return "Overenie zamietnuté";
  return "Neoverený profil";
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
      className="relative inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
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
  const pathname = usePathname();

  const [hidden, setHidden] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("unverified");
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMenuOpen = openMenuPath === pathname;

  const avatarUrl = useMemo(() => {
    if (!avatarPath) return null;
    return supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;
  }, [avatarPath]);

  const avatarFallback = fullName.trim().charAt(0).toUpperCase() || "R";
  const isVerified = verificationStatus === "verified" || verificationStatus === "approved";

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
        setAvatarPath(null);
        setFullName("");
        setVerificationStatus("unverified");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role,avatar_path,full_name,verification_status")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setIsAdmin(false);
        setAvatarPath(null);
        setFullName("");
        setVerificationStatus("unverified");
        return;
      }

      setIsAdmin(data.role === "admin");
      setAvatarPath(data.avatar_path ?? null);
      setFullName(data.full_name ?? "");
      setVerificationStatus(data.verification_status ?? "unverified");
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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuPath(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    setOpenMenuPath(null);
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <header
      className={`sticky top-0 z-50 px-3 pt-3 transition-transform duration-300 sm:px-4 lg:px-6 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/10 bg-neutral-950/75 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
        <Link href="/" className="rentulo-topbar-brand flex items-center gap-3 rounded-full px-2.5 py-1.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(99,102,241,0.35),rgba(217,70,239,0.2))] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.25)]">
            R
          </span>
          <span className="rentulo-topbar-brand-text text-lg font-semibold tracking-tight">
            Rentulo
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />

          {isLoggedIn ? (
            <>
              <ActionLink
                href={isVerified ? "/items/new" : "/verification"}
                primary
                muted={!isVerified}
                title={
                  isVerified
                    ? "Pridať novú ponuku"
                    : "Pre pridanie ponuky najprv dokončite overenie profilu."
                }
                ariaLabel={
                  isVerified
                    ? "Pridať novú ponuku"
                    : "Pridať ponuku, najprv dokončite overenie profilu"
                }
              >
                <span>Pridať ponuku</span>
                {!isVerified ? (
                  <span className="ml-2 hidden rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium sm:inline-flex">
                    Najprv over profil
                  </span>
                ) : null}
              </ActionLink>

              <MessagesNavLink />
              <NotificationBell />

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                  onClick={() =>
                    setOpenMenuPath((value) => (value === pathname ? null : pathname))
                  }
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Otvoriť používateľské menu"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Profilová fotka"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{avatarFallback}</span>
                  )}
                </button>

                {isMenuOpen ? (
                  <div className="absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className="border-b border-white/10 px-3 py-3">
                      <div className="text-sm font-medium text-white">
                        {fullName.trim() || "Môj účet"}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {verificationLabel(verificationStatus)}
                      </div>
                    </div>

                    <div className="pt-2">
                      <DropdownLink href="/profile" onNavigate={() => setOpenMenuPath(null)}>
                        Profil
                      </DropdownLink>
                      <DropdownLink
                        href="/reservations"
                        onNavigate={() => setOpenMenuPath(null)}
                      >
                        Moje rezervácie
                      </DropdownLink>

                      {isVerified ? (
                        <DropdownLink
                          href="/owner/items"
                          onNavigate={() => setOpenMenuPath(null)}
                        >
                          Moje inzeráty
                        </DropdownLink>
                      ) : null}

                      {isAdmin ? (
                        <DropdownLink href="/admin" onNavigate={() => setOpenMenuPath(null)}>
                          Administrácia
                        </DropdownLink>
                      ) : null}

                      <button
                        type="button"
                        className="mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/8 hover:text-white disabled:opacity-50"
                        onClick={handleSignOut}
                        disabled={signingOut}
                      >
                        {signingOut ? "Odhlasujem..." : "Odhlásiť"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <ActionLink href="/login">Prihlásiť</ActionLink>
              <ActionLink href="/register" primary>
                Registrovať
              </ActionLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
