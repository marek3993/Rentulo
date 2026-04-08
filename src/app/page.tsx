"use client";

import Link from "next/link";
import Image from "next/image";
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

type Category = {
  title: string;
  description: string;
  href: string;
  icon: IconName;
  accent: string;
  chips: string[];
};

const categories: Category[] = [
  {
    title: "Náradie",
    description:
      "Vŕtačky, brúsky, píly a ďalšie veci, pri ktorých chceš jasný priebeh prenájmu.",
    href: "/items",
    icon: "tool",
    accent: "from-amber-400/20 via-orange-400/10 to-transparent",
    chips: ["domáce opravy", "jednorazový projekt"],
  },
  {
    title: "Šport",
    description:
      "Výbava na sezónu, víkend aj jednorazové použitie bez potreby kupovať vlastnú.",
    href: "/items",
    icon: "shield",
    accent: "from-sky-400/20 via-cyan-400/10 to-transparent",
    chips: ["víkendová výbava", "sezónne použitie"],
  },
  {
    title: "Detská výbavička",
    description:
      "Kočíky, nosiče a praktické veci, kde záleží na dôvere aj stave pri prevzatí.",
    href: "/items",
    icon: "home",
    accent: "from-emerald-400/20 via-lime-300/10 to-transparent",
    chips: ["krátke obdobie", "citlivý stav"],
  },
  {
    title: "Event vybavenie",
    description:
      "Veci na oslavy, svadby a akcie s prehľadným odovzdaním aj vrátením.",
    href: "/items",
    icon: "spark",
    accent: "from-fuchsia-400/20 via-violet-400/10 to-transparent",
    chips: ["presný termín", "hladké odovzdanie"],
  },
];

const trustPillars: {
  title: string;
  description: string;
  icon: IconName;
}[] = [
  {
    title: "Overení používatelia",
    description:
      "Profil a overenie sú viditeľné priamo v aplikácii, aby bolo jasnejšie, s kým si rezerváciu dohadujete.",
    icon: "shield",
  },
  {
    title: "Bezpečný priebeh prenájmu",
    description:
      "Rezervácia, potvrdenie, stav platby, prevzatie aj vrátenie sleduješ krok za krokom na jednom mieste.",
    icon: "clock",
  },
  {
    title: "Platforma rieši spor aj dôkazy",
    description:
      "Ak vznikne problém, dôležité kroky, komunikácia a dôkazové fotky ostávajú naviazané na rezerváciu.",
    icon: "chat",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Rezervácia",
    description: "Vyberieš si vec, termín a odošleš rezerváciu priamo cez Rentulo.",
    icon: "pin" as IconName,
  },
  {
    step: "02",
    title: "Potvrdenie",
    description: "Prenajímateľ rezerváciu potvrdí a v aplikácii sa zobrazí ďalší krok.",
    icon: "shield" as IconName,
  },
  {
    step: "03",
    title: "Stav platby",
    description: "Platobný krok sleduješ priamo pri rezervácii, bez hľadania mimo aplikácie.",
    icon: "clock" as IconName,
  },
  {
    step: "04",
    title: "Prevzatie",
    description: "Pri odovzdaní máš k dispozícii jasný checkpoint a dôkazové fotky stavu veci.",
    icon: "tool" as IconName,
  },
  {
    step: "05",
    title: "Vrátenie",
    description: "Aj návrat veci prebieha cez rovnaký flow, vrátane potvrdenia a fotiek.",
    icon: "home" as IconName,
  },
  {
    step: "06",
    title: "Spor ak treba",
    description: "Ak sa niečo pokazí, rezervácia má nadviazaný priestor pre problém aj dôkazy.",
    icon: "chat" as IconName,
  },
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
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
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
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
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
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5.5 10.5V20h13V10.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }

  if (icon === "pin") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 21s6-5.5 6-11a6 6 0 10-12 0c0 5.5 6 11 6 11z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 18l-1 4 4-2h9a5 5 0 005-5V9a5 5 0 00-5-5H7a5 5 0 00-5 5v4a5 5 0 003 5z" />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
        <path d="M9.5 12l1.8 1.8L15 10" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
      {children}
    </div>
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
    <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 backdrop-blur-sm shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85">
        <IconBadge icon={icon} />
      </div>
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">{label}</div>
      <div className="mt-2 text-sm font-medium leading-6 text-white/85">{text}</div>
    </div>
  );
}

