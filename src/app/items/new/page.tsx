"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ITEM_DELIVERY_OPTIONS_DRAFT,
  describeItemDeliveryOptions,
  normalizeItemDeliveryOptionsDraft,
  validateItemDeliveryOptionsDraft,
  type ItemDeliveryOptionsDraft,
} from "@/lib/itemDeliveryOptionsContract";

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    city?: string;
    postcode?: string;
    street?: string;
    housenumber?: string;
    lat?: number;
    lon?: number;
  };
};

const CATEGORIES = [
  "Náradie",
  "Záhrada",
  "Stavebné stroje",
  "Auto-moto",
  "Elektronika",
  "Dom a dielňa",
  "Šport a voľný čas",
  "Ostatné",
];

const MAX_IMAGES = 5;
const PHOTO_REQUIRED_MESSAGE = "Aspoň 1 fotka je povinná.";

export default function NewItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("10");
  const [category, setCategory] = useState("Náradie");

  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [streetAddress, setStreetAddress] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<GeoapifyFeature[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const [images, setImages] = useState<SelectedImage[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<ItemDeliveryOptionsDraft>(
    DEFAULT_ITEM_DELIVERY_OPTIONS_DRAFT
  );
  const [deliveryErrors, setDeliveryErrors] = useState<
    Partial<Record<keyof ItemDeliveryOptionsDraft, string>>
  >({});
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const imagesRef = useRef<SelectedImage[]>([]);
  const dragIndexRef = useRef<number | null>(null);

  const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
    };

    guard();

    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [router]);

  useEffect(() => {
    const q = addressQuery.trim();

    if (!geoKey || q.length < 3) {
      setAddressResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchingAddress(true);

        const url =
          `https://api.geoapify.com/v1/geocode/autocomplete` +
          `?text=${encodeURIComponent(q)}` +
          `&lang=sk` +
          `&limit=5` +
          `&filter=countrycode:sk` +
          `&apiKey=${geoKey}`;

        const res = await fetch(url);
        const json = await res.json();
        setAddressResults(json?.features ?? []);
      } catch {
        setAddressResults([]);
      } finally {
        setSearchingAddress(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [addressQuery, geoKey]);

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

    const remaining = Math.max(MAX_IMAGES - images.length, 0);
    if (remaining <= 0) return;

    const picked = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining);

    if (picked.length === 0) return;

    const next: SelectedImage[] = picked.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotoError("");
    setImages((prev) => [...prev, ...next]);
  };

  const removeImage = (idx: number) => {
    const nextLength = images.length - 1;

    setImages((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });

    setPhotoError(nextLength <= 0 ? PHOTO_REQUIRED_MESSAGE : "");
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setImages((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }

      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      if (!moved) return prev;
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const setPrimaryImage = (idx: number) => {
    moveImage(idx, 0);
  };

  const selectAddress = (feature: GeoapifyFeature) => {
    const properties = feature.properties ?? {};
    const street = [properties.street, properties.housenumber].filter(Boolean).join(" ").trim();

    setAddressQuery(properties.formatted ?? "");
    setStreetAddress(street || properties.formatted || "");
    setCity(properties.city ?? "");
    setPostalCode(properties.postcode ?? "");
    setLatitude(typeof properties.lat === "number" ? properties.lat : null);
    setLongitude(typeof properties.lon === "number" ? properties.lon : null);
    setAddressResults([]);
  };

  const uploadImagesForItem = async (userId: string, itemId: number) => {
    for (let i = 0; i < images.length; i++) {
      const file = images[i].file;
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const filename = `${crypto.randomUUID()}.${safeExt}`;
      const path = `${userId}/${itemId}/${filename}`;

      setStatus(`Nahrávam fotku ${i + 1}/${images.length}...`);

      const { error: upErr } = await supabase.storage
        .from("item-images")
        .upload(path, file, { upsert: false });

      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await supabase.from("item_images").insert({
        item_id: itemId,
        owner_id: userId,
        path,
        position: i,
        is_primary: i === 0,
      });

      if (dbErr) throw new Error(dbErr.message);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (images.length === 0) {
      setPhotoError(PHOTO_REQUIRED_MESSAGE);
      setStatus("Chyba: " + PHOTO_REQUIRED_MESSAGE);
      return;
    }

    setSaving(true);
    setStatus("Ukladám ponuku...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Nie ste prihlásený.");

      if (!title.trim()) throw new Error("Chýba názov.");
      if (!city.trim()) throw new Error("Vyber mesto z adresy.");
      if (!postalCode.trim()) throw new Error("Chýba PSČ.");
      if (!streetAddress.trim()) throw new Error("Chýba ulica a číslo.");
      if (latitude === null || longitude === null) {
        throw new Error("Chýbajú súradnice adresy.");
      }

      const deliveryValidation = validateItemDeliveryOptionsDraft(deliveryOptions);
      if (!deliveryValidation.isValid) {
        setDeliveryErrors(deliveryValidation.errors);
        throw new Error("Skontroluj nastavenie doručenia.");
      }

      setDeliveryErrors({});
      setPhotoError("");
      const normalizedDeliveryOptions = normalizeItemDeliveryOptionsDraft(deliveryOptions);

      await ensureProfile(userId);

      const { data, error } = await supabase.rpc("create_item_with_location", {
        p_owner_id: userId,
        p_title: title.trim(),
        p_description: description.trim() ? description.trim() : null,
        p_price_per_day: Number(pricePerDay),
        p_city: city.trim(),
        p_postal_code: postalCode.trim(),
        p_is_active: true,
        p_street_address: streetAddress.trim(),
        p_latitude: latitude,
        p_longitude: longitude,
      });

      if (error) throw new Error(error.message);

      const itemId = Number(data);
      if (!Number.isFinite(itemId)) throw new Error("Nepodarilo sa vytvoriť ponuku.");

      const { error: categoryErr } = await supabase
        .from("items")
        .update({ category })
        .eq("id", itemId);

      if (categoryErr) throw new Error(categoryErr.message);

      const { error: deliveryErr } = await supabase.rpc("item_delivery_config_update", {
        p_item_id: itemId,
        p_delivery_mode: normalizedDeliveryOptions.mode,
        p_delivery_rate_per_km: normalizedDeliveryOptions.ratePerKm,
        p_delivery_fee_cap: normalizedDeliveryOptions.feeCap,
        p_delivery_max_radius_km: normalizedDeliveryOptions.maxRadiusKm,
      });

      if (deliveryErr) throw new Error(deliveryErr.message);

      if (images.length > 0) {
        await uploadImagesForItem(userId, itemId);
      }

      setStatus("Hotovo ✅");
      router.push(`/items/${itemId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      setStatus("Chyba: " + message);
    } finally {
      setSaving(false);
    }
  };

  const priceNumber = useMemo(() => Number(pricePerDay || 0), [pricePerDay]);
  const deliverySummary = useMemo(
    () => describeItemDeliveryOptions(normalizeItemDeliveryOptionsDraft(deliveryOptions)),
    [deliveryOptions]
  );
  const hasRequiredPhoto = images.length > 0;
  const remainingImageSlots = Math.max(MAX_IMAGES - images.length, 0);
  const canSaveItem = hasRequiredPhoto && !saving;

  const mapSrc =
    latitude !== null && longitude !== null && geoKey
      ? `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=800&height=320&center=lonlat:${longitude},${latitude}&zoom=15&marker=lonlat:${longitude},${latitude};color:%23ff0000;size:medium&apiKey=${geoKey}`
      : null;

  return (
    <main className="max-w-5xl">
      <h1 className="text-2xl font-semibold">Nová ponuka</h1>
      <p className="mt-2 text-white/70">
        Vyplň údaje, vyber adresu cez našeptávač a pridaj fotky. Verejne sa zobrazí len
        mesto a PSČ, nie ulica.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-semibold">Doručenie</div>
            <div className="text-sm text-white/60">
              Nastav len aktuálne dostupné možnosti doručenia pre túto ponuku.
            </div>

            <label className="block">
              <div className="mb-1 text-white/80">Režim</div>
              <select
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={deliveryOptions.mode}
                onChange={(e) => {
                  const nextMode = e.target.value as ItemDeliveryOptionsDraft["mode"];
                  setDeliveryOptions((prev) => ({
                    ...prev,
                    mode: nextMode,
                    ratePerKm: nextMode === "pickup_only" ? "" : prev.ratePerKm,
                    feeCap: nextMode === "pickup_only" ? "" : prev.feeCap,
                    maxRadiusKm: nextMode === "pickup_only" ? "" : prev.maxRadiusKm,
                  }));
                  setDeliveryErrors({});
                }}
                disabled={saving}
              >
                <option value="pickup_only">Osobný odber</option>
                <option value="delivery_available">Doručenie dostupné</option>
              </select>
            </label>

            {deliveryOptions.mode === "delivery_available" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <div className="mb-1 text-white/80">Sadzba za 1 km</div>
                  <input
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    value={deliveryOptions.ratePerKm}
                    onChange={(e) => {
                      setDeliveryOptions((prev) => ({ ...prev, ratePerKm: e.target.value }));
                      setDeliveryErrors((prev) => ({ ...prev, ratePerKm: undefined }));
                    }}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={saving}
                  />
                  {deliveryErrors.ratePerKm ? (
                    <div className="mt-1 text-sm text-red-300">{deliveryErrors.ratePerKm}</div>
                  ) : null}
                </label>

                <label className="block">
                  <div className="mb-1 text-white/80">Cenový strop</div>
                  <input
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    value={deliveryOptions.feeCap}
                    onChange={(e) => {
                      setDeliveryOptions((prev) => ({ ...prev, feeCap: e.target.value }));
                      setDeliveryErrors((prev) => ({ ...prev, feeCap: undefined }));
                    }}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={saving}
                  />
                  {deliveryErrors.feeCap ? (
                    <div className="mt-1 text-sm text-red-300">{deliveryErrors.feeCap}</div>
                  ) : null}
                </label>

                <label className="block">
                  <div className="mb-1 text-white/80">Max. radius (km)</div>
                  <input
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    value={deliveryOptions.maxRadiusKm}
                    onChange={(e) => {
                      setDeliveryOptions((prev) => ({ ...prev, maxRadiusKm: e.target.value }));
                      setDeliveryErrors((prev) => ({ ...prev, maxRadiusKm: undefined }));
                    }}
                    type="number"
                    min="0"
                    step="0.1"
                    disabled={saving}
                  />
                  {deliveryErrors.maxRadiusKm ? (
                    <div className="mt-1 text-sm text-red-300">{deliveryErrors.maxRadiusKm}</div>
                  ) : null}
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="font-semibold">Základné údaje</div>

              <label className="block">
                <div className="mb-1 text-white/80">Názov *</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="napr. Vŕtačka DeWalt 18V"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">Kategória *</div>
                <select
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={saving}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">Popis</div>
                <textarea
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  disabled={saving}
                  placeholder="Stav, príslušenstvo, podmienky prenájmu..."
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
                  Zobrazí sa ako{" "}
                  <strong>{Number.isFinite(priceNumber) ? priceNumber : 0} € / deň</strong>
                </div>
              </label>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="font-semibold">Adresa</div>
              <div className="text-sm text-white/60">
                Presná adresa sa nezobrazuje verejne. Zákazníci uvidia len mesto a PSČ.
              </div>

              <label className="block">
                <div className="mb-1 text-white/80">Vyhľadať adresu *</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  disabled={saving}
                  placeholder="napr. Hlavná 12, Trnava"
                />
              </label>

              {searchingAddress ? (
                <div className="text-sm text-white/60">Hľadám adresu...</div>
              ) : null}

              {addressResults.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {addressResults.map((feature, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectAddress(feature)}
                      className="block w-full border-b border-white/10 bg-black/20 px-4 py-3 text-left hover:bg-white/10 last:border-b-0"
                    >
                      {feature.properties?.formatted ?? "Neznáma adresa"}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-white/80">Mesto</div>
                  <input
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={saving}
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-white/80">PSČ</div>
                  <input
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    disabled={saving}
                  />
                </label>
              </div>

              <label className="block">
                <div className="mb-1 text-white/80">Ulica a číslo (skryté)</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  disabled={saving}
                />
              </label>

              {mapSrc ? (
                <img
                  src={mapSrc}
                  alt="Mapa adresy"
                  className="h-64 w-full rounded-xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/50">
                  Mapa sa zobrazí po výbere adresy.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-semibold">Fotky (max. {MAX_IMAGES})</div>
            <div className="mt-1 text-sm text-white/70">
              Aspoň 1 fotka je povinná. Prvá fotka je hlavná a poradie môžeš meniť
              potiahnutím.
            </div>

            <div
              className={`mt-4 rounded-2xl border border-dashed p-4 transition ${
                hasRequiredPhoto
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-amber-400/50 bg-amber-500/10"
              }`}
            >
              <div className="text-sm font-medium text-white">
                {hasRequiredPhoto
                  ? `Pripravené ${images.length}/${MAX_IMAGES} fotiek`
                  : "Nahraj prvú fotku, bez nej sa ponuka neuloží"}
              </div>
              <div className="mt-1 text-sm text-white/70">
                {remainingImageSlots > 0
                  ? `Pridať môžeš ešte ${remainingImageSlots} ${
                      remainingImageSlots === 1
                        ? "fotku"
                        : remainingImageSlots < 5
                          ? "fotky"
                          : "fotiek"
                    }.`
                  : "Dosiahol si limit fotiek pre túto ponuku."}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-4 transition ${
                    saving || images.length >= MAX_IMAGES
                      ? "pointer-events-none border-white/10 bg-white/5 text-white/35"
                      : "border-white/20 bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.12)] hover:bg-white/90"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={saving || images.length >= MAX_IMAGES}
                    onChange={(e) => {
                      onPickImages(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span className="text-base font-semibold">Nahrať z galérie</span>
                  <span className="mt-1 text-sm opacity-75">
                    Vyber viac fotiek naraz zo zariadenia.
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-4 transition ${
                    saving || images.length >= MAX_IMAGES
                      ? "pointer-events-none border-white/10 bg-white/5 text-white/35"
                      : "border-white/15 bg-black/30 text-white hover:bg-black/40"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={saving || images.length >= MAX_IMAGES}
                    onChange={(e) => {
                      onPickImages(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span className="text-base font-semibold">Odfotiť mobilom</span>
                  <span className="mt-1 text-sm text-white/65">
                    Otvorí kameru na rýchle pridanie aktuálnej fotky.
                  </span>
                </label>
              </div>
            </div>

            <div
              className={`mt-4 rounded-xl border p-3 text-sm ${
                hasRequiredPhoto
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
              }`}
            >
              {hasRequiredPhoto
                ? "Fotka je povinná a podmienka je splnená."
                : PHOTO_REQUIRED_MESSAGE}
            </div>

            {images.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable={!saving}
                    onDragStart={() => {
                      dragIndexRef.current = idx;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={() => {
                      const fromIndex = dragIndexRef.current;
                      dragIndexRef.current = null;
                      if (fromIndex === null) return;
                      moveImage(fromIndex, idx);
                    }}
                    className={`relative overflow-hidden rounded-xl border ${
                      idx === 0 ? "border-indigo-400" : "border-white/10"
                    } bg-black/20`}
                  >
                    <img
                      src={img.previewUrl}
                      alt={`preview ${idx + 1}`}
                      className="h-28 w-full object-cover"
                    />

                    <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                      {idx === 0 ? "Hlavná" : `#${idx + 1}`}
                    </div>

                    <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                      Potiahni
                    </div>

                    <div className="absolute right-2 top-2 flex gap-1">
                      {idx !== 0 ? (
                        <button
                          type="button"
                          onClick={() => setPrimaryImage(idx)}
                          className="rounded bg-indigo-600/90 px-2 py-1 text-[11px] text-white hover:bg-indigo-500"
                          disabled={saving}
                        >
                          Nastaviť hlavnú
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="rounded bg-black/70 px-2 py-1 text-[11px] text-white hover:bg-black"
                        disabled={saving}
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-white/60">Zatiaľ si nevybral žiadne fotky.</div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-semibold">Zhrnutie</div>

            <div className="text-sm text-white/70">
              <div>Názov: <strong className="text-white">{title || "-"}</strong></div>
              <div>Kategória: <strong className="text-white">{category || "-"}</strong></div>
              <div>Mesto: <strong className="text-white">{city || "-"}</strong></div>
              <div>PSČ: <strong className="text-white">{postalCode || "-"}</strong></div>
              <div>Cena: <strong className="text-white">{pricePerDay || "0"} € / deň</strong></div>
              <div>Doručenie: <strong className="text-white">{deliverySummary.title}</strong></div>
              {deliverySummary.detailRows.map((row) => (
                <div key={row.label}>
                  {row.label}: <strong className="text-white">{row.value}</strong>
                </div>
              ))}
              <div>Fotky: <strong className="text-white">{images.length}</strong></div>
              <div>Hlavná: <strong className="text-white">{images[0]?.file.name ?? "-"}</strong></div>
            </div>

            <button
              className={`w-full rounded-xl px-4 py-3 font-semibold transition ${
                canSaveItem
                  ? "bg-white text-black shadow-[0_14px_34px_rgba(255,255,255,0.2)] hover:bg-white/90"
                  : "cursor-not-allowed border border-white/10 bg-white/10 text-white/45"
              }`}
              disabled={!canSaveItem}
            >
              {saving ? "Ukladám..." : hasRequiredPhoto ? "Uložiť ponuku" : "Nahraj aspoň 1 fotku"}
            </button>

            {status ? <p className="text-white/80">{status}</p> : null}
          </div>
        </div>
      </form>
    </main>
  );
}
