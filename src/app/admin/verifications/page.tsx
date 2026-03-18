"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected" | string;

type VerificationRow = {
  id: number;
  user_id: string;
  status: VerificationStatus;
  full_name: string | null;
  company_name: string | null;
  ico: string | null;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const PAGE_SIZE = 12;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function statusLabel(status: VerificationStatus) {
  if (status === "not_submitted") return "Neodoslané";
  if (status === "pending") return "Čaká na kontrolu";
  if (status === "approved") return "Overené";
  if (status === "rejected") return "Zamietnuté";
  return status;
}

function statusBadge(status: VerificationStatus) {
  if (status === "approved") return "bg-green-600/90 text-white";
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "rejected") return "bg-red-600/90 text-white";
  return "bg-white/10 text-white";
}

export default function AdminVerificationsPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
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
      setStatus("Nemáš prístup.");
      return;
    }

    let req = supabase
      .from("user_verifications")
      .select("*", { count: "exact" });

    if (statusFilter !== "all") {
      req = req.eq("status", statusFilter);
    }

    const trimmed = query.trim();
    if (trimmed) {
      req = req.or(
        `full_name.ilike.%${trimmed}%,company_name.ilike.%${trimmed}%,ico.ilike.%${trimmed}%,note.ilike.%${trimmed}%`
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

    setRows((data ?? []) as VerificationRow[]);
    setTotal(count ?? 0);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);
  const approvedCount = useMemo(() => rows.filter((r) => r.status === "approved").length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((r) => r.status === "rejected").length, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateVerificationStatus = async (
    verificationId: number,
    nextStatus: "approved" | "rejected"
  ) => {
    setUpdatingId(verificationId);
    setStatus("Ukladám zmenu...");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const adminUserId = sess.session?.user.id;

      if (!adminUserId) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("user_verifications")
        .update({
          status: nextStatus,
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", verificationId);

      if (error) {
        throw new Error(error.message);
      }

      setStatus("Stav overenia bol uložený ✅");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri ukladaní.";
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
            <h1 className="text-2xl font-semibold">Overenia používateľov</h1>
            <p className="mt-1 text-white/60">
              Administrácia žiadostí o overenie profilov.
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
          <div className="text-sm text-white/60">Čakajúce</div>
          <div className="mt-2 text-3xl font-semibold">{pendingCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Schválené</div>
          <div className="mt-2 text-3xl font-semibold">{approvedCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Zamietnuté</div>
          <div className="mt-2 text-3xl font-semibold">{rejectedCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktuálnej strane</div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Vyhľadávanie a filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Hľadaj podľa mena, firmy, IČO alebo poznámky.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="verification-search" className="block text-sm text-white/70">
              Hľadať
            </label>
            <input
              id="verification-search"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white placeholder:text-white/40"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Meno, firma, IČO, poznámka"
            />
          </div>

          <div>
            <label htmlFor="verification-status" className="block text-sm text-white/70">
              Stav
            </label>
            <select
              id="verification-status"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Všetky</option>
              <option value="not_submitted">Neodoslané</option>
              <option value="pending">Čaká na kontrolu</option>
              <option value="approved">Overené</option>
              <option value="rejected">Zamietnuté</option>
            </select>
          </div>

          <div>
            <label htmlFor="verification-sort" className="block text-sm text-white/70">
              Triedenie
            </label>
            <select
              id="verification-sort"
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
          <h2 className="text-lg font-semibold">Zoznam žiadostí</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazené: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne záznamy podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const canApprove =
                row.status === "pending" || row.status === "not_submitted" || row.status === "rejected";
              const canReject =
                row.status === "pending" || row.status === "not_submitted" || row.status === "approved";

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Overenie</span>
                        <strong className="text-base">#{row.id}</strong>
                      </div>

                      <div className="text-white/85">
                        <span className="text-white/50">Používateľ:</span>{" "}
                        <strong>{row.full_name || "Bez mena"}</strong>
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Firma:</span> {row.company_name || "-"}
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">IČO:</span> {row.ico || "-"}
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">User ID:</span> {row.user_id}
                      </div>

                      {row.note ? (
                        <div className="max-w-3xl whitespace-pre-wrap text-sm text-white/70">
                          {row.note}
                        </div>
                      ) : null}

                      <div className="text-sm text-white/50">
                        Vytvorené: {formatDate(row.created_at)} · Aktualizované: {formatDate(row.updated_at)}
                      </div>

                      <div className="text-sm text-white/50">
                        Skontrolované: {formatDate(row.reviewed_at)}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canApprove ? (
                      <button
                        type="button"
                        className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                        disabled={updatingId === row.id}
                        onClick={() => updateVerificationStatus(row.id, "approved")}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Schváliť"}
                      </button>
                    ) : null}

                    {canReject ? (
                      <button
                        type="button"
                        className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                        disabled={updatingId === row.id}
                        onClick={() => updateVerificationStatus(row.id, "rejected")}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Zamietnuť"}
                      </button>
                    ) : null}

                    <Link
                      href={`/profile/${row.user_id}`}
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