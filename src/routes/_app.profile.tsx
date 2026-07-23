import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/routes/_app.index";
import { BLOOD_GROUPS } from "@/lib/format";
import { Droplet, Settings as SettingsIcon, HeartHandshake, Award } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — BloodLink" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data ?? {}));
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
        blood_group: profile.blood_group,
        city: profile.city,
        area: profile.area,
        is_donor: !!profile.is_donor,
        is_recipient: !!profile.is_recipient,
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
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 glass border-b safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-bold">{t("profile")}</h1>
          <Link to="/settings" className="p-1.5 rounded-lg hover:bg-muted">
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} src={profile.avatar_url ?? undefined} size={64} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">{profile.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          {profile.blood_group && (
            <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-bold text-lg">
              {profile.blood_group}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat icon={<HeartHandshake className="h-4 w-4" />} label={t("totalDonations")} value={profile.total_donations ?? 0} />
          <Stat icon={<Award className="h-4 w-4" />} label={t("livesSaved")} value={profile.lives_saved ?? 0} />
        </div>

        <div className="mt-5 space-y-2.5">
          <Field label={t("fullName")}>
            <input className={inp} value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </Field>
          <Field label={t("phone")}>
            <input className={inp} value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
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
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("city")}>
              <input className={inp} value={profile.city ?? ""} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
            </Field>
            <Field label={t("area")}>
              <input className={inp} value={profile.area ?? ""} onChange={(e) => setProfile({ ...profile, area: e.target.value })} />
            </Field>
          </div>
          <Field label={t("bio")}>
            <textarea className={inp} rows={2} value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          </Field>

          <div className="space-y-1">
            <Toggle label={t("isDonor")} checked={!!profile.is_donor} onChange={(v) => setProfile({ ...profile, is_donor: v })} />
            <Toggle label={t("isRecipient")} checked={!!profile.is_recipient} onChange={(v) => setProfile({ ...profile, is_recipient: v })} />
            <Toggle label={t("available")} checked={!!profile.is_available} onChange={(v) => setProfile({ ...profile, is_available: v })} />
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="w-full mt-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border bg-card"
    >
      <div className="text-left">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <span className={`relative inline-block h-5 w-9 rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
