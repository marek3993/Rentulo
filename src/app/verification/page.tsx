"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_TYPE_OPTIONS,
  accountTypeLabel,
  getAccountTypeFromUser,
  type AccountType,
} from "@/lib/accountType";
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

function getAccountTypeContent(accountType: AccountType | null) {
  if (accountType === "sole_trader") {
    return {
      pageTitle: "Overenie SZČO",
      pageDescription:
        "Overenie zladí tvoje meno, podnikanie a profil tak, aby druhá strana vedela, že komunikuje so živnostníkom.",
      benefitsTitle: "Čo overenie pomáha potvrdiť pri SZČO",
      benefits: [
        "profil jasnejšie vysvetlí, že prenajímaš ako podnikajúca osoba",
        "druhá strana vie prepojiť meno s IČO a obchodným menom",
        "stav overenia sa ukáže aj na tvojom profile v aplikácii",
      ],
      afterSubmitTitle: "Čo môžeš čakať po odoslaní",
      afterSubmitItems: [
        "žiadosť prejde do stavu Čaká na kontrolu",
        "výsledok uvidíš priamo na tejto stránke aj vo svojom profile",
        "ak bude treba úpravu, po zamietnutí vieš doplniť údaje a poslať žiadosť znova",
      ],
      formIntro:
        "Vyplň údaje tak, ako chceš mať SZČO naviazanú na dôveryhodný profil v Rentulo.",
      fullNameLabel: "Meno a priezvisko",
      fullNamePlaceholder: "napr. Marek Benda",
      showCompanyName: true,
      companyNameLabel: "Obchodné meno (voliteľné)",
      companyNamePlaceholder: "napr. MB Servis",
      companyNameRequired: false,
      showIco: true,
      icoLabel: "IČO",
      icoPlaceholder: "napr. 12345678",
      icoRequired: true,
      noteLabel: "Poznámka",
      notePlaceholder: "Doplňujúce informácie k overeniu SZČO.",
      approvedCopy:
        "Tvoje SZČO je overené a tento stav sa zobrazuje na profile ako dôveryhodný signál pre ďalšie rezervácie.",
    };
  }

  if (accountType === "company") {
    return {
      pageTitle: "Overenie firmy",
      pageDescription:
        "Overenie pomáha ukázať, že účet patrí firme a že druhá strana má jasný firemný kontakt pre prenájom.",
      benefitsTitle: "Čo overenie pomáha potvrdiť pri firme",
      benefits: [
        "profil jasne ukáže, že za účtom stojí firma",
        "druhá strana vie, koho kontaktovať a pod akým názvom firma vystupuje",
        "stav overenia sa ukáže aj na profile v aplikácii",
      ],
      afterSubmitTitle: "Čo môžeš čakať po odoslaní",
      afterSubmitItems: [
        "žiadosť prejde do stavu Čaká na kontrolu",
        "výsledok uvidíš priamo na tejto stránke aj vo svojom profile",
        "ak bude treba úpravu, po zamietnutí vieš doplniť kontaktné alebo firemné údaje",
      ],
      formIntro:
        "Vyplň údaje pravdivo tak, aby bolo zrejmé, ktorá firma a kontaktná osoba stoja za účtom.",
      fullNameLabel: "Meno kontaktnej osoby",
      fullNamePlaceholder: "napr. Marek Benda",
      showCompanyName: true,
      companyNameLabel: "Názov firmy",
      companyNamePlaceholder: "napr. Rentulo s.r.o.",
      companyNameRequired: true,
      showIco: true,
      icoLabel: "IČO",
      icoPlaceholder: "napr. 12345678",
      icoRequired: true,
      noteLabel: "Poznámka",
      notePlaceholder: "Doplňujúce informácie k firemnému overeniu.",
      approvedCopy:
        "Firemný účet je overený a tento stav pomáha budovať dôveru ešte pred prvou rezerváciou.",
    };
  }

  if (accountType === "private") {
    return {
      pageTitle: "Overenie súkromnej osoby",
      pageDescription:
        "Overenie pomáha budovať dôveru medzi ľuďmi pri rezervácii, prevzatí aj vrátení veci.",
      benefitsTitle: "Čo overenie pomáha zlepšiť",
      benefits: [
        "profil pôsobí dôveryhodnejšie už pri prvom kontakte",
        "druhá strana lepšie rozumie, s kým rieši rezerváciu",
        "stav overenia sa ukáže aj na tvojom profile v aplikácii",
      ],
      afterSubmitTitle: "Čo môžeš čakať po odoslaní",
      afterSubmitItems: [
        "žiadosť prejde do stavu Čaká na kontrolu",
        "výsledok uvidíš priamo na tejto stránke aj vo svojom profile",
        "ak bude treba úpravu, formulár môžeš po zamietnutí doplniť a poslať znova",
      ],
      formIntro:
        "Vyplň údaje pravdivo a tak, ako ich chceš mať naviazané na svoj dôveryhodný profil v Rentulo.",
      fullNameLabel: "Meno a priezvisko",
      fullNamePlaceholder: "napr. Marek Benda",
      showCompanyName: false,
      companyNameLabel: "Firma",
      companyNamePlaceholder: "napr. Rentulo s.r.o.",
      companyNameRequired: false,
      showIco: false,
      icoLabel: "IČO",
      icoPlaceholder: "napr. 12345678",
      icoRequired: false,
      noteLabel: "Poznámka",
      notePlaceholder: "Doplňujúce informácie k overeniu.",
      approvedCopy:
        "Tvoj profil je overený a tento stav je pripravený podporiť dôveru pri ďalších rezerváciách.",
    };
  }

  return {
    pageTitle: "Overenie profilu",
    pageDescription:
      "Najprv si zvoľ typ účtu. Podľa neho vieme pravdivejšie vysvetliť, čo pri overení potrebujeme.",
    benefitsTitle: "Čo overenie pomáha zlepšiť",
    benefits: [
      "profil pôsobí dôveryhodnejšie už pri prvom kontakte",
      "druhá strana lepšie rozumie, s kým rieši rezerváciu",
      "stav overenia sa ukáže aj na tvojom profile v aplikácii",
    ],
    afterSubmitTitle: "Čo môžeš čakať po odoslaní",
    afterSubmitItems: [
      "žiadosť prejde do stavu Čaká na kontrolu",
      "výsledok uvidíš priamo na tejto stránke aj vo svojom profile",
      "po výbere typu účtu sa formulár prispôsobí tvojmu reálnemu onboarding scenáru",
    ],
    formIntro:
      "Ak máš starší účet bez uloženého typu, najprv ho vyber. Existujúci submit a update flow do user_verifications ostáva zachovaný.",
    fullNameLabel: "Meno a priezvisko",
    fullNamePlaceholder: "napr. Marek Benda",
    showCompanyName: true,
    companyNameLabel: "Firma (voliteľné)",
    companyNamePlaceholder: "napr. Rentulo s.r.o.",
    companyNameRequired: false,
    showIco: true,
    icoLabel: "IČO (voliteľné)",
    icoPlaceholder: "napr. 12345678",
    icoRequired: false,
    noteLabel: "Poznámka",
    notePlaceholder: "Doplňujúce informácie k overeniu.",
    approvedCopy:
      "Tvoj profil je overený. Typ účtu sa pri starších účtoch zobrazí presnejšie po jeho uložení v onboardingu.",
  };
}

