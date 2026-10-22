import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listOrgJoinRequests,
  orgJoinErrorMessage,
  reviewOrgJoinRequest,
  type OrgJoinRequestRow,
} from "@/lib/community-org-join";

export function OrgJoinInbox({
  orgId,
  lang,
  canReview,
}: {
  orgId: string;
  lang: "bn" | "en";
  canReview: boolean;
}) {
  const bn = lang === "bn";
  const [rows, setRows] = useState<OrgJoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await listOrgJoinRequests(orgId));
      setHidden(false);
    } catch (err) {
      const msg = orgJoinErrorMessage(err, lang);
      if (/not_allowed/i.test(String(err instanceof Error ? err.message : err))) {
        setHidden(true);
        setRows([]);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canReview) return;
    void load();
  }, [orgId, canReview]);

  if (!canReview || hidden) return null;

  async function review(id: string, approve: boolean) {
    setBusyId(id);
    try {
      await reviewOrgJoinRequest(id, approve);
      toast.success(approve ? (bn ? "সদস্য করা হয়েছে" : "Added as member") : bn ? "অনুরোধ বাতিল" : "Request declined");
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      toast.error(orgJoinErrorMessage(err, lang));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold">{bn ? "যুক্ত হওয়ার অনুরোধ" : "Join requests"}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {bn
            ? "অনুমোদন করলে ইউজার ভিউয়ার সদস্য হবেন।"
            : "Approving adds the user as a viewer member."}
        </p>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {bn ? "লোড হচ্ছে" : "Loading"}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{bn ? "কোনো নতুন অনুরোধ নেই" : "No new requests"}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {row.requester_name || (bn ? "ইউজার" : "User")}
                    {row.requester_blood_group ? (
                      <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {row.requester_blood_group}
                      </span>
                    ) : null}
                  </p>
                  {row.requester_phone ? (
                    <p className="text-[11px] text-muted-foreground">{row.requester_phone}</p>
                  ) : null}
                  {row.message ? <p className="mt-1 text-xs leading-relaxed">{row.message}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void review(row.id, true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {bn ? "গ্রহণ" : "Accept"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void review(row.id, false)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    {bn ? "বাতিল" : "Decline"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
