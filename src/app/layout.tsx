import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Rentulo",
  description: "Peer-to-peer rentals",
};

function Nav() {
  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Rentulo
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/items">
            Items
          </Link>
          <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/reservations">
            Reservations
          </Link>
          <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/owner/reservations">
            Owner
          </Link>
          <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/admin/items">
            Admin
          </Link>
          <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/profile">
            Profile
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-white">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}