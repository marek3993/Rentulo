"use client";

import Link from "next/link";
import { useState } from "react";

type SuggestedItem = {
  id: number;
  title: string;
  price_per_day: number | null;
  city: string | null;
  category: string | null;
  score: number;
};

type TaskHelperResponse = {
  task_title: string;
  summary: string;
  difficulty: string;
  steps: string[];
  required_tools: string[];
  optional_tools: string[];
  safety_tips: string[];
  search_keywords: string[];
  suggested_items: SuggestedItem[];
};

type IconName =
  | "tool"
  | "leaf"
  | "spark"
  | "home"
  | "pin"
  | "chat"
  | "shield"
  | "clock";

const categories: {
  title: string;
  description: string;
  href: string;
  icon: IconName;
}[] = [
  {
    title: "Náradie",
    description: "Vŕtačky, brúsky, píly, rezačky, hobby aj profi kusy.",
    href: "/items",
    icon: "tool",
  },
  {
    title: "Záhrada",
    description: "Kosačky, plotostrihy, krovinorezy, vysávače lístia.",
    href: "/items",
    icon: "leaf",
  },
  {
    title: "Čistenie",
    description: "Tepovače, wapky, priemyselné vysávače, odvlhčovače.",
    href: "/items",
    icon: "spark",
  },
  {
    title: "Dom a dielňa",
    description: "Rebríky, vozíky, miešačky, ohrievače, drobná technika.",
    href: "/items",
    icon: "home",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Nájdi správnu vec",
    description:
      "Pozrieš ponuky, otvoríš detail a vyberieš termín, ktorý ti sedí.",
    icon: "pin" as IconName,
  },
  {
    step: "02",
    title: "Rezervuj bez chaosu",
    description:
      "Vidíš stav rezervácie, komunikáciu aj ďalšie kroky na jednom mieste.",
    icon: "clock" as IconName,
  },
  {
    step: "03",
    title: "Použi a vráť",
    description:
      "Odovzdanie, vrátenie a potvrdenie prebehnú cez jasný flow v aplikácii.",
    icon: "shield" as IconName,
  },
];

const benefits = [
  "lokálny prenájom bez zbytočného obiehania",
  "prehľad rezervácií, správ a stavu na jednom mieste",
  "vhodné aj pre ľudí, ktorí chcú zarábať na veciach doma",
  "prenájom presne na čas, keď to potrebuješ",
];

const exampleTasks = [
  "vyčistiť odtok",
  "navŕtať poličku",
  "pokosiť trávu",
  "vytepovať sedačku",
];

function IconBadge({ icon }: { icon: IconName }) {
  if (icon === "tool") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 6l4 4" />
        <path d="M5 19l6-6" />
        <path d="M13 5l6 6" />
        <path d="M11 7l6 6" />
        <path d="M4 20l3-1 9-9-2-2-9 9-1 3z" />
      </svg>
    );
  }

  if (icon === "leaf") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M19 5c-6 0-11 4-11 10 0 2.5 1.5 4 4 4 6 0 10-5 10-11 0-2-1-3-3-3z" />
        <path d="M8 19c0-4 4-8 9-10" />
      </svg>
    );
  }

  if (icon === "spark") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
      </svg>
    );
  }

  if (icon === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5.5 10.5V20h13V10.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }

  if (icon === "pin") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s6-5.5 6-11a6 6 0 10-12 0c0 5.5 6 11 6 11z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 18l-1 4 4-2h9a5 5 0 005-5V9a5 5 0 00-5-5H7a5 5 0 00-5 5v4a5 5 0 003 5z" />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
        <path d="M9.5 12l1.8 1.8L15 10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
}

function MiniInfoCard({
  label,
  text,
  icon,
}: {
  label: string;
  text: string;
  icon: IconName;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
        <IconBadge icon={icon} />
      </div>

      <div className="text-xs uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-2 text-sm font-medium text-white/85">{text}</div>
    </div>
  );
}

