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

export default function VerificationPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [saving, setSaving] = useState(false);

  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("not_submitted");
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ico, setIco] = useState("");
  const [note, setNote] = useState("");

  const canEdit = useMemo(
    () => verificationStatus === "not_submitted" || verificationStatus === "rejected",
    [verificationStatus]
  );

  useEffect(() => {
    const load = async () => {
      setStatus("Načítavam...");

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("user_verifications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        setStatus("Chyba: " + error.message);
        return;
      }

      if (data) {
        const row = data as VerificationRow;
        setVerificationId(row.id);
        setVerificationStatus(row.status);
        setReviewedAt(row.reviewed_at);
        setFullName(row.full_name ?? "");
        setCompanyName(row.company_name ?? "");
        setIco(row.ico ?? "");
        setNote(row.note ?? "");
      } else {
        setVerificationId(null);
        setVerificationStatus("not_submitted");
        setReviewedAt(null);
        setFullName("");
        setCompanyName("");
        setIco("");
        setNote("");
      }

      setStatus("");
    };

    load();
  }, [router]);

  const saveVerification = async (nextStatus: "not_submitted" | "pending") => {
    setSaving(true);
    setStatus(nextStatus === "pending" ? "Odosielam žiadosť..." : "Ukladám...");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        alert("Musíš byť prihlásený.");
        router.push("/login");
        return;
      }

      if (!fullName.trim()) {
        alert("Vyplň meno a priezvisko.");
        setStatus("Vyplň meno a priezvisko.");
        return;
      }

      const payload = {
        user_id: userId,
        status: nextStatus,
        full_name: fullName.trim() || null,
        company_name: companyName.trim() || null,
        ico: ico.trim() || null,
        note: note.trim() || null,
      };

      if (verificationId) {
        const { error } = await supabase
          .from("user_verifications")
          .update(payload)
          .eq("id", verificationId);

        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { data, error } = await supabase
          .from("user_verifications")
          .insert(payload)
          .select("id,status,reviewed_at")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setVerificationId(data.id);
        setVerificationStatus(data.status);
        setReviewedAt(data.reviewed_at ?? null);
      }

      setVerificationStatus(nextStatus);
      setReviewedAt(null);
      setStatus(nextStatus === "pending" ? "Žiadosť bola odoslaná ✅" : "Uložené ✅");
      alert(nextStatus === "pending" ? "Žiadosť o overenie bola odoslaná." : "Údaje boli uložené.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri ukladaní.";
      setStatus("Chyba: " + message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Overenie profilu</h1>
            <p className="mt-1 text-white/60">
              Overenie pomáha budovať dôveru medzi ľuďmi pri rezervácii, prevzatí aj vrátení veci.
            </p>
          </div>

          <Link
            href="/profile"
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
          >
            Späť na profil
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="font-semibold">Čo overenie pomáha zlepšiť</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-white/70">
            <div>• profil pôsobí dôveryhodnejšie už pri prvom kontakte</div>
            <div>• druhá strana lepšie rozumie, s kým rieši rezerváciu</div>
            <div>• stav overenia sa ukáže aj na tvojom profile v aplikácii</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="font-semibold">Čo môžeš čakať po odoslaní</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-white/70">
            <div>• žiadosť prejde do stavu Čaká na kontrolu</div>
            <div>• výsledok uvidíš priamo na tejto stránke aj vo svojom profile</div>
            <div>• ak bude treba úpravu, formulár môžeš po zamietnutí doplniť a poslať znova</div>
          </div>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-semibold">Stav overenia</div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge(verificationStatus)}`}>
            {statusLabel(verificationStatus)}
          </span>
        </div>

        <div className="mt-3 text-sm text-white/60">
          Posledná kontrola: <strong className="text-white">{formatDate(reviewedAt)}</strong>
        </div>

        {verificationStatus === "approved" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            Tvoj profil je overený a tento stav je pripravený podporiť dôveru pri ďalších rezerváciách.
          </div>
        ) : null}

        {verificationStatus === "pending" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            Tvoja žiadosť čaká na kontrolu administrátorom. Po výsledku sa stav aktualizuje tu aj na profile.
          </div>
        ) : null}

        {verificationStatus === "rejected" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            Žiadosť bola zamietnutá. Údaje môžeš upraviť, doplniť a odoslať znova.
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="font-semibold">Údaje pre overenie</div>
        <p className="text-sm leading-6 text-white/65">
          Vyplň údaje pravdivo a tak, ako ich chceš mať naviazané na svoj dôveryhodný profil v Rentulo.
        </p>

        <label className="block">
          <div className="mb-1 text-white/80">Meno a priezvisko</div>
          <input
            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="napr. Marek Benda"
            disabled={!canEdit || saving}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-white/80">Firma (voliteľné)</div>
          <input
            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="napr. Rentulo s.r.o."
            disabled={!canEdit || saving}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-white/80">IČO (voliteľné)</div>
          <input
            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
            value={ico}
            onChange={(e) => setIco(e.target.value)}
            placeholder="napr. 12345678"
            disabled={!canEdit || saving}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-white/80">Poznámka</div>
          <textarea
            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Doplňujúce informácie k overeniu."
            disabled={!canEdit || saving}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <button
                type="button"
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                onClick={() => saveVerification("not_submitted")}
                disabled={saving}
              >
                {saving ? "Ukladám..." : "Uložiť rozpracované"}
              </button>

              <button
                type="button"
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={() => saveVerification("pending")}
                disabled={saving}
              >
                {saving ? "Odosielam..." : "Odoslať žiadosť"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
