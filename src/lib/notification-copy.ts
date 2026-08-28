import type { AppNotification } from "@/lib/notifications-context";

export function resolveActorName(n: AppNotification, lang: "bn" | "en"): string {
  const fromData =
    typeof n.data?.actor_name === "string" ? n.data.actor_name.trim() : "";
  const fromProfile = n.actor?.full_name?.trim() || "";
  const name = fromData || fromProfile;
  if (name && name !== "User") return name;
  if (name === "User") return lang === "bn" ? "একজন ব্যবহারকারী" : "A user";
  return lang === "bn" ? "কেউ" : "Someone";
}

export function notificationCopy(
  n: AppNotification,
  lang: "bn" | "en",
): { title: string; body: string | null } {
  const kind = String(n.data?.kind || n.title || n.type || "");
  const name = resolveActorName(n, lang);

  if (kind === "new_request" || n.type === "request_match") {
    return {
      title: lang === "bn" ? "নতুন রক্তের রিকোয়েস্ট" : "New blood request",
      body: n.body || n.title,
    };
  }

  if (kind.startsWith("care_") || String(n.title || "").startsWith("care_")) {
    const map: Record<string, { bn: string; en: string }> = {
      care_serial_booked: { bn: "সিরিয়াল নিশ্চিত", en: "Serial confirmed" },
      care_serial_pending: { bn: "সিরিয়াল অনুরোধ গৃহীত", en: "Serial request received" },
      care_serial_approved: { bn: "সিরিয়াল অনুমোদিত", en: "Serial approved" },
      care_serial_called: { bn: "আপনার নম্বর কল হয়েছে", en: "Your number is called" },
      care_serial_ahead: { bn: "আপনার পালা কাছে", en: "You are next soon" },
      care_session_paused: { bn: "সেশন আপডেট", en: "Session updated" },
      care_lab_reserved: { bn: "টেস্ট বুকিং নিশ্চিত", en: "Test booking confirmed" },
      care_lab_cancelled: { bn: "টেস্ট বুকিং বাতিল", en: "Test booking cancelled" },
    };
    const hit = map[kind] || map[String(n.title)];
    const serial =
      n.data?.serial_no != null
        ? String(n.data.serial_no)
        : n.data?.serial != null
          ? String(n.data.serial)
          : null;
    let body = n.body;
    if (serial && (kind === "care_serial_pending" || kind === "care_serial_approved" || kind === "care_serial_booked")) {
      if (kind === "care_serial_pending") {
        body =
          lang === "bn"
            ? `আপনার সিরিয়াল #${serial} — চেম্বার অনুমোদনের অপেক্ষায়।`
            : `Your serial is #${serial} — awaiting chamber approval.`;
      } else if (kind === "care_serial_approved") {
        body =
          lang === "bn"
            ? `আপনার সিরিয়াল #${serial} অনুমোদিত হয়েছে।`
            : `Your serial #${serial} has been approved.`;
      } else {
        body = lang === "bn" ? `আপনার সিরিয়াল নম্বর ${serial}` : `Your serial is ${serial}`;
      }
    }
    return {
      title: hit ? (lang === "bn" ? hit.bn : hit.en) : n.title || "Care",
      body,
    };
  }

  if (n.type === "system" && !/request|like|comment|share|reply/i.test(kind)) {
    return { title: n.title || (lang === "bn" ? "সিস্টেম" : "System"), body: n.body };
  }

  const isCommentLike = kind === "comment_like" || n.title === "comment_like";
  const isReply = kind === "reply" || n.title === "request_reply";
  const isLike =
    !isCommentLike &&
    (["like", "request_like", "post_like"].includes(kind) || n.type === "post_like");
  const isComment =
    !isReply &&
    (["comment", "request_comment", "post_comment"].includes(kind) ||
      n.type === "post_comment");
  const isShare = ["share", "request_share"].includes(kind) || n.title === "request_share";

  if (lang === "bn") {
    if (isCommentLike) return { title: `${name} আপনার কমেন্টে লাইক দিয়েছে`, body: null };
    if (isReply) return { title: `${name} আপনার কমেন্টে রিপ্লাই করেছে`, body: n.body };
    if (isLike) return { title: `${name} আপনার পোস্টে লাইক দিয়েছে`, body: null };
    if (isComment) return { title: `${name} আপনার পোস্টে কমেন্ট করেছে`, body: n.body };
    if (isShare) return { title: `${name} আপনার পোস্ট শেয়ার করেছে`, body: null };
  } else {
    if (isCommentLike) return { title: `${name} liked your comment`, body: null };
    if (isReply) return { title: `${name} replied to your comment`, body: n.body };
    if (isLike) return { title: `${name} liked your post`, body: null };
    if (isComment) return { title: `${name} commented on your post`, body: n.body };
    if (isShare) return { title: `${name} shared your post`, body: null };
  }

  return { title: n.title || "Muktosheba", body: n.body || null };
}
