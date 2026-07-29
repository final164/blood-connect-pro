import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import type { District } from "@/lib/api";
import { Settings as SettingsIcon, HeartHandshake, Award, Shield } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — BloodLink" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(async ({ data }) => {
      setProfile(data ?? {});
      if (data?.district_id) {
        const { data: d } = await supabase
          .from("districts")
          .select("id,name_bn,name_en,slug,is_active,sort_order")
          .eq("id", data.district_id)
          .maybeSingle();
        if (d) setDistrict(d as District);
      }
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        phone: profile.phone,
        blood_group: profile.blood_group || null,
        district_id: district?.id ?? null,
        city: district ? (lang === "bn" ? district.name_bn : district.name_en) : profile.city,
        is_available: !!profile.is_available,
        last_donation_date: profile.last_donation_date || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(t("saved"));
  }

  if (!profile) return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;

  return (
    <div className="w-full">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserMenuTrigger />
            <h1 className="text-base font-bold">{t("profile")}</h1>
          </div>
          <div className="flex items-center gap-1">
            <ChatHeaderButton />
            {isAdmin && (
              <Link to="/admin" className="p-1.5 rounded-lg hover:bg-muted text-primary">
                <Shield className="h-4 w-4" />
              </Link>
            )}
            <Link to="/settings" className="p-1.5 rounded-lg hover:bg-muted">
              <SettingsIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 md:max-w-3xl">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} src={profile.avatar_url ?? undefined} size={64} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">{profile.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          {profile.blood_group && (
            <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-bold text-lg shadow-md shadow-primary/25">
              {profile.blood_group}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <Stat icon={<HeartHandshake className="h-4 w-4" />} label={t("totalDonations")} value={profile.total_donations ?? 0} />
          <Stat icon={<Award className="h-4 w-4" />} label={t("livesSaved")} value={profile.lives_saved ?? 0} />
        </div>

        <div className="mt-5 space-y-2.5 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-2.5 md:space-y-0">
          <Field label={t("fullName")}>
            <input className={inp} value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </Field>
          <Field label={t("phone")}>
            <input className={inp} value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-2">
            <Field label={t("bloodGroup")}>
              <select
                className={inp}
                value={profile.blood_group ?? ""}
                onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
              >
                <option value="">—</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label={t("lastDonation")}>
              <input
                className={inp}
                type="date"
                value={profile.last_donation_date ?? ""}
                onChange={(e) => setProfile({ ...profile, last_donation_date: e.target.value })}
              />
            </Field>
          </div>
          <Field label={lang === "bn" ? "জেলা" : "District"}>
            <DistrictTypeahead value={district} onChange={setDistrict} />
          </Field>
          <Field label={t("bio")} className="md:col-span-2">
            <textarea className={inp} rows={2} value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          </Field>

          <div className="md:col-span-2">
          <Toggle
            label={lang === "bn" ? "দানের জন্য উপলব্ধ" : "Available to donate"}
            checked={!!profile.is_available}
            onChange={(v) => setProfile({ ...profile, is_available: v })}
          />

          </div>

          <button
            onClick={save}
            disabled={busy}
            className="w-full mt-2 md:col-span-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 shadow-md shadow-primary/20"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-3 flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center">{icon}</div>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  hint?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
