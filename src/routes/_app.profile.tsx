import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { District } from "@/lib/api";
import { ageFromDateOfBirth, dateOfBirthFromAge } from "@/lib/onboarding";
import { fetchProfileLockSettings, setProfileLocked } from "@/lib/profile-lock";
import type { ProfileLockSettings } from "@/lib/profile-lock";
import { uploadAppImage, fetchGoogleDriveSettings, canPasteImageUrl, canUploadImageFile, normalizePastedImageUrl, type GoogleDriveSettings, DEFAULT_GOOGLE_DRIVE_SETTINGS } from "@/lib/google-drive";
import { resolveCarouselImageUrl } from "@/lib/feed-carousel";
import { ProfileFacebookLayout } from "@/components/profile/ProfileFacebookLayout";
import { ProfileEditSheet } from "@/components/profile/ProfileEditSheet";
import { Settings as SettingsIcon, Shield } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { UserMenuTrigger } from "@/components/menu/UserMenuDrawer";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import {
  linkOrgDonorHistoryToProfile,
  restoreExpiredDonorAvailability,
} from "@/lib/community-request-contacts";
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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [driveCfg, setDriveCfg] = useState<GoogleDriveSettings>(DEFAULT_GOOGLE_DRIVE_SETTINGS);

  useEffect(() => {
    if (!user) return;
    fetchProfileLockSettings().then(setLockSettings);
    fetchGoogleDriveSettings().then(setDriveCfg);
    void restoreExpiredDonorAvailability()
      .then(() => linkOrgDonorHistoryToProfile(user.id))
      .finally(() => {
        void supabase
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

  async function onAvatarUpload(file: File) {
    if (!user) return;
    if (!driveCfg.allow_profile_image || !canUploadImageFile(driveCfg)) {
      return toast.error(lang === "bn" ? "ফাইল আপলোড বন্ধ আছে" : "File upload is disabled");
    }
    if (!file.type.startsWith("image/")) {
      return toast.error(lang === "bn" ? "শুধু ইমেজ ফাইল" : "Images only");
    }
    if (file.size > 8 * 1024 * 1024) {
      return toast.error(lang === "bn" ? "সর্বোচ্চ ৮ MB" : "Max 8 MB");
    }
    setAvatarBusy(true);
    try {
      const result = await uploadAppImage(file, "avatar", async (f) => {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `avatars/${user.id}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("feed-carousel").upload(path, f, {
          cacheControl: "3600",
          upsert: true,
          contentType: f.type || "image/jpeg",
        });
        if (error) return { url: null, error: new Error(error.message) };
        const { data } = supabase.storage.from("feed-carousel").getPublicUrl(path);
        return { url: data.publicUrl, error: null };
      });
      if (!result.url) throw result.error ?? new Error("Upload failed");
      const url = resolveCarouselImageUrl(result.url);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      toast.success(
        lang === "bn"
          ? result.via === "drive"
            ? "প্রোফাইল ছবি Drive-এ সেভ হয়েছে"
            : "প্রোফাইল ছবি আপডেট হয়েছে"
          : result.via === "drive"
            ? "Avatar saved to Drive"
            : "Profile photo updated",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onAvatarUrl(raw: string) {
    if (!user) return;
    if (!driveCfg.allow_profile_image || !canPasteImageUrl(driveCfg)) {
      return toast.error(lang === "bn" ? "লিংক দিয়ে ছবি বন্ধ আছে" : "Image via link is disabled");
    }
    const url = normalizePastedImageUrl(raw);
    if (!url) {
      return toast.error(lang === "bn" ? "সঠিক লিংক দিন" : "Enter a valid link");
    }
    setAvatarBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      toast.success(lang === "bn" ? "প্রোফাইল ছবি আপডেট হয়েছে" : "Profile photo updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAvatarBusy(false);
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
        unavailable_until: profile.is_available ? null : profile.unavailable_until || null,
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

      <div className="w-full">
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
          onAvatarUpload={
            driveCfg.allow_profile_image && canUploadImageFile(driveCfg)
              ? (f) => void onAvatarUpload(f)
              : undefined
          }
          onAvatarUrl={
            driveCfg.allow_profile_image && canPasteImageUrl(driveCfg)
              ? (u) => void onAvatarUrl(u)
              : undefined
          }
          avatarBusy={avatarBusy}
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

