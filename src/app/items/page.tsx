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

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,title,description,price_per_day,city")
        .eq("is_active", true)
        .order("id", { ascending: false });

      if (error) {
        setStatus("Error: " + error.message);
        return;
      }

      setItems((data ?? []) as Item[]);
      setStatus("");
    };

    run();
  }, []);

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Items</h1>
        <Link className="underline" href="/items/new">
          Add new
        </Link>
      </div>

      {status ? <p className="mt-4">{status}</p> : null}

      <ul className="mt-6 space-y-4">
        {items.map((it) => (
          <li key={it.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
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
