"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("Connecting to Supabase...");

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus("Supabase error: " + error.message);
        return;
      }
      setStatus("Supabase OK ✅ Session: " + (data.session ? "YES" : "NO"));
    };
    run();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    const { data } = await supabase.auth.getSession();
    setStatus("Supabase OK ✅ Session: " + (data.session ? "YES" : "NO"));
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Rentulo MVP</h1>
      <p className="mt-4">{status}</p>

      <div className="mt-6 flex gap-4">
        <Link className="underline" href="/register">
          Register
        </Link>
        <Link className="underline" href="/login">
          Login
        </Link>
        <button className="underline" onClick={logout}>
          Logout
        </button>
      </div>
    </main>
  );
}
