"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

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

export default function MessageDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = Number(params.id);

  const [status, setStatus] = useState("Načítavam...");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<ProfileRow | null>(null);
  const [renterProfile, setRenterProfile] = useState<ProfileRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const loadIdRef = useRef(0);
  const mountedRef = useRef(true);

  const otherProfile = useMemo(() => {
    if (!conversation || !currentUserId) return null;
    return currentUserId === conversation.owner_id ? renterProfile : ownerProfile;
  }, [conversation, currentUserId, ownerProfile, renterProfile]);

  const otherAvatarUrl = useMemo(() => {
    if (!otherProfile?.avatar_path) return null;
    return supabase.storage.from("avatars").getPublicUrl(otherProfile.avatar_path).data.publicUrl;
  }, [otherProfile?.avatar_path]);

  const markConversationAsRead = async (userId: string) => {
    const { data: unreadMessages, error: unreadError } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .is("read_at", null);

    if (unreadError) {
      return;
    }

    const unreadIds = (unreadMessages ?? []).map((msg: { id: number }) => msg.id);

    if (unreadIds.length === 0) {
      return;
    }

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  };

  const loadConversation = async () => {
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
      .eq("id", conversationId)
      .maybeSingle();

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    if (conversationError) {
      setStatus("Chyba: " + conversationError.message);
      return;
    }

    if (!conversationData) {
      setStatus("Nenájdené");
      return;
    }

    const conversationRow = conversationData as ConversationRow;

    if (userId !== conversationRow.owner_id && userId !== conversationRow.renter_id) {
      setStatus("Nemáš prístup do tejto konverzácie.");
      return;
    }

    const [{ data: itemData }, { data: ownerData }, { data: renterData }] = await Promise.all([
      supabase.from("items").select("id,title").eq("id", conversationRow.item_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("id,full_name,city,avatar_path")
        .eq("id", conversationRow.owner_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id,full_name,city,avatar_path")
        .eq("id", conversationRow.renter_id)
        .maybeSingle(),
    ]);

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    setConversation(conversationRow);
    setItem((itemData ?? null) as ItemRow | null);
    setOwnerProfile((ownerData ?? null) as ProfileRow | null);
    setRenterProfile((renterData ?? null) as ProfileRow | null);

    await markConversationAsRead(userId);

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at,read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!mountedRef.current || loadId !== loadIdRef.current) return;

    if (messageError) {
      setStatus("Chyba: " + messageError.message);
      return;
    }

    setMessages((messageData ?? []) as MessageRow[]);
    setStatus("");
  };

  useEffect(() => {
    if (!Number.isFinite(conversationId)) return;

    mountedRef.current = true;
    loadConversation();

    const channel = supabase
      .channel(`messages-detail-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadConversation();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, router]);

  const sendMessage = async () => {
    const body = newMessage.trim();

    if (!body) {
      alert("Napíš správu.");
      return;
    }

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        body,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewMessage("");
      await loadConversation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri odoslaní správy.";
      alert(message);
    } finally {
      setSending(false);
    }
  };

  if (status === "Nenájdené") {
    return (
      <main className="space-y-6">
        <Link
          href="/messages"
          className="inline-flex rounded border border-white/15 px-3 py-2 hover:bg-white/10"
        >
          Späť na správy
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          Konverzácia neexistuje.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Link
        href="/messages"
        className="inline-flex rounded border border-white/15 px-3 py-2 hover:bg-white/10"
      >
        Späť na správy
      </Link>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {conversation ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {otherAvatarUrl ? (
                  <img
                    src={otherAvatarUrl}
                    alt="avatar"
                    className="h-14 w-14 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full border border-white/10 bg-white/5" />
                )}

                <div>
                  <h1 className="text-2xl font-semibold">
                    {otherProfile?.full_name ?? "Bez mena"}
                  </h1>
                  <div className="mt-1 text-white/60">{otherProfile?.city ?? "Bez mesta"}</div>
                  <div className="mt-2 text-sm text-white/70">
                    Položka: <strong>{item?.title ?? `#${conversation.item_id}`}</strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/items/${conversation.item_id}`}
                  className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                >
                  Detail ponuky
                </Link>

                <Link
                  href={`/profile/${
                    currentUserId === conversation.owner_id
                      ? conversation.renter_id
                      : conversation.owner_id
                  }`}
                  className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
                >
                  Profil
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-white/60">Zatiaľ bez správ. Začni konverzáciu.</div>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_id === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? "bg-white text-black"
                            : "border border-white/10 bg-black/20 text-white"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{message.body}</div>
                        <div
                          className={`mt-2 text-xs ${
                            isMine ? "text-black/60" : "text-white/50"
                          }`}
                        >
                          {formatDateTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Nová správa</div>

            <textarea
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              rows={4}
              placeholder="Napíš správu..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={sendMessage}
                disabled={sending}
              >
                {sending ? "Odosielam..." : "Odoslať správu"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}