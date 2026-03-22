"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AdminActionRow = {
  id: number;
  admin_user_id: string;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

const PAGE_SIZE = 20;

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("sk-SK");
}

function actionLabel(actionType: string) {
  if (actionType === "verification_status_changed") return "Zmena stavu overenia";
  if (actionType === "user_role_changed") return "Zmena roly používateľa";
  if (actionType === "wallet_release") return "Uvoľnenie payoutu";
  if (actionType === "dispute_status_changed") return "Zmena stavu sporu";
  return actionType;
}

function badgeTone(actionType: string) {
  if (actionType === "verification_status_changed") return "bg-blue-600/90 text-white";
  if (actionType === "user_role_changed") return "bg-green-600/90 text-white";
  if (actionType === "wallet_release") return "bg-emerald-700 text-white";
  if (actionType === "dispute_status_changed") return "bg-orange-500 text-white";
  return "bg-white/10 text-white";
}

export default function AdminActionsPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [rows, setRows] = useState<AdminActionRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const derivedActionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.action_type) set.add(row.action_type);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sk"));
  }, [rows]);

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
      .from("admin_actions")
      .select("id,admin_user_id,action_type,target_table,target_id,meta,created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (actionFilter !== "all") {
      req = req.eq("action_type", actionFilter);
    }

    const q = search.trim();
    if (q) {
      req = req.or(`action_type.ilike.%${q}%,target_table.ilike.%${q}%,target_id.ilike.%${q}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as AdminActionRow[]);
    setTotal(count ?? 0);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Admin audit log</h1>
            <p className="mt-1 text-white/60">
              História zásahov administrátorov v systéme.
            </p>
          </div>

          <Link
  href="/admin"
  className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
>
  Späť do administrácie
</Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Vieš filtrovať podľa typu akcie alebo hľadať podľa targetu.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="admin-actions-search" className="block text-sm text-white/70">
              Hľadať
            </label>
            <input
              id="admin-actions-search"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white placeholder:text-white/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Typ, tabuľka alebo target ID"
            />
          </div>

          <div>
            <label htmlFor="admin-actions-type" className="block text-sm text-white/70">
              Typ akcie
            </label>
            <select
              id="admin-actions-type"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Všetky</option>
              {derivedActionTypes.map((type) => (
                <option key={type} value={type}>
                  {actionLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Záznamy</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazené: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Zatiaľ tu nie sú žiadne záznamy.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-white/85">
                      <span className="text-white/50">Akcia:</span>{" "}
                      <strong>{actionLabel(row.action_type)}</strong>
                    </div>

                    <div className="text-white/80">
                      <span className="text-white/50">Admin:</span> {row.admin_user_id}
                    </div>

                    <div className="text-white/80">
                      <span className="text-white/50">Target:</span>{" "}
                      {row.target_table ?? "-"} / {row.target_id ?? "-"}
                    </div>

                    <div className="text-sm text-white/50">
                      {formatDateTime(row.created_at)}
                    </div>
                  </div>

                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${badgeTone(row.action_type)}`}>
                    {actionLabel(row.action_type)}
                  </span>
                </div>

                {row.meta ? (
                  <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/70">
{JSON.stringify(row.meta, null, 2)}
                  </pre>
                ) : null}
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