export default function Home() {
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskHelperResponse | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmed = task.trim();

    if (!trimmed) {
      setError("Napíš čo chceš spraviť.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/task-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Chyba pri spracovaní.");
        return;
      }

      setResult(json as TaskHelperResponse);
    } catch {
      setError("Chyba pri spracovaní.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-indigo-500/10 p-6 md:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_30%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo · prenájom vecí jednoducho
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
                Požičaj si vec na pár dní.
                <br />
                Zarábaj na tom,
                <br />
                čo doma len stojí.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/75 md:text-lg">
                Lokálny marketplace pre náradie a techniku. Ponuky, rezervácie,
                správy a priebeh prenájmu máš na jednom mieste.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/items"
                className="rentulo-btn-primary inline-flex px-5 py-3 text-sm"
              >
                Zobraziť ponuky
              </Link>

              <Link
                href="/items/new"
                className="rentulo-btn-secondary inline-flex px-5 py-3 text-sm"
              >
                Pridať ponuku
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MiniInfoCard
                label="Pre nájomcu"
                text="Rýchly výber a rezervácia"
                icon="pin"
              />
              <MiniInfoCard
                label="Pre majiteľa"
                text="Jednoduché spravovanie ponúk"
                icon="tool"
              />
              <MiniInfoCard
                label="Flow"
                text="Stav, správy aj rezervácie spolu"
                icon="chat"
              />
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -right-6 top-4 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />

            <div className="rentulo-float relative mx-auto max-w-[620px]">
              <img
                src="/rentulo-hero-illustration.png"
                alt="Rentulo hero ilustrácia"
                className="w-full select-none object-contain drop-shadow-[0_30px_80px_rgba(99,102,241,0.28)]"
              />
            </div>

            <div className="rentulo-float-slow absolute left-2 top-10 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                  <IconBadge icon="pin" />
                </div>
                <div>
                  <div className="text-xs text-white/45">Lokalita</div>
                  <div className="text-sm font-medium text-white/85">Trnava a okolie</div>
                </div>
              </div>
            </div>

            <div className="rentulo-float absolute bottom-8 right-0 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                  <IconBadge icon="clock" />
                </div>
                <div>
                  <div className="text-xs text-white/45">Rýchlo</div>
                  <div className="text-sm font-medium text-white/85">Rezervácia za pár klikov</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
  <div className="space-y-4">
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-sm text-white/45">Kategórie</div>
        <h2 className="mt-2 text-2xl font-semibold">Najčastejšie kategórie</h2>
        <p className="mt-2 text-white/65">
          Vyber si kategóriu a prejdi rovno na ponuky, ktoré ťa zaujímajú.
        </p>
      </div>

      <Link
        href="/items"
        className="text-sm text-indigo-300 hover:text-indigo-200"
      >
        Všetky ponuky →
      </Link>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.title}
          href={category.href}
          className="group rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
        >
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
            <IconBadge icon={category.icon} />
          </div>

          <div className="mt-4 text-lg font-semibold">{category.title}</div>
          <div className="mt-2 text-sm leading-6 text-white/65">
            {category.description}
          </div>
          <div className="mt-4 text-sm font-medium text-indigo-300 transition group-hover:translate-x-0.5">
            Pozrieť ponuky
          </div>
        </Link>
      ))}
    </div>
  </div>
</section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-sm text-white/50">Prečo to dáva zmysel</div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                </div>
                <div className="text-sm leading-6 text-white/80">{benefit}</div>
              </div>
            ))}
          </div>
        </div>

        <section className="rounded-3xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/[0.08] via-white/[0.03] to-transparent p-6 md:p-8">
  <div className="max-w-2xl">
    <div className="text-sm text-indigo-300">Dôležité hneď na prvý pohľad</div>
    <h2 className="mt-2 text-2xl font-semibold">Jasné, rýchle, bez chaosu</h2>
    <p className="mt-2 leading-7 text-white/70">
      Nájdeš vhodnú vec, rezervuješ termín a všetko dôležité sleduješ na jednom mieste.
    </p>
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-3">
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
        <IconBadge icon="shield" />
      </div>
      <div className="text-lg font-semibold">Prehľadný flow</div>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Rezervácie, komunikácia a ďalšie kroky máš pokope.
      </p>
    </div>

    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
        <IconBadge icon="tool" />
      </div>
      <div className="text-lg font-semibold">Vhodné aj pre majiteľov</div>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Pridáš ponuku a zarábaš na veciach, ktoré už máš doma.
      </p>
    </div>

    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
        <IconBadge icon="clock" />
      </div>
      <div className="text-lg font-semibold">Rýchly štart</div>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Začni prehliadaním ponúk alebo rovno pridaj vlastnú vec.
      </p>
    </div>
  </div>
</section>

      <section className="rounded-3xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-500/[0.06] via-white/[0.03] to-transparent p-6 md:p-8">
  <div className="mb-6">
    <div className="text-sm text-fuchsia-300">Ako to funguje</div>
    <h2 className="mt-2 text-2xl font-semibold">Tri jednoduché kroky</h2>
  </div>

  <div className="grid gap-4 lg:grid-cols-3">
    {howItWorks.map((item) => (
      <div
        key={item.step}
        className="rounded-3xl border border-white/10 bg-black/20 p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-fuchsia-300">{item.step}</div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300">
            <IconBadge icon={item.icon} />
          </div>
        </div>

        <div className="mt-4 text-xl font-semibold">{item.title}</div>
        <p className="mt-3 leading-7 text-white/70">{item.description}</p>
      </div>
    ))}
  </div>
