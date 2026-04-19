  "use client";

  import Link from "next/link";
  import { useEffect, useMemo, useState } from "react";
  import { supabase } from "@/lib/supabaseClient";
  import { useRouter } from "next/navigation";

  type Item = {
    id: number;
    owner_id: string;
    title: string;
    description: string | null;
    price_per_day: number;
    city: string | null;
    is_active: boolean;
  };

  type ItemImageRow = {
    id: number;
    item_id: number;
    path: string;
    is_primary: boolean | null;
    position: number | null;
  };

  type ItemImageView = {
    id: number;
    item_id: number;
    path: string;
    is_primary: boolean | null;
    position: number | null;
    publicUrl: string;
  };

  const getImagePositionValue = (position: number | null, fallbackIndex: number) => {
    const parsed = Number(position);
    return Number.isFinite(parsed) ? parsed : fallbackIndex;
  };

  const sortItemImages = <T extends { id: number; is_primary: boolean | null; position: number | null }>(
    images: T[]
  ) =>
    [...images].sort((a, b) => {
      if (!!a.is_primary !== !!b.is_primary) {
        return a.is_primary ? -1 : 1;
      }

      const aPosition = getImagePositionValue(a.position, Number.MAX_SAFE_INTEGER);
      const bPosition = getImagePositionValue(b.position, Number.MAX_SAFE_INTEGER);

      if (aPosition !== bPosition) {
        return aPosition - bPosition;
      }

      return a.id - b.id;
    });

  export default function OwnerItemsPage() {
    const router = useRouter();

    const [items, setItems] = useState<Item[]>([]);
    const [imageMap, setImageMap] = useState<Record<number, ItemImageView[]>>({});
    const [status, setStatus] = useState("Načítavam...");

    const [q, setQ] = useState("");
    const [cityFilter, setCityFilter] = useState("");
    const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">("all");

    const [uploadingForItemId, setUploadingForItemId] = useState<number | null>(null);
    const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
    const [settingPrimaryImageId, setSettingPrimaryImageId] = useState<number | null>(null);
    const [reorderingImageId, setReorderingImageId] = useState<number | null>(null);

    const filtered = useMemo(() => {
      let out = [...items];

      const qText = q.trim().toLowerCase();
      if (qText) {
        out = out.filter((i) => i.title.toLowerCase().includes(qText));
      }

      const cityText = cityFilter.trim().toLowerCase();
      if (cityText) {
        out = out.filter((i) => (i.city ?? "").toLowerCase().includes(cityText));
      }

      if (stateFilter === "active") {
        out = out.filter((i) => i.is_active);
      }

      if (stateFilter === "inactive") {
        out = out.filter((i) => !i.is_active);
      }

      return out;
    }, [items, q, cityFilter, stateFilter]);

    const activeCount = useMemo(() => items.filter((i) => i.is_active).length, [items]);
    const inactiveCount = useMemo(() => items.filter((i) => !i.is_active).length, [items]);

    const load = async () => {
      setStatus("Načítavam...");

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select("id,owner_id,title,description,price_per_day,city,is_active")
        .eq("owner_id", userId)
        .order("id", { ascending: false });

      if (error) {
        setStatus("Chyba: " + error.message);
        return;
      }

      const rows = (data ?? []) as Item[];
      setItems(rows);

      const ids = rows.map((x) => x.id);
      if (ids.length === 0) {
        setImageMap({});
        setStatus("");
        return;
      }

      const { data: imgs, error: imgsError } = await supabase
        .from("item_images")
        .select("id,item_id,path,is_primary,position")
        .in("item_id", ids)
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true })
        .order("id", { ascending: true });

      if (imgsError) {
        setStatus("Chyba: " + imgsError.message);
        return;
      }

      const nextMap: Record<number, ItemImageView[]> = {};

      for (const im of (imgs ?? []) as ItemImageRow[]) {
        const { data: pub } = supabase.storage.from("item-images").getPublicUrl(im.path);

        if (!nextMap[im.item_id]) {
          nextMap[im.item_id] = [];
        }

        nextMap[im.item_id].push({
          id: im.id,
          item_id: im.item_id,
          path: im.path,
          is_primary: im.is_primary,
          position: im.position,
          publicUrl: pub.publicUrl,
        });
      }

      for (const itemId of Object.keys(nextMap)) {
        const numericItemId = Number(itemId);
        nextMap[numericItemId] = sortItemImages(nextMap[numericItemId]);
      }

      setImageMap(nextMap);
      setStatus("");
    };

    useEffect(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleActive = async (id: number, nextValue: boolean) => {
      setStatus("Ukladám...");

      const { error } = await supabase
        .from("items")
        .update({ is_active: nextValue })
        .eq("id", id);

      if (error) {
        setStatus("Chyba: " + error.message);
        return;
      }

      await load();
    };

    const uploadImages = async (itemId: number, files: FileList | null) => {
      if (!files || files.length === 0) return;

      setUploadingForItemId(itemId);
      setStatus("Nahrávam fotky...");

      try {
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user.id;

        if (!userId) {
          router.push("/login");
          return;
        }

        const currentImages = imageMap[itemId] ?? [];
        const shouldMakeFirstPrimary = currentImages.length === 0;
        const nextBasePosition =
          currentImages.reduce(
            (maxPosition, image, index) =>
              Math.max(maxPosition, getImagePositionValue(image.position, index)),
            -1
          ) + 1;

        let uploadedIndex = 0;

        for (const file of Array.from(files)) {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
          const filePath = `${itemId}/${crypto.randomUUID()}.${safeExt}`;

          const { error: uploadError } = await supabase.storage
            .from("item-images")
            .upload(filePath, file, {
              upsert: false,
              contentType: file.type || "image/jpeg",
              cacheControl: "3600",
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          const { error: insertError } = await supabase
            .from("item_images")
            .insert({
              item_id: itemId,
              owner_id: userId,
              path: filePath,
              position: nextBasePosition + uploadedIndex,
              is_primary: shouldMakeFirstPrimary && uploadedIndex === 0,
            });

          if (insertError) {
            throw new Error(insertError.message);
          }

          uploadedIndex += 1;
        }

        setStatus("Fotky nahraté ✅");
        await load();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "upload zlyhal";
        setStatus("Chyba: " + message);
      } finally {
        setUploadingForItemId(null);
      }
    };

    const setPrimaryImage = async (itemId: number, imageId: number) => {
      setSettingPrimaryImageId(imageId);
      setStatus("Nastavujem hlavnú fotku...");

      try {
        const currentImages = imageMap[itemId] ?? [];

        for (const img of currentImages) {
          const { error } = await supabase
            .from("item_images")
            .update({ is_primary: img.id === imageId })
            .eq("id", img.id);

          if (error) {
            throw new Error(error.message);
          }
        }

        setStatus("Hlavná fotka uložená ✅");
        await load();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "uloženie zlyhalo";
        setStatus("Chyba: " + message);
      } finally {
        setSettingPrimaryImageId(null);
      }
    };

    const reorderImage = async (itemId: number, imageId: number, direction: "left" | "right") => {
      const currentImages = sortItemImages(imageMap[itemId] ?? []);
      const currentIndex = currentImages.findIndex((image) => image.id === imageId);

      if (currentIndex === -1) {
        return;
      }

      const firstMovableIndex = currentImages[0]?.is_primary ? 1 : 0;
      if (currentIndex < firstMovableIndex) {
        return;
      }

      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < firstMovableIndex || targetIndex >= currentImages.length) {
        return;
      }

      const reorderedImages = [...currentImages];
      const [movedImage] = reorderedImages.splice(currentIndex, 1);

      if (!movedImage) {
        return;
      }

      reorderedImages.splice(targetIndex, 0, movedImage);

      setReorderingImageId(imageId);
      setStatus(direction === "left" ? "Posúvam fotku vľavo..." : "Posúvam fotku vpravo...");

      try {
        for (let index = 0; index < reorderedImages.length; index += 1) {
          const { error } = await supabase
            .from("item_images")
            .update({ position: index })
            .eq("id", reorderedImages[index].id);

          if (error) {
            throw new Error(error.message);
          }
        }

        setStatus("Poradie fotiek uložené ✅");
        await load();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "zmena poradia zlyhala";
        setStatus("Chyba: " + message);
      } finally {
        setReorderingImageId(null);
      }
    };

    const deleteImage = async (itemId: number, imageId: number, path: string) => {
      const ok = window.confirm("Naozaj chceš vymazať túto fotku?");
      if (!ok) return;

      setDeletingImageId(imageId);
      setStatus("Mažem fotku...");

      try {
        const currentImages = imageMap[itemId] ?? [];
        const imageToDelete = currentImages.find((x) => x.id === imageId);

        const { error: dbError } = await supabase
          .from("item_images")
          .delete()
          .eq("id", imageId);

        if (dbError) {
          throw new Error(dbError.message);
        }

        const { error: storageError } = await supabase.storage
          .from("item-images")
          .remove([path]);

        if (storageError) {
          throw new Error(storageError.message);
        }

        if (imageToDelete?.is_primary) {
          const remaining = currentImages.filter((x) => x.id !== imageId);
          if (remaining.length > 0) {
            const { error: promoteError } = await supabase
              .from("item_images")
              .update({ is_primary: true })
              .eq("id", remaining[0].id);

            if (promoteError) {
              throw new Error(promoteError.message);
            }
          }
        }

        setStatus("Fotka vymazaná ✅");
        await load();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "mazanie zlyhalo";
        setStatus("Chyba: " + message);
      } finally {
        setDeletingImageId(null);
      }
    };

    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Moje ponuky</h1>
              <p className="mt-1 text-white/60">
                Správa vlastných ponúk, ich viditeľnosti, rezervácií a fotiek.
              </p>
            </div>

            <Link
              className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
              href="/items/new"
            >
              Pridať novú ponuku
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">Aktívne</div>
            <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
            <div className="mt-1 text-sm text-white/50">Viditeľné pre zákazníkov</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">Vypnuté</div>
            <div className="mt-2 text-3xl font-semibold">{inactiveCount}</div>
            <div className="mt-1 text-sm text-white/50">Skryté z ponúk</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/60">Spolu</div>
            <div className="mt-2 text-3xl font-semibold">{items.length}</div>
            <div className="mt-1 text-sm text-white/50">Všetky tvoje ponuky</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Filtrovanie</h2>
          <p className="mt-1 text-sm text-white/60">
            Vyhľadaj ponuku podľa názvu, mesta alebo stavu.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-sm text-white/70">Názov</div>
              <input
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                placeholder="napr. Hilti"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 text-sm text-white/70">Mesto</div>
              <input
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                placeholder="napr. Trnava"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 text-sm text-white/70">Stav</div>
              <select
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as "all" | "active" | "inactive")}
              >
                <option value="all">Všetky</option>
                <option value="active">Aktívne</option>
                <option value="inactive">Vypnuté</option>
              </select>
            </div>
          </div>
        </div>

        {status ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
            Žiadne ponuky podľa aktuálnych filtrov.
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {filtered.map((item) => {
              const images = imageMap[item.id] ?? [];
              const cover = images.find((x) => x.is_primary) ?? images[0];

              return (
                <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  {cover ? (
                    <img
                      src={cover.publicUrl}
                      alt={item.title}
                      className="mb-3 h-44 w-full rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="mb-3 h-44 w-full rounded-xl border border-white/10 bg-white/5" />
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{item.title}</div>
                      <div className="mt-1 text-white/80">
                        {item.price_per_day} € <span className="text-white/60">/ deň</span>
                        {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        item.is_active
                          ? "bg-green-600/90 text-white"
                          : "bg-red-600/90 text-white"
                      }`}
                    >
                      {item.is_active ? "Aktívna" : "Vypnutá"}
                    </span>
                  </div>

                  {item.description ? (
                    <div className="mt-3 line-clamp-2 text-white/70">{item.description}</div>
                  ) : (
                    <div className="mt-3 text-white/50">Bez popisu</div>
                  )}

                  <div className="mt-4">
                    <div className="mb-2 text-sm text-white/70">Fotky</div>

                    {images.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/50">
                        Zatiaľ bez fotiek.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {images.map((img, index) => {
                          const firstMovableIndex = images[0]?.is_primary ? 1 : 0;
                          const canMoveLeft = index > firstMovableIndex;
                          const canMoveRight =
                            index >= firstMovableIndex && index < images.length - 1;

                          return (
                            <div
                              key={img.id}
                              className="rounded-xl border border-white/10 bg-black/20 p-2"
                            >
                              <img
                                src={img.publicUrl}
                                alt="fotka ponuky"
                                className="h-24 w-full rounded-lg object-cover"
                              />

                              <div className="mt-2 flex flex-wrap gap-2">
                                {img.is_primary ? (
                                  <span className="rounded-full bg-green-600/90 px-2 py-1 text-xs text-white">
                                    Hlavná
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-xs text-white/70 hover:text-white disabled:opacity-50"
                                    disabled={settingPrimaryImageId === img.id}
                                    onClick={() => setPrimaryImage(item.id, img.id)}
                                  >
                                    {settingPrimaryImageId === img.id
                                      ? "Ukladám..."
                                      : "Nastaviť ako hlavnú"}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="text-xs text-white/70 hover:text-white disabled:opacity-50"
                                  disabled={reorderingImageId !== null || !canMoveLeft}
                                  onClick={() => reorderImage(item.id, img.id, "left")}
                                >
                                  {reorderingImageId === img.id ? "Ukladám..." : "Posunúť vľavo"}
                                </button>

                                <button
                                  type="button"
                                  className="text-xs text-white/70 hover:text-white disabled:opacity-50"
                                  disabled={reorderingImageId !== null || !canMoveRight}
                                  onClick={() => reorderImage(item.id, img.id, "right")}
                                >
                                  {reorderingImageId === img.id ? "Ukladám..." : "Posunúť vpravo"}
                                </button>

                                <button
                                  type="button"
                                  className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                                  disabled={deletingImageId === img.id}
                                  onClick={() => deleteImage(item.id, img.id, img.path)}
                                >
                                  {deletingImageId === img.id ? "Mažem..." : "Vymazať"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3">
                      <input
                        id={`upload-${item.id}`}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => uploadImages(item.id, e.target.files)}
                      />

                      <label
                        htmlFor={`upload-${item.id}`}
                        className={`inline-flex cursor-pointer rounded border border-white/15 px-4 py-2 hover:bg-white/10 ${
                          uploadingForItemId === item.id ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        {uploadingForItemId === item.id ? "Nahrávam..." : "Pridať fotky"}
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/items/${item.id}`}
                      className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Detail
                    </Link>

                    <Link
                      href={`/items/edit/${item.id}`}
                      className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Upraviť
                    </Link>

                    <Link
                      href={`/owner/reservations?item_id=${item.id}`}
                      className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Rezervácie
                    </Link>

                    {item.is_active ? (
                      <button
                        className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                        onClick={() => toggleActive(item.id, false)}
                        type="button"
                      >
                        Vypnúť
                      </button>
                    ) : (
                      <button
                        className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                        onClick={() => toggleActive(item.id, true)}
                        type="button"
                      >
                        Zapnúť
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    );
  }
