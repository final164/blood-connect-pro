import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { useI18n } from "@/lib/i18n";
import {
  fetchSerial,
  fetchSession,
  fetchSessionQueue,
  queueAhead,
  setSerialStatus,
  subscribeSession,
  type CareSerialRow,
  type CareSessionRow,
} from "@/lib/care-api";

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

  const ahead = ticket ? queueAhead(ticket.serial_no, queue) : 0;
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
          <Link to="/care" search={{ tab: "bookings" }} className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold">{lang === "bn" ? "লাইভ কিউ" : "Live queue"}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-md mx-auto text-center space-y-4">
        {!ticket ? (
          <p className="text-sm text-muted-foreground">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "আপনার নম্বর" : "Your number"}
            </p>
            <p className="text-6xl font-black tabular-nums text-primary">{ticket.serial_no}</p>
            <p className="text-sm text-muted-foreground font-mono">{ticket.claim_code}</p>
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
            <p className="text-xs text-muted-foreground">
              {session?.session_date} · {session?.status} · {ticket.status}
            </p>
            {ticket.status === "booked" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancel()}
                className="text-xs font-semibold text-destructive"
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
