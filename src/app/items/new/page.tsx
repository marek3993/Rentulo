"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type SelectedImage = { file: File; previewUrl: string };

export default function NewItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("10");
  const [city, setCity] = useState("");

  const [images, setImages] = useState<SelectedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
    };
    guard();

    return () => {
      // cleanup previews
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

  const onPickImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // limit 5 total
    const remaining = Math.max(5 - images.length, 0);
    const picked = Array.from(files).slice(0, remaining);

    const next: SelectedImage[] = picked.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));

    setImages((prev) => [...prev, ...next]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const uploadImagesForItem = async (userId: string, itemId: number) => {
    // bucket: item-images
    for (let i = 0; i < images.length; i++) {
      const f = images[i].file;
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const filename = `${crypto.randomUUID()}.${safeExt}`;
      const path = `${userId}/${itemId}/${filename}`;

      setStatus(`Nahrávam fotku ${i + 1}/${images.length}...`);

      const { error: upErr } = await supabase.storage
        .from("item-images")
        .upload(path, f, { upsert: false });

      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await supabase.from("item_images").insert({
        item_id: itemId,
        owner_id: userId,
        path,
      });

      if (dbErr) throw new Error(dbErr.message);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus("Ukladám ponuku...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Nie ste prihlásený.");

      await ensureProfile(userId);

      // 1) create item
      const { data: created, error: itemErr } = await supabase
        .from("items")
        .insert({
          owner_id: userId,
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          price_per_day: Number(pricePerDay),
          city: city.trim() ? city.trim() : null,
          is_active: true,
        })
        .select("id")
        .single();

      if (itemErr) throw new Error(itemErr.message);

      const itemId = created.id as number;

      // 2) upload images (if any)
      if (images.length > 0) {
        await uploadImagesForItem(userId, itemId);
      }

      setStatus("Hotovo ✅");
      router.push(`/items/${itemId}`);
    } catch (err: any) {
      setStatus("Chyba: " + (err?.message ?? "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const priceNumber = useMemo(() => Number(pricePerDay || 0), [pricePerDay]);

  return (
    <main className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Nová ponuka</h1>
      <p className="mt-2 text-white/70">
        Vyplň údaje, pridaj fotky a ulož ponuku. Fotky sa nahrajú automaticky pri uložení.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4 md:col-span-1">
          <label className="block">
            <div className="mb-1 text-white/80">Názov *</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={saving}
              placeholder="napr. Vrtačka DeWalt 18V"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Popis</div>
            <textarea
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              disabled={saving}
              placeholder="Stav, príslušenstvo, obmedzenia, podmienky…"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Mesto</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={saving}
              placeholder="napr. Bratislava"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-white/80">Cena za deň (€) *</div>
            <input
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={pricePerDay}
              onChange={(e) => setPricePerDay(e.target.value)}
              type="number"
              min="0"
              step="0.5"
              required
              disabled={saving}
            />
            <div className="mt-1 text-sm text-white/60">
              Zobrazí sa ako <strong>{Number.isFinite(priceNumber) ? priceNumber : 0} € / deň</strong>
            </div>
          </label>
        </div>

        <div className="space-y-4 md:col-span-1">
          <div className="rounded border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Fotky (max. 5)</div>
            <div className="mt-1 text-sm text-white/70">
              Odporúčané: 1× celok, 1× detail, 1× príslušenstvo.
            </div>

            <input
              className="mt-3 block w-full text-sm"
              type="file"
              accept="image/*"
              multiple
              disabled={saving || images.length >= 5}
              onChange={(e) => onPickImages(e.target.files)}
            />

            {images.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={img.previewUrl} className="relative">
                    <img
                      src={img.previewUrl}
                      alt="preview"
                      className="h-24 w-full rounded object-cover border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs hover:bg-black"
                      disabled={saving}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-white/60 text-sm">Zatiaľ neboli vybrané žiadne fotky.</div>
            )}
          </div>

          <button
            className="w-full rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Ukladám..." : "Uložiť ponuku"}
          </button>

          {status ? <p className="text-white/80">{status}</p> : null}
        </div>
      </form>
    </main>
  );
}