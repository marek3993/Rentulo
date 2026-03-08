"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  postal_code?: string | null;
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

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("Načítavam...");

  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState("20");

  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<GeoapifyFeature[]>([]);

  const [selectedLabel, setSelectedLabel] = useState("");
  const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";

  const loadImages = async (rows: Item[]) => {
    const ids = rows.map((x) => x.id);
    if (ids.length === 0) {
      setImageMap({});
      return;
    }

    const { data: imgs, error: imgErr } = await supabase
      .from("item_images")
      .select("item_id,path")
      .in("item_id", ids)
      .order("id", { ascending: true });

    if (imgErr) {
      setImageMap({});
      return;
    }

    const map: Record<number, string> = {};
    for (const im of (imgs ?? []) as any[]) {
      if (!map[im.item_id]) {
        const { data: pub } = supabase.storage.from("item-images").getPublicUrl(im.path);
        map[im.item_id] = pub.publicUrl;
      }
    }

    setImageMap(map);
  };

  const loadDefaultItems = async () => {
    setStatus("Načítavam...");

    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,price_per_day,city,postal_code,is_active")
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
    await loadDefaultItems();
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Ponuky</h1>
            <p className="mt-1 text-white/60">
              Hľadaj podľa mesta, PSČ alebo podľa svojej aktuálnej polohy.
            </p>
          </div>

          <Link
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            href="/items/new"
          >
            Pridať ponuku
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Vyhľadávanie podľa lokality</h2>
        <p className="mt-1 text-sm text-white/60">
          Napíš mesto alebo PSČ, vyber lokalitu z návrhov a potom spusti hľadanie.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_1fr_1fr] items-start">
          <div>
            <div className="mb-1 text-sm text-white/70">Mesto alebo PSČ</div>
            <input
              className="h-12 w-full rounded-xl border border-white/20 bg-white px-3 text-black"
              placeholder="napr. Trnava alebo 91701"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {searchingLocation ? (
              <div className="mt-2 text-sm text-white/60">Hľadám lokality...</div>
            ) : null}

            {locationResults.length > 0 ? (
              <div className="mt-2 rounded-xl border border-white/10 overflow-hidden">
                {locationResults.map((f, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => runSearchFromFeature(f)}
                    className="block w-full border-b border-white/10 bg-black/20 px-4 py-3 text-left hover:bg-white/10"
                  >
                    {f.properties?.formatted ?? "Neznáma lokalita"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="mb-1 text-sm text-white/70">Okruh</div>
            <select
              className="h-12 w-full rounded-xl border border-white/20 bg-white px-3 text-black"
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
            <div className="mb-1 text-sm text-white/70">Akcie</div>
            <div className="grid gap-2">
              <button
                className="h-12 rounded-xl bg-white px-4 font-medium text-black hover:bg-white/90"
                type="button"
                onClick={searchByTypedLocation}
              >
                Hľadať podľa lokality
              </button>

              <button
                className="h-12 rounded-xl border border-white/15 px-4 hover:bg-white/10"
                type="button"
                onClick={useMyLocation}
              >
                V mojej blízkosti
              </button>

              <button
                className="h-12 rounded-xl border border-white/15 px-4 hover:bg-white/10"
                type="button"
                onClick={resetSearch}
              >
                Zrušiť filter
              </button>
            </div>
          </div>
        </div>

        {selectedLabel ? (
          <div className="mt-4 text-sm text-white/70">
            Aktuálne hľadanie: <strong className="text-white">{selectedLabel}</strong> v okruhu{" "}
            <strong className="text-white">{radiusKm} km</strong>
          </div>
        ) : null}
      </div>

      {status ? <p>{status}</p> : null}

      {items.length === 0 && !status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
          Nenašli sa žiadne ponuky.
        </div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Link href={`/items/${item.id}`} className="block">
              {imageMap[item.id] ? (
                <img
                  src={imageMap[item.id]}
                  alt={item.title}
                  className="mb-3 h-44 w-full rounded-xl border border-white/10 object-cover"
                />
              ) : (
                <div className="mb-3 h-44 w-full rounded-xl border border-white/10 bg-white/5" />
              )}

              <div className="text-lg font-semibold">{item.title}</div>

              <div className="mt-1 text-white/80">
                {item.price_per_day} € <span className="text-white/60">/ deň</span>
                {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
                {item.postal_code ? <span className="text-white/60"> · {item.postal_code}</span> : null}
              </div>

              {item.distance_km !== null && item.distance_km !== undefined ? (
                <div className="mt-1 text-sm text-white/60">Vzdialenosť: {item.distance_km} km</div>
              ) : null}

              {item.description ? (
                <div className="mt-2 line-clamp-2 text-white/70">{item.description}</div>
              ) : (
                <div className="mt-2 text-white/50">Bez popisu</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}