"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  const [status, setStatus] = useState("Načítavam...");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select(
          "full_name,city,bio,avatar_path,instagram_url,facebook_url,linkedin_url,website_url"
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setStatus("Chyba: " + error.message);
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

        const p = prof.avatar_path ?? null;
        setAvatarPath(p);

        if (p) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(p);
          setAvatarUrl(pub.publicUrl);
        }
      }

      setStatus("");
    };

    run();
  }, [router]);

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;

    setUploading(true);
    setStatus("Nahrávam fotku...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${safeExt}`;

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
      if (dbErr) throw new Error(dbErr.message);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarPath(path);
      setAvatarUrl(pub.publicUrl);

      setStatus("Hotovo ✅");
    } catch (err: any) {
      setStatus("Chyba: " + (err?.message ?? "upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setStatus("Ukladám...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        city: city || null,
        bio: bio || null,
        instagram_url: instagramUrl || null,
        facebook_url: facebookUrl || null,
        linkedin_url: linkedinUrl || null,
        website_url: websiteUrl || null,
      })
      .eq("id", userId);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setStatus("Uložené ✅");
  };

  return (
    <main className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Profil</h1>
      {status ? <p className="mt-4">{status}</p> : null}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="font-semibold">Profilová fotka</div>

          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-20 w-20 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="h-20 w-20 rounded-full border border-white/10 bg-white/5" />
            )}

            <div className="text-sm text-white/70">
              Nahraj fotku pre dôveryhodnosť profilu.
            </div>
          </div>

          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="font-semibold">Základné údaje</div>

          <label className="block">
            <div className="mb-1 text-white/80">Meno a priezvisko</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="napr. Marek Benda"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Mesto</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="napr. Bratislava"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Popis (bio)</div>
            <textarea
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Krátko o sebe, čo prenajímaš, pravidlá, spoľahlivosť..."
            />
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
        <div className="font-semibold">Sociálne siete</div>

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
          placeholder="Instagram URL"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
        />
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
          placeholder="Facebook URL"
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
        />
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
          placeholder="LinkedIn URL"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
        />
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
          placeholder="Webstránka"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
        />

        <button
          className="mt-2 rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
          onClick={save}
          type="button"
        >
          Uložiť
        </button>
      </div>
    </main>
  );
}