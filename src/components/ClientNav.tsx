"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabaseClient";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | string;

function ActionLink({
  href,
  children,
  variant = "default",
  title,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "contrast";
  title?: string;
  ariaLabel?: string;
}) {
  const className =
    variant === "contrast"
      ? "rentulo-nav-chip rentulo-nav-chip-contrast"
      : "rentulo-nav-chip";

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
      className="rentulo-topbar-menu-link"
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
    <Link className="rentulo-nav-chip relative" href="/messages">
      Správy
      {unreadCount > 0 ? (
        <span className="rentulo-nav-count ml-2">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

export default function ClientNav() {
  const pathname = usePathname();

  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("unverified");
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const [openVerificationPopoverPath, setOpenVerificationPopoverPath] = useState<string | null>(
    null
  );
  const [signingOut, setSigningOut] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const addOfferRef = useRef<HTMLDivElement | null>(null);

  const avatarUrl = useMemo(() => {
    if (!avatarPath) return null;
    return supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;
  }, [avatarPath]);

  const avatarFallback = fullName.trim().charAt(0).toUpperCase() || "R";
  const isVerified = verificationStatus === "verified" || verificationStatus === "approved";
  const isMenuOpen = openMenuPath === pathname;
  const isVerificationPopoverOpen =
    openVerificationPopoverPath === pathname && isLoggedIn && !isVerified;

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const isMobile = window.innerWidth < 1024;

      setScrolled(currentY > 12);

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

    onScroll();

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
      const target = event.target as Node;

      if (!menuRef.current?.contains(target)) {
        setOpenMenuPath(null);
      }

      if (!addOfferRef.current?.contains(target)) {
        setOpenVerificationPopoverPath(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
        setOpenVerificationPopoverPath(null);
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
      className={`rentulo-topbar sticky top-0 z-50 transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="rentulo-topbar-shell" data-scrolled={scrolled}>
        <div className="rentulo-topbar-inner">
          <Link
            href="/"
            className="rentulo-topbar-brand flex items-center gap-3 rounded-full px-2.5 py-1.5"
          >
            <span className="rentulo-topbar-mark inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold">
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
                <div className="relative" ref={addOfferRef}>
                  {isVerified ? (
                    <Link
                      href="/items/new"
                      className="rentulo-add-offer-trigger"
                      data-state="active"
                      title="Pridať ponuku"
                      aria-label="Pridať ponuku"
                    >
                      Pridať ponuku
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rentulo-add-offer-trigger"
                        data-state="inactive"
                        aria-expanded={isVerificationPopoverOpen}
                        aria-haspopup="dialog"
                        aria-label="Pridať ponuku"
                        title="Pre pridanie ponuky si musíte overiť profil."
                        onClick={() =>
                          setOpenVerificationPopoverPath((value) =>
                            value === pathname ? null : pathname
                          )
                        }
                      >
                        Pridať ponuku
                      </button>

                      {isVerificationPopoverOpen ? (
                        <div
                          className="rentulo-nav-popover absolute right-0 top-full z-50 mt-3 w-[18rem]"
                          role="dialog"
                          aria-label="Upozornenie k overeniu profilu"
                        >
                          <p className="text-sm text-foreground/80">
                            Pre pridanie ponuky sa musí najprv overiť profil.
                          </p>
                          <Link
                            href="/verification"
                            className="mt-3 inline-flex text-sm font-semibold text-amber-600 underline decoration-amber-400/60 underline-offset-4 hover:text-amber-700"
                            onClick={() => setOpenVerificationPopoverPath(null)}
                          >
                            Prejsť na overenie profilu
                          </Link>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <MessagesNavLink />
                <NotificationBell />

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className="rentulo-nav-avatar"
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
                    <div className="rentulo-topbar-menu absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-2xl p-2">
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
                          className="rentulo-topbar-menu-link mt-1 block w-full text-left disabled:opacity-50"
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
                <ActionLink href="/register" variant="contrast">
                  Registrovať
                </ActionLink>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
