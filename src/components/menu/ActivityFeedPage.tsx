import { useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Phone, BadgeCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { RequestCard, type FeedRequest } from "@/components/request/RequestCard";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { AlertsHeaderButton } from "@/components/MessengerIcon";
import { ProfileHeaderButton } from "@/components/ProfileHeaderButton";
import {
  ACTIVITY_VIEWS,
  loadActivityRequests,
  type ActivityView,
} from "@/lib/user-activity";
import { fetchCommunityOrgs, type CommunityOrg } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const PAGE = 4;

const TITLES: Record<ActivityView, { bn: string; en: string }> = {
  posts: { bn: "আমার পোস্ট", en: "My posts" },
  liked: { bn: "লাইক করা পোস্ট", en: "Liked posts" },
  commented: { bn: "কমেন্ট করা পোস্ট", en: "Commented posts" },
  shared: { bn: "শেয়ার করা পোস্ট", en: "Shared posts" },
  saved: { bn: "সেভ করা পোস্ট", en: "Saved posts" },
  donated: { bn: "যেখানে রক্ত দিয়েছি", en: "Posts I donated to" },
  organizations: { bn: "অর্গানাইজেশন", en: "Organizations" },
};

const EMPTY: Record<ActivityView, { bn: string; en: string }> = {
  posts: { bn: "আপনি এখনো কোনো পোস্ট করেননি", en: "You haven’t posted yet" },
  liked: { bn: "কোনো লাইক নেই", en: "No liked posts" },
  commented: { bn: "কোনো কমেন্ট নেই", en: "No commented posts" },
  shared: { bn: "কোনো শেয়ার নেই", en: "No shared posts" },
  saved: { bn: "কোনো সেভ নেই", en: "No saved posts" },
  donated: { bn: "এখনো কোনো দান নিশ্চিত হয়নি", en: "No confirmed donations yet" },
  organizations: { bn: "কোনো অর্গানাইজেশন নেই", en: "No organizations" },
};

export function isActivityView(v: string): v is ActivityView {
  return (ACTIVITY_VIEWS as string[]).includes(v);
}

export function ActivityFeedPage({ view }: { view: ActivityView }) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const queryClient = useQueryClient();

  const orgsQuery = useQuery({
    queryKey: ["community-orgs"],
    queryFn: () => fetchCommunityOrgs(),
    enabled: view === "organizations",
    staleTime: 120_000,
  });

  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.activity(view, user?.id),
    queryFn: ({ pageParam }) =>
      loadActivityRequests(view as Exclude<ActivityView, "organizations">, user!.id, {
        offset: pageParam,
        limit: PAGE,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      if (!last.hasMore) return undefined;
      return pages.reduce((n, p) => n + p.items.length, 0);
    },
    enabled: view !== "organizations" && !!user?.id,
    staleTime: 45_000,
  });

  const {
    data: listData,
    isPending: listPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = listQuery;

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedRequest[] = [];
    for (const page of listData?.pages ?? []) {
      for (const r of page.items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
    }
    return out;
  }, [listData]);

  const orgs = orgsQuery.data ?? [];
  const hasMore = hasNextPage ?? false;
  const loading =
    view === "organizations"
      ? orgsQuery.isPending && orgs.length === 0
      : listPending && items.length === 0;
  const loadingMore = isFetchingNextPage;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity(view, user?.id) });
  }, [queryClient, view, user?.id]);

  const loadMore = useCallback(() => {
    if (!hasMore || isFetchingNextPage || listPending) return;
    void fetchNextPage();
  }, [hasMore, isFetchingNextPage, listPending, fetchNextPage]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loading && view !== "organizations",
    rootMargin: "400px",
  });

  const title = lang === "bn" ? TITLES[view].bn : TITLES[view].en;
  const empty = lang === "bn" ? EMPTY[view].bn : EMPTY[view].en;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
          <UserMenuTrigger />
          <Link
            to="/home"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted grid place-items-center"
            aria-label={t("feed")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 min-w-0 text-sm font-bold truncate">{title}</h1>
          <ProfileHeaderButton size="lg" />
          <AlertsHeaderButton size="lg" />
        </div>
      </AutoHideHeader>

      <div className="px-3 sm:px-4 py-3 space-y-3 max-w-2xl mx-auto pb-8">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t("loading")}</p>
        ) : view === "organizations" ? (
          orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">{empty}</p>
          ) : (
            <ul className="space-y-2">
              {orgs.map((o) => (
                <OrgCard key={o.id} org={o} lang={lang} />
              ))}
            </ul>
          )
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">{empty}</p>
        ) : (
          items.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              currentUserId={user?.id}
              onChanged={refresh}
            />
          ))
        )}
        <InfiniteSentinel
          sentinelRef={sentinelRef}
          loading={loadingMore}
          hasMore={hasMore && view !== "organizations"}
          label={lang === "bn" ? "আরও পোস্ট…" : "More posts…"}
        />
      </div>
    </div>
  );
}

function OrgCard({ org: o, lang }: { org: CommunityOrg; lang: "bn" | "en" }) {
  const name = lang === "bn" ? o.name_bn || o.name : o.name;
  const description = lang === "bn" ? o.description_bn || o.description : o.description;
  const distName = o.districts
    ? lang === "bn"
      ? o.districts.name_bn
      : o.districts.name_en
    : null;
  const meta = [distName, o.phone].filter(Boolean).join(" · ");

  return (
    <li className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <Link
        to="/community"
        search={{ orgId: o.id }}
        className="flex items-start gap-3 px-3 py-3 hover:bg-muted/40 transition"
      >
        <span className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          {o.logo_url ? (
            <img src={o.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{name}</p>
            {o.is_verified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
          </div>
          {meta && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{meta}</p>}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
          <p className="mt-1.5 text-[11px] font-medium text-primary">
            {lang === "bn" ? "রক্তদাতা দেখুন →" : "View donors →"}
          </p>
        </div>
      </Link>
      {o.phone && (
        <div className="border-t px-3 py-2 flex justify-end">
          <a
            href={`tel:${o.phone.replace(/\s/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/15"
          >
            <Phone className="h-3.5 w-3.5" />
            {lang === "bn" ? "কল" : "Call"}
          </a>
        </div>
      )}
    </li>
  );
}
