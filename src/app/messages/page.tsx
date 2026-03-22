"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type ConversationRow = {
  id: number;
  item_id: number;
  owner_id: string;
  renter_id: string;
  reservation_id: number | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: number;
  title: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_path: string | null;
};

type MessageRow = {
  id: number;
  conversation_id: number;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("sk-SK");
}

export default function MessagesPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [itemMap, setItemMap] = useState<Record<number, ItemRow>>({});
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [avatarUrlMap, setAvatarUrlMap] = useState<Record<string, string>>({});
  const [lastMessageMap, setLastMessageMap] = useState<Record<number, MessageRow | null>>({});
  const [unreadCountMap, setUnreadCountMap] = useState<Record<number, number>>({});

  const loadIdRef = useRef(0);
  const mountedRef = useRef(true);

  const loadConversations = async () => {
    const loadId = ++loadIdRef.current;

    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    if (!userId) {
      router.push("/login");
      return;
    }

    setCurrentUserId(userId);

    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select("id,item_id,owner_id,renter_id,reservation_id,created_at,updated_at")
      .or(`owner_id.eq.${userId},renter_id.eq.${userId}`)
      .order("updated_at", { ascending: false });

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    if (conversationError) {
      setStatus("Chyba: " + conversationError.message);
      return;
    }

    const conversationRows = (conversationData ?? []) as ConversationRow[];
    setConversations(conversationRows);

    if (conversationRows.length === 0) {
      setItemMap({});
      setProfileMap({});
      setAvatarUrlMap({});
      setLastMessageMap({});
      setUnreadCountMap({});
      setStatus("");
      return;
    }

    const itemIds = Array.from(new Set(conversationRows.map((c) => c.item_id)));
    const participantIds = Array.from(
      new Set(conversationRows.flatMap((c) => [c.owner_id, c.renter_id]))
    );
    const conversationIds = conversationRows.map((c) => c.id);

    const [{ data: itemData }, { data: profileData }, { data: messageData }] = await Promise.all([
      supabase.from("items").select("id,title").in("id", itemIds),
      supabase
        .from("profiles")
        .select("id,full_name,city,avatar_path")
        .in("id", participantIds),
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,body,created_at,read_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
    ]);

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    const nextItemMap: Record<number, ItemRow> = {};
    for (const item of (itemData ?? []) as ItemRow[]) {
      nextItemMap[item.id] = item;
    }

    const nextProfileMap: Record<string, ProfileRow> = {};
    const nextAvatarUrlMap: Record<string, string> = {};

    for (const profile of (profileData ?? []) as ProfileRow[]) {
      nextProfileMap[profile.id] = profile;

      if (profile.avatar_path) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_path);
        nextAvatarUrlMap[profile.id] = pub.publicUrl;
      }
    }

    const nextLastMessageMap: Record<number, MessageRow | null> = {};
    const nextUnreadCountMap: Record<number, number> = {};

    for (const id of conversationIds) {
      nextLastMessageMap[id] = null;
      nextUnreadCountMap[id] = 0;
    }

    for (const msg of (messageData ?? []) as MessageRow[]) {
      if (!nextLastMessageMap[msg.conversation_id]) {
        nextLastMessageMap[msg.conversation_id] = msg;
      }

      if (msg.sender_id !== userId && !msg.read_at) {
        nextUnreadCountMap[msg.conversation_id] =
          (nextUnreadCountMap[msg.conversation_id] ?? 0) + 1;
      }
    }

    setItemMap(nextItemMap);
    setProfileMap(nextProfileMap);
    setAvatarUrlMap(nextAvatarUrlMap);
    setLastMessageMap(nextLastMessageMap);
    setUnreadCountMap(nextUnreadCountMap);
    setStatus("");
  };

  useEffect(() => {
    mountedRef.current = true;

    loadConversations();

    const handleFocus = () => {
      loadConversations();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadConversations();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel("messages-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Správy</h1>
            <p className="mt-1 text-white/60">
              Prehľad konverzácií s prenajímateľmi a záujemcami.
            </p>
          </div>

          <Link
            href="/items"
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
          >
            Prejsť na ponuky
          </Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {!status && conversations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
          Zatiaľ nemáš žiadne konverzácie.
        </div>
      ) : null}

      <ul className="space-y-3">
        {conversations.map((conversation) => {
          const isOwner = currentUserId === conversation.owner_id;
          const otherUserId = isOwner ? conversation.renter_id : conversation.owner_id;
          const otherProfile = profileMap[otherUserId];
          const item = itemMap[conversation.item_id];
          const avatarUrl = avatarUrlMap[otherUserId];
          const lastMessage = lastMessageMap[conversation.id];
          const unreadCount = unreadCountMap[conversation.id] ?? 0;

          return (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="block rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="h-14 w-14 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full border border-white/10 bg-white/5" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-white">
                          {otherProfile?.full_name ?? "Bez mena"}
                        </div>

                        {unreadCount > 0 ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-black">
                            {unreadCount} nové
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-sm text-white/60">
                        {otherProfile?.city ?? "Bez mesta"}
                      </div>

                      <div className="mt-2 text-sm text-white/70">
                        Položka: <strong>{item?.title ?? `#${conversation.item_id}`}</strong>
                      </div>

                      {lastMessage ? (
                        <div className="mt-2 line-clamp-2 text-sm text-white/60">
                          {lastMessage.sender_id === currentUserId ? "Ty: " : ""}
                          {lastMessage.body}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-white/50">Zatiaľ bez správ.</div>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-sm text-white/50">
                    {lastMessage
                      ? formatDateTime(lastMessage.created_at)
                      : formatDateTime(conversation.updated_at)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}