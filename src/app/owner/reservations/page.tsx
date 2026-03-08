"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { KpiCard, Notice, Pagination, Section, SelectField, TextField } from "@/components/owner/OwnerUI";
import { OwnerReservationCard, type OwnerItemMeta, type OwnerReservationRow } from "@/components/owner/OwnerReservationCard";

type ItemRow = {
  id: number;
  title: string;
  city: string | null;
  price_per_day: number;
  is_active: boolean;
};

const PAGE_SIZE = 10;

export default function OwnerReservationsPage() {
  const router = useRouter();

  const [presetReservationId, setPresetReservationId] = useState("");
  const [presetItemId, setPresetItemId] = useState("");

  const [status, setStatus] = useState("Načítavam…");

  const [itemsMap, setItemsMap] = useState<Record<number, OwnerItemMeta>>({});
  const [ownerItemIds, setOwnerItemIds] = useState<number[]>([]);

  const [rows, setRows] = useState<OwnerReservationRow[]>([]);
  const [total, setTotal] = useState(0);

  const [pendingCount, setPendingCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  const [page, setPage] = useState(1);

  const [q, setQ] = useState("");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");

  const itemOptions = useMemo(() => {
    const opts = Object.entries(itemsMap)
      .map(([id, meta]) => ({ id: Number(id), label: meta.title ?? `Ponuka #${id}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "sk"));
    return [{ value: "all", label: "Všetky ponuky" }, ...opts.map((o) => ({ value: String(o.id), label: o.label }))];
  }, [itemsMap]);

  const clearFilters = () => {
    setQ("");
    setItemFilter("all");
    setStatusFilter("all");
    setPaymentFilter("all");
    setSort("newest");
    setPage(1);
  };

  const loadOwnerItems = async (userId: string) => {
    const { data, error } = await supabase
      .from("items")
      .select("id,title,city,price_per_day,is_active")
      .eq("owner_id", userId)
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);

    const items = (data ?? []) as ItemRow[];
    const ids = items.map((i) => i.id);
    setOwnerItemIds(ids);

    const metaMap: Record<number, OwnerItemMeta> = {};
    for (const it of items) {
      metaMap[it.id] = {
        title: it.title,
        city: it.city,
        price_per_day: it.price_per_day,
        imageUrl: null,
      };
    }

    if (ids.length > 0) {
      const { data: imgs } = await supabase
        .from("item_images")
        .select("item_id,path")
        .in("item_id", ids)
        .order("id", { ascending: true });

      const firstImage: Record<number, string> = {};
      for (const im of (imgs ?? []) as any[]) {
        if (!firstImage[im.item_id]) {
          firstImage[im.item_id] =
            supabase.storage.from("item-images").getPublicUrl(im.path).data.publicUrl;
        }
      }

      for (const id of ids) {
        if (firstImage[id]) metaMap[id].imageUrl = firstImage[id];
      }
    }

    setItemsMap(metaMap);
  };

  const loadCounts = async (itemIds: number[]) => {
    if (itemIds.length === 0) {
      setPendingCount(0);
      setConfirmedCount(0);
      setCancelledCount(0);
      return;
    }

    const countFor = async (st: string) => {
      const { count, error } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .in("item_id", itemIds)
        .eq("status", st);

      if (error) throw new Error(error.message);
      return count ?? 0;
    };

    const [p, c, x] = await Promise.all([countFor("pending"), countFor("confirmed"), countFor("cancelled")]);
    setPendingCount(p);
    setConfirmedCount(c);
    setCancelledCount(x);
  };

  const loadReservations = async () => {
    // scope by owner items (security + correctness)
    let scopedItemIds = ownerItemIds;

    if (itemFilter !== "all") {
      const id = Number(itemFilter);
      scopedItemIds = Number.isFinite(id) ? [id] : [];
    }

    const queryText = q.trim();
    const isNumeric = /^\d+$/.test(queryText);

    // Search by item title/city (client-side → convert to itemId scope)
    if (queryText && !isNumeric && scopedItemIds.length > 0) {
      const needle = queryText.toLowerCase();
      const matched = scopedItemIds.filter((id) => {
        const meta = itemsMap[id];
        const title = (meta?.title ?? "").toLowerCase();
        const city = (meta?.city ?? "").toLowerCase();
        return title.includes(needle) || city.includes(needle);
      });

      // If it matches no item title/city, we still allow searching by renter_id substring:
      // (keeps UX flexible). If you prefer strict search, return empty here.
      if (matched.length > 0) scopedItemIds = matched;
    }

    if (scopedItemIds.length === 0) {
      setRows([]);
      setTotal(0);
      setStatus("");
      return;
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let req = supabase
      .from("reservations")
      .select("id,item_id,renter_id,date_from,date_to,status,payment_status,payment_provider", {
        count: "exact",
      })
      .in("item_id", scopedItemIds);

    if (statusFilter !== "all") req = req.eq("status", statusFilter);
    if (paymentFilter !== "all") req = req.eq("payment_status", paymentFilter);

    if (queryText) {
      if (isNumeric) req = req.eq("id", Number(queryText));
      else req = req.ilike("renter_id", `%${queryText}%`);
    }

    if (sort === "newest") req = req.order("id", { ascending: false });
    if (sort === "oldest") req = req.order("id", { ascending: true });
    if (sort === "start_soon") req = req.order("date_from", { ascending: true });

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as OwnerReservationRow[]);
    setTotal(count ?? 0);
    setStatus("");
  };

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const reservationId = params.get("reservation_id") ?? "";
  const itemId = params.get("item_id") ?? "";

  setPresetReservationId(reservationId);
  setPresetItemId(itemId);

  if (reservationId) setQ(reservationId);
  if (itemId) setItemFilter(itemId);
}, []);

  useEffect(() => {
    const run = async () => {
      try {
        setStatus("Načítavam…");
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user.id;

        if (!userId) {
          router.push("/login");
          return;
        }

        await loadOwnerItems(userId);
        setStatus("");
      } catch (e: any) {
        setStatus("Chyba: " + (e?.message ?? "neznáma chyba"));
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    // counts depend on owner items
    loadCounts(ownerItemIds).catch((e: any) => setStatus("Chyba: " + (e?.message ?? "neznáma chyba")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerItemIds]);

  useEffect(() => {
    // data depends on filters/page + owner scope
    loadReservations().catch((e: any) => setStatus("Chyba: " + (e?.message ?? "neznáma chyba")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerItemIds, itemsMap, page, q, itemFilter, statusFilter, paymentFilter, sort]);

  const confirm = async (id: number) => {
    setStatus("Ukladám potvrdenie…");
    const { error } = await supabase.from("reservations").update({ status: "confirmed" }).eq("id", id);
    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }
    await loadCounts(ownerItemIds);
    await loadReservations();
  };

  const cancel = async (id: number) => {
    setStatus("Ukladám zrušenie…");
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }
    await loadCounts(ownerItemIds);
    await loadReservations();
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Rezervácie mojich ponúk</h2>
          <p className="mt-1 text-white/60">
            Potvrdzuj rezervácie, kontroluj platby a rýchlo sa preklikni na detail ponuky.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link className="rounded-xl border border-white/15 px-3 py-2 hover:bg-white/10" href="/owner/items">
            Moje ponuky
          </Link>
        </div>
      </div>

      {status ? <Notice text={status} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Čakajúce" value={pendingCount} hint="Rezervácie čakajúce na tvoje potvrdenie" />
        <KpiCard title="Potvrdené" value={confirmedCount} hint="Pripravené alebo prebiehajúce prenájmy" />
        <KpiCard title="Zrušené" value={cancelledCount} hint="História zrušených rezervácií" />
      </div>

      <Section
        title="Vyhľadávanie a filtre"
        subtitle="Zúž zoznam podľa ponuky, stavu, platby alebo vyhľadaj konkrétne číslo rezervácie."
      >
        <div className="grid gap-3 md:grid-cols-5">
          <TextField
            id="q"
            label="Hľadať"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Číslo rezervácie, alebo časť ID zákazníka"
          />

          <SelectField
            id="item"
            label="Ponuka"
            value={itemFilter}
            onChange={(v) => {
              setItemFilter(v);
              setPage(1);
            }}
            options={itemOptions}
          />

          <SelectField
            id="st"
            label="Stav"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Všetky" },
              { value: "pending", label: "Čakajúce" },
              { value: "confirmed", label: "Potvrdené" },
              { value: "cancelled", label: "Zrušené" },
            ]}
          />

          <SelectField
            id="pay"
            label="Platba"
            value={paymentFilter}
            onChange={(v) => {
              setPaymentFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Všetky" },
              { value: "paid", label: "Zaplatené" },
              { value: "unpaid", label: "Nezaplatené" },
              { value: "failed", label: "Zlyhané" },
            ]}
          />

          <SelectField
            id="sort"
            label="Triedenie"
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={[
              { value: "newest", label: "Najnovšie" },
              { value: "start_soon", label: "Najbližší začiatok" },
              { value: "oldest", label: "Najstaršie" },
            ]}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
            onClick={clearFilters}
          >
            Vymazať filtre
          </button>

          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
            onClick={() => loadReservations()}
          >
            Obnoviť
          </button>
        </div>
      </Section>

      <Section
        title="Zoznam rezervácií"
        subtitle={ownerItemIds.length === 0 ? "Najprv si vytvor ponuku, aby si videl rezervácie." : `Zobrazené: ${rows.length} z ${total}`}
      >
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne rezervácie podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <OwnerReservationCard
                key={r.id}
                r={r}
                item={itemsMap[r.item_id]}
                onConfirm={() => confirm(r.id)}
                onCancel={() => cancel(r.id)}
              />
            ))}
          </ul>
        )}

        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      </Section>
    </main>
  );
}

