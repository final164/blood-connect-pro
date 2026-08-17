import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  FlaskConical,
  Loader2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchAllDistricts, type District } from "@/lib/api";
import { fetchCareVendorTypes, type CareVendorType } from "@/lib/care-cms";
import { fetchMyCareMemberships } from "@/lib/care-access";
import { useI18n } from "@/lib/i18n";
import { isValidPhone, isValidPin, normalizePhone } from "@/lib/phone-auth";
import {
  authErrorMessage,
  loginWithPhonePin,
  registerWithPhonePin,
} from "@/lib/phone-session";
import { registerCareVendorOrg, resolveCarePortalPath } from "@/lib/care-vendor-auth";

type Mode = "login" | "register";

type CareAuthSearch = {
  mode?: Mode;
  next?: string;
};

const VENDOR_KIND_FALLBACK: CareVendorType[] = [
  {
    id: "chamber",
    slug: "chamber",
    name_bn: "চেম্বার / ক্লিনিক",
    name_en: "Chamber / Clinic",
    panels: ["desk"],
    is_active: true,
    sort_order: 10,
  },
  {
    id: "lab",
    slug: "lab",
    name_bn: "ডায়াগনস্টিক ল্যাব",
    name_en: "Diagnostic lab",
    panels: ["lab"],
    is_active: true,
    sort_order: 20,
  },
];

