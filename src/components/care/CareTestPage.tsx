import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { locName } from "@/lib/care-cms";
import {
  fetchLabCalendars,
  fetchOffering,
  remainingSeats,
  reserveLabSlot,
  subscribeLabCalendar,
  type CareLabCalendar,
  type CareOffering,
} from "@/lib/care-lab-api";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CareTestPage({ offeringId }: { offeringId: string }) {
  const { lang } = useI18n();
  const { session, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [off, setOff] = useState<CareOffering | null>(null);
  const [cals, setCals] = useState<CareLabCalendar[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 14);
    return { from: isoDate(from), to: isoDate(to) };
  }, []);

  async function reload() {
    const o = await fetchOffering(offeringId);
    setOff(o);
    if (!o) return;
    const list = await fetchLabCalendars(o.id, range.from, range.to);
    setCals(list);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId]);

  useEffect(() => {
    return subscribeLabCalendar(offeringId, () => {
      void reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId]);

  async function book(cal: CareLabCalendar) {
    if (remainingSeats(cal) <= 0) return;
    if (!session || isAnonymous) {
      void navigate({
        to: "/auth",
        search: { next: `/care/test/${offeringId}` } as never,
      });
      return;
    }
    setBusy(cal.id);
    try {
      const booking = await reserveLabSlot({ calendarId: cal.id, source: "app" });
      toast.success(
        lang === "bn"
          ? `বুকিং ${booking.reference_code} · ইনভয়েস প্রস্তুত`
          : `Booked ${booking.reference_code} · Invoice ready`,
      );
      void navigate({ to: "/care/lab-booking/$id", params: { id: booking.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const title = off
    ? lang === "bn"
      ? off.catalog?.name_bn
      : off.catalog?.name_en
    : lang === "bn"
      ? "টেস্ট"
      : "Test";
  const prep = lang === "bn" ? off?.catalog?.prep_bn || off?.catalog?.fasting_notes_bn : off?.catalog?.prep_en || off?.catalog?.fasting_notes_en;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link to="/care" search={{ tab: "tests" }} className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold truncate">{title}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4">
        {!off ? (
          <div className="h-24 rounded-2xl border bg-muted/40 animate-pulse" />
        ) : (
          <>
            <div className="flex gap-3">
              <span className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {[off.catalog?.code, locName(off.org ?? {}, lang), locName(off.location ?? {}, lang), `৳${off.price}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            {prep && (
              <p className="text-sm rounded-xl border bg-muted/40 px-3 py-2">{prep}</p>
            )}
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-muted-foreground">
                {lang === "bn" ? "অ্যাভেইলেবিলিটি" : "Availability"}
              </h2>
              {cals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lang === "bn" ? "এখন কোনো স্লট খোলা নেই" : "No open slots yet"}
                </p>
              ) : (
                cals.map((c) => {
                  const left = remainingSeats(c);
                  const full = left <= 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={full || busy === c.id}
                      onClick={() => void book(c)}
                      className="w-full flex items-center justify-between rounded-xl border bg-card px-3 py-2.5 text-sm disabled:opacity-40"
                    >
                      <span>
                        {c.cal_date}
                        {c.slot_start ? ` · ${String(c.slot_start).slice(0, 5)}` : ""}
                      </span>
                      <span className="text-xs font-semibold">
                        {full
                          ? lang === "bn"
                            ? "পূর্ণ"
                            : "Full"
                          : lang === "bn"
                            ? `${left} জন বাকি`
                            : `${left} left`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
