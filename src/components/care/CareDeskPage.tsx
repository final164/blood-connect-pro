import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  LogOut,
  Stethoscope,
  UserPlus,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
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
import { fetchCareSpecialties, fetchCareVendorTypes } from "@/lib/care-cms";
import {
  callNextSerial,
  ensureCareSession,
  fetchOrgDoctors,
  fetchOrgLocations,
  fetchOrgSessions,
  fetchSchedulesForAffiliations,
  fetchSessionQueue,
  issueCareSerial,
  setSerialStatus,
  setSessionStatus,
  subscribeSession,
  type CareSerialRow,
  type CareSessionRow,
} from "@/lib/care-api";
import { supabase } from "@/integrations/supabase/client";
import { findProfileIdByPhone } from "@/lib/find-profile-by-phone";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { CareSerialInvoiceCard } from "@/components/care/CareSerialInvoice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeskTab = "queue" | "doctors" | "schedule" | "staff" | "settings";

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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: authPath });
      return;
    }
    void fetchMyCareMemberships()
      .then((rows) => {
        const active = rows.filter((r) => r.care_orgs?.is_active !== false);
        if (!active.length) {
          toast.error(lang === "bn" ? "চেম্বার মেম্বারশিপ নেই" : "No chamber membership");
          void navigate({ to: portalMode ? "/care/auth" : "/care" });
          return;
        }
        setMemberships(active);
        setOrgId((prev) => prev ?? active[0]!.org_id);
        setReady(true);
      })
      .catch((e) => {
        toast.error((e as Error).message);
        void navigate({ to: portalMode ? "/care/auth" : "/care" });
      });
  }, [loading, user, navigate, lang, authPath, portalMode]);

  async function handleSignOut() {
    await signOut();
    void navigate({ to: authPath });
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
    { id: "doctors", label: lang === "bn" ? "ডাক্তার" : "Doctors", show: can("doctors.manage") || can("queue.view") },
    { id: "schedule", label: lang === "bn" ? "শিডিউল" : "Schedule", show: can("schedule.manage") || can("queue.view") },
    { id: "staff", label: lang === "bn" ? "স্টাফ" : "Staff", show: can("staff.manage") },
    { id: "settings", label: lang === "bn" ? "সেটিংস" : "Settings", show: can("settings.edit") },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
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
  const [date, setDate] = useState(todayIso());
  const [sessions, setSessions] = useState<CareSessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<CareSerialRow[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [docs, setDocs] = useState<{ id: string; full_name: string }[]>([]);
  const [invoiceSerialId, setInvoiceSerialId] = useState<string | null>(null);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);

  async function reload() {
    const list = await fetchOrgSessions(orgId, date);
    setSessions(list);
    setSessionId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null));
  }

  useEffect(() => {
    void reload();
    void fetchOrgDoctors(orgId).then((rows) => {
      setDocs(
        (rows as unknown as { care_doctors?: { id: string; full_name: string } | null }[])
          .map((r) => r.care_doctors)
          .filter(Boolean) as { id: string; full_name: string }[],
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, date]);

  useEffect(() => {
    if (!sessionId) {
      setQueue([]);
      return;
    }
    void fetchSessionQueue(sessionId).then(setQueue);
    return subscribeSession(sessionId, () => {
      void fetchSessionQueue(sessionId).then(setQueue);
      void reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const sess = sessions.find((s) => s.id === sessionId) ?? null;

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
      if (sessionId) setQueue(await fetchSessionQueue(sessionId));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        <select
          value={sessionId ?? ""}
          onChange={(e) => setSessionId(e.target.value || null)}
          className="rounded-xl border px-3 py-2 text-sm min-w-40"
        >
          {sessions.length === 0 && <option value="">{lang === "bn" ? "সেশন নেই" : "No session"}</option>}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {docs.find((d) => d.id === s.doctor_id)?.full_name ?? s.doctor_id.slice(0, 6)} · {s.status} · {s.last_issued}/{s.max_serial}
            </option>
          ))}
        </select>
      </div>
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
      {sess && canIssue && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const ticket = await issueCareSerial({
                sessionId: sess.id,
                source: "walk_in",
                guestName: guestName || undefined,
                guestPhone: guestPhone || undefined,
              });
              setGuestName("");
              setGuestPhone("");
              setAutoPrintInvoice(true);
              setInvoiceSerialId(ticket.id);
              toast.success(lang === "bn" ? `সিরিয়াল ${ticket.serial_no} · ইনভয়েস তৈরি` : `Serial ${ticket.serial_no} · Invoice ready`);
            });
          }}
        >
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={lang === "bn" ? "নাম" : "Name"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={guestPhone} onChange={(e) => setGuestPhone(clampPhoneDigits(e.target.value))} placeholder={lang === "bn" ? "ফোন" : "Phone"} className="rounded-xl border px-3 py-2 text-sm" inputMode="tel" maxLength={11} />
          <button type="submit" className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
            {lang === "bn" ? "ওয়াক-ইন সিরিয়াল" : "Walk-in serial"}
          </button>
        </form>
      )}
      <ul className="divide-y rounded-2xl border bg-card">
        {queue.map((t) => (
          <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="font-black tabular-nums w-8">{t.serial_no}</span>
            <span className="flex-1 truncate">{t.guest_name || t.guest_phone || t.patient_id?.slice(0, 8) || "—"}</span>
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
        {queue.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">{lang === "bn" ? "কিউ খালি" : "Queue empty"}</li>}
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
  const [rows, setRows] = useState<unknown[]>([]);
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [specs, setSpecs] = useState<{ id: string; name_en: string; name_bn: string }[]>([]);
  const [name, setName] = useState("");
  const [bmdc, setBmdc] = useState("");
  const [specId, setSpecId] = useState("");
  const [locId, setLocId] = useState("");
  const [fee, setFee] = useState("");

  async function reload() {
    setRows(await fetchOrgDoctors(orgId));
    const locations = (await fetchOrgLocations(orgId)) as { id: string; name: string }[];
    setLocs(locations);
    if (!locId && locations[0]) setLocId(locations[0].id);
  }

  useEffect(() => {
    void reload();
    void fetchCareSpecialties().then(setSpecs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function add() {
    if (!name.trim() || !locId) return;
    try {
      const { data: doc, error } = await supabase
        .from("care_doctors")
        .insert({ full_name: name.trim(), bmdc_no: bmdc || null, specialty_id: specId || null } as never)
        .select("id")
        .single();
      if (error) throw error;
      const { error: aErr } = await supabase.from("care_affiliations").insert({
        org_id: orgId,
        doctor_id: (doc as { id: string }).id,
        location_id: locId,
        fee_amount: fee ? Number(fee) : null,
      } as never);
      if (aErr) throw aErr;
      setName("");
      setBmdc("");
      setFee("");
      await reload();
      toast.success(lang === "bn" ? "যোগ হয়েছে" : "Added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="rounded-2xl border p-3 grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "bn" ? "ডাক্তারের নাম" : "Doctor name"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={bmdc} onChange={(e) => setBmdc(e.target.value)} placeholder="BMDC" className="rounded-xl border px-3 py-2 text-sm" />
          <select value={specId} onChange={(e) => setSpecId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">{lang === "bn" ? "স্পেশালিটি" : "Specialty"}</option>
            {specs.map((s) => (
              <option key={s.id} value={s.id}>
                {lang === "bn" ? s.name_bn : s.name_en}
              </option>
            ))}
          </select>
          <select value={locId} onChange={(e) => setLocId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <input value={fee} onChange={(e) => setFee(e.target.value)} placeholder={lang === "bn" ? "ফি" : "Fee"} className="rounded-xl border px-3 py-2 text-sm" />
          <button type="button" onClick={() => void add()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
            {lang === "bn" ? "ডাক্তার যোগ" : "Add doctor"}
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {(rows as { id: string; care_doctors?: { full_name: string; bmdc_no?: string }; care_locations?: { name: string }; fee_amount?: number }[]).map((r) => (
          <li key={r.id} className="rounded-xl border bg-card px-3 py-2 text-sm flex gap-2">
            <Stethoscope className="h-4 w-4 text-primary mt-0.5" />
            <span className="flex-1">
              {r.care_doctors?.full_name} · {r.care_locations?.name}
              {r.care_doctors?.bmdc_no ? ` · BMDC ${r.care_doctors.bmdc_no}` : ""}
            </span>
          </li>
        ))}
      </ul>
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

  useEffect(() => {
    void supabase
      .from("care_orgs")
      .select("name, name_bn, phone, org_kind_id")
      .eq("id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const r = data as { name: string; name_bn: string | null; phone: string | null; org_kind_id: string | null };
        setName(r.name);
        setNameBn(r.name_bn ?? "");
        setPhone(r.phone ?? "");
        setKindId(r.org_kind_id ?? "");
      });
    void fetchCareVendorTypes().then(setKinds);
  }, [orgId]);

  async function save() {
    const { error } = await supabase
      .from("care_orgs")
      .update({ name, name_bn: nameBn || null, phone: phone || null, org_kind_id: kindId || null } as never)
      .eq("id", orgId);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
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
    <div className="space-y-3 max-w-lg">
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
  );
}
