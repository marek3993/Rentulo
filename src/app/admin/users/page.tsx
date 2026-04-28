"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminApiFetch } from "@/lib/adminApiClient";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  role: string;
  created_at: string;
  email: string | null;
  admin_state: "active" | "suspended" | "blocked" | "deleted";
  banned_until: string | null;
  deleted_at: string | null;
  total_items: number;
  active_items: number;
};

type UserListResponse = {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 12;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("sk-SK");
}

function roleBadge(role: string) {
  if (role === "admin") return "bg-emerald-500/15 text-emerald-300";
  return "bg-white/10 text-white/75";
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  return "Pouzivatel";
}

function stateBadge(state: UserRow["admin_state"]) {
  if (state === "active") return "bg-emerald-500/15 text-emerald-300";
  if (state === "suspended") return "bg-amber-500/15 text-amber-300";
  if (state === "blocked") return "bg-red-500/15 text-red-300";
  return "bg-white/10 text-white/70";
}

function stateLabel(state: UserRow["admin_state"]) {
  if (state === "active") return "Aktivny";
  if (state === "suspended") return "Pozastaveny";
  if (state === "blocked") return "Blokovany";
  return "Soft deleted";
}

function shortUserId(value: string) {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Nacitavam...");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const adminCount = useMemo(() => rows.filter((row) => row.role === "admin").length, [rows]);
  const activeCount = useMemo(
    () => rows.filter((row) => row.admin_state === "active").length,
    [rows]
  );
  const blockedCount = useMemo(
    () => rows.filter((row) => row.admin_state === "blocked").length,
    [rows]
  );

  const ensureAdminViewer = async () => {
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user.id;

    if (!userId) {
      router.replace("/login");
      return null;
    }

    setActingUserId(userId);

    const { data: me, error } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!me || me.role !== "admin") {
      router.replace("/");
      return null;
    }

    return userId;
  };

  const load = async (nextPage = page, nextQuery = query.trim()) => {
    setStatus("Nacitavam...");

    try {
      const adminId = await ensureAdminViewer();
      if (!adminId) return;

      const searchParams = new URLSearchParams({
        page: String(nextPage),
        q: nextQuery,
        role: roleFilter,
        state: stateFilter,
        sort,
      });

      const response = await adminApiFetch<UserListResponse>(`/api/admin/users?${searchParams}`);
      setRows(response.rows);
      setTotal(response.total);
      setPage(response.page);
      setStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa nacitat pouzivatelov.";
      setStatus("Chyba: " + message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, stateFilter, sort]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      load(1, query.trim());
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const updateRole = async (targetUserId: string, role: "user" | "admin") => {
    setUpdatingId(targetUserId);
    setStatus("Ukladam rolu...");

    try {
      await adminApiFetch(`/api/admin/users/${targetUserId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "set_role",
          role,
        }),
      });

      setStatus("Rola bola ulozena.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zmena roly zlyhala.";
      setStatus("Chyba: " + message);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateState = async (
    targetUserId: string,
    state: "active" | "suspended" | "blocked"
  ) => {
    setUpdatingId(targetUserId);
    setStatus("Ukladam stav pouzivatela...");

    try {
      const result = await adminApiFetch<{ hiddenItems?: number }>(`/api/admin/users/${targetUserId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "set_state",
          state,
        }),
      });

      if (state === "active") {
        setStatus("Pouzivatel bol obnoveny. Inzeraty zostavaju vypnute, kym ich admin znovu nepovoli.");
      } else if ((result.hiddenItems ?? 0) > 0) {
        setStatus(`Pouzivatel bol aktualizovany. Skrytych inzeratov: ${result.hiddenItems}.`);
      } else {
        setStatus("Pouzivatel bol aktualizovany.");
      }

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zmena stavu zlyhala.";
      setStatus("Chyba: " + message);
    } finally {
      setUpdatingId(null);
    }
  };

  const softDeleteUser = async (targetUserId: string) => {
    const confirmed = window.confirm(
      "Soft delete zablokuje pristup do auth a skryje aktivne inzeraty. Pokracovat?"
    );

    if (!confirmed) {
      return;
    }

    setUpdatingId(targetUserId);
    setStatus("Soft deleting user...");

    try {
      const result = await adminApiFetch<{ hiddenItems?: number }>(`/api/admin/users/${targetUserId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "soft_delete",
        }),
      });

      if ((result.hiddenItems ?? 0) > 0) {
        setStatus(`Pouzivatel bol soft deleted. Skrytych inzeratov: ${result.hiddenItems}.`);
      } else {
        setStatus("Pouzivatel bol soft deleted.");
      }

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mazanie zlyhalo.";
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

            <h1 className="mt-4 text-3xl font-semibold">Sprava pouzivatelov</h1>

            <p className="mt-2 leading-7 text-white/70">
              Realna moderacia uctov: suspend, block, role change a pripraveny soft delete.
            </p>
          </div>

          <Link href="/admin" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
            Spat do administracie
          </Link>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Zobrazene</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Admini</div>
          <div className="mt-2 text-3xl font-semibold">{adminCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Aktivni</div>
          <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>

        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Blokovani</div>
          <div className="mt-2 text-3xl font-semibold">{blockedCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Vyhladavanie a filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Hladaj podla mena, mesta, emailu alebo user ID.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label htmlFor="admin-users-search" className="block text-sm text-white/70">
              Hladat
            </label>
            <input
              id="admin-users-search"
              className="rentulo-input-dark mt-2 px-3 py-2 placeholder:text-white/40"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Meno, email, mesto alebo ID"
            />
          </div>

          <div>
            <label htmlFor="admin-users-role" className="block text-sm text-white/70">
              Rola
            </label>
            <select
              id="admin-users-role"
              className="rentulo-input-dark mt-2 px-3 py-2"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Vsetky</option>
              <option value="user">Pouzivatel</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-users-state" className="block text-sm text-white/70">
              Stav
            </label>
            <select
              id="admin-users-state"
              className="rentulo-input-dark mt-2 px-3 py-2"
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Vsetky stavy</option>
              <option value="active">Aktivny</option>
              <option value="suspended">Pozastaveny</option>
              <option value="blocked">Blokovany</option>
              <option value="deleted">Soft deleted</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-users-sort" className="block text-sm text-white/70">
              Triedenie
            </label>
            <select
              id="admin-users-sort"
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
          <h2 className="text-lg font-semibold">Pouzivatelia</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazene: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Ziadni pouzivatelia pre zvolene filtre.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const isSelf = actingUserId === row.id;
              const isAdmin = row.role === "admin";
              const isDeleted = row.admin_state === "deleted";
              const isBusy = updatingId === row.id;

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Pouzivatel</span>
                        <strong className="text-base">{row.full_name || "Bez mena"}</strong>

                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleBadge(row.role)}`}>
                          {roleLabel(row.role)}
                        </span>

                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stateBadge(row.admin_state)}`}>
                          {stateLabel(row.admin_state)}
                        </span>
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Email:</span> {row.email || "-"}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Mesto:</span> {row.city || "-"}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">User ID:</span> {shortUserId(row.id)}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Inzeraty:</span> {row.active_items}/{row.total_items} aktivnych
                      </div>

                      <div className="text-sm text-white/50">
                        Vytvorene: {formatDate(row.created_at)}
                        {row.banned_until ? ` · Ban until: ${formatDate(row.banned_until)}` : ""}
                        {row.deleted_at ? ` · Deleted: ${formatDate(row.deleted_at)}` : ""}
                      </div>

                      {isSelf ? <div className="text-sm text-white/60">Toto si ty.</div> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!isDeleted && !isAdmin ? (
                        <button
                          type="button"
                          className="rentulo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => updateRole(row.id, "admin")}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Povyssit na admina"}
                        </button>
                      ) : null}

                      {!isDeleted && isAdmin && !isSelf ? (
                        <button
                          type="button"
                          className="rentulo-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => updateRole(row.id, "user")}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Zobrat admin rolu"}
                        </button>
                      ) : null}

                      {!isDeleted && row.admin_state !== "suspended" ? (
                        <button
                          type="button"
                          className="rentulo-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => updateState(row.id, "suspended")}
                          disabled={isBusy || isSelf}
                        >
                          {isBusy ? "Ukladam..." : "Pozastavit"}
                        </button>
                      ) : null}

                      {!isDeleted && row.admin_state !== "blocked" ? (
                        <button
                          type="button"
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 disabled:opacity-50"
                          onClick={() => updateState(row.id, "blocked")}
                          disabled={isBusy || isSelf}
                        >
                          {isBusy ? "Ukladam..." : "Zablokovat"}
                        </button>
                      ) : null}

                      {!isDeleted && row.admin_state !== "active" ? (
                        <button
                          type="button"
                          className="rentulo-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => updateState(row.id, "active")}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Obnovit"}
                        </button>
                      ) : null}

                      {!isDeleted && !isAdmin && !isSelf ? (
                        <button
                          type="button"
                          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
                          onClick={() => softDeleteUser(row.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Mazem..." : "Soft delete"}
                        </button>
                      ) : null}

                      <Link href={`/profile/${row.id}`} className="rentulo-btn-secondary px-4 py-2 text-sm">
                        Verejny profil
                      </Link>
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
