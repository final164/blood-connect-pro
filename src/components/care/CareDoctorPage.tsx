import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureCareSession,
  fetchCareDoctor,
  fetchSchedulesForAffiliations,
  fetchSessionByScheduleDate,
  applySecondVisitDiscount,
  issueCareSerial,
  nextDatesForWeekday,
  WEEKDAY_BN,
  WEEKDAY_EN,
  type CareScheduleRow,
} from "@/lib/care-api";
import { locName, fetchCarePolicies } from "@/lib/care-cms";
import {
  DEFAULT_BOOKING_FIELDS,
  fetchOrgSettingsMap,
  resolveDeskSerialSettings,
  type CareSerialBookingFields,
} from "@/lib/care-org-settings";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";

function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return "";
  const d = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age > 0 && age < 150 ? String(age) : "";
}

function addressFromProfile(area?: string | null, city?: string | null) {
  return [area?.trim(), city?.trim()].filter(Boolean).join(", ");
}

type SelectedSlot = {
  scheduleId: string;
  date: string;
  affiliationId: string;
  orgName: string;
  locationLabel: string;
  dayLabel: string;
  timeLabel: string;
};

export function CareDoctorPage({ doctorId }: { doctorId: string }) {
  const { lang } = useI18n();
  const { session, user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof fetchCareDoctor>>>(null);
  const [schedules, setSchedules] = useState<CareScheduleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [seats, setSeats] = useState<Record<string, { last: number; max: number }>>({});
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [secondVisit, setSecondVisit] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [fieldsByOrg, setFieldsByOrg] = useState<Record<string, CareSerialBookingFields>>({});

  useEffect(() => {
    let cancelled = false;
    void fetchCareDoctor(doctorId).then(async (d) => {
      if (cancelled) return;
      setDoc(d);
      const ids = d?.chambers.map((c) => c.affiliation_id) ?? [];
      const sch = await fetchSchedulesForAffiliations(ids);
      if (!cancelled) setSchedules(sch);

      const orgIds = Array.from(new Set(d?.chambers.map((c) => c.org_id) ?? []));
      const [{ flags }, orgMap] = await Promise.all([fetchCarePolicies(), fetchOrgSettingsMap(orgIds)]);
      if (cancelled) return;
      const next: Record<string, CareSerialBookingFields> = {};
      for (const oid of orgIds) {
        next[oid] = resolveDeskSerialSettings(flags, orgMap[oid]).booking_fields;
      }
      setFieldsByOrg(next);
    });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  useEffect(() => {
    if (!user?.id || isAnonymous) {
      setProfileLoaded(true);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("full_name, phone, date_of_birth, area, city")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const p = data as {
          full_name?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          area?: string | null;
          city?: string | null;
        } | null;
        if (p) {
          setPatientName((prev) => prev || (p.full_name ?? "").trim());
          setPatientPhone((prev) => prev || clampPhoneDigits(p.phone ?? ""));
          setPatientAge((prev) => prev || ageFromDob(p.date_of_birth));
          setPatientAddress((prev) => prev || addressFromProfile(p.area, p.city));
        }
        setProfileLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAnonymous]);

  const byAff = useMemo(() => {
    const map = new Map<string, CareScheduleRow[]>();
    for (const s of schedules) {
      const list = map.get(s.affiliation_id) ?? [];
      list.push(s);
      map.set(s.affiliation_id, list);
    }
    return map;
  }, [schedules]);

  const formFields = useMemo((): CareSerialBookingFields => {
    if (!selected || !doc) return DEFAULT_BOOKING_FIELDS;
    const chamber = doc.chambers.find((c) => c.affiliation_id === selected.affiliationId);
    if (chamber && fieldsByOrg[chamber.org_id]) return fieldsByOrg[chamber.org_id]!;
    return DEFAULT_BOOKING_FIELDS;
  }, [selected, doc, fieldsByOrg]);

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

  function selectSlot(slot: SelectedSlot) {
    if (!session || isAnonymous) {
      void navigate({
        to: "/auth",
        search: { next: `/care/doctor/${doctorId}` } as never,
      });
      return;
    }
    setSelected(slot);
    setSecondVisit(false);
    void loadSeats(slot.scheduleId, slot.date);
  }

  const selectedChamber = useMemo(() => {
    if (!selected || !doc) return null;
    return doc.chambers.find((c) => c.affiliation_id === selected.affiliationId) ?? null;
  }, [selected, doc]);

  const feePreview = useMemo(() => {
    const base = selectedChamber?.fee_amount;
    if (base == null) return null;
    const discType = selectedChamber?.second_visit_discount_type ?? null;
    const discValue = selectedChamber?.second_visit_discount_value ?? null;
    const after = applySecondVisitDiscount(base, discType, discValue);
    const saved = Math.max(0, Math.round((base - after) * 100) / 100);
    return {
      base,
      after,
      saved,
      discType,
      discValue,
      final: secondVisit ? after : base,
    };
  }, [selectedChamber, secondVisit]);

  async function confirmBook() {
    if (!selected) return;
    if (!session || isAnonymous) {
      void navigate({
        to: "/auth",
        search: { next: `/care/doctor/${doctorId}` } as never,
      });
      return;
    }
    const req = formFields;
    const name = patientName.trim();
    const phone = clampPhoneDigits(patientPhone);
    const ageRaw = patientAge.trim();
    const address = patientAddress.trim();
    if (req.name && !name) {
      toast.error(lang === "bn" ? "রোগীর নাম দিন" : "Enter patient name");
      return;
    }
    if (req.phone && phone.length < 11) {
      toast.error(lang === "bn" ? "সঠিক মোবাইল নম্বর দিন" : "Enter a valid mobile number");
      return;
    }
    const ageNum = ageRaw ? Number(ageRaw) : null;
    if (req.age && ageRaw && (!Number.isFinite(ageNum) || ageNum! < 1 || ageNum! > 149)) {
      toast.error(lang === "bn" ? "বয়স সঠিক নয়" : "Invalid age");
      return;
    }
    if (req.address && !address) {
      toast.error(lang === "bn" ? "ঠিকানা দিন" : "Enter address");
      return;
    }

    setBusy(true);
    try {
      const sessionId = await ensureCareSession(selected.scheduleId, selected.date);
      const ticket = await issueCareSerial({
        sessionId,
        source: "app",
        guestName: req.name ? name : undefined,
        guestPhone: req.phone ? phone : undefined,
        guestAge: req.age && ageNum != null && Number.isFinite(ageNum) ? ageNum : null,
        guestAddress: req.address ? address || undefined : undefined,
        isSecondVisit: secondVisit,
      });
      const pending = ticket.status === "pending_approval" || ticket.serial_no == null;
      toast.success(
        pending
          ? lang === "bn"
            ? `অনলাইন সিরিয়াল ${ticket.online_serial_no ?? "—"} · চেম্বার অনুমোদনের অপেক্ষা`
            : `Online serial ${ticket.online_serial_no ?? "—"} · waiting for chamber approval`
          : lang === "bn"
            ? `সিরিয়াল ${ticket.serial_no} · ইনভয়েস প্রস্তুত`
            : `Serial ${ticket.serial_no} · Invoice ready`,
      );
      void navigate({ to: "/care/serial/$id", params: { id: ticket.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const name = doc ? (lang === "bn" ? doc.full_name_bn || doc.full_name : doc.full_name) : "";
  const spec = doc ? (lang === "bn" ? doc.specialty_name_bn : doc.specialty_name_en) : "";
  const bio = doc ? (lang === "bn" ? doc.bio_bn || doc.bio : doc.bio || doc.bio_bn) : "";
  const selectedKey = selected ? `${selected.scheduleId}:${selected.date}` : null;
  const selectedSeat = selectedKey ? seats[selectedKey] : undefined;
  const selectedRemaining = selectedSeat
    ? Math.max(0, selectedSeat.max - selectedSeat.last)
    : null;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo="/care" shape="xl" />
          <h1 className="text-sm font-bold truncate">{name || (lang === "bn" ? "ডাক্তার" : "Doctor")}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4 pb-28">
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
                <p className="text-xs text-muted-foreground">
                  {[spec, doc.qualifications, doc.bmdc_no && `BMDC ${doc.bmdc_no}`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {bio && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bio}</p>}

            <div className="space-y-3">
              {doc.chambers.map((ch) => {
                const schs = byAff.get(ch.affiliation_id) ?? [];
                const orgLabel = lang === "bn" ? ch.org_name_bn || ch.org_name : ch.org_name;
                const locLabel = locName({ name: ch.location_name, name_bn: ch.location_name_bn }, lang);
                return (
                  <section key={ch.affiliation_id} className="rounded-2xl border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{orgLabel}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {locLabel}
                          {ch.fee_amount != null ? ` · ৳${ch.fee_amount}` : ""}
                        </p>
                      </div>
                      <CareOrgChatButton
                        orgId={ch.org_id}
                        orgLabel={orgLabel}
                        variant="icon"
                        className="shrink-0"
                      />
                    </div>
                    {schs.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {lang === "bn" ? "শিডিউল নেই" : "No schedule yet"}
                      </p>
                    )}
                    {schs.map((s) => {
                      const days = nextDatesForWeekday(s.weekday, 3);
                      const dayLabel = lang === "bn" ? WEEKDAY_BN[s.weekday] : WEEKDAY_EN[s.weekday];
                      const timeLabel = `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`;
                      return (
                        <div key={s.id} className="rounded-xl border px-2 py-2 space-y-2">
                          <p className="text-xs font-medium">
                            {dayLabel} · {timeLabel}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {days.map((date) => {
                              const key = `${s.id}:${date}`;
                              const seat = seats[key];
                              const remaining = seat ? Math.max(0, seat.max - seat.last) : s.max_serial;
                              const full = remaining <= 0;
                              const isSelected = selectedKey === key;
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  disabled={!s.allow_app_booking || full}
                                  onMouseEnter={() => void loadSeats(s.id, date)}
                                  onClick={() =>
                                    selectSlot({
                                      scheduleId: s.id,
                                      date,
                                      affiliationId: ch.affiliation_id,
                                      orgName: orgLabel,
                                      locationLabel: locLabel,
                                      dayLabel,
                                      timeLabel,
                                    })
                                  }
                                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  {date.slice(5)} · {lang === "bn" ? "সিরিয়াল" : "Serial"}
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

            {selected && (
              <section className="rounded-2xl border-2 border-primary/30 bg-card p-4 space-y-3 shadow-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {lang === "bn" ? "সিরিয়াল নির্বাচিত" : "Serial selected"}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {selected.orgName} · {selected.date}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selected.locationLabel} · {selected.dayLabel} · {selected.timeLabel}
                    {selectedRemaining != null ? ` · ${lang === "bn" ? "বাকি" : "left"} ${selectedRemaining}` : ""}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {lang === "bn" ? "রোগীর তথ্য" : "Patient details"}
                  </p>
                  {!profileLoaded ? (
                    <div className="h-20 rounded-xl bg-muted/40 animate-pulse" />
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {formFields.name && (
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {lang === "bn" ? "নাম" : "Name"}
                          </span>
                          <input
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            autoComplete="name"
                          />
                        </label>
                      )}
                      {formFields.phone && (
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {lang === "bn" ? "মোবাইল" : "Mobile"}
                          </span>
                          <input
                            value={patientPhone}
                            onChange={(e) => setPatientPhone(clampPhoneDigits(e.target.value))}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm tabular-nums"
                            inputMode="tel"
                            maxLength={11}
                            autoComplete="tel"
                          />
                        </label>
                      )}
                      {formFields.age && (
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {lang === "bn" ? "বয়স" : "Age"}
                          </span>
                          <input
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm tabular-nums"
                            inputMode="numeric"
                            placeholder={lang === "bn" ? "বছর" : "Years"}
                          />
                        </label>
                      )}
                      {formFields.address && (
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {lang === "bn" ? "ঠিকানা" : "Address"}
                          </span>
                          <input
                            value={patientAddress}
                            onChange={(e) => setPatientAddress(e.target.value)}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            autoComplete="street-address"
                          />
                        </label>
                      )}
                      <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/50 px-3 py-2.5 dark:bg-sky-950/20 dark:border-sky-900 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-primary"
                          checked={secondVisit}
                          onChange={(e) => setSecondVisit(e.target.checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {lang === "bn" ? "আগেও দেখাইছি" : "Visited before"}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {lang === "bn"
                              ? "সেকেন্ড টাইম — চেম্বারের নির্ধারিত ছাড় ফি থেকে কাটা হবে"
                              : "Second visit — chamber discount applied to fee"}
                          </span>
                          {feePreview && (
                            secondVisit ? (
                              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-[11px] tabular-nums space-y-1 dark:bg-emerald-950/30 dark:border-emerald-900">
                                <p className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">{lang === "bn" ? "মূল ফি" : "Fee"}</span>
                                  <span className="font-medium line-through text-muted-foreground">৳{feePreview.base}</span>
                                </p>
                                <p className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    {lang === "bn" ? "ডিসকাউন্ট" : "Discount"}
                                    {feePreview.discType === "percent" && feePreview.discValue != null
                                      ? ` (${feePreview.discValue}%)`
                                      : ""}
                                  </span>
                                  <span className="font-semibold text-emerald-700">
                                    {feePreview.saved > 0
                                      ? `−৳${feePreview.saved}`
                                      : feePreview.discType === "percent" && feePreview.discValue
                                        ? `−${feePreview.discValue}%`
                                        : feePreview.discValue
                                          ? `−৳${feePreview.discValue}`
                                          : lang === "bn"
                                            ? "নেই"
                                            : "None"}
                                  </span>
                                </p>
                                <p className="flex justify-between gap-2 border-t border-border/50 pt-1">
                                  <span className="font-semibold">
                                    {lang === "bn" ? "ছাড়ের পর" : "After discount"}
                                  </span>
                                  <span className="font-bold text-primary text-sm">৳{feePreview.final}</span>
                                </p>
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                                {lang === "bn" ? "মূল ফি" : "Fee"}: ৳{feePreview.base}
                              </p>
                            )
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                  >
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmBook()}
                    className="flex-1 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    {busy
                      ? lang === "bn"
                        ? "বুক হচ্ছে…"
                        : "Booking…"
                      : lang === "bn"
                        ? "বুক করুন"
                        : "Book"}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
