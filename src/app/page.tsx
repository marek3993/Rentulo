"use client";

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

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Rentulo MVP</h1>
      <p className="mt-4">{status}</p>
    </main>
  );
}
