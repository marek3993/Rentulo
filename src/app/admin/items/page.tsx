"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ItemRow = {
  id: number;
  title: string;
  price_per_day: number;
  city: string | null;
  owner_id: string;
  is_active: boolean;
};

export default function AdminItemsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [status, setStatus] = useState("Loading...");

  const load = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("id,title,price_per_day,city,owner_id,is_active")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setRows((data ?? []) as ItemRow[]);
    setStatus("");
  };

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        router.push("/login");
        return;
      }

      // jednoduchá kontrola roly (UX), RLS je aj tak hlavný guard
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sess.session.user.id)
        .maybeSingle();

      if (prof?.role !== "admin") {
        router.push("/");
        return;
      }

      await load();
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const toggleActive = async (id: number, next: boolean) => {
    setStatus("Updating...");
    const { error } = await supabase.from("items").update({ is_active: next }).eq("id", id);

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    await load();
  };

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin: Items</h1>
        <Link className="underline" href="/">
          Home
        </Link>
      </div>

      {status ? <p className="mt-4">{status}</p> : null}

      <ul className="mt-6 space-y-3">
        {rows.map((it) => (
          <li key={it.id} className="rounded border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  #{it.id} · {it.title}
                </div>
                <div className="opacity-80">
                  {it.city ?? "-"} · {it.price_per_day} €/day · owner {it.owner_id}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="opacity-80">Active:</span>
                <button
                  className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                  onClick={() => toggleActive(it.id, true)}
                  disabled={it.is_active}
                  type="button"
                >
                  Enable
                </button>
                <button
                  className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                  onClick={() => toggleActive(it.id, false)}
                  disabled={!it.is_active}
                  type="button"
                >
                  Disable
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
