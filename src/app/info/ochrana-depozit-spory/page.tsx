import Link from "next/link";

const sections = [
  {
    title: "Co je ochrana",
    body:
      "Ochrana je informacny a procesny ramec okolo rezervacie. Pomaha vysvetlit, kde v rezervacii vidis financny prehlad, stav rezervacie a kam sa presuva riesenie problemu, ak vznikne spor.",
  },
  {
    title: "Co je depozit",
    body:
      "Depozit je na Rentulo zatial zobrazovany ako interny financny snapshot pri rezervacii. Tento prehlad sam o sebe nepotvrdzuje automaticke uvolnenie, zadrzanie ani vratenie penazi.",
  },
  {
    title: "Kde to uvidis",
    body:
      "V detaile rezervacie na stranke Moje rezervacie vidis snapshot prenajmu, snapshot depozitu a informacny interny stav depozitu. Financny snapshot rezervacie vidis aj na stranke Platba.",
  },
  {
    title: "Ako to suvisi so sporom",
    body:
      "Ak pri prenajme vznikne problem, dalsi postup sa riesi cez spor. Informacny interny stav v rezervacii ma pomoct pochopit kontext, ale sam o sebe nerozhoduje o vysledku sporu ani o pohybe penazi.",
  },
];

export default function ProtectionDepositInfoPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <span className="inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/60">
          Informacne vysvetlenie
        </span>
        <h1 className="mt-4 text-3xl font-semibold text-white">Ochrana, depozit a spor</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          Tato stranka vysvetluje, co na Rentulo znamena ochrana a depozit, kde tieto
          informacie uvidis a ako suvisia so sporom. Je to read-only vysvetlenie bez slubov o
          automatickom pohybe penazi.
        </p>
      </section>

      <section className="grid gap-4">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-white/10 bg-black/20 p-5"
          >
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Kde pokracovat</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:bg-white/10"
            href="/reservations"
          >
            Moje rezervacie
          </Link>
          <Link
            className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:bg-white/10"
            href="/payment"
          >
            Platba
          </Link>
          <Link
            className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:bg-white/10"
            href="/disputes"
          >
            Spory
          </Link>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Ak je rezervacia uz v spore, detail sporu sleduj v sekcii Spory. Samotny informacny
          depozitny stav v rezervacii nenahradza rozhodnutie v spore.
        </p>
      </section>
    </main>
  );
}
