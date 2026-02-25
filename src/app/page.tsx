import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Požičajte si náradie lokálne. Zarábajte na vybavení, ktoré už máte.
          </h1>
          <p className="text-white/80">
            Trhovisko pre krátkodobý prenájom náradia a techniky. Rezervácie, workflow prenajímateľa,
            admin dohľad, hodnotenia a reklamácie.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/items"
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
            >
              Zobraziť ponuky
            </Link>
            <Link
              href="/items/new"
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            >
              Pridať ponuku
            </Link>
          </div>

          <div className="text-sm text-white/60">Demo: platby zatiaľ vypnuté · fokus na rezervácie</div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Rezervácie</div>
          <p className="mt-2 text-white/80">
            Výber rozsahu dátumov s kontrolou prekryvov. Prenajímateľ potvrdí/zruší.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Dôvera</div>
          <p className="mt-2 text-white/80">
            Hodnotenia položky aj prenajímateľa. Recenzia až po potvrdenej rezervácii.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Reklamácie</div>
          <p className="mt-2 text-white/80">
            Základný proces reklamácie pre potvrdené rezervácie s prehľadom pre prenajímateľa/admina.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-semibold">Chcete vidieť demo?</div>
            <div className="mt-1 text-white/80">
              Otvorte Ponuky → detail položky → rezervácia → správa ako prenajímateľ/admin.
            </div>
          </div>
          <Link
            href="/items"
            className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
          >
            Ísť na ponuky
          </Link>
        </div>
      </section>
    </div>
  );
}