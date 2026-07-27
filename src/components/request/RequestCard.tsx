import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { MapPin, Phone, Clock, MessageCircle, Share2, Droplets, Heart, ThumbsUp, Send, MessagesSquare, CornerDownRight } from "lucide-react";
import { toast } from "sonner";

export type FeedRequest = {
  id: string;
  requester_id: string;
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  hospital_name: string;
  city: string | null;
  district_id: string | null;
  contact_phone: string;
  needed_by: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string | null;
  status: string;
  created_at: string;
  district?: { name_bn: string; name_en: string } | null;
  requester?: { full_name: string | null; avatar_url: string | null } | null;
  like_count?: number;
  comment_count?: number;
  liked?: boolean;
};

export function RequestCard({
  request: r,
  currentUserId,
  onChanged,
}: {
  request: FeedRequest;
  currentUserId?: string;
  onChanged?: () => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [liked, setLiked] = useState(!!r.liked);
  const [likeCount, setLikeCount] = useState(r.like_count ?? 0);
  const [commentCount, setCommentCount] = useState(r.comment_count ?? 0);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    setLiked(!!r.liked);
    setLikeCount(r.like_count ?? 0);
    setCommentCount(r.comment_count ?? 0);
  }, [r.liked, r.like_count, r.comment_count, r.id]);

  const distName = lang === "bn" ? r.district?.name_bn : r.district?.name_en;
  const locationLabel = [r.hospital_name, distName || r.city].filter(Boolean).join(" · ");

  async function toggleLike() {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase.from("request_likes").insert({ request_id: r.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("request_likes").delete().eq("request_id", r.id).eq("user_id", user.id);
        if (error) throw error;
      }
      onChanged?.();
    } catch (e) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error((e as Error).message);
    }
  }

  async function share() {
    const text =
      lang === "bn"
        ? `${r.blood_group} রক্ত দরকার — ${r.patient_name}, ${locationLabel}`
        : `${r.blood_group} blood needed — ${r.patient_name}, ${locationLabel}`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    if (user && r.requester_id !== user.id) {
      await supabase.from("request_shares").upsert(
        { request_id: r.id, user_id: user.id },
        { onConflict: "request_id,user_id", ignoreDuplicates: true },
      );
    }
    try {
      if (navigator.share) await navigator.share({ title: "BloodLink", text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success(lang === "bn" ? "শেয়ার টেক্সট কপি হয়েছে" : "Share text copied");
      }
    } catch {
      /* cancelled */
    }
  }

  const urgencyStyle =
    r.urgency === "critical"
      ? "from-destructive/90 to-destructive text-destructive-foreground"
      : r.urgency === "urgent"
        ? "from-[color:var(--urgent)] to-amber-600 text-white"
        : "from-primary to-primary/80 text-primary-foreground";

  return (
    <article className="rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`bg-gradient-to-r ${urgencyStyle} px-4 py-2.5 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-bold tracking-tight">{r.blood_group}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 px-2 py-0.5 rounded-md bg-black/15">
            {t(r.urgency)}
          </span>
        </div>
        <span className="text-[10px] opacity-90 shrink-0">{timeAgo(r.created_at, lang)}</span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{r.patient_name}</h3>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-primary" />
            {r.bags_needed} {lang === "bn" ? "ব্যাগ প্রয়োজন" : "bag(s) needed"}
          </p>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>{locationLabel}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {new Date(r.needed_by).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>

        {r.notes && (
          <p className="text-xs leading-relaxed text-foreground/80 bg-muted/40 rounded-xl px-3 py-2">{r.notes}</p>
        )}

        {r.requester?.full_name && (
          <p className="text-[11px] text-muted-foreground">
            {t("postedBy")} · <span className="font-medium text-foreground/80">{r.requester.full_name}</span>
          </p>
        )}

        <div className="flex items-center gap-1 pt-1 border-t">
          <button
            type="button"
            onClick={toggleLike}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition hover:bg-muted ${
              liked ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ThumbsUp className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
            {likeCount}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <MessagesSquare className="h-4 w-4" />
            {commentCount}
          </button>
          {r.requester_id !== currentUserId && (
            <Link
              to="/chat/$peerId"
              params={{ peerId: r.requester_id }}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4" />
              {t("chat")}
            </Link>
          )}
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted ml-auto"
          >
            <Share2 className="h-4 w-4" />
            {t("share")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${r.contact_phone}`}
            className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
          >
            <Phone className="h-3.5 w-3.5" />
            {t("respond")}
          </a>
        </div>

        {showComments && (
          <CommentThread
            requestId={r.id}
            onCount={(n) => {
              setCommentCount(n);
              onChanged?.();
            }}
          />
        )}
      </div>
    </article>
  );
}

function CommentThread({ requestId, onCount }: { requestId: string; onCount: (n: number) => void }) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  type Cmt = {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    parent_id?: string | null;
    name?: string;
    like_count: number;
    liked: boolean;
  };
  const [items, setItems] = useState<Cmt[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Cmt | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: rows, error } = await supabase
      .from("request_comments")
      .select("id, content, user_id, created_at, parent_id")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) {
      // parent_id may be missing — retry without it
      const { data: rows2, error: err2 } = await supabase
        .from("request_comments")
        .select("id, content, user_id, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (err2) return;
      await enrichAndSet((rows2 ?? []).map((r) => ({ ...r, parent_id: null })));
      return;
    }
    await enrichAndSet(rows ?? []);
  }

  async function enrichAndSet(rows: { id: string; content: string; user_id: string; created_at: string; parent_id?: string | null }[]) {
    onCount(rows.length);
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const commentIds = rows.map((r) => r.id);
    let nameMap = new Map<string, string | null>();
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    }
    const likeCount = new Map<string, number>();
    const likedMine = new Set<string>();
    if (commentIds.length) {
      const { data: likes } = await supabase
        .from("request_comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      (likes ?? []).forEach((l: { comment_id: string; user_id: string }) => {
        likeCount.set(l.comment_id, (likeCount.get(l.comment_id) ?? 0) + 1);
        if (user && l.user_id === user.id) likedMine.add(l.comment_id);
      });
    }
    setItems(
      rows.map((r) => ({
        ...r,
        parent_id: r.parent_id ?? null,
        name: nameMap.get(r.user_id) ?? "User",
        like_count: likeCount.get(r.id) ?? 0,
        liked: likedMine.has(r.id),
      })),
    );
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`req-cmt-${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_comments", filter: `request_id=eq.${requestId}` },
        () => load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "request_comment_likes" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, user?.id]);

  async function send() {
    if (!user || !text.trim()) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      request_id: requestId,
      user_id: user.id,
      content: text.trim(),
    };
    if (replyTo) payload.parent_id = replyTo.id;
    const { error } = await supabase.from("request_comments").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
    setReplyTo(null);
    load();
  }

  async function toggleCommentLike(c: Cmt) {
    if (!user) return;
    const next = !c.liked;
    setItems((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, liked: next, like_count: Math.max(0, x.like_count + (next ? 1 : -1)) }
          : x,
      ),
    );
    try {
      if (next) {
        const { error } = await supabase
          .from("request_comment_likes")
          .insert({ comment_id: c.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("request_comment_likes")
          .delete()
          .eq("comment_id", c.id)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (e) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, liked: !next, like_count: Math.max(0, x.like_count + (next ? -1 : 1)) }
            : x,
        ),
      );
      toast.error((e as Error).message);
    }
  }

  const roots = items.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => items.filter((c) => c.parent_id === id);

  function CommentRow({ c, depth = 0 }: { c: Cmt; depth?: number }) {
    const replies = repliesOf(c.id);
    return (
      <div className={depth > 0 ? "ml-4 pl-2.5 border-l border-border/70" : ""}>
        <div className="text-xs py-1.5">
          <div className="flex items-baseline gap-1 flex-wrap">
            {c.user_id !== user?.id ? (
              <Link
                to="/chat/$peerId"
                params={{ peerId: c.user_id }}
                className="font-semibold text-foreground hover:text-primary underline-offset-2 hover:underline"
                title={lang === "bn" ? "চ্যাট করুন" : "Chat"}
              >
                {c.name}
              </Link>
            ) : (
              <span className="font-semibold">{c.name}</span>
            )}
            <span className="text-muted-foreground"> · {timeAgo(c.created_at, lang)}</span>
          </div>
          <p className="mt-0.5 text-foreground/90 leading-relaxed">{c.content}</p>
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => void toggleCommentLike(c)}
              className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium transition hover:bg-muted ${
                c.liked ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Heart className="h-3 w-3" fill={c.liked ? "currentColor" : "none"} />
              {c.like_count > 0 ? c.like_count : lang === "bn" ? "লাইক" : "Like"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyTo(c);
                setText("");
              }}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              <CornerDownRight className="h-3 w-3" />
              {lang === "bn" ? "রিপ্লাই" : "Reply"}
            </button>
            {c.user_id !== user?.id && (
              <Link
                to="/chat/$peerId"
                params={{ peerId: c.user_id }}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
              >
                <MessageCircle className="h-3 w-3" />
                {t("chat")}
              </Link>
            )}
          </div>
        </div>
        {replies.map((r) => (
          <CommentRow key={r.id} c={r} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-muted/30 p-2.5 space-y-1">
      {roots.map((c) => (
        <CommentRow key={c.id} c={c} />
      ))}
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground py-1">
          {lang === "bn" ? "এখনো কমেন্ট নেই" : "No comments yet"}
        </p>
      )}
      {replyTo && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-background/80 border px-2.5 py-1.5 text-[11px]">
          <span className="text-muted-foreground truncate">
            {lang === "bn" ? "রিপ্লাই" : "Replying"} · <span className="font-medium text-foreground">{replyTo.name}</span>
          </span>
          <button type="button" className="text-primary font-medium shrink-0" onClick={() => setReplyTo(null)}>
            {t("cancel")}
          </button>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <input
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={
            replyTo
              ? lang === "bn"
                ? `${replyTo.name}-কে রিপ্লাই…`
                : `Reply to ${replyTo.name}…`
              : t("typeMessage")
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={send}
          className="rounded-xl bg-primary text-primary-foreground px-3 py-2 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
