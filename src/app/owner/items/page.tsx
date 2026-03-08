"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function OwnerItemsPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("Načítavam...");

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

    const { data: imgs } = await supabase
      .from("item_images")
      .select("item_id,path")
      .in("item_id", ids)
      .order("id", { ascending: true });

    const map: Record<number, string> = {};
    for (const im of (imgs ?? []) as any[]) {
      if (!map[im.item_id]) {
        const { data: pub } = supabase.storage.from("item-images").getPublicUrl(im.path);
        map[im.item_id] = pub.publicUrl;
      }
    }

    setImageMap(map);
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

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Moje ponuky</h1>
            <p className="mt-1 text-white/60">
              Tu spravuješ svoje aktívne aj vypnuté ponuky.
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

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Zatiaľ nemáš žiadne ponuky.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              {imageMap[item.id] ? (
                <img
                  src={imageMap[item.id]}
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

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/items/${item.id}`}
                  className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                >
                  Detail
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
          ))}
        </ul>
      )}
    </main>
  );
}