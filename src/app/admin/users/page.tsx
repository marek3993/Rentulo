"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  role: string;
  created_at: string;
};

const PAGE_SIZE = 12;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function roleBadge(role: string) {
  if (role === "admin") return "bg-green-600/90 text-white";
  return "bg-white/10 text-white";
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  return "Používateľ";
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const adminCount = useMemo(() => rows.filter((r) => r.role === "admin").length, [rows]);
  const userCount = useMemo(() => rows.filter((r) => r.role !== "admin").length, [rows]);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    setActingUserId(userId);

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle();

    if (meError) {
      setStatus("Chyba: " + meError.message);
      return;
    }

    if (!me || me.role !== "admin") {
      setStatus("Nemáš prístup.");
      return;
    }

    let req = supabase
      .from("profiles")
      .select("id,full_name,city,role,created_at", { count: "exact" });

    if (roleFilter !== "all") {
      req = req.eq("role", roleFilter);
    }

    const q = query.trim();
    if (q) {
      req = req.or(`full_name.ilike.%${q}%,city.ilike.%${q}%,id.ilike.%${q}%`);
    }

    req = req.order("created_at", { ascending: sort === "oldest" });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as ProfileRow[]);
    setTotal(count ?? 0);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const changeRole = async (targetUserId: string, nextRole: "user" | "admin") => {
    setUpdatingId(targetUserId);
    setStatus("Ukladám zmenu...");

    try {
      const { error } = await supabase.rpc("set_user_role", {
        target_user_id: targetUserId,
        new_role: nextRole,
      });

      if (error) {
        throw new Error(error.message);
      }

      setStatus("Rola bola uložená ✅");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri zmene roly.";
      setStatus("Chyba: " + message);
      alert(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Správa používateľov</h1>
            <p className="mt-1 text-white/60">
              Tu vieš pasovať používateľa za admina alebo mu admin rolu zobrať.
            </p>
          </div>

          <Link
            href="/admin/items"
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
          >
            Späť do administrácie
          </Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Zobrazené</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Počet na aktuálnej strane</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Admini</div>
          <div className="mt-2 text-3xl font-semibold">{adminCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Používatelia</div>
          <div className="mt-2 text-3xl font-semibold">{userCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Vyhľadávanie a filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Hľadaj podľa mena, mesta alebo user ID.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="admin-users-search" className="block text-sm text-white/70">
              Hľadať
            </label>
            <input
              id="admin-users-search"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white placeholder:text-white/40"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Meno, mesto alebo user ID"
            />
          </div>

          <div>
            <label htmlFor="admin-users-role" className="block text-sm text-white/70">
              Rola
            </label>
            <select
              id="admin-users-role"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Všetky</option>
              <option value="user">Používateľ</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-users-sort" className="block text-sm text-white/70">
              Triedenie
            </label>
            <select
              id="admin-users-sort"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white"
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

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Používatelia</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazené: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadni používatelia podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const isSelf = actingUserId === row.id;
              const isAdmin = row.role === "admin";

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-white/85">
                        <span className="text-white/50">Meno:</span>{" "}
                        <strong>{row.full_name || "Bez mena"}</strong>
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Mesto:</span> {row.city || "-"}
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">User ID:</span> {row.id}
                      </div>

                      <div className="text-sm text-white/50">
                        Vytvorené: {formatDate(row.created_at)}
                      </div>

                      {isSelf ? (
                        <div className="text-sm text-white/60">
                          Toto si ty.
                        </div>
                      ) : null}
                    </div>

                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${roleBadge(row.role)}`}>
                      {roleLabel(row.role)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!isAdmin ? (
                      <button
                        type="button"
                        className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                        onClick={() => changeRole(row.id, "admin")}
                        disabled={updatingId === row.id}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Pasovať za admina"}
                      </button>
                    ) : null}

                    {isAdmin && !isSelf ? (
                      <button
                        type="button"
                        className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                        onClick={() => changeRole(row.id, "user")}
                        disabled={updatingId === row.id}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Zobrať admin rolu"}
                      </button>
                    ) : null}

                    <Link
                      href={`/profile/${row.id}`}
                      className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Verejný profil
                    </Link>
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
                className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Predchádzajúca
              </button>

              <button
                type="button"
                className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
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