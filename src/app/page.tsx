"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type SuggestedItem = {
  id: number;
  title: string;
  price_per_day: number | null;
  city: string | null;
  category: string | null;
  image_url: string | null;
};

type TaskHelperResponse = {
  search_hint?: string | null;
  suggested_items: SuggestedItem[];
};

type CategoryName = "tools" | "sport" | "baby" | "event";
type HelperLocationStatus = "missing" | "requesting" | "ready" | "denied" | "unavailable" | "error";

const categoryTiles: Array<{
  key: CategoryName;
  title: string;
  description: string;
  href: string;
  image: string;
}> = [
  {
    key: "tools",
    title: "Náradie",
    description: "Všetko pre majstrov aj domácich kutilov.",
    href: "/items",
    image: "/rentulo-home-tools-final.png",
  },
  {
    key: "sport",
    title: "Šport",
    description: "Športová výbava pre tvoj aktívny život.",
    href: "/items",
    image: "/rentulo-home-sport-final.png",
  },
  {
    key: "baby",
    title: "Detská výbavička",
    description: "Kvalitné veci pre deti, bez zbytočných nákladov.",
    href: "/items",
    image: "/rentulo-home-baby-final.png",
  },
  {
    key: "event",
    title: "Event vybavenie",
    description: "Vybavenie, ktoré spraví tvoju akciu výnimočnou.",
    href: "/items",
    image: "/rentulo-home-event-final.png",
  },
];

const exampleTasks = ["vŕtačka na poličku", "tepovač na sedačku", "kosačka na vysokú trávu", "čistenie odtoku"];

const radiusOptions = [5, 10, 20, 50] as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-full border border-violet-400/18 bg-violet-500/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-violet-200/80">
      {children}
    </div>
  );
}

function CategoryIcon({ name }: { name: CategoryName }) {
  if (name === "tools") {
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

  if (name === "sport") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M7 9c1.6.7 3.3 1 5 1s3.4-.3 5-1" />
        <path d="M7 15c1.6-.7 3.3-1 5-1s3.4.3 5 1" />
      </svg>
    );
  }

  if (name === "baby") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="9" r="3" />
        <path d="M7 20c.6-2.8 2.4-4.5 5-4.5S16.4 17.2 17 20" />
        <path d="M9 6.5L7.5 5" />
        <path d="M15 6.5L16.5 5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v5" />
      <path d="M12 16v5" />
      <path d="M3 12h5" />
      <path d="M16 12h5" />
      <path d="M5.5 5.5l3.5 3.5" />
      <path d="M15 15l3.5 3.5" />
      <path d="M18.5 5.5L15 9" />
      <path d="M9 15l-3.5 3.5" />
    </svg>
  );
}

function TrustIcon({ type }: { type: "shield" | "lock" | "chat" }) {
  if (type === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 118 0v3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 18l-1 4 4-2h9a5 5 0 005-5V9a5 5 0 00-5-5H7a5 5 0 00-5 5v4a5 5 0 003 5z" />
    </svg>
  );
}

