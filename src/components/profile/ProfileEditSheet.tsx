import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaTypeahead } from "@/components/district/UpazilaTypeahead";
import type { District } from "@/lib/api";
import { ProfileToggle } from "@/components/profile/ProfileToggle";
import { X } from "lucide-react";

const inp =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export function ProfileEditSheet({
  open,
  onClose,
  lang,
  t,
  profile,
  setProfile,
  district,
  setDistrict,
  upazila,
  setUpazila,
  age,
  setAge,
  busy,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  lang: "bn" | "en";
  t: (k: string) => string;
  profile: Record<string, unknown>;
  setProfile: (p: Record<string, unknown>) => void;
  district: District | null;
  setDistrict: (d: District | null) => void;
  upazila: string;
  setUpazila: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  busy: boolean;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative bg-background rounded-t-2xl sm:rounded-2xl sm:mx-auto sm:max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl safe-bottom">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
          <h3 className="font-bold">{lang === "bn" ? "প্রোফাইল সম্পাদনা" : "Edit profile"}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Field label={t("fullName")}>
            <input
              className={inp}
              value={(profile.full_name as string) ?? ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </Field>
          <Field label={t("phone")}>
            <input
              className={inp}
              value={(profile.phone as string) ?? ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("bloodGroup")}>
              <select
                className={inp}
                value={(profile.blood_group as string) ?? ""}
                onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
              >
                <option value="">—</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label={t("gender")}>
              <select
                className={inp}
                value={String(profile.gender ?? "").toLowerCase()}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">{t("male")}</option>
                <option value="female">{t("female")}</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("lastDonation")}>
              <input
                className={inp}
                type="date"
                value={(profile.last_donation_date as string) ?? ""}
                onChange={(e) => setProfile({ ...profile, last_donation_date: e.target.value })}
              />
            </Field>
            <Field label={t("ageOptional")}>
              <input
                className={inp}
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </Field>
          </div>
          <Field label={lang === "bn" ? "জেলা" : "District"}>
            <DistrictTypeahead
              value={district}
              onChange={(d) => {
                setDistrict(d);
                setUpazila("");
              }}
            />
          </Field>
          <Field label={t("upazila")}>
            <UpazilaTypeahead
              key={district?.id ?? "none"}
              district={district}
              value={upazila}
              onChange={setUpazila}
            />
          </Field>
          <Field label={t("bio")}>
            <textarea
              className={inp}
              rows={3}
              value={(profile.bio as string) ?? ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
          </Field>
          <ProfileToggle
            label={lang === "bn" ? "দানের জন্য উপলব্ধ" : "Available to donate"}
            checked={!!profile.is_available}
            onChange={(v) => setProfile({ ...profile, is_available: v })}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
