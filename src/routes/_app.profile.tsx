import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { District } from "@/lib/api";
import { ageFromDateOfBirth, dateOfBirthFromAge } from "@/lib/onboarding";
import { fetchProfileLockSettings, setProfileLocked } from "@/lib/profile-lock";
import type { ProfileLockSettings } from "@/lib/profile-lock";
import { ProfileFacebookLayout } from "@/components/profile/ProfileFacebookLayout";
import { ProfileEditSheet } from "@/components/profile/ProfileEditSheet";
import { Settings as SettingsIcon, Shield } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — BloodLink" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [lockSettings, setLockSettings] = useState<ProfileLockSettings | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchProfileLockSettings().then(setLockSettings);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setProfile(data ?? {});
        setUpazila((data?.area as string) ?? "");
        setAge(ageFromDateOfBirth(data?.date_of_birth as string));
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

  async function toggleLock() {
    if (!user || !profile) return;
    const next = !profile.profile_locked;
    setLockBusy(true);
    const { error } = await setProfileLocked(user.id, next);
    setLockBusy(false);
    if (error) toast.error(error.message);
    else {
      setProfile({ ...profile, profile_locked: next });
      toast.success(
        next
          ? lang === "bn"
            ? "প্রোফাইল লক করা হয়েছে"
            : "Profile locked"
          : lang === "bn"
            ? "প্রোফাইল আনলক করা হয়েছে"
            : "Profile unlocked",
      );
    }
  }

  async function save() {
    if (!user || !profile) return;
    const ageNum = age.trim() ? Number(age) : null;
    if (age.trim() && (!Number.isFinite(ageNum) || ageNum! < 1 || ageNum! > 120)) {
      return toast.error(lang === "bn" ? "সঠিক বয়স দিন" : "Enter a valid age");
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        phone: profile.phone,
        blood_group: profile.blood_group || null,
        gender: profile.gender || null,
        district_id: district?.id ?? null,
        city: district ? (lang === "bn" ? district.name_bn : district.name_en) : profile.city,
        area: upazila.trim() || null,
        date_of_birth: ageNum != null ? dateOfBirthFromAge(ageNum) : null,
        is_available: !!profile.is_available,
        last_donation_date: profile.last_donation_date || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      setEditOpen(false);
    }
  }

  if (!profile || !lockSettings) {
    return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;
  }

  const locationLabel = [
    district ? (lang === "bn" ? district.name_bn : district.name_en) : (profile.city as string),
    upazila || (profile.area as string),
  ]
    .filter(Boolean)
    .join(", ");

  const genderLabel =
    String(profile.gender ?? "").toLowerCase() === "male"
      ? t("male")
      : String(profile.gender ?? "").toLowerCase() === "female"
        ? t("female")
        : null;

  return (
    <div className="w-full min-h-screen bg-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
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
      </AutoHideHeader>

      <div className="md:max-w-lg md:mx-auto">
        <ProfileFacebookLayout
          profile={{
            full_name: profile.full_name as string,
            avatar_url: profile.avatar_url as string,
            phone: profile.phone as string,
            blood_group: profile.blood_group as string,
            bio: profile.bio as string,
            gender: genderLabel,
            age: age || undefined,
            location: locationLabel || undefined,
            last_donation_date: profile.last_donation_date as string,
            is_available: profile.is_available as boolean,
            total_donations: profile.total_donations as number,
            lives_saved: profile.lives_saved as number,
          }}
          lang={lang}
          isOwnProfile
          profileLocked={!!profile.profile_locked}
          lockSettings={lockSettings}
          onLockToggle={() => void toggleLock()}
          onEdit={() => setEditOpen(true)}
          lockBusy={lockBusy}
        />
      </div>

      <ProfileEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lang={lang}
        t={t}
        profile={profile}
        setProfile={setProfile}
        district={district}
        setDistrict={setDistrict}
        upazila={upazila}
        setUpazila={setUpazila}
        age={age}
        setAge={setAge}
        busy={busy}
        onSave={() => void save()}
      />
    </div>
  );
}

export { ProfileToggle as Toggle } from "@/components/profile/ProfileToggle";

