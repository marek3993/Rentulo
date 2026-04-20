"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DEFAULT_ITEM_DELIVERY_OPTIONS_DRAFT,
  describeItemDeliveryOptions,
  itemDeliveryOptionsDraftFromFields,
  normalizeItemDeliveryOptionsDraft,
  validateItemDeliveryOptionsDraft,
  type ItemDeliveryConfigFields,
  type ItemDeliveryOptionsDraft,
} from "@/lib/itemDeliveryOptionsContract";
import { supabase } from "@/lib/supabaseClient";

type Item = ItemDeliveryConfigFields & {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  category: string | null;
  city: string | null;
  postal_code: string | null;
};

type BlockedRange = {
  id: number;
  date_from: string;
  date_to: string;
};

type PageState = "loading" | "ready" | "not-found" | "forbidden";

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

function formatDate(dateStr: string) {
  const value = new Date(dateStr);
  if (Number.isNaN(value.getTime())) return dateStr;
  return value.toLocaleDateString("sk-SK");
}

export default function EditItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [item, setItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Načítavam ponuku...");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [deliveryOptions, setDeliveryOptions] = useState<ItemDeliveryOptionsDraft>(
    DEFAULT_ITEM_DELIVERY_OPTIONS_DRAFT
  );
  const [deliveryErrors, setDeliveryErrors] = useState<
    Partial<Record<keyof ItemDeliveryOptionsDraft, string>>
  >({});
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
  const [blockedDateFrom, setBlockedDateFrom] = useState("");
  const [blockedDateTo, setBlockedDateTo] = useState("");
  const [blockedRangesBusy, setBlockedRangesBusy] = useState(false);
  const [blockedRangesStatus, setBlockedRangesStatus] = useState("");

  const loadBlockedRanges = async (targetItemId: number) => {
    const { data, error } = await supabase
      .from("item_blocked_ranges")
      .select("id,date_from,date_to")
      .eq("item_id", targetItemId)
      .order("date_from", { ascending: true })
      .order("date_to", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    setBlockedRanges((data ?? []) as BlockedRange[]);
  };

  useEffect(() => {
    const loadItem = async () => {
      if (!Number.isFinite(itemId)) {
        setPageState("not-found");
        setStatus("");
        return;
      }

      setPageState("loading");
      setStatus("Načítavam ponuku...");

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select(
          "id,owner_id,title,description,price_per_day,category,city,postal_code,delivery_mode,delivery_rate_per_km,delivery_fee_cap,delivery_max_radius_km"
        )
        .eq("id", itemId)
        .maybeSingle();

      if (error) {
        setStatus("Chyba: " + error.message);
        setPageState("loading");
        return;
      }

      if (!data) {
        setItem(null);
        setPageState("not-found");
        setStatus("");
        return;
      }

      const nextItem = data as Item;

      if (nextItem.owner_id !== userId) {
        setItem(nextItem);
        setPageState("forbidden");
        setStatus("");
        return;
      }

      setItem(nextItem);
      setTitle(nextItem.title ?? "");
      setDescription(nextItem.description ?? "");
      setPricePerDay(String(nextItem.price_per_day ?? ""));
      setCategory(nextItem.category ?? CATEGORIES[0]);
      setCity(nextItem.city ?? "");
      setPostalCode(nextItem.postal_code ?? "");
      setDeliveryOptions(itemDeliveryOptionsDraftFromFields(nextItem));
      setDeliveryErrors({});
      await loadBlockedRanges(nextItem.id);
      setBlockedRangesStatus("");
      setPageState("ready");
      setStatus("");
    };

    loadItem();
  }, [itemId, router]);

  const categoryOptions = useMemo(() => {
    if (category && !CATEGORIES.includes(category)) {
      return [category, ...CATEGORIES];
    }

    return CATEGORIES;
  }, [category]);

  const pricePreview = useMemo(() => Number(pricePerDay || 0), [pricePerDay]);
  const deliverySummary = useMemo(
    () => describeItemDeliveryOptions(normalizeItemDeliveryOptionsDraft(deliveryOptions)),
    [deliveryOptions]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item) return;

    setSaving(true);
    setStatus("Ukladám zmeny...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        router.replace("/login");
        return;
      }

      const parsedPrice = Number(pricePerDay);

      if (!title.trim()) throw new Error("Chýba názov.");
      if (!category.trim()) throw new Error("Chýba kategória.");
      if (!city.trim()) throw new Error("Chýba mesto.");
      if (!postalCode.trim()) throw new Error("Chýba PSČ.");
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw new Error("Neplatná cena za deň.");
      }

      const deliveryValidation = validateItemDeliveryOptionsDraft(deliveryOptions);
      if (!deliveryValidation.isValid) {
        setDeliveryErrors(deliveryValidation.errors);
        throw new Error("Skontroluj nastavenie doručenia.");
      }

      setDeliveryErrors({});
      const normalizedDeliveryOptions = normalizeItemDeliveryOptionsDraft(deliveryOptions);

      const { data, error } = await supabase
        .from("items")
        .update({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          price_per_day: parsedPrice,
          category: category.trim(),
          city: city.trim(),
          postal_code: postalCode.trim(),
        })
        .eq("id", item.id)
        .eq("owner_id", userId)
        .select("id")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Ponuku sa nepodarilo uložiť.");

      const { error: deliveryError } = await supabase.rpc("item_delivery_config_update", {
        p_item_id: item.id,
        p_delivery_mode: normalizedDeliveryOptions.mode,
        p_delivery_rate_per_km: normalizedDeliveryOptions.ratePerKm,
        p_delivery_fee_cap: normalizedDeliveryOptions.feeCap,
        p_delivery_max_radius_km: normalizedDeliveryOptions.maxRadiusKm,
      });

      if (deliveryError) throw new Error(deliveryError.message);

      router.push(`/items/${item.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba.";
      setStatus("Chyba: " + message);
    } finally {
      setSaving(false);
    }
  };

  const addBlockedRange = async () => {
    if (!item) return;

    if (!blockedDateFrom || !blockedDateTo) {
      setBlockedRangesStatus("Vyber dátum od aj do.");
      return;
    }

    if (blockedDateFrom > blockedDateTo) {
      setBlockedRangesStatus("Dátum od musí byť menší alebo rovný dátumu do.");
      return;
    }

    setBlockedRangesBusy(true);
    setBlockedRangesStatus("Ukladám blokovaný termín...");

    try {
      const { error } = await supabase.rpc("item_blocked_range_create", {
        p_item_id: item.id,
        p_date_from: blockedDateFrom,
        p_date_to: blockedDateTo,
      });

      if (error) throw new Error(error.message);

      await loadBlockedRanges(item.id);
      setBlockedDateFrom("");
      setBlockedDateTo("");
      setBlockedRangesStatus("Blokovaný termín bol uložený.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba.";
      setBlockedRangesStatus("Chyba: " + message);
    } finally {
      setBlockedRangesBusy(false);
    }
  };

  const deleteBlockedRange = async (blockedRangeId: number) => {
    if (!item) return;

    setBlockedRangesBusy(true);
    setBlockedRangesStatus("Mažem blokovaný termín...");

    try {
      const { error } = await supabase.rpc("item_blocked_range_delete", {
        p_blocked_range_id: blockedRangeId,
      });

      if (error) throw new Error(error.message);

      await loadBlockedRanges(item.id);
      setBlockedRangesStatus("Blokovaný termín bol odstránený.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba.";
      setBlockedRangesStatus("Chyba: " + message);
    } finally {
      setBlockedRangesBusy(false);
    }
  };

  if (pageState === "not-found") {
    return (
      <main className="space-y-4">
        <Link className="inline-flex text-sm text-indigo-300 hover:text-indigo-200" href="/owner/items">
          ← Späť na moje ponuky
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold">Úprava ponuky</h1>
          <p className="mt-2 text-white/70">Táto ponuka neexistuje alebo už nie je dostupná.</p>
        </div>
      </main>
    );
  }

  if (pageState === "forbidden") {
    return (
      <main className="space-y-4">
        <Link className="inline-flex text-sm text-indigo-300 hover:text-indigo-200" href="/owner/items">
          ← Späť na moje ponuky
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold">Úprava ponuky</h1>
          <p className="mt-2 text-white/70">Túto ponuku môže upraviť iba jej vlastník.</p>
          {item ? (
            <Link
              href={`/items/${item.id}`}
              className="mt-4 inline-flex rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            >
              Otvoriť detail ponuky
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl space-y-6">
      <Link className="inline-flex text-sm text-indigo-300 hover:text-indigo-200" href="/owner/items">
        ← Späť na moje ponuky
      </Link>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Úprava ponuky</h1>
        <p className="mt-2 text-white/70">
          Upravuješ existujúcu ponuku. Fotky zostávajú mimo tohto P0 route a spravujú sa v
          sekcii moje ponuky.
        </p>
      </div>

      {status && pageState === "loading" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">{status}</div>
      ) : null}

      {pageState === "ready" ? (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
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
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
                Zobrazí sa ako <strong>{Number.isFinite(pricePreview) ? pricePreview : 0} € / deň</strong>
              </div>
            </label>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Lokalita</div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-white/80">Mesto *</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={saving}
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">PSČ *</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  disabled={saving}
                  required
                />
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Doručenie</div>
            <div className="text-sm text-white/70">
              Uprav len aktuálne dostupné možnosti doručenia pre túto ponuku.
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
              <div className="grid gap-4 md:grid-cols-3">
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

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <div className="font-medium text-white">Súhrn doručenia: {deliverySummary.title}</div>
              <div className="mt-1">{deliverySummary.summary}</div>
              {deliverySummary.detailRows.map((row) => (
                <div key={row.label} className="mt-2">
                  {row.label}: <strong className="text-white">{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Blokované termíny</div>
            <div className="text-sm text-white/70">
              Tieto termíny blokujú novú rezerváciu, ale samy o sebe nevytvárajú rezerváciu.
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <div className="mb-1 text-white/80">Dátum od</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  type="date"
                  value={blockedDateFrom}
                  onChange={(e) => setBlockedDateFrom(e.target.value)}
                  disabled={saving || blockedRangesBusy}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">Dátum do</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  type="date"
                  value={blockedDateTo}
                  min={blockedDateFrom || undefined}
                  onChange={(e) => setBlockedDateTo(e.target.value)}
                  disabled={saving || blockedRangesBusy}
                />
              </label>

              <button
                type="button"
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50 md:self-end"
                onClick={addBlockedRange}
                disabled={saving || blockedRangesBusy}
              >
                {blockedRangesBusy ? "Ukladám..." : "Pridať termín"}
              </button>
            </div>

            {blockedRangesStatus ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
                {blockedRangesStatus}
              </div>
            ) : null}

            {blockedRanges.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/60">
                Zatiaľ bez blokovaných termínov.
              </div>
            ) : (
              <div className="space-y-3">
                {blockedRanges.map((range) => (
                  <div
                    key={range.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="text-sm text-white/80">
                      <strong className="text-white">{formatDate(range.date_from)}</strong>
                      {" "}–{" "}
                      <strong className="text-white">{formatDate(range.date_to)}</strong>
                    </div>

                    <button
                      type="button"
                      className="rounded border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                      onClick={() => deleteBlockedRange(range.id)}
                      disabled={saving || blockedRangesBusy}
                    >
                      Odstrániť
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Uloženie</div>
            <div className="text-sm text-white/70">
              Tento P0 edit route upravuje len potvrdené textové a cenové údaje ponuky.
            </div>

            <button
              className="w-full rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Ukladám..." : "Uložiť zmeny"}
            </button>

            {status ? <p className="text-white/80">{status}</p> : null}
          </div>
        </form>
      ) : null}
    </main>
  );
}
