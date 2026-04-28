"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("sk-SK");
}

function verificationLabel(status: string) {
  if (status === "approved") return "Overene";
  if (status === "pending") return "Caka na kontrolu";
  if (status === "rejected") return "Zamietnute";
  if (status === "not_submitted") return "Neodoslane";
  return status;
}

function verificationBadge(status: string) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-300";
  if (status === "pending") return "bg-amber-500/15 text-amber-300";
  if (status === "rejected") return "bg-red-500/15 text-red-300";
  return "bg-white/10 text-white/70";
}

function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "Pouzivatel";
}

function roleBadge(role: string) {
  return role === "admin" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/70";
}

function actionLabel(actionType: string) {
  if (actionType === "verification_status_changed") return "Zmena stavu overenia";
  if (actionType === "user_role_changed") return "Zmena roly pouzivatela";
  if (actionType === "user_suspended") return "Pouzivatel pozastaveny";
  if (actionType === "user_blocked") return "Pouzivatel zablokovany";
  if (actionType === "user_active") return "Pouzivatel obnoveny";
  if (actionType === "user_soft_deleted") return "Pouzivatel soft deleted";
  if (actionType === "item_hidden") return "Inzerat skryty";
  if (actionType === "item_visibility_restored") return "Inzerat obnoveny";
  if (actionType === "review_hidden") return "Hodnotenie skryte";
  if (actionType === "review_restored") return "Hodnotenie obnovene";
  if (actionType === "review_deleted") return "Hodnotenie vymazane";
  if (actionType === "wallet_release") return "Uvolnenie payoutu";
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

  const [status, setStatus] = useState("Nacitavam...");
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

  useEffect(() => {
    const load = async () => {
      setStatus("Nacitavam...");

      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user.id;

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
        pendingVerifications,
        approvedVerifications,
        rejectedVerifications,
        usersResult,
        adminsResult,
        auditResult,
        latestVerificationsResult,
        latestUsersResult,
        latestActionsResult,
      ] = await Promise.all([
        supabase.from("user_verifications").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("user_verifications").select("id", { count: "exact" }).eq("status", "approved"),
        supabase.from("user_verifications").select("id", { count: "exact" }).eq("status", "rejected"),
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
        pendingVerifications.error ||
        approvedVerifications.error ||
        rejectedVerifications.error ||
        usersResult.error ||
        adminsResult.error ||
        auditResult.error ||
        latestVerificationsResult.error ||
        latestUsersResult.error ||
        latestActionsResult.error;

      if (firstError) {
        setStatus("Chyba: " + firstError.message);
        return;
      }

      setStats({
        pendingVerifications: pendingVerifications.count ?? 0,
        approvedVerifications: approvedVerifications.count ?? 0,
        rejectedVerifications: rejectedVerifications.count ?? 0,
        totalUsers: usersResult.count ?? 0,
        totalAdmins: adminsResult.count ?? 0,
        totalAuditLogs: auditResult.count ?? 0,
      });
      setLatestVerifications((latestVerificationsResult.data ?? []) as LatestVerificationRow[]);
      setLatestUsers((latestUsersResult.data ?? []) as LatestUserRow[]);
      setLatestActions((latestActionsResult.data ?? []) as LatestActionRow[]);
      setStatus("");
    };

    void load();
  }, [router]);

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo administracia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Admin dashboard</h1>

            <p className="mt-2 leading-7 text-white/70">
              Prehlad pouzivatelov, overeni, audit logu a vstupov do admin balikov.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/verifications" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Overenia
            </Link>
            <Link href="/admin/users" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Pouzivatelia
            </Link>
            <Link href="/admin/items" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Inzeraty
            </Link>
            <Link href="/admin/reviews" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Hodnotenia
            </Link>
            <Link href="/admin/disputes" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Spory
            </Link>
            <Link href="/admin/actions" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Audit
            </Link>
          </div>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Cakajuce overenia"
          value={stats.pendingVerifications}
          subtitle={`${stats.approvedVerifications} schvalenych · ${stats.rejectedVerifications} zamietnutych`}
        />
        <StatCard
          title="Pouzivatelia"
          value={stats.totalUsers}
          subtitle={`${stats.totalAdmins} adminov`}
        />
        <StatCard
          title="Audit log"
          value={stats.totalAuditLogs}
          subtitle="Administratorske zasahy"
        />
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Rychle odkazy</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/users" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Users
            </Link>
            <Link href="/admin/items" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Items
            </Link>
            <Link href="/admin/reviews" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Reviews
            </Link>
            <Link href="/admin/actions" className="rentulo-btn-secondary px-3 py-2 text-sm">
              Audit
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rentulo-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Posledne overenia</h2>
              <p className="mt-1 text-sm text-white/60">Najnovsie ziadosti na kontrolu.</p>
            </div>

            <Link href="/admin/verifications" className="text-sm text-indigo-300 hover:text-indigo-200">
              Otvorit →
            </Link>
          </div>

          {latestVerifications.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
              Zatial nic.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {latestVerifications.map((row) => (
                <li key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{row.full_name || "Bez mena"}</div>
                      <div className="mt-1 text-sm text-white/60">{row.company_name || row.user_id}</div>
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
              <h2 className="text-lg font-semibold">Najnovsi pouzivatelia</h2>
              <p className="mt-1 text-sm text-white/60">Nove ucty a ich roly.</p>
            </div>

            <Link href="/admin/users" className="text-sm text-indigo-300 hover:text-indigo-200">
              Otvorit →
            </Link>
          </div>

          {latestUsers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
              Zatial nic.
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
              <h2 className="text-lg font-semibold">Posledne admin akcie</h2>
              <p className="mt-1 text-sm text-white/60">Kratky vypis zasahov administracie.</p>
            </div>

            <Link href="/admin/actions" className="text-sm text-indigo-300 hover:text-indigo-200">
              Otvorit →
            </Link>
          </div>

          {latestActions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
              Zatial nic.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Link href="/admin/verifications" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Overenia</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Schvalovanie a zamietanie profilov.
          </div>
        </Link>

        <Link href="/admin/users" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Pouzivatelia</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Suspend, block, role change a soft delete.
          </div>
        </Link>

        <Link href="/admin/items" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Inzeraty</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Editacia, skrytie a obnova viditelnosti.
          </div>
        </Link>

        <Link href="/admin/reviews" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Hodnotenia</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Skrytie, obnova a az potom delete.
          </div>
        </Link>

        <Link href="/admin/disputes" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Spory</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Prechod na admin spory.
          </div>
        </Link>

        <Link href="/admin/actions" className="rentulo-card p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.07]">
          <div className="text-lg font-semibold">Audit</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Historia administratorskych zasahov.
          </div>
        </Link>
      </section>
    </main>
  );
}
