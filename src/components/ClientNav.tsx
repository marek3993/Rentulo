"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function ClientNav() {
  const [hidden, setHidden] = useState(false);

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
            <NavLink href="/reservations">Moje rezervácie</NavLink>
            <NavLink href="/owner/items">Prenajímam</NavLink>
            <NavLink href="/profile">Profil</NavLink>
            <NavLink href="/admin/items">Administrácia</NavLink>
            <NotificationBell />
          </nav>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <SecondaryNavLink href="/login">Prihlásiť</SecondaryNavLink>
            <SecondaryNavLink href="/register" primary>
              Registrovať
            </SecondaryNavLink>
          </div>
        </div>
      </div>
    </header>
  );
}