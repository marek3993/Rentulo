"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { adminApiFetch } from "@/lib/adminApiClient";

type Item = {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  category: string | null;
  city: string | null;
  postal_code: string | null;
  is_active: boolean;
};

const CATEGORIES = [
  "Naradie",
  "Zahrada",
  "Stavebne stroje",
  "Auto-moto",
  "Elektronika",
  "Dom a dielna",
  "Sport a volny cas",
  "Ostatne",
];

export default function AdminItemEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);

  const [status, setStatus] = useState("Nacitavam...");
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  const pricePreview = useMemo(() => Number(pricePerDay || 0), [pricePerDay]);

  useEffect(() => {
    const load = async () => {
      if (!Number.isInteger(itemId) || itemId <= 0) {
        setStatus("Neplatne ID inzeratu.");
        return;
      }

      setStatus("Nacitavam...");

      try {
        const response = await adminApiFetch<{ item: Item }>(`/api/admin/items/${itemId}`);
        const loadedItem = response.item;

        setItem(loadedItem);
        setTitle(loadedItem.title ?? "");
        setDescription(loadedItem.description ?? "");
        setPricePerDay(String(loadedItem.price_per_day ?? ""));
        setCategory(loadedItem.category ?? CATEGORIES[0]);
        setCity(loadedItem.city ?? "");
        setPostalCode(loadedItem.postal_code ?? "");
        setIsActive(Boolean(loadedItem.is_active));
        setStatus("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Neznama chyba.";

        if (message === "Missing session." || message === "Unauthorized.") {
          router.replace("/login");
          return;
        }

        if (message === "Forbidden.") {
          router.replace("/");
          return;
        }

        if (message === "Item not found.") {
          setStatus("Inzerat neexistuje.");
          return;
        }

        setStatus("Chyba: " + message);
      }
    };

    void load();
  }, [itemId, router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!item) {
      return;
    }

    setSaving(true);
    setStatus("Ukladam zmeny...");

    try {
      const parsedPrice = Number(pricePerDay);

      if (!title.trim()) throw new Error("Chyba nazov.");
      if (!category.trim()) throw new Error("Chyba kategoria.");
      if (!city.trim()) throw new Error("Chyba mesto.");
      if (!postalCode.trim()) throw new Error("Chyba PSC.");
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw new Error("Neplatna cena za den.");
      }

      await adminApiFetch(`/api/admin/items/${item.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "update_item",
          payload: {
            title: title.trim(),
            description: description.trim(),
            pricePerDay: parsedPrice,
            category: category.trim(),
            city: city.trim(),
            postalCode: postalCode.trim(),
            isActive,
          },
        }),
      });

      setStatus("Admin edit ulozeny.");
      router.push("/admin/items");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Neznama chyba.";
      setStatus("Chyba: " + message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-3xl space-y-6">
      <Link className="inline-flex text-sm text-indigo-300 hover:text-indigo-200" href="/admin/items">
        ← Spat na admin inzeraty
      </Link>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Admin edit inzeratu</h1>
        <p className="mt-2 text-white/70">
          Admin moze upravit iba nazov, popis, cenu, kategoriu, lokalitu a viditelnost.
        </p>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">{status}</div>
      ) : null}

      {item ? (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Zakladne udaje</div>

            <label className="block">
              <div className="mb-1 text-white/80">Nazov *</div>
              <input
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <div className="mb-1 text-white/80">Kategoria *</div>
              <select
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={saving}
              >
                {CATEGORIES.map((option) => (
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
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                disabled={saving}
              />
            </label>

            <label className="block">
              <div className="mb-1 text-white/80">Cena za den (EUR) *</div>
              <input
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={pricePerDay}
                onChange={(event) => setPricePerDay(event.target.value)}
                type="number"
                min="0"
                step="0.5"
                required
                disabled={saving}
              />
              <div className="mt-1 text-sm text-white/60">
                Preview: <strong>{Number.isFinite(pricePreview) ? pricePreview : 0} EUR / den</strong>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                disabled={saving}
              />
              <div>
                <div className="font-medium text-white">Viditelny vo vysledkoch</div>
                <div className="text-sm text-white/60">
                  Ak je vypnute, inzerat zostane mimo public listingu.
                </div>
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
                  onChange={(event) => setCity(event.target.value)}
                  disabled={saving}
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">PSC *</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  disabled={saving}
                  required
                />
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Ulozenie</div>

            <button
              className="w-full rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Ukladam..." : "Ulozit admin zmeny"}
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}
