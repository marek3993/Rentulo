"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Badge, KpiCard, Notice, Pagination, Section, SelectField, TextField } from "@/components/owner/OwnerUI";

type DisputeRow = {
  id: number;
  reservation_id: number | null;
  status?: string | null;
  created_at?: string | null;
  reason?: string | null;
  message?: string | null;
  details?: string | null;
};

const PAGE_SIZE = 12;

export default function OwnerDisputesPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam…");
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const derivedStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = (r.status ?? "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sk"));
  }, [rows]);

  const statusOptions = useMemo(() => {
    return [{ value: "all", label: "Všetky" }, ...derivedStatuses.map((s) => ({ value: s, label: s }))];
  }, [derivedStatuses]);

  const openCount = useMemo(() => rows.filter((r) => (r.status ?? "").toLowerCase() === "open").length, [rows]);
  const closedCount = useMemo(() => rows.filter((r) => ["closed", "resolved"].includes((r.status ?? "").toLowerCase())).length, [rows]);

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // IMPORTANT:
    // Ideálne nech je RLS nastavené tak, aby owner videl len disputes na svojich itemoch.
    // Ak RLS ešte nie je, doplň ho v SQL sekcii nižšie.
    let req = supabase
      .from("disputes")
      .select("*", { count: "exact" })
      .order(sort === "oldest" ? "id" : "id", { ascending: sort === "oldest" });

    const queryText = q.trim();
    if (queryText) {
      if (/^\d+$/.test(queryText)) {
        // allow quick jump by dispute id
        req = req.eq("id", Number(queryText));
      }
      // else: keep as global text only client-side (schema unknown)
    }

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    let list = (data ?? []) as any as DisputeRow[];

    // client-side status filter (safe even if column differs)
    if (statusFilter !== "all") {
      list = list.filter((r) => (r.status ?? "").toLowerCase() === statusFilter.toLowerCase());
    }

    setRows(list);
    setTotal(count ?? 0);
    setStatus("");
  };

  useEffect(() => {
    load().catch((e: any) => setStatus("Chyba: " + (e?.message ?? "neznáma chyba")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, statusFilter, sort]);

  return (
    <main className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Reklamácie</h2>
        <p className="mt-1 text-white/60">
          Prehľad reklamácií (disputes). Z tejto stránky sa preklikneš na súvisiacu rezerváciu.
        </p>
      </div>

      {status ? <Notice text={status} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Zobrazené" value={rows.length} hint="Počet v aktuálnom zozname" />
        <KpiCard title="Otvorené (orientačne)" value={openCount} hint='Počíta len status="open" v načítanej strane' />
        <KpiCard title="Uzavreté (orientačne)" value={closedCount} hint='Počíta len status="closed/resolved" v načítanej strane' />
      </div>

      <Section title="Vyhľadávanie a filtre" subtitle="Schéma disputes sa môže líšiť – preto je filter konzervatívny a bezpečný.">
        <div className="grid gap-3 md:grid-cols-3">
          <TextField
            id="q"
            label="Hľadať"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Číslo reklamácie (ID)"
          />

          <SelectField
            id="st"
            label="Stav"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={statusOptions}
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
            ]}
          />
        </div>
      </Section>

      <Section title="Zoznam reklamácií" subtitle={`Zobrazené: ${rows.length} z ${total}`}>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne reklamácie podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((d) => {
              const st = (d.status ?? "unknown").toString();
              const badgeTone =
                st.toLowerCase() === "open"
                  ? "warning"
                  : ["closed", "resolved"].includes(st.toLowerCase())
                  ? "success"
                  : "neutral";

              return (
                <li key={d.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/60">
                        Reklamácia <strong className="text-white">#{d.id}</strong>
                      </div>
                      <div className="mt-1 text-white/80">
                        Rezervácia:{" "}
                        <strong className="text-white">
                          {d.reservation_id ?? "—"}
                        </strong>
                      </div>
                      {d.created_at ? (
                        <div className="mt-1 text-sm text-white/60">
                          Vytvorené: {new Date(d.created_at).toLocaleDateString("sk-SK")}
                        </div>
                      ) : null}

                      {d.reason ? <div className="mt-2 text-sm text-white/70">Dôvod: {d.reason}</div> : null}
                    </div>

                    <Badge tone={badgeTone as any}>{st}</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {d.reservation_id ? (
                      <Link
                        className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                        href={`/owner/reservations?reservation_id=${d.reservation_id}`}
                      >
                        Otvoriť rezerváciu
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                      onClick={() => navigator.clipboard.writeText(String(d.id))}
                    >
                      Skopírovať ID
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      </Section>
    </main>
  );
}
