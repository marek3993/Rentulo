import "./globals.css";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";

export const metadata = {
  title: "Rentulo",
  description: "Peer-to-peer rentals",
};

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

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/85 backdrop-blur">
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <body className="min-h-screen bg-neutral-950 text-white">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}