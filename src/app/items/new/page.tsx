"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function NewItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("10");
  const [city, setCity] = useState("");

  const [status, setStatus] = useState("");

  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
    };
    guard();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Saving...");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setStatus("Not signed in.");
      return;
    }

 // Ensure profile exists (robust fix)
const { data: existingProfile, error: profileErr } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", userId)
  .maybeSingle();

if (profileErr) {
  setStatus("Error: " + profileErr.message);
  return;
}

if (!existingProfile) {
  const { error: insertProfileErr } = await supabase
    .from("profiles")
    .insert({ id: userId, role: "user" });

  if (insertProfileErr) {
    setStatus("Error: " + insertProfileErr.message);
    return;
  }
}

// Insert item
const { error } = await supabase.from("items").insert({
  owner_id: userId,
  title,
  description: description || null,
  price_per_day: Number(pricePerDay),
  city: city || null,
  is_active: true,
});

if (error) {
  setStatus("Error: " + error.message);
  return;
}


    setStatus("Saved ✅");
    router.push("/items");
  };

  return (
    <main className="p-8 max-w-md">
      <h1 className="text-2xl font-semibold">New item</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Price per day"
          value={pricePerDay}
          onChange={(e) => setPricePerDay(e.target.value)}
          type="number"
          min="0"
          step="0.5"
          required
        />

        <button className="rounded bg-white px-4 py-2 text-black">
          Save
        </button>
      </form>

      {status ? <p className="mt-4">{status}</p> : null}
    </main>
  );
}
