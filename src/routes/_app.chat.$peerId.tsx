import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { conversationSecret, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { ArrowLeft, Check, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  ciphertext: string;
  iv: string | null;
  is_encrypted: boolean;
  created_at: string;
  plaintext?: string;
};

type ChatSearch = { fromRequestId?: string };

const LONG_PRESS_MS = 480;

export const Route = createFileRoute("/_app/chat/$peerId")({
  head: () => ({ meta: [{ title: "Conversation — BloodLink" }] }),
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    fromRequestId: typeof search.fromRequestId === "string" ? search.fromRequestId : undefined,
  }),
  component: Thread,
});

function Thread() {
  const { peerId } = Route.useParams();
  const { fromRequestId } = Route.useSearch();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [peer, setPeer] = useState<any>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const longPressRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", peerId).maybeSingle().then(({ data }) => setPeer(data));
  }, [peerId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function ensure() {
      const [a, b] = [user!.id, peerId].sort();
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_a", a)
        .eq("user_b", b)
        .maybeSingle();
      if (cancelled) return;
      if (existing?.id) {
        setConvId(existing.id);
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_a: a, user_b: b })
        .select("id")
        .single();
      if (cancelled) return;
      if (error) {
        if (error.code === "23505" || /duplicate key|unique constraint/i.test(error.message)) {
          const { data: again } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_a", a)
            .eq("user_b", b)
            .maybeSingle();
          if (again?.id) {
            setConvId(again.id);
            return;
          }
        }
        toast.error(error.message);
        return;
      }
      setConvId(data.id);
    }
    ensure();
    return () => {
      cancelled = true;
    };
  }, [user, peerId]);

  useEffect(() => {
    if (!convId || !user) return;
    const secret = conversationSecret(user.id, peerId);
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId!)
        .order("created_at", { ascending: true })
        .limit(200);
      const decrypted = await Promise.all(
        ((data ?? []) as Msg[]).map(async (m) => ({
          ...m,
          plaintext: m.is_encrypted && m.iv ? await decryptMessage(m.ciphertext, m.iv, secret) : m.ciphertext,
        })),
      );
      setMsgs(decrypted);
      requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: 1e9 }));
    }
    load();
    const ch = supabase
      .channel(`msg-${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        async (payload) => {
          const m = payload.new as Msg;
          const plaintext = m.is_encrypted && m.iv ? await decryptMessage(m.ciphertext, m.iv, secret) : m.ciphertext;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, { ...m, plaintext }]));
          requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          setMsgs((prev) => prev.filter((m) => m.id !== id));
          setSelected((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            if (next.size === 0) setSelectMode(false);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [convId, user, peerId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [text]);

  function clearLongPress() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function exitSelection() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function enterSelection(id: string) {
    setSelectMode(true);
    setSelected(new Set([id]));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }

  function onOwnMessagePressStart(id: string) {
    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      enterSelection(id);
    }, LONG_PRESS_MS);
  }

  function onOwnMessagePressEnd() {
    clearLongPress();
  }

  function onOwnMessageClick(id: string) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (selectMode) toggleSelected(id);
  }

  async function deleteSelected() {
    if (!user || selected.size === 0) return;
    const ids = [...selected];
    setDeleting(true);
    const { error } = await supabase.from("messages").delete().in("id", ids).eq("sender_id", user.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMsgs((prev) => prev.filter((m) => !ids.includes(m.id)));
    exitSelection();
    toast.success(t("messagesDeleted"));
  }

  async function send() {
    if (!text.trim() || !convId || !user || selectMode) return;
    setSending(true);
    const secret = conversationSecret(user.id, peerId);
    const { ciphertext, iv } = await encryptMessage(text.trim(), secret);
    const { error } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: user.id,
      recipient_id: peerId,
      ciphertext,
      iv,
      is_encrypted: true,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  }

  const selectedCount = selected.size;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="shrink-0 glass border-b safe-top">
        {selectMode ? (
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={exitSelection}
              className="p-1.5 rounded-lg hover:bg-muted"
              aria-label={t("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
            <p className="flex-1 text-sm font-semibold">
              {selectedCount} {t("messagesSelected")}
            </p>
            <button
              type="button"
              disabled={deleting || selectedCount === 0}
              onClick={() => void deleteSelected()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-destructive text-destructive-foreground px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("deleteMessages")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5">
            {fromRequestId ? (
              <Link
                to="/"
                search={{ requestId: fromRequestId }}
                className="p-1.5 rounded-lg hover:bg-muted"
                aria-label={lang === "bn" ? "পোস্টে ফিরুন" : "Back to post"}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/chat" className="p-1.5 rounded-lg hover:bg-muted md:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <Avatar name={peer?.full_name} src={peer?.avatar_url ?? undefined} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{peer?.full_name ?? "User"}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5" />
                {t("encrypted")}
                {peer?.blood_group && (
                  <span className="ml-1 font-semibold text-primary">· {peer.blood_group}</span>
                )}
              </p>
            </div>
          </div>
        )}
      </header>

      {!selectMode && (
        <p className="shrink-0 px-3 py-1 text-[10px] text-muted-foreground text-center border-b bg-muted/30">
          {lang === "bn"
            ? "নিজের বার্তায় চেপে ধরে সিলেক্ট করুন"
            : "Press and hold your messages to select"}
        </p>
      )}

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5">
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const isSelected = selected.has(m.id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                role={mine ? "button" : undefined}
                tabIndex={mine && selectMode ? 0 : undefined}
                onPointerDown={mine ? () => onOwnMessagePressStart(m.id) : undefined}
                onPointerUp={mine ? onOwnMessagePressEnd : undefined}
                onPointerLeave={mine ? onOwnMessagePressEnd : undefined}
                onPointerCancel={mine ? onOwnMessagePressEnd : undefined}
                onClick={mine ? () => onOwnMessageClick(m.id) : undefined}
                onContextMenu={
                  mine
                    ? (e) => {
                        e.preventDefault();
                        if (selectMode) toggleSelected(m.id);
                        else enterSelection(m.id);
                      }
                    : undefined
                }
                className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm transition select-none touch-manipulation ${
                  mine
                    ? `rounded-br-md text-primary-foreground ${isSelected ? "ring-2 ring-destructive ring-offset-2 ring-offset-background bg-primary/90" : "bg-primary"} ${selectMode ? "cursor-pointer active:scale-[0.98]" : ""}`
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                {mine && isSelected && (
                  <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center shadow">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <p className="whitespace-pre-wrap break-words leading-snug">{m.plaintext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!selectMode && (
        <div className="shrink-0 border-t glass safe-bottom bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 px-3 py-2"
          >
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none rounded-2xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 max-h-24 leading-snug"
              rows={1}
              placeholder={t("typeMessage")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="rounded-full bg-primary text-primary-foreground h-10 w-10 shrink-0 grid place-items-center disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
