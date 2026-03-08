"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function tabClass(active: boolean) {
  return `rounded-xl border px-3 py-2 text-sm font-medium transition
    ${active ? "border-white/30 bg-white/10" : "border-white/15 hover:bg-white/10"}`;
}

export function OwnerSubnav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/owner/reservations" && pathname.startsWith(href));

  return (
    <nav aria-label="Navigácia prenajímateľa" className="flex flex-wrap gap-2">
      <Link
        href="/owner/reservations"
        className={tabClass(isActive("/owner/reservations"))}
        aria-current={isActive("/owner/reservations") ? "page" : undefined}
      >
        Rezervácie
      </Link>

      <Link
        href="/owner/items"
        className={tabClass(isActive("/owner/items"))}
        aria-current={isActive("/owner/items") ? "page" : undefined}
      >
        Moje ponuky
      </Link>

      <Link
        href="/owner/disputes"
        className={tabClass(isActive("/owner/disputes"))}
        aria-current={isActive("/owner/disputes") ? "page" : undefined}
      >
        Reklamácie
      </Link>
    </nav>
  );
}
