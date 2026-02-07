"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("Loading items...");

  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const load = async () => {
    setStatus("Loading items...");

    let q = supabase
      .from("items")
      .select("id,title,description,price_per_day,city")
      .eq("is_active", true)
      .order("id", { ascending: false });

    const c = city.trim();
    if (c) {
      // partial, case-insensitive match
      q = q.ilike("city", `%${c}%`);
    }

    const mp = maxPrice.trim();
    if (mp) {
      const n = Number(mp);
      if (!Number.isNaN(n)) {
        q = q.lte("price_per_day", n);
      }
    }

    const { data, error } = await q;

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setItems((data ?? []) as Item[]);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Items</h1>
        <Link className="underline" href="/items/new">
          Add new
        </Link>
      </div>

      <div className="mt-6 grid max-w-xl gap-3">
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="City (e.g., Bratislava)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Max price per day (e.g., 15)"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          inputMode="decimal"
        />

        <div className="flex gap-2">
          <button
            className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
            onClick={load}
            type="button"
          >
            Apply filters
          </button>

          <button
            className="rounded border px-4 py-2 hover:bg-white/10"
            onClick={() => {
              setCity("");
              setMaxPrice("");
              // reload without filters
              setTimeout(load, 0);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      {status ? <p className="mt-6">{status}</p> : null}

      <ul className="mt-6 space-y-4">
        {items.map((it) => (
          <li key={it.id} className="rounded border p-4">
            <div className="flex items-center justify-between gap-3">
              <Link className="underline" href={`/items/${it.id}`}>
                <strong>{it.title}</strong>
              </Link>
              <span>{it.price_per_day} €/day</span>
            </div>

            {it.city ? <div className="opacity-80">{it.city}</div> : null}
            {it.description ? <p className="mt-2">{it.description}</p> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
