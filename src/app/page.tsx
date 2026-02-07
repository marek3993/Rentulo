"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("Connecting to Supabase...");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus("Supabase error: " + error.message);
        return;
      }

      const session = data.session;
      setStatus("Supabase OK ✅ Session: " + (session ? "YES" : "NO"));

      if (!session) {
        setRole(null);
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profErr) {
        // nech to neotravuje, len schová admin link
        setRole(null);
        return;
      }

      setRole(prof?.role ?? null);
    };

    run();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setStatus("Supabase OK ✅ Session: NO");
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Rentulo MVP</h1>
      <p className="mt-4">{status}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link className="rounded border px-3 py-1 hover:bg-white/10" href="/register">
          Register
        </Link>

        <Link className="rounded border px-3 py-1 hover:bg-white/10" href="/login">
          Login
        </Link>

        <Link className="rounded border px-3 py-1 hover:bg-white/10" href="/items">
          Items
        </Link>

        <Link className="rounded border px-3 py-1 hover:bg-white/10" href="/reservations">
          My reservations
        </Link>

        <Link className="rounded border px-3 py-1 hover:bg-white/10" href="/owner/reservations">
          Owner reservations
        </Link>

        {role === "admin" ? (
          <Link className="rounded border px-3 py-1 hover:bg-white/10" href="/admin/items">
            Admin items
          </Link>
        ) : null}

        <button
          className="rounded border px-3 py-1 hover:bg-white/10"
          onClick={logout}
          type="button"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
