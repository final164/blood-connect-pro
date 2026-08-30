import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Scissors, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  bookCareAppSerial,
  fetchCareDoctor,
  fetchSchedulesForAffiliations,
  fetchSessionByScheduleDate,
  applySecondVisitDiscount,
  nextDatesForWeekday,
  publicBmdcNo,
  WEEKDAY_BN,
  WEEKDAY_EN,
  type CareScheduleRow,
} from "@/lib/care-api";
import { careDoctorTypeLabel, locName, fetchCarePolicies } from "@/lib/care-cms";
import {
  DEFAULT_BOOKING_FIELDS,
  fetchOrgSettingsMap,
  resolveDeskSerialSettings,
  type CareSerialBookingFields,
} from "@/lib/care-org-settings";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  fetchDoctorOperations,
  operationName,
  type CareOperationOffering,
} from "@/lib/care-operations-api";
import { fetchTeleDoctor } from "@/lib/tele-api";

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
  const [teleAbout, setTeleAbout] = useState<{
    experience_years: number | null;
    workplace: string | null;
    fee: number | null;
    videoId: string | null;
  } | null>(null);
  const serialFormRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCareDoctor(doctorId).then(async (d) => {
      if (cancelled) return;
      setDoc(d);
      const ids = d?.chambers.map((c) => c.affiliation_id) ?? [];
      const sch = await fetchSchedulesForAffiliations(ids);
      if (!cancelled) setSchedules(sch);

      const orgIds = Array.from(new Set(d?.chambers.map((c) => c.org_id) ?? []));
      const [{ flags }, orgMap, tele] = await Promise.all([
        fetchCarePolicies(),
        fetchOrgSettingsMap(orgIds),
        fetchTeleDoctor(doctorId).catch(() => null),
      ]);
      if (cancelled) return;
      const next: Record<string, CareSerialBookingFields> = {};
      for (const oid of orgIds) {
        next[oid] = resolveDeskSerialSettings(flags, orgMap[oid]).booking_fields;
      }
      setFieldsByOrg(next);
      if (tele) {
        setTeleAbout({
          experience_years: tele.experience_years,
          workplace: lang === "bn" ? tele.workplace_bn || tele.workplace_en : tele.workplace_en || tele.workplace_bn,
          fee: tele.fee_amount,
          videoId: tele.video_enabled ? tele.doctor_id : null,
        });
      } else {
        setTeleAbout(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [doctorId, lang]);

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
    // Scroll after the “Serial selected” panel mounts / updates
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        serialFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    });
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
      const ticket = await bookCareAppSerial({
        scheduleId: selected.scheduleId,
        date: selected.date,
        guestName: req.name ? name : undefined,
        guestPhone: req.phone ? phone : undefined,
        guestAge: req.age && ageNum != null && Number.isFinite(ageNum) ? ageNum : null,
        guestAddress: req.address ? address || undefined : undefined,
        isSecondVisit: secondVisit,
      });
      const pending = ticket.status === "pending_approval";
      toast.success(
        pending
          ? lang === "bn"
            ? `সিরিয়াল ${ticket.serial_no ?? "—"} · চেম্বার অনুমোদনের অপেক্ষা`
            : `Serial ${ticket.serial_no ?? "—"} · waiting for chamber approval`
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
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex gap-3">
                <span className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center overflow-hidden shrink-0 border">
                  {doc.photo_url ? (
                    <img src={doc.photo_url} alt="" className="h-16 w-16 object-cover" />
                  ) : (
                    <Stethoscope className="h-7 w-7" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[spec, doc.qualifications].filter(Boolean).join(" · ")}
                  </p>
                  {doc.doctor_type ? (
                    <span className="mt-1.5 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                      {careDoctorTypeLabel(doc.doctor_type, lang)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {doc.bmdc_no ? (
                  <div className="rounded-xl border bg-muted/20 px-2.5 py-2">
                    <p className="text-muted-foreground">BMDC</p>
                    <p className="font-semibold">{doc.bmdc_no}</p>
                  </div>
                ) : null}
                {doc.doctor_code ? (
                  <div className="rounded-xl border bg-muted/20 px-2.5 py-2">
                    <p className="text-muted-foreground">{lang === "bn" ? "কোড" : "Code"}</p>
                    <p className="font-semibold">{doc.doctor_code}</p>
                  </div>
                ) : null}
                {teleAbout?.experience_years != null ? (
                  <div className="rounded-xl border bg-muted/20 px-2.5 py-2">
                    <p className="text-muted-foreground">{lang === "bn" ? "অভিজ্ঞতা" : "Experience"}</p>
                    <p className="font-semibold">
                      {lang === "bn"
                        ? `${teleAbout.experience_years}+ বছর`
                        : `${teleAbout.experience_years}+ years`}
                    </p>
                  </div>
                ) : null}
                {teleAbout?.fee != null ? (
                  <div className="rounded-xl border bg-muted/20 px-2.5 py-2">
                    <p className="text-muted-foreground">{lang === "bn" ? "ভিডিও ফি" : "Video fee"}</p>
                    <p className="font-semibold">{formatCareMoney(teleAbout.fee, lang)}</p>
                  </div>
                ) : null}
              </div>

              {teleAbout?.workplace ? (
                <p className="text-xs text-muted-foreground">
                  {lang === "bn" ? "কর্মরত" : "Works at"}:{" "}
                  <span className="font-medium text-foreground">{teleAbout.workplace}</span>
                </p>
              ) : null}

              {(bio || teleAbout) && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {lang === "bn" ? "ডাক্তার সম্পর্কে" : "About doctor"}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {bio ||
                      (lang === "bn"
                        ? "অভিজ্ঞ চিকিৎসক — সিরিয়াল ও ভিডিও কনসালটেশন উপলব্ধ।"
                        : "Experienced physician — serial and video consultation available.")}
                  </p>
                </div>
              )}

              {teleAbout?.videoId ? (
                <Link
                  to="/care/video/doctor/$id"
                  params={{ id: teleAbout.videoId }}
                  className="inline-flex rounded-xl border px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-muted"
                >
                  {lang === "bn" ? "ভিডিও প্রোফাইল দেখুন" : "View video profile"}
                </Link>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {lang === "bn" ? "চেম্বার ও সিরিয়াল" : "Chambers & serials"}
              </p>
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
              <section
                ref={serialFormRef}
                id="serial-selected"
                className="scroll-mt-20 rounded-2xl border-2 border-primary/30 bg-card p-4 space-y-3 shadow-sm"
              >
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

            <DoctorOperationsSection doctorId={doctorId} lang={lang} />
          </>
        )}
      </div>
    </div>
  );
}

