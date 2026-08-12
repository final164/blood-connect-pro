import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import {
  DEFAULT_DONATION_FLOW_SETTINGS,
  donationLabel,
  fetchDonationFlowSettings,
  type DonationFlowSettings,
} from "@/lib/donation-flow-settings";
import {
  assignDonor,
  bagsConfirmed,
  cancelOwnOffer,
  claimDonated,
  claimDonatedDirect,
  confirmOffer,
  expressInterest,
  fetchOffersForRequests,
  fulfillRequest,
  rejectOffer,
  searchProfiles,
  type DonationOffer,
} from "@/lib/donation-offers";
import { CheckCircle2, HeartHandshake, Search, UserPlus, X } from "lucide-react";

export function DonationPanel({
  requestId,
  requesterId,
  bagsNeeded,
  status,
  isOwner,
  onChanged,
  completingMode = false,
  completionOpen = false,
  onExitCompleting,
  onReopenCompleting,
  compact = false,
}: {
  requestId: string;
  requesterId: string;
  bagsNeeded: number;
  status: string;
  isOwner: boolean;
  onChanged?: () => void;
  /** Owner UI for assign + finish */
  completingMode?: boolean;
  /** Donors may claim “I donated” only after owner opened completion */
  completionOpen?: boolean;
  onExitCompleting?: () => void;
  onReopenCompleting?: () => void;
  /** Lighter chrome for Facebook-style feed cards */
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [offers, setOffers] = useState<DonationOffer[]>([]);
  const [flow, setFlow] = useState<DonationFlowSettings>(DEFAULT_DONATION_FLOW_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [claimBags, setClaimBags] = useState(1);
  const [assignQ, setAssignQ] = useState("");
  const [assignHits, setAssignHits] = useState<
    Array<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      phone: string | null;
      blood_group: string | null;
    }>
  >([]);
  const [assignBags, setAssignBags] = useState(1);

  async function reload() {
    try {
      setOffers(await fetchOffersForRequests([requestId]));
    } catch {
      /* SQL may be missing */
    }
  }

  useEffect(() => {
    void reload();
    fetchDonationFlowSettings().then(setFlow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    if (!completingMode || assignQ.trim().length < 2) {
      setAssignHits([]);
      return;
    }
    const tmr = window.setTimeout(() => {
      searchProfiles(assignQ)
        .then(setAssignHits)
        .catch(() => setAssignHits([]));
    }, 250);
    return () => window.clearTimeout(tmr);
  }, [assignQ, completingMode]);

  const myOffer = user ? offers.find((o) => o.donor_id === user.id) : undefined;
  const confirmed = offers.filter((o) => o.status === "confirmed");
  const pending = offers.filter((o) => o.status === "donated_claimed");
  const interested = offers.filter((o) => o.status === "interested");
  const assignedCount = confirmed.filter((o) => o.source === "assigned").length;
  const confirmedCount = confirmed.length;
  const maxAssign = flow.max_assigned_donors;
  const canAddConfirmed = confirmedCount < maxAssign;
  const canAssignMore = canAddConfirmed;
  const doneBags = bagsConfirmed(offers);
  const open = status === "open";
  const enableInterest = flow.enable_i_can_donate;
  const enableIDonated = flow.enable_i_donated;
  const enableConfirm = flow.enable_confirm;
  const enableAssign = flow.enable_assign;
  const showProgress = flow.show_progress;
  const claimsUnlocked = flow.require_complete_first ? completionOpen : true;
  const L = (key: Parameters<typeof donationLabel>[1]) => donationLabel(flow, key, lang);

  function atConfirmCap() {
    if (canAddConfirmed) return false;
    toast.error(
      lang === "bn"
        ? `সর্বোচ্চ ${maxAssign} জন ডোনার নিশ্চিত করা যায়`
        : `Max ${maxAssign} donors can be confirmed`,
    );
    return true;
  }

  async function run(fn: () => Promise<{ error?: { message: string } | null }>) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      if (/request_donation_offers|donations|donation_flow|relation|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে donation SQL স্ক্রিপ্টগুলো চালান"
            : "Run donation SQL scripts first",
        );
      }
      return toast.error(error.message);
    }
    await reload();
    onChanged?.();
  }

  async function finishComplete() {
    setBusy(true);
    const { error } = await fulfillRequest(requestId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "রক্ত দান সম্পন্ন — ম্যানেজড" : "Marked as complete");
    onExitCompleting?.();
    onChanged?.();
  }

  async function onInterest() {
    if (!user) return;
    await run(async () => expressInterest(requestId, user.id));
    toast.success(lang === "bn" ? "আগ্রহ জানানো হয়েছে" : "Marked as interested");
  }

  async function onClaimFromInterest() {
    if (!enableIDonated) return;
    if (!claimsUnlocked) {
      return toast.error(
        lang === "bn"
          ? "পোস্টকারী Complete করার পর দাবি করা যাবে"
          : "You can claim after the owner starts Complete",
      );
    }
    const slotTaken = confirmedCount + pending.length;
    if (slotTaken >= maxAssign && myOffer?.status !== "donated_claimed") {
      return toast.error(
        lang === "bn"
          ? `সর্বোচ্চ ${maxAssign} জন দাবি/নিশ্চিত হতে পারবে`
          : `Max ${maxAssign} donors can claim/confirm`,
      );
    }
    if (!myOffer) return;
    await run(async () => claimDonated(myOffer.id, claimBags));
    toast.success(
      lang === "bn" ? "দান দাবি করা হয়েছে — মালিক নিশ্চিত করবেন" : "Claimed — waiting for owner confirm",
    );
  }

  async function onClaimDirect() {
    if (!user || !enableIDonated) return;
    if (!claimsUnlocked) {
      return toast.error(
        lang === "bn"
          ? "পোস্টকারী Complete করার পর দাবি করা যাবে"
          : "You can claim after the owner starts Complete",
      );
    }
    const slotTaken = confirmedCount + pending.length;
    if (slotTaken >= maxAssign) {
      return toast.error(
        lang === "bn"
          ? `সর্বোচ্চ ${maxAssign} জন দাবি/নিশ্চিত হতে পারবে`
          : `Max ${maxAssign} donors can claim/confirm`,
      );
    }
    await run(async () => claimDonatedDirect(requestId, user.id, claimBags));
    toast.success(
      lang === "bn" ? "দান দাবি করা হয়েছে — মালিক নিশ্চিত করবেন" : "Claimed — waiting for owner confirm",
    );
  }

  async function onCancelMine() {
    if (!myOffer) return;
    await run(async () => cancelOwnOffer(myOffer.id));
  }

  async function onConfirm(offer: DonationOffer) {
    if (!enableConfirm) return;
    if (atConfirmCap()) return;
    await run(async () => confirmOffer({ offer, recipientId: requesterId, bags: offer.bags }));
    toast.success(lang === "bn" ? "ডোনেশন নিশ্চিত" : "Donation confirmed");
  }

  async function onReject(offerId: string) {
    if (!enableConfirm) return;
    await run(async () => rejectOffer(offerId));
  }

  async function onAssign(donorId: string) {
    if (!user || !enableAssign) return;
    if (atConfirmCap()) return;
    if (donorId === requesterId) {
      return toast.error(lang === "bn" ? "নিজেকে assign করা যাবে না" : "Cannot assign yourself");
    }
    const existing = offers.find((o) => o.donor_id === donorId);
    if (existing?.status === "confirmed") {
      return toast.error(lang === "bn" ? "ইতিমধ্যে নিশ্চিত" : "Already confirmed");
    }
    await run(async () =>
      assignDonor({
        requestId,
        donorId,
        requesterId: user.id,
        bags: assignBags,
        existingOfferId: existing?.id,
      }),
    );
    toast.success(lang === "bn" ? "ডোনার assign হয়েছে" : "Donor assigned");
    setAssignQ("");
  }

  return (
    <div
      className={`${
        compact
          ? "rounded-xl border border-border/50 bg-muted/25 p-2.5 space-y-2"
          : "rounded-xl border p-3 space-y-2.5"
      } ${completingMode ? "border-primary/40 bg-primary/5" : compact ? "" : "bg-muted/20"}`}
    >
      {showProgress && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5 text-primary" />
              {completingMode
                ? lang === "bn"
                  ? "সম্পন্ন — ডোনার assign করুন"
                  : "Complete — assign donors"
                : L("progress_title")}
            </p>
            <span className="text-[11px] font-medium text-muted-foreground">
              {doneBags}/{bagsNeeded} {lang === "bn" ? "ব্যাগ" : "bags"}
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (doneBags / Math.max(1, bagsNeeded)) * 100)}%` }}
            />
          </div>
        </>
      )}

      {confirmed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "সহায়তা করেছেন" : "Helped by"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {confirmed.map((o) => (
              <li
                key={o.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-[11px]"
              >
                <Avatar name={o.donor?.full_name} src={o.donor?.avatar_url ?? undefined} size={20} />
                <span className="font-medium max-w-[7rem] truncate">
                  {o.donor?.full_name || "User"}
                </span>
                <span className="text-muted-foreground">×{o.bags}</span>
                {o.source === "assigned" && (
                  <span className="text-[9px] text-primary">
                    {lang === "bn" ? "অ্যাসাইন" : "assigned"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Donor actions */}
      {open && user && !isOwner && (
        <div className="space-y-2 pt-1">
          {(!myOffer || myOffer.status === "cancelled" || myOffer.status === "rejected") &&
            enableInterest && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onInterest()}
                className="w-full rounded-xl bg-primary/10 text-primary text-xs font-semibold py-2.5 hover:bg-primary/15 disabled:opacity-50"
              >
                {L("i_can_donate")}
              </button>
            )}

          {(!myOffer || myOffer.status === "cancelled" || myOffer.status === "rejected") &&
            !enableInterest &&
            enableIDonated &&
            claimsUnlocked && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground shrink-0">
                  {lang === "bn" ? "ব্যাগ" : "Bags"}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={claimBags}
                  onChange={(e) => setClaimBags(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-lg border bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  disabled={busy || confirmedCount + pending.length >= maxAssign}
                  onClick={() => void onClaimDirect()}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold py-2 disabled:opacity-50"
                >
                  {L("i_donated")}
                </button>
              </div>
            )}

          {myOffer?.status === "interested" && (
            <div className="space-y-2">
              {enableIDonated && claimsUnlocked ? (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground shrink-0">
                    {lang === "bn" ? "ব্যাগ" : "Bags"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={claimBags}
                    onChange={(e) => setClaimBags(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 rounded-lg border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy || confirmedCount + pending.length >= maxAssign}
                    onClick={() => void onClaimFromInterest()}
                    className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold py-2 disabled:opacity-50"
                  >
                    {L("i_donated")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onCancelMine()}
                    className="h-8 w-8 rounded-lg border grid place-items-center text-muted-foreground"
                    aria-label={t("cancel")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[11px] text-muted-foreground text-center py-1">
                    {!enableIDonated
                      ? lang === "bn"
                        ? "আগ্রহী হিসেবে চিহ্নিত"
                        : "Marked as interested"
                      : lang === "bn"
                        ? "আগ্রহী — পোস্টকারী Complete করলে দাবি করা যাবে"
                        : "Interested — claim after owner starts Complete"}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onCancelMine()}
                    className="h-8 w-8 rounded-lg border grid place-items-center text-muted-foreground shrink-0"
                    aria-label={t("cancel")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {myOffer?.status === "donated_claimed" && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 text-center py-1">
              {L("waiting_confirm")}
            </p>
          )}

          {myOffer?.status === "confirmed" && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 text-center py-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {myOffer.source === "assigned"
                ? lang === "bn"
                  ? "পোস্টকারী আপনাকে ডোনার হিসেবে যোগ করেছেন"
                  : "Post owner assigned you as donor"
                : lang === "bn"
                  ? "আপনার দান নিশ্চিত হয়েছে"
                  : "Your donation is confirmed"}
            </p>
          )}
        </div>
      )}

      {/* Owner: pending claims */}
      {open && isOwner && enableConfirm && claimsUnlocked && pending.length > 0 && (
        <ul className="space-y-1.5 pt-1 border-t">
          {pending.map((o) => (
            <li key={o.id} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5">
              <Avatar name={o.donor?.full_name} src={o.donor?.avatar_url ?? undefined} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{o.donor?.full_name || "User"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {lang === "bn" ? `দিয়েছে দাবি · ${o.bags} ব্যাগ` : `Claimed · ${o.bags} bag(s)`}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !canAddConfirmed}
                onClick={() => void onConfirm(o)}
                className="rounded-lg bg-primary text-primary-foreground px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
              >
                {L("confirm")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onReject(o.id)}
                className="rounded-lg border px-2 py-1 text-[10px] disabled:opacity-50"
              >
                {L("reject")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Owner: interested → assign shortcut */}
      {open && isOwner && completingMode && enableAssign && interested.length > 0 && (
        <ul className="space-y-1.5">
          {interested.map((o) => (
            <li key={o.id} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5">
              <Avatar name={o.donor?.full_name} src={o.donor?.avatar_url ?? undefined} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{o.donor?.full_name || "User"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {lang === "bn" ? "আগ্রহী" : "Interested"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !canAssignMore}
                onClick={() => void onAssign(o.donor_id)}
                className="rounded-lg bg-primary/10 text-primary px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
              >
                {L("assign")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Owner: reopen */}
      {open && isOwner && completionOpen && !completingMode && (
        <button
          type="button"
          onClick={() => onReopenCompleting?.()}
          className="w-full rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-semibold py-2.5"
        >
          {L("reopen_assign")}
        </button>
      )}

      {/* Owner completing */}
      {open && isOwner && completingMode && (
        <div className="space-y-2 pt-1 border-t">
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn"
              ? `নিশ্চিত ${confirmedCount}/${maxAssign} জন${enableAssign ? ` (assign ${assignedCount})` : ""}।`
              : `Confirmed ${confirmedCount}/${maxAssign}${enableAssign ? ` (assigned ${assignedCount})` : ""}.`}
          </p>

          {enableAssign && canAssignMore && (
            <div className="space-y-2 rounded-lg border bg-card p-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <UserPlus className="h-3.5 w-3.5 text-primary" />
                {lang === "bn" ? "ডোনার assign করুন" : "Assign a donor"}
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  value={assignQ}
                  onChange={(e) => setAssignQ(e.target.value)}
                  placeholder={lang === "bn" ? "নাম বা ফোন খুঁজুন…" : "Search name or phone…"}
                  className="flex-1 min-w-0 bg-transparent text-xs outline-none"
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={assignBags}
                  onChange={(e) => setAssignBags(Math.max(1, Number(e.target.value) || 1))}
                  className="w-12 rounded border px-1 py-0.5 text-[11px]"
                  title={lang === "bn" ? "ব্যাগ" : "Bags"}
                />
              </div>
              <ul className="max-h-36 overflow-y-auto divide-y">
                {assignHits.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busy || p.id === requesterId}
                      onClick={() => void onAssign(p.id)}
                      className="w-full flex items-center gap-2 px-1 py-1.5 text-left hover:bg-muted disabled:opacity-40"
                    >
                      <Avatar name={p.full_name} src={p.avatar_url ?? undefined} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {p.full_name || p.phone || p.id.slice(0, 8)}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[p.blood_group, p.phone].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
                {assignQ.trim().length >= 2 && assignHits.length === 0 && (
                  <li className="text-[11px] text-muted-foreground py-2 text-center">
                    {lang === "bn" ? "কেউ পাওয়া যায়নি" : "No matches"}
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onExitCompleting?.()}
              className="flex-1 rounded-xl border text-xs font-semibold py-2.5 hover:bg-muted disabled:opacity-50"
            >
              {lang === "bn" ? "পিছনে" : "Back"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finishComplete()}
              className="flex-[1.4] rounded-xl bg-primary text-primary-foreground text-xs font-semibold py-2.5 disabled:opacity-50"
            >
              {L("finish")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
