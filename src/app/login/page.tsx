"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setStatus("Signed in ✅ Go to home.");
  };

  return (
    <main className="p-8 max-w-md">
      <h1 className="text-2xl font-semibold">Login</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
        <input
          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black placeholder-black/60"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        <button className="rounded bg-white px-4 py-2 text-black">
          Sign in
        </button>
      </form>

      {status ? <p className="mt-4">{status}</p> : null}
    </main>
  );
}
