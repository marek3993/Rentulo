"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PublicProfile = {
  id: string;
  full_name: string | null;
  city: string | null;
  bio: string | null;
  avatar_path: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected" | string | null;
};

type ItemRow = {
  id: number;
  title: string;
  price_per_day: number;
  city: string | null;
  postal_code: string | null;
  category: string | null;
  is_active: boolean;
};

function verificationBadgeClass(status: string | null) {
  if (status === "verified") return "bg-emerald-600/90 text-white";
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "rejected") return "bg-red-600/90 text-white";
  return "bg-white/10 text-white";
}

function verificationLabel(status: string | null) {
  if (status === "verified") return "Overený profil";
  if (status === "pending") return "Čaká na overenie";
  if (status === "rejected") return "Overenie zamietnuté";
  return "Neoverený profil";
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const profileId = params.id;

  const [status, setStatus] = useState("Načítavam...");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});

  const avatarUrl = useMemo(() => {
    if (!profile?.avatar_path) return null;
    return supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl;
  }, [profile?.avatar_path]);

  useEffect(() => {
    const loadImages = async (rows: ItemRow[]) => {
      const ids = rows.map((x) => x.id);
      if (ids.length === 0) {
        setImageMap({});
        return;
      }

      const { data: imgs, error: imgErr } = await supabase
        .from("item_images")
        .select("item_id,path,is_primary")
        .in("item_id", ids)
        .order("id", { ascending: true });

      if (imgErr) {
        setImageMap({});
        return;
      }

      const map: Record<number, string> = {};
      for (const im of (imgs ?? []) as any[]) {
        if (!map[im.item_id]) {
          const { data: pub } = supabase.storage.from("item-images").getPublicUrl(im.path);
          map[im.item_id] = pub.publicUrl;
        }
      }

      setImageMap(map);
    };

    const run = async () => {
      setStatus("Načítavam...");

      if (!profileId) {
        setStatus("Profil neexistuje.");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id,full_name,city,bio,avatar_path,instagram_url,facebook_url,linkedin_url,website_url,verification_status"
        )
        .eq("id", profileId)
        .maybeSingle();

      if (profErr) {
        setStatus("Chyba: " + profErr.message);
        return;
      }

      if (!prof) {
        setStatus("Profil neexistuje.");
        return;
      }

      setProfile(prof as PublicProfile);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("items")
        .select("id,title,price_per_day,city,postal_code,category,is_active")
        .eq("owner_id", profileId)
        .eq("is_active", true)
        .order("id", { ascending: false });

      if (itemsErr) {
        setStatus("Chyba: " + itemsErr.message);
        return;
      }

      const itemRows = (itemsData ?? []) as ItemRow[];
      setItems(itemRows);
      await loadImages(itemRows);

      setStatus("");
    };

    run();
  }, [profileId]);

  if (status === "Profil neexistuje.") {
    return (
      <main className="space-y-6">
        <Link href="/items" className="rentulo-btn-secondary inline-flex px-4 py-2.5 text-sm">
          Späť na ponuky
        </Link>

        <div className="rentulo-card p-6">Profil neexistuje.</div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Link href="/items" className="rentulo-btn-secondary inline-flex px-4 py-2.5 text-sm">
        Späť na ponuky
      </Link>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      {profile ? (
        <>
          <section className="rentulo-card p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-24 w-24 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/45">
                    Bez fotky
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">
                    {profile.full_name?.trim() || "Používateľ"}
                  </h1>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${verificationBadgeClass(
                      profile.verification_status
                    )}`}
                  >
                    {verificationLabel(profile.verification_status)}
                  </span>
                </div>

                <div className="mt-2 text-white/60">
                  {profile.city?.trim() || "Bez uvedeného mesta"}
                </div>

                {profile.bio?.trim() ? (
                  <div className="mt-4 max-w-3xl whitespace-pre-wrap leading-7 text-white/80">
                    {profile.bio}
                  </div>
                ) : (
                  <div className="mt-4 text-white/60">Bez popisu profilu.</div>
                )}

                {profile.website_url ||
                profile.instagram_url ||
                profile.facebook_url ||
                profile.linkedin_url ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.website_url ? (
                      <a
                        href={profile.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rentulo-btn-secondary px-3 py-2 text-sm"
                      >
                        Web
                      </a>
                    ) : null}

                    {profile.instagram_url ? (
                      <a
                        href={profile.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rentulo-btn-secondary px-3 py-2 text-sm"
                      >
                        Instagram
                      </a>
                    ) : null}

                    {profile.facebook_url ? (
                      <a
                        href={profile.facebook_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rentulo-btn-secondary px-3 py-2 text-sm"
                      >
                        Facebook
                      </a>
                    ) : null}

                    {profile.linkedin_url ? (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rentulo-btn-secondary px-3 py-2 text-sm"
                      >
                        LinkedIn
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rentulo-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Aktívne ponuky používateľa</h2>
                <p className="mt-1 text-sm text-white/60">
                  Verejne dostupné ponuky tohto profilu.
                </p>
              </div>

              <div className="text-sm text-white/60">
                Počet ponúk: <strong className="text-white">{items.length}</strong>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
                Tento používateľ momentálne nemá žiadne aktívne ponuky.
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/items/${item.id}`}
                      className="block overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:border-indigo-400/40 hover:bg-white/[0.04]"
                    >
                      {imageMap[item.id] ? (
                        <img
                          src={imageMap[item.id]}
                          alt={item.title}
                          className="h-44 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-44 w-full items-center justify-center bg-white/5 text-sm text-white/40">
                          Bez fotky
                        </div>
                      )}

                      <div className="space-y-3 p-4">
                        {item.category ? (
                          <div className="inline-flex rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
                            {item.category}
                          </div>
                        ) : null}

                        <div className="text-lg font-semibold">{item.title}</div>

                        <div className="text-white/80">
                          {item.price_per_day} € <span className="text-white/60">/ deň</span>
                          {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
                          {item.postal_code ? (
                            <span className="text-white/60"> · {item.postal_code}</span>
                          ) : null}
                        </div>

                        <div className="text-sm font-medium text-indigo-300">Otvoriť detail →</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}