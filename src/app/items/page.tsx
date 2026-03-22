"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  postal_code?: string | null;
  category?: string | null;
  is_active?: boolean;
  distance_km?: number | null;
};

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    city?: string;
    postcode?: string;
    lat?: number;
    lon?: number;
  };
};

const CATEGORIES = [
  "Všetky kategórie",
  "Náradie",
  "Záhrada",
  "Stavebné stroje",
  "Auto-moto",
  "Elektronika",
  "Dom a dielňa",
  "Šport a voľný čas",
  "Ostatné",
];

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string[]>>({});
  const [activeImageIndexMap, setActiveImageIndexMap] = useState<Record<number, number>>({});
  const [status, setStatus] = useState("Načítavam...");

  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState("20");
  const [categoryFilter, setCategoryFilter] = useState("Všetky kategórie");

  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<GeoapifyFeature[]>([]);

  const [selectedLabel, setSelectedLabel] = useState("");
  const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";

  const filteredItems = useMemo(() => {
    if (categoryFilter === "Všetky kategórie") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  const loadImages = async (rows: Item[]) => {
    const ids = rows.map((x) => x.id);

    if (ids.length === 0) {
      setImageMap({});
      setActiveImageIndexMap({});
      return;
    }

    const { data: imgs, error: imgErr } = await supabase
      .from("item_images")
      .select("item_id,path")
      .in("item_id", ids)
      .order("id", { ascending: true });

    if (imgErr) {
      setImageMap({});
      setActiveImageIndexMap({});
      return;
    }

    const map: Record<number, string[]> = {};
    const nextActiveMap: Record<number, number> = {};

    for (const im of (imgs ?? []) as any[]) {
      if (!map[im.item_id]) {
        map[im.item_id] = [];
        nextActiveMap[im.item_id] = 0;
      }

      const { data: pub } = supabase.storage.from("item-images").getPublicUrl(im.path);
      map[im.item_id].push(pub.publicUrl);
    }

    setImageMap(map);
    setActiveImageIndexMap((prev) => {
      const merged = { ...nextActiveMap };

      for (const row of rows) {
        const currentIndex = prev[row.id] ?? 0;
        const count = map[row.id]?.length ?? 0;
        merged[row.id] = count > 0 ? Math.min(currentIndex, count - 1) : 0;
      }

      return merged;
    });
  };

  const loadDefaultItems = async () => {
    setStatus("Načítavam...");

    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,price_per_day,city,postal_code,category,is_active")
      .eq("is_active", true)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const rows = ((data ?? []) as Item[]).map((x) => ({ ...x, distance_km: null }));
    setItems(rows);
    await loadImages(rows);
    setSelectedLabel("");
    setStatus("");
  };

  const loadNearbyItems = async (lat: number, lng: number, label: string) => {
    setStatus("Hľadám ponuky v okolí...");

    const { data, error } = await supabase.rpc("search_items_near", {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radiusKm),
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const rows = (data ?? []) as Item[];
    setItems(rows);
    await loadImages(rows);
    setSelectedLabel(label);
    setStatus("");
  };

  useEffect(() => {
    loadDefaultItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();

    if (!geoKey || q.length < 2) {
      setLocationResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingLocation(true);

        const url =
          `https://api.geoapify.com/v1/geocode/autocomplete` +
          `?text=${encodeURIComponent(q)}` +
          `&lang=sk` +
          `&limit=5` +
          `&filter=countrycode:sk` +
          `&apiKey=${geoKey}`;

        const res = await fetch(url);
        const json = await res.json();
        setLocationResults(json?.features ?? []);
      } catch {
        setLocationResults([]);
      } finally {
        setSearchingLocation(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [searchQuery, geoKey]);

  const runSearchFromFeature = async (feature: GeoapifyFeature) => {
    const p = feature.properties ?? {};
    const lat = typeof p.lat === "number" ? p.lat : null;
    const lng = typeof p.lon === "number" ? p.lon : null;
    const label = p.formatted ?? [p.city, p.postcode].filter(Boolean).join(", ");

    if (lat === null || lng === null) {
      setStatus("Chyba: lokalita nemá súradnice.");
      return;
    }

    setSearchQuery(label);
    setLocationResults([]);
    await loadNearbyItems(lat, lng, label);
  };

  const searchByTypedLocation = async () => {
    if (locationResults.length === 0) {
      setStatus("Najprv vyber lokalitu zo zoznamu návrhov.");
      return;
    }

    await runSearchFromFeature(locationResults[0]);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      setStatus("Tento prehliadač nepodporuje geolokáciu.");
      return;
    }

    setStatus("Zisťujem tvoju polohu...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationResults([]);
        await loadNearbyItems(lat, lng, "moja poloha");
      },
      () => {
        setStatus("Nepodarilo sa získať tvoju polohu.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const resetSearch = async () => {
    setSearchQuery("");
    setLocationResults([]);
    setCategoryFilter("Všetky kategórie");
    await loadDefaultItems();
  };

  const setItemImageIndex = (itemId: number, nextIndex: number) => {
    setActiveImageIndexMap((prev) => ({
      ...prev,
      [itemId]: nextIndex,
    }));
  };

  const showPrevImage = (itemId: number) => {
    const images = imageMap[itemId] ?? [];
    if (images.length <= 1) return;

    const current = activeImageIndexMap[itemId] ?? 0;
    const next = current === 0 ? images.length - 1 : current - 1;
    setItemImageIndex(itemId, next);
  };

  const showNextImage = (itemId: number) => {
    const images = imageMap[itemId] ?? [];
    if (images.length <= 1) return;

    const current = activeImageIndexMap[itemId] ?? 0;
    const next = current === images.length - 1 ? 0 : current + 1;
    setItemImageIndex(itemId, next);
  };

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo marketplace
            </div>

            <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Ponuky</h1>

            <p className="mt-2 leading-7 text-white/70">
              Hľadaj podľa mesta, PSČ, kategórie alebo podľa svojej aktuálnej polohy.
            </p>
          </div>

          <Link className="rentulo-btn-primary px-4 py-2.5 text-sm" href="/items/new">
            Pridať ponuku
          </Link>
        </div>
      </section>

      <section className="rentulo-card p-5 md:p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Vyhľadávanie podľa lokality</h2>
          <p className="text-sm leading-6 text-white/60">
            Napíš mesto alebo PSČ, vyber lokalitu z návrhov a potom spusti hľadanie.
          </p>
        </div>

        <div className="mt-5 grid items-start gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-2 text-sm text-white/75">Mesto alebo PSČ</div>

            <input
              className="rentulo-input-light h-12 px-3 placeholder:text-black/50"
              placeholder="napr. Trnava alebo 91701"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {searchingLocation ? (
              <div className="mt-2 text-sm text-white/60">Hľadám lokality...</div>
            ) : null}

            {locationResults.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                {locationResults.map((f, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => runSearchFromFeature(f)}
                    className="block w-full border-b border-white/10 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/10 last:border-b-0"
                  >
                    {f.properties?.formatted ?? "Neznáma lokalita"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="mb-2 text-sm text-white/75">Okruh</div>

            <select
              className="rentulo-input-light h-12 px-3"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            >
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="15">15 km</option>
              <option value="20">20 km</option>
              <option value="50">50 km</option>
            </select>
          </div>

          <div>
            <div className="mb-2 text-sm text-white/75">Kategória</div>

            <select
              className="rentulo-input-light h-12 px-3"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-sm text-white/75">Akcie</div>

            <div className="grid gap-2">
              <button
                className="rentulo-btn-primary h-12 px-4 text-sm"
                type="button"
                onClick={searchByTypedLocation}
              >
                Hľadať podľa lokality
              </button>

              <button
                className="rentulo-btn-secondary h-12 px-4 text-sm"
                type="button"
                onClick={useMyLocation}
              >
                V mojej blízkosti
              </button>

              <button
                className="rentulo-btn-secondary h-12 px-4 text-sm"
                type="button"
                onClick={resetSearch}
              >
                Zrušiť filter
              </button>
            </div>
          </div>
        </div>

        {selectedLabel ? (
          <div className="mt-5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-sm text-white/80">
            Aktuálne hľadanie: <strong className="text-white">{selectedLabel}</strong> v okruhu{" "}
            <strong className="text-white">{radiusKm} km</strong>
            {categoryFilter !== "Všetky kategórie" ? (
              <>
                {" "}
                · kategória <strong className="text-white">{categoryFilter}</strong>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      {filteredItems.length === 0 && !status ? (
        <div className="rentulo-card p-8 text-center text-white/60">
          Nenašli sa žiadne ponuky.
        </div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => {
          const images = imageMap[item.id] ?? [];
          const activeIndex = activeImageIndexMap[item.id] ?? 0;
          const activeImage = images[activeIndex] ?? null;

          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-indigo-400/40 hover:bg-white/[0.07]"
            >
              <div className="relative">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={item.title}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-52 w-full items-center justify-center bg-black/20 text-sm text-white/40">
                    Bez fotky
                  </div>
                )}

                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => showPrevImage(item.id)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white hover:bg-black/70"
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      onClick={() => showNextImage(item.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 px-3 py-2 text-sm text-white hover:bg-black/70"
                    >
                      →
                    </button>

                    <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                      {activeIndex + 1}/{images.length}
                    </div>
                  </>
                ) : null}
              </div>

              {images.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-black/20 px-3 py-3">
                  {images.map((imageUrl, index) => (
                    <button
                      key={imageUrl}
                      type="button"
                      onClick={() => setItemImageIndex(item.id, index)}
                      className={`shrink-0 overflow-hidden rounded-lg border ${
                        activeIndex === index ? "border-indigo-400" : "border-white/10"
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={`${item.title} ${index + 1}`}
                        className="h-14 w-20 object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.category ? (
                    <div className="inline-flex rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                      {item.category}
                    </div>
                  ) : null}

                  {item.distance_km !== null && item.distance_km !== undefined ? (
                    <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                      {item.distance_km} km
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="text-lg font-semibold">{item.title}</div>

                  <div className="mt-1 text-sm text-white/60">
                    {item.city ? <span>{item.city}</span> : null}
                    {item.city && item.postal_code ? <span> · </span> : null}
                    {item.postal_code ? <span>{item.postal_code}</span> : null}
                  </div>
                </div>

                <div className="text-base font-medium text-white">
                  {item.price_per_day} €
                  <span className="ml-1 text-sm font-normal text-white/60">/ deň</span>
                </div>

                {item.description ? (
                  <div className="line-clamp-3 text-sm leading-6 text-white/70">
                    {item.description}
                  </div>
                ) : (
                  <div className="text-sm text-white/45">Bez popisu</div>
                )}

                <Link
                  href={`/items/${item.id}`}
                  className="inline-flex pt-1 text-sm font-medium text-indigo-300 hover:text-indigo-200"
                >
                  Otvoriť detail →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}