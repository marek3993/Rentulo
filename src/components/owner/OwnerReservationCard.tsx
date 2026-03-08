"use client";

import Link from "next/link";
import { Badge } from "@/components/owner/OwnerUI";

export type OwnerReservationRow = {
  id: number;
  item_id: number;
  renter_id: string;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string;
  payment_provider: string;
};

export type OwnerItemMeta = {
  title?: string;
  city?: string | null;
  price_per_day?: number;
  imageUrl?: string | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function daysUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function shortId(id: string) {
  if (!id) return "-";
  return id.length <= 14 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function OwnerReservationCard({
  r,
  item,
  onConfirm,
  onCancel,
}: {
  r: OwnerReservationRow;
  item?: OwnerItemMeta;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isPaid = r.payment_status === "paid";
  const canConfirm = r.status === "pending" && isPaid;
  const canCancel = r.status !== "cancelled";

  const startIn = daysUntil(r.date_from);

  const statusBadge =
    r.status === "confirmed" ? (
      <Badge tone="success">Potvrdená</Badge>
    ) : r.status === "pending" ? (
      <Badge tone="warning">Čaká na potvrdenie</Badge>
    ) : r.status === "cancelled" ? (
      <Badge tone="danger">Zrušená</Badge>
    ) : (
      <Badge tone="neutral">{r.status}</Badge>
    );

  const paymentBadge =
    r.payment_status === "paid" ? (
      <Badge tone="success">Zaplatené</Badge>
    ) : r.payment_status === "failed" ? (
      <Badge tone="danger">Platba zlyhala</Badge>
    ) : (
      <Badge tone="warning">Nezaplatené</Badge>
    );

  return (
    <li className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          {item?.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title ?? "Fotka ponuky"}
              className="h-20 w-28 rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="h-20 w-28 rounded-xl border border-white/10 bg-white/5" />
          )}

          <div className="space-y-1">
            <div className="text-sm text-white/60">
              Rezervácia <strong className="text-white">#{r.id}</strong>
            </div>
            <div className="text-lg font-semibold">{item?.title ?? `Ponuka #${r.item_id}`}</div>

            <div className="text-sm text-white/70">
              {formatDate(r.date_from)} → {formatDate(r.date_to)}
            </div>

            <div className="text-sm text-white/60">
              Zákazník: <span className="text-white/80">{shortId(r.renter_id)}</span>
              {item?.city ? <span className="text-white/50"> · {item.city}</span> : null}
              {typeof item?.price_per_day === "number" ? (
                <span className="text-white/50"> · {item.price_per_day} € / deň</span>
              ) : null}
            </div>

            <div className="text-sm text-white/60">
              {r.status === "cancelled"
                ? "Rezervácia je zrušená."
                : startIn > 0
                ? `Začína o ${startIn} ${startIn === 1 ? "deň" : startIn < 5 ? "dni" : "dní"}.`
                : startIn === 0
                ? "Začína dnes."
                : "Termín už začal alebo prebieha."}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {statusBadge}
          {paymentBadge}
          <span className="text-sm text-white/50">({r.payment_provider})</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
          onClick={onConfirm}
          disabled={!canConfirm}
          type="button"
        >
          Potvrdiť
        </button>

        <button
          className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
          onClick={onCancel}
          disabled={!canCancel}
          type="button"
        >
          Zrušiť
        </button>

        <Link
          className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
          href={`/items/${r.item_id}`}
        >
          Detail ponuky
        </Link>
      </div>

      {!isPaid && r.status === "pending" ? (
        <div className="mt-3 text-sm text-white/60">
          Potvrdenie je dostupné až po úspešnej platbe.
        </div>
      ) : null}
    </li>
  );
}
