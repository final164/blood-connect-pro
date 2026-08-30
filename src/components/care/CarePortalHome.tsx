import { Link } from "@tanstack/react-router";
import {
  Building2,
  ClipboardList,
  FlaskConical,
  LogOut,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  Ambulance,
  Hospital,
} from "lucide-react";
import { careOrgKycLabel } from "@/lib/care-vendor-auth";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useCarePortalLayout } from "@/components/care/CarePortalLayout";

export function CarePortalHome() {
  const {
    ready,
    membership,
    memberships,
    orgId,
    setOrgId,
    showDesk,
    showLab,
    showOperation,
    showAmbulance,
    desktopShell,
    signOutPortal,
    lang,
    orgName,
  } = useCarePortalLayout();

  if (!ready || !membership) {
    return (
      <div className="grid min-h-[40vh] place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const org = membership.care_orgs;
  const kycLabel = careOrgKycLabel(org, lang);
  const verified = !!org?.is_verified;
  const needsProfile = org?.kyc_status === "draft" || !org?.profile_completed;
  const pendingApproval = org?.kyc_status === "pending" && !!org?.profile_completed;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-50/40 to-background dark:from-teal-950/20 md:min-h-0">
      {!desktopShell && (
        <header className="border-b bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
            <PageBackButton fallbackTo="/home" shape="xl" />
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {lang === "bn" ? "ওভারভিউ" : "Overview"}
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
              onClick={() => void signOutPortal()}
              className="grid h-9 w-9 place-items-center rounded-xl border"
              aria-label={lang === "bn" ? "লগআউট" : "Sign out"}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:max-w-6xl">
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

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold">{lang === "bn" ? "ডেস্কসমূহ" : "Desks"}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lang === "bn"
                ? "প্রয়োজনীয় ডেস্ক কার্ড থেকে খুলুন"
                : "Open a desk from the cards below"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {showDesk && (
              <Link
                to="/care/portal/desk"
                className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-teal-500/50 hover:shadow-md"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-teal-700">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{lang === "bn" ? "চেম্বার ডেস্ক" : "Chamber desk"}</h3>
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
                <h3 className="font-bold">{lang === "bn" ? "ল্যাব ডেস্ক" : "Lab desk"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "টেস্ট অফার, ক্যালেন্ডার ও চেক-ইন"
                    : "Offerings, calendar & check-in"}
                </p>
              </Link>
            )}
            {showOperation && (
              <Link
                to="/care/portal/operation"
                className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-teal-500/50 hover:shadow-md"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-teal-700">
                  <Hospital className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{lang === "bn" ? "অপারেশন ডেস্ক" : "Operation desk"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "অপারেশন অফার ও বুকিং কিউ"
                    : "Operation offerings & booking queue"}
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
                <h3 className="font-bold">
                  {lang === "bn" ? "অ্যাম্বুলেন্স প্যানেল" : "Ambulance panel"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "bn" ? "ডিসপ্যাচ, ফ্লিট ও প্রাইসিং" : "Dispatch, fleet & pricing"}
                </p>
              </Link>
            )}
          </div>
        </section>

        {!showDesk && !showLab && !showOperation && !showAmbulance && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {lang === "bn"
              ? "আপনার ভূমিকায় কোনো ডেস্ক প্যানেল নেই। মালিকের সাথে যোগাযোগ করুন।"
              : "No desk panels for your role. Contact the organization owner."}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            to="/care/portal/about"
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
          >
            <Building2 className="h-3.5 w-3.5" />
            {lang === "bn" ? "প্রতিষ্ঠান সম্পর্কে" : "About institute"}
          </Link>
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
