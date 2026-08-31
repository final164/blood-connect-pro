import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  ensureCareSession,
  fetchOrgDoctors,
  fetchOrgSessions,
  fetchSchedulesForAffiliations,
  fetchSession,
  applySecondVisitDiscount,
  issueCareSerial,
  nextDatesForWeekday,
  setSessionStatus,
  WEEKDAY_BN,
  WEEKDAY_EN,
  type CareScheduleRow,
  type CareSerialRow,
  type CareSessionRow,
} from "@/lib/care-api";
import { formatSerialDateChip, formatTimeWindow } from "@/lib/care-time-window";
import {
  DEFAULT_BOOKING_FIELDS,
  fetchEffectiveDeskSerialSettings,
  type CareSerialBookingFields,
  type EffectiveDeskSerialSettings,
} from "@/lib/care-org-settings";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { supabase } from "@/integrations/supabase/client";
import { CareSerialInvoiceCard } from "@/components/care/CareSerialInvoice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AffRow = {
  id: string;
  doctor_id: string;
  location_id: string;
  is_active?: boolean;
  fee_amount?: number | null;
  second_visit_discount_type?: "percent" | "fixed" | null;
  second_visit_discount_value?: number | null;
  care_doctors?: { id: string; full_name: string; full_name_bn?: string | null } | null;
  care_locations?: { id: string; name: string; name_bn?: string | null } | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

