"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Item = {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  is_active: boolean;
};

export default function OwnerItemsPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("Načítavam...");

  const [q, setQ] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    let out = [...items];

    const qText = q.trim().toLowerCase();
    if (qText) {
      out = out.filter((i) => i.title.toLowerCase().includes(qText));
    }

    const cityText = cityFilter.trim().toLowerCase();
    if (cityText) {
      out = out.filter((i) => (i.city ?? "").toLowerCase().includes(cityText));
    }

    if (stateFilter === "active") {
      out = out.filter((i) => i.is_active);
    }

    if (stateFilter === "inactive") {
      out = out.filter((i) => !i.is_active);
    }

    return out;
  }, [items, q, cityFilter, stateFilter]);

  const activeCount = useMemo(() => items.filter((i) => i.is_active).length, [items]);
  const inactiveCount = useMemo(() => items.filter((i) => !i.is_active).length, [items]);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select("id,owner_id,title,description,price_per_day,city,is_active")
      .eq("owner_id", userId)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const rows = (data ?? []) as Item[];
    setItems(rows);

    const ids = rows.map((x) => x.id);
    if (ids.length === 0) {
      setImageMap({});
      setStatus("");
      return;
    }

    const { data: imgs } = await supabase
      .from("item_images")
      .select("item_id,path")
      .in("item_id", ids)
      .order("id", { ascending: true });

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (id: number, nextValue: boolean) => {
    setStatus("Ukladám...");

    const { error } = await supabase
      .from("items")
      .update({ is_active: nextValue })
      .eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Moje ponuky</h1>
            <p className="mt-1 text-white/60">
              Správa vlastných ponúk, ich viditeľnosti a rezervácií.
            </p>
          </div>

          <Link
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            href="/items/new"
          >
            Pridať novú ponuku
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Aktívne</div>
          <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
          <div className="mt-1 text-sm text-white/50">Viditeľné pre zákazníkov</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Vypnuté</div>
          <div className="mt-2 text-3xl font-semibold">{inactiveCount}</div>
          <div className="mt-1 text-sm text-white/50">Skryté z ponúk</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Spolu</div>
          <div className="mt-2 text-3xl font-semibold">{items.length}</div>
          <div className="mt-1 text-sm text-white/50">Všetky tvoje ponuky</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold">Filtrovanie</h2>
        <p className="mt-1 text-sm text-white/60">
          Vyhľadaj ponuku podľa názvu, mesta alebo stavu.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm text-white/70">Názov</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              placeholder="napr. Hilti"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-sm text-white/70">Mesto</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              placeholder="napr. Trnava"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-sm text-white/70">Stav</div>
            <select
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">Všetky</option>
              <option value="active">Aktívne</option>
              <option value="inactive">Vypnuté</option>
            </select>
          </div>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
          Žiadne ponuky podľa aktuálnych filtrov.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {imageMap[item.id] ? (
                <img
                  src={imageMap[item.id]}
                  alt={item.title}
                  className="mb-3 h-44 w-full rounded-xl border border-white/10 object-cover"
                />
              ) : (
                <div className="mb-3 h-44 w-full rounded-xl border border-white/10 bg-white/5" />
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{item.title}</div>
                  <div className="mt-1 text-white/80">
                    {item.price_per_day} € <span className="text-white/60">/ deň</span>
                    {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    item.is_active
                      ? "bg-green-600/90 text-white"
                      : "bg-red-600/90 text-white"
                  }`}
                >
                  {item.is_active ? "Aktívna" : "Vypnutá"}
                </span>
              </div>

              {item.description ? (
                <div className="mt-3 line-clamp-2 text-white/70">{item.description}</div>
              ) : (
                <div className="mt-3 text-white/50">Bez popisu</div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/items/${item.id}`}
                  className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                >
                  Detail
                </Link>

                <Link
                  href={`/owner/reservations?item_id=${item.id}`}
                  className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                >
                  Rezervácie
                </Link>

                {item.is_active ? (
                  <button
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    onClick={() => toggleActive(item.id, false)}
                    type="button"
                  >
                    Vypnúť
                  </button>
                ) : (
                  <button
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    onClick={() => toggleActive(item.id, true)}
                    type="button"
                  >
                    Zapnúť
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}