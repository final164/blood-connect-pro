import { useAuth } from "@/lib/auth-context";
import { fetchCommunityOrgs, getProfile, type District } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { CommunitySendSmsSheet } from "@/components/community/CommunitySendSmsSheet";
import {
  CommunityContactGateSheet,
  buildCommunityDraftMessageBody,
  openCommunityContactChannel,
  type CommunityContactChannel,
} from "@/components/community/CommunityContactGateSheet";
import { CommunitySavedRequestDropdown } from "@/components/community/CommunitySavedRequestDropdown";
import {
  communityRequestDraftFilled,
  communityRequestDraftMsRemaining,
  loadCommunityRequestDraft,
  type CommunityRequestDraft,
} from "@/lib/community-request-draft";
import { logCommunityContact } from "@/lib/community-request-contacts";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import {
  fetchCommunityDonors,
  isCommunityDonorUnavailable,
  type CommunityDonorRow,
} from "@/lib/community-donor-import";
import { upazilaDisplayName } from "@/data/bangladesh-clinics";
import {
  contactFlagsForViewerDonor,
  normalizeDonorContactSettings,
} from "@/lib/community-contact-settings";
import {
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
} from "@/lib/messaging-settings";
import {
  linkOrgDonorHistoryToProfile,
  restoreExpiredDonorAvailability,
} from "@/lib/community-request-contacts";
import { FeedImageCarousel } from "@/components/feed/FeedImageCarousel";
import {
  fetchFeedCarouselBundle,
  filterCarouselSlidesForDistrict,
  DEFAULT_FEED_CAROUSEL_SETTINGS,
} from "@/lib/feed-carousel";
import { queryKeys } from "@/lib/query-client";
import { Phone, Users, Building2, X, MessageSquare } from "lucide-react";
import { MessengerIcon, ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

type CommunitySearch = {
  orgId?: string;
};

/** Smaller pages → faster first paint; more on scroll. */
const PAGE = 12;

export const Route = createFileRoute("/_app/community")({
  head: () => ({ meta: [{ title: "Community — BloodLink" }] }),
  validateSearch: (search: Record<string, unknown>): CommunitySearch => ({
    orgId: typeof search.orgId === "string" && search.orgId ? search.orgId : undefined,
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { orgId } = Route.useSearch();
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [bloodGroup, setBloodGroup] = useState("ALL");
  const [smsOpen, setSmsOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState<CommunityRequestDraft | null>(null);
  const [contactGate, setContactGate] = useState<{
    donor: CommunityDonorRow;
    channel: CommunityContactChannel;
  } | null>(null);

  const msgQuery = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => fetchMessagingSettings(),
    staleTime: 120_000,
  });
  const msgSettings = msgQuery.data ?? DEFAULT_MESSAGING_SETTINGS;

  useEffect(() => {
    if (!user?.id) {
      setSavedDraft(null);
      return;
    }
    const ttl = msgSettings.community_save_request_ttl_hours;
    setSavedDraft(loadCommunityRequestDraft(user.id, ttl));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== user.id) return;
      setSavedDraft(loadCommunityRequestDraft(user.id, ttl));
    };
    window.addEventListener("community-request-draft-changed", onChange);
    return () => window.removeEventListener("community-request-draft-changed", onChange);
  }, [user?.id, msgSettings.community_save_request_ttl_hours]);

  /** Auto-clear save request when TTL elapses while page is open. */
  useEffect(() => {
    if (!user?.id || !savedDraft) return;
    const left = communityRequestDraftMsRemaining(
      savedDraft,
      msgSettings.community_save_request_ttl_hours,
    );
    if (left == null) return;
    if (left <= 0) {
      setSavedDraft(loadCommunityRequestDraft(user.id, msgSettings.community_save_request_ttl_hours));
      return;
    }
    const id = window.setTimeout(() => {
      setSavedDraft(loadCommunityRequestDraft(user.id, msgSettings.community_save_request_ttl_hours));
    }, left);
    return () => window.clearTimeout(id);
  }, [user?.id, savedDraft, msgSettings.community_save_request_ttl_hours]);

  /** Save-request fields drive donor list filters (when enabled in settings). */
  useEffect(() => {
    if (!savedDraft || !communityRequestDraftFilled(savedDraft)) return;
    if (msgSettings.community_apply_save_request_blood) {
      const g = savedDraft.blood_group?.trim();
      if (g && (g === "ALL" || (BLOOD_GROUPS as readonly string[]).includes(g))) {
        setBloodGroup(g);
      }
    }
    if (msgSettings.community_apply_save_request_district && savedDraft.district?.id) {
      setDistrict(savedDraft.district);
    }
    if (msgSettings.community_apply_save_request_upazila && savedDraft.upazila?.trim()) {
      setUpazila(savedDraft.upazila.trim());
    }
  }, [
    savedDraft,
    msgSettings.community_apply_save_request_blood,
    msgSettings.community_apply_save_request_district,
    msgSettings.community_apply_save_request_upazila,
  ]);

  useEffect(() => {
    void restoreExpiredDonorAvailability().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["community-donors"] });
    });
  }, [queryClient]);

  useEffect(() => {
    if (!user?.id || !msgSettings.link_org_donor_on_signup) return;
    void linkOrgDonorHistoryToProfile(user.id);
  }, [user?.id, msgSettings.link_org_donor_on_signup]);

  const profileDistrictQuery = useQuery({
    queryKey: ["viewer-district", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const p = await getProfile(user.id);
      const districtId = (p?.district_id as string | null | undefined) ?? null;
      if (!districtId) return null;
      const { data } = await supabase
        .from("districts")
        .select("id,name_bn,name_en,slug,is_active,sort_order")
        .eq("id", districtId)
        .maybeSingle();
      return (data as District | null) ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
  const profileDistrict = profileDistrictQuery.data ?? null;

  const carouselQuery = useQuery({
    queryKey: ["feed-carousel-bundle"],
    queryFn: () => fetchFeedCarouselBundle(true),
    staleTime: 60_000,
  });
  const carouselSettings = carouselQuery.data?.settings ?? DEFAULT_FEED_CAROUSEL_SETTINGS;

  /** Priority: save-request district → community search district → profile district */
  const carouselDistrictId = useMemo(() => {
    if (savedDraft && communityRequestDraftFilled(savedDraft) && savedDraft.district?.id) {
      return savedDraft.district.id;
    }
    if (district?.id) return district.id;
    return profileDistrict?.id ?? null;
  }, [savedDraft, district?.id, profileDistrict?.id]);

  const communityCarouselSlides = useMemo(
    () =>
      filterCarouselSlidesForDistrict(
        carouselQuery.data?.slides ?? [],
        carouselDistrictId,
        carouselSettings.community_district_filter,
      ),
    [
      carouselQuery.data?.slides,
      carouselDistrictId,
      carouselSettings.community_district_filter,
    ],
  );
  const showCommunityCarousel =
    carouselSettings.show_on_community && communityCarouselSlides.length > 0;

  const contactDonor = useCallback(
    (donor: CommunityDonorRow, channel: CommunityContactChannel) => {
      const draft =
        savedDraft ??
        (user?.id
          ? loadCommunityRequestDraft(user.id, msgSettings.community_save_request_ttl_hours)
          : null);
      if (
        draft &&
        communityRequestDraftFilled(draft) &&
        draft.feed_request_id &&
        user?.id
      ) {
        const tpl = lang === "bn" ? msgSettings.community_sms_bn : msgSettings.community_sms_en;
        const body = buildCommunityDraftMessageBody({
          draft,
          template: tpl,
          lang,
          requestId: draft.feed_request_id,
        });
        void logCommunityContact({
          requestId: draft.feed_request_id,
          contactedBy: user.id,
          channel,
          donorName: donor.full_name,
          donorPhone: donor.phone,
          communityDonorId: donor.id,
          orgId: donor.org_id || null,
        });
        openCommunityContactChannel(channel, donor.phone, body);
        return;
      }
      setContactGate({ donor, channel });
    },
    [savedDraft, user?.id, lang, msgSettings.community_sms_bn, msgSettings.community_sms_en, msgSettings.community_save_request_ttl_hours],
  );

  const genderQuery = useQuery({
    queryKey: ["viewer-gender", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const p = await getProfile(user.id);
      return (p?.gender as string | null | undefined)?.trim().toLowerCase() ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
  const viewerGender = genderQuery.data ?? null;

  const orgQuery = useQuery({
    queryKey: ["community-org-filter", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const orgs = await fetchCommunityOrgs();
      return orgs.find((o) => o.id === orgId) ?? null;
    },
    enabled: !!orgId,
    staleTime: 120_000,
  });
  const filterOrg = orgQuery.data ?? null;

  const sortUnavailableLast = msgSettings.community_sort_unavailable_last;

  const donorsKey = queryKeys.communityDonors({
    bloodGroup,
    districtId: district?.id,
    upazila: upazila.trim(),
    orgId,
    sortUnavailableLast,
  });

  const donorsQuery = useInfiniteQuery({
    queryKey: donorsKey,
    queryFn: ({ pageParam }) =>
      fetchCommunityDonors({
        bloodGroup,
        districtId: district?.id ?? null,
        upazila: upazila.trim() || undefined,
        orgId: orgId ?? null,
        offset: pageParam,
        limit: PAGE,
        sortUnavailableLast,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      if (!last.hasMore) return undefined;
      return pages.reduce((n, p) => n + p.items.length, 0);
    },
    staleTime: 45_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: donorsData,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = donorsQuery;

  const donors = useMemo(() => {
    const seen = new Set<string>();
    const out: CommunityDonorRow[] = [];
    for (const page of donorsData?.pages ?? []) {
      for (const d of page.items) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push(d);
      }
    }
    return out;
  }, [donorsData]);

  const hasMore = hasNextPage ?? false;
  const loading = isPending && donors.length === 0;
  const loadingMore = isFetchingNextPage;

  const loadMore = useCallback(() => {
    if (!hasMore || isFetchingNextPage || isPending) return;
    void fetchNextPage();
  }, [hasMore, isFetchingNextPage, isPending, fetchNextPage]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loading,
    rootMargin: "400px",
  });

  useEffect(() => {
    const ch = supabase
      .channel("community-donors-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_donors" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["community-donors"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const orgLabel =
    filterOrg && (lang === "bn" ? filterOrg.name_bn || filterOrg.name : filterOrg.name);

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserMenuTrigger />
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate">
                {lang === "bn" ? "রক্তদাতা খুঁজুন" : "Find blood donors"}
              </h1>
              <p className="text-[10px] text-muted-foreground truncate">
                {lang === "bn" ? "কমিউনিটি সংস্থার রক্তদাতা তালিকা" : "Community organization donor directory"}
              </p>
            </div>
          </div>
          <ChatHeaderButton />
        </div>

        {orgLabel && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <p className="min-w-0 flex-1 text-xs font-semibold truncate">{orgLabel}</p>
            <Link
              to="/community"
              search={{}}
              className="h-7 w-7 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground"
              aria-label={lang === "bn" ? "ফিল্টার সরান" : "Clear filter"}
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {msgSettings.show_community_blood_filter && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {["ALL", ...BLOOD_GROUPS].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setBloodGroup(g)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                  bloodGroup === g
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 min-w-0">
          <div className="min-w-0">
            <DistrictTypeahead
              value={district}
              onChange={(d) => {
                setDistrict(d);
                setUpazila("");
              }}
              placeholder={lang === "bn" ? "জেলা খুঁজুন…" : "Search district…"}
            />
          </div>
          <div className="min-w-0">
            <UpazilaSelect district={district} value={upazila} onChange={setUpazila} />
          </div>
        </div>

        {msgSettings.show_community_send_sms && (
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {lang === "bn"
              ? msgSettings.community_send_sms_label_bn
              : msgSettings.community_send_sms_label_en}
          </button>
        )}

        {msgSettings.show_community_save_request && (
          <CommunitySavedRequestDropdown
            defaultDistrict={district}
            defaultUpazila={upazila}
            draft={savedDraft}
            onDraftChange={setSavedDraft}
            emptyLabelBn={msgSettings.community_save_request_label_bn}
            emptyLabelEn={msgSettings.community_save_request_label_en}
          />
        )}
      </AutoHideHeader>

      {showCommunityCarousel && (
        <div
          className={
            carouselSettings.community_carousel_sticky
              ? "sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl px-3 py-2 shadow-sm"
              : "px-3 pt-3"
          }
        >
          <FeedImageCarousel settings={carouselSettings} slides={communityCarouselSlides} />
        </div>
      )}

      <ul className="p-3 space-y-2 pb-2">
        {loading && (
          <li className="text-center text-sm text-muted-foreground py-12">
            {lang === "bn" ? "খুঁজছি…" : "Searching…"}
          </li>
        )}
        {!loading && donors.length === 0 && (
          <li className="rounded-2xl border border-dashed bg-muted/20 py-16 px-6 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {lang === "bn" ? "কোনো রক্তদাতা পাওয়া যায়নি" : "No donors found"}
            </p>
          </li>
        )}
        {donors.map((d) => (
          <DonorCard
            key={d.id}
            donor={d}
            lang={lang}
            viewerGender={viewerGender}
            hideContactWhenUnavailable={msgSettings.community_hide_contact_when_unavailable}
            showUnavailableLabel={msgSettings.community_show_unavailable_label}
            onContact={(channel) => contactDonor(d, channel)}
          />
        ))}
      </ul>
      <InfiniteSentinel
        sentinelRef={sentinelRef}
        loading={loadingMore}
        hasMore={hasMore}
        label={lang === "bn" ? "আরও রক্তদাতা…" : "More donors…"}
      />

      <CommunitySendSmsSheet
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        donors={donors}
        defaultDistrict={district}
        defaultUpazila={upazila}
        viewerGender={viewerGender}
        onDraftSaved={setSavedDraft}
      />

      <CommunityContactGateSheet
        open={!!contactGate}
        onClose={() => setContactGate(null)}
        donor={contactGate?.donor ?? null}
        channel={contactGate?.channel ?? null}
        defaultDistrict={district}
        onDraftSaved={setSavedDraft}
      />
    </div>
  );
}

function DonorCard({
  donor: d,
  lang,
  viewerGender,
  hideContactWhenUnavailable,
  showUnavailableLabel,
  onContact,
}: {
  donor: CommunityDonorRow;
  lang: "bn" | "en";
  viewerGender: string | null;
  hideContactWhenUnavailable: boolean;
  showUnavailableLabel: boolean;
  onContact: (channel: CommunityContactChannel) => void;
}) {
  const unavailable = isCommunityDonorUnavailable(d);
  const orgName = lang === "bn" ? d.community_orgs?.name_bn || d.community_orgs?.name : d.community_orgs?.name;
  const distName = lang === "bn" ? d.districts?.name_bn : d.districts?.name_en;
  const upazilaName = upazilaDisplayName(d.upazila, d.districts?.slug ?? null, lang);
  const location = [upazilaName, distName].filter(Boolean).join(" · ");
  const flags = contactFlagsForViewerDonor(
    normalizeDonorContactSettings(d.community_orgs?.donor_contact_settings),
    viewerGender,
    d.gender,
  );
  const phone = d.phone?.trim() || "";
  const hideContact = unavailable && hideContactWhenUnavailable;
  const showCall = !hideContact && flags.call && !!phone;
  const showSms = !hideContact && flags.sms && !!phone;
  const showChat = !hideContact && flags.chat && !!phone;

  return (
    <li
      className={`rounded-2xl border bg-card px-3 py-3 flex items-start gap-3 shadow-sm ${
        unavailable ? "opacity-75" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold text-sm break-words">{d.full_name}</p>
          {d.blood_group && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
              {d.blood_group}
            </span>
          )}
          {d.gender && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {d.gender === "male" ? (lang === "bn" ? "পুরুষ" : "Male") : lang === "bn" ? "মহিলা" : "Female"}
            </span>
          )}
          {unavailable && showUnavailableLabel && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {lang === "bn" ? "এখন উপলব্ধ নয়" : "Not available"}
            </span>
          )}
        </div>
        {orgName && (
          <p className="mt-0.5 text-xs text-muted-foreground flex items-start gap-1 break-words">
            <Building2 className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="break-words">{orgName}</span>
          </p>
        )}
        {location && (
          <p className="mt-0.5 text-[10px] text-muted-foreground break-words">{location}</p>
        )}
      </div>
      {(showChat || showSms || showCall) && (
        <div className="flex items-center gap-1.5 shrink-0">
          {showChat && (
            <button
              type="button"
              onClick={() => onContact("whatsapp")}
              title={lang === "bn" ? "WhatsApp (আগে রিকোয়েস্ট)" : "WhatsApp (request first)"}
              className="h-10 w-10 rounded-2xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 grid place-items-center hover:opacity-90 transition"
            >
              <MessengerIcon className="h-4 w-4" />
            </button>
          )}
          {showSms && (
            <button
              type="button"
              onClick={() => onContact("sms")}
              title={lang === "bn" ? "SMS (আগে রিকোয়েস্ট)" : "SMS (request first)"}
              className="h-10 w-10 rounded-2xl bg-muted text-foreground grid place-items-center hover:opacity-90 transition"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          {showCall && (
            <button
              type="button"
              onClick={() => onContact("call")}
              title={lang === "bn" ? "কল (আগে রিকোয়েস্ট)" : "Call (request first)"}
              className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25 hover:opacity-90 transition"
            >
              <Phone className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
