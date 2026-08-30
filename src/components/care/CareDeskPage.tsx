import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  ClipboardList,
  LogOut,
  Plus,
  Stethoscope,
  Trash2,
  UserPlus,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { PageBackButton } from "@/components/nav/PageBackButton";
import {
  careHasPermission,
  fetchCareOrgRoles,
  fetchMyCareMemberships,
  addCareMember,
  removeCareMember,
  type CareMembership,
} from "@/lib/care-access";
import type { CarePermissionKey } from "@/lib/care-permissions";
import { CARE_PERMISSION_FALLBACK } from "@/lib/care-permissions";
import {
  careDoctorTypeLabel,
  fetchCareDoctorOnboarding,
  fetchCarePolicies,
  fetchCareSpecialties,
  fetchCareVendorTypes,
  type CareDoctorFieldKey,
  type CareDoctorOnboardingSettings,
} from "@/lib/care-cms";
import { DoctorTypeahead } from "@/components/care/DoctorTypeahead";
import { DoctorTypeSelect } from "@/components/care/DoctorTypeSelect";
import { DoctorIdDocumentFields } from "@/components/care/DoctorIdDocumentFields";
import {
  buildDoctorFullName,
  DOCTOR_FORM_DEMO,
  type CareIdDocumentKind,
} from "@/lib/care-doctor-id-document";
import {
  cancelOrgDoctorLink,
  customDoctor,
  fetchCareDoctorById,
  fetchOrgPendingDoctorLinks,
  isCustomDoctor,
  requestDoctorLink,
  resolveDoctorId,
  type CareDoctorOption,
  type OrgPendingDoctorLink,
} from "@/lib/care-doctors-api";
import { doctorFieldEnabled } from "@/lib/care-doctor-auth";
import {
  approveCareSerial,
  callNextSerial,
  ensureCareSession,
  deactivateOrgAffiliation,
  fetchOrgDoctors,
  fetchOrgLocations,
  fetchOrgSerialsByRequest,
  fetchOrgSessions,
  fetchSchedulesForAffiliations,
  fetchSessionQueue,
  formatTimeAmPm,
  isSerialPendingApproval,
  issueCareSerial,
  setSerialStatus,
  setSessionStatus,
  subscribeSession,
  upsertOrgAffiliation,
  type CareSerialRow,
  type CareSessionRow,
  type OrgDoctorRow,
} from "@/lib/care-api";
import { supabase } from "@/integrations/supabase/client";
import { findProfileIdByPhone } from "@/lib/find-profile-by-phone";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { CareSerialInvoiceCard } from "@/components/care/CareSerialInvoice";
import { CareSerialSettingsForm } from "@/components/care/CareSerialSettingsForm";
import { CareInvoiceLetterheadForm } from "@/components/care/CareInvoiceLetterheadForm";
import { CareCreateSerialPanel } from "@/components/care/CareCreateSerialPanel";
import {
  bookingFieldsFromFlags,
  fetchEffectiveDeskSerialSettings,
  fetchOrgSettings,
  parseOrgSettings,
  saveOrgInvoiceSettings,
  saveOrgSerialSettings,
  type CareOrgSerialSettings,
  type EffectiveDeskSerialSettings,
} from "@/lib/care-org-settings";
import type { CareOrgInvoiceSettings } from "@/lib/care-invoice-settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeskTab = "queue" | "create" | "doctors" | "schedule" | "staff" | "settings";

type CareDeskPageProps = {
  /** Vendor portal — separate auth & no donor onboarding */
  portalMode?: boolean;
};