export default function VerificationPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [saving, setSaving] = useState(false);

  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("not_submitted");
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);

  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ico, setIco] = useState("");
  const [note, setNote] = useState("");

  const canEdit = useMemo(
    () => verificationStatus === "not_submitted" || verificationStatus === "rejected",
    [verificationStatus]
  );
  const content = useMemo(() => getAccountTypeContent(accountType), [accountType]);

  useEffect(() => {
    const load = async () => {
      setStatus("Načítavam...");

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user ?? null;
      const userId = user?.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      setAccountType(getAccountTypeFromUser(user));

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
      const user = sess.session?.user ?? null;
      const userId = user?.id;

      if (!userId) {
        alert("Musíš byť prihlásený.");
        router.push("/login");
        return;
      }

      if (!accountType) {
        alert("Vyber typ účtu.");
        setStatus("Vyber typ účtu.");
        return;
      }

      if (!fullName.trim()) {
        alert(`Vyplň pole „${content.fullNameLabel}“.`);
        setStatus(`Vyplň pole „${content.fullNameLabel}“.`);
        return;
      }

      if (content.companyNameRequired && !companyName.trim()) {
        alert(`Vyplň pole „${content.companyNameLabel}“.`);
        setStatus(`Vyplň pole „${content.companyNameLabel}“.`);
        return;
      }

      if (content.icoRequired && !ico.trim()) {
        alert(`Vyplň pole „${content.icoLabel}“.`);
        setStatus(`Vyplň pole „${content.icoLabel}“.`);
        return;
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          account_type: accountType,
        },
      });

      if (metadataError) {
        throw new Error(`Typ účtu sa nepodarilo uložiť: ${metadataError.message}`);
      }

      const payload = {
        user_id: userId,
        status: nextStatus,
        full_name: fullName.trim() || null,
        company_name: content.showCompanyName ? companyName.trim() || null : null,
        ico: content.showIco ? ico.trim() || null : null,
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
      setStatus(nextStatus === "pending" ? "Žiadosť bola odoslaná." : "Uložené.");
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
            <div className="inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-white/70">
              Typ účtu: {accountTypeLabel(accountType)}
            </div>
            <h1 className="mt-3 text-2xl font-semibold">{content.pageTitle}</h1>
            <p className="mt-1 max-w-2xl text-white/60">{content.pageDescription}</p>
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
          <div className="font-semibold">{content.benefitsTitle}</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-white/70">
            {content.benefits.map((item) => (
              <div key={item}>• {item}</div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="font-semibold">{content.afterSubmitTitle}</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-white/70">
            {content.afterSubmitItems.map((item) => (
              <div key={item}>• {item}</div>
            ))}
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
            {content.approvedCopy}
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

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="font-semibold">Údaje pre overenie</div>
        <p className="text-sm leading-6 text-white/65">{content.formIntro}</p>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-white/80">Typ účtu</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {ACCOUNT_TYPE_OPTIONS.map((option) => {
              const selected = option.value === accountType;

              return (
                <label
                  key={option.value}
                  className={`block rounded-2xl border p-4 transition ${
                    selected
                      ? "border-indigo-400/60 bg-indigo-500/10"
                      : "border-white/10 bg-black/20"
                  } ${canEdit && !saving ? "cursor-pointer hover:border-white/20 hover:bg-white/5" : "opacity-80"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="verification-account-type"
                    value={option.value}
                    checked={selected}
                    onChange={() => setAccountType(option.value)}
                    disabled={!canEdit || saving}
                  />

                  <div className="text-sm font-medium text-white">{option.label}</div>
                  <div className="mt-1 text-sm leading-6 text-white/65">{option.description}</div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {!accountType ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            Tento účet ešte nemá uložený typ v onboardingu. Vyber ho pred uložením alebo odoslaním žiadosti.
          </div>
        ) : null}

        <label className="block">
          <div className="mb-1 text-white/80">{content.fullNameLabel}</div>
          <input
            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={content.fullNamePlaceholder}
            disabled={!canEdit || saving}
          />
        </label>

        {content.showCompanyName ? (
          <label className="block">
            <div className="mb-1 text-white/80">
              {content.companyNameLabel}
              {content.companyNameRequired ? " *" : ""}
            </div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={content.companyNamePlaceholder}
              disabled={!canEdit || saving}
            />
          </label>
        ) : null}

        {content.showIco ? (
          <label className="block">
            <div className="mb-1 text-white/80">
              {content.icoLabel}
              {content.icoRequired ? " *" : ""}
            </div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
              value={ico}
              onChange={(e) => setIco(e.target.value)}
              placeholder={content.icoPlaceholder}
              disabled={!canEdit || saving}
            />
          </label>
        ) : null}

        <label className="block">
          <div className="mb-1 text-white/80">{content.noteLabel}</div>
          <textarea
            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black disabled:opacity-60"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={content.notePlaceholder}
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
