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

      <section className="rentulo-card p-8">
        <div className="max-w-3xl">
          <div className="text-2xl font-semibold">Čo chceš spraviť?</div>
          <div className="mt-2 leading-7 text-white/70">
            Napíš úlohu a Rentulo ti navrhne postup, potrebné náradie a vhodné ponuky.
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <textarea
            className="min-h-[110px] w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35"
            placeholder="napr. vyčistiť odtok, navŕtať poličku, pokosiť trávu, natrieť stenu"
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

            <button
              type="button"
              className="rentulo-btn-secondary px-5 py-3 text-sm"
              onClick={() => {
                setTask("vyčistiť odtok");
                setError("");
              }}
              disabled={loading}
            >
              Skúsiť príklad
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold">{result.task_title}</div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    Obtiažnosť: {result.difficulty}
                  </div>
                </div>
                <div className="mt-2 text-white/70">{result.summary}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-lg font-semibold">Postup</div>
                <ol className="mt-3 space-y-2 text-white/80">
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
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="text-lg font-semibold">Budeš určite potrebovať</div>
                  <ul className="mt-3 space-y-2 text-white/80">
                    {result.required_tools.map((tool, index) => (
                      <li key={index}>• {tool}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="text-lg font-semibold">Voliteľné</div>
                  <ul className="mt-3 space-y-2 text-white/80">
                    {result.optional_tools.map((tool, index) => (
                      <li key={index}>• {tool}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-lg font-semibold">Na čo si dať pozor</div>
                <ul className="mt-3 space-y-2 text-white/80">
                  {result.safety_tips.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-lg font-semibold">Odporúčané ponuky z Rentulo</div>
                <div className="mt-2 text-sm text-white/60">
                  Vybrané podľa tejto úlohy a potrebného náradia.
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
                          {item.price_per_day !== null ? `${item.price_per_day} € / deň` : "Cena neuvedená"}
                          {item.city ? ` · ${item.city}` : ""}
                          {item.category ? ` · ${item.category}` : ""}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
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