export function CareDeskPage({ portalMode = false }: CareDeskPageProps) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const authPath = portalMode ? "/care/auth" : "/auth";
  const homePath = portalMode ? "/care/portal" : "/care";
  const [memberships, setMemberships] = useState<CareMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<DeskTab>("queue");
  const [ready, setReady] = useState(false);
  const [createSerialOn, setCreateSerialOn] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: authPath, search: {} } as never);
      return;
    }
    void fetchMyCareMemberships()
      .then((rows) => {
        const active = rows.filter((r) => r.care_orgs?.is_active !== false);
        if (!active.length) {
          toast.error(lang === "bn" ? "চেম্বার মেম্বারশিপ নেই" : "No chamber membership");
          void navigate({ to: portalMode ? "/care/auth" : "/care", search: portalMode ? { mode: undefined, next: undefined } : undefined } as never);
          return;
        }
        setMemberships(active);
        setOrgId((prev) => prev ?? active[0]!.org_id);
        setReady(true);
      })
      .catch((e) => {
        toast.error((e as Error).message);
        void navigate({ to: portalMode ? "/care/auth" : "/care", search: portalMode ? { mode: undefined, next: undefined } : undefined } as never);
      });
  }, [loading, user, navigate, lang, authPath, portalMode]);

  useEffect(() => {
    if (!orgId) return;
    void fetchEffectiveDeskSerialSettings(orgId)
      .then((s) => {
        setCreateSerialOn(s.manual_patient_serial !== false);
        setTab((t) => (t === "create" && s.manual_patient_serial === false ? "queue" : t));
      })
      .catch(() => setCreateSerialOn(true));
  }, [orgId]);

  async function handleSignOut() {
    await signOut();
    void navigate({ to: authPath, search: {} } as never);
  }

  const membership = useMemo(
    () => memberships.find((m) => m.org_id === orgId) ?? null,
    [memberships, orgId],
  );
  const can = (key: CarePermissionKey) => careHasPermission(membership, key);
  const org = membership?.care_orgs;
  const orgName = lang === "bn" ? org?.name_bn || org?.name : org?.name;

  if (!ready || !orgId || !membership) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs: { id: DeskTab; label: string; show: boolean }[] = [
    { id: "queue", label: lang === "bn" ? "কিউ" : "Queue", show: can("queue.view") },
    {
      id: "create",
      label: lang === "bn" ? "Create Serial" : "Create Serial",
      show: can("serial.issue") && createSerialOn,
    },
    { id: "doctors", label: lang === "bn" ? "ডাক্তার" : "Doctors", show: can("doctors.manage") || can("queue.view") },
    { id: "schedule", label: lang === "bn" ? "শিডিউল" : "Schedule", show: can("schedule.manage") || can("queue.view") },
    { id: "staff", label: lang === "bn" ? "স্টাফ" : "Staff", show: can("staff.manage") },
    { id: "settings", label: lang === "bn" ? "সেটিংস" : "Settings", show: can("settings.edit") },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <PageBackButton fallbackTo={homePath} shape="xl" />
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "চেম্বার ডেস্ক" : "Chamber desk"}
            </p>
            <h1 className="truncate text-base font-bold">{orgName}</h1>
          </div>
          {memberships.length > 1 && (
            <select
              className="max-w-40 rounded-xl border bg-background px-2 py-2 text-xs"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {lang === "bn" ? m.care_orgs?.name_bn || m.care_orgs?.name : m.care_orgs?.name}
                </option>
              ))}
            </select>
          )}
          <Link to={homePath} className="rounded-xl border px-2.5 py-2 text-xs font-medium">
            {portalMode ? (lang === "bn" ? "পোর্টাল" : "Portal") : lang === "bn" ? "কেয়ার" : "Care"}
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="h-9 w-9 grid place-items-center rounded-xl border">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        {tab === "queue" && <QueuePanel orgId={orgId} canIssue={can("serial.issue")} canManage={can("queue.manage")} lang={lang} />}
        {tab === "create" && (
          <CareCreateSerialPanel
            orgId={orgId}
            canIssue={can("serial.issue")}
            canManage={can("queue.manage")}
            lang={lang}
          />
        )}
        {tab === "doctors" && <DoctorsPanel orgId={orgId} canEdit={can("doctors.manage")} lang={lang} />}
        {tab === "schedule" && <SchedulePanel orgId={orgId} canEdit={can("schedule.manage")} lang={lang} />}
        {tab === "staff" && <StaffPanel orgId={orgId} lang={lang} />}
        {tab === "settings" && <SettingsPanel orgId={orgId} lang={lang} />}
      </main>
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function QueuePanel({
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
  const today = todayIso();
  /** Approvals use request/booking day; active queue uses session day */
  const [dateFilter, setDateFilter] = useState<"today" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState(today);
  /** null = all desks/sessions */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CareSessionRow[]>([]);
  const [extraSessions, setExtraSessions] = useState<CareSessionRow[]>([]);
  const [queue, setQueue] = useState<CareSerialRow[]>([]);
  const [pending, setPending] = useState<(CareSerialRow & { session?: CareSessionRow | null })[]>([]);
  const [approved, setApproved] = useState<(CareSerialRow & { session?: CareSessionRow | null })[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAge, setGuestAge] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [deskSettings, setDeskSettings] = useState<EffectiveDeskSerialSettings | null>(null);
  const [docs, setDocs] = useState<{ id: string; full_name: string }[]>([]);
  const [invoiceSerialId, setInvoiceSerialId] = useState<string | null>(null);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);
  const [approveNos, setApproveNos] = useState<Record<string, string>>({});
  const [profileByPatient, setProfileByPatient] = useState<
    Record<string, { full_name: string | null; phone: string | null; date_of_birth: string | null; area: string | null; city: string | null }>
  >({});

  const effectiveDate = dateFilter === "today" ? today : dateFilter === "custom" ? customDate : null;
  const fields = deskSettings?.booking_fields ?? {
    name: true,
    phone: true,
    age: true,
    address: true,
  };

  function ageFromDob(dob: string | null | undefined): number | null {
    if (!dob) return null;
    const d = new Date(`${dob}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age > 0 && age < 150 ? age : null;
  }

  async function enrichProfiles(rows: CareSerialRow[]) {
    const ids = Array.from(
      new Set(rows.map((r) => r.patient_id).filter((id): id is string => !!id)),
    );
    if (!ids.length) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, date_of_birth, area, city")
      .in("id", ids);
    if (!data?.length) return;
    setProfileByPatient((prev) => {
      const next = { ...prev };
      for (const row of data as {
        id: string;
        full_name: string | null;
        phone: string | null;
        date_of_birth: string | null;
        area: string | null;
        city: string | null;
      }[]) {
        next[row.id] = {
          full_name: row.full_name,
          phone: row.phone,
          date_of_birth: row.date_of_birth,
          area: row.area,
          city: row.city,
        };
      }
      return next;
    });
  }

  async function reloadSessions() {
    const list = await fetchOrgSessions(orgId, effectiveDate);
    setSessions(list);
    setSessionId((prev) => (prev && list.some((s) => s.id === prev) ? prev : null));
    return list;
  }

  async function reloadRequestLists() {
    const [pendingRows, approvedRows] = await Promise.all([
      fetchOrgSerialsByRequest(orgId, {
        requestedOn: effectiveDate,
        sessionId,
        statuses: ["pending_approval"],
        ascending: true, // FIFO: who booked first appears first
      }),
      fetchOrgSerialsByRequest(orgId, {
        requestedOn: effectiveDate,
        sessionId,
        statuses: ["booked", "checked_in", "called", "in_consult", "done"],
        ascending: false,
      }),
    ]);
    const approvedOnly = approvedRows.filter((r) => r.serial_no != null);
    setPending(pendingRows);
    setApproved(approvedOnly);
    setExtraSessions(
      [...pendingRows, ...approvedOnly]
        .map((r) => r.session)
        .filter((s): s is CareSessionRow => !!s),
    );
    void enrichProfiles([...pendingRows, ...approvedOnly]);
  }

  async function reloadQueue(list: CareSessionRow[] = sessions) {
    const ids = sessionId ? [sessionId] : list.map((s) => s.id);
    if (!ids.length) {
      setQueue([]);
      return;
    }
    const chunks = await Promise.all(ids.map((id) => fetchSessionQueue(id)));
    const rows = chunks.flat().filter((t) => !isSerialPendingApproval(t));
    setQueue(rows);
    void enrichProfiles(rows);
  }

  async function reloadAll() {
    const list = await reloadSessions();
    await Promise.all([reloadQueue(list), reloadRequestLists()]);
  }

  useEffect(() => {
    void reloadAll();
    void fetchOrgDoctors(orgId).then((rows) => {
      setDocs(
        (rows as unknown as { care_doctors?: { id: string; full_name: string } | null }[])
          .map((r) => r.care_doctors)
          .filter(Boolean) as { id: string; full_name: string }[],
      );
    });
    void fetchEffectiveDeskSerialSettings(orgId).then(setDeskSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, effectiveDate, sessionId]);

  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...(sessionId ? [sessionId] : sessions.map((s) => s.id)),
        ...pending.map((p) => p.session_id),
        ...approved.map((p) => p.session_id),
      ]),
    );
    if (!ids.length) return;
    const unsubs = ids.slice(0, 24).map((id) =>
      subscribeSession(id, () => {
        void reloadAll();
      }),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    sessions.map((s) => s.id).join(","),
    pending.map((p) => p.session_id).join(","),
    approved.map((p) => p.session_id).join(","),
  ]);

  const sess = sessions.find((s) => s.id === sessionId) ?? null;
  const sessionById = useMemo(() => {
    const map = new Map<string, CareSessionRow>();
    for (const s of sessions) map.set(s.id, s);
    for (const s of extraSessions) map.set(s.id, s);
    return map;
  }, [sessions, extraSessions]);
  const approvedIds = useMemo(() => new Set(approved.map((a) => a.id)), [approved]);
  /** Session-day queue without duplicating request-day approved list */
  const activeQueue = queue.filter((t) => !approvedIds.has(t.id));
  const showAllDesks = !sessionId;

  function doctorLabel(doctorId: string) {
    return docs.find((d) => d.id === doctorId)?.full_name ?? doctorId.slice(0, 6);
  }

  type DeskTicket = CareSerialRow & { session?: CareSessionRow | null };

  function groupTicketsByDoctor(rows: DeskTicket[]) {
    const groups = new Map<string, { doctorId: string; label: string; items: DeskTicket[] }>();
    for (const t of rows) {
      const s = t.session ?? sessionById.get(t.session_id);
      const doctorId = s?.doctor_id ?? "_unknown";
      const existing = groups.get(doctorId);
      if (existing) {
        existing.items.push(t);
      } else {
        groups.set(doctorId, {
          doctorId,
          label: doctorId === "_unknown" ? "—" : doctorLabel(doctorId),
          items: [t],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "bn"));
  }

  const pendingByDoctor = useMemo(
    () => groupTicketsByDoctor(pending),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, sessionById, docs],
  );
  const approvedByDoctor = useMemo(
    () => groupTicketsByDoctor(approved),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approved, sessionById, docs],
  );

  function ticketSessionMeta(t: DeskTicket) {
    const s = t.session ?? sessionById.get(t.session_id);
    if (!s) return null;
    const time = formatTimeAmPm(s.start_time, lang);
    return `${lang === "bn" ? "সিরিয়াল" : "Serial"} ${s.session_date}${time ? ` · ${time}` : ""}`;
  }

  function ticketSessionMetaFull(t: DeskTicket) {
    const s = t.session ?? sessionById.get(t.session_id);
    if (!s) return null;
    const time = formatTimeAmPm(s.start_time, lang);
    return `${doctorLabel(s.doctor_id)} · ${lang === "bn" ? "সিরিয়াল" : "Serial"} ${s.session_date}${time ? ` · ${time}` : ""}`;
  }

  function resolvePatient(t: CareSerialRow) {
    const p = t.patient_id ? profileByPatient[t.patient_id] : null;
    const name = t.guest_name?.trim() || p?.full_name?.trim() || null;
    const phone = t.guest_phone?.trim() || p?.phone?.trim() || null;
    const age =
      t.guest_age != null && t.guest_age > 0
        ? t.guest_age
        : ageFromDob(p?.date_of_birth ?? null);
    const address =
      t.guest_address?.trim() ||
      [p?.area?.trim(), p?.city?.trim()].filter(Boolean).join(", ") ||
      null;
    return { name, phone, age, address };
  }

  function PatientInfoBlock({
    t,
    meta,
  }: {
    t: CareSerialRow;
    meta?: string | null;
  }) {
    const { name, phone, age, address } = resolvePatient(t);
    const second = !!t.is_second_visit;
    return (
      <div className="flex-1 min-w-[12rem] rounded-xl bg-background/70 border border-border/60 px-2.5 py-2 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-semibold text-sm leading-snug truncate">
            {name || (lang === "bn" ? "নাম নেই" : "No name")}
          </p>
          {second && (
            <span className="shrink-0 rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              {lang === "bn" ? "সেকেন্ড টাইম" : "2nd visit"}
            </span>
          )}
        </div>
        <div className="grid gap-0.5 text-[11px] text-foreground/85">
          {phone && (
            <p className="truncate">
              <span className="text-muted-foreground">{lang === "bn" ? "মোবাইল" : "Mobile"}:</span>{" "}
              <span className="font-medium tabular-nums">{phone}</span>
            </p>
          )}
          {age != null && (
            <p className="truncate">
              <span className="text-muted-foreground">{lang === "bn" ? "বয়স" : "Age"}:</span>{" "}
              <span className="font-medium">
                {lang === "bn" ? `${age} বছর` : `${age} yrs`}
              </span>
            </p>
          )}
          {address && (
            <p className="whitespace-normal break-words leading-snug">
              <span className="text-muted-foreground">{lang === "bn" ? "ঠিকানা" : "Address"}:</span>{" "}
              <span className="font-medium">{address}</span>
            </p>
          )}
          {second && t.fee_amount != null && (
            <p className="truncate">
              <span className="text-muted-foreground">{lang === "bn" ? "ফি" : "Fee"}:</span>{" "}
              <span className="font-medium tabular-nums">
                ৳{t.fee_amount}
                {t.fee_original != null && t.fee_original > t.fee_amount ? (
                  <span className="text-muted-foreground line-through ml-1">৳{t.fee_original}</span>
                ) : null}
              </span>
            </p>
          )}
          {!phone && age == null && !address && (
            <p className="text-muted-foreground">
              {lang === "bn" ? "অতিরিক্ত তথ্য নেই" : "No extra details"}
            </p>
          )}
        </div>
        {meta && <p className="text-[10px] text-muted-foreground truncate pt-0.5">{meta}</p>}
      </div>
    );
  }

  function patientTitle(t: CareSerialRow) {
    return resolvePatient(t).name || t.guest_phone || t.patient_id?.slice(0, 8) || "—";
  }

  function patientDetailsLine(t: CareSerialRow) {
    const { phone, age, address } = resolvePatient(t);
    return [
      age != null ? (lang === "bn" ? `${age} বছর` : `${age} yrs`) : null,
      phone,
      address,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reloadAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-xl border p-0.5 bg-muted/30">
          <button
            type="button"
            onClick={() => setDateFilter("today")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              dateFilter === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {lang === "bn" ? "আজ" : "Today"}
          </button>
          <button
            type="button"
            onClick={() => setDateFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              dateFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {lang === "bn" ? "সব তারিখ" : "All dates"}
          </button>
        </div>
        <input
          type="date"
          value={dateFilter === "custom" ? customDate : dateFilter === "today" ? today : customDate}
          onChange={(e) => {
            setCustomDate(e.target.value);
            setDateFilter("custom");
          }}
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <select
          value={sessionId ?? "all"}
          onChange={(e) => setSessionId(e.target.value === "all" ? null : e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm min-w-44"
        >
          <option value="all">{lang === "bn" ? "সব ডেস্ক" : "All desks"}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {doctorLabel(s.doctor_id)} · {s.session_date} · {s.status} · {s.last_issued}/{s.max_serial}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground px-1">
        {lang === "bn"
          ? "অ্যাপ্রুভাল: বুকিং/রিকোয়েস্ট তারিখ · কিউ: সেশনের তারিখ (সিরিয়াল দিন আলাদা হতে পারে)"
          : "Approvals: request date · Queue: session date (serial day may differ)"}
      </p>

      {sessions.length === 0 && pending.length === 0 && approved.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {lang === "bn" ? "এই ফিল্টারে কোনো সেশন/অ্যাপ্রুভাল নেই" : "No sessions/approvals for this filter"}
        </p>
      )}

      {sess && canManage && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold" onClick={() => void act(() => setSessionStatus(sess.id, "open"))}>
            {lang === "bn" ? "সেশন খুলুন" : "Open"}
          </button>
          <button type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold" onClick={() => void act(() => setSessionStatus(sess.id, "paused"))}>
            {lang === "bn" ? "পজ" : "Pause"}
          </button>
          <button type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold" onClick={() => void act(() => setSessionStatus(sess.id, "closed"))}>
            {lang === "bn" ? "বন্ধ" : "Close"}
          </button>
          <button type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold" onClick={() => void act(() => callNextSerial(sess.id))}>
            {lang === "bn" ? "কল নেক্সট" : "Call next"}
          </button>
        </div>
      )}
      {showAllDesks && (canManage || canIssue) && (
        <p className="text-[11px] text-muted-foreground px-1">
          {lang === "bn"
            ? "সেশন খোলা / কল নেক্সট করতে একটি ডেস্ক বেছে নিন। রোগী সিরিয়াল → Create Serial ট্যাব।"
            : "Pick a desk to open session or call next. Patient serials → Create Serial tab."}
        </p>
      )}
      {canIssue && deskSettings?.manual_patient_serial && (
        <p className="text-[11px] rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2 text-muted-foreground">
          {lang === "bn"
            ? "নাম/মোবাইল/বয়স/ঠিকানা দিয়ে সিরিয়াল বানাতে উপরের «Create Serial» ট্যাব ব্যবহার করুন।"
            : "Use the «Create Serial» tab above to issue serials with name/mobile/age/address."}
        </p>
      )}
      {sess && canIssue && !deskSettings?.manual_patient_serial && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const ageNum = guestAge.trim() ? Number(guestAge.trim()) : null;
              const ticket = await issueCareSerial({
                sessionId: sess.id,
                source: "walk_in",
                guestName: fields.name ? guestName || undefined : undefined,
                guestPhone: fields.phone ? guestPhone || undefined : undefined,
                guestAge: fields.age && ageNum != null && Number.isFinite(ageNum) ? ageNum : null,
                guestAddress: fields.address ? guestAddress.trim() || undefined : undefined,
              });
              setGuestName("");
              setGuestPhone("");
              setGuestAge("");
              setGuestAddress("");
              setAutoPrintInvoice(true);
              setInvoiceSerialId(ticket.id);
              toast.success(lang === "bn" ? `সিরিয়াল ${ticket.serial_no} · ইনভয়েস তৈরি` : `Serial ${ticket.serial_no} · Invoice ready`);
            });
          }}
        >
          {fields.name && (
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={lang === "bn" ? "নাম" : "Name"} className="rounded-xl border px-3 py-2 text-sm" />
          )}
          {fields.phone && (
            <input value={guestPhone} onChange={(e) => setGuestPhone(clampPhoneDigits(e.target.value))} placeholder={lang === "bn" ? "মোবাইল" : "Mobile"} className="rounded-xl border px-3 py-2 text-sm" inputMode="tel" maxLength={11} />
          )}
          {fields.age && (
            <input value={guestAge} onChange={(e) => setGuestAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder={lang === "bn" ? "বয়স" : "Age"} className="w-20 rounded-xl border px-3 py-2 text-sm tabular-nums" inputMode="numeric" />
          )}
          {fields.address && (
            <input value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} placeholder={lang === "bn" ? "ঠিকানা" : "Address"} className="min-w-[10rem] flex-1 rounded-xl border px-3 py-2 text-sm" />
          )}
          <button type="submit" className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
            {lang === "bn" ? "ওয়াক-ইন সিরিয়াল" : "Walk-in serial"}
          </button>
        </form>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            {lang === "bn" ? `অনুমোদন বাকি (${pending.length})` : `Pending approval (${pending.length})`}
          </p>
          {pendingByDoctor.map((group) => (
            <div key={`pending-${group.doctorId}`} className="space-y-1.5">
              <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-amber-700 shrink-0" aria-hidden />
                <span className="truncate">{group.label}</span>
                <span className="text-muted-foreground font-normal tabular-nums">({group.items.length})</span>
              </p>
              <ul className="divide-y rounded-2xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900">
                {group.items.map((t) => {
                  const reserved = t.serial_no;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                      <span className="font-black tabular-nums w-8 text-amber-800">
                        {reserved ?? "—"}
                      </span>
                      <PatientInfoBlock
                        t={t}
                        meta={[
                          ticketSessionMeta(t),
                          lang === "bn" ? `বুকিং ${t.created_at.slice(0, 10)}` : `Booked ${t.created_at.slice(0, 10)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                      <span className="text-[10px] text-muted-foreground tabular-nums font-semibold text-sky-800">
                        {t.online_serial_no != null
                          ? lang === "bn"
                            ? `অনলাইন #${t.online_serial_no}`
                            : `Online #${t.online_serial_no}`
                          : t.claim_code}
                      </span>
                      {(canIssue || canManage) && (
                        <>
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={approveNos[t.id] ?? ""}
                            onChange={(e) => setApproveNos((p) => ({ ...p, [t.id]: e.target.value }))}
                            placeholder={
                              reserved != null
                                ? lang === "bn"
                                  ? `নম্বর (#${reserved})`
                                  : `No. (#${reserved})`
                                : lang === "bn"
                                  ? "নম্বর"
                                  : "No."
                            }
                            className="w-24 rounded-lg border bg-background px-2 py-1.5 text-xs tabular-nums"
                          />
                          <button
                            type="button"
                            className="rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-[11px] font-semibold"
                            onClick={() =>
                              void act(async () => {
                                const raw = (approveNos[t.id] ?? "").trim();
                                const n = raw ? Number(raw) : null;
                                const ticket = await approveCareSerial({
                                  serialId: t.id,
                                  serialNo: n != null && Number.isFinite(n) ? n : null,
                                });
                                setApproveNos((p) => {
                                  const next = { ...p };
                                  delete next[t.id];
                                  return next;
                                });
                                setAutoPrintInvoice(false);
                                setInvoiceSerialId(ticket.id);
                                toast.success(
                                  lang === "bn"
                                    ? `সিরিয়াল ${ticket.serial_no} অনুমোদিত`
                                    : `Serial ${ticket.serial_no} approved`,
                                );
                              })
                            }
                          >
                            {lang === "bn" ? "অ্যাপ্রুভ" : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-destructive"
                            onClick={() => void act(() => setSerialStatus(t.id, "cancelled"))}
                          >
                            {lang === "bn" ? "বাতিল" : "Reject"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary"
                        onClick={() => {
                          setAutoPrintInvoice(false);
                          setInvoiceSerialId(t.id);
                        }}
                      >
                        {lang === "bn" ? "ইনভয়েস" : "Invoice"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            {lang === "bn" ? `অনুমোদিত (${approved.length})` : `Approved (${approved.length})`}
          </p>
          {approvedByDoctor.map((group) => (
            <div key={`approved-${group.doctorId}`} className="space-y-1.5">
              <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden />
                <span className="truncate">{group.label}</span>
                <span className="text-muted-foreground font-normal tabular-nums">({group.items.length})</span>
              </p>
              <ul className="divide-y rounded-2xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900">
                {group.items.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="font-black tabular-nums w-8 text-emerald-700">{t.serial_no}</span>
                    <PatientInfoBlock
                      t={t}
                      meta={[
                        ticketSessionMeta(t),
                        lang === "bn" ? `বুকিং ${t.created_at.slice(0, 10)}` : `Booked ${t.created_at.slice(0, 10)}`,
                        t.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {lang === "bn" ? "অ্যাপ্রুভড" : "Approved"}
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-primary"
                      onClick={() => {
                        setAutoPrintInvoice(false);
                        setInvoiceSerialId(t.id);
                      }}
                    >
                      {lang === "bn" ? "ইনভয়েস" : "Invoice"}
                    </button>
                    {canManage && t.status !== "done" && t.status !== "cancelled" && (
                      <>
                        <button
                          type="button"
                          className="text-[11px] font-semibold"
                          onClick={() => void act(() => setSerialStatus(t.id, "no_show"))}
                        >
                          {lang === "bn" ? "নো-শো" : "No-show"}
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-semibold"
                          onClick={() => void act(() => setSerialStatus(t.id, "done"))}
                        >
                          {lang === "bn" ? "শেষ" : "Done"}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ul className="divide-y rounded-2xl border bg-card">
        {activeQueue.map((t) => (
          <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="font-black tabular-nums w-8">{t.serial_no ?? "—"}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate">{patientTitle(t)}</p>
              {patientDetailsLine(t) && (
                <p className="text-[11px] text-muted-foreground whitespace-normal break-words">
                  {patientDetailsLine(t)}
                </p>
              )}
              {showAllDesks && ticketSessionMetaFull(t) && (
                <p className="text-[10px] text-muted-foreground truncate">{ticketSessionMetaFull(t)}</p>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{t.status}</span>
            <button
                type="button"
                className="text-[11px] font-semibold text-primary"
                onClick={() => {
                  setAutoPrintInvoice(false);
                  setInvoiceSerialId(t.id);
                }}
              >
                {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </button>
            {canManage && t.status !== "done" && t.status !== "cancelled" && (
              <>
                <button type="button" className="text-[11px] font-semibold" onClick={() => void act(() => setSerialStatus(t.id, "no_show"))}>
                  {lang === "bn" ? "নো-শো" : "No-show"}
                </button>
                <button type="button" className="text-[11px] font-semibold" onClick={() => void act(() => setSerialStatus(t.id, "done"))}>
                  {lang === "bn" ? "শেষ" : "Done"}
                </button>
              </>
            )}
          </li>
        ))}
        {activeQueue.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            {lang === "bn" ? "কিউ খালি" : "Queue empty"}
          </li>
        )}
      </ul>

      <Dialog
        open={!!invoiceSerialId}
        onOpenChange={(open) => {
          if (!open) {
            setInvoiceSerialId(null);
            setAutoPrintInvoice(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "সিরিয়াল ইনভয়েস" : "Serial invoice"}</DialogTitle>
          </DialogHeader>
          {invoiceSerialId && (
            <CareSerialInvoiceCard
              serialId={invoiceSerialId}
              canManagePayment={canManage}
              autoPrint={autoPrintInvoice}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DoctorsPanel({ orgId, canEdit, lang }: { orgId: string; canEdit: boolean; lang: "bn" | "en" }) {
  const bn = lang === "bn";
  const [rows, setRows] = useState<OrgDoctorRow[]>([]);
  const [pending, setPending] = useState<OrgPendingDoctorLink[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [specs, setSpecs] = useState<{ id: string; name_en: string; name_bn: string }[]>([]);
  const [onboarding, setOnboarding] = useState<CareDoctorOnboardingSettings | null>(null);
  const [doctor, setDoctor] = useState<CareDoctorOption | null>(null);
  const [fullNameBn, setFullNameBn] = useState(DOCTOR_FORM_DEMO.fullNameBn);
  const [title, setTitle] = useState(DOCTOR_FORM_DEMO.title);
  const [firstName, setFirstName] = useState(DOCTOR_FORM_DEMO.firstName);
  const [lastName, setLastName] = useState(DOCTOR_FORM_DEMO.lastName);
  const [dob, setDob] = useState(DOCTOR_FORM_DEMO.dateOfBirth);
  const [gender, setGender] = useState(DOCTOR_FORM_DEMO.gender);
  const [idKind, setIdKind] = useState<CareIdDocumentKind | "">(DOCTOR_FORM_DEMO.idDocumentKind);
  const [nid, setNid] = useState(DOCTOR_FORM_DEMO.idDocumentNo);
  const [bmdc, setBmdc] = useState(DOCTOR_FORM_DEMO.bmdcNo);
  const [doctorType, setDoctorType] = useState(DOCTOR_FORM_DEMO.doctorType);
  const [phone, setPhone] = useState(DOCTOR_FORM_DEMO.phone);
  const [email, setEmail] = useState(DOCTOR_FORM_DEMO.email);
  const [qual, setQual] = useState(DOCTOR_FORM_DEMO.qualifications);
  const [specId, setSpecId] = useState("");
  const [defaultLocId, setDefaultLocId] = useState("");
  const [fee, setFee] = useState(DOCTOR_FORM_DEMO.fee);
  const [discType, setDiscType] = useState<"percent" | "fixed">(DOCTOR_FORM_DEMO.discType);
  const [discValue, setDiscValue] = useState(DOCTOR_FORM_DEMO.discValue);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  const fields = onboarding?.fields;
  const show = (key: CareDoctorFieldKey) => !fields || doctorFieldEnabled(fields, key);
  const termsRequired = !fields || doctorFieldEnabled(fields, "terms");
  const profileLocked = !!doctor && !isCustomDoctor(doctor) && !!doctor.has_account;
  const inp =
    "rounded-xl border px-3 py-2 text-sm disabled:bg-muted/40 disabled:text-muted-foreground";

  function openAddForm() {
    applyDemoValues();
    setShowAddForm(true);
  }

  function closeAddForm() {
    setShowAddForm(false);
  }

  function applyDemoValues() {
    setDoctor(null);
    setFullNameBn(DOCTOR_FORM_DEMO.fullNameBn);
    setTitle(DOCTOR_FORM_DEMO.title);
    setFirstName(DOCTOR_FORM_DEMO.firstName);
    setLastName(DOCTOR_FORM_DEMO.lastName);
    setDob(DOCTOR_FORM_DEMO.dateOfBirth);
    setGender(DOCTOR_FORM_DEMO.gender);
    setIdKind(DOCTOR_FORM_DEMO.idDocumentKind);
    setNid(DOCTOR_FORM_DEMO.idDocumentNo);
    setBmdc(DOCTOR_FORM_DEMO.bmdcNo);
    setDoctorType(DOCTOR_FORM_DEMO.doctorType);
    setPhone(DOCTOR_FORM_DEMO.phone);
    setEmail(DOCTOR_FORM_DEMO.email);
    setQual(DOCTOR_FORM_DEMO.qualifications);
    setFee(DOCTOR_FORM_DEMO.fee);
    setDiscType(DOCTOR_FORM_DEMO.discType);
    setDiscValue(DOCTOR_FORM_DEMO.discValue);
    setTerms(false);
    if (specs[0]) setSpecId(specs[0].id);
  }

  function clearProfileFields() {
    setFullNameBn("");
    setTitle("Dr.");
    setFirstName("");
    setLastName("");
    setDob("");
    setGender("");
    setIdKind("");
    setNid("");
    setBmdc("");
    setDoctorType("");
    setPhone("");
    setEmail("");
    setQual("");
    setSpecId("");
  }

  function applyDoctorProfile(d: CareDoctorOption) {
    setFullNameBn(d.full_name_bn ?? "");
    setTitle(d.title ?? "");
    setFirstName(d.first_name ?? "");
    setLastName(d.last_name ?? "");
    setDob(d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : "");
    setGender(d.gender ?? "");
    setIdKind((d.id_document_kind as CareIdDocumentKind) || (d.nid_passport ? "nid" : ""));
    setNid(d.nid_passport ?? "");
    setBmdc(d.bmdc_no ?? "");
    setDoctorType(d.doctor_type ?? "");
    setPhone(d.phone ?? "");
    setEmail(d.email ?? "");
    setQual(d.qualifications ?? "");
    setSpecId(d.specialty_id ?? "");
  }

  async function onDoctorChange(next: CareDoctorOption | null) {
    setDoctor(next);
    if (!next) {
      clearProfileFields();
      return;
    }
    if (isCustomDoctor(next)) {
      clearProfileFields();
      return;
    }
    try {
      const full = await fetchCareDoctorById(next.id);
      const merged: CareDoctorOption = {
        ...next,
        ...(full ?? {}),
        has_account: full?.has_account ?? next.has_account,
        in_org: next.in_org,
        org_count: next.org_count,
      };
      setDoctor(merged);
      applyDoctorProfile(merged);
    } catch {
      applyDoctorProfile(next);
    }
  }

  function resetAffiliationForm() {
    applyDemoValues();
    setShowAddForm(false);
  }

  async function ensureDefaultLocation(): Promise<string | null> {
    try {
      const locations = (await fetchOrgLocations(orgId)) as {
        id: string;
        name: string;
        is_active?: boolean | null;
      }[];
      const hit = locations.find((l) => l.is_active !== false) ?? locations[0];
      if (hit?.id) {
        setDefaultLocId(hit.id);
        return hit.id;
      }
      const { data, error } = await supabase
        .from("care_locations")
        .insert({
          org_id: orgId,
          name: "Main chamber",
          name_bn: "প্রধান চেম্বার",
          is_active: true,
          sort_order: 0,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const id = String((data as { id: string }).id);
      setDefaultLocId(id);
      return id;
    } catch (e) {
      toast.error((e as Error).message || (bn ? "লোকেশন পাওয়া যায়নি" : "No location found"));
      return null;
    }
  }

  async function reload() {
    setRows(await fetchOrgDoctors(orgId));
    setPending(await fetchOrgPendingDoctorLinks(orgId));
    await ensureDefaultLocation();
  }

  useEffect(() => {
    void reload();
    void fetchCareSpecialties().then((list) => {
      setSpecs(list);
      if (list[0] && !specId) setSpecId(list[0].id);
    });
    void fetchCareDoctorOnboarding().then(setOnboarding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function add() {
    let locId = defaultLocId;
    if (!locId) {
      locId = (await ensureDefaultLocation()) || "";
    }
    if (!locId) {
      toast.error(bn ? "প্রতিষ্ঠানের লোকেশন নেই" : "Organization has no location");
      return;
    }
    if (termsRequired && !terms) {
      toast.error(bn ? "শর্তাবলী মেনে নিন" : "Please accept the terms");
      return;
    }
    const fullName =
      doctor && !isCustomDoctor(doctor)
        ? doctor.full_name
        : buildDoctorFullName({ title, firstName, lastName });
    if (!fullName.trim()) {
      toast.error(bn ? "নাম দিন (Title / First / Last)" : "Enter name (Title / First / Last)");
      return;
    }
    if (show("nid_passport") && !profileLocked) {
      if (!idKind) {
        toast.error(bn ? "পরিচয়পত্রের ধরন নির্বাচন করুন" : "Select ID document type");
        return;
      }
      if (!nid.trim()) {
        toast.error(bn ? "পরিচয়পত্র নম্বর দিন" : "Enter ID document number");
        return;
      }
    }

    const selected =
      doctor && !isCustomDoctor(doctor) ? doctor : customDoctor(fullName.trim());

    setBusy(true);
    try {
      const discNum = discValue.trim() ? Number(discValue) : null;
      const hasDiscount = discNum != null && Number.isFinite(discNum) && discNum > 0;
      const specRow = specs.find((s) => s.id === specId);
      const feePayload = {
        fee_amount: fee ? Number(fee) : null,
        second_visit_discount_type: hasDiscount ? discType : null,
        second_visit_discount_value: hasDiscount ? discNum : null,
        specialty_id: specId || null,
        specialty_name_en: specRow?.name_en ?? null,
        specialty_name_bn: specRow?.name_bn ?? null,
        full_name: fullName.trim() || null,
        full_name_bn: fullNameBn || null,
        photo_url:
          doctor && !isCustomDoctor(doctor) ? doctor.photo_url ?? null : null,
        doctor_code:
          doctor && !isCustomDoctor(doctor) ? doctor.doctor_code ?? null : null,
        bmdc_no: bmdc || null,
        qualifications: qual || null,
        phone: phone || null,
        email: email || null,
        title: title || null,
        first_name: firstName || null,
        last_name: lastName || null,
        doctor_type: doctorType || null,
        id_document_kind: idKind || null,
        nid_passport: nid || null,
      };

      if (!isCustomDoctor(selected) && selected.has_account) {
        const { data: prior } = await supabase
          .from("care_affiliations")
          .select("id, is_active")
          .eq("org_id", orgId)
          .eq("doctor_id", selected.id)
          .eq("location_id", locId)
          .maybeSingle();
        if (prior?.id) {
          await upsertOrgAffiliation({
            orgId,
            doctorId: selected.id,
            locationId: locId,
            fee_amount: feePayload.fee_amount,
            second_visit_discount_type: feePayload.second_visit_discount_type,
            second_visit_discount_value: feePayload.second_visit_discount_value,
          });
          resetAffiliationForm();
          await reload();
          toast.success(bn ? "ডাক্তার আবার যোগ হয়েছে" : "Doctor restored");
          return;
        }
        await requestDoctorLink({
          doctorId: selected.id,
          orgId,
          kind: "affiliation",
          locationId: locId,
          payload: feePayload,
        });
        resetAffiliationForm();
        toast.success(
          bn ? "অনুমোদনের জন্য অনুরোধ পাঠানো হয়েছে" : "Approval request sent to doctor",
        );
        return;
      }

      const doctorId = await resolveDoctorId(selected, {
        bmdcNo: bmdc || null,
        specialtyId: specId || null,
        qualifications: qual || null,
        fullNameBn: fullNameBn || null,
        title: title || null,
        firstName: firstName || null,
        lastName: lastName || null,
        dateOfBirth: dob || null,
        gender: gender || null,
        nidPassport: nid || null,
        idDocumentKind: idKind || null,
        doctorType: doctorType || null,
        phone: phone || null,
        email: email || null,
      });
      const result = await upsertOrgAffiliation({
        orgId,
        doctorId,
        locationId: locId,
        fee_amount: feePayload.fee_amount,
        second_visit_discount_type: feePayload.second_visit_discount_type,
        second_visit_discount_value: feePayload.second_visit_discount_value,
      });
      resetAffiliationForm();
      await reload();
      toast.success(
        result === "restored"
          ? bn
            ? "ডাক্তার আবার যোগ হয়েছে"
            : "Doctor restored"
          : bn
            ? "যোগ হয়েছে"
            : "Added",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAffiliation(affId: string, name: string) {
    if (!canEdit) return;
    if (!window.confirm(bn ? `${name} সরিয়ে ফেলবেন?` : `Remove ${name}?`)) return;
    setBusy(true);
    try {
      await deactivateOrgAffiliation(affId);
      toast.success(bn ? "সরানো হয়েছে" : "Removed");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removePending(reqId: string, name: string) {
    if (!canEdit) return;
    if (!window.confirm(bn ? `${name}-এর অনুরোধ বাতিল করবেন?` : `Cancel request for ${name}?`)) return;
    setBusy(true);
    try {
      await cancelOrgDoctorLink(reqId);
      toast.success(bn ? "অনুরোধ বাতিল" : "Request cancelled");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function FieldLabel({ children }: { children: ReactNode }) {
    return <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">{children}</label>;
  }

  function fieldLabel(key: CareDoctorFieldKey, fallbackEn: string, fallbackBn: string) {
    const f = fields?.[key];
    if (bn) return f?.label_bn || fallbackBn;
    return f?.label_en || fallbackEn;
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          {bn ? "ডাক্তার যোগ করুন" : "Add doctor"}
        </button>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
            {bn ? "অনুমোদনের অপেক্ষায়" : "Pending approval"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pending.map((p) => {
              const d = p.care_doctors;
              const pl = p.payload ?? {};
              const plStr = (key: string) => {
                const v = pl[key];
                if (v == null || v === "") return "";
                return String(v);
              };
              const name = bn
                ? d?.full_name_bn || plStr("full_name_bn") || d?.full_name || plStr("full_name")
                : d?.full_name || plStr("full_name") || d?.full_name_bn || plStr("full_name_bn");
              const photo = d?.photo_url || plStr("photo_url") || null;
              const code = d?.doctor_code || plStr("doctor_code") || null;
              const bmdcNo = d?.bmdc_no || plStr("bmdc_no") || null;
              const dtype = d?.doctor_type || plStr("doctor_type") || null;
              const qualText = d?.qualifications || plStr("qualifications") || null;
              const phoneText = d?.phone || plStr("phone") || null;
              const emailText = d?.email || plStr("email") || null;
              const specIdHit = d?.specialty_id || plStr("specialty_id") || "";
              const specFromList = specs.find((s) => s.id === specIdHit);
              const spec = bn
                ? d?.care_specialties?.name_bn ||
                  plStr("specialty_name_bn") ||
                  specFromList?.name_bn
                : d?.care_specialties?.name_en ||
                  plStr("specialty_name_en") ||
                  specFromList?.name_en;
              const loc = bn
                ? p.care_locations?.name_bn || p.care_locations?.name
                : p.care_locations?.name;
              const feeAmt = pl.fee_amount;
              const discT = plStr("second_visit_discount_type");
              const discVRaw = pl.second_visit_discount_value;
              const discV =
                typeof discVRaw === "number"
                  ? discVRaw
                  : discVRaw != null && discVRaw !== ""
                    ? Number(discVRaw)
                    : null;
              return (
                <article
                  key={p.id}
                  className="relative flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {photo ? (
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <Stethoscope className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-7">
                    <p className="truncate text-sm font-semibold">{name || "—"}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {[
                        code,
                        bmdcNo ? `BMDC ${bmdcNo}` : null,
                        careDoctorTypeLabel(dtype, lang),
                        spec,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {qualText ? (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{qualText}</p>
                    ) : null}
                    {phoneText ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{phoneText}</p>
                    ) : null}
                    {emailText ? (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{emailText}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-foreground/80">
                      {loc || "—"}
                      {feeAmt != null && feeAmt !== "" ? ` · ৳${feeAmt}` : ""}
                      {discV != null && Number.isFinite(discV) && discV > 0
                        ? ` · 2nd −${discT === "fixed" ? "৳" : ""}${discV}${discT === "percent" ? "%" : ""}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-amber-800">
                      {bn ? "অনুমোদনের অপেক্ষায়" : "Pending approval"}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      title={bn ? "বাতিল" : "Cancel"}
                      onClick={() => void removePending(p.id, name || "doctor")}
                      className="absolute right-2 top-2 rounded-lg border border-amber-600/30 p-1.5 text-amber-800 hover:bg-amber-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => {
          const d = r.care_doctors;
          const name = bn ? d?.full_name_bn || d?.full_name : d?.full_name;
          const loc = bn ? r.care_locations?.name_bn || r.care_locations?.name : r.care_locations?.name;
          const spec = bn
            ? d?.care_specialties?.name_bn
            : d?.care_specialties?.name_en;
          return (
            <article key={r.id} className="relative flex gap-3 rounded-2xl border bg-card p-3 shadow-sm">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {d?.photo_url ? (
                  <img src={d.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pr-7">
                <p className="truncate text-sm font-semibold">{name || "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {[d?.doctor_code, d?.bmdc_no ? `BMDC ${d.bmdc_no}` : null, careDoctorTypeLabel(d?.doctor_type, lang), spec]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {d?.qualifications ? (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{d.qualifications}</p>
                ) : null}
                {d?.phone ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{d.phone}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-foreground/80">
                  {loc || "—"}
                  {r.fee_amount != null ? ` · ৳${r.fee_amount}` : ""}
                  {r.second_visit_discount_value != null && r.second_visit_discount_value > 0
                    ? ` · 2nd −${r.second_visit_discount_type === "fixed" ? "৳" : ""}${r.second_visit_discount_value}${r.second_visit_discount_type === "percent" ? "%" : ""}`
                    : ""}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  title={bn ? "সরান" : "Remove"}
                  onClick={() => void removeAffiliation(r.id, name || "doctor")}
                  className="absolute right-2 top-2 rounded-lg border p-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </article>
          );
        })}
      </div>

      {!rows.length && !pending.length && (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {bn ? "এখনো কোনো ডাক্তার নেই" : "No doctors yet"}
        </p>
      )}

      <Dialog open={showAddForm} onOpenChange={(o) => (o ? setShowAddForm(true) : closeAddForm())}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{bn ? "ডাক্তার যোগ করুন" : "Add doctor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">

          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {bn
                ? "ক্যাটালগ থেকে খুঁজে নিন, অথবা নিচের সব ইনপুট পূরণ করে নতুন ডাক্তার যোগ করুন।"
                : "Search the catalog, or fill every field below to add a new doctor."}
            </p>
            <button
              type="button"
              onClick={applyDemoValues}
              className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold"
            >
              {bn ? "ডেমো পূরণ" : "Fill demo"}
            </button>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>{bn ? "ডাক্তার খুঁজুন (ঐচ্ছিক — নাম / কোড / BMDC)" : "Find doctor (optional — name / code / BMDC)"}</FieldLabel>
            <DoctorTypeahead value={doctor} onChange={(d) => void onDoctorChange(d)} orgId={orgId} />
            {doctor?.doctor_code ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {bn ? "কোড" : "Code"}: <span className="font-semibold text-foreground">{doctor.doctor_code}</span>
                {doctor.registration_status ? ` · ${doctor.registration_status}` : ""}
                {profileLocked
                  ? bn
                    ? " · প্রোফাইল লক (নিবন্ধিত)"
                    : " · profile locked (registered)"
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>{bn ? "বাংলা নাম" : "Bengali name"}</FieldLabel>
            <input
              value={fullNameBn}
              onChange={(e) => setFullNameBn(e.target.value)}
              disabled={profileLocked}
              className={inp + " w-full"}
              placeholder={bn ? "বাংলায় পূর্ণ নাম" : "Full name in Bangla"}
            />
          </div>

          {show("title") && (
            <div>
              <FieldLabel>{fieldLabel("title", "Title", "উপাধি")}</FieldLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={profileLocked} className={inp + " w-full"} placeholder="Dr. / Prof." />
            </div>
          )}
          {(show("first_name") || show("last_name")) && (
            <div>
              <FieldLabel>
                {[show("first_name") ? fieldLabel("first_name", "First name", "নামের প্রথম অংশ") : null, show("last_name") ? fieldLabel("last_name", "Last name", "নামের শেষ অংশ") : null]
                  .filter(Boolean)
                  .join(" / ")}
              </FieldLabel>
              <div className="flex gap-1.5">
                {show("first_name") && (
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={profileLocked} className={inp + " w-full"} placeholder="First" />
                )}
                {show("last_name") && (
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={profileLocked} className={inp + " w-full"} placeholder="Last" />
                )}
              </div>
            </div>
          )}
          {show("date_of_birth") && (
            <div>
              <FieldLabel>{fieldLabel("date_of_birth", "Date of birth", "জন্ম তারিখ")}</FieldLabel>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} disabled={profileLocked} className={inp + " w-full"} />
            </div>
          )}
          {show("gender") && (
            <div>
              <FieldLabel>{fieldLabel("gender", "Gender", "লিঙ্গ")}</FieldLabel>
              <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={profileLocked} className={inp + " w-full"}>
                <option value="">—</option>
                <option value="male">{bn ? "পুরুষ" : "Male"}</option>
                <option value="female">{bn ? "নারী" : "Female"}</option>
                <option value="other">{bn ? "অন্যান্য" : "Other"}</option>
              </select>
            </div>
          )}
          {show("nid_passport") && (
            <div className="sm:col-span-2">
              <DoctorIdDocumentFields
                kind={idKind}
                number={nid}
                onKindChange={setIdKind}
                onNumberChange={setNid}
                lang={lang}
                disabled={profileLocked}
                selectClassName={inp + " w-full"}
                inputClassName={inp + " w-full"}
              />
            </div>
          )}
          {show("bmdc") && (
            <div>
              <FieldLabel>{fieldLabel("bmdc", "BMDC", "বিএমডিসি")}</FieldLabel>
              <input value={bmdc} onChange={(e) => setBmdc(e.target.value)} disabled={profileLocked} className={inp + " w-full"} placeholder="BMDC" />
            </div>
          )}
          {show("doctor_type") && (
            <div>
              <FieldLabel>{fieldLabel("doctor_type", "Doctor type", "ডাক্তারের ধরন")}</FieldLabel>
              <DoctorTypeSelect
                value={doctorType}
                onChange={setDoctorType}
                lang={lang}
                disabled={profileLocked}
                className={inp + " w-full"}
              />
            </div>
          )}
          {show("mobile") && (
            <div>
              <FieldLabel>{fieldLabel("mobile", "Mobile", "মোবাইল")}</FieldLabel>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={profileLocked} className={inp + " w-full"} inputMode="tel" />
            </div>
          )}
          {show("email") && (
            <div>
              <FieldLabel>{fieldLabel("email", "Email", "ইমেইল")}</FieldLabel>
              <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={profileLocked} className={inp + " w-full"} type="email" />
            </div>
          )}
          {show("specialty") && (
            <div>
              <FieldLabel>{fieldLabel("specialty", "Specialty", "স্পেশালিটি")}</FieldLabel>
              <select value={specId} onChange={(e) => setSpecId(e.target.value)} disabled={profileLocked} className={inp + " w-full"}>
                <option value="">—</option>
                {specs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bn ? s.name_bn : s.name_en}
                  </option>
                ))}
              </select>
            </div>
          )}
          {show("qualifications") && (
            <div className="sm:col-span-2">
              <FieldLabel>{fieldLabel("qualifications", "Qualifications", "যোগ্যতা")}</FieldLabel>
              <input value={qual} onChange={(e) => setQual(e.target.value)} disabled={profileLocked} className={inp + " w-full"} placeholder="MBBS, FCPS…" />
            </div>
          )}

          <div className="sm:col-span-2 border-t pt-2 mt-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              {bn ? "চেম্বার অ্যাফিলিয়েশন" : "Chamber affiliation"}
            </p>
          </div>
          <div>
            <FieldLabel>{bn ? "ফি (৳)" : "Fee (৳)"}</FieldLabel>
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={bn ? "কনসালটেশন ফি" : "Consultation fee"}
              className={inp + " w-full tabular-nums"}
              inputMode="decimal"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>{bn ? "সেকেন্ড ভিজিট ছাড়" : "2nd-visit discount"}</FieldLabel>
            <div className="flex gap-1.5">
              <select
                value={discType}
                onChange={(e) => setDiscType(e.target.value as "percent" | "fixed")}
                className="rounded-xl border px-2 py-2 text-xs font-semibold shrink-0"
              >
                <option value="percent">%</option>
                <option value="fixed">৳</option>
              </select>
              <input
                value={discValue}
                onChange={(e) => setDiscValue(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={
                  bn
                    ? discType === "percent"
                      ? "ছাড় %"
                      : "ছাড় ৳"
                    : discType === "percent"
                      ? "Discount %"
                      : "Discount ৳"
                }
                className={inp + " flex-1 tabular-nums"}
                inputMode="decimal"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {bn
                ? "রোগী «আগেও দেখাইছি» সিলেক্ট করলে ফি থেকে এই ছাড় কাটা হবে।"
                : "Applied when patient selects “Visited before”."}
            </p>
          </div>

          {termsRequired && (
            <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <span>
                {bn ? "আমি " : "I agree to the "}
                <Link to="/terms" className="font-semibold text-primary underline-offset-2 hover:underline">
                  {bn ? "শর্তাবলী" : "Terms & conditions"}
                </Link>
                {bn ? " মেনে নিচ্ছি।" : "."}
              </span>
            </label>
          )}

            <button
              type="button"
              onClick={() => void add()}
              disabled={busy}
              className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold sm:col-span-2 disabled:opacity-50"
            >
              {bn ? "যোগ করুন" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SchedulePanel({ orgId, canEdit, lang }: { orgId: string; canEdit: boolean; lang: "bn" | "en" }) {
  const [affs, setAffs] = useState<{ id: string; label: string }[]>([]);
  const [affId, setAffId] = useState("");
  const [weekday, setWeekday] = useState("0");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("21:00");
  const [max, setMax] = useState("40");
  const [list, setList] = useState<{ id: string; weekday: number; start_time: string; end_time: string; max_serial: number }[]>([]);

  async function reload() {
    const docs = (await fetchOrgDoctors(orgId)) as unknown as {
      id: string;
      care_doctors?: { full_name: string };
      care_locations?: { name: string };
    }[];
    const mapped = docs.map((d) => ({
      id: d.id,
      label: `${d.care_doctors?.full_name ?? ""} · ${d.care_locations?.name ?? ""}`,
    }));
    setAffs(mapped);
    if (!affId && mapped[0]) setAffId(mapped[0].id);
    const sch = await fetchSchedulesForAffiliations(mapped.map((m) => m.id));
    setList(sch);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function add() {
    if (!affId) return;
    const { error } = await supabase.from("care_schedules").insert({
      affiliation_id: affId,
      weekday: Number(weekday),
      start_time: start,
      end_time: end,
      max_serial: Number(max) || 40,
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "শিডিউল যোগ" : "Schedule added");
      await reload();
    }
  }

  async function openToday(scheduleId: string, weekdayN: number) {
    const d = new Date();
    const delta = (weekdayN - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
    const date = d.toISOString().slice(0, 10);
    try {
      const sid = await ensureCareSession(scheduleId, date);
      await setSessionStatus(sid, "open");
      toast.success(lang === "bn" ? "সেশন খোলা" : "Session opened");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="rounded-2xl border p-3 grid gap-2 sm:grid-cols-3">
          <select value={affId} onChange={(e) => setAffId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm sm:col-span-3">
            {affs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </select>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={max} onChange={(e) => setMax(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" placeholder="max" />
          <button type="button" onClick={() => void add()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
            {lang === "bn" ? "শিডিউল যোগ" : "Add schedule"}
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.id} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="flex-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.weekday]} {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)} · max {s.max_serial}
            </span>
            {canEdit && (
              <button type="button" className="text-xs font-semibold" onClick={() => void openToday(s.id, s.weekday)}>
                {lang === "bn" ? "আজ খুলুন" : "Open next"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [members, setMembers] = useState<CareMembership[]>([]);
  const [roles, setRoles] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [phone, setPhone] = useState("");
  const [roleSlug, setRoleSlug] = useState("reception");

  async function reload() {
    const all = await fetchMyCareMemberships();
    void all;
    const { data } = await supabase
      .from("care_org_members")
      .select("id, org_id, user_id, role, role_id, care_org_roles(id, org_id, slug, name, name_bn, is_system, permissions)")
      .eq("org_id", orgId);
    setMembers((data as unknown as CareMembership[]) ?? []);
    const r = await fetchCareOrgRoles(orgId);
    setRoles(r);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function add() {
    try {
      const uid = await findProfileIdByPhone(phone);
      if (!uid) throw new Error(lang === "bn" ? "এই ফোনে অ্যাপ ইউজার নেই" : "No app user for this phone");
      const role = roles.find((r) => r.slug === roleSlug);
      await addCareMember({ orgId, userId: uid, role: roleSlug, roleId: role?.id });
      setPhone("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={phone} onChange={(e) => setPhone(clampPhoneDigits(e.target.value))} placeholder={lang === "bn" ? "ফোন" : "Phone"} className="rounded-xl border px-3 py-2 text-sm" inputMode="tel" maxLength={11} />
        <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          {roles.map((r) => (
            <option key={r.id} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void add()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold inline-flex items-center gap-1">
          <UserPlus className="h-3.5 w-3.5" />
          {lang === "bn" ? "যোগ" : "Add"}
        </button>
      </div>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2">
            <span className="flex-1 truncate">{m.user_id}</span>
            <span className="text-xs text-muted-foreground">{m.care_org_roles?.name || m.role}</span>
            <button type="button" className="text-xs text-destructive" onClick={() => void removeCareMember(m.id).then(reload)}>
              {lang === "bn" ? "সরান" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        {CARE_PERMISSION_FALLBACK.map((p) => p.key).join(", ")}
      </p>
    </div>
  );
}

function SettingsPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [phone, setPhone] = useState("");
  const [kinds, setKinds] = useState<{ id: string; name_en: string; name_bn: string }[]>([]);
  const [kindId, setKindId] = useState("");
  const [locName, setLocName] = useState("");
  const [serial, setSerial] = useState<CareOrgSerialSettings>({});
  const [invoice, setInvoice] = useState<CareOrgInvoiceSettings>({});
  const [invoiceAllowed, setInvoiceAllowed] = useState(true);
  const [effective, setEffective] = useState<EffectiveDeskSerialSettings | null>(null);
  const [platformApproval, setPlatformApproval] = useState(false);
  const [platformManual, setPlatformManual] = useState(true);
  const [platformFields, setPlatformFields] = useState(
    bookingFieldsFromFlags({
      home_collection: false,
      reviews: false,
      payment: false,
      report_vault: false,
      patient_org_chat: true,
      desk_serial_approval: false,
      desk_manual_patient_serial: true,
      desk_allow_org_serial_settings: true,
      desk_allow_org_invoice_settings: true,
      desk_booking_field_name: true,
      desk_booking_field_phone: true,
      desk_booking_field_age: true,
      desk_booking_field_address: true,
    }),
  );

  useEffect(() => {
    void supabase
      .from("care_orgs")
      .select("name, name_bn, phone, org_kind_id, settings")
      .eq("id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const r = data as {
          name: string;
          name_bn: string | null;
          phone: string | null;
          org_kind_id: string | null;
          settings?: unknown;
        };
        setName(r.name);
        setNameBn(r.name_bn ?? "");
        setPhone(r.phone ?? "");
        setKindId(r.org_kind_id ?? "");
        const parsed = parseOrgSettings(r.settings);
        setSerial(parsed.serial ?? {});
        setInvoice(parsed.invoice ?? {});
      });
    void fetchCareVendorTypes().then(setKinds);
    void fetchCarePolicies().then((r) => {
      setPlatformApproval(r.flags.desk_serial_approval);
      setPlatformManual(r.flags.desk_manual_patient_serial);
      setPlatformFields(bookingFieldsFromFlags(r.flags));
      setInvoiceAllowed(r.flags.desk_allow_org_invoice_settings !== false);
    });
    void fetchEffectiveDeskSerialSettings(orgId).then(setEffective);
  }, [orgId]);

  async function save() {
    const { error } = await supabase
      .from("care_orgs")
      .update({ name, name_bn: nameBn || null, phone: phone || null, org_kind_id: kindId || null } as never)
      .eq("id", orgId);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
  }

  async function saveSerial() {
    try {
      const existing = await fetchOrgSettings(orgId);
      await saveOrgSerialSettings(orgId, serial, existing);
      setEffective(await fetchEffectiveDeskSerialSettings(orgId));
      toast.success(lang === "bn" ? "সিরিয়াল সেটিংস সেভ" : "Serial settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveInvoice() {
    try {
      const existing = await fetchOrgSettings(orgId);
      await saveOrgInvoiceSettings(orgId, invoice, existing);
      toast.success(lang === "bn" ? "ইনভয়েস লেটারহেড সেভ" : "Invoice letterhead saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addLocation() {
    if (!locName.trim()) return;
    const { error } = await supabase.from("care_locations").insert({ org_id: orgId, name: locName.trim() } as never);
    if (error) toast.error(error.message);
    else {
      setLocName("");
      toast.success(lang === "bn" ? "লোকেশন যোগ" : "Location added");
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "প্রতিষ্ঠান" : "Organization"}
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
        <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="বাংলা নাম" />
        <input value={phone} onChange={(e) => setPhone(clampPhoneDigits(e.target.value))} className="w-full rounded-xl border px-3 py-2 text-sm" inputMode="tel" maxLength={11} />
        <select value={kindId} onChange={(e) => setKindId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {lang === "bn" ? k.name_bn : k.name_en}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void save()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
          {lang === "bn" ? "সেভ" : "Save"}
        </button>
        <div className="flex gap-2">
          <input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder={lang === "bn" ? "নতুন চেম্বার/ব্রাঞ্চ" : "New location"} className="flex-1 rounded-xl border px-3 py-2 text-sm" />
          <button type="button" onClick={() => void addLocation()} className="rounded-xl border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {lang === "bn" ? "যোগ" : "Add"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "সিরিয়াল ও ডেস্ক" : "Serial & desk"}
        </p>
        {effective && !effective.orgCanEdit && (
          <p className="text-[11px] text-amber-700">
            {lang === "bn"
              ? "অ্যাডমিন চেম্বার-লেভেল সিরিয়াল সেটিংস বন্ধ করেছে — শুধু প্ল্যাটফর্ম ডিফল্ট চলবে।"
              : "Admin disabled chamber-level serial settings — platform defaults apply."}
          </p>
        )}
        <CareSerialSettingsForm
          lang={lang}
          value={serial}
          onChange={setSerial}
          disabled={!effective?.orgCanEdit}
          platformApproval={platformApproval}
          platformManual={platformManual}
          platformFields={platformFields}
        />
        {effective?.orgCanEdit && (
          <button
            type="button"
            onClick={() => void saveSerial()}
            className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold"
          >
            {lang === "bn" ? "সিরিয়াল সেটিংস সেভ" : "Save serial settings"}
          </button>
        )}
        {effective && (
          <p className="text-[10px] text-muted-foreground">
            {lang === "bn" ? "এখন চলছে" : "Active now"}:{" "}
            {effective.desk_serial_approval
              ? lang === "bn"
                ? "ডেস্ক অ্যাপ্রুভাল"
                : "desk approval"
              : lang === "bn"
                ? "অটো অ্যাপ্রুভ"
                : "auto approve"}
            {" · "}
            {effective.manual_patient_serial
              ? lang === "bn"
                ? "ম্যানুয়াল সিরিয়াল চালু"
                : "manual serial on"
              : lang === "bn"
                ? "ম্যানুয়াল সিরিয়াল বন্ধ"
                : "manual serial off"}
          </p>
        )}
      </div>

      {invoiceAllowed && (
        <div className="space-y-2">
          <CareInvoiceLetterheadForm lang={lang} value={invoice} onChange={setInvoice} />
          <button
            type="button"
            onClick={() => void saveInvoice()}
            className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold"
          >
            {lang === "bn" ? "ইনভয়েস লেটারহেড সেভ" : "Save invoice letterhead"}
          </button>
        </div>
      )}
    </div>
  );
}
