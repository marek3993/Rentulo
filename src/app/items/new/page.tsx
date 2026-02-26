"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type UploadedImage = { path: string; url: string };

export default function NewItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("10");
  const [city, setCity] = useState("");

  const [status, setStatus] = useState("");

  const [createdItemId, setCreatedItemId] = useState<number | null>(null);
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
    };
    guard();
  }, [router]);

  const canUpload = useMemo(() => createdItemId !== null, [createdItemId]);

  const ensureProfile = async (userId: string) => {
    const { data: existingProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw new Error(profileErr.message);

    if (!existingProfile) {
      const { error: insertProfileErr } = await supabase
        .from("profiles")
        .insert({ id: userId, role: "user" });

      if (insertProfileErr) throw new Error(insertProfileErr.message);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Ukladám...");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setStatus("Nie ste prihlásený.");
      return;
    }

    try {
      await ensureProfile(userId);

      const { data: created, error } = await supabase
        .from("items")
        .insert({
          owner_id: userId,
          title,
          description: description || null,
          price_per_day: Number(pricePerDay),
          city: city || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) {
        setStatus("Chyba: " + error.message);
        return;
      }

      setCreatedItemId(created.id);
      setStatus("Ponuka uložená ✅ Teraz nahraj fotky (voliteľné).");
    } catch (err: any) {
      setStatus("Chyba: " + (err?.message ?? "unknown"));
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!createdItemId) return;

    setUploading(true);
    setStatus("Nahrávam fotky...");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setStatus("Nie ste prihlásený.");
      setUploading(false);
      return;
    }

    try {
      const max = Math.min(files.length, 5); // MVP limit
      for (let i = 0; i < max; i++) {
        const f = files[i];

        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const filename = `${crypto.randomUUID()}.${safeExt}`;

        const path = `${userId}/${createdItemId}/${filename}`;

        const { error: upErr } = await supabase.storage
          .from("item-images")
          .upload(path, f, { upsert: false });

        if (upErr) throw new Error(upErr.message);

        const { error: dbErr } = await supabase.from("item_images").insert({
          item_id: createdItemId,
          owner_id: userId,
          path,
        });

        if (dbErr) throw new Error(dbErr.message);

        const { data: pub } = supabase.storage.from("item-images").getPublicUrl(path);
        setUploads((prev) => [...prev, { path, url: pub.publicUrl }]);
      }

      setStatus("Fotky nahrané ✅");
    } catch (err: any) {
      setStatus("Chyba: " + (err?.message ?? "upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-md">
      <h1 className="text-2xl font-semibold">Nová ponuka</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Názov"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={createdItemId !== null}
        />

        <textarea
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Popis"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={createdItemId !== null}
        />

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Mesto"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={createdItemId !== null}
        />

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Cena za deň"
          value={pricePerDay}
          onChange={(e) => setPricePerDay(e.target.value)}
          type="number"
          min="0"
          step="0.5"
          required
          disabled={createdItemId !== null}
        />

        {createdItemId === null ? (
          <button className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90">
            Uložiť
          </button>
        ) : null}
      </form>

      {/* Upload section */}
      <div className="mt-8 rounded border border-white/10 bg-white/5 p-4">
        <div className="font-semibold">Fotky</div>
        <div className="mt-1 text-white/70 text-sm">
          Najprv ulož ponuku, potom môžeš nahrať max. 5 fotiek (jpg/png/webp).
        </div>

        <input
          className="mt-3 block w-full text-sm"
          type="file"
          accept="image/*"
          multiple
          disabled={!canUpload || uploading}
          onChange={(e) => uploadFiles(e.target.files)}
        />

        {uploads.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {uploads.map((u) => (
              <img
                key={u.path}
                src={u.url}
                alt="item"
                className="h-24 w-full rounded object-cover border border-white/10"
              />
            ))}
          </div>
        ) : null}

        {createdItemId !== null ? (
          <button
            className="mt-4 rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            type="button"
            onClick={() => router.push(`/items/${createdItemId}`)}
          >
            Prejsť na detail ponuky
          </button>
        ) : null}
      </div>

      {status ? <p className="mt-4">{status}</p> : null}
    </main>
  );
}