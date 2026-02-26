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
  is_active?: boolean;
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("Načítavam...");

  const [cityFilter, setCityFilter] = useState("");

  const filtered = useMemo(() => {
    const q = cityFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => (i.city ?? "").toLowerCase().includes(q));
  }, [items, cityFilter]);

  useEffect(() => {
    const run = async () => {
      setStatus("Načítavam...");

      // items
      const { data, error } = await supabase
        .from("items")
        .select("id,title,description,price_per_day,city,is_active")
        .eq("is_active", true)
        .order("id", { ascending: false });

      if (error) {
        setStatus("Chyba: " + error.message);
        return;
      }

      const rows = (data ?? []) as Item[];
      setItems(rows);

      // images: fetch first image per item
      const ids = rows.map((x) => x.id);
      if (ids.length === 0) {
        setImageMap({});
        setStatus("");
        return;
      }

      const { data: imgs, error: imgErr } = await supabase
        .from("item_images")
        .select("item_id,path")
        .in("item_id", ids)
        .order("id", { ascending: true });

      if (imgErr) {
        // nezabije stránku, len nebude fotka
        setImageMap({});
        setStatus("");
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

      setStatus("");
    };

    run();
  }, []);

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ponuky</h1>

        <div className="flex flex-wrap gap-2">
          <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/items/new">
            Pridať ponuku
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Filtrovanie</div>
          <input
            className="mt-2 w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
            placeholder="Mesto (napr. Trnava)"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
        </div>

        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Tip</div>
          <div className="mt-2 text-white/80">
            Klikni na ponuku → detail → rezervácia. Fotky sa zobrazia ako náhľady.
          </div>
        </div>
      </div>

      {status ? <p className="mt-6">{status}</p> : null}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {filtered.map((item) => (
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
              </div>

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