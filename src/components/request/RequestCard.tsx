import { Link } from "@tanstack/react-router";
import { memo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { whatsappHref } from "@/lib/request-form-options";
import { donationLabel } from "@/lib/donation-flow-settings";
import { applySmsTemplate } from "@/lib/messaging-settings";
import { extractPostNotes } from "@/lib/post-text-styles";
import { useUrgencyAnimationSettings } from "@/hooks/useUrgencyAnimationSettings";
import { useFeedCardChrome } from "@/hooks/useFeedCardChrome";
import {
  UrgencyDropletBackdrop,
} from "@/components/request/UrgencyDropletBackdrop";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Share2,
  ThumbsUp,
  MessagesSquare,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Bookmark,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MessengerIcon } from "@/components/MessengerIcon";
import { DonationPanel } from "@/components/request/DonationPanel";
import { CommentsSheet } from "@/components/request/CommentsSheet";
import { RequestPostBody } from "@/components/request/RequestPostBody";
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

function urgencyChipClass(urgency: FeedRequest["urgency"]) {
  if (urgency === "critical") return "bg-destructive/12 text-destructive";
  if (urgency === "urgent") return "bg-amber-500/12 text-amber-700 dark:text-amber-400";
  return "bg-primary/10 text-primary";
}

function RequestCardInner({
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
  const chrome = useFeedCardChrome();
  const messaging = chrome.messaging;
  const donationFlow = chrome.donationFlow;
  const showManagedMenu = chrome.enableManagedButton;
  const [liked, setLiked] = useState(!!r.liked);
  const [saved, setSaved] = useState(!!r.saved);
  const [likeCount, setLikeCount] = useState(r.like_count ?? 0);
  const [commentCount, setCommentCount] = useState(r.comment_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completingMode, setCompletingMode] = useState(false);
  const urgencyAnim = useUrgencyAnimationSettings();

  useEffect(() => {
    if (r.donation_completion_open) setCompletingMode(true);
  }, [r.donation_completion_open, r.id]);

  useEffect(() => {
    setLiked(!!r.liked);
    setSaved(!!r.saved);
    setLikeCount(r.like_count ?? 0);
    setCommentCount(r.comment_count ?? 0);
  }, [r.liked, r.saved, r.like_count, r.comment_count, r.id]);

  const distName = lang === "bn" ? r.district?.name_bn : r.district?.name_en;
  const upazilaName = r.area?.trim() || null;
  const hospitalName = r.hospital_name?.trim() || "";
  const placeParts = [hospitalName, upazilaName, distName || r.city].filter(Boolean);
  const locationLabel = placeParts.join(" · ");
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
  const displayName =
    r.requester?.full_name?.trim() || (lang === "bn" ? "ব্যবহারকারী" : "User");

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
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = origin ? `${origin}/home?requestId=${encodeURIComponent(r.id)}` : "";
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
      notes: extractPostNotes(r.notes).text,
      link: url,
    });
    const payload = text.includes(url) || !url ? text : `${text}\n${url}`.trim();

    if (user && r.requester_id !== user.id) {
      void supabase
        .from("request_shares")
        .upsert(
          { request_id: r.id, user_id: user.id },
          { onConflict: "request_id,user_id", ignoreDuplicates: true },
        )
        .then(({ error }) => {
          if (!error) onChanged?.();
        });
    }

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "BloodLink", text: payload });
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        toast.success(lang === "bn" ? "শেয়ার টেক্সট কপি হয়েছে" : "Share text copied");
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`, "_blank", "noopener,noreferrer");
    } catch {
      try {
        window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`, "_blank", "noopener,noreferrer");
      } catch {
        toast.error(lang === "bn" ? "শেয়ার করা যায়নি" : "Could not share");
      }
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
      lang === "bn" ? "এই পোস্ট স্থায়ীভাবে মুছবেন?" : "Permanently delete this post?",
    );
    if (!ok) return;
    setDeleting(true);
    const { error } = await supabase.from("blood_requests").delete().eq("id", r.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "পোস্ট মুছে ফেলা হয়েছে" : "Post deleted");
    onChanged?.();
  }

  const ownerMenu =
    isOwner && r.status === "open" ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={managing || deleting}
            className="h-9 w-9 rounded-full grid place-items-center text-muted-foreground hover:bg-muted transition shrink-0"
            aria-label={lang === "bn" ? "আরও অপশন" : "More options"}
          >
            <MoreHorizontal className="h-5 w-5" />
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
    ) : null;

  return (
    <article
      className={`ua-anim-root relative bg-card content-visibility-auto ${
        highlighted ? "ring-2 ring-inset ring-primary/40" : ""
      }`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 420px" }}
    >
      {showBackdrop && levelCfg && (
        <UrgencyDropletBackdrop config={levelCfg} className="z-[6]" />
      )}

      {/* FB header: avatar · name · time · chips · menu */}
      <div className="relative z-[7] flex items-start gap-2.5 px-3 pt-3 pb-2">
        {isOwner ? (
          <Avatar name={r.requester?.full_name} src={r.requester?.avatar_url ?? undefined} size={40} />
        ) : (
          <Link
            to="/profile/$userId"
            params={{ userId: r.requester_id }}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={lang === "bn" ? "প্রোফাইল দেখুন" : "View profile"}
          >
            <Avatar name={r.requester?.full_name} src={r.requester?.avatar_url ?? undefined} size={40} />
          </Link>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {isOwner ? (
                <h3 className="text-[15px] font-semibold leading-snug truncate">{displayName}</h3>
              ) : (
                <Link
                  to="/profile/$userId"
                  params={{ userId: r.requester_id }}
                  className="text-[15px] font-semibold leading-snug truncate block hover:underline"
                >
                  {displayName}
                </Link>
              )}
              <p className="mt-0.5 text-[12px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span>{timeAgo(r.created_at, lang)}</span>
                <span className="text-muted-foreground/40">·</span>
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${urgencyChipClass(r.urgency)}`}
                >
                  {t(r.urgency)}
                </span>
                <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                  {r.blood_group}
                </span>
              </p>
            </div>
            {ownerMenu}
          </div>
        </div>
      </div>

      <RequestPostBody
        lang={lang}
        patient_name={r.patient_name}
        blood_group={r.blood_group}
        bags_needed={r.bags_needed}
        hospital_name={r.hospital_name}
        area={r.area}
        city={r.city}
        districtName={distName}
        needed_by={r.needed_by}
        notes={r.notes}
        need_reason_label={r.need_reason_label}
        factSettings={messaging}
      />

      {/* Full-bleed media */}
      {r.image_url && (
        <div className="relative z-[1] bg-muted/30">
          <CarouselRemoteImage
            src={r.image_url}
            className="aspect-[4/3] w-full sm:aspect-[16/10]"
            maxWidth={720}
            loading="lazy"
          />
        </div>
      )}

      {/* Engagement summary */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className="relative z-[7] px-3 py-2 flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="tabular-nums">
            {likeCount > 0
              ? `${likeCount} ${lang === "bn" ? "লাইক" : likeCount === 1 ? "like" : "likes"}`
              : ""}
          </span>
          <span className="tabular-nums">
            {commentCount > 0
              ? `${commentCount} ${lang === "bn" ? "কমেন্ট" : commentCount === 1 ? "comment" : "comments"}`
              : ""}
          </span>
        </div>
      )}

      {/* One-line action bar: Like · Comment · Share · Chat · Call · WA · Save */}
      <div className="relative z-[7] mx-3 border-t border-border/60 flex items-center gap-0.5 py-0.5">
        {messaging.post_icons.like && (
          <button
            type="button"
            onClick={toggleLike}
            className={`min-w-0 flex-1 flex items-center justify-center gap-1 py-2.5 text-[12px] sm:text-[13px] font-semibold rounded-lg hover:bg-muted/70 transition ${
              liked ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ThumbsUp className="h-[18px] w-[18px] shrink-0" fill={liked ? "currentColor" : "none"} strokeWidth={2} />
            <span className="truncate">{lang === "bn" ? "লাইক" : "Like"}</span>
          </button>
        )}
        {messaging.post_icons.comment && (
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="min-w-0 flex-1 flex items-center justify-center gap-1 py-2.5 text-[12px] sm:text-[13px] font-semibold text-muted-foreground rounded-lg hover:bg-muted/70 transition"
          >
            <MessagesSquare className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span className="truncate">{lang === "bn" ? "কমেন্ট" : "Comment"}</span>
          </button>
        )}
        {messaging.post_icons.share && (
          <button
            type="button"
            onClick={() => void share()}
            className="min-w-0 flex-1 flex items-center justify-center gap-1 py-2.5 text-[12px] sm:text-[13px] font-semibold text-muted-foreground rounded-lg hover:bg-muted/70 transition"
          >
            <Share2 className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span className="truncate">{t("share")}</span>
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
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 transition"
            title={t("chat")}
            aria-label={t("chat")}
          >
            <MessengerIcon className="h-[18px] w-[18px]" />
          </Link>
        )}
        {!isOwner && phone && messaging.post_icons.phone && (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition"
            title={lang === "bn" ? "কল" : "Call"}
            aria-label={lang === "bn" ? "কল" : "Call"}
          >
            <Phone className="h-[18px] w-[18px]" />
          </a>
        )}
        {!isOwner && waLink && messaging.post_icons.whatsapp && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/10 transition"
            title="WhatsApp"
            aria-label="WhatsApp"
          >
            <WhatsAppIcon className="h-[18px] w-[18px]" />
          </a>
        )}
        {messaging.post_icons.save && (
          <button
            type="button"
            onClick={() => void onToggleSave()}
            className={`h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg transition ${
              saved ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted/70"
            }`}
            title={lang === "bn" ? "সেভ" : "Save"}
            aria-label={lang === "bn" ? "সেভ" : "Save"}
          >
            <Bookmark className="h-[18px] w-[18px]" fill={saved ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <div className="relative z-[7] px-3 pb-3">
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
          compact
        />
      </div>

      {showComments && (
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
      )}

      {messaging.feed_show_post_divider && messaging.feed_post_divider_height_px > 0 && (
        <div
          className="relative z-[1] w-full shrink-0"
          style={{
            height: messaging.feed_post_divider_height_px,
            backgroundColor: messaging.feed_post_divider_color,
          }}
          aria-hidden
        />
      )}
    </article>
  );
}

export const RequestCard = memo(RequestCardInner);
