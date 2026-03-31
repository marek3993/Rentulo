"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Stats = {
  pendingVerifications: number;
  approvedVerifications: number;
  rejectedVerifications: number;
  totalUsers: number;
  totalAdmins: number;
  totalAuditLogs: number;
};

type LatestVerificationRow = {
  id: number;
  user_id: string;
  status: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
};

type LatestUserRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  role: string;
  created_at: string;
};

type LatestActionRow = {
  id: number;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  created_at: string;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("sk-SK");
}

function verificationLabel(status: string) {
  if (status === "approved") return "Overené";
  if (status === "pending") return "Čaká na kontrolu";
  if (status === "rejected") return "Zamietnuté";
  if (status === "not_submitted") return "Neodoslané";
  return status;
}

function verificationBadge(status: string) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-300";
  if (status === "pending") return "bg-amber-500/15 text-amber-300";
  if (status === "rejected") return "bg-red-500/15 text-red-300";
  return "bg-white/10 text-white/70";
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  return "Používateľ";
}

function roleBadge(role: string) {
  if (role === "admin") return "bg-emerald-500/15 text-emerald-300";
  return "bg-white/10 text-white/70";
}

function actionLabel(actionType: string) {
  if (actionType === "verification_status_changed") return "Zmena stavu overenia";
  if (actionType === "user_role_changed") return "Zmena roly používateľa";
  if (actionType === "wallet_release") return "Uvoľnenie payoutu";
  if (actionType === "dispute_status_changed") return "Zmena stavu sporu";
  return actionType;
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rentulo-card p-5">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-white/50">{subtitle}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [stats, setStats] = useState<Stats>({
    pendingVerifications: 0,
    approvedVerifications: 0,
    rejectedVerifications: 0,
    totalUsers: 0,
    totalAdmins: 0,
    totalAuditLogs: 0,
  });

  const [latestVerifications, setLatestVerifications] = useState<LatestVerificationRow[]>([]);
  const [latestUsers, setLatestUsers] = useState<LatestUserRow[]>([]);
  const [latestActions, setLatestActions] = useState<LatestActionRow[]>([]);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.replace("/login");
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
      router.replace("/");
      return;
    }

    const [
      pendingVerRes,
      approvedVerRes,
      rejectedVerRes,
      usersRes,
      adminsRes,
      auditRes,
      latestVerRes,
      latestUsersRes,
      latestActionsRes,
    ] = await Promise.all([
      supabase
        .from("user_verifications")
        .select("id", { count: "exact" })
        .eq("status", "pending"),
      supabase
        .from("user_verifications")
        .select("id", { count: "exact" })
        .eq("status", "approved"),
      supabase
        .from("user_verifications")
        .select("id", { count: "exact" })
        .eq("status", "rejected"),
      supabase.from("profiles").select("id", { count: "exact" }),
      supabase.from("profiles").select("id", { count: "exact" }).eq("role", "admin"),
      supabase.from("admin_actions").select("id", { count: "exact" }),
      supabase
        .from("user_verifications")
        .select("id,user_id,status,full_name,company_name,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("profiles")
        .select("id,full_name,city,role,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("admin_actions")
        .select("id,action_type,target_table,target_id,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const firstError =
      pendingVerRes.error ||
      approvedVerRes.error ||
      rejectedVerRes.error ||
      usersRes.error ||
      adminsRes.error ||
      auditRes.error ||
      latestVerRes.error ||
      latestUsersRes.error ||
      latestActionsRes.error;

    if (firstError) {
      setStatus("Chyba: " + firstError.message);
      return;
    }

    setStats({
      pendingVerifications: pendingVerRes.count ?? 0,
      approvedVerifications: approvedVerRes.count ?? 0,
      rejectedVerifications: rejectedVerRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      totalAdmins: adminsRes.count ?? 0,
      totalAuditLogs: auditRes.count ?? 0,
    });

    setLatestVerifications((latestVerRes.data ?? []) as LatestVerificationRow[]);
    setLatestUsers((latestUsersRes.data ?? []) as LatestUserRow[]);
    setLatestActions((latestActionsRes.data ?? []) as LatestActionRow[]);

    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo administrácia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Admin dashboard</h1>

            <p className="mt-2 leading-7 text-white/70">
              Prehľad používateľov, overení, audit logu a admin odkazov.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/verifications" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Overenia
            </Link>
            <Link href="/admin/users" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Používatelia
            </Link>
            <Link href="/admin/disputes" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Spory
            </Link>
            <Link href="/admin/actions" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Audit log
            </Link>
          </div>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Čakajúce overenia"
          value={stats.pendingVerifications}
          subtitle={`${stats.approvedVerifications} schválených · ${stats.rejectedVerifications} zamietnutých`}
        />
        <StatCard
          title="Používatelia"
          value={stats.totalUsers}
          subtitle={`${stats.totalAdmins} adminov`}
        />
        <StatCard
          title="Audit log"
          value={stats.totalAuditLogs}
          subtitle="Administrátorské zásahy"
        />
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Rýchle odkazy</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/verifications" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Overenia
            </Link>
            <Link href="/admin/users" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Používatelia
            </Link>
            <Link href="/admin/actions" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Audit
            </Link>
            <Link href="/admin/disputes" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Spory
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rentulo-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Posledné overenia</h2>
              <p className="mt-1 text-sm text-white/60">Rýchly prehľad najnovších žiadostí.</p>
            </div>

            <Link href="/admin/verifications" className="text-sm text-indigo-300 hover:text-indigo-200">
              Otvoriť →
            </Link>
          </div>

          {latestVerifications.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
              Zatiaľ nič.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {latestVerifications.map((row) => (
                <li key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{row.full_name || "Bez mena"}</div>
                      <div className="mt-1 text-sm text-white/60">
                        {row.company_name || row.user_id}
                      </div>
                      <div className="mt-2 text-xs text-white/50">{formatDate(row.created_at)}</div>
                    </div>

                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verificationBadge(row.status)}`}>
                      {verificationLabel(row.status)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rentulo-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Najnovší používatelia</h2>
              <p className="mt-1 text-sm text-white/60">Nové účty a ich roly.</p>
            </div>

            <Link href="/admin/users" className="text-sm text-indigo-300 hover:text-indigo-200">
              Otvoriť →
            </Link>
          </div>

          {latestUsers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
              Zatiaľ nič.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {latestUsers.map((row) => (
                <li key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{row.full_name || "Bez mena"}</div>
                      <div className="mt-1 text-sm text-white/60">{row.city || row.id}</div>
                      <div className="mt-2 text-xs text-white/50">{formatDate(row.created_at)}</div>
                    </div>

                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleBadge(row.role)}`}>
                      {roleLabel(row.role)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rentulo-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Posledné admin akcie</h2>
              <p className="mt-1 text-sm text-white/60">Krátky výpis zásahov administrácie.</p>
            </div>

            <Link href="/admin/actions" className="text-sm text-indigo-300 hover:text-indigo-200">
              Otvoriť →
            </Link>
          </div>

          {latestActions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
              Zatiaľ nič.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {latestActions.map((row) => (
                <li key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="font-medium">{actionLabel(row.action_type)}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {row.target_table || "-"} / {row.target_id || "-"}
                  </div>
                  <div className="mt-2 text-xs text-white/50">{formatDate(row.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/verifications" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Overenia profilov</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Schvaľovanie a zamietanie overení používateľov.
          </div>
        </Link>

        <Link href="/admin/users" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Používatelia a roly</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Pasovanie za admina a správa používateľských rolí.
          </div>
        </Link>

        <Link href="/admin/disputes" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Spory</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Prechod na admin spory.
          </div>
        </Link>

        <Link href="/admin/actions" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Audit log</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            História zásahov administrátorov v systéme.
          </div>
        </Link>
      </section>
    </main>
  );
}