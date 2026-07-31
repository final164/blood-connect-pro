import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaTypeahead } from "@/components/district/UpazilaTypeahead";
import type { District } from "@/lib/api";
import {
  ageFromDateOfBirth,
  dateOfBirthFromAge,
  isProfileComplete,
} from "@/lib/onboarding";
import { Droplet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [{ title: "Complete profile — BloodLink" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [age, setAge] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (isProfileComplete(data)) {
        void navigate({ to: "/home" });
        return;
      }
      if (data?.blood_group) setBloodGroup(data.blood_group);
      const g = (data?.gender ?? "").toLowerCase();
      if (g === "male" || g === "female") setGender(g);
      if (data?.area) setUpazila(data.area);
      setAge(ageFromDateOfBirth(data?.date_of_birth));
      if (data?.district_id) {
        const { data: d } = await supabase
          .from("districts")
          .select("id,name_bn,name_en,slug,is_active,sort_order")
          .eq("id", data.district_id)
          .maybeSingle();
        if (!cancelled && d) setDistrict(d as District);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!bloodGroup) return toast.error(lang === "bn" ? "রক্তের গ্রুপ দিন" : "Select blood group");
    if (!gender) return toast.error(lang === "bn" ? "লিঙ্গ সিলেক্ট করুন" : "Select gender");
    if (!district) return toast.error(lang === "bn" ? "জেলা সিলেক্ট করুন" : "Select district");
    if (!upazila.trim()) return toast.error(lang === "bn" ? "উপজেলা সিলেক্ট করুন" : "Select upazila");

    const ageNum = age.trim() ? Number(age) : null;
    if (age.trim() && (!Number.isFinite(ageNum) || ageNum! < 1 || ageNum! > 120)) {
      return toast.error(lang === "bn" ? "সঠিক বয়স দিন" : "Enter a valid age");
    }

    setBusy(true);
    const payload: Record<string, unknown> = {
      blood_group: bloodGroup,
      gender,
      district_id: district.id,
      city: lang === "bn" ? district.name_bn : district.name_en,
      area: upazila.trim(),
    };
    const dob = ageNum != null ? dateOfBirthFromAge(ageNum) : null;
    if (dob) payload.date_of_birth = dob;

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    void navigate({ to: "/home" });
  }

  if (!ready) {
    return (
      <div className="min-h-[60dvh] grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="flex-1 flex flex-col justify-center px-4 py-8 safe-top safe-bottom">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25">
              <Droplet className="h-5 w-5" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{t("completeProfile")}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t("completeProfileHint")}</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label={t("bloodGroup")} required>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setBloodGroup(g)}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                      bloodGroup === g
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "bg-card hover:bg-muted"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("gender")} required>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "male" as const, label: t("male") },
                    { id: "female" as const, label: t("female") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGender(opt.id)}
                    className={`rounded-xl border py-3 text-sm font-semibold transition ${
                      gender === opt.id
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "bg-card hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("district")} required>
              <DistrictTypeahead
                value={district}
                onChange={(d) => {
                  setDistrict(d);
                  setUpazila("");
                }}
                required
              />
            </Field>

            <Field label={t("upazila")} required>
              <UpazilaTypeahead
                key={district?.id ?? "none"}
                district={district}
                value={upazila}
                onChange={setUpazila}
                required
              />
            </Field>

            <Field label={t("ageOptional")}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                className={inp}
                value={age}
                placeholder={lang === "bn" ? "যেমন: ২৫" : "e.g. 25"}
                onChange={(e) => setAge(e.target.value)}
              />
            </Field>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {busy ? t("saving") : t("continue")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
        {label}
        {required ? <span className="text-primary ml-0.5">*</span> : null}
      </label>
      {children}
    </div>
  );
}
