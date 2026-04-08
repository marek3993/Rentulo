"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | string;

function verificationBadgeClass(status: VerificationStatus) {
  if (status === "verified") return "bg-emerald-600/90 text-white";
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "rejected") return "bg-red-600/90 text-white";
  return "bg-white/10 text-white";
}

function verificationLabel(status: VerificationStatus) {
  if (status === "verified") return "Overený profil";
  if (status === "pending") return "Čaká na overenie";
  if (status === "rejected") return "Overenie zamietnuté";
  return "Neoverený profil";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

export default function ProfilePage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("unverified");
  const [verificationNote, setVerificationNote] = useState("");
  const [verificationSubmittedAt, setVerificationSubmittedAt] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  const [status, setStatus] = useState("Načítavam...");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestingVerification, setRequestingVerification] = useState(false);

  const avatarUrl = useMemo(() => {
    if (!avatarPath) return null;
    return supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;
  }, [avatarPath]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id ?? null;

      if (!active) return;

      if (!userId) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(userId);

      const { data: prof, error } = await supabase
        .from("profiles")
        .select(
          "full_name,city,bio,avatar_path,instagram_url,facebook_url,linkedin_url,website_url,verification_status,verification_note,verification_submitted_at,verified_at"
        )
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setStatus("Chyba: " + error.message);
        setAuthChecked(true);
        return;
      }

      if (prof) {
        setFullName(prof.full_name ?? "");
        setCity(prof.city ?? "");
        setBio(prof.bio ?? "");
        setInstagramUrl(prof.instagram_url ?? "");
        setFacebookUrl(prof.facebook_url ?? "");
        setLinkedinUrl(prof.linkedin_url ?? "");
        setWebsiteUrl(prof.website_url ?? "");
        setAvatarPath(prof.avatar_path ?? null);
        setVerificationStatus(prof.verification_status ?? "unverified");
        setVerificationNote(prof.verification_note ?? "");
        setVerificationSubmittedAt(prof.verification_submitted_at ?? null);
        setVerifiedAt(prof.verified_at ?? null);
      }

      setStatus("");
      setAuthChecked(true);
    };

    run();

    return () => {
      active = false;
    };
  }, [router]);

  const ensureProfileExists = async (userId: string) => {
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Kontrola profilu zlyhala: ${selectError.message}`);
    }

    if (existingProfile) return;

    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
    });

    if (insertError) {
      throw new Error(`Vytvorenie profilu zlyhalo: ${insertError.message}`);
    }
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    if (!currentUserId) {
      router.replace("/login");
      return;
    }

    setUploading(true);
    setStatus("Nahrávam fotku...");

    try {
      await ensureProfileExists(currentUserId);

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${currentUserId}/${crypto.randomUUID()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });

      if (uploadError) {
        throw new Error(`Storage upload zlyhal: ${uploadError.message}`);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", currentUserId);

      if (updateError) {
        throw new Error(`Zápis do DB zlyhal: ${updateError.message}`);
      }

      setAvatarPath(path);
      setStatus("Profilová fotka uložená ✅");
      alert("Profilová fotka bola úspešne nahraná.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neznáma chyba pri nahrávaní fotky.";
      setStatus("Chyba: " + message);
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!currentUserId) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setStatus("Ukladám...");

    try {
      await ensureProfileExists(currentUserId);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          city: city.trim() || null,
          bio: bio.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        })
        .eq("id", currentUserId);

      if (error) {
        throw new Error(error.message);
      }

      setStatus("Uložené ✅");
      alert("Profil bol úspešne uložený.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri ukladaní.";
      setStatus("Chyba: " + message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    if (!currentUserId) {
      router.replace("/login");
      return;
    }

    setRequestingVerification(true);
    setStatus("Odosielam žiadosť o overenie...");

    try {
      await ensureProfileExists(currentUserId);

      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update({
          verification_status: "pending",
          verification_note: null,
          verification_submitted_at: nowIso,
        })
        .eq("id", currentUserId);

      if (error) {
        throw new Error(error.message);
      }

      setVerificationStatus("pending");
      setVerificationNote("");
      setVerificationSubmittedAt(nowIso);
      setStatus("Žiadosť o overenie bola odoslaná ✅");
      alert("Žiadosť o overenie bola odoslaná.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neznáma chyba pri odoslaní žiadosti.";
      setStatus("Chyba: " + message);
      alert(message);
    } finally {
      setRequestingVerification(false);
    }
  };

  if (!authChecked) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          Načítavam...
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Dôvera a profil
            </div>

            <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Môj profil</h1>

            <p className="mt-2 leading-7 text-white/70">
              Uprav si profil tak, aby druhá strana pri rezervácii hneď videla, kto si a aký je tvoj stav overenia.
            </p>
          </div>

          <Link href="/items" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
            Prejsť na ponuky
          </Link>
        </div>
      </div>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <div className="rentulo-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-sm text-white/60">Dôvera v profile</div>

            <div className="mt-2 text-xl font-semibold">Stav overenia je viditeľný ako prvý signál dôvery</div>

            <p className="mt-2 text-sm leading-6 text-white/65">
              Overený profil pomáha ľuďom cítiť väčšiu istotu pri rezervácii, pri prevzatí veci aj vtedy,
              keď treba spätne pozrieť priebeh prenájmu.
            </p>

            <div className="mt-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${verificationBadgeClass(
                  verificationStatus
                )}`}
              >
                {verificationLabel(verificationStatus)}
              </span>
            </div>

            {verificationSubmittedAt ? (
              <div className="mt-3 text-sm text-white/60">
                Odoslané: {formatDate(verificationSubmittedAt)}
              </div>
            ) : null}

            {verifiedAt ? (
              <div className="mt-1 text-sm text-white/60">
                Overené: {formatDate(verifiedAt)}
              </div>
            ) : null}

            {verificationNote ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                Poznámka: {verificationNote}
              </div>
            ) : null}

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/65">
              Ak ešte overenie nemáš, môžeš ho spustiť hneď teraz bez zmeny ostatných častí profilu.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {verificationStatus === "unverified" || verificationStatus === "rejected" ? (
              <button
                type="button"
                className="rentulo-btn-primary px-4 py-2.5 text-sm disabled:opacity-50"
                onClick={requestVerification}
                disabled={requestingVerification}
              >
                {requestingVerification ? "Odosielam..." : "Požiadať o overenie"}
              </button>
            ) : verificationStatus === "pending" ? (
              <div className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70">
                Žiadosť čaká na spracovanie
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300">
                Profil je overený
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rentulo-card space-y-4 p-6">
          <div className="font-semibold">Profilová fotka</div>

          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-20 w-20 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/45">
                Bez fotky
              </div>
            )}

            <div className="text-sm text-white/70">
              Nahraj fotku, aby bol profil pri rezerváciách a komunikácii dôveryhodnejší.
            </div>
          </div>

          <input
            id="profile-avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)}
          />

          <label
            htmlFor="profile-avatar-upload"
            className={`rentulo-btn-secondary inline-flex cursor-pointer px-4 py-2.5 text-sm ${
              uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {uploading ? "Nahrávam..." : "Vybrať súbor"}
          </label>
        </div>

        <div className="rentulo-card space-y-4 p-6">
          <div className="font-semibold">Základné údaje</div>

          <label className="block">
            <div className="mb-1 text-white/80">Meno</div>
            <input
              className="rentulo-input-light px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="napr. Používateľ Rentulo"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Mesto</div>
            <input
              className="rentulo-input-light px-3 py-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="napr. Trnava"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Popis</div>
            <textarea
              className="rentulo-input-light px-3 py-2"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Krátko predstav seba alebo svoje ponuky."
            />
          </label>
        </div>
      </div>

      <div className="rentulo-card space-y-3 p-6">
        <div className="font-semibold">Sociálne siete a web</div>

        <input
          className="rentulo-input-light px-3 py-2"
          placeholder="Instagram URL"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
        />

        <input
          className="rentulo-input-light px-3 py-2"
          placeholder="Facebook URL"
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
        />

        <input
          className="rentulo-input-light px-3 py-2"
          placeholder="LinkedIn URL"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
        />

        <input
          className="rentulo-input-light px-3 py-2"
          placeholder="Webstránka"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
        />

        <button
          className="rentulo-btn-primary mt-2 px-4 py-2.5 text-sm disabled:opacity-50"
          onClick={save}
          type="button"
          disabled={saving}
        >
          {saving ? "Ukladám..." : "Uložiť"}
        </button>
      </div>
    </main>
  );
}
