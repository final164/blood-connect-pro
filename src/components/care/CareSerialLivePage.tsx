import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import {
  fetchSerial,
  fetchSession,
  fetchSessionQueue,
  isSerialPendingApproval,
  queueAhead,
  setSerialStatus,
  subscribeSession,
  type CareSerialRow,
  type CareSessionRow,
} from "@/lib/care-api";
import { CareSerialInvoiceCard } from "@/components/care/CareSerialInvoice";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";

export function CareSerialLivePage({ serialId }: { serialId: string }) {
  const { lang } = useI18n();
  const [ticket, setTicket] = useState<CareSerialRow | null>(null);
  const [session, setSession] = useState<CareSessionRow | null>(null);
  const [queue, setQueue] = useState<CareSerialRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const t = await fetchSerial(serialId);
    setTicket(t);
    if (!t) return;
    const [sess, q] = await Promise.all([fetchSession(t.session_id), fetchSessionQueue(t.session_id)]);
    setSession(sess);
    setQueue(q);
  }, [serialId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!ticket?.session_id) return;
    return subscribeSession(ticket.session_id, () => {
      void reload();
    });
  }, [ticket?.session_id, reload]);

  const pending = ticket ? isSerialPendingApproval(ticket) : false;
  const ahead = ticket && !pending ? queueAhead(ticket.serial_no, queue) : 0;
  const now = session?.now_serving ?? 0;

  async function cancel() {
    if (!ticket) return;
    setBusy(true);
    try {
      await setSerialStatus(ticket.id, "cancelled");
      toast.success(lang === "bn" ? "বাতিল হয়েছে" : "Cancelled");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton
            fallbackTo={{ to: "/care", search: { tab: "bookings" } }}
            shape="xl"
          />
          <h1 className="text-sm font-bold flex-1 truncate">
            {lang === "bn" ? "লাইভ কিউ" : "Live queue"}
          </h1>
          {session?.org_id ? (
            <CareOrgChatButton orgId={session.org_id} variant="icon" />
          ) : null}
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-lg mx-auto space-y-6">
        {!ticket ? (
          <p className="text-sm text-muted-foreground">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : (
          <>
            <div className="text-center space-y-4 max-w-md mx-auto">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {pending
                ? lang === "bn"
                  ? "অনলাইন সিরিয়াল · অনুমোদন বাকি"
                  : "Online serial · awaiting approval"
                : lang === "bn"
                  ? "চেম্বার সিরিয়াল নম্বর"
                  : "Chamber serial number"}
            </p>
            {pending ? (
              <>
                <p className="font-black tabular-nums text-sky-800 text-6xl">
                  {ticket.online_serial_no ?? "—"}
                </p>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-amber-700">
                    {lang === "bn" ? "চেম্বার সিরিয়াল" : "Chamber serial"}
                  </p>
                  <p className="text-3xl font-black text-amber-600 mt-1">
                    {lang === "bn" ? "পেন্ডিং" : "PENDING"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {lang === "bn"
                      ? "অ্যাপ্রুভ করে নম্বর দিলে এখানে দেখা যাবে।"
                      : "Shows here after approval with a serial number."}
                  </p>
                </div>
              </>
            ) : (
              <p className="font-black tabular-nums text-primary text-6xl">{ticket.serial_no}</p>
            )}
            <p className="text-sm text-muted-foreground font-mono">{ticket.claim_code}</p>
              {ticket.online_serial_no != null && !pending && ticket.source === "app" && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                  <Receipt className="h-3 w-3" />
                  {lang === "bn" ? "অনলাইন সিরিয়াল" : "Online serial"}: {ticket.online_serial_no}
                </p>
              )}
              {ticket.invoice_no && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                  <Receipt className="h-3 w-3" />
                  {lang === "bn" ? "ইনভয়েস" : "Invoice"}: {ticket.invoice_no}
                </p>
              )}
            {pending ? null : (
            <div className="rounded-2xl border bg-card p-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">{lang === "bn" ? "এখন চলছে" : "Now"}</p>
                <p className="text-xl font-bold tabular-nums">{now || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{lang === "bn" ? "আগে আছেন" : "Ahead"}</p>
                <p className="text-xl font-bold tabular-nums">{ahead}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{lang === "bn" ? "শেষ নম্বর" : "Last"}</p>
                <p className="text-xl font-bold tabular-nums">{session?.last_issued ?? "—"}</p>
              </div>
            </div>
            )}
            <p className="text-xs text-muted-foreground">
              {session?.session_date} · {session?.status} ·{" "}
              {pending
                ? lang === "bn"
                  ? "অনুমোদন বাকি"
                  : "pending approval"
                : ticket.status}
            </p>
            {(ticket.status === "booked" || ticket.status === "pending_approval") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancel()}
                className="text-xs font-semibold text-destructive"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
            )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" />
                {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </p>
              <CareSerialInvoiceCard serialId={ticket.id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
