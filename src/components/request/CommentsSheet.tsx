import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { MessengerIcon } from "@/components/MessengerIcon";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChevronDown,
  CornerDownRight,
  Send,
  Share2,
  ThumbsUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Cmt = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  parent_id?: string | null;
  name?: string;
  avatar_url?: string | null;
  like_count: number;
  liked: boolean;
};

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return desktop;
}

export function CommentsSheet({
  requestId,
  open,
  onOpenChange,
  likeCount = 0,
  liked = false,
  onCount,
}: {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  likeCount?: number;
  liked?: boolean;
  onCount?: (n: number) => void;
}) {
  const desktop = useIsDesktop();
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [items, setItems] = useState<Cmt[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Cmt | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [shareCount, setShareCount] = useState(0);
  const [me, setMe] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [sort, setSort] = useState<"relevant" | "newest">("relevant");

  async function load() {
    const { data: rows, error } = await supabase
      .from("request_comments")
      .select("id, content, user_id, created_at, parent_id")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) {
      const { data: rows2, error: err2 } = await supabase
        .from("request_comments")
        .select("id, content, user_id, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (err2) return;
      await enrichAndSet((rows2 ?? []).map((row) => ({ ...row, parent_id: null })));
      return;
    }
    await enrichAndSet(rows ?? []);
  }

  async function enrichAndSet(
    rows: {
      id: string;
      content: string;
      user_id: string;
      created_at: string;
      parent_id?: string | null;
    }[],
  ) {
    onCount?.(rows.length);
    const ids = [...new Set(rows.map((row) => row.user_id))];
    const commentIds = rows.map((row) => row.id);
    let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]),
      );
    }
    const likeCountMap = new Map<string, number>();
    const likedMine = new Set<string>();
    if (commentIds.length) {
      const { data: likes } = await supabase
        .from("request_comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      (likes ?? []).forEach((l: { comment_id: string; user_id: string }) => {
        likeCountMap.set(l.comment_id, (likeCountMap.get(l.comment_id) ?? 0) + 1);
        if (user && l.user_id === user.id) likedMine.add(l.comment_id);
      });
    }
    setItems(
      rows.map((row) => {
        const p = profileMap.get(row.user_id);
        return {
          ...row,
          parent_id: row.parent_id ?? null,
          name: p?.full_name ?? "User",
          avatar_url: p?.avatar_url ?? null,
          like_count: likeCountMap.get(row.id) ?? 0,
          liked: likedMine.has(row.id),
        };
      }),
    );
  }

  useEffect(() => {
    if (!open) return;
    void load();
    void supabase
      .from("request_shares")
      .select("request_id", { count: "exact", head: true })
      .eq("request_id", requestId)
      .then(({ count }) => setShareCount(count ?? 0));
    if (user) {
      void supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setMe(data ?? null));
    }
    const ch = supabase
      .channel(`req-cmt-sheet-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_comments",
          filter: `request_id=eq.${requestId}`,
        },
        () => void load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "request_comment_likes" }, () =>
        void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestId, user?.id]);

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
    if (replyTo) setExpanded((e) => ({ ...e, [replyTo.id]: true }));
    setText("");
    setReplyTo(null);
    void load();
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

  const roots = (() => {
    const list = items.filter((c) => !c.parent_id);
    if (sort === "newest") {
      return [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return [...list].sort((a, b) => b.like_count - a.like_count || a.created_at.localeCompare(b.created_at));
  })();
  const repliesOf = (id: string) => items.filter((c) => c.parent_id === id);

  function rememberFeedReturn() {
    try {
      sessionStorage.setItem("feedReturnRequestId", requestId);
    } catch {
      /* ignore */
    }
  }

  function CommentRow({ c, nested = false }: { c: Cmt; nested?: boolean }) {
    const replies = repliesOf(c.id);
    const openReplies = !!expanded[c.id];
    return (
      <div className={nested ? "pl-10" : ""}>
        <div className="flex gap-2.5 py-2">
          {c.user_id !== user?.id ? (
            <Link
              to="/profile/$userId"
              params={{ userId: c.user_id }}
              onClick={rememberFeedReturn}
              className="shrink-0 rounded-full"
              aria-label={lang === "bn" ? "প্রোফাইল দেখুন" : "View profile"}
            >
              <Avatar name={c.name} src={c.avatar_url ?? undefined} size={nested ? 28 : 36} />
            </Link>
          ) : (
            <Avatar name={c.name} src={c.avatar_url ?? undefined} size={nested ? 28 : 36} />
          )}
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl bg-muted/70 px-3 py-2">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {c.user_id !== user?.id ? (
                  <Link
                    to="/profile/$userId"
                    params={{ userId: c.user_id }}
                    onClick={rememberFeedReturn}
                    className="text-[13px] font-semibold hover:underline"
                  >
                    {c.name}
                  </Link>
                ) : (
                  <span className="text-[13px] font-semibold">{c.name}</span>
                )}
                <span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at, lang)}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground/90 mt-0.5 whitespace-pre-wrap">
                {c.content}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(c);
                  setText("");
                }}
                className="text-[12px] font-semibold text-muted-foreground hover:underline"
              >
                {lang === "bn" ? "রিপ্লাই" : "Reply"}
              </button>
              {c.like_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                    <ThumbsUp className="h-2.5 w-2.5" fill="currentColor" />
                  </span>
                  {c.like_count}
                </span>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => void toggleCommentLike(c)}
                  className={`h-8 w-8 rounded-full grid place-items-center hover:bg-muted ${
                    c.liked ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-label={lang === "bn" ? "লাইক" : "Like"}
                >
                  <ThumbsUp className="h-4 w-4" fill={c.liked ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
            {replies.length > 0 && !nested && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [c.id]: !openReplies }))}
                className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-primary px-1"
              >
                <CornerDownRight className="h-3.5 w-3.5 rotate-90" />
                {openReplies
                  ? lang === "bn"
                    ? "রিপ্লাই লুকান"
                    : "Hide replies"
                  : lang === "bn"
                    ? `${replies.length}টি রিপ্লাই দেখুন`
                    : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
              </button>
            )}
            {c.user_id !== user?.id && (
              <Link
                to="/chat/$peerId"
                params={{ peerId: c.user_id }}
                search={{ fromRequestId: requestId }}
                onClick={rememberFeedReturn}
                className="mt-1 ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <MessengerIcon className="h-3.5 w-3.5" />
                {t("chat")}
              </Link>
            )}
          </div>
        </div>
        {openReplies &&
          replies.map((rep) => <CommentRow key={rep.id} c={rep} nested />)}
      </div>
    );
  }

  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats header */}
      <div className="shrink-0 border-b px-4 pb-2 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className={`h-5 w-5 rounded-full grid place-items-center ${
                liked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <ThumbsUp className="h-3 w-3" fill="currentColor" />
            </span>
            <span>{likeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Share2 className="h-3.5 w-3.5" />
            <span>
              {shareCount} {lang === "bn" ? "শেয়ার" : "shares"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSort((s) => (s === "relevant" ? "newest" : "relevant"))}
          className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-foreground/90"
        >
          {sort === "relevant"
            ? lang === "bn"
              ? "সবচেয়ে প্রাসঙ্গিক"
              : "Most relevant"
            : lang === "bn"
              ? "নতুনতম"
              : "Newest"}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable comments */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1">
        {roots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {lang === "bn" ? "এখনো কমেন্ট নেই — প্রথমটি লিখুন" : "No comments yet — be the first"}
          </p>
        ) : (
          roots.map((c) => <CommentRow key={c.id} c={c} />)
        )}
      </div>

      {/* Sticky composer */}
      <div className="shrink-0 border-t bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-1.5 text-[12px]">
            <span className="text-muted-foreground truncate">
              {lang === "bn" ? "রিপ্লাই" : "Replying"} ·{" "}
              <span className="font-semibold text-foreground">{replyTo.name}</span>
            </span>
            <button
              type="button"
              className="text-primary font-semibold shrink-0"
              onClick={() => setReplyTo(null)}
            >
              {t("cancel")}
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Avatar name={me?.full_name} src={me?.avatar_url ?? undefined} size={36} />
          <div className="flex-1 flex items-center gap-1.5 rounded-full bg-muted/80 px-3.5 py-2 min-w-0">
            <input
              className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              placeholder={
                replyTo
                  ? lang === "bn"
                    ? `${replyTo.name}-কে রিপ্লাই…`
                    : `Reply to ${replyTo.name}…`
                  : lang === "bn"
                    ? `কমেন্ট করুন${me?.full_name ? ` · ${me.full_name}` : ""}`
                    : `Comment as ${me?.full_name || "you"}`
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => void send()}
              className="h-8 w-8 rounded-full grid place-items-center text-primary disabled:opacity-35 shrink-0"
              aria-label={t("send")}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0 [&>button]:hidden"
        >
          <SheetHeader className="px-4 pt-4 pb-2 border-b space-y-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-base">
                {lang === "bn" ? "কমেন্টস" : "Comments"}
              </SheetTitle>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full hover:bg-muted grid place-items-center"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SheetDescription className="sr-only">
              {lang === "bn" ? "পোস্টের কমেন্ট তালিকা" : "Post comments"}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerContent className="h-[92dvh] max-h-[92dvh] p-0 gap-0 rounded-t-2xl outline-none">
        <DrawerTitle className="sr-only">
          {lang === "bn" ? "কমেন্টস" : "Comments"}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          {lang === "bn" ? "নিচ থেকে উপরে খোলা কমেন্ট প্যানেল" : "Comments bottom sheet"}
        </DrawerDescription>
        <div className="flex-1 min-h-0 flex flex-col mt-1">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