function TrustItem({
  type,
  title,
  text,
}: {
  type: "shield" | "lock" | "chat";
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 text-white/88">
      <div className="mt-0.5 text-white/85">
        <TrustIcon type={type} />
      </div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-white/58">{text}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [task, setTask] = useState("");
  const [radiusKm, setRadiusKm] = useState<(typeof radiusOptions)[number]>(10);
  const [searchLat, setSearchLat] = useState<number | null>(null);
  const [searchLng, setSearchLng] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<HelperLocationStatus>("missing");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskHelperResponse | null>(null);
  const [error, setError] = useState("");

  const clearTaskHelperState = () => {
    setResult(null);
    setError("");
  };

  const ensureHelperLocation = async () => {
    if (searchLat !== null && searchLng !== null) {
      if (locationStatus !== "ready") {
        setLocationStatus("ready");
      }

      return { lat: searchLat, lng: searchLng };
    }

    if (locationStatus === "denied" || locationStatus === "unavailable") {
      return null;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unavailable");
      return null;
    }

    setLocationStatus("requesting");

    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setSearchLat(lat);
          setSearchLng(lng);
          setLocationStatus("ready");
          resolve({ lat, lng });
        },
        (geoError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setLocationStatus("denied");
          } else {
            setLocationStatus("error");
          }

          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  };

  const locationHint =
    locationStatus === "requesting"
      ? "Zisťujem polohu pre filtrovanie v okolí..."
      : locationStatus === "denied"
        ? "Filtrovanie v okolí potrebuje povolenú polohu v prehliadači."
        : locationStatus === "unavailable"
          ? "Tento prehliadač nepodporuje polohu pre nearby ponuky."
          : locationStatus === "error"
            ? "Polohu sa teraz nepodarilo získať. Skús to znova pri ďalšom hľadaní."
            : locationStatus === "ready"
              ? "Filtrovanie v okolí je aktívne podľa tvojej polohy."
              : "Filtrovanie v okolí potrebuje prístup k tvojej polohe.";

  const handleSubmit = async () => {
    const trimmed = task.trim();

    if (!trimmed) {
      setError("Napíš, čo hľadáš.");
      setResult(null);
      return;
    }

    setResult(null);

    setLoading(true);
    setError("");

    try {
      const location = await ensureHelperLocation();

      const res = await fetch("/api/task-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: trimmed,
          radius_km: radiusKm,
          search_lat: location?.lat ?? searchLat ?? undefined,
          search_lng: location?.lng ?? searchLng ?? undefined,
        }),
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
    <div className="space-y-6 pb-8 lg:space-y-8">
      <section
        id="pomocnik"
        className="mx-auto max-w-[86rem] scroll-mt-32 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,22,0.98),rgba(15,19,29,0.9))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.3)] sm:p-5 md:p-6"
      >
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-black/55">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
              style={{ backgroundImage: "url('/rentulo-home-hero-desktop-final.png')" }}
            />
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden"
              style={{ backgroundImage: "url('/rentulo-home-hero-mobile-final.png')" }}
            />
            <div className="absolute inset-0 hidden md:block bg-[linear-gradient(90deg,rgba(2,3,7,0.94),rgba(2,3,7,0.74)_56%,rgba(2,3,7,0.24)_78%,transparent)]" />
            <div className="absolute inset-0 md:hidden bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.2)_34%,rgba(0,0,0,0.76)_72%,rgba(0,0,0,0.92))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />
          </div>

          <div className="relative mx-auto grid max-w-[77rem] gap-5 px-4 py-5 sm:px-5 sm:py-6 lg:min-h-[38rem] lg:grid-cols-[0.78fr_minmax(0,1fr)] lg:items-center lg:gap-5 lg:px-6 lg:py-7 xl:max-w-[79rem] xl:gap-6">
            <div className="order-2 max-w-[30rem] px-1 py-1 lg:order-1 lg:px-0 lg:py-0">
              <SectionEyebrow>Pomocník s výberom</SectionEyebrow>
              <h1 className="mt-3 text-[2.45rem] font-semibold leading-[0.96] tracking-tight text-white md:text-[3.35rem] xl:text-[4.2rem]">
                Požičaj si,
                <br />
                čo práve <span className="text-violet-400">potrebuješ.</span>
              </h1>
              <p className="mt-3 max-w-[30rem] text-base leading-7 text-white/72 md:text-lg md:leading-7">
                Napíš prirodzene, čo hľadáš. Rentulo ti ukáže relevantné ponuky v okolí
                a pomôže rýchlo nájsť správnu vec bez zdĺhavého filtrovania.
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  href="/items"
                  className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/88 backdrop-blur-sm transition hover:bg-white/[0.1]"
                >
                  Preskúmať ponuku
                </Link>
                <Link
                  href="#ako-to-funguje"
                  className="inline-flex items-center rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white/68 transition hover:border-white/16 hover:text-white/84"
                >
                  Ako to funguje
                </Link>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:w-full lg:max-w-[43rem] lg:justify-self-end xl:max-w-[44rem]">
              <div className="rounded-[1.65rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-md sm:p-5 md:p-[1.25rem]">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-200/78">
                    Hlavné vyhľadávanie
                  </div>
                  <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                    Nájdi rýchlo vhodné ponuky
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-white/62">
                    Zadaj, čo potrebuješ, nastav okruh a zobrazíme odporúčané ponuky.
                  </p>
                </div>

                <div className="mt-4 space-y-3.5">
                  <textarea
                    className="min-h-[104px] w-full rounded-[1.4rem] border border-white/10 bg-black/30 px-4 py-3.5 text-white outline-none sm:min-h-[120px] md:min-h-[132px]"
                    value={task}
                    onChange={(e) => {
                      clearTaskHelperState();
                      setTask(e.target.value);
                    }}
                    disabled={loading}
                  />

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={loading}
                      className="rentulo-btn-primary w-full px-5 py-3 text-sm shadow-[0_18px_40px_rgba(109,74,246,0.28)] disabled:opacity-50 sm:w-auto"
                    >
                      {loading ? "Hľadám ponuky..." : "Vyhľadať vhodné ponuky"}
                    </button>

                    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1.5">
                      <div className="px-2 text-xs font-medium uppercase tracking-[0.18em] text-white/42">
                        Okruh
                      </div>
                      {radiusOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setRadiusKm(option)}
                          disabled={loading}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            radiusKm === option
                              ? "bg-white text-black"
                              : "bg-white/[0.04] text-white/72 hover:bg-white/[0.08]"
                          }`}
                        >
                          {option} km
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`text-xs ${
                      locationStatus === "ready" ? "text-emerald-200/80" : "text-white/52"
                    }`}
                  >
                    {locationHint}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {exampleTasks.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => {
                          clearTaskHelperState();
                          setTask(example);
                        }}
                        disabled={loading}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/[0.08]"
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                  {error ? (
                    <div className="rounded-[1.25rem] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                      {error}
                    </div>
                  ) : null}

                  {result ? (
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5">
                      <div className="text-sm font-semibold text-white">Odporúčané ponuky</div>
                      <div className="mt-3 space-y-3">
                        {result.suggested_items.length === 0 ? (
                          <div className="text-sm leading-6 text-white/60">
                            {result.search_hint ||
                              "Nenašiel som dosť presné ponuky. Skús napísať konkrétnejšie, čo chceš požičať."}
                          </div>
                        ) : (
                          result.suggested_items.map((item) => (
                            <Link
                              key={item.id}
                              href={`/items/${item.id}`}
                              className="flex items-center gap-3 rounded-[1rem] border border-white/10 bg-black/25 p-3 transition hover:bg-white/[0.06]"
                            >
                              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[0.9rem] border border-white/10 bg-white/[0.04]">
                                {item.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.18em] text-white/35">
                                    Bez fotky
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">{item.title}</div>
                                <div className="mt-1 text-xs text-white/60">
                                  {item.price_per_day !== null ? `${item.price_per_day} € / deň` : "Cena neuvedená"}
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                  {item.city || "Mesto neuvedené"}
                                  {item.category ? ` · ${item.category}` : ""}
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categoryTiles.map((tile) => (
          <Link
            key={tile.title}
            href={tile.href}
            className="group relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.32)] transition hover:-translate-y-1.5 hover:border-white/20"
          >
            <div className="relative aspect-[3/4]">
              <Image
                src={tile.image}
                alt={tile.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                className="object-cover transition duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.52),rgba(0,0,0,0.12)_30%,rgba(0,0,0,0.46)_100%)]" />

              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div>
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm ${
                      tile.key === "tools"
                        ? "border-violet-400/20 bg-violet-500/12 text-violet-300"
                        : tile.key === "sport"
                          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
                          : tile.key === "baby"
                            ? "border-amber-400/20 bg-amber-500/12 text-amber-300"
                            : "border-fuchsia-400/20 bg-fuchsia-500/12 text-fuchsia-300"
                    }`}
                  >
                    <CategoryIcon name={tile.key} />
                  </div>
                  <h2 className="mt-4 text-[2rem] font-semibold tracking-tight text-white">
                    {tile.title}
                  </h2>
                  <p className="mt-3 max-w-[16rem] text-base leading-7 text-white/80">
                    {tile.description}
                  </p>
                </div>

                <div>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.12] px-5 py-3 text-base font-medium text-white backdrop-blur-md transition group-hover:bg-white/[0.16]">
                    Preskúmať
                    <svg viewBox="0 0 20 20" className="ml-3 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 4l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="hidden overflow-hidden rounded-[2.25rem] border border-white/10 bg-black shadow-[0_36px_120px_rgba(0,0,0,0.42)] md:block">
          <div className="relative aspect-[1831/720] xl:aspect-[1831/650]">
            <Image
              src="/rentulo-home-hero-desktop-final.png"
              alt="Rentulo hero s mobilnou aplikáciou a vybavením na prenájom"
              fill
              sizes="(max-width: 1536px) 100vw, 1536px"
              className="object-cover"
            />
            <div className="absolute inset-y-0 left-0 w-[48%] bg-[linear-gradient(90deg,rgba(2,3,7,0.9),rgba(2,3,7,0.68)_64%,transparent)]" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/25 to-transparent" />

            <div className="absolute left-[4.8%] top-[11%] max-w-[34%]">
              <SectionEyebrow>Požičiaj, ušetri, zaži viac</SectionEyebrow>
              <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-tight text-white xl:text-[4.5rem]">
                Prenájom od ľudí
                <br />
                vo vašom okolí.
              </h2>
              <p className="mt-5 max-w-[34rem] text-base leading-7 text-white/72 xl:text-lg xl:leading-8">
                Náradie, šport, detská výbavička aj vybavenie na eventy.
                Jednoducho, bezpečne a bez zbytočných nákupov.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_28px_100px_rgba(0,0,0,0.38)] md:hidden">
          <div className="relative aspect-[1477/980]">
            <Image
              src="/rentulo-home-hero-mobile-final.png"
              alt="Rentulo mobilný hero s aplikáciou a vybavením na prenájom"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18)_35%,rgba(0,0,0,0.78)_72%,rgba(0,0,0,0.92))]" />

            <div className="absolute inset-x-0 bottom-0 p-5">
              <SectionEyebrow>Požičiaj, ušetri, zaži viac</SectionEyebrow>
              <h2 className="mt-4 text-[2.1rem] font-semibold leading-[0.98] tracking-tight text-white">
                Prenájom od ľudí
                <br />
                vo vašom okolí.
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/74">
                Náradie, šport, detská výbavička aj vybavenie na eventy. Jednoducho a bezpečne.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)] md:px-6 md:py-5">
          <div className="grid gap-4 md:grid-cols-3 md:gap-6 xl:gap-10">
            <TrustItem
              type="shield"
              title="Overení používatelia"
              text="Každý profil je preverovaný"
            />
            <TrustItem
              type="lock"
              title="Bezpečné platby"
              text="Peniaze sú rezervované"
            />
            <TrustItem
              type="chat"
              title="Podpora"
              text="Sme tu, keď treba"
            />
          </div>
        </div>
      </section>

      <section
        id="ako-to-funguje"
        className="scroll-mt-32 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] md:p-8"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <SectionEyebrow>Ako funguje Rentulo</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Prenájom vedený cez dôveru, rezerváciu a jasné kroky
            </h2>
            <p className="mt-4 leading-7 text-white/70">
              Vyberieš si vec, rezervuješ termín a celý priebeh ostáva na jednom
              mieste. Profil, platba, prevzatie aj podpora pri probléme sa nestrácajú
              mimo platformy.
            </p>
          </div>

          <Link href="/items/new" className="rentulo-btn-secondary bg-white/[0.04] px-5 py-3 text-sm">
            Pridať ponuku
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">01</div>
            <div className="mt-3 text-lg font-semibold text-white">Vyberieš si ponuku</div>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Objavíš vec podľa kategórie, mesta alebo konkrétnej potreby.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">02</div>
            <div className="mt-3 text-lg font-semibold text-white">Rezervuješ termín</div>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Stav rezervácie a platby sleduješ priamo v rovnakom priebehu.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">03</div>
            <div className="mt-3 text-lg font-semibold text-white">Prevezmeš a vrátiš</div>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Fotky, komunikácia a dôkazy ostávajú pri konkrétnej dohode.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
