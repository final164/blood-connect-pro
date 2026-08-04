import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { whatsappHref } from "@/lib/request-form-options";
import { fetchNotificationSettings } from "@/lib/notification-settings";
import {
  DEFAULT_DONATION_FLOW_SETTINGS,
  donationLabel,
  fetchDonationFlowSettings,
  type DonationFlowSettings,
} from "@/lib/donation-flow-settings";
import {
  applySmsTemplate,
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  type MessagingSettings,
} from "@/lib/messaging-settings";
import { useUrgencyAnimationSettings } from "@/hooks/useUrgencyAnimationSettings";
import {
  UrgencyDropletBackdrop,
  UrgencyHeaderIcon,
} from "@/components/request/UrgencyDropletBackdrop";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  Phone,
  Clock,
  Share2,
  Droplets,
  ThumbsUp,
  MessagesSquare,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Bookmark,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MessengerIcon } from "@/components/MessengerIcon";
import { DonationPanel } from "@/components/request/DonationPanel";
import { CommentsSheet } from "@/components/request/CommentsSheet";
import { CarouselRemoteImage } from "@/components/feed/CarouselRemoteImage";
import { toggleSave } from "@/lib/request-saves";
import { toast } from "sonner";

export type FeedRequest = {
  id: string;
  requester_id: string;
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  hospital_name: string;
  city: string | null;
  area?: string | null;
  district_id: string | null;
  contact_phone: string | null;
  whatsapp_phone?: string | null;
  needed_by: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string | null;
  need_reason_key?: string | null;
  need_reason_label?: string | null;
  image_url?: string | null;
  donation_completion_open?: boolean | null;
  status: string;
  created_at: string;
  district?: { name_bn: string; name_en: string } | null;
  requester?: { full_name: string | null; avatar_url: string | null } | null;
  like_count?: number;
  comment_count?: number;
  liked?: boolean;
  saved?: boolean;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function RequestCard({
  request: r,
  currentUserId,
  onChanged,
  highlighted,
}: {
  request: FeedRequest;
  currentUserId?: string;
  onChanged?: () => void;
  highlighted?: boolean;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [liked, setLiked] = useState(!!r.liked);
  const [saved, setSaved] = useState(!!r.saved);
  const [likeCount, setLikeCount] = useState(r.like_count ?? 0);
  const [commentCount, setCommentCount] = useState(r.comment_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completingMode, setCompletingMode] = useState(false);
  const [showManagedMenu, setShowManagedMenu] = useState(true);
  const [donationFlow, setDonationFlow] = useState<DonationFlowSettings>(DEFAULT_DONATION_FLOW_SETTINGS);
  const [messaging, setMessaging] = useState<MessagingSettings>(DEFAULT_MESSAGING_SETTINGS);
  const urgencyAnim = useUrgencyAnimationSettings();

  useEffect(() => {
    if (r.donation_completion_open) setCompletingMode(true);
  }, [r.donation_completion_open, r.id]);

  useEffect(() => {
    fetchNotificationSettings().then((s) => {
      setShowManagedMenu(s.enable_managed_button);
    });
    fetchDonationFlowSettings().then(setDonationFlow);
    fetchMessagingSettings().then(setMessaging);
  }, []);

  useEffect(() => {
    setLiked(!!r.liked);
    setSaved(!!r.saved);
    setLikeCount(r.like_count ?? 0);
    setCommentCount(r.comment_count ?? 0);
  }, [r.liked, r.saved, r.like_count, r.comment_count, r.id]);

  const distName = lang === "bn" ? r.district?.name_bn : r.district?.name_en;
  const upazilaName = r.area?.trim() || null;
  const locationLabel = [r.hospital_name, upazilaName, distName || r.city].filter(Boolean).join(" · ");
  const isOwner = !!currentUserId && r.requester_id === currentUserId;
  const phone = r.contact_phone?.trim() || null;
  const waLink = r.whatsapp_phone?.trim() ? whatsappHref(r.whatsapp_phone.trim()) : null;
  const levelCfg =
    r.urgency === "critical"
      ? urgencyAnim.critical
      : r.urgency === "urgent"
        ? urgencyAnim.urgent
        : null;
  const showBackdrop = !!levelCfg?.enabled;

  async function toggleLike() {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase
          .from("request_likes")
          .insert({ request_id: r.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("request_likes")
          .delete()
          .eq("request_id", r.id)
          .eq("user_id", user.id);
        if (error) throw error;
      }
      onChanged?.();
    } catch (e) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error((e as Error).message);
    }
  }

  async function onToggleSave() {
    if (!user) return;
    const next = !saved;
    setSaved(next);
    const { error } = await toggleSave(r.id, user.id, !next);
    if (error) {
      setSaved(!next);
      if (/request_saves|relation|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/request-saves.sql চালান"
            : "Run scripts/request-saves.sql first",
        );
      }
      return toast.error(error.message);
    }
    toast.success(
      next
        ? lang === "bn"
          ? "পোস্ট সেভ হয়েছে"
          : "Post saved"
        : lang === "bn"
          ? "সেভ সরানো হয়েছে"
          : "Removed from saved",
    );
    onChanged?.();
  }

  async function share() {
    const link = typeof window !== "undefined" ? window.location.origin : "";
    const tpl = lang === "bn" ? messaging.share_sms_bn : messaging.share_sms_en;
    const text = applySmsTemplate(tpl, {
      blood_group: r.blood_group,
      patient_name: r.patient_name,
      location: locationLabel,
      hospital: r.hospital_name,
      upazila: upazilaName,
      district: distName || r.city,
      bags: r.bags_needed,
      urgency: r.urgency,
      contact: phone,
      notes: r.notes,
      link,
    });
    const url = link;
    if (user && r.requester_id !== user.id) {
      await supabase
        .from("request_shares")
        .upsert(
          { request_id: r.id, user_id: user.id },
          { onConflict: "request_id,user_id", ignoreDuplicates: true },
        );
    }
    try {
      if (navigator.share) await navigator.share({ title: "BloodLink", text, url });
      else {
        await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
        toast.success(
          lang === "bn" ? "শেয়ার টেক্সট কপি হয়েছে" : "Share text copied",
        );
      }
    } catch {
      /* cancelled */
    }
  }

  async function markManaged() {
    setManaging(true);
    const { openDonationCompletion } = await import("@/lib/donation-offers");
    const { error } = await openDonationCompletion(r.id);
    setManaging(false);
    if (error) {
      if (/donation_completion_open|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/donation-completion-open.sql চালান"
            : "Run scripts/donation-completion-open.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCompletingMode(true);
    onChanged?.();
  }

  async function deletePost() {
    const ok = confirm(
      lang === "bn"
        ? "এই পোস্ট স্থায়ীভাবে মুছবেন?"
        : "Permanently delete this post?",
    );
    if (!ok) return;
    setDeleting(true);
    const { error } = await supabase.from("blood_requests").delete().eq("id", r.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "পোস্ট মুছে ফেলা হয়েছে" : "Post deleted");
    onChanged?.();
  }

  const urgencyStyle =
    r.urgency === "critical"
      ? "from-destructive/90 to-destructive text-destructive-foreground"
      : r.urgency === "urgent"
        ? "from-[color:var(--urgent)] to-amber-600 text-white"
        : "from-primary to-primary/80 text-primary-foreground";

  return (
    <article
      className={`ua-anim-root relative rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
        highlighted
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
          : ""
      }`}
    >
      {showBackdrop && levelCfg && <UrgencyDropletBackdrop config={levelCfg} className="z-0" />}

      <div
        className={`relative z-[1] bg-gradient-to-r ${urgencyStyle} px-4 py-2.5 flex items-center justify-between gap-2`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {levelCfg && <UrgencyHeaderIcon config={levelCfg} />}
          <span className="text-lg font-bold tracking-tight">{r.blood_group}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 px-2 py-0.5 rounded-md bg-black/15">
            {t(r.urgency)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] opacity-90">{timeAgo(r.created_at, lang)}</span>
          {isOwner && r.status === "open" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={managing || deleting}
                  className="h-8 w-8 rounded-lg grid place-items-center hover:bg-black/15 transition"
                  aria-label={lang === "bn" ? "আরও অপশন" : "More options"}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {showManagedMenu && (
                  <DropdownMenuItem disabled={managing} onClick={() => void markManaged()}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {donationLabel(donationFlow, "complete_menu", lang)}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={deleting}
                  onClick={() => void deletePost()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {lang === "bn" ? "পোস্ট ডিলিট" : "Delete post"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="relative z-[1] p-4 space-y-3 bg-card/92">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar
            name={r.requester?.full_name}
            src={r.requester?.avatar_url ?? undefined}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight truncate">
              {r.requester?.full_name?.trim() || (lang === "bn" ? "ব্যবহারকারী" : "User")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              <span className="text-muted-foreground/80">
                {lang === "bn" ? "রোগী" : "Patient"}
              </span>
              <span className="mx-1 text-muted-foreground/50">·</span>
              <span className="font-medium text-foreground/85">{r.patient_name}</span>
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5 text-primary shrink-0" />
              {r.bags_needed} {lang === "bn" ? "ব্যাগ প্রয়োজন" : "bag(s) needed"}
            </p>
            {r.need_reason_label && (
              <p className="mt-1 text-[11px] text-primary/90 font-medium truncate">
                {lang === "bn" ? "কারণ" : "Reason"} · {r.need_reason_label}
              </p>
            )}
          </div>
        </div>

        {r.image_url && (
          <div className="overflow-hidden rounded-xl border border-border/60 -mx-0.5">
            <CarouselRemoteImage
              src={r.image_url}
              className="aspect-[4/3] w-full"
              maxWidth={900}
              loading="lazy"
            />
          </div>
        )}

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>{locationLabel}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {new Date(r.needed_by).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>

        {r.notes && (
          <p className="text-xs leading-relaxed text-foreground/80 bg-muted/40 rounded-xl px-3 py-2">
            {r.notes}
          </p>
        )}

        <DonationPanel
          requestId={r.id}
          requesterId={r.requester_id}
          bagsNeeded={r.bags_needed}
          status={r.status}
          isOwner={isOwner}
          onChanged={onChanged}
          completionOpen={!!r.donation_completion_open}
          completingMode={completingMode}
          onExitCompleting={() => setCompletingMode(false)}
          onReopenCompleting={() => setCompletingMode(true)}
        />

        <div className="flex items-center pt-1 border-t">
          {messaging.post_icons.like && (
            <button
              type="button"
              onClick={toggleLike}
              className={`flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium transition hover:bg-muted ${
                liked ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <ThumbsUp className="h-4 w-4 shrink-0" fill={liked ? "currentColor" : "none"} />
              <span className="tabular-nums">{likeCount}</span>
            </button>
          )}
          {messaging.post_icons.comment && (
            <button
              type="button"
              onClick={() => setShowComments(true)}
              className="flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <MessagesSquare className="h-4 w-4 shrink-0" />
              <span className="tabular-nums">{commentCount}</span>
            </button>
          )}
          {!isOwner && messaging.post_icons.chat && (
            <Link
              to="/chat/$peerId"
              params={{ peerId: r.requester_id }}
              search={{ fromRequestId: r.id }}
              onClick={() => {
                try {
                  sessionStorage.setItem("feedReturnRequestId", r.id);
                } catch {
                  /* ignore */
                }
              }}
              className="flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <MessengerIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("chat")}</span>
            </Link>
          )}
          {!isOwner && phone && messaging.post_icons.phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              title={lang === "bn" ? "এখনই কল করুন" : "Call now"}
              className="flex flex-1 min-w-0 items-center justify-center rounded-xl px-1 py-2 text-primary hover:bg-primary/10 transition"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {!isOwner && waLink && messaging.post_icons.whatsapp && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              title="WhatsApp"
              className="flex flex-1 min-w-0 items-center justify-center rounded-xl px-1 py-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/10 transition"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </a>
          )}
          {messaging.post_icons.save && (
            <button
              type="button"
              onClick={() => void onToggleSave()}
              className={`flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium transition hover:bg-muted ${
                saved ? "text-primary" : "text-muted-foreground"
              }`}
              title={lang === "bn" ? "সেভ" : "Save"}
            >
              <Bookmark className="h-4 w-4 shrink-0" fill={saved ? "currentColor" : "none"} />
              <span className="hidden sm:inline">{lang === "bn" ? "সেভ" : "Save"}</span>
            </button>
          )}
          {messaging.post_icons.share && (
            <button
              type="button"
              onClick={share}
              className="flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Share2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("share")}</span>
            </button>
          )}
        </div>

        <CommentsSheet
          requestId={r.id}
          open={showComments}
          onOpenChange={setShowComments}
          likeCount={likeCount}
          liked={liked}
          onCount={(n) => {
            setCommentCount(n);
            onChanged?.();
          }}
        />
      </div>
    </article>
  );
}