export function CareAuthPage() {
  const { lang, setLang } = useI18n();
  const { session, loading, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as CareAuthSearch;
  const [mode, setMode] = useState<Mode>(search.mode === "register" ? "register" : "login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgNameBn, setOrgNameBn] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgKind, setOrgKind] = useState("chamber");
  const [districtId, setDistrictId] = useState("");
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [locationName, setLocationName] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [vendorKinds, setVendorKinds] = useState<CareVendorType[]>(VENDOR_KIND_FALLBACK);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchAllDistricts().then(setDistricts).catch(() => setDistricts([]));
    void fetchCareVendorTypes().then((rows) => {
      if (rows.length) setVendorKinds(rows.filter((r) => r.slug !== "patient"));
    });
  }, []);

  useEffect(() => {
    if (loading || !session || isAnonymous) return;
    void (async () => {
      const next = search.next?.trim();
      if (next?.startsWith("/care/portal")) {
        void navigate({ to: next as "/care/portal/desk" });
        return;
      }
      const rows = await fetchMyCareMemberships();
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (active.length) {
        const path = await resolveCarePortalPath(active[0]!);
        void navigate({ to: path as "/care/portal/desk" });
      } else if (mode === "register") {
        return;
      } else {
        void navigate({ to: "/care/portal" });
      }
    })();
  }, [session, loading, isAnonymous, navigate, search.next, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const normalized = normalizePhone(phone);
      if (!isValidPhone(normalized)) {
        toast.error(
          lang === "bn"
            ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)"
            : "Enter a valid mobile number (01XXXXXXXXX)",
        );
        return;
      }
      if (!isValidPin(pin)) {
        toast.error(lang === "bn" ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
        return;
      }

      if (mode === "register") {
        if (pin !== confirmPin) {
          toast.error(lang === "bn" ? "PIN মিলছে না" : "PINs do not match");
          return;
        }
        if (!orgName.trim()) {
          toast.error(lang === "bn" ? "প্রতিষ্ঠানের নাম দিন" : "Organization name is required");
          return;
        }

        await registerWithPhonePin({
          phone: normalized,
          pin,
          confirmPin,
          fullName: ownerName.trim() || orgName.trim() || normalized,
        });

        await registerCareVendorOrg({
          orgName: orgName.trim(),
          orgNameBn: orgNameBn.trim() || undefined,
          orgPhone: orgPhone.trim() || normalized,
          orgKindSlug: orgKind,
          districtId: districtId || null,
          upazila: upazila.trim() || undefined,
          address: address.trim() || undefined,
          locationName: locationName.trim() || undefined,
        });

        toast.success(
          lang === "bn"
            ? "কেয়ার ভেন্ডর অ্যাকাউন্ট তৈরি হয়েছে — KYC পর্যালোচনার জন্য অপেক্ষা করুন"
            : "Care vendor account created — pending KYC review",
        );

        const path = await resolveCarePortalPath();
        void navigate({ to: path as "/care/portal/desk" });
        return;
      }

      await loginWithPhonePin({ phone: normalized, pin });
      const rows = await fetchMyCareMemberships();
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (!active.length) {
        toast.error(
          lang === "bn"
            ? "এই নম্বরে কেয়ার ভেন্ডর অ্যাকাউন্ট নেই — নিবন্ধন করুন"
            : "No care vendor account on this number — please register",
        );
        setMode("register");
        setOrgPhone(normalized);
        return;
      }

      const next = search.next?.trim();
      if (next?.startsWith("/care/portal")) {
        void navigate({ to: next as "/care/portal/desk" });
        return;
      }
      const path = await resolveCarePortalPath(active[0]!);
      toast.success(lang === "bn" ? "লগইন হয়েছে" : "Signed in");
      void navigate({ to: path as "/care/portal/desk" });
    } catch (err) {
      const raw = (err as Error)?.message || String(err);
      toast.error(authErrorMessage(raw, lang));
    } finally {
      setBusy(false);
    }
  }

  const copy = {
    title: lang === "bn" ? "BloodLink Care" : "BloodLink Care",
    subtitle:
      lang === "bn"
        ? "চেম্বার, ক্লিনিক ও ল্যাবের জন্য পেশাদার পোর্টাল"
        : "Professional portal for chambers, clinics & labs",
    login: lang === "bn" ? "ভেন্ডর লগইন" : "Vendor login",
    register: lang === "bn" ? "নতুন ভেন্ডর নিবন্ধন" : "New vendor registration",
    patientLink: lang === "bn" ? "রোগী হিসেবে লগইন" : "Sign in as patient",
  };

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-background">
      <aside className="relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-950 text-white lg:w-[42%] xl:w-[38%]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
        <div className="relative flex min-h-[220px] lg:min-h-dvh flex-col justify-between p-8 lg:p-12">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight">{copy.title}</h1>
            <p className="mt-2 max-w-sm text-sm text-teal-100/90">{copy.subtitle}</p>
          </div>
          <ul className="mt-8 hidden space-y-4 text-sm text-teal-50/90 lg:block">
            <li className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "bn"
                ? "চেম্বার ডেস্ক — সিরিয়াল, কিউ ও ওয়াক-ইন"
                : "Chamber desk — serials, queue & walk-ins"}
            </li>
            <li className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "bn"
                ? "ল্যাব ডেস্ক — টেস্ট অফার, স্লট ও চেক-ইন"
                : "Lab desk — offerings, slots & check-in"}
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "bn"
                ? "KYC ভেরিফিকেশনের পর রোগীদের কাছে লিস্টেড"
                : "Listed for patients after KYC verification"}
            </li>
          </ul>
          <p className="mt-6 text-xs text-teal-200/70">
            © {new Date().getFullYear()} BloodLink Care
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="lg:hidden">
              <h2 className="text-xl font-bold">{copy.title}</h2>
              <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
            </div>
            <div className="ml-auto flex rounded-xl border p-0.5 text-xs">
              {(["bn", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-lg px-2.5 py-1 font-semibold ${lang === l ? "bg-teal-600 text-white" : "text-muted-foreground"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-lg shadow-teal-900/5">
            <div className="mb-5 flex gap-1 rounded-2xl bg-muted/80 p-1">
              {(
                [
                  ["login", copy.login],
                  ["register", copy.register],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                    mode === m ? "bg-teal-600 text-white shadow" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              <Field
                label={lang === "bn" ? "মালিকের মোবাইল" : "Owner mobile"}
                value={phone}
                onChange={setPhone}
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                required
              />

              {mode === "register" && (
                <Field
                  label={lang === "bn" ? "মালিকের নাম" : "Owner name"}
                  value={ownerName}
                  onChange={setOwnerName}
                  placeholder={lang === "bn" ? "ডাঃ … / প্রতিষ্ঠান প্রতিনিধি" : "Dr. … / representative"}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="PIN"
                  value={pin}
                  onChange={setPin}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  required
                />
                {mode === "register" ? (
                  <Field
                    label={lang === "bn" ? "PIN নিশ্চিত" : "Confirm PIN"}
                    value={confirmPin}
                    onChange={setConfirmPin}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    required
                  />
                ) : null}
              </div>

              {mode === "register" && (
                <>
                  <hr className="border-dashed" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "bn" ? "প্রতিষ্ঠানের তথ্য" : "Organization details"}
                  </p>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {lang === "bn" ? "ভেন্ডর ধরন" : "Vendor type"}
                    </label>
                    <select
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                      value={orgKind}
                      onChange={(e) => setOrgKind(e.target.value)}
                    >
                      {vendorKinds.map((k) => (
                        <option key={k.slug} value={k.slug}>
                          {lang === "bn" ? k.name_bn : k.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Field
                    label={lang === "bn" ? "প্রতিষ্ঠানের নাম (ইংরেজি)" : "Organization name (English)"}
                    value={orgName}
                    onChange={setOrgName}
                    required
                  />
                  <Field
                    label={lang === "bn" ? "প্রতিষ্ঠানের নাম (বাংলা)" : "Organization name (Bangla)"}
                    value={orgNameBn}
                    onChange={setOrgNameBn}
                  />
                  <Field
                    label={lang === "bn" ? "প্রতিষ্ঠান ফোন" : "Organization phone"}
                    value={orgPhone}
                    onChange={setOrgPhone}
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                  />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {lang === "bn" ? "জেলা" : "District"}
                    </label>
                    <select
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                      value={districtId}
                      onChange={(e) => setDistrictId(e.target.value)}
                    >
                      <option value="">{lang === "bn" ? "নির্বাচন করুন" : "Select"}</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {lang === "bn" ? d.name_bn : d.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label={lang === "bn" ? "উপজেলা / এলাকা" : "Upazila / area"}
                    value={upazila}
                    onChange={setUpazila}
                  />
                  <Field
                    label={lang === "bn" ? "ঠিকানা" : "Address"}
                    value={address}
                    onChange={setAddress}
                  />
                  <Field
                    label={lang === "bn" ? "শাখা / চেম্বার নাম (ঐচ্ছিক)" : "Branch / chamber name (optional)"}
                    value={locationName}
                    onChange={setLocationName}
                  />
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 hover:bg-teal-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login"
                  ? lang === "bn"
                    ? "পোর্টালে প্রবেশ"
                    : "Enter portal"
                  : lang === "bn"
                    ? "ভেন্ডর হিসেবে নিবন্ধন"
                    : "Register as vendor"}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {lang === "bn" ? "রক্তদান বা রোগী অ্যাকাউন্ট?" : "Blood donation or patient account?"}{" "}
            <Link to="/auth" className="font-semibold text-teal-700 hover:underline">
              {copy.patientLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-teal-600/30 focus:ring-2"
        {...rest}
      />
    </div>
  );
}
