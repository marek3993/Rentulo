import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rentulo-card overflow-hidden p-8 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo · prenájom vecí jednoducho
            </div>

            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Požičajte si náradie lokálne.
              <br />
              Zarábajte na vybavení,
              <br />
              ktoré už máte.
            </h1>

            <p className="max-w-2xl text-base leading-7 text-white/75 md:text-lg">
              Trhovisko pre krátkodobý prenájom náradia a techniky. Rezervácie,
              správy, workflow prenajímateľa, reklamácie a admin dohľad na
              jednom mieste.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/items"
                className="rentulo-btn-primary px-5 py-3 text-sm"
              >
                Zobraziť ponuky
              </Link>

              <Link
                href="/items/new"
                className="rentulo-btn-secondary px-5 py-3 text-sm"
              >
                Pridať ponuku
              </Link>
            </div>

            <div className="text-sm text-white/55">
              Demo režim: platby sú zatiaľ testovacie. Fokus je na rezervácie,
              správy a prenájom workflow.
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rentulo-card-2 p-5">
              <div className="text-sm text-white/50">Pre nájomcu</div>
              <div className="mt-2 text-lg font-semibold">Rýchla rezervácia</div>
              <div className="mt-2 text-sm leading-6 text-white/70">
                Vyberieš termín, dokončíš rezerváciu a všetko sleduješ v jednom
                prehľade.
              </div>
            </div>

            <div className="rentulo-card-2 p-5">
              <div className="text-sm text-white/50">Pre prenajímateľa</div>
              <div className="mt-2 text-lg font-semibold">Jasný proces odovzdania</div>
              <div className="mt-2 text-sm leading-6 text-white/70">
                Potvrdenie rezervácie, fotky pri odovzdaní, vrátenie, reklamácie
                a komunikácia so zákazníkom.
              </div>
            </div>

            <div className="rentulo-card-2 p-5">
              <div className="text-sm text-white/50">Dôvera</div>
              <div className="mt-2 text-lg font-semibold">Overenie a hodnotenia</div>
              <div className="mt-2 text-sm leading-6 text-white/70">
                Profilové overenie, história rezervácií, správy a hodnotenia po
                dokončení prenájmu.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rentulo-card p-6">
          <div className="text-lg font-semibold">Rezervácie</div>
          <p className="mt-3 leading-7 text-white/70">
            Výber rozsahu dátumov s kontrolou prekryvov. Jasné stavy od žiadosti
            až po ukončenie prenájmu.
          </p>
        </div>

        <div className="rentulo-card p-6">
          <div className="text-lg font-semibold">Správy a priebeh</div>
          <p className="mt-3 leading-7 text-white/70">
            Komunikácia medzi prenajímateľom a záujemcom na jednom mieste, spolu
            s naviazaním na rezerváciu.
          </p>
        </div>

        <div className="rentulo-card p-6">
          <div className="text-lg font-semibold">Reklamácie a dôvera</div>
          <p className="mt-3 leading-7 text-white/70">
            Základný reklamačný proces, overenie profilov a hodnotenia po riadne
            dokončenom prenájme.
          </p>
        </div>
      </section>

      <section className="rentulo-card p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-2xl font-semibold">Chceš si to rovno pozrieť?</div>
            <div className="mt-2 leading-7 text-white/70">
              Otvor ponuky, prejdi na detail položky a vyskúšaj rezerváciu,
              správy a ďalší flow v aplikácii.
            </div>
          </div>

          <Link
            href="/items"
            className="rentulo-btn-primary inline-flex px-5 py-3 text-sm"
          >
            Ísť na ponuky
          </Link>
        </div>
      </section>
    </div>
  );
}