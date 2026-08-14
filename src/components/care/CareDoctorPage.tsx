import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { useI18n } from "@/lib/i18n";
import {
  ensureCareSession,
  fetchCareDoctor,
  fetchSchedulesForAffiliations,
  fetchSessionByScheduleDate,
  issueCareSerial,
  nextDatesForWeekday,
  WEEKDAY_BN,
  WEEKDAY_EN,
  type CareScheduleRow,
} from "@/lib/care-api";
import { locName } from "@/lib/care-cms";

export function CareDoctorPage({ doctorId }: { doctorId: string }) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof fetchCareDoctor>>>(null);
  const [schedules, setSchedules] = useState<CareScheduleRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [seats, setSeats] = useState<Record<string, { last: number; max: number }>>({});

  useEffect(() => {
    let cancelled = false;
    void fetchCareDoctor(doctorId).then(async (d) => {
      if (cancelled) return;
      setDoc(d);
      const ids = d?.chambers.map((c) => c.affiliation_id) ?? [];
      const sch = await fetchSchedulesForAffiliations(ids);
      if (!cancelled) setSchedules(sch);
    });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  const byAff = useMemo(() => {
    const map = new Map<string, CareScheduleRow[]>();
    for (const s of schedules) {
      const list = map.get(s.affiliation_id) ?? [];
      list.push(s);
      map.set(s.affiliation_id, list);
    }
    return map;
  }, [schedules]);

  async function loadSeats(scheduleId: string, date: string) {
    const key = `${scheduleId}:${date}`;
    try {
      const sess = await fetchSessionByScheduleDate(scheduleId, date);
      if (sess) {
        setSeats((prev) => ({ ...prev, [key]: { last: sess.last_issued, max: sess.max_serial } }));
      }
    } catch {
      /* ignore */
    }
  }

  async function book(scheduleId: string, date: string) {
    setBusy(`${scheduleId}:${date}`);
    try {
      const sessionId = await ensureCareSession(scheduleId, date);
      const ticket = await issueCareSerial({ sessionId, source: "app" });
      toast.success(lang === "bn" ? `সিরিয়াল ${ticket.serial_no}` : `Serial ${ticket.serial_no}`);
      void navigate({ to: "/care/serial/$id", params: { id: ticket.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const name = doc ? (lang === "bn" ? doc.full_name_bn || doc.full_name : doc.full_name) : "";
  const spec = doc ? (lang === "bn" ? doc.specialty_name_bn : doc.specialty_name_en) : "";
  const bio = doc ? (lang === "bn" ? doc.bio_bn || doc.bio : doc.bio || doc.bio_bn) : "";

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link to="/care" className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold truncate">{name || (lang === "bn" ? "ডাক্তার" : "Doctor")}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4">
        {!doc ? (
          <div className="h-32 rounded-2xl border bg-muted/40 animate-pulse" />
        ) : (
          <>
            <div className="flex gap-3">
              <span className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center overflow-hidden shrink-0">
                {doc.photo_url ? (
                  <img src={doc.photo_url} alt="" className="h-16 w-16 object-cover" />
                ) : (
                  <Stethoscope className="h-7 w-7" />
                )}
              </span>
              <div className="min-w-0">
                <p className="font-bold">{name}</p>
                <p className="text-xs text-muted-foreground">{[spec, doc.qualifications, doc.bmdc_no && `BMDC ${doc.bmdc_no}`].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            {bio && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bio}</p>}
            <div className="space-y-3">
              {doc.chambers.map((ch) => {
                const schs = byAff.get(ch.affiliation_id) ?? [];
                return (
                  <section key={ch.affiliation_id} className="rounded-2xl border bg-card p-3 space-y-2">
                    <p className="text-sm font-semibold">
                      {lang === "bn" ? ch.org_name_bn || ch.org_name : ch.org_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {locName({ name: ch.location_name, name_bn: ch.location_name_bn }, lang)}
                      {ch.fee_amount != null ? ` · ৳${ch.fee_amount}` : ""}
                    </p>
                    {schs.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {lang === "bn" ? "শিডিউল নেই" : "No schedule yet"}
                      </p>
                    )}
                    {schs.map((s) => {
                      const days = nextDatesForWeekday(s.weekday, 3);
                      const dayLabel = lang === "bn" ? WEEKDAY_BN[s.weekday] : WEEKDAY_EN[s.weekday];
                      return (
                        <div key={s.id} className="rounded-xl border px-2 py-2 space-y-2">
                          <p className="text-xs font-medium">
                            {dayLabel} · {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {days.map((date) => {
                              const key = `${s.id}:${date}`;
                              const seat = seats[key];
                              const remaining = seat ? Math.max(0, seat.max - seat.last) : s.max_serial;
                              const full = remaining <= 0;
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  disabled={!s.allow_app_booking || full || busy === key}
                                  onMouseEnter={() => void loadSeats(s.id, date)}
                                  onClick={() => void book(s.id, date)}
                                  className="rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-40 hover:bg-primary hover:text-primary-foreground"
                                >
                                  {date.slice(5)} · {lang === "bn" ? "সিরিয়াল" : "Book"}
                                  {seat ? ` (${remaining})` : ""}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
