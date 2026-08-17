import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaTypeahead } from "@/components/district/UpazilaTypeahead";
import { useAuth } from "@/lib/auth-context";
import type { District } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { CareVendorFieldKey } from "@/lib/care-cms";
import { clampPhoneDigits } from "@/lib/phone-auth";
import {
  careOrgKycLabel,
  fetchOwnerCareOrgId,
  fieldEnabled,
  fieldLabel,
  fieldRequired,
  loadVendorOnboardingBundle,
  saveCareVendorProfile,
  submitCareVendorProfile,
  vendorProfileProgress,
  type CareVendorOrg,
} from "@/lib/care-vendor-auth";

export function CareVendorOnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const search = useSearch({ strict: false }) as { welcome?: boolean };
  const [orgId, setOrgId] = useState<string | null>(null);
  const [org, setOrg] = useState<CareVendorOrg | null>(null);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadVendorOnboardingBundle>>["settings"] | null>(null);
  const [vendorTypes, setVendorTypes] = useState<Awaited<ReturnType<typeof loadVendorOnboardingBundle>>["types"]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgNameBn, setOrgNameBn] = useState("");
  const [orgKindSlug, setOrgKindSlug] = useState("chamber");
  const [orgPhone, setOrgPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [locationName, setLocationName] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/care/auth" });
      return;
    }
    void (async () => {
      const id = await fetchOwnerCareOrgId();
      if (!id) {
        void navigate({ to: "/care/auth", search: { mode: "register", next: undefined } });
        return;
      }
      const bundle = await loadVendorOnboardingBundle(id);
      if (bundle.membership?.role !== "owner") {
        toast.error(lang === "bn" ? "শুধু মালিক প্রোফাইল সম্পাদনা করতে পারেন" : "Only owner can edit profile");
        void navigate({ to: "/care/portal" });
        return;
      }
      setOrgId(id);
      setOrg(bundle.org);
      setSettings(bundle.settings);
      setVendorTypes(bundle.types);

      const { data: prof } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
      setOwnerName((prof as { full_name?: string } | null)?.full_name ?? "");
      const o = bundle.org;
      if (o) {
        setOrgName(o.name === o.phone ? "" : o.name ?? "");
        setOrgNameBn(o.name_bn ?? "");
        setOrgPhone(o.phone ?? (prof as { phone?: string } | null)?.phone ?? "");
        setEmail(o.email ?? "");
        setDescription(o.description ?? "");
        setUpazila(o.upazila ?? "");
        setAddress(o.address ?? "");
        const kind = bundle.types.find((t) => t.id === o.org_kind_id);
        if (kind) setOrgKindSlug(kind.slug);
        if (o.district_id) {
          const { data: d } = await supabase
            .from("districts")
            .select("id,name_bn,name_en,slug,is_active,sort_order")
            .eq("id", o.district_id)
            .maybeSingle();
          if (d) setDistrict(d as District);
        }
      }
      setReady(true);
    })().catch((e) => {
      toast.error((e as Error).message);
      void navigate({ to: "/care/portal" });
    });
  }, [loading, user, navigate, lang]);

  const progress = useMemo(
    () =>
      vendorProfileProgress(
        {
          ...org,
          name: orgName || org?.name,
          name_bn: orgNameBn,
          phone: orgPhone,
          email,
          description,
          district_id: district?.id ?? org?.district_id,
          upazila,
          address,
          org_kind_id: vendorTypes.find((t) => t.slug === orgKindSlug)?.id ?? org?.org_kind_id,
        },
        ownerName,
        settings ?? { fields: {} as never },
      ),
    [org, orgName, orgNameBn, orgPhone, email, description, district, upazila, address, orgKindSlug, vendorTypes, ownerName, settings],
  );

  function payload() {
    return {
      ownerName,
      orgName,
      orgNameBn,
      orgKindSlug,
      orgPhone,
      email,
      description,
      districtId: district?.id ?? null,
      upazila,
      address,
      locationName,
    };
  }

  async function handleSave(showToast = true) {
    if (!orgId) return;
    setBusy(true);
    try {
      await saveCareVendorProfile(orgId, payload());
      const refreshed = await loadVendorOnboardingBundle(orgId);
      setOrg(refreshed.org);
      if (showToast) {
        toast.success(lang === "bn" ? "খসড়া সংরক্ষিত" : "Draft saved");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    try {
      await saveCareVendorProfile(orgId, payload());
      await submitCareVendorProfile(orgId);
      toast.success(
        lang === "bn"
          ? "প্রোফাইল জমা দেওয়া হয়েছে — অ্যাডমিন অনুমোদনের অপেক্ষায়"
          : "Profile submitted — awaiting admin approval",
      );
      void navigate({ to: "/care/portal" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !settings || !orgId) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const kycLabel = careOrgKycLabel(org, lang);
  const submitted = org?.kyc_status === "pending" && org.profile_completed;
  const verified = !!org?.is_verified;

  const show = (key: CareVendorFieldKey) => fieldEnabled(settings, key);
  const req = (key: CareVendorFieldKey) => fieldRequired(settings, key);
  const lbl = (key: CareVendorFieldKey) => fieldLabel(settings, key, lang);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-50/50 to-background dark:from-teal-950/20">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/care/portal" className="grid h-9 w-9 place-items-center rounded-xl border">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "ভেন্ডর প্রোফাইল" : "Vendor profile"}
            </p>
            <h1 className="truncate text-base font-bold">
              {lang === "bn" ? "প্রতিষ্ঠানের তথ্য" : "Organization setup"}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-teal-700">{progress.percent}%</p>
            <p className="text-[10px] text-muted-foreground">{kycLabel}</p>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        {search.welcome && (
          <div className="mb-5 rounded-2xl border border-teal-200 bg-teal-50/80 p-4 dark:border-teal-900 dark:bg-teal-950/30">
            <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">
              {lang === "bn" ? "স্বাগতম! প্রোফাইল সম্পূর্ণ করুন" : "Welcome! Complete your profile"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "এখনই পূরণ করুন, অথবা পরে পোর্টাল থেকে ফিরে আসুন।"
                : "Fill in now, or return anytime from the portal."}
            </p>
          </div>
        )}

        {verified && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            {lang === "bn" ? "আপনার প্রতিষ্ঠান অনুমোদিত। তথ্য আপডেট করলে পুনরায় পর্যালোচনা হতে পারে।" : "Your organization is approved. Updates may require re-review."}
          </div>
        )}

        {submitted && !verified && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            {lang === "bn"
              ? "প্রোফাইল জমা দেওয়া হয়েছে। অ্যাডমিন অনুমোদনের জন্য অপেক্ষা করুন। তথ্য এডিট করে পুনরায় জমা দিতে পারেন।"
              : "Profile submitted. Waiting for admin approval. You can edit and resubmit."}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {(show("owner_name") || show("org_name") || show("org_kind") || show("org_phone")) && (
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-700" />
                <h2 className="text-sm font-bold">{lang === "bn" ? "মৌলিক তথ্য" : "Basic info"}</h2>
              </div>
              <div className="space-y-3">
                {show("owner_name") && (
                  <Field label={lbl("owner_name")} required={req("owner_name")} value={ownerName} onChange={setOwnerName} />
                )}
                {show("org_kind") && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {lbl("org_kind")}{req("org_kind") ? " *" : ""}
                    </label>
                    <select
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                      value={orgKindSlug}
                      onChange={(e) => setOrgKindSlug(e.target.value)}
                      required={req("org_kind")}
                    >
                      {vendorTypes.filter((t) => t.is_active).map((k) => (
                        <option key={k.slug} value={k.slug}>
                          {lang === "bn" ? k.name_bn : k.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {show("org_name") && (
                  <Field label={lbl("org_name")} required={req("org_name")} value={orgName} onChange={setOrgName} />
                )}
                {show("org_name_bn") && (
                  <Field label={lbl("org_name_bn")} required={req("org_name_bn")} value={orgNameBn} onChange={setOrgNameBn} />
                )}
                {show("org_phone") && (
                  <Field label={lbl("org_phone")} required={req("org_phone")} value={orgPhone} onChange={setOrgPhone} inputMode="tel" />
                )}
                {show("email") && (
                  <Field label={lbl("email")} required={req("email")} value={email} onChange={setEmail} type="email" />
                )}
              </div>
            </section>
          )}

          {(show("district") || show("upazila") || show("address") || show("location_name")) && (
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-700" />
                <h2 className="text-sm font-bold">{lang === "bn" ? "অবস্থান" : "Location"}</h2>
              </div>
              <div className="space-y-3">
                {show("district") && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {lbl("district")}{req("district") ? " *" : ""}
                    </label>
                    <DistrictTypeahead value={district} onChange={setDistrict} required={req("district")} />
                  </div>
                )}
                {show("upazila") && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {lbl("upazila")}{req("upazila") ? " *" : ""}
                    </label>
                    <UpazilaTypeahead
                      district={district}
                      value={upazila}
                      onChange={setUpazila}
                      required={req("upazila")}
                    />
                  </div>
                )}
                {show("address") && (
                  <Field label={lbl("address")} required={req("address")} value={address} onChange={setAddress} />
                )}
                {show("location_name") && (
                  <Field label={lbl("location_name")} required={req("location_name")} value={locationName} onChange={setLocationName} />
                )}
              </div>
            </section>
          )}

          {show("description") && (
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {lbl("description")}{req("description") ? " *" : ""}
              </label>
              <textarea
                className="min-h-[88px] w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-teal-600/30 focus:ring-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required={req("description")}
              />
            </section>
          )}

          <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {lang === "bn" ? "খসড়া সংরক্ষণ" : "Save draft"}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-teal-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {lang === "bn" ? "অনুমোদনের জন্য জমা দিন" : "Submit for approval"}
              </button>
            </div>
            <Link
              to="/care/portal"
              className="mt-3 block text-center text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {lang === "bn" ? "পরে সম্পূর্ণ করব → পোর্টালে যান" : "Complete later → go to portal"}
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: "tel" | "text" | "email";
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        maxLength={inputMode === "tel" ? 11 : undefined}
        onChange={(e) => onChange(inputMode === "tel" ? clampPhoneDigits(e.target.value) : e.target.value)}
        required={required}
        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-teal-600/30 focus:ring-2"
      />
    </div>
  );
}
