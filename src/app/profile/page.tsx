"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      // ensure profile exists
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("full_name,city")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setStatus("Error: " + error.message);
        return;
      }

      if (prof) {
        setFullName(prof.full_name ?? "");
        setCity(prof.city ?? "");
      }

      setStatus("");
    };

    run();
  }, [router]);

  const save = async () => {
    setStatus("Saving...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || null, city: city || null })
      .eq("id", userId);

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setStatus("Saved ✅");
  };

  return (
    <main className="p-8 max-w-md">
      <h1 className="text-2xl font-semibold">My profile</h1>
      {status ? <p className="mt-4">{status}</p> : null}

      <div className="mt-6 space-y-4">
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="City (e.g., Bratislava)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <button
          className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
          onClick={save}
          type="button"
        >
          Save
        </button>
      </div>
    </main>
  );
}
