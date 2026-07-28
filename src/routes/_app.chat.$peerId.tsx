import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { conversationSecret, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";
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

export const Route = createFileRoute("/_app/chat/$peerId")({
  head: () => ({ meta: [{ title: "Conversation — BloodLink" }] }),
  component: Thread,
});

function Thread() {
  const { peerId } = Route.useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const [peer, setPeer] = useState<any>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  async function send() {
    if (!text.trim() || !convId || !user) return;
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

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="shrink-0 glass border-b safe-top">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Link to="/chat" className="p-1.5 rounded-lg hover:bg-muted md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Link>
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
      </header>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5">
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-snug">{m.plaintext}</p>
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
