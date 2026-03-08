"use client";

import React from "react";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: Tone;
  children: React.ReactNode;
  title?: string;
}) {
  const toneCls =
    tone === "success"
      ? "bg-green-600/90 text-white"
      : tone === "warning"
      ? "bg-yellow-400 text-black"
      : tone === "danger"
      ? "bg-red-600/90 text-white"
      : tone === "info"
      ? "bg-blue-600/90 text-white"
      : "bg-white/10 text-white";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-white/50">{hint}</div>
    </div>
  );
}

export function Notice({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80"
    >
      {text}
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-white/70">
        {label}
      </label>
      <input
        id={id}
        className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-white/70">
        {label}
      </label>
      <select
        id={id}
        className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  if (total <= pageSize) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-white/60">
        Strana <strong className="text-white">{page}</strong> z{" "}
        <strong className="text-white">{totalPages}</strong> · Spolu{" "}
        <strong className="text-white">{total}</strong>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Predchádzajúca strana"
        >
          ← Predchádzajúca
        </button>

        <button
          type="button"
          className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Ďalšia strana"
        >
          Ďalšia →
        </button>
      </div>
    </div>
  );
}