</section>

      <section className="rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.06] via-white/[0.03] to-transparent p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">Čo chceš spraviť?</h2>
              <p className="mt-2 max-w-2xl leading-7 text-white/70">
                Napíš úlohu a Rentulo navrhne postup, potrebné náradie a vhodné
                ponuky.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {exampleTasks.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setTask(example);
                    setError("");
                  }}
                  disabled={loading}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.08]"
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <textarea
                className="min-h-[130px] w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
                placeholder="napr. vyčistiť odtok, navŕtať poličku, pokosiť trávu, vytepovať sedačku"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                disabled={loading}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rentulo-btn-primary px-5 py-3 text-sm disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Pripravujem..." : "Navrhnúť postup a náradie"}
                </button>

                <Link
                  href="/items"
                  className="rentulo-btn-secondary inline-flex px-5 py-3 text-sm"
                >
                  Radšej rovno na ponuky
                </Link>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <div className="text-sm text-white/50">Čo tým získam</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-white/75">
                <div>• rýchly zoznam potrebného náradia</div>
                <div>• jednoduchý postup po krokoch</div>
                <div>• vhodné ponuky z Rentulo na jednom mieste</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <div className="text-sm text-white/50">Pre koho je to dobré</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-white/75">
                <div>• keď nevieš, čo presne potrebuješ</div>
                <div>• keď chceš ísť rovno na správny item</div>
                <div>• keď si chceš rýchlo overiť postup</div>
              </div>
            </div>
          </div>
        </div>

        {result ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold">{result.task_title}</div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    Obtiažnosť: {result.difficulty}
                  </div>
                </div>
                <div className="mt-2 text-white/70">{result.summary}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="text-lg font-semibold">Postup</div>
                <ol className="mt-4 space-y-3 text-white/80">
                  {result.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="text-lg font-semibold">Budeš potrebovať</div>
                  <ul className="mt-3 space-y-2 text-white/80">
                    {result.required_tools.length === 0 ? (
                      <li>• Bez špeciálneho náradia</li>
                    ) : (
                      result.required_tools.map((tool, index) => (
                        <li key={index}>• {tool}</li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="text-lg font-semibold">Voliteľné</div>
                  <ul className="mt-3 space-y-2 text-white/80">
                    {result.optional_tools.length === 0 ? (
                      <li>• Nič navyše</li>
                    ) : (
                      result.optional_tools.map((tool, index) => (
                        <li key={index}>• {tool}</li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="text-lg font-semibold">Na čo si dať pozor</div>
                <ul className="mt-3 space-y-2 text-white/80">
                  {result.safety_tips.length === 0 ? (
                    <li>• Dodrž základnú bezpečnosť pri práci.</li>
                  ) : (
                    result.safety_tips.map((tip, index) => (
                      <li key={index}>• {tip}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="text-lg font-semibold">Odporúčané ponuky</div>
                <div className="mt-2 text-sm text-white/60">
                  Vybrané podľa úlohy a potrebného náradia.
                </div>

                {result.suggested_items.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    Zatiaľ som nenašiel vhodné ponuky.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {result.suggested_items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/items/${item.id}`}
                        className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                      >
                        <div className="text-base font-semibold">{item.title}</div>

                        <div className="mt-2 text-sm text-white/70">
                          {item.price_per_day !== null
                            ? `${item.price_per_day} € / deň`
                            : "Cena neuvedená"}
                          {item.city ? ` · ${item.city}` : ""}
                          {item.category ? ` · ${item.category}` : ""}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="text-sm text-white/50">Použité kľúčové slová</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.search_keywords.map((keyword, index) => (
                    <div
                      key={index}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/75"
                    >
                      {keyword}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
            <IconBadge icon="clock" />
          </div>
          <div className="text-lg font-semibold">Rezervácie</div>
          <p className="mt-3 leading-7 text-white/70">
            Jasný stav od žiadosti až po ukončenie prenájmu.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
            <IconBadge icon="chat" />
          </div>
          <div className="text-lg font-semibold">Správy</div>
          <p className="mt-3 leading-7 text-white/70">
            Komunikácia priamo pri rezervácii bez hľadania v inboxe.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
            <IconBadge icon="tool" />
          </div>
          <div className="text-lg font-semibold">Pre majiteľov</div>
          <p className="mt-3 leading-7 text-white/70">
            Pridáš ponuku a vieš sledovať dopyty aj rezervácie.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
            <IconBadge icon="shield" />
          </div>
          <div className="text-lg font-semibold">Dôvera</div>
          <p className="mt-3 leading-7 text-white/70">
            Prehľadný flow, jasné kroky a lepší pocit z celej aplikácie.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-indigo-400/20 bg-gradient-to-r from-indigo-500/10 via-white/[0.04] to-white/[0.03] p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-2xl font-semibold">
              Pozrieť ponuky alebo pridať vlastnú vec?
            </div>
            <div className="mt-2 leading-7 text-white/70">
              Najlepšie ďalšie 2 kroky sú jasné hneď odtiaľto.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/items"
              className="rentulo-btn-primary inline-flex px-5 py-3 text-sm"
            >
              Ísť na ponuky
            </Link>

            <Link
              href="/items/new"
              className="rentulo-btn-secondary inline-flex px-5 py-3 text-sm"
            >
              Pridať ponuku
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}