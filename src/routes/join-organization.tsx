import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  fetchCommunityOrgRegistrationSettings,
  registerCommunityOrg,
} from "@/lib/community-org-auth";
import { type District } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { normalizePhone, isValidPhone } from "@/lib/phone-auth";
import { PageBackButton } from "@/components/nav/PageBackButton";

export const Route = createFileRoute("/join-organization")({
  head: () => ({
    meta: [
      { title: "Organization registration — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: JoinOrganizationPage,
});

function JoinOrganizationPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, loading, isAnonymous } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [district, setDistrict] = useState<District | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [done, setDone] = useState<"pending" | "verified" | null>(null);

  useEffect(() => {
    void fetchCommunityOrgRegistrationSettings().then((s) =>
      setAutoApprove(s.auto_approve_registration),
    );
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || isAnonymous) {
      void navigate({
        to: "/auth",
        search: { next: "/join-organization" },
      });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(bn ? "অর্গানাইজেশনের নাম দিন" : "Enter organization name");
      return;
    }
    const phoneNorm = normalizePhone(phone);
    if (!isValidPhone(phoneNorm)) {
      toast.error(bn ? "সঠিক মোবাইল নম্বর দিন" : "Enter a valid phone number");
      return;
    }
    setBusy(true);
    try {
      const result = await registerCommunityOrg({
        name: trimmed,
        nameBn: nameBn.trim() || undefined,
        phone: phoneNorm,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        districtId: district?.id ?? null,
      });
      if (result.kycStatus === "verified" || result.autoApproved) {
        setDone("verified");
        toast.success(
          bn ? "অর্গানাইজেশন অনুমোদিত — পোর্টাল খুলছে" : "Organization approved — opening portal",
        );
        window.setTimeout(() => void navigate({ to: "/org" }), 700);
      } else {
        setDone("pending");
        toast.success(
          bn
            ? "আবেদন জমা হয়েছে — অ্যাডমিন অনুমোদনের অপেক্ষায়"
            : "Application submitted — awaiting admin approval",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.12] via-background to-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <PageBackButton fallbackTo="/auth" />
          <Link
            to="/auth"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {bn ? "ব্যক্তিগত অ্যাকাউন্ট" : "Personal account"}
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border bg-card/95 shadow-xl shadow-primary/5 backdrop-blur">
          <div className="relative border-b bg-gradient-to-br from-primary/15 via-card to-card px-6 py-8 sm:px-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><circle cx=%222%22 cy=%222%22 r=%221%22 fill=%22%23C1121F%22 fill-opacity=%220.08%22/></svg>')] opacity-70" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3 max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Muktosheba Organization
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {bn
                    ? "আপনার সংস্থাকে প্ল্যাটফর্মে যুক্ত করুন"
                    : "Register your organization on the platform"}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {bn
                    ? "রক্তদাতা তালিকা, রিকোয়েস্ট ইনবক্স ও টিম ম্যানেজমেন্ট — একটি অর্গানাইজেশন পোর্টালে।"
                    : "Donor lists, request inbox, and team management — in one organization portal."}
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Building2 className="h-7 w-7" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-10 sm:py-8 md:grid-cols-[1fr_1.15fr]">
            <aside className="space-y-4 order-2 md:order-1">
              <Benefit
                icon={Users}
                title={bn ? "রক্তদাতা নেটওয়ার্ক" : "Donor network"}
                body={
                  bn
                    ? "জেলাভিত্তিক ডোনার তালিকা আমদানি ও ম্যানেজ করুন।"
                    : "Import and manage district-based donor directories."
                }
              />
              <Benefit
                icon={Shield}
                title={bn ? "টিম ও পারমিশন" : "Team & permissions"}
                body={
                  bn
                    ? "মালিক, এডিটর ও ভিউয়ার রোল দিয়ে নিয়ন্ত্রণ রাখুন।"
                    : "Control access with owner, editor, and viewer roles."
                }
              />
              <Benefit
                icon={BadgeCheck}
                title={bn ? "যাচাইকৃত তালিকা" : "Verified listing"}
                body={
                  autoApprove
                    ? bn
                      ? "অটো-অ্যাপ্রুভ চালু — আবেদন সঙ্গে সঙ্গে অনুমোদিত হবে।"
                      : "Auto-approve is on — your org is approved immediately."
                    : bn
                      ? "অ্যাডমিন অনুমোদনের পর কমিউনিটিতে প্রকাশিত হবে।"
                      : "Published on Community after admin approval."
                }
              />
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                  {bn ? "অনুমোদন প্রক্রিয়া" : "Approval process"}
                </div>
                {autoApprove
                  ? bn
                    ? "আবেদন জমা দিলেই পোর্টাল ব্যবহার শুরু করতে পারবেন।"
                    : "You can start using the portal right after submitting."
                  : bn
                    ? "আবেদন জমা হবে → অ্যাডমিন রিভিউ → অনুমোদিত হলে কমিউনিটিতে দেখা যাবে। পোর্টাল সেটআপ আগেই করা যাবে।"
                    : "Submit → admin review → listed on Community when approved. You can still set up the portal while pending."}
              </div>
            </aside>

            <div className="order-1 md:order-2">
              {done === "pending" ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-700">
                    <Clock3 className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">
                      {bn ? "আবেদন জমা হয়েছে" : "Application submitted"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {bn
                        ? "আপনার অর্গানাইজেশন অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। ইতিমধ্যে পোর্টালে প্রোফাইল ও ডোনার সেটআপ করতে পারেন।"
                        : "Your organization is awaiting admin approval. You can already set up profile and donors in the portal."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void navigate({ to: "/org" })}
                    className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                  >
                    {bn ? "পোর্টালে যান" : "Open portal"}
                  </button>
                </div>
              ) : done === "verified" ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <p className="font-semibold">{bn ? "অনুমোদিত — পোর্টালে যাচ্ছি…" : "Approved — opening portal…"}</p>
                </div>
              ) : !user || isAnonymous ? (
                <div className="rounded-2xl border bg-muted/30 p-6 space-y-4">
                  <h2 className="text-base font-semibold">
                    {bn ? "প্রথমে অ্যাকাউন্ট দিয়ে প্রবেশ করুন" : "Sign in with your account first"}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {bn
                      ? "যে কেউ Organization হিসেবে রেজিস্টার করতে পারেন। লগইন/সাইন আপের পর আবেদন ফর্ম খুলবে।"
                      : "Anyone can register as an Organization. After login/sign-up the application form opens."}
                  </p>
                  <Link
                    to="/auth"
                    search={{ next: "/join-organization" }}
                    className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                  >
                    {bn ? "লগইন / সাইন আপ করে চালিয়ে যান" : "Continue with login / sign up"}
                  </Link>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-3.5">
                  <h2 className="text-base font-semibold">
                    {bn ? "সংস্থার তথ্য" : "Organization details"}
                  </h2>
                  <Field
                    label={bn ? "সংস্থার নাম (ইংরেজি) *" : "Organization name (English) *"}
                    value={name}
                    onChange={setName}
                    required
                    placeholder="e.g. Red Crescent Youth Unit"
                  />
                  <Field
                    label={bn ? "নাম (বাংলা)" : "Name (Bangla)"}
                    value={nameBn}
                    onChange={setNameBn}
                    placeholder="যেমন: রেড ক্রিসেন্ট যুব ইউনিট"
                  />
                  <Field
                    label={bn ? "যোগাযোগের মোবাইল *" : "Contact mobile *"}
                    value={phone}
                    onChange={setPhone}
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    required
                  />
                  <Field
                    label={bn ? "ইমেইল (ঐচ্ছিক)" : "Email (optional)"}
                    value={email}
                    onChange={setEmail}
                    type="email"
                    placeholder="org@example.com"
                  />
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                      {bn ? "জেলা" : "District"}
                    </label>
                    <DistrictTypeahead
                      value={district}
                      onChange={setDistrict}
                      placeholder={bn ? "জেলা খুঁজুন" : "Search district"}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                      {bn ? "সংক্ষিপ্ত পরিচিতি" : "Short introduction"}
                    </label>
                    <textarea
                      className="w-full min-h-[88px] rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        bn
                          ? "আপনার সংস্থা কী করে — সংক্ষেপে লিখুন"
                          : "Briefly describe what your organization does"
                      }
                      maxLength={500}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                    {busy ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    ) : autoApprove ? (
                      bn ? (
                        "রেজিস্টার করে পোর্টালে যান"
                      ) : (
                        "Register & open portal"
                      )
                    ) : bn ? (
                      "আবেদন জমা দিন"
                    ) : (
                      "Submit application"
                    )}
                  </button>
                  <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                    {bn
                      ? "জমা দিয়ে আপনি নিশ্চিত করছেন যে তথ্য সঠিক এবং সংস্থার প্রতিনিধিত্ব করার অনুমতি আছে।"
                      : "By submitting, you confirm the details are accurate and you are authorized to represent this organization."}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Users;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border bg-background/60 px-3.5 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  inputMode,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  inputMode?: "tel" | "text";
  type?: "text" | "email";
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        type={type}
      />
    </div>
  );
}
