import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { Heart, MessageCircle, Send, Image as ImageIcon, ShieldCheck, Droplet } from "lucide-react";
import { toast } from "sonner";

type Post = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null; blood_group: string | null };
  like_count?: number;
  liked?: boolean;
  comment_count?: number;
};

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Feed — BloodLink" }] }),
  component: FeedPage,
});

function FeedPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    const { data: p } = await supabase
      .from("posts")
      .select("id, author_id, content, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (p ?? []) as Post[];
    if (list.length === 0) {
      setPosts([]);
      return;
    }
    const authorIds = [...new Set(list.map((x) => x.author_id))];
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, blood_group")
      .in("id", authorIds);
    const postIds = list.map((x) => x.id);
    const [{ data: likes }, { data: myLikes }] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      user
        ? supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    const likeMap = new Map<string, number>();
    (likes ?? []).forEach((l: { post_id: string }) => likeMap.set(l.post_id, (likeMap.get(l.post_id) ?? 0) + 1));
    const mineSet = new Set((myLikes ?? []).map((l: { post_id: string }) => l.post_id));
    const aMap = new Map((authors ?? []).map((a) => [a.id, a] as const));
    setPosts(
      list.map((x) => ({
        ...x,
        author: aMap.get(x.author_id) as Post["author"],
        like_count: likeMap.get(x.id) ?? 0,
        liked: mineSet.has(x.id),
      })),
    );
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("feed-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function submit() {
    if (!draft.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({ author_id: user.id, content: draft.trim() });
    setPosting(false);
    if (error) return toast.error(error.message);
    setDraft("");
  }

  async function toggleLike(p: Post) {
    if (!user) return;
    if (p.liked) {
      await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: p.id, user_id: user.id });
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 glass border-b safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Droplet className="h-4 w-4" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">BloodLink</h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                {t("realtime")} · <ShieldCheck className="h-2.5 w-2.5" /> {t("encrypted")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-3 border-b">
        <div className="rounded-2xl border bg-card p-3">
          <textarea
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            rows={2}
            placeholder={t("writeSomething")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex items-center justify-between pt-2">
            <button className="text-muted-foreground p-1.5 rounded-lg hover:bg-muted">
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              onClick={submit}
              disabled={posting || !draft.trim()}
              className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 disabled:opacity-40 flex items-center gap-1"
            >
              <Send className="h-3 w-3" />
              {t("post")}
            </button>
          </div>
        </div>
      </div>

      <ul className="divide-y">
        {posts.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-16">{t("emptyFeed")}</li>
        )}
        {posts.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Avatar name={p.author?.full_name} src={p.author?.avatar_url ?? undefined} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold truncate">{p.author?.full_name ?? "User"}</span>
                  {p.author?.blood_group && (
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {p.author.blood_group}
                    </span>
                  )}
                  <span className="text-muted-foreground">· {timeAgo(p.created_at, lang)}</span>
                </div>
                <p className="mt-1 text-sm leading-snug whitespace-pre-wrap break-words">{p.content}</p>
                <div className="mt-2 flex items-center gap-4 text-muted-foreground">
                  <button
                    onClick={() => toggleLike(p)}
                    className={`flex items-center gap-1 text-xs ${p.liked ? "text-primary" : ""}`}
                  >
                    <Heart className="h-3.5 w-3.5" fill={p.liked ? "currentColor" : "none"} />
                    {p.like_count ?? 0}
                  </button>
                  <button className="flex items-center gap-1 text-xs">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {p.comment_count ?? 0}
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name?: string | null; src?: string; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/10 text-primary grid place-items-center font-semibold shrink-0 overflow-hidden"
      style={{ height: size, width: size, fontSize: size * 0.4 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initial}
    </div>
  );
}
