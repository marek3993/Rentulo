import Link from "next/link";

function OwnerTab({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
    >
      {children}
    </Link>
  );
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Prenajímam</h1>
            <p className="mt-1 text-white/60">
              Správa tvojich ponúk, rezervácií a reklamácií na jednom mieste.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <OwnerTab href="/owner/items">Moje ponuky</OwnerTab>
            <OwnerTab href="/owner/reservations">Rezervácie</OwnerTab>
            <OwnerTab href="/owner/disputes">Reklamácie</OwnerTab>
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}