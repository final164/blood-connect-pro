import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMyOrgJoinState,
  orgJoinErrorMessage,
  requestJoinCommunityOrg,
  type OrgJoinState,
} from "@/lib/community-org-join";

export function OrgJoinRequestButton({
  orgId,
  lang,
  compact = false,
  nextPath,
}: {
  orgId: string;
  lang: "bn" | "en";
  compact?: boolean;
  nextPath?: string;
}) {
  const { user, loading, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const bn = lang === "bn";
  const [state, setState] = useState<OrgJoinState | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || isAnonymous) {
      setState(null);
      return;
    }
    let cancelled = false;
    void fetchMyOrgJoinState(orgId)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState({ member: false, status: null });
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, user, loading, isAnonymous]);

  const signedIn = !!user && !isAnonymous;
  const member = !!state?.member;
  const pending = state?.status === "pending";

  async function submit() {
    if (!signedIn) {
      void navigate({
        to: "/auth",
        search: { next: nextPath || `/org/public/${orgId}` },
      });
      return;
    }
    setBusy(true);
    try {
      const result = await requestJoinCommunityOrg(orgId, note);
      if (result.already_member || result.status === "member") {
        setState({ member: true, status: "member" });
        toast.success(bn ? "আপনি ইতিমধ্যে এই সংস্থার সদস্য" : "You are already a member");
      } else {
        setState({ member: false, status: "pending" });
        toast.success(
          result.already_pending
            ? bn
              ? "আপনার অনুরোধ আগেই পাঠানো হয়েছে"
              : "Your request is already pending"
            : bn
              ? "যুক্ত হওয়ার অনুরোধ পাঠানো হয়েছে"
              : "Join request sent",
        );
      }
      setOpen(false);
      setNote("");
    } catch (err) {
      toast.error(orgJoinErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  }

  if (member) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-xl bg-primary/10 font-semibold text-primary ${
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
        {bn ? "সদস্য" : "Member"}
      </span>
    );
  }

  if (pending) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-xl border bg-muted/60 font-semibold text-muted-foreground ${
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
        }`}
      >
        {bn ? "অনুরোধ পাঠানো হয়েছে" : "Request sent"}
      </span>
    );
  }

  return (
    <div className={compact ? "" : "space-y-2"}>
      {!open ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!signedIn) {
              void navigate({
                to: "/auth",
                search: { next: nextPath || `/org/public/${orgId}` },
              });
              return;
            }
            if (compact) {
              void submit();
              return;
            }
            setOpen(true);
          }}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground ${
            compact ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2.5 text-xs"
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {bn ? "যুক্ত হতে অনুরোধ" : "Request to join"}
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl border bg-card p-3">
          <p className="text-xs font-semibold">
            {bn ? "সংস্থায় যুক্ত হওয়ার অনুরোধ" : "Request to join this organization"}
          </p>
          <textarea
            value={note}
            maxLength={300}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder={bn ? "সংক্ষেপে বলুন কেন যুক্ত হতে চান (ঐচ্ছিক)" : "Why you want to join (optional)"}
            className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {bn ? "পাঠান" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              {bn ? "বাতিল" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
