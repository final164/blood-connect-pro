import { useAuth } from "@/lib/auth-context";
import { fetchCommunityOrgs, getProfile, type CommunityOrg, type District } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { CommunitySendSmsSheet } from "@/components/community/CommunitySendSmsSheet";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { fetchCommunityDonors, type CommunityDonorRow } from "@/lib/community-donor-import";
import { upazilaDisplayName } from "@/data/bangladesh-clinics";
import {
  contactFlagsForViewerDonor,
  normalizeDonorContactSettings,
} from "@/lib/community-contact-settings";
import {
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  type MessagingSettings,
} from "@/lib/messaging-settings";
import { whatsappHref } from "@/lib/request-form-options";
import { Phone, Users, Building2, X, MessageSquare } from "lucide-react";
import { MessengerIcon, ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

type CommunitySearch = {
  orgId?: string;
};

const PAGE = 24;

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
  const { orgId } = Route.useSearch();
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [bloodGroup, setBloodGroup] = useState("ALL");
  const [donors, setDonors] = useState<CommunityDonorRow[]>([]);
  const [filterOrg, setFilterOrg] = useState<CommunityOrg | null>(null);
  const [viewerGender, setViewerGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [smsOpen, setSmsOpen] = useState(false);
  const [msgSettings, setMsgSettings] = useState<MessagingSettings>(DEFAULT_MESSAGING_SETTINGS);
  const donorsRef = useRef(donors);
  donorsRef.current = donors;

  useEffect(() => {
    void fetchMessagingSettings().then(setMsgSettings);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setViewerGender(null);
      return;
    }
    void getProfile(user.id).then((p) => {
      setViewerGender((p?.gender as string | null | undefined)?.trim().toLowerCase() ?? null);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!orgId) {
      setFilterOrg(null);
      return;
    }
    void fetchCommunityOrgs()
      .then((orgs) => setFilterOrg(orgs.find((o) => o.id === orgId) ?? null))
      .catch(() => setFilterOrg(null));
  }, [orgId]);

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true);
        setHasMore(true);
      } else setLoadingMore(true);
      try {
        const offset = reset ? 0 : donorsRef.current.length;
        const { items, hasMore: more } = await fetchCommunityDonors({
          bloodGroup,
          districtId: district?.id ?? null,
          upazila: upazila.trim() || undefined,
          orgId: orgId ?? null,
          offset,
          limit: PAGE,
        });
        setDonors((prev) =>
          reset ? items : [...prev, ...items.filter((d) => !prev.some((p) => p.id === d.id))],
        );
        setHasMore(more);
      } catch {
        if (reset) setDonors([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [bloodGroup, district?.id, orgId, upazila],
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void loadPage(false);
  }, [hasMore, loadPage, loading, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading });

  useEffect(() => {
    void loadPage(true);
    const ch = supabase
      .channel("community-donors-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_donors" }, () =>
        void loadPage(true),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadPage]);

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

        <DistrictTypeahead
          value={district}
          onChange={(d) => {
            setDistrict(d);
            setUpazila("");
          }}
          placeholder={lang === "bn" ? "জেলা খুঁজুন…" : "Search district…"}
        />

        <UpazilaSelect district={district} value={upazila} onChange={setUpazila} />

        {msgSettings.show_community_send_sms && (
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {lang === "bn" ? "Send SMS (ঐচ্ছিক)" : "Send SMS (optional)"}
          </button>
        )}
      </AutoHideHeader>

      <ul className="p-3 space-y-2 pb-2">
        {loading && donors.length === 0 && (
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
          <DonorCard key={d.id} donor={d} lang={lang} viewerGender={viewerGender} />
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
      />
    </div>
  );
}

function DonorCard({
  donor: d,
  lang,
  viewerGender,
}: {
  donor: CommunityDonorRow;
  lang: "bn" | "en";
  viewerGender: string | null;
}) {
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
  const showCall = flags.call && !!phone;
  const showSms = flags.sms && !!phone;
  const showChat = flags.chat && !!phone;
  const wa = phone ? whatsappHref(phone) : null;

  return (
    <li className="rounded-2xl border bg-card px-3 py-3 flex items-start gap-3 shadow-sm">
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
      <div className="flex items-center gap-1.5 shrink-0">
        {showChat && wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            title={lang === "bn" ? "চ্যাট (WhatsApp)" : "Chat (WhatsApp)"}
            className="h-10 w-10 rounded-2xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 grid place-items-center hover:opacity-90 transition"
          >
            <MessengerIcon className="h-4 w-4" />
          </a>
        )}
        {showSms && (
          <a
            href={`sms:${phone.replace(/[^\d+]/g, "")}`}
            title="SMS"
            className="h-10 w-10 rounded-2xl bg-muted text-foreground grid place-items-center hover:opacity-90 transition"
          >
            <MessageSquare className="h-4 w-4" />
          </a>
        )}
        {showCall && (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            title={lang === "bn" ? "কল করুন" : "Call"}
            className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25 hover:opacity-90 transition"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
    </li>
  );
}
