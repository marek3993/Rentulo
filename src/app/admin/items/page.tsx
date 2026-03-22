"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ItemRow = {
  id: number;
  title: string;
  price_per_day: number;
  city: string | null;
  owner_id: string;
  is_active: boolean;
};

const PAGE_SIZE = 12;

function shortUserId(value: string) {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function AdminItemsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<ItemRow[]>([]);
  const [status, setStatus] = useState("Načítavam...");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeCount = useMemo(() => rows.filter((x) => x.is_active).length, [rows]);
  const inactiveCount = useMemo(() => rows.filter((x) => !x.is_active).length, [rows]);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data: prof, error: profError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profError) {
      setStatus("Chyba: " + profError.message);
      return;
    }

    if (prof?.role !== "admin") {
      router.replace("/");
      return;
    }

    let req = supabase
      .from("items")
      .select("id,title,price_per_day,city,owner_id,is_active", { count: "exact" });

    if (activeFilter === "active") {
      req = req.eq("is_active", true);
    } else if (activeFilter === "inactive") {
      req = req.eq("is_active", false);
    }

    const trimmed = query.trim();
    if (trimmed) {
      req = req.or(
        `title.ilike.%${trimmed}%,city.ilike.%${trimmed}%,owner_id.ilike.%${trimmed}%`
      );
    }

    req = req.order(sort === "oldest" ? "id" : "id", {
      ascending: sort === "oldest",
    });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as ItemRow[]);
    setTotal(count ?? 0);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeFilter, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleActive = async (id: number, next: boolean) => {
    setUpdatingId(id);
    setStatus("Ukladám zmenu...");

    const { error } = await supabase.from("items").update({ is_active: next }).eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      setUpdatingId(null);
      return;
    }

    setStatus(next ? "Inzerát bol zapnutý ✅" : "Inzerát bol vypnutý ✅");
    await load();
    setUpdatingId(null);
  };

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo administrácia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Správa inzerátov</h1>

            <p className="mt-2 leading-7 text-white/70">
              Prehľad všetkých ponúk. Tu vieš rýchlo zapínať a vypínať inzeráty.
            </p>
          </div>

          <Link
            href="/admin"
            className="rentulo-btn-secondary px-4 py-2.5 text-sm"
          >
            Späť do administrácie
          </Link>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Zobrazené</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Aktívne</div>
          <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Vypnuté</div>
          <div className="mt-2 text-3xl font-semibold">{inactiveCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Vyhľadávanie a filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Hľadaj podľa názvu, mesta alebo owner ID.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="admin-items-search" className="block text-sm text-white/70">
              Hľadať
            </label>
            <input
              id="admin-items-search"
              className="rentulo-input-dark mt-2 px-3 py-2 placeholder:text-white/40"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Názov, mesto alebo owner ID"
            />
          </div>

          <div>
            <label htmlFor="admin-items-filter" className="block text-sm text-white/70">
              Stav
            </label>
            <select
              id="admin-items-filter"
              className="rentulo-input-dark mt-2 px-3 py-2"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Všetky</option>
              <option value="active">Len aktívne</option>
              <option value="inactive">Len vypnuté</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-items-sort" className="block text-sm text-white/70">
              Triedenie
            </label>
            <select
              id="admin-items-sort"
              className="rentulo-input-dark mt-2 px-3 py-2"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Najnovšie</option>
              <option value="oldest">Najstaršie</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Zoznam inzerátov</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazené: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne inzeráty podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((it) => (
              <li key={it.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white/50">Inzerát</span>
                      <strong className="text-base">#{it.id}</strong>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          it.is_active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {it.is_active ? "Aktívny" : "Vypnutý"}
                      </span>
                    </div>

                    <div className="text-white/90">
                      <strong>{it.title}</strong>
                    </div>

                    <div className="text-white/75">
                      <span className="text-white/50">Mesto:</span> {it.city || "-"}
                    </div>

                    <div className="text-white/75">
                      <span className="text-white/50">Cena:</span> {it.price_per_day} €/deň
                    </div>

                    <div className="text-white/75">
                      <span className="text-white/50">Owner:</span> {shortUserId(it.owner_id)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/items/${it.id}`}
                      className="rentulo-btn-secondary px-4 py-2 text-sm"
                    >
                      Detail
                    </Link>

                    <button
                      className="rentulo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                      onClick={() => toggleActive(it.id, true)}
                      disabled={it.is_active || updatingId === it.id}
                      type="button"
                    >
                      {updatingId === it.id ? "Ukladám..." : "Zapnúť"}
                    </button>

                    <button
                      className="rentulo-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                      onClick={() => toggleActive(it.id, false)}
                      disabled={!it.is_active || updatingId === it.id}
                      type="button"
                    >
                      {updatingId === it.id ? "Ukladám..." : "Vypnúť"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/60">
              Strana <strong className="text-white">{page}</strong> z{" "}
              <strong className="text-white">{totalPages}</strong> · Spolu{" "}
              <strong className="text-white">{total}</strong>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Predchádzajúca
              </button>

              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Ďalšia →
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}