const inputCls =
  "w-full rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function CareCreateSerialPanel({
  orgId,
  canIssue,
  canManage,
  lang,
}: {
  orgId: string;
  canIssue: boolean;
  canManage: boolean;
  lang: "bn" | "en";
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<EffectiveDeskSerialSettings | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [affs, setAffs] = useState<AffRow[]>([]);
  const [schedules, setSchedules] = useState<CareScheduleRow[]>([]);
  const [affiliationId, setAffiliationId] = useState("");
  const [doctorQuery, setDoctorQuery] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [liveSession, setLiveSession] = useState<CareSessionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ id: string; serialNo: number | null; name: string } | null>(
    null,
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [secondVisit, setSecondVisit] = useState(false);

  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [createdToday, setCreatedToday] = useState<CareSerialRow[]>([]);

  /** Default ON until settings load */
  const featureOn = settings?.manual_patient_serial !== false;
  const fields: CareSerialBookingFields = settings?.booking_fields ?? DEFAULT_BOOKING_FIELDS;

  const activeAffs = useMemo(
    () => affs.filter((a) => a.is_active !== false && a.care_doctors),
    [affs],
  );

  // Substring search over name / BMDC, in the same spirit as the district select.
  const filteredAffs = useMemo(() => {
    const needle = doctorQuery.trim().toLowerCase();
    if (!needle) return activeAffs;
    return activeAffs.filter((a) => {
      const doc = a.care_doctors;
      const hay = [doc?.full_name, doc?.full_name_bn, a.care_locations?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [activeAffs, doctorQuery]);

  const schedulesForAff = useMemo(
    () => schedules.filter((s) => s.affiliation_id === affiliationId),
    [schedules, affiliationId],
  );

  const selectedAff = activeAffs.find((a) => a.id === affiliationId) ?? null;

  const feePreview = useMemo(() => {
    const base = selectedAff?.fee_amount != null ? Number(selectedAff.fee_amount) : null;
    if (base == null) return null;
    const discType = selectedAff?.second_visit_discount_type ?? null;
    const discValue =
      selectedAff?.second_visit_discount_value != null
        ? Number(selectedAff.second_visit_discount_value)
        : null;
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
  }, [selectedAff, secondVisit]);

  const selectedSchedule = useMemo(
    () => schedulesForAff.find((s) => s.id === scheduleId) ?? null,
    [schedulesForAff, scheduleId],
  );
  const dateOptions = useMemo(
    () => (selectedSchedule ? nextDatesForWeekday(selectedSchedule.weekday, 4) : []),
    [selectedSchedule],
  );

  const remaining = liveSession
    ? Math.max(0, liveSession.max_serial - liveSession.last_issued)
    : selectedSchedule?.max_serial ?? null;
  const nextNo = liveSession
    ? liveSession.last_issued + 1
    : selectedSchedule?.start_number ?? 1;

  function doctorName(a: AffRow) {
    return lang === "bn"
      ? a.care_doctors?.full_name_bn || a.care_doctors?.full_name || "—"
      : a.care_doctors?.full_name || "—";
  }

  async function reloadCreatedToday() {
    const day = todayIso();
    const start = `${day}T00:00:00+06:00`;
    const next = new Date(`${day}T12:00:00+06:00`);
    next.setDate(next.getDate() + 1);
    const end = `${next.toISOString().slice(0, 10)}T00:00:00+06:00`;
    const { data } = await supabase
      .from("care_serials")
      .select(
        "id, session_id, serial_no, patient_id, guest_name, guest_phone, guest_age, guest_sex, guest_address, referred_by, source, status, claim_code, invoice_no, fee_amount, online_serial_no, payment_status, amount_received, called_at, created_at, care_sessions!inner(org_id)",
      )
      .eq("care_sessions.org_id", orgId)
      .in("source", ["desk_manual", "walk_in"])
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(30);
    setCreatedToday(((data as CareSerialRow[]) ?? []) as CareSerialRow[]);
  }

  async function refreshSession() {
    if (!scheduleId || !sessionDate) {
      setLiveSession(null);
      return;
    }
    try {
      const sessions = await fetchOrgSessions(orgId, sessionDate);
      setLiveSession(sessions.find((s) => s.schedule_id === scheduleId) ?? null);
    } catch {
      setLiveSession(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    void (async () => {
      try {
        const [eff, docs] = await Promise.all([
          fetchEffectiveDeskSerialSettings(orgId),
          fetchOrgDoctors(orgId),
        ]);
        if (cancelled) return;
        setSettings(eff);
        const list = (docs as unknown as AffRow[]) ?? [];
        setAffs(list);
        const sch = await fetchSchedulesForAffiliations(list.map((a) => a.id));
        if (cancelled) return;
        setSchedules(sch);
        setAffiliationId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? ""));
        await reloadCreatedToday();
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    const list = schedulesForAff;
    setScheduleId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? ""));
  }, [affiliationId, schedulesForAff]);

  useEffect(() => {
    if (!dateOptions.length) return;
    setSessionDate((prev) => (dateOptions.includes(prev) ? prev : dateOptions[0]!));
  }, [scheduleId, dateOptions]);

  useEffect(() => {
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, scheduleId, sessionDate]);

  async function lookupByPhone() {
    const p = clampPhoneDigits(phone);
    if (p.length < 10) {
      toast.error(lang === "bn" ? "আগে মোবাইল দিন" : "Enter mobile first");
      return;
    }
    setLookingUp(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, date_of_birth, area, city")
        .or(
          `phone.eq.${p},phone.eq.0${p.slice(-10)},phone.eq.88${p.slice(-10)},phone.eq.+880${p.slice(-10)}`,
        )
        .limit(1)
        .maybeSingle();
      const row = data as {
        full_name?: string | null;
        date_of_birth?: string | null;
        area?: string | null;
        city?: string | null;
      } | null;
      if (!row) {
        toast.message(lang === "bn" ? "প্রোফাইল নেই — ম্যানুয়ালি পূরণ করুন" : "No profile — fill manually");
        return;
      }
      if (fields.name && row.full_name) setName(row.full_name.trim());
      if (fields.age) setAge(ageFromDob(row.date_of_birth));
      if (fields.address) setAddress(addressFromProfile(row.area, row.city));
      toast.success(lang === "bn" ? "প্রোফাইল থেকে পূরণ হয়েছে" : "Filled from profile");
      nameRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLookingUp(false);
    }
  }

  async function ensureOpenSession(): Promise<string> {
    if (!scheduleId) throw new Error(lang === "bn" ? "শিডিউল বেছে নিন" : "Pick a schedule");
    const sid = await ensureCareSession(scheduleId, sessionDate);
    let sess = await fetchSession(sid);
    if (!sess) throw new Error(lang === "bn" ? "সেশন তৈরি হয়নি" : "Session missing");
    if (sess.status === "closed") {
      throw new Error(lang === "bn" ? "সেশন বন্ধ — অন্য তারিখ নিন" : "Session closed — pick another date");
    }
    if (sess.status === "scheduled") {
      if (!canManage) {
        throw new Error(
          lang === "bn"
            ? "সেশন এখনো খোলা নেই — কিউ ট্যাব থেকে ওপেন করুন"
            : "Session not open — open it from the Queue tab",
        );
      }
      sess = (await setSessionStatus(sid, "open")) ?? sess;
    }
    setLiveSession(sess);
    return sid;
  }

  async function onCreate(e?: FormEvent) {
    e?.preventDefault();
    if (!canIssue || !featureOn) return;

    const n = name.trim();
    const ph = clampPhoneDigits(phone);
    const ageRaw = age.trim();
    const addr = address.trim();

    if (fields.name && !n) {
      toast.error(lang === "bn" ? "রোগীর নাম দিন" : "Enter patient name");
      nameRef.current?.focus();
      return;
    }
    if (fields.phone && ph.length < 11) {
      toast.error(lang === "bn" ? "১১ ডিজিটের মোবাইল দিন" : "Enter 11-digit mobile");
      return;
    }
    const ageNum = ageRaw ? Number(ageRaw) : null;
    if (fields.age && ageRaw && (ageNum == null || !Number.isFinite(ageNum) || ageNum < 1 || ageNum > 149)) {
      toast.error(lang === "bn" ? "বয়স সঠিক নয়" : "Invalid age");
      return;
    }
    if (fields.address && !addr) {
      toast.error(lang === "bn" ? "ঠিকানা দিন" : "Enter address");
      return;
    }
    if (remaining === 0) {
      toast.error(lang === "bn" ? "সিরিয়াল পূর্ণ" : "Serial full");
      return;
    }
    if (!selectedSchedule) {
      toast.error(lang === "bn" ? "শিডিউল বেছে নিন" : "Pick a schedule");
      return;
    }
    const dow = new Date(`${sessionDate}T12:00:00`).getDay();
    if (dow !== selectedSchedule.weekday) {
      toast.error(
        lang === "bn"
          ? "তারিখ শিডিউলের দিনের সাথে মেলে না"
          : "Date does not match schedule weekday",
      );
      return;
    }

    setBusy(true);
    try {
      const sid = await ensureOpenSession();
      const ticket = await issueCareSerial({
        sessionId: sid,
        source: "desk_manual",
        guestName: fields.name ? n : undefined,
        guestPhone: fields.phone ? ph : undefined,
        guestAge: fields.age && ageNum != null && Number.isFinite(ageNum) ? ageNum : null,
        guestAddress: fields.address ? addr || undefined : undefined,
        isSecondVisit: secondVisit,
      });
      setLastCreated({ id: ticket.id, serialNo: ticket.serial_no, name: n || ph || "—" });
      setName("");
      setPhone("");
      setAge("");
      setAddress("");
      setSecondVisit(false);
      setInvoiceId(ticket.id);
      await Promise.all([refreshSession(), reloadCreatedToday()]);
      toast.success(
        lang === "bn" ? `সিরিয়াল ${ticket.serial_no} তৈরি` : `Serial ${ticket.serial_no} created`,
      );
      requestAnimationFrame(() => nameRef.current?.focus());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadingMeta && !settings) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!featureOn) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center space-y-2">
        <UserPlus className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">{lang === "bn" ? "Create Serial বন্ধ" : "Create Serial off"}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lang === "bn"
            ? "Admin → Care → Policies থেকে «Create Serial» চালু করুন।"
            : "Turn on «Create Serial» in Admin → Care → Policies."}
        </p>
      </div>
    );
  }

  if (!canIssue) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {lang === "bn" ? "সিরিয়াল ইস্যু করার অনুমতি নেই" : "No permission to issue serials"}
      </p>
    );
  }

  const canSubmit = !!scheduleId && !!affiliationId && remaining !== 0 && !busy;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <header className="flex items-center gap-3 border-b px-4 py-3.5 bg-muted/20">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <UserPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold tracking-tight">Create Serial</h2>
            <p className="text-[11px] text-muted-foreground">
              {lang === "bn"
                ? "নাম · মোবাইল · বয়স · ঠিকানা — তাৎক্ষণিক সিরিয়াল"
                : "Name · mobile · age · address — instant serial"}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              {lang === "bn" ? "পরবর্তী" : "Next"}
            </span>
            <span className="text-2xl font-black tabular-nums text-primary leading-none">{nextNo}</span>
          </div>
        </header>

        {lastCreated && (
          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200/60 bg-emerald-50/80 px-4 py-2.5 text-sm dark:bg-emerald-950/30 dark:border-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="font-semibold text-emerald-900 dark:text-emerald-100">
              #{lastCreated.serialNo} · {lastCreated.name}
            </span>
            <button
              type="button"
              className="ml-auto text-[11px] font-semibold text-primary"
              onClick={() => setInvoiceId(lastCreated.id)}
            >
              {lang === "bn" ? "ইনভয়েস দেখুন" : "View invoice"}
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => void onCreate(e)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void onCreate();
          }}
          className="p-4 sm:p-5 space-y-5"
        >
          <fieldset className="space-y-3">
            <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              1. {lang === "bn" ? "ডাক্তার ও সেশন" : "Doctor & session"}
            </legend>
            {activeAffs.length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                {lang === "bn"
                  ? "আগে Doctors ট্যাব থেকে ডাক্তার যোগ করুন।"
                  : "Add a doctor from the Doctors tab first."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "ডাক্তার" : "Doctor"}
                  </span>
                  {activeAffs.length > 5 && (
                    <input
                      value={doctorQuery}
                      onChange={(e) => setDoctorQuery(e.target.value)}
                      placeholder={lang === "bn" ? "ডাক্তার খুঁজুন…" : "Search doctor…"}
                      className={`${inputCls} mb-1.5`}
                      autoComplete="off"
                    />
                  )}
                  <select
                    value={affiliationId}
                    onChange={(e) => setAffiliationId(e.target.value)}
                    className={inputCls}
                  >
                    {filteredAffs.length === 0 && (
                      <option value="">
                        {lang === "bn" ? "কোনো ডাক্তার মেলেনি" : "No doctor matched"}
                      </option>
                    )}
                    {filteredAffs.map((a) => (
                      <option key={a.id} value={a.id}>
                        {doctorName(a)}
                        {a.care_locations
                          ? ` · ${lang === "bn" ? a.care_locations.name_bn || a.care_locations.name : a.care_locations.name}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "শিডিউল" : "Schedule"}
                  </span>
                  <select
                    value={scheduleId}
                    onChange={(e) => setScheduleId(e.target.value)}
                    className={inputCls}
                    disabled={!schedulesForAff.length}
                  >
                    {!schedulesForAff.length && (
                      <option value="">{lang === "bn" ? "শিডিউল নেই" : "No schedule"}</option>
                    )}
                    {schedulesForAff.map((s) => {
                      const dayLabel = lang === "bn" ? WEEKDAY_BN[s.weekday] : WEEKDAY_EN[s.weekday];
                      return (
                        <option key={s.id} value={s.id}>
                          {dayLabel} · {formatTimeWindow(s.start_time, s.end_time, lang)}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "তারিখ" : "Date"}
                    {selectedSchedule
                      ? ` · ${lang === "bn" ? WEEKDAY_BN[selectedSchedule.weekday] : WEEKDAY_EN[selectedSchedule.weekday]}`
                      : ""}
                  </span>
                  {dateOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      {lang === "bn" ? "আসন্ন তারিখ নেই" : "No upcoming dates"}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {dateOptions.map((date) => {
                        const selected = sessionDate === date;
                        return (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setSessionDate(date)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tabular-nums transition ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-muted"
                            }`}
                          >
                            {formatSerialDateChip(date, lang)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums sm:hidden">
                {lang === "bn" ? "নেক্সট" : "Next"} #{nextNo}
              </span>
              {remaining != null && (
                <span className="inline-flex items-center rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums">
                  {lang === "bn" ? "বাকি" : "Left"}: {remaining}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  liveSession?.status === "open"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : liveSession
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                      : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {liveSession
                  ? `${lang === "bn" ? "সেশন" : "Session"}: ${liveSession.status}`
                  : lang === "bn"
                    ? "সেশন তৈরি হবে"
                    : "Session on create"}
              </span>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              2. {lang === "bn" ? "রোগীর তথ্য" : "Patient details"}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.name && (
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "নাম" : "Name"}
                  </span>
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    autoComplete="name"
                    placeholder={lang === "bn" ? "রোগীর পূর্ণ নাম" : "Patient full name"}
                    autoFocus
                  />
                </label>
              )}
              {fields.phone && (
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "মোবাইল" : "Mobile"}
                  </span>
                  <div className="flex gap-2">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(clampPhoneDigits(e.target.value))}
                      onBlur={() => {
                        if (clampPhoneDigits(phone).length >= 11) void lookupByPhone();
                      }}
                      className={`${inputCls} flex-1 tabular-nums`}
                      inputMode="tel"
                      maxLength={11}
                      placeholder="01XXXXXXXXX"
                    />
                    <button
                      type="button"
                      disabled={lookingUp || clampPhoneDigits(phone).length < 10}
                      onClick={() => void lookupByPhone()}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"
                    >
                      {lookingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      {lang === "bn" ? "খুঁজুন" : "Lookup"}
                    </button>
                  </div>
                </label>
              )}
              {fields.age && (
                <label className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "বয়স" : "Age"}
                  </span>
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    className={`${inputCls} tabular-nums`}
                    inputMode="numeric"
                    placeholder={lang === "bn" ? "বছর" : "Years"}
                  />
                </label>
              )}
              {fields.address && (
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {lang === "bn" ? "ঠিকানা" : "Address"}
                  </span>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className={`${inputCls} resize-y min-h-[4rem]`}
                    placeholder={lang === "bn" ? "এলাকা / ঠিকানা" : "Area / address"}
                  />
                </label>
              )}
              <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2.5 dark:bg-sky-950/20 dark:border-sky-900 cursor-pointer">
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
                      ? "সেকেন্ড টাইম ডিসকাউন্ট ফি থেকে কাটা হবে"
                      : "Second-visit discount applied to fee"}
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
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {lang === "bn" ? "সিরিয়াল তৈরি করুন" : "Create serial"}
            </button>
            <p className="text-[10px] text-muted-foreground text-center sm:text-left sm:max-w-[10rem]">
              Ctrl/⌘ + Enter
            </p>
          </div>
          {selectedAff && (
            <p className="text-center text-[10px] text-muted-foreground">
              {doctorName(selectedAff)} · {sessionDate}
            </p>
          )}
        </form>
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? `আজকের তৈরি (${createdToday.length})` : `Created today (${createdToday.length})`}
            </p>
          </div>
          {createdToday.length === 0 ? (
            <p className="px-3 py-10 text-center text-xs text-muted-foreground">
              {lang === "bn" ? "এখনো কোনো সিরিয়াল নেই" : "No serials yet"}
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {createdToday.map((t) => (
                <li key={t.id} className="flex items-start gap-2 px-3 py-2.5 text-sm">
                  <span className="w-9 shrink-0 font-black tabular-nums text-primary">{t.serial_no ?? "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t.guest_name || "—"}
                      {t.is_second_visit ? (
                        <span className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[9px] font-bold uppercase text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          {lang === "bn" ? "2nd" : "2nd"}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {[
                        t.guest_phone,
                        t.guest_age != null ? `${t.guest_age}y` : null,
                        t.guest_address,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] font-semibold text-primary"
                    onClick={() => setInvoiceId(t.id)}
                  >
                    {lang === "bn" ? "ইনভয়েস" : "Invoice"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <Dialog open={!!invoiceId} onOpenChange={(open) => !open && setInvoiceId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "সিরিয়াল ইনভয়েস" : "Serial invoice"}</DialogTitle>
          </DialogHeader>
          {invoiceId && (
            <CareSerialInvoiceCard serialId={invoiceId} canManagePayment={canManage} autoPrint={false} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
