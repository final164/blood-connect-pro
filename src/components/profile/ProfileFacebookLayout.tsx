import {
  Droplets,
  Phone,
  MapPin,
  Calendar,
  User,
  HeartHandshake,
  ShieldCheck,
  Lock,
  Pencil,
  Link2,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { ProfileLockField, ProfileLockSettings } from "@/lib/profile-lock";
import { isFieldHiddenWhenLocked } from "@/lib/profile-lock";

export type ProfileDisplayData = {
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  blood_group?: string | null;
  bio?: string | null;
  gender?: string | null;
  age?: string | null;
  location?: string | null;
  last_donation_date?: string | null;
  is_available?: boolean | null;
  total_donations?: number | null;
  lives_saved?: number | null;
};

export function ProfileFacebookLayout({
  profile,
  lang,
  isOwnProfile,
  profileLocked,
  lockSettings,
  onLockToggle,
  onEdit,
  onAvatarUpload,
  onAvatarUrl,
  avatarBusy,
  lockBusy,
  headerExtra,
}: {
  profile: ProfileDisplayData;
  lang: "bn" | "en";
  isOwnProfile?: boolean;
  profileLocked?: boolean;
  lockSettings?: ProfileLockSettings;
  onLockToggle?: () => void;
  onEdit?: () => void;
  onAvatarUpload?: (file: File) => void;
  onAvatarUrl?: (url: string) => void;
  avatarBusy?: boolean;
  lockBusy?: boolean;
  headerExtra?: React.ReactNode;
}) {
  const showLockIcon = (field: ProfileLockField) =>
    !!isOwnProfile && !!profileLocked && !!lockSettings && isFieldHiddenWhenLocked(field, lockSettings);

  const donations = profile.total_donations;
  const lives = profile.lives_saved;
  const showStats = donations != null || lives != null;

  return (
    <div className="w-full">
      <div className="relative">
        <div className="h-36 sm:h-40 bg-gradient-to-br from-sky-400/40 via-primary/25 to-rose-300/30" />
        <div className="absolute -bottom-10 left-4">
          <div className="relative ring-4 ring-background rounded-full shadow-lg">
            <Avatar name={profile.full_name} src={profile.avatar_url ?? undefined} size={88} />
            {isOwnProfile && (onAvatarUpload || onAvatarUrl) && (
              <div className="absolute bottom-0.5 right-0.5 flex flex-col gap-1">
                {onAvatarUpload && (
                  <label
                    className={`h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-md grid place-items-center cursor-pointer ${
                      avatarBusy ? "opacity-60 pointer-events-none" : "hover:brightness-110"
                    }`}
                    title={lang === "bn" ? "ছবি আপলোড" : "Upload photo"}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) onAvatarUpload(f);
                      }}
                    />
                  </label>
                )}
                {onAvatarUrl && (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    title={lang === "bn" ? "Drive/লিংক পেস্ট" : "Paste Drive/link"}
                    className="h-8 w-8 rounded-full bg-foreground text-background shadow-md grid place-items-center disabled:opacity-60"
                    onClick={() => {
                      const v = window.prompt(
                        lang === "bn"
                          ? "Google Drive বা ইমেজ লিংক পেস্ট করুন"
                          : "Paste Google Drive or image link",
                      );
                      if (v?.trim()) onAvatarUrl(v.trim());
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-12 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight truncate">{profile.full_name || "—"}</h2>
            {showStats && (
              <p className="text-sm text-muted-foreground mt-1">
                {donations ?? 0} {lang === "bn" ? "দান" : "donations"}
                <span className="mx-1.5">·</span>
                {lives ?? 0} {lang === "bn" ? "জীবন বাঁচানো" : "lives saved"}
              </p>
            )}
          </div>
          {profile.blood_group && (
            <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold text-base shadow-md shrink-0">
              {profile.blood_group}
            </div>
          )}
        </div>

        {isOwnProfile && (onLockToggle || onEdit) && (
          <div className="flex gap-2 mt-4">
            {onLockToggle && (
              <button
                type="button"
                onClick={onLockToggle}
                disabled={lockBusy}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                  profileLocked
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground"
                } disabled:opacity-50`}
              >
                <Lock className="h-4 w-4" />
                {profileLocked
                  ? lang === "bn"
                    ? "প্রোফাইল আনলক"
                    : "Unlock profile"
                  : lang === "bn"
                    ? "প্রোফাইল লক"
                    : "Lock profile"}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-muted py-2 text-sm font-semibold"
              >
                <Pencil className="h-4 w-4" />
                {lang === "bn" ? "প্রোফাইল সম্পাদনা" : "Edit profile"}
              </button>
            )}
          </div>
        )}

        {headerExtra}
      </div>

      {isOwnProfile && profileLocked && (
        <div className="mx-4 mb-4 flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-3">
          <div className="h-10 w-10 rounded-full bg-background grid place-items-center shrink-0">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {lang === "bn" ? "আপনি প্রোফাইল লক করেছেন" : "You locked your profile"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "bn"
                ? "অ্যাডমিন সেটিংস অনুযায়ী কিছু তথ্য শুধু আপনি দেখতে পারবেন"
                : "Some details are only visible to you based on admin settings"}
            </p>
          </div>
        </div>
      )}

      <section className="px-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold">
            {lang === "bn" ? "ব্যক্তিগত তথ্য" : "Personal details"}
          </h3>
          {isOwnProfile && onEdit && (
            <button type="button" onClick={onEdit} className="p-2 rounded-full hover:bg-muted">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="divide-y">
          {profile.phone && (
            <DetailRow icon={<Phone className="h-4 w-4" />} showLock={showLockIcon("phone")}>
              {profile.phone}
            </DetailRow>
          )}
          {profile.blood_group && (
            <DetailRow icon={<Droplets className="h-4 w-4" />} showLock={showLockIcon("blood_group")}>
              {profile.blood_group}
            </DetailRow>
          )}
          {profile.gender && (
            <DetailRow icon={<User className="h-4 w-4" />} showLock={showLockIcon("gender")}>
              {profile.gender}
            </DetailRow>
          )}
          {profile.age && (
            <DetailRow icon={<Calendar className="h-4 w-4" />} showLock={showLockIcon("age")}>
              {profile.age} {lang === "bn" ? "বছর" : "years"}
            </DetailRow>
          )}
          {profile.location && (
            <DetailRow icon={<MapPin className="h-4 w-4" />} showLock={showLockIcon("location")}>
              {profile.location}
            </DetailRow>
          )}
          {profile.last_donation_date && (
            <DetailRow icon={<HeartHandshake className="h-4 w-4" />} showLock={showLockIcon("last_donation")}>
              {lang === "bn" ? "শেষ দান: " : "Last donation: "}
              {profile.last_donation_date}
            </DetailRow>
          )}
          {profile.is_available != null && (
            <DetailRow icon={<ShieldCheck className="h-4 w-4" />} showLock={showLockIcon("availability")}>
              {profile.is_available
                ? lang === "bn"
                  ? "দানের জন্য উপলব্ধ"
                  : "Available to donate"
                : lang === "bn"
                  ? "এখন উপলব্ধ নয়"
                  : "Not available now"}
            </DetailRow>
          )}
          {profile.bio && (
            <DetailRow icon={<User className="h-4 w-4" />} showLock={showLockIcon("bio")}>
              {profile.bio}
            </DetailRow>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailRow({
  icon,
  children,
  showLock,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  showLock?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <p className="flex-1 text-sm leading-relaxed pt-1.5 min-w-0">{children}</p>
      {showLock && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-2" />}
    </div>
  );
}
