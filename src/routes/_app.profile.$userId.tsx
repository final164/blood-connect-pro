import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChatLink } from "@/components/chat/ChatLink";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { fetchProfileForViewer } from "@/lib/profile-lock";
import { ageFromDateOfBirth } from "@/lib/onboarding";
import { ProfileFacebookLayout } from "@/components/profile/ProfileFacebookLayout";
import { MessageCircle } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import type { District } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-client";

export const Route = createFileRoute("/_app/profile/$userId")({
  head: () => ({ meta: [{ title: "Profile — BloodLink" }] }),
  component: PublicProfilePage,
});

async function loadPublicProfile(userId: string, viewerId?: string) {
  const data = await fetchProfileForViewer(userId, viewerId);
  let district: District | null = null;
  if (data?.district_id) {
    const { data: d } = await supabase
      .from("districts")
      .select("id,name_bn,name_en,slug,is_active,sort_order")
      .eq("id", data.district_id as string)
      .maybeSingle();
    if (d) district = d as District;
  }
  return { profile: data as Record<string, unknown> | null, district };
}

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useI18n();

  useEffect(() => {
    if (user?.id === userId) void navigate({ to: "/profile" });
  }, [user?.id, userId, navigate]);

  const q = useQuery({
    queryKey: [...queryKeys.publicProfile(userId), user?.id ?? null],
    queryFn: () => loadPublicProfile(userId, user?.id),
    enabled: !!userId && user?.id !== userId,
    staleTime: 60_000,
  });

  const profile = q.data?.profile ?? null;
  const district = q.data?.district ?? null;
  const loading = q.isPending && !q.data;

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;
  }

  if (!profile) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {lang === "bn" ? "প্রোফাইল পাওয়া যায়নি" : "Profile not found"}
        </p>
        <Link to="/home" className="text-sm text-primary mt-2 inline-block">
          {lang === "bn" ? "ফিডে ফিরুন" : "Back to feed"}
        </Link>
      </div>
    );
  }

  const locationParts = [
    district ? (lang === "bn" ? district.name_bn : district.name_en) : (profile.city as string),
    profile.area as string,
  ].filter(Boolean);
  const locationLabel = locationParts.length ? locationParts.join(", ") : undefined;

  const age = profile.date_of_birth ? ageFromDateOfBirth(profile.date_of_birth as string) : "";
  const genderLabel =
    String(profile.gender ?? "").toLowerCase() === "male"
      ? t("male")
      : String(profile.gender ?? "").toLowerCase() === "female"
        ? t("female")
        : null;

  return (
    <div className="w-full min-h-screen bg-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur-xl safe-top">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <PageBackButton fallbackTo="/home" />
            <h1 className="text-base font-bold truncate">{(profile.full_name as string) ?? t("profile")}</h1>
          </div>
          {user && user.id !== userId && (
            <ChatLink
              peerId={userId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {lang === "bn" ? "মেসেজ" : "Message"}
            </ChatLink>
          )}
        </div>
      </AutoHideHeader>

      <div className="w-full">
        <ProfileFacebookLayout
          profile={{
            full_name: profile.full_name as string,
            avatar_url: profile.avatar_url as string,
            phone: profile.phone as string | undefined,
            blood_group: profile.blood_group as string | undefined,
            bio: profile.bio as string | undefined,
            gender: genderLabel ?? undefined,
            age: age || undefined,
            location: locationLabel,
            last_donation_date: profile.last_donation_date as string | undefined,
            is_available: profile.is_available as boolean | undefined,
            total_donations: profile.total_donations as number | undefined,
            lives_saved: profile.lives_saved as number | undefined,
          }}
          lang={lang}
          messagePeerId={user && user.id !== userId ? userId : null}
        />
      </div>
    </div>
  );
}
