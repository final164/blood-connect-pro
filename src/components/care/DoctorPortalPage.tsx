import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  ClipboardList,
  Loader2,
  Scissors,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { fetchMyDoctorProfile, type CareDoctorProfile } from "@/lib/care-doctor-auth";
import { careDoctorTypeLabel } from "@/lib/care-cms";
import {
  approveDoctorLink,
  fetchDoctorAffiliations,
  fetchDoctorLinkRequests,
  fetchDoctorOperations,
  fetchDoctorUpcomingSerials,
  rejectDoctorLink,
  type DoctorAffiliationRow,
  type DoctorLinkRequest,
  type DoctorOperationRow,
  type DoctorSerialSummary,
} from "@/lib/care-doctor-portal-api";
import {
  fetchMyPendingVideoClaim,
  requestVideoClaim,
} from "@/lib/care-doctors-api";
import {
  fetchTeleDoctor,
  fetchUnlinkedVideoDoctors,
  setDoctorOnline,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import { formatCareMoney } from "@/lib/care-invoice";
import { cn } from "@/lib/utils";

type Tab = "overview" | "approvals" | "chambers" | "serials" | "operations" | "video";

export function DoctorPortalPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { session, loading: authLoading, isAnonymous, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CareDoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [requests, setRequests] = useState<DoctorLinkRequest[]>([]);
  const [affiliations, setAffiliations] = useState<DoctorAffiliationRow[]>([]);
  const [serials, setSerials] = useState<DoctorSerialSummary[]>([]);
  const [operations, setOperations] = useState<DoctorOperationRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [teleProfile, setTeleProfile] = useState<TeleVideoDoctor | null>(null);
  const [claimable, setClaimable] = useState<TeleVideoDoctor[]>([]);
  const [pendingVideoClaim, setPendingVideoClaim] = useState<{
    id: string;
    doctor_id: string;
    doctor_name?: string | null;
  } | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session || isAnonymous) {
      void navigate({ to: "/care/doctor/auth" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMyDoctorProfile()
      .then(async (p) => {
        if (cancelled) return;
        if (!p) {
          void navigate({ to: "/care/doctor/register" });
          return;
        }
        setProfile(p);
        const [reqs, affs, ser, ops, tele, unlinked, myClaim] = await Promise.all([
          fetchDoctorLinkRequests(p.id),
          fetchDoctorAffiliations(p.id),
          fetchDoctorUpcomingSerials(p.id),
          fetchDoctorOperations(p.id),
          fetchTeleDoctor(p.id),
          fetchUnlinkedVideoDoctors(),
          user?.id ? fetchMyPendingVideoClaim(user.id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRequests(reqs);
        setAffiliations(affs);
        setSerials(ser);
        setOperations(ops);
        setTeleProfile(tele);
        setClaimable(unlinked);
        setPendingVideoClaim(myClaim);
        if (reqs.some((r) => r.status === "pending")) setTab("approvals");
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, authLoading, isAnonymous, navigate, user?.id]);

  async function joinVideo(doctorId: string) {
    setClaimBusy(true);
    try {
      const res = await requestVideoClaim(doctorId);
      if (res.status === "pending") {
        toast.success(bn ? "অ্যাডমিন অনুমোদনের অপেক্ষায়" : "Awaiting admin approval");
        if (user?.id) setPendingVideoClaim(await fetchMyPendingVideoClaim(user.id));
      } else {
        toast.success(bn ? "ভিডিও প্রোফাইল লিংক হয়েছে" : "Video profile linked");
        const tele = await fetchTeleDoctor(doctorId);
        setTeleProfile(tele);
        setPendingVideoClaim(null);
        setClaimable([]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClaimBusy(false);
    }
  }

  async function toggleOnline() {
    if (!profile || !teleProfile) return;
    setOnlineBusy(true);
    try {
      const next = !teleProfile.is_online;
      await setDoctorOnline(profile.id, next);
      setTeleProfile({ ...teleProfile, is_online: next });
      toast.success(next ? (bn ? "অনলাইন" : "Online") : bn ? "অফলাইন" : "Offline");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOnlineBusy(false);
    }
  }

  async function respond(id: string, approve: boolean) {
    setBusyId(id);
    try {
      if (approve) await approveDoctorLink(id);
      else await rejectDoctorLink(id);
      toast.success(approve ? (bn ? "অনুমোদিত" : "Approved") : bn ? "প্রত্যাখ্যান" : "Rejected");
      if (profile) {
        const [reqs, affs, ops] = await Promise.all([
          fetchDoctorLinkRequests(profile.id),
          fetchDoctorAffiliations(profile.id),
          fetchDoctorOperations(profile.id),
        ]);
        setRequests(reqs);
        setAffiliations(affs);
        setOperations(ops);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "pending");

  if (loading || authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!profile) return null;

  const tabs: { id: Tab; bn: string; en: string; icon: typeof Stethoscope; badge?: number }[] = [
    { id: "overview", bn: "ওভারভিউ", en: "Overview", icon: Stethoscope },
    { id: "approvals", bn: "অনুমোদন", en: "Approvals", icon: Check, badge: pending.length },
    { id: "chambers", bn: "চেম্বার", en: "Chambers", icon: Building2 },
    { id: "serials", bn: "সিরিয়াল", en: "Serials", icon: ClipboardList },
    { id: "operations", bn: "অপারেশন", en: "Operations", icon: Scissors },
    { id: "video", bn: "ভিডিও", en: "Video", icon: Video },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50/80 to-background flex flex-col">
      <AutoHideHeader className="z-30 border-b bg-background/95 safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo={{ to: "/care" }} shape="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">{profile.full_name}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {[profile.doctor_code, profile.bmdc_no ? `BMDC ${profile.bmdc_no}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold border",
                  on ? "bg-sky-600 text-white border-sky-600" : "bg-card border-border",
                )}
              >
                <Icon className="h-3 w-3" />
                {bn ? t.bn : t.en}
                {t.badge ? (
                  <span className="ml-0.5 rounded-full bg-rose-500 text-white text-[9px] px-1.5">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </AutoHideHeader>

      <div className="flex-1 px-3 py-4 max-w-2xl mx-auto w-full space-y-3 pb-24">
        {profile.registration_status === "pending" && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            {bn
              ? "আপনার রেজিস্ট্রেশন অ্যাডমিন অনুমোদনের অপেক্ষায়। অনুমোদনের পর সব ফিচার চালু হবে।"
              : "Your registration is awaiting admin approval. Features unlock after approval."}
          </div>
        )}

        {tab === "overview" && (
          <div className="rounded-2xl border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground">{bn ? "ডাক্তার কোড" : "Doctor code"}</p>
            <p className="text-2xl font-black text-sky-700 tracking-wide">{profile.doctor_code}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm pt-2">
              <div>
                <dt className="text-[10px] text-muted-foreground">BMDC</dt>
                <dd className="font-semibold">{profile.bmdc_no || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "ধরন" : "Type"}</dt>
                <dd className="font-semibold">{careDoctorTypeLabel(profile.doctor_type, lang === "bn" ? "bn" : "en")}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "স্ট্যাটাস" : "Status"}</dt>
                <dd className="font-semibold">{profile.registration_status}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "যোগ্যতা" : "Qualifications"}</dt>
                <dd className="font-semibold">{profile.qualifications || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "মোবাইল" : "Mobile"}</dt>
                <dd className="font-semibold">{profile.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "ইমেইল" : "Email"}</dt>
                <dd className="font-semibold truncate">{profile.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "লিঙ্গ" : "Gender"}</dt>
                <dd className="font-semibold">{profile.gender || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">{bn ? "জন্ম তারিখ" : "DOB"}</dt>
                <dd className="font-semibold">{profile.date_of_birth || "—"}</dd>
              </div>
            </dl>
            {teleProfile ? (
              <p className="text-xs text-emerald-700 pt-2">
                {bn ? "ভিডিও কনসালট: " : "Video consult: "}
                {teleProfile.is_online ? (bn ? "অনলাইন" : "Online") : bn ? "অফলাইন" : "Offline"}
                {teleProfile.fee_amount != null
                  ? ` · ${formatCareMoney(teleProfile.fee_amount, lang)}`
                  : ""}
              </p>
            ) : null}
          </div>
        )}

        {tab === "approvals" && (
          <div className="space-y-2">
            {!pending.length ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {bn ? "কোনো অপেক্ষমাণ অনুরোধ নেই" : "No pending requests"}
              </p>
            ) : (
              pending.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-card px-3 py-3 space-y-2">
                  <p className="text-sm font-semibold">
                    {bn ? r.org_name_bn || r.org_name : r.org_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.kind === "affiliation"
                      ? bn
                        ? `চেম্বার সিরিয়াল · ${r.location_name || ""}`
                        : `Chamber serial · ${r.location_name || ""}`
                      : bn
                        ? `অপারেশন · ${r.role || ""}`
                        : `Operation · ${r.role || ""}`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void respond(r.id, true)}
                      className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold inline-flex items-center justify-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {bn ? "অনুমোদন" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void respond(r.id, false)}
                      className="flex-1 rounded-xl border py-2 text-xs font-bold inline-flex items-center justify-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      {bn ? "না" : "Reject"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "chambers" && (
          <ul className="space-y-2">
            {!affiliations.length ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {bn ? "কোনো চেম্বার যুক্ত নেই" : "No chambers linked yet"}
              </p>
            ) : (
              affiliations.map((a) => (
                <li key={a.id} className="rounded-2xl border bg-card px-3 py-3">
                  <p className="text-sm font-semibold">
                    {bn ? a.org_name_bn || a.org_name : a.org_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {bn ? a.location_name_bn || a.location_name : a.location_name}
                    {a.fee_amount != null
                      ? ` · ${formatCareMoney(a.fee_amount, lang)}`
                      : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}

        {tab === "serials" && (
          <ul className="space-y-2">
            {!serials.length ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {bn ? "আসন্ন সিরিয়াল সেশন নেই" : "No upcoming serial sessions"}
              </p>
            ) : (
              serials.map((s) => (
                <li key={s.session_id} className="rounded-2xl border bg-card px-3 py-3 flex justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{s.session_date}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.org_name} · {s.location_name}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">
                    {s.serial_count} {bn ? "সিরিয়াল" : "serials"}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}

        {tab === "operations" && (
          <ul className="space-y-2">
            {!operations.length ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {bn ? "কোনো অপারেশন টিম নেই" : "No operation teams yet"}
              </p>
            ) : (
              operations.map((o) => (
                <li key={o.id} className="rounded-2xl border bg-card px-3 py-3">
                  <p className="text-sm font-semibold">{o.catalog_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.org_name} · {o.location_name} · {o.role}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}

        {tab === "video" && (
          <div className="space-y-3">
            {teleProfile ? (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">
                  {bn ? teleProfile.full_name_bn || teleProfile.full_name : teleProfile.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bn ? teleProfile.specialty_name_bn : teleProfile.specialty_name_en}
                  {teleProfile.fee_amount != null
                    ? ` · ${formatCareMoney(teleProfile.fee_amount, lang)}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={onlineBusy}
                    onClick={() => void toggleOnline()}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-semibold",
                      teleProfile.is_online
                        ? "bg-emerald-600 text-white"
                        : "border bg-background",
                    )}
                  >
                    {teleProfile.is_online
                      ? bn
                        ? "অনলাইন — অফ করুন"
                        : "Online — go offline"
                      : bn
                        ? "অনলাইন হোন"
                        : "Go online"}
                  </button>
                  <Link
                    to="/care/portal/tele"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold"
                  >
                    <Video className="h-4 w-4" />
                    {bn ? "ভিডিও ডেস্ক" : "Video desk"}
                  </Link>
                </div>
              </div>
            ) : pendingVideoClaim ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {bn
                  ? `ভিডিও জয়েন অনুরোধ অপেক্ষমাণ${pendingVideoClaim.doctor_name ? ` — ${pendingVideoClaim.doctor_name}` : ""}`
                  : `Video join request pending${pendingVideoClaim.doctor_name ? ` — ${pendingVideoClaim.doctor_name}` : ""}`}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {bn
                    ? "অনলাইন কনসালট্যান্সিতে জয়েন করতে একটি প্রোফাইল বেছে নিন। অ্যাডমিন অ্যাপ্রুভাল লাগতে পারে।"
                    : "Pick a profile to join online consultancy. Admin approval may be required."}
                </p>
                {!claimable.length ? (
                  <p className="text-xs text-muted-foreground">
                    {bn ? "এখন কোনো আনলিংকড প্রোফাইল নেই" : "No unlinked profiles available"}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {claimable.map((d) => (
                      <li key={d.doctor_id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {bn ? d.full_name_bn || d.full_name : d.full_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {bn ? d.specialty_name_bn : d.specialty_name_en}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={claimBusy}
                          onClick={() => void joinVideo(d.doctor_id)}
                          className="shrink-0 rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-semibold"
                        >
                          {bn ? "জয়েন" : "Join"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/care/portal/tele" className="text-xs font-semibold text-sky-700">
                  {bn ? "ভিডিও ডেস্ক খুলুন →" : "Open video desk →"}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
