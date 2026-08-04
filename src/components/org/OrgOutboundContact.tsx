import { useEffect, useState } from "react";
import { Building2, MessageSquare, Phone, Users } from "lucide-react";
import { MessengerIcon } from "@/components/MessengerIcon";
import {
  CommunityContactGateSheet,
  type CommunityContactChannel,
} from "@/components/community/CommunityContactGateSheet";
import { CommunitySendSmsSheet } from "@/components/community/CommunitySendSmsSheet";
import { CommunitySavedRequestDropdown } from "@/components/community/CommunitySavedRequestDropdown";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { useAuth } from "@/lib/auth-context";
import { getProfile, type District } from "@/lib/api";
import {
  contactFlagsForViewerDonor,
  normalizeDonorContactSettings,
} from "@/lib/community-contact-settings";
import {
  loadCommunityRequestDraft,
  type CommunityRequestDraft,
} from "@/lib/community-request-draft";
import { fetchCommunityDonorsByOrg, type CommunityDonorRow } from "@/lib/community-donor-import";
import { upazilaDisplayName } from "@/data/bangladesh-clinics";
import { BLOOD_GROUPS } from "@/lib/format";
import { toast } from "sonner";

export function OrgOutboundContact({
  orgId,
  lang,
  canEdit,
}: {
  orgId: string;
  lang: "bn" | "en";
  canEdit: boolean;
}) {
  const { user } = useAuth();
  const [donors, setDonors] = useState<CommunityDonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [bloodGroup, setBloodGroup] = useState("ALL");
  const [viewerGender, setViewerGender] = useState<string | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState<CommunityRequestDraft | null>(null);
  const [contactGate, setContactGate] = useState<{
    donor: CommunityDonorRow;
    channel: CommunityContactChannel;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setSavedDraft(null);
      return;
    }
    setSavedDraft(loadCommunityRequestDraft(user.id));
    void getProfile(user.id).then((p) => {
      setViewerGender((p?.gender as string | null | undefined)?.trim().toLowerCase() ?? null);
    });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchCommunityDonorsByOrg(orgId)
      .then((rows) => {
        if (!cancelled) setDonors(rows.filter((d) => d.is_active !== false));
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error((e as Error).message);
          setDonors([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const filtered = donors.filter((d) => {
    if (bloodGroup !== "ALL" && d.blood_group !== bloodGroup) return false;
    if (district && d.district_id !== district.id) return false;
    if (upazila && (d.upazila ?? "").trim() !== upazila.trim()) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "আউটবাউন্ড কন্টাক্ট / SMS" : "Outbound contact / SMS"}
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {lang === "bn" ? "বাল্ক SMS" : "Bulk SMS"}
          </button>
        )}
      </div>

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

      <CommunitySavedRequestDropdown
        defaultDistrict={district}
        defaultUpazila={upazila}
        draft={savedDraft}
        onDraftChange={setSavedDraft}
      />

      <ul className="space-y-2">
        {loading && (
          <li className="py-10 text-center text-sm text-muted-foreground">
            {lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}
          </li>
        )}
        {!loading && filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed py-12 text-center">
            <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {lang === "bn" ? "কোনো রক্তদাতা নেই" : "No donors found"}
            </p>
          </li>
        )}
        {filtered.map((d) => (
          <OutboundDonorCard
            key={d.id}
            donor={d}
            lang={lang}
            viewerGender={viewerGender}
            canEdit={canEdit}
            onContact={(channel) => setContactGate({ donor: d, channel })}
          />
        ))}
      </ul>

      <CommunitySendSmsSheet
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        donors={filtered}
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

function OutboundDonorCard({
  donor: d,
  lang,
  viewerGender,
  canEdit,
  onContact,
}: {
  donor: CommunityDonorRow;
  lang: "bn" | "en";
  viewerGender: string | null;
  canEdit: boolean;
  onContact: (channel: CommunityContactChannel) => void;
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
  const showCall = canEdit && flags.call && !!phone;
  const showSms = canEdit && flags.sms && !!phone;
  const showChat = canEdit && flags.chat && !!phone;

  return (
    <li className="flex items-start gap-3 rounded-2xl border bg-card px-3 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold break-words">{d.full_name}</p>
          {d.blood_group && (
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {d.blood_group}
            </span>
          )}
        </div>
        {orgName && (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            <Building2 className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{orgName}</span>
          </p>
        )}
        {location && <p className="mt-0.5 text-[10px] text-muted-foreground">{location}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {showChat && (
          <button
            type="button"
            onClick={() => onContact("whatsapp")}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
          >
            <MessengerIcon className="h-4 w-4" />
          </button>
        )}
        {showSms && (
          <button
            type="button"
            onClick={() => onContact("sms")}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
        {showCall && (
          <button
            type="button"
            onClick={() => onContact("call")}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25"
          >
            <Phone className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}
