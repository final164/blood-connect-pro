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
import { useUrgencyAnimationSettings } from "@/hooks/useUrgencyAnimationSettings";
import { UrgencyDropletBackdrop, UrgencyHeaderIcon } from "@/components/request/UrgencyDropletBackdrop";
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
  Send,
  MessagesSquare,
  CornerDownRight,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Bookmark,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MessengerIcon } from "@/components/MessengerIcon";
import { DonationPanel } from "@/components/request/DonationPanel";
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
  district_id: string | null;
  contact_phone: string | null;
  whatsapp_phone?: string | null;
  needed_by: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string | null;
  need_reason_key?: string | null;
  need_reason_label?: string | null;
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
  const urgencyAnim = useUrgencyAnimationSettings();

  useEffect(() => {
    if (r.donation_completion_open) setCompletingMode(true);
  }, [r.donation_completion_open, r.id]);

  useEffect(() => {
    fetchNotificationSettings().then((s) => {
      setShowManagedMenu(s.enable_managed_button);
    });
    fetchDonationFlowSettings().then(setDonationFlow);
  }, []);

  useEffect(() => {
    setLiked(!!r.liked);
    setSaved(!!r.saved);
    setLikeCount(r.like_count ?? 0);
    setCommentCount(r.comment_count ?? 0);
  }, [r.liked, r.saved, r.like_count, r.comment_count, r.id]);

  const distName = lang === "bn" ? r.district?.name_bn : r.district?.name_en;
  const locationLabel = [r.hospital_name, distName || r.city].filter(Boolean).join(" · ");
  const isOwner = !!currentUserId && r.requester_id === currentUserId;
  const phone = r.contact_phone?.trim() || null;
  const waLink = r.whatsapp_phone?.trim() ? whatsappHref(r.whatsapp_phone.trim()) : null;
  const levelCfg =
    r.urgency === "critical" ? urgencyAnim.critical : r.urgency === "urgent" ? urgencyAnim.urgent : null;
  const showBackdrop = !!levelCfg?.enabled;

  async function toggleLike() {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase.from("request_likes").insert({ request_id: r.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("request_likes").delete().eq("request_id", r.id).eq("user_id", user.id);
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
    const text =
      lang === "bn"
        ? `${r.blood_group} রক্ত দরকার — ${r.patient_name}, ${locationLabel}`
        : `${r.blood_group} blood needed — ${r.patient_name}, ${locationLabel}`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    if (user && r.requester_id !== user.id) {
      await supabase.from("request_shares").upsert(
        { request_id: r.id, user_id: user.id },
        { onConflict: "request_id,user_id", ignoreDuplicates: true },
      );
    }
    try {
      if (navigator.share) await navigator.share({ title: "BloodLink", text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success(lang === "bn" ? "শেয়ার টেক্সট কপি হয়েছে" : "Share text copied");
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

  const urgencyStyle =
    r.urgency === "critical"
      ? "from-destructive/90 to-destructive text-destructive-foreground"
      : r.urgency === "urgent"
        ? "from-[color:var(--urgent)] to-amber-600 text-white"
        : "from-primary to-primary/80 text-primary-foreground";

  return (
    <article
      className={`ua-anim-root relative rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
        highlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""
      }`}
    >
      {showBackdrop && levelCfg && <UrgencyDropletBackdrop config={levelCfg} className="z-0" />}

      <div className={`relative z-[1] bg-gradient-to-r ${urgencyStyle} px-4 py-2.5 flex items-center justify-between gap-2`}>
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
          <p className="text-xs leading-relaxed text-foreground/80 bg-muted/40 rounded-xl px-3 py-2">{r.notes}</p>
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

        <div className="flex items-center gap-1 pt-1 border-t">
          <button
            type="button"
            onClick={toggleLike}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition hover:bg-muted ${
              liked ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ThumbsUp className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
            {likeCount}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <MessagesSquare className="h-4 w-4" />
            {commentCount}
          </button>
          {!isOwner && (
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
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <MessengerIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("chat")}</span>
            </Link>
          )}
          {!isOwner && phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              title={lang === "bn" ? "এখনই কল করুন" : "Call now"}
              className="h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center hover:bg-primary/15 transition"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {!isOwner && waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              title="WhatsApp"
              className="h-8 w-8 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 grid place-items-center hover:bg-emerald-600/15 transition"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => void onToggleSave()}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition hover:bg-muted ${
              saved ? "text-primary" : "text-muted-foreground"
            }`}
            title={lang === "bn" ? "সেভ" : "Save"}
          >
            <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
            <span className="hidden sm:inline">{lang === "bn" ? "সেভ" : "Save"}</span>
          </button>
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted ml-auto"
          >
            <Share2 className="h-4 w-4" />
            {t("share")}
          </button>
        </div>

        {showComments && (
          <CommentThread
            requestId={r.id}
            onCount={(n) => {
              setCommentCount(n);
              onChanged?.();
            }}
          />
        )}
      </div>
    </article>
  );
}

function CommentThread({ requestId, onCount }: { requestId: string; onCount: (n: number) => void }) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  type Cmt = {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    parent_id?: string | null;
    name?: string;
    like_count: number;
    liked: boolean;
  };
  const [items, setItems] = useState<Cmt[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Cmt | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    const { data: rows, error } = await supabase
      .from("request_comments")
      .select("id, content, user_id, created_at, parent_id")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) {
      const { data: rows2, error: err2 } = await supabase
        .from("request_comments")
        .select("id, content, user_id, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (err2) return;
      await enrichAndSet((rows2 ?? []).map((row) => ({ ...row, parent_id: null })));
      return;
    }
    await enrichAndSet(rows ?? []);
  }

  async function enrichAndSet(
    rows: { id: string; content: string; user_id: string; created_at: string; parent_id?: string | null }[],
  ) {
    onCount(rows.length);
    const ids = [...new Set(rows.map((row) => row.user_id))];
    const commentIds = rows.map((row) => row.id);
    let nameMap = new Map<string, string | null>();
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    }
    const likeCount = new Map<string, number>();
    const likedMine = new Set<string>();
    if (commentIds.length) {
      const { data: likes } = await supabase
        .from("request_comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      (likes ?? []).forEach((l: { comment_id: string; user_id: string }) => {
        likeCount.set(l.comment_id, (likeCount.get(l.comment_id) ?? 0) + 1);
        if (user && l.user_id === user.id) likedMine.add(l.comment_id);
      });
    }
    setItems(
      rows.map((row) => ({
        ...row,
        parent_id: row.parent_id ?? null,
        name: nameMap.get(row.user_id) ?? "User",
        like_count: likeCount.get(row.id) ?? 0,
        liked: likedMine.has(row.id),
      })),
    );
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`req-cmt-${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_comments", filter: `request_id=eq.${requestId}` },
        () => load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "request_comment_likes" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, user?.id]);

  async function send() {
    if (!user || !text.trim()) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      request_id: requestId,
      user_id: user.id,
      content: text.trim(),
    };
    if (replyTo) payload.parent_id = replyTo.id;
    const { error } = await supabase.from("request_comments").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    if (replyTo) setExpanded((e) => ({ ...e, [replyTo.id]: true }));
    setText("");
    setReplyTo(null);
    load();
  }

  async function toggleCommentLike(c: Cmt) {
    if (!user) return;
    const next = !c.liked;
    setItems((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, liked: next, like_count: Math.max(0, x.like_count + (next ? 1 : -1)) } : x,
      ),
    );
    try {
      if (next) {
        const { error } = await supabase.from("request_comment_likes").insert({ comment_id: c.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("request_comment_likes")
          .delete()
          .eq("comment_id", c.id)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (e) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, liked: !next, like_count: Math.max(0, x.like_count + (next ? -1 : 1)) } : x,
        ),
      );
      toast.error((e as Error).message);
    }
  }

  const roots = items.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => items.filter((c) => c.parent_id === id);

  function rememberFeedReturn() {
    try {
      sessionStorage.setItem("feedReturnRequestId", requestId);
    } catch {
      /* ignore */
    }
  }

  function CommentRow({ c }: { c: Cmt }) {
    const replies = repliesOf(c.id);
    const open = !!expanded[c.id];
    return (
      <div>
        <div className="text-xs py-1.5">
          <div className="flex items-baseline gap-1 flex-wrap">
            {c.user_id !== user?.id ? (
              <Link
                to="/chat/$peerId"
                params={{ peerId: c.user_id }}
                search={{ fromRequestId: requestId }}
                onClick={rememberFeedReturn}
                className="font-semibold text-foreground hover:text-primary underline-offset-2 hover:underline"
              >
                {c.name}
              </Link>
            ) : (
              <span className="font-semibold">{c.name}</span>
            )}
            <span className="text-muted-foreground"> · {timeAgo(c.created_at, lang)}</span>
          </div>
          <p className="mt-0.5 text-foreground/90 leading-relaxed">{c.content}</p>
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => void toggleCommentLike(c)}
              className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium transition hover:bg-muted ${
                c.liked ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <ThumbsUp className="h-3 w-3" fill={c.liked ? "currentColor" : "none"} />
              {c.like_count > 0 ? c.like_count : lang === "bn" ? "লাইক" : "Like"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyTo(c);
                setText("");
              }}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              <CornerDownRight className="h-3 w-3" />
              {lang === "bn" ? "রিপ্লাই" : "Reply"}
            </button>
            {replies.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [c.id]: !open }))}
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline px-1"
              >
                {open
                  ? lang === "bn"
                    ? "লুকান"
                    : "Hide"
                  : lang === "bn"
                    ? `${replies.length}টি রিপ্লাই`
                    : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
              </button>
            )}
            {c.user_id !== user?.id && (
              <Link
                to="/chat/$peerId"
                params={{ peerId: c.user_id }}
                search={{ fromRequestId: requestId }}
                onClick={rememberFeedReturn}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
              >
                <MessengerIcon className="h-3.5 w-3.5" />
                {t("chat")}
              </Link>
            )}
          </div>
        </div>
        {open && replies.length > 0 && (
          <div className="ml-3 pl-2.5 border-l border-border/70 space-y-0.5">
            {replies.map((rep) => (
              <div key={rep.id} className="text-xs py-1.5">
                <div className="flex items-baseline gap-1 flex-wrap">
                  {rep.user_id !== user?.id ? (
                    <Link
                      to="/chat/$peerId"
                      params={{ peerId: rep.user_id }}
                      search={{ fromRequestId: requestId }}
                      onClick={rememberFeedReturn}
                      className="font-semibold hover:text-primary underline-offset-2 hover:underline"
                    >
                      {rep.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{rep.name}</span>
                  )}
                  <span className="text-muted-foreground"> · {timeAgo(rep.created_at, lang)}</span>
                </div>
                <p className="mt-0.5 text-foreground/90">{rep.content}</p>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleCommentLike(rep)}
                    className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium hover:bg-muted ${
                      rep.liked ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" fill={rep.liked ? "currentColor" : "none"} />
                    {rep.like_count > 0 ? rep.like_count : lang === "bn" ? "লাইক" : "Like"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(c);
                      setText("");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    {lang === "bn" ? "রিপ্লাই" : "Reply"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-muted/30 p-2.5 space-y-1">
      {roots.map((c) => (
        <CommentRow key={c.id} c={c} />
      ))}
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground py-1">
          {lang === "bn" ? "এখনো কমেন্ট নেই" : "No comments yet"}
        </p>
      )}
      {replyTo && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-background/80 border px-2.5 py-1.5 text-[11px]">
          <span className="text-muted-foreground truncate">
            {lang === "bn" ? "রিপ্লাই" : "Replying"} ·{" "}
            <span className="font-medium text-foreground">{replyTo.name}</span>
          </span>
          <button type="button" className="text-primary font-medium shrink-0" onClick={() => setReplyTo(null)}>
            {t("cancel")}
          </button>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <input
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={
            replyTo
              ? lang === "bn"
                ? `${replyTo.name}-কে রিপ্লাই…`
                : `Reply to ${replyTo.name}…`
              : t("typeMessage")
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={send}
          className="rounded-xl bg-primary text-primary-foreground px-3 py-2 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