function CategoryTile({
  category,
  large = false,
}: {
  category: Category;
  large?: boolean;
}) {
  return (
    <Link
      href={category.href}
      className={`group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/25 p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] ${
        large ? "sm:row-span-2 min-h-[20rem]" : "min-h-[15rem]"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${category.accent}`} />
      <div className="pointer-events-none absolute -right-10 top-8 h-32 w-32 rounded-full border border-white/10 bg-white/5 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85">
            <IconBadge icon={category.icon} />
          </div>
          <div className="mt-4 text-xl font-semibold">{category.title}</div>
          <div className="mt-3 text-sm leading-6 text-white/68">{category.description}</div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {category.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70"
              >
                {chip}
              </span>
            ))}
          </div>

          <span className="text-sm font-medium text-white/85 transition group-hover:translate-x-1">
            Pozrieť ponuky
          </span>
        </div>
      </div>
    </Link>
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
    <div className="space-y-10 pb-6 lg:space-y-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_42%,rgba(99,102,241,0.14)_100%)] px-6 py-8 shadow-[0_30px_120px_rgba(0,0,0,0.35)] md:px-8 md:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(129,140,248,0.18),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(255,255,255,0.12),transparent_22%),radial-gradient(circle_at_78%_80%,rgba(217,70,239,0.14),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 to-transparent" />

        <div className="relative grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="space-y-8">
            <SectionEyebrow>Trust-first marketplace</SectionEyebrow>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl lg:text-[4.6rem]">
                Bezpečný peer-to-peer {" "}
                <span className="bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
                  prenájom vecí
                </span>{" "}
                medzi ľuďmi na Slovensku.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/72 md:text-lg md:leading-8">
                Rentulo stavia dôveru na overených profiloch, jasnom priebehu
                rezervácie a dôkazových krokoch pri prevzatí aj vrátení.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/items"
                className="rentulo-btn-primary inline-flex items-center px-5 py-3 text-sm shadow-[0_16px_40px_rgba(99,102,241,0.35)]"
              >
                Zobraziť ponuky
              </Link>

              <Link
                href="/items/new"
                className="rentulo-btn-secondary inline-flex items-center bg-white/[0.03] px-5 py-3 text-sm backdrop-blur-sm"
              >
                Pridať ponuku
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MiniInfoCard
                label="Overenie"
                text="Vidíš, s kým si rezerváciu dohadujete."
                icon="shield"
              />
              <MiniInfoCard
                label="Priebeh"
                text="Rezervácia, platba, prevzatie aj vrátenie v jednom flow."
                icon="clock"
              />
              <MiniInfoCard
                label="Dôkazy"
                text="Fotky a komunikácia ostávajú pri konkrétnej rezervácii."
                icon="chat"
              />
            </div>
          </div>

          <div className="relative min-h-[560px]">
            <div className="pointer-events-none absolute right-4 top-6 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-12 left-8 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />

            <div className="absolute left-0 top-8 hidden w-44 rounded-[1.4rem] border border-white/10 bg-black/35 p-4 backdrop-blur-md lg:block">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                Dôvera
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85">
                  <IconBadge icon="shield" />
                </div>
                <div className="text-sm font-medium text-white/85">
                  Overené profily a jasné kroky
                </div>
              </div>
            </div>

            <div className="absolute right-0 top-0 w-full max-w-[34rem] rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_50%,rgba(0,0,0,0.12)_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                    Marketplace flow
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Prenájom s checkpointmi
                  </div>
                </div>
                <div className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs text-white/65">
                  Rentulo
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Rezervácia",
                    text: "Termín a dohoda na jednom mieste",
                    icon: "pin" as IconName,
                  },
                  {
                    title: "Prevzatie",
                    text: "Fotky a stav veci pri odovzdaní",
                    icon: "tool" as IconName,
                  },
                  {
                    title: "Vrátenie",
                    text: "Rovnaký priebeh aj pri ukončení",
                    icon: "home" as IconName,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85">
                      <IconBadge icon={item.icon} />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-white">
                      {item.title}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/65">
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative mt-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.72),rgba(7,10,18,0.92))] px-4 py-5 sm:px-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18),transparent_52%)]" />
                <div className="relative grid gap-6 sm:grid-cols-[1.1fr_0.9fr] sm:items-center">
                  <div className="space-y-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                      Vizualizácia platformy
                    </div>
                    <div className="text-2xl font-semibold tracking-tight text-white">
                      Dôkazy, komunikácia a stav rezervácie pokope
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["overenie", "fotky", "správy", "checkpointy"].map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rentulo-float relative mx-auto w-full max-w-[17rem]">
                    <Image
                      src="/rentulo-hero-illustration.png"
                      alt="Rentulo hero ilustrácia"
                      width={544}
                      height={544}
                      className="w-full select-none object-contain drop-shadow-[0_26px_80px_rgba(99,102,241,0.35)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-10 left-3 w-[13rem] rounded-[1.4rem] border border-white/10 bg-black/45 p-4 backdrop-blur-md md:left-8">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85">
                  <IconBadge icon="chat" />
                </div>
                <div>
                  <div className="text-xs text-white/45">Dôkazové kroky</div>
                  <div className="text-sm font-medium text-white/85">
                    Prevzatie, vrátenie a spor pri rezervácii
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.18)] md:p-8">
          <SectionEyebrow>Kategórie</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Marketplace pre veci, pri ktorých záleží na dôvere aj hladkom odovzdaní
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/68">
            Vyber si oblasť a prejdi rovno na ponuky, kde sa oplatí mať rezerváciu,
            dôkazy aj komunikáciu pokope.
          </p>

          <div className="mt-8 space-y-4">
            {[
              "Prenájom bez potreby kupovať vlastnú vec",
              "Jasné checkpointy pri odovzdaní aj návrate",
              "Trust-first flow namiesto chaotickej dohody mimo platformy",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white/75"
              >
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/items"
            className="mt-8 inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/[0.09]"
          >
            Všetky ponuky
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category, index) => (
            <CategoryTile
              key={category.title}
              category={category}
              large={index === 0}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.02fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.14),rgba(255,255,255,0.03)_35%,rgba(0,0,0,0.08)_100%)] p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_32%)]" />
          <div className="relative">
            <SectionEyebrow>Na čom stojí dôvera</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Dôležité veci vidíš ešte pred samotným prenájmom
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-white/72">
              Aplikácia zviditeľňuje body, ktoré pomáhajú ľuďom dôverovať si pri
              prenájme aj medzi sebou. Nejde len o listing, ale o celý kontrolovaný
              priebeh.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <MiniInfoCard
                label="Stav rezervácie"
                text="Každý prenájom má zrozumiteľný priebeh od potvrdenia až po ukončenie."
                icon="clock"
              />
              <MiniInfoCard
                label="Komunikácia"
                text="Dôležitá komunikácia ostáva naviazaná na konkrétnu rezerváciu."
                icon="chat"
              />
              <MiniInfoCard
                label="Prevzatie a vrátenie"
                text="Checkpointy pri odovzdaní aj návrate veci držia obe strany v rovnakom flow."
                icon="tool"
              />
              <MiniInfoCard
                label="Dôvera"
                text="Overenie, dôkazy a spor pri potrebe patria priamo do aplikácie."
                icon="shield"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
          {trustPillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 p-6 shadow-[0_16px_50px_rgba(0,0,0,0.18)] ${
                index === 0
                  ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(0,0,0,0.18))]"
                  : index === 1
                    ? "bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(0,0,0,0.18))]"
                    : "bg-[linear-gradient(135deg,rgba(217,70,239,0.14),rgba(0,0,0,0.18))]"
              }`}
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85">
                <IconBadge icon={pillar.icon} />
              </div>
              <div className="mt-5 text-2xl font-semibold tracking-tight text-white">
                {pillar.title}
              </div>
              <p className="mt-3 text-sm leading-7 text-white/72">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(244,114,182,0.08),rgba(255,255,255,0.03)_35%,rgba(0,0,0,0.08)_100%)] p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(232,121,249,0.18),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_24%)]" />

        <div className="relative">
          <SectionEyebrow>Jeden jasný lifecycle</SectionEyebrow>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Od rezervácie až po spor, ak treba
              </h2>
              <p className="mt-4 leading-7 text-white/72">
                Rentulo zjednocuje celý priebeh prenájmu do jedného zrozumiteľného
                flow, aby obidve strany vedeli, čo nasleduje.
              </p>
            </div>

            <div className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
              Čistý krokový priebeh bez obchádzania platformy
            </div>
          </div>

          <div className="relative mt-10">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-fuchsia-300/60 via-white/20 to-transparent lg:hidden" />
            <div className="absolute left-12 right-12 top-6 hidden h-px bg-gradient-to-r from-fuchsia-300/60 via-white/20 to-transparent lg:block" />

            <div className="grid gap-4 lg:grid-cols-6">
              {howItWorks.map((item) => (
                <div
                  key={item.step}
                  className="relative rounded-[1.5rem] border border-white/10 bg-black/20 p-5 pl-16 backdrop-blur-sm lg:min-h-[16rem] lg:p-5 lg:pt-14"
                >
                  <div className="absolute left-4 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 text-sm font-semibold text-fuchsia-200 lg:left-5 lg:top-5">
                    {item.step}
                  </div>
                  <div className="absolute left-16 top-5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85 lg:left-5 lg:top-16">
                    <IconBadge icon={item.icon} />
                  </div>

                  <div className="lg:mt-14">
                    <div className="text-lg font-semibold text-white">{item.title}</div>
                    <p className="mt-3 text-sm leading-6 text-white/68">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.22)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_24%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6">
            <div>
              <SectionEyebrow>Pomocník pre výber veci</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Nevieš ešte presne, čo potrebuješ?
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-white/72">
                Napíš úlohu a Rentulo navrhne postup, potrebné náradie a vhodné
                ponuky. Funkcia ostáva k dispozícii, ale hlavný priebeh prenájmu
                stále vedie cez rezerváciu a jej checkpointy.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-5">
                <div className="text-sm text-white/50">Kedy sa hodí</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-white/75">
                  <div>• keď chceš rýchlo zistiť, čo vôbec hľadáš</div>
                  <div>• keď potrebuješ zoznam náradia bez dlhého pátrania</div>
                  <div>• keď si chceš porovnať úlohu s ponukami na Rentulo</div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-5">
                <div className="text-sm text-white/50">Na čo nenahrádza flow rezervácie</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-white/75">
                  <div>• nepreskakuje potvrdenie rezervácie</div>
                  <div>• nemení platobné ani odovzdávacie kroky</div>
                  <div>• neskrýva dôkazové fotky ani komunikáciu pri rezervácii</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,22,0.9),rgba(13,17,28,0.76))] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                    Task helper
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Zadaj úlohu a nechaj si pripraviť štart
                  </div>
                </div>
                <div className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs text-white/65">
                  bez zmeny flow
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <textarea
                  className="min-h-[150px] w-full rounded-[1.25rem] border border-white/15 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/35"
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
                    className="rentulo-btn-secondary inline-flex items-center bg-white/[0.03] px-5 py-3 text-sm"
                  >
                    Radšej rovno na ponuky
                  </Link>
                </div>

                {error ? (
                  <div className="rounded-[1.25rem] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}
              </div>

              {!result ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: "Úloha",
                      text: "napíšeš, čo chceš spraviť",
                    },
                    {
                      title: "Postup",
                      text: "dostaneš návrh krokov a náradia",
                    },
                    {
                      title: "Ponuky",
                      text: "porovnáš výsledok s Rentulo ponukami",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-2 text-sm leading-6 text-white/65">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {result ? (
          <div className="relative mt-8 grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold text-white">{result.task_title}</div>
                  <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                    Obtiažnosť: {result.difficulty}
                  </div>
                </div>
                <div className="mt-3 text-white/72">{result.summary}</div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
                <div className="text-lg font-semibold text-white">Postup</div>
                <ol className="mt-4 space-y-3 text-white/82">
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
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
                  <div className="text-lg font-semibold text-white">Budeš potrebovať</div>
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

                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
                  <div className="text-lg font-semibold text-white">Voliteľné</div>
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

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
                <div className="text-lg font-semibold text-white">Na čo si dať pozor</div>
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
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
                <div className="text-lg font-semibold text-white">Odporúčané ponuky</div>
                <div className="mt-2 text-sm text-white/60">
                  Vybrané podľa úlohy a potrebného náradia.
                </div>

                {result.suggested_items.length === 0 ? (
                  <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    Zatiaľ som nenašiel vhodné ponuky.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {result.suggested_items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/items/${item.id}`}
                        className="block rounded-[1.2rem] border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                      >
                        <div className="text-base font-semibold text-white">{item.title}</div>

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

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:p-6">
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

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(255,255,255,0.05)_42%,rgba(236,72,153,0.14)_100%)] p-8 shadow-[0_30px_110px_rgba(0,0,0,0.28)] md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_82%_72%,rgba(232,121,249,0.18),transparent_24%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <div className="max-w-2xl">
            <SectionEyebrow>Záver homepage</SectionEyebrow>
            <div className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Chceš si bezpečne vybrať vec alebo ju začať prenajímať?
            </div>
            <div className="mt-4 leading-7 text-white/74">
              Obe cesty ostávajú rovnaké, len sú teraz jasnejšie postavené okolo
              dôvery, checkpointov a kontrolovaného priebehu prenájmu.
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/items"
                className="rentulo-btn-primary inline-flex items-center px-5 py-3 text-sm shadow-[0_16px_40px_rgba(99,102,241,0.35)]"
              >
                Ísť na ponuky
              </Link>

              <Link
                href="/items/new"
                className="rentulo-btn-secondary inline-flex items-center bg-white/[0.04] px-5 py-3 text-sm"
              >
                Pridať ponuku
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
              <div className="text-sm font-semibold text-white">Pre nájomcov</div>
              <div className="mt-3 text-sm leading-6 text-white/70">
                Nájdeš vec, termín aj jasný priebeh rezervácie bez straty kontextu.
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
              <div className="text-sm font-semibold text-white">Pre prenajímateľov</div>
              <div className="mt-3 text-sm leading-6 text-white/70">
                Ponuku spravuješ s väčšou dôverou, dôkazmi a prehľadnejším odovzdaním.
              </div>
            </div>

            <div className="sm:col-span-2 rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5">
              <div className="flex flex-wrap gap-2">
                {["overenie", "rezervácia", "prevzatie", "vrátenie", "spor"].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/72"
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
              <div className="mt-4 text-sm leading-6 text-white/70">
                Trust-first positioning ostáva zachované. Mení sa len forma, nie flow.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
