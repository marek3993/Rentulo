"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminApiFetch } from "@/lib/adminApiClient";
import { supabase } from "@/lib/supabaseClient";

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
  const [status, setStatus] = useState("Nacitavam...");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeCount = useMemo(() => rows.filter((row) => row.is_active).length, [rows]);
  const inactiveCount = useMemo(() => rows.filter((row) => !row.is_active).length, [rows]);

  const load = async (nextPage = page, nextQuery = query.trim()) => {
    setStatus("Nacitavam...");

    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user.id;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (meError) {
      setStatus("Chyba: " + meError.message);
      return;
    }

    if (!me || me.role !== "admin") {
      router.replace("/");
      return;
    }

    let request = supabase
      .from("items")
      .select("id,title,price_per_day,city,owner_id,is_active", { count: "exact" });

    if (activeFilter === "active") {
      request = request.eq("is_active", true);
    } else if (activeFilter === "inactive") {
      request = request.eq("is_active", false);
    }

    if (nextQuery) {
      request = request.or(
        `title.ilike.%${nextQuery}%,city.ilike.%${nextQuery}%,owner_id.ilike.%${nextQuery}%`
      );
    }

    request = request.order("id", { ascending: sort === "oldest" });

    const from = (nextPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await request.range(from, to);

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
    const timeout = setTimeout(() => {
      setPage(1);
      load(1, query.trim());
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setVisibility = async (itemId: number, isActive: boolean) => {
    setUpdatingId(itemId);
    setStatus(isActive ? "Obnovujem zobrazovanie..." : "Skryvam inzerat...");

    try {
      await adminApiFetch(`/api/admin/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "set_visibility",
          isActive,
        }),
      });

      setStatus(isActive ? "Inzerat je znovu viditelny." : "Inzerat je skryty z vysledkov.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zmena viditelnosti zlyhala.";
      setStatus("Chyba: " + message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo administracia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Sprava inzeratov</h1>

            <p className="mt-2 leading-7 text-white/70">
              Edit, skrytie a obnovovanie ponuk. Skryty inzerat zostava mimo public vysledkov.
            </p>
          </div>

          <Link href="/admin" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
            Spat do administracie
          </Link>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Zobrazene</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Verejne</div>
          <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Skryte</div>
          <div className="mt-2 text-3xl font-semibold">{inactiveCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Vyhladavanie a filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Hladaj podla nazvu, mesta alebo owner ID.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="admin-items-search" className="block text-sm text-white/70">
              Hladat
            </label>
            <input
              id="admin-items-search"
              className="rentulo-input-dark mt-2 px-3 py-2 placeholder:text-white/40"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nazov, mesto alebo owner ID"
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
              onChange={(event) => {
                setActiveFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Vsetky</option>
              <option value="active">Len verejne</option>
              <option value="inactive">Len skryte</option>
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
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Najnovsie</option>
              <option value="oldest">Najstarsie</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Zoznam inzeratov</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazene: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Ziadne inzeraty pre zvolene filtre.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((item) => {
              const isBusy = updatingId === item.id;

              return (
                <li key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Inzerat</span>
                        <strong className="text-base">#{item.id}</strong>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.is_active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {item.is_active ? "Verejny" : "Skryty"}
                        </span>
                      </div>

                      <div className="text-white/90">
                        <strong>{item.title}</strong>
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Mesto:</span> {item.city || "-"}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Cena:</span> {item.price_per_day} EUR / den
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Owner:</span> {shortUserId(item.owner_id)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/items/${item.id}`}
                        className="rentulo-btn-secondary px-4 py-2 text-sm"
                      >
                        Admin edit
                      </Link>

                      {item.is_active ? (
                        <button
                          type="button"
                          className="rentulo-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => setVisibility(item.id, false)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Pozastavit"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rentulo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => setVisibility(item.id, true)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Zapnut"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
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
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                ← Predchadzajuca
              </button>

              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Dalsia →
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
