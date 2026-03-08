"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Badge, KpiCard, Notice, Pagination, Section, SelectField, TextField } from "@/components/owner/OwnerUI";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  is_active: boolean;
};

const PAGE_SIZE = 12;

export default function OwnerItemsPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam…");

  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(0);

  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);

  const [page, setPage] = useState(1);

  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const totalOwned = useMemo(() => activeCount + inactiveCount, [activeCount, inactiveCount]);

  const loadCounts = async (userId: string) => {
    const countItems = async (isActive: boolean) => {
      const { count, error } = await supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("is_active", isActive);

      if (error) throw new Error(error.message);
      return count ?? 0;
    };

    const [a, i] = await Promise.all([countItems(true), countItems(false)]);
    setActiveCount(a);
    setInactiveCount(i);
  };

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let req = supabase
      .from("items")
      .select("id,title,description,price_per_day,city,is_active", { count: "exact" })
      .eq("owner_id", userId);

    if (stateFilter === "active") req = req.eq("is_active", true);
    if (stateFilter === "inactive") req = req.eq("is_active", false);

    const queryText = q.trim();
    if (queryText) req = req.ilike("title", `%${queryText}%`);

    const cityText = city.trim();
    if (cityText) req = req.ilike("city", `%${cityText}%`);

    if (sort === "newest") req = req.order("id", { ascending: false });
    if (sort === "oldest") req = req.order("id", { ascending: true });
    if (sort === "price_asc") req = req.order("price_per_day", { ascending: true });
    if (sort === "price_desc") req = req.order("price_per_day", { ascending: false });

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const rows = (data ?? []) as Item[];
    setItems(rows);
    setTotal(count ?? 0);

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
        map[im.item_id] =
          supabase.storage.from("item-images").getPublicUrl(im.path).data.publicUrl;
      }
    }

    setImageMap(map);
    setStatus("");

    // counts refresh (after any list load)
    await loadCounts(userId);
  };

  useEffect(() => {
    setStatus("Načítavam…");
    load().catch((e: any) => setStatus("Chyba: " + (e?.message ?? "neznáma chyba")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, city, stateFilter, sort]);

  const toggleActive = async (id: number, next: boolean) => {
    setStatus("Ukladám…");
    const { error } = await supabase.from("items").update({ is_active: next }).eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  const clear = () => {
    setQ("");
    setCity("");
    setStateFilter("all");
    setSort("newest");
    setPage(1);
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Moje ponuky</h2>
          <p className="mt-1 text-white/60">
            Zapínaš/vypínaš viditeľnosť ponúk a preklikávaš sa na detail alebo rezervácie.
          </p>
        </div>

        <Link className="rounded-xl bg-white px-4 py-2 font-medium text-black hover:bg-white/90" href="/items/new">
          Pridať novú ponuku
        </Link>
      </div>

      {status ? <Notice text={status} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Aktívne" value={activeCount} hint="Viditeľné pre zákazníkov" />
        <KpiCard title="Vypnuté" value={inactiveCount} hint="Skryté (neobjavia sa v ponukách)" />
        <KpiCard title="Spolu" value={totalOwned} hint="Celkový počet tvojich ponúk" />
      </div>

      <Section
        title="Vyhľadávanie a filtre"
        subtitle="Rýchlo nájdi ponuku podľa názvu, mesta alebo stavu."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <TextField
            id="q"
            label="Názov ponuky"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Napíš názov (napr. Stan)"
          />

          <TextField
            id="city"
            label="Mesto"
            value={city}
            onChange={(v) => {
              setCity(v);
              setPage(1);
            }}
            placeholder="Napíš mesto (napr. Trnava)"
          />

          <SelectField
            id="state"
            label="Stav"
            value={stateFilter}
            onChange={(v) => {
              setStateFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Všetky" },
              { value: "active", label: "Aktívne" },
              { value: "inactive", label: "Vypnuté" },
            ]}
          />

          <SelectField
            id="sort"
            label="Triedenie"
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={[
              { value: "newest", label: "Najnovšie" },
              { value: "oldest", label: "Najstaršie" },
              { value: "price_asc", label: "Cena ↑" },
              { value: "price_desc", label: "Cena ↓" },
            ]}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10" onClick={clear}>
            Vymazať filtre
          </button>

          <button type="button" className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10" onClick={() => load()}>
            Obnoviť
          </button>
        </div>
      </Section>

      <Section
        title="Zoznam ponúk"
        subtitle={`Zobrazené: ${items.length} z ${total}`}
      >
        {items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne ponuky podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex gap-4">
                  {imageMap[item.id] ? (
                    <img
                      src={imageMap[item.id]}
                      alt={item.title}
                      className="h-20 w-28 rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="h-20 w-28 rounded-xl border border-white/10 bg-white/5" />
                  )}

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-semibold">{item.title}</div>
                        <div className="mt-1 text-sm text-white/70">
                          {item.price_per_day} € <span className="text-white/50">/ deň</span>
                          {item.city ? <span className="text-white/50"> · {item.city}</span> : null}
                        </div>
                      </div>

                      {item.is_active ? (
                        <Badge tone="success">Aktívna</Badge>
                      ) : (
                        <Badge tone="danger">Vypnutá</Badge>
                      )}
                    </div>

                    {item.description ? (
                      <div className="mt-2 line-clamp-2 text-sm text-white/70">{item.description}</div>
                    ) : (
                      <div className="mt-2 text-sm text-white/50">Bez popisu</div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/items/${item.id}`}
                        className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                      >
                        Detail
                      </Link>

                      <Link
                        href={`/owner/reservations?item_id=${item.id}`}
                        className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                      >
                        Rezervácie
                      </Link>

                      {item.is_active ? (
                        <button
                          type="button"
                          className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                          onClick={() => toggleActive(item.id, false)}
                        >
                          Vypnúť
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                          onClick={() => toggleActive(item.id, true)}
                        >
                          Zapnúť
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      </Section>
    </main>
  );
}
