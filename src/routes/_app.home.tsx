import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { type District } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { RequestComposer } from "@/components/request/RequestComposer";
import { RequestCard, type FeedRequest } from "@/components/request/RequestCard";
import { cacheGet, cacheSet } from "@/lib/offline";
import { Droplet, ShieldCheck, Search, X } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { FEED_PAGE_SIZE, fetchFeedPage } from "@/lib/feed-requests";
import { queryKeys } from "@/lib/query-client";
import { FeedImageCarousel } from "@/components/feed/FeedImageCarousel";
import { FeedBannerSlider } from "@/components/feed/FeedBannerSlider";
import {
  DEFAULT_FEED_CAROUSEL_SETTINGS,
  fetchFeedCarouselBundle,
  type FeedCarouselSettings,
  type FeedCarouselSlide,
} from "@/lib/feed-carousel";
import {
  DEFAULT_FEED_BANNER_SETTINGS,
  fetchFeedBannerBundle,
  type FeedBannerSettings,
  type FeedBannerSlide,
} from "@/lib/feed-banner";
import { toast } from "sonner";

type FeedSearch = { requestId?: string; compose?: boolean };

export const Route = createFileRoute("/_app/home")({
  head: () => ({ meta: [{ title: "Feed — BloodLink" }] }),
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    requestId: typeof search.requestId === "string" ? search.requestId : undefined,
    compose: search.compose === true || search.compose === "true" || search.compose === "1",
  }),
  component: FeedPage,
});

function feedIdbKey(districtId: string | null | undefined, filter: string) {
  return `feed-req:${districtId ?? "all"}:${filter}`;
}

function FeedPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { requestId, compose } = Route.useSearch();
  const [district, setDistrict] = useState<District | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [showComposer, setShowComposer] = useState(false);
  const [showDistrictSearch, setShowDistrictSearch] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [carouselSettings, setCarouselSettings] = useState<FeedCarouselSettings>(
    DEFAULT_FEED_CAROUSEL_SETTINGS,
  );
  const [carouselSlides, setCarouselSlides] = useState<FeedCarouselSlide[]>([]);
  const [bannerSettings, setBannerSettings] = useState<FeedBannerSettings>(
    DEFAULT_FEED_BANNER_SETTINGS,
  );
  const [bannerSlides, setBannerSlides] = useState<FeedBannerSlide[]>([]);
  const rtTimer = useRef<number | null>(null);
  const hydratedKey = useRef<string | null>(null);
  const scrolledToHighlight = useRef<string | null>(null);
  const fetchingMoreRef = useRef(false);
  const pendingRtRefresh = useRef(false);

  const qKey = queryKeys.feed(filter, district?.id, user?.id);
  const idbKey = feedIdbKey(district?.id, filter);

  const feedQuery = useInfiniteQuery({
    queryKey: qKey,
    queryFn: async ({ pageParam }) => {
      const page = await fetchFeedPage({
        bloodGroup: filter,
        districtId: district?.id ?? null,
        offset: pageParam,
        limit: FEED_PAGE_SIZE,
        userId: user?.id,
      });
      if (pageParam === 0 && page.items.length) {
        void cacheSet(idbKey, page.items);
      }
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      if (!last.hasMore) return undefined;
      return pages.reduce((n, p) => n + p.items.length, 0);
    },
    staleTime: 45_000,
    gcTime: 20 * 60_000,
    placeholderData: keepPreviousData,
  });

  // Paint instantly from IndexedDB on cold visit (before network returns).
  useEffect(() => {
    if (hydratedKey.current === idbKey) return;
    const existing = queryClient.getQueryData(qKey);
    if (existing) {
      hydratedKey.current = idbKey;
      return;
    }
    let cancelled = false;
    void cacheGet<FeedRequest[]>(idbKey).then((cached) => {
      if (cancelled || !cached?.length) return;
      if (queryClient.getQueryData(qKey)) return;
      queryClient.setQueryData(qKey, {
        pages: [{ items: cached, hasMore: true }],
        pageParams: [0],
      });
      hydratedKey.current = idbKey;
    });
    return () => {
      cancelled = true;
    };
  }, [idbKey, qKey, queryClient]);

  const {
    data: feedData,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error: feedError,
  } = feedQuery;

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedRequest[] = [];
    for (const page of feedData?.pages ?? []) {
      for (const r of page.items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
    }
    return out;
  }, [feedData]);

  const hasMore = hasNextPage ?? false;
  const loading = isPending && items.length === 0;
  const loadingMore = isFetchingNextPage;

  useEffect(() => {
    setShowComposer(!!compose);
  }, [compose]);

  useEffect(() => {
    void fetchFeedCarouselBundle(true).then(({ settings, slides }) => {
      setCarouselSettings(settings);
      setCarouselSlides(slides);
    });
    void fetchFeedBannerBundle(true).then(({ settings, slides }) => {
      setBannerSettings(settings);
      setBannerSlides(slides);
    });
  }, []);

  function closeComposer() {
    setShowComposer(false);
    void navigate({
      to: "/home",
      search: (prev: Record<string, unknown>) => ({ ...prev, compose: undefined }),
      replace: true,
    });
  }

  function openComposerLocal() {
    void navigate({
      to: "/home",
      search: (prev: Record<string, unknown>) => ({ ...prev, compose: true }),
      replace: true,
    });
  }

  const refreshFeed = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: qKey });
  }, [queryClient, qKey]);

  const loadMoreSafe = useCallback(() => {
    if (!hasMore || isFetchingNextPage || isPending) return;
    fetchingMoreRef.current = true;
    void fetchNextPage().finally(() => {
      fetchingMoreRef.current = false;
    });
  }, [hasMore, isFetchingNextPage, isPending, fetchNextPage]);

  const sentinelRef = useInfiniteScroll(loadMoreSafe, {
    enabled: hasMore && !loading && !showComposer,
    rootMargin: "480px",
  });

  // Default: all posts via personalized ranking (no hard filter).
  // District / blood chips only apply when the user sets them manually.
  useEffect(() => {
    const runReload = () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    };
    const scheduleReload = () => {
      // Don't yank scroll position while loading more pages, or while user is deep in the feed.
      const scrolledDown =
        typeof window !== "undefined" && window.scrollY > 280;
      if (fetchingMoreRef.current || isFetchingNextPage || scrolledDown) {
        pendingRtRefresh.current = true;
        return;
      }
      if (rtTimer.current) window.clearTimeout(rtTimer.current);
      rtTimer.current = window.setTimeout(runReload, 800);
    };
    const onScrollIdleRefresh = () => {
      if (!pendingRtRefresh.current) return;
      if (typeof window !== "undefined" && window.scrollY > 120) return;
      if (fetchingMoreRef.current || isFetchingNextPage) return;
      pendingRtRefresh.current = false;
      runReload();
    };
    const ch = supabase
      .channel("feed-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "blood_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "request_likes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "request_comments" }, scheduleReload)
      .subscribe();
    window.addEventListener("scroll", onScrollIdleRefresh, { passive: true });
    return () => {
      if (rtTimer.current) window.clearTimeout(rtTimer.current);
      window.removeEventListener("scroll", onScrollIdleRefresh);
      supabase.removeChannel(ch);
    };
  }, [queryClient, isFetchingNextPage]);

  useEffect(() => {
    if (isError && items.length === 0) {
      toast.error((feedError as Error)?.message ?? "Failed to load feed");
    }
  }, [isError, feedError, items.length]);

  // Scroll to a deep-linked post once — never again on every load-more (items.length).
  useEffect(() => {
    let targetId = requestId ?? undefined;
    let fromSession = false;
    if (!targetId) {
      try {
        const stored = sessionStorage.getItem("feedReturnRequestId");
        if (stored) {
          targetId = stored;
          fromSession = true;
        }
      } catch {
        targetId = undefined;
      }
    }
    if (!targetId) return;
    if (scrolledToHighlight.current === targetId) return;

    const el = document.getElementById(`request-${targetId}`);
    if (!el) return; // wait until the post is in the loaded pages

    scrolledToHighlight.current = targetId;
    if (fromSession) {
      try {
        sessionStorage.removeItem("feedReturnRequestId");
      } catch {
        /* ignore */
      }
    }

    setHighlightId(targetId);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const tHighlight = window.setTimeout(() => setHighlightId(null), 4000);

    if (requestId) {
      void navigate({
        to: "/home",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          requestId: undefined,
        }),
        replace: true,
      });
    }

    return () => {
      window.clearTimeout(tHighlight);
    };
  }, [requestId, items, navigate]);

  return (
    <div className="w-full">
      {showComposer ? (
        <div className="animate-composer-from-top border-b bg-background shadow-md safe-top">
          <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto pb-6 md:max-h-none">
            <RequestComposer
              variant="panel"
              defaultDistrict={null}
              onCreated={(id) => {
                setShowComposer(false);
                setFilter("ALL");
                setDistrict(null);
                setHighlightId(id);
                void queryClient.invalidateQueries({ queryKey: ["feed"] });
                void navigate({
                  to: "/home",
                  search: { requestId: id },
                  replace: true,
                });
              }}
              onCancel={closeComposer}
            />
          </div>
        </div>
      ) : (
        <>
          <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <UserMenuTrigger />
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
                  onClick={() => setShowDistrictSearch(false)}
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
          </AutoHideHeader>

          <div className="px-3 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("liveRequests")}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {items.length}
              {hasMore ? "+" : ""}
            </span>
          </div>

          <ul className="px-3 pb-2 space-y-3">
            {loading && (
              <li className="rounded-2xl border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                {t("loading")}
              </li>
            )}
            {!loading && items.length === 0 && (
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
            {bannerSettings.enabled &&
              bannerSlides.length > 0 &&
              bannerSettings.insert_after_posts === 0 && (
                <li className="list-none">
                  <FeedBannerSlider settings={bannerSettings} slides={bannerSlides} />
                </li>
              )}
            {items.map((r, index) => {
              const afterN = index + 1;
              const railAfter = Math.max(1, carouselSettings.insert_after_every || 2);
              const showRail =
                carouselSettings.enabled && carouselSlides.length > 0 && afterN === railAfter;
              const showBanner =
                bannerSettings.enabled &&
                bannerSlides.length > 0 &&
                bannerSettings.insert_after_posts > 0 &&
                afterN === bannerSettings.insert_after_posts;
              return (
                <Fragment key={r.id}>
                  <li id={`request-${r.id}`}>
                    <RequestCard
                      request={r}
                      currentUserId={user?.id}
                      onChanged={refreshFeed}
                      highlighted={highlightId === r.id}
                    />
                  </li>
                  {showRail && (
                    <li className="list-none">
                      <FeedImageCarousel settings={carouselSettings} slides={carouselSlides} />
                    </li>
                  )}
                  {showBanner && (
                    <li className="list-none">
                      <FeedBannerSlider settings={bannerSettings} slides={bannerSlides} />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
          <InfiniteSentinel
            sentinelRef={sentinelRef}
            loading={loadingMore}
            hasMore={hasMore}
            label={lang === "bn" ? "আরও পোস্ট…" : "More posts…"}
          />
        </>
      )}
    </div>
  );
}

export { Avatar } from "@/components/Avatar";
