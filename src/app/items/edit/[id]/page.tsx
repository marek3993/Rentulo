"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  category: string | null;
  city: string | null;
  postal_code: string | null;
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
        .select("id,owner_id,title,description,price_per_day,category,city,postal_code")
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

      router.push(`/items/${item.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba.";
      setStatus("Chyba: " + message);
    } finally {
      setSaving(false);
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
          Upravuješ existujúcu ponuku. Fotky zostávajú mimo tohto P0 route a spravujú sa v sekcii moje
          ponuky.
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

            {status && pageState !== "loading" ? <p className="text-white/80">{status}</p> : null}
          </div>
        </form>
      ) : null}
    </main>
  );
}
