import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { authWithNext } from "@/lib/auth-next";

/** Header profile — own avatar beside notifications. */
export function ProfileHeaderButton({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const { t } = useI18n();
  const { user, session, isAnonymous } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(
    null,
  );
  const tap = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const avatarPx = size === "lg" ? 32 : 28;
  const isGuest = !session || isAnonymous;

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as { full_name: string | null; avatar_url: string | null });
      });
  }, [user?.id]);

  const avatar = (
    <Avatar
      name={profile?.full_name ?? user?.email}
      src={profile?.avatar_url ?? undefined}
      size={avatarPx}
    />
  );

  if (isGuest) {
    return (
      <a
        href={authWithNext("/profile")}
        title={t("profile")}
        aria-label={t("profile")}
        className={`relative ${tap} rounded-xl grid place-items-center hover:bg-muted transition ${className}`}
      >
        {avatar}
      </a>
    );
  }

  return (
    <Link
      to="/profile"
      title={t("profile")}
      aria-label={t("profile")}
      className={`relative ${tap} rounded-xl grid place-items-center hover:bg-muted transition ${className}`}
    >
      {avatar}
    </Link>
  );
}