/** Every clinic where this doctor operates, so prices can be compared side by side. */
function DoctorOperationsSection({ doctorId, lang }: { doctorId: string; lang: "bn" | "en" }) {
  const bn = lang === "bn";
  const [rows, setRows] = useState<CareOperationOffering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchDoctorOperations(doctorId)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  if (loading || !rows.length) return null;

  const clinicCount = new Set(rows.map((r) => r.org_id)).size;

  return (
    <section className="space-y-2 rounded-2xl border bg-card p-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "অপারেশন" : "Operations"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {bn
            ? `${clinicCount}টি ক্লিনিকে ${rows.length}টি অপারেশন — মূল্য তুলনা করুন`
            : `${rows.length} operations across ${clinicCount} clinic(s) — compare prices`}
        </p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((o) => (
          <li key={o.id}>
            <Link
              to="/care/operation/$offeringId"
              params={{ offeringId: o.id }}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-muted/40"
            >
              {o.org?.logo_url ? (
                <img
                  src={o.org.logo_url}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg border object-cover"
                />
              ) : (
                <Scissors className="h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{operationName(o.catalog, lang)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[
                    bn ? o.org?.name_bn || o.org?.name : o.org?.name,
                    o.location ? (bn ? o.location.name_bn || o.location.name : o.location.name) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold text-primary">
                {formatCareMoney(o.package_price, lang)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
