"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  bio: string | null;
  avatar_path: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

type ItemRow = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  postal_code?: string | null;
  category?: string | null;
};

type ReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const profileId = params.id;

  const [status, setStatus] = useState("Načítavam...");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [ownerReviewAvg, setOwnerReviewAvg] = useState<number | null>(null);
  const [ownerReviewCount, setOwnerReviewCount] = useState(0);
  const [ownerReviews, setOwnerReviews] = useState<ReviewRow[]>([]);

  const avatarUrl = useMemo(() => {
    if (!profile?.avatar_path) return null;
    return supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl;
  }, [profile?.avatar_path]);

  useEffect(() => {
    const run = async () => {
      setStatus("Načítavam...");

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id,full_name,city,bio,avatar_path,instagram_url,facebook_url,linkedin_url,website_url")
        .eq("id", profileId)
        .maybeSingle();

      if (profileErr) {
        setStatus("Chyba: " + profileErr.message);
        return;
      }

      if (!profileData) {
        setStatus("Nenájdené");
        return;
      }

      setProfile(profileData as ProfileRow);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("items")
        .select("id,title,description,price_per_day,city,postal_code,category")
        .eq("owner_id", profileId)
        .eq("is_active", true)
        .order("id", { ascending: false });

      if (!itemsErr) {
        const itemRows = (itemsData ?? []) as ItemRow[];
        setItems(itemRows);

        const itemIds = itemRows.map((x) => x.id);
        if (itemIds.length > 0) {
          const { data: imgs } = await supabase
            .from("item_images")
            .select("item_id,path")
            .in("item_id", itemIds)
            .order("id", { ascending: true });

          const map: Record<number, string> = {};
          for (const im of (imgs ?? []) as any[]) {
            if (!map[im.item_id]) {
              const { data: pub } = supabase.storage.from("item-images").getPublicUrl(im.path);
              map[im.item_id] = pub.publicUrl;
            }
          }
          setImageMap(map);
        } else {
          setImageMap({});
        }
      } else {
        setItems([]);
        setImageMap({});
      }

      const { data: ownerAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "owner")
        .eq("reviewee_id", profileId);

      if (ownerAgg) {
        const ratings = ownerAgg.map((x: any) => Number(x.rating)).filter((n) => Number.isFinite(n));
        setOwnerReviewCount(ratings.length);
        setOwnerReviewAvg(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null);
      } else {
        setOwnerReviewCount(0);
        setOwnerReviewAvg(null);
      }

      const { data: reviewList } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at")
        .eq("reviewee_type", "owner")
        .eq("reviewee_id", profileId)
        .order("id", { ascending: false })
        .limit(10);

      setOwnerReviews((reviewList ?? []) as ReviewRow[]);

      setStatus("");
    };

    if (!profileId) return;
    run();
  }, [profileId]);

  if (status === "Nenájdené") {
    return (
      <main className="space-y-6">
        <Link className="rounded border border-white/15 px-3 py-2 hover:bg-white/10 inline-flex" href="/items">
          Späť na ponuky
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          Profil neexistuje.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Link className="rounded border border-white/15 px-3 py-2 hover:bg-white/10 inline-flex" href="/items">
        Späť na ponuky
      </Link>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {profile ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-24 w-24 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full border border-white/10 bg-white/5" />
                )}
              </div>

              <div className="flex-1">
                <h1 className="text-2xl font-semibold">{profile.full_name ?? "Bez mena"}</h1>
                <div className="mt-1 text-white/60">{profile.city ?? "Bez mesta"}</div>

                <div className="mt-4 flex flex-wrap gap-8">
                  <div>
                    <div className="text-sm text-white/60">Hodnotenie prenajímateľa</div>
                    <div className="font-semibold text-white">
                      {ownerReviewAvg !== null ? ownerReviewAvg.toFixed(2) : "-"} ⭐{" "}
                      <span className="font-normal text-white/60">({ownerReviewCount})</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-white/60">Aktívne ponuky</div>
                    <div className="font-semibold text-white">{items.length}</div>
                  </div>
                </div>

                {profile.bio ? (
                  <div className="mt-4 whitespace-pre-wrap text-white/80">{profile.bio}</div>
                ) : (
                  <div className="mt-4 text-white/60">Bez popisu profilu.</div>
                )}

                {(profile.website_url ||
                  profile.instagram_url ||
                  profile.facebook_url ||
                  profile.linkedin_url) ? (
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    {profile.website_url ? (
                      <a
                        className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                        href={profile.website_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Web
                      </a>
                    ) : null}

                    {profile.instagram_url ? (
                      <a
                        className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                        href={profile.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Instagram
                      </a>
                    ) : null}

                    {profile.facebook_url ? (
                      <a
                        className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                        href={profile.facebook_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Facebook
                      </a>
                    ) : null}

                    {profile.linkedin_url ? (
                      <a
                        className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        LinkedIn
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Ponuky prenajímateľa</h2>
              <div className="text-sm text-white/60">{items.length} aktívnych ponúk</div>
            </div>

            {items.length === 0 ? (
              <div className="text-white/60">Tento prenajímateľ zatiaľ nemá žiadne aktívne ponuky.</div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <Link href={`/items/${item.id}`} className="block">
                      {imageMap[item.id] ? (
                        <img
                          src={imageMap[item.id]}
                          alt={item.title}
                          className="mb-3 h-44 w-full rounded-xl border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="mb-3 h-44 w-full rounded-xl border border-white/10 bg-white/5" />
                      )}

                      {item.category ? (
                        <div className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                          {item.category}
                        </div>
                      ) : null}

                      <div className="text-lg font-semibold">{item.title}</div>

                      <div className="mt-1 text-white/80">
                        {item.price_per_day} € <span className="text-white/60">/ deň</span>
                        {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
                        {item.postal_code ? <span className="text-white/60"> · {item.postal_code}</span> : null}
                      </div>

                      {item.description ? (
                        <div className="mt-2 line-clamp-2 text-white/70">{item.description}</div>
                      ) : (
                        <div className="mt-2 text-white/50">Bez popisu</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Hodnotenia prenajímateľa</h2>

            {ownerReviews.length === 0 ? (
              <div className="mt-3 text-white/60">Zatiaľ bez hodnotení prenajímateľa.</div>
            ) : (
              <ul className="mt-4 space-y-3">
                {ownerReviews.map((review) => (
                  <li key={review.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{review.rating} ⭐</div>
                      <div className="text-sm text-white/60">{formatDate(review.created_at)}</div>
                    </div>

                    {review.comment ? (
                      <div className="mt-2 whitespace-pre-wrap text-white/80">{review.comment}</div>
                    ) : (
                      <div className="mt-2 text-white/50">Bez komentára.</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}