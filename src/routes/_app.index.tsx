import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { getProfile, type District } from "@/lib/api";
import { fetchNotificationSettings } from "@/lib/notification-settings";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { RequestComposer } from "@/components/request/RequestComposer";
import { RequestCard, type FeedRequest } from "@/components/request/RequestCard";
import { cacheGet, cacheSet } from "@/lib/offline";
import { Droplet, ShieldCheck, Search, X, Moon, Sun } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { toast } from "sonner";

type FeedSearch = { requestId?: string; compose?: boolean };

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Feed — BloodLink" }] }),
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    requestId: typeof search.requestId === "string" ? search.requestId : undefined,
    compose: search.compose === true || search.compose === "true" || search.compose === "1",
  }),
  component: FeedPage,
});

function FeedPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requestId, compose } = Route.useSearch();
  const [items, setItems] = useState<FeedRequest[]>([]);
  const [district, setDistrict] = useState<District | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [showComposer, setShowComposer] = useState(false);
  const [showDistrictSearch, setShowDistrictSearch] = useState(false);
  const [dark, setDark] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const prefsLoaded = useRef(false);

  useEffect(() => {
    setShowComposer(!!compose);
  }, [compose]);

  function closeComposer() {
    setShowComposer(false);
    void navigate({
      to: "/",
      search: (prev) => ({ ...prev, compose: undefined }),
      replace: true,
    });
  }

  function openComposerLocal() {
    void navigate({
      to: "/",
      search: (prev) => ({ ...prev, compose: true }),
      replace: true,
    });
  }

  useEffect(() => {
    if (typeof document === "undefined") return;
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  function toggleLang() {
    setLang(lang === "bn" ? "en" : "bn");
  }

  async function load() {
    try {
      let q = supabase
        .from("blood_requests")
        .select("*, districts(name_bn,name_en)")
        .eq("status", "open")
        .order("urgency", { ascending: false })
        .order("created_at", { ascending: false });
      if (filter !== "ALL") q = q.eq("blood_group", filter as (typeof BLOOD_GROUPS)[number]);
      if (district?.id) q = q.eq("district_id", district.id);
      const { data, error } = await q;
      if (error) throw error;

      const list = (data ?? []).map((row: any) => ({
        ...row,
        district: row.districts,
      })) as FeedRequest[];

      const requesterIds = [...new Set(list.map((r) => r.requester_id))];
      const requestIds = list.map((r) => r.id);

      if (requesterIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", requesterIds);
        const map = new Map((profiles ?? []).map((p) => [p.id, p]));
        for (const r of list) r.requester = map.get(r.requester_id) ?? null;
      }

      if (requestIds.length) {
        const [{ data: likes, error: likesErr }, myLikesRes, { data: comments, error: cmtErr }] =
          await Promise.all([
            supabase.from("request_likes").select("request_id").in("request_id", requestIds),
            user
              ? supabase
                  .from("request_likes")
                  .select("request_id")
                  .eq("user_id", user.id)
                  .in("request_id", requestIds)
              : Promise.resolve({ data: [] as { request_id: string }[], error: null }),
            supabase.from("request_comments").select("request_id").in("request_id", requestIds),
          ]);
        if (!likesErr && !cmtErr) {
          const likeMap = new Map<string, number>();
          (likes ?? []).forEach((l: { request_id: string }) =>
            likeMap.set(l.request_id, (likeMap.get(l.request_id) ?? 0) + 1),
          );
          const cMap = new Map<string, number>();
          (comments ?? []).forEach((c: { request_id: string }) =>
            cMap.set(c.request_id, (cMap.get(c.request_id) ?? 0) + 1),
          );
          const mine = new Set(
            (myLikesRes.data ?? []).map((l: { request_id: string }) => l.request_id),
          );
          for (const r of list) {
            r.like_count = likeMap.get(r.id) ?? 0;
            r.comment_count = cMap.get(r.id) ?? 0;
            r.liked = mine.has(r.id);
          }
        }
      }

      setItems(list);
      await cacheSet(`feed-req:${district?.id ?? "all"}:${filter}`, list);
    } catch (e) {
      const cached = await cacheGet<FeedRequest[]>(`feed-req:${district?.id ?? "all"}:${filter}`);
      if (cached) setItems(cached);
      else toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    if (!user || prefsLoaded.current) return;
    prefsLoaded.current = true;
    Promise.all([getProfile(user.id), fetchNotificationSettings()]).then(async ([p, settings]) => {
      if (settings.auto_feed_blood_group && p?.blood_group) {
        setFilter(String(p.blood_group));
      }
      if (settings.auto_feed_district && p?.district_id) {
        const { data } = await supabase
          .from("districts")
          .select("id,name_bn,name_en,slug,is_active,sort_order")
          .eq("id", p.district_id)
          .maybeSingle();
        if (data) setDistrict(data as District);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("feed-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "blood_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "request_likes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "request_comments" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, district?.id]);

  useEffect(() => {
    let targetId = requestId;
    if (!targetId) {
      try {
        targetId = sessionStorage.getItem("feedReturnRequestId") ?? undefined;
        if (targetId) sessionStorage.removeItem("feedReturnRequestId");
      } catch {
        targetId = undefined;
      }
    }
    if (!targetId) return;
    setHighlightId(targetId);
    const id = targetId;
    const scroll = () => {
      const el = document.getElementById(`request-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    const t1 = window.setTimeout(scroll, 300);
    const t2 = window.setTimeout(() => setHighlightId(null), 4000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [requestId, items.length]);

  return (
    <div className="w-full">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25">
              <Droplet className="h-4 w-4" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-tight tracking-tight truncate">{t("appName")}</h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse shrink-0" />
                {t("realtime")} · <ShieldCheck className="h-2.5 w-2.5 shrink-0" /> {t("encrypted")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowDistrictSearch((v) => !v)}
              title={lang === "bn" ? "জেলা ফিল্টার" : "Filter by district"}
              className={`relative h-10 w-10 rounded-xl grid place-items-center transition ${
                showDistrictSearch || district
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Search className="h-5 w-5" />
              {district && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleLang}
              title={lang === "bn" ? "English" : "বাংলা"}
              className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted grid place-items-center transition"
            >
              <span className="text-[11px] font-bold leading-none tracking-tight">
                {lang === "bn" ? "EN" : "বাং"}
              </span>
            </button>
            <button
              type="button"
              onClick={toggleDark}
              title={dark ? t("darkMode") : "Light"}
              className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted grid place-items-center transition"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <ChatHeaderButton size="lg" className="ml-0.5" />
          </div>
        </div>

        {showDistrictSearch && (
          <div className="px-3 sm:px-4 pb-2.5 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <DistrictTypeahead
                value={district}
                onChange={(d) => {
                  setDistrict(d);
                  if (d) setShowDistrictSearch(false);
                }}
                placeholder={lang === "bn" ? "জেলা ফিল্টার…" : "Filter by district…"}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDistrictSearch(false);
              }}
              className="h-10 w-10 shrink-0 rounded-xl border bg-card text-muted-foreground grid place-items-center hover:bg-muted"
              title={t("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {district && !showDistrictSearch && (
          <div className="px-3 sm:px-4 pb-2 flex">
            <button
              type="button"
              onClick={() => setShowDistrictSearch(true)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-primary/5 border-primary/20 text-primary px-2.5 py-1 text-[11px] font-medium"
            >
              <Search className="h-3 w-3" />
              {lang === "bn" ? district.name_bn : district.name_en}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setDistrict(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setDistrict(null);
                  }
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/15"
                aria-label={lang === "bn" ? "ফিল্টার সরান" : "Clear filter"}
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          </div>
        )}

        <div className="px-3 pb-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {["ALL", ...BLOOD_GROUPS].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setFilter(g)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                filter === g
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </header>

      {showComposer ? (
        <div className="px-3 pt-3 pb-6">
          <RequestComposer
            defaultDistrict={district}
            onCreated={() => {
              closeComposer();
              load();
            }}
            onCancel={closeComposer}
          />
        </div>
      ) : (
        <>
          <div className="px-3 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("liveRequests")}
            </h2>
            <span className="text-[11px] text-muted-foreground">{items.length}</span>
          </div>

          <ul className="px-3 pb-6 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:gap-5">
            {items.length === 0 && (
              <li className="rounded-2xl border border-dashed bg-muted/20 py-16 px-6 text-center">
                <p className="text-sm text-muted-foreground">{t("emptyRequests")}</p>
                <button
                  type="button"
                  onClick={openComposerLocal}
                  className="mt-3 text-xs font-semibold text-primary"
                >
                  {lang === "bn" ? "প্রথম রিকোয়েস্ট পোস্ট করুন" : "Post the first request"}
                </button>
              </li>
            )}
            {items.map((r) => (
              <li key={r.id} id={`request-${r.id}`}>
                <RequestCard
                  request={r}
                  currentUserId={user?.id}
                  onChanged={load}
                  highlighted={highlightId === r.id}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export { Avatar } from "@/components/Avatar";
