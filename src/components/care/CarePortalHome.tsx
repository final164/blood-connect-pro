import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  FlaskConical,
  LogOut,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  Ambulance,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { careHasPermission, fetchMyCareMemberships, type CareMembership } from "@/lib/care-access";
import { fetchCareVendorTypes, type CareVendorType } from "@/lib/care-cms";
import { useI18n } from "@/lib/i18n";
import { careOrgKycLabel } from "@/lib/care-vendor-auth";
import { PageBackButton } from "@/components/nav/PageBackButton";

export function CarePortalHome() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const [memberships, setMemberships] = useState<CareMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [vendorTypes, setVendorTypes] = useState<CareVendorType[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/care/auth", search: { mode: undefined, next: undefined } });
      return;
    }
    void Promise.all([fetchMyCareMemberships(), fetchCareVendorTypes()])
      .then(([rows, types]) => {
        const active = rows.filter((r) => r.care_orgs?.is_active !== false);
        if (!active.length) {
          toast.error(
            lang === "bn"
              ? "কেয়ার ভেন্ডর অ্যাকাউন্ট নেই — নিবন্ধন করুন"
              : "No care vendor account — please register",
          );
          void navigate({ to: "/care/auth", search: { mode: "register", next: undefined } });
          return;
        }
        setMemberships(active);
        setOrgId((prev) => prev ?? active[0]!.org_id);
        setVendorTypes(types);
        setReady(true);
      })
      .catch((e) => {
        toast.error((e as Error).message);
        void navigate({ to: "/care/auth", search: { mode: undefined, next: undefined } });
      });
  }, [loading, user, navigate, lang]);

  const membership = useMemo(
    () => memberships.find((m) => m.org_id === orgId) ?? null,
    [memberships, orgId],
  );
  const org = membership?.care_orgs;
  const orgName = lang === "bn" ? org?.name_bn || org?.name : org?.name;

  const panels = useMemo(() => {
    const kindId = org?.org_kind_id;
    const kind = vendorTypes.find((t) => t.id === kindId);
    return new Set(kind?.panels ?? ["desk"]);
  }, [org, vendorTypes]);

  const showDesk =
    panels.has("desk") &&
    (careHasPermission(membership, "overview.view") ||
      careHasPermission(membership, "queue.view") ||
      membership?.role === "owner");
  const showLab =
    panels.has("lab") &&
    (careHasPermission(membership, "lab.checkin") ||
      careHasPermission(membership, "overview.view") ||
      membership?.role === "owner");
  const showAmbulance =
    panels.has("ambulance") &&
    (careHasPermission(membership, "ambulance.dispatch.view") ||
      careHasPermission(membership, "overview.view") ||
      membership?.role === "owner");

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/care/auth", search: { mode: undefined, next: undefined } });
  }

  if (!ready || !membership) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const kycLabel = careOrgKycLabel(org, lang);
  const verified = !!org?.is_verified;
  const needsProfile = org?.kyc_status === "draft" || !org?.profile_completed;
  const pendingApproval = org?.kyc_status === "pending" && !!org?.profile_completed;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-50/40 to-background dark:from-teal-950/20">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <PageBackButton fallbackTo="/home" shape="xl" />
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "কেয়ার ভেন্ডর পোর্টাল" : "Care vendor portal"}
            </p>
            <h1 className="truncate text-lg font-bold">{orgName}</h1>
          </div>
          {memberships.length > 1 && (
            <select
              className="max-w-36 rounded-xl border bg-background px-2 py-2 text-xs"
              value={orgId ?? ""}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {lang === "bn" ? m.care_orgs?.name_bn || m.care_orgs?.name : m.care_orgs?.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="grid h-9 w-9 place-items-center rounded-xl border"
            aria-label={lang === "bn" ? "লগআউট" : "Sign out"}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div
          className={`rounded-2xl border p-4 ${
            verified
              ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30"
          }`}
        >
          <div className="flex items-start gap-3">
            {verified ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            )}
            <div>
              <p className="text-sm font-semibold">{kycLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {verified
                  ? lang === "bn"
                    ? "আপনার প্রতিষ্ঠান রোগীদের কাছে দৃশ্যমান।"
                    : "Your organization is visible to patients."
                  : needsProfile
                    ? lang === "bn"
                      ? "ডেস্ক ব্যবহার করতে পারবেন; প্রোফাইল সম্পূর্ণ করে অনুমোদন নিন।"
                      : "You can use the desk; complete profile and submit for approval."
                    : pendingApproval
                      ? lang === "bn"
                        ? "অ্যাডমিন পর্যালোচনা চলছে — সাধারণত ১–২ কার্যদিবস।"
                        : "Admin review in progress — usually 1–2 business days."
                      : lang === "bn"
                        ? "ডেস্ক ব্যবহার করতে পারবেন; KYC সম্পন্ন হলে রোগী সার্চে লিস্ট হবেন।"
                        : "You can use the desk now; after KYC you will appear in patient search."}
              </p>
              {(needsProfile || org?.kyc_status === "rejected") && (
                <Link
                  to="/care/portal/onboarding"
                  search={{ welcome: true }}
                  className="mt-3 inline-flex rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  {lang === "bn" ? "প্রোফাইল সম্পূর্ণ করুন" : "Complete profile"}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {showDesk && (
            <Link
              to="/care/portal/desk"
              className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-teal-500/50 hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-teal-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <h2 className="font-bold">{lang === "bn" ? "চেম্বার ডেস্ক" : "Chamber desk"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "bn"
                  ? "সিরিয়াল, কিউ, ডাক্তার ও স্টাফ"
                  : "Serials, queue, doctors & staff"}
              </p>
            </Link>
          )}
          {showLab && (
            <Link
              to="/care/portal/lab"
              className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-teal-500/50 hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-teal-700">
                <Microscope className="h-5 w-5" />
              </div>
              <h2 className="font-bold">{lang === "bn" ? "ল্যাব ডেস্ক" : "Lab desk"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "bn"
                  ? "টেস্ট অফার, ক্যালেন্ডার ও চেক-ইন"
                  : "Offerings, calendar & check-in"}
              </p>
            </Link>
          )}
          {showAmbulance && (
            <Link
              to="/care/portal/ambulance"
              className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-orange-500/50 hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/10 text-orange-700">
                <Ambulance className="h-5 w-5" />
              </div>
              <h2 className="font-bold">{lang === "bn" ? "অ্যাম্বুলেন্স প্যানেল" : "Ambulance panel"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "bn" ? "ডিসপ্যাচ, ফ্লিট ও প্রাইসিং" : "Dispatch, fleet & pricing"}
              </p>
            </Link>
          )}
        </div>

        {!showDesk && !showLab && !showAmbulance && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {lang === "bn"
              ? "আপনার ভূমিকায় কোনো ডেস্ক প্যানেল নেই। মালিকের সাথে যোগাযোগ করুন।"
              : "No desk panels for your role. Contact the organization owner."}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            to="/care/portal/onboarding"
            search={{}}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
          >
            <Building2 className="h-3.5 w-3.5" />
            {lang === "bn" ? "প্রোফাইল / KYC" : "Profile / KYC"}
          </Link>
          <Link
            to="/care"
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {lang === "bn" ? "রোগী কেয়ার হাব" : "Patient care hub"}
          </Link>
        </div>
      </main>
    </div>
  );
}
