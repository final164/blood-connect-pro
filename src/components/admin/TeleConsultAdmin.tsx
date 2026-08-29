import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchCareSpecialties, type CareSpecialty } from "@/lib/care-cms";
import {
  DEFAULT_TELE_SETTINGS,
  deleteTeleFormulary,
  deleteTeleOfferCard,
  fetchTeleFormulary,
  fetchTeleOfferCards,
  fetchTeleSettings,
  saveTeleSettings,
  upsertTeleFormulary,
  upsertTeleOfferCard,
  type TeleFormularyItem,
  type TeleOfferCard,
  type TeleSettings,
} from "@/lib/tele-cms";
import {
  fetchAllTeleBookingsAdmin,
  searchTeleDoctors,
  setTelePayment,
  setTeleStatus,
  upsertTeleDoctorProfile,
  adminLinkTeleDoctor,
  type TeleBooking,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import { TeleScheduleEditor } from "@/components/care/tele/TeleScheduleEditor";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type Sub = "settings" | "offers" | "doctors" | "formulary" | "bookings" | "gemini";

export function TeleConsultAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const canEdit = can("care.edit");
  const [sub, setSub] = useState<Sub>("settings");
  const bn = lang === "bn";

  const tabs: { id: Sub; bn: string; en: string }[] = [
    { id: "settings", bn: "সেটিংস / ফ্ল্যাগ", en: "Settings / flags" },
    { id: "offers", bn: "অফার কার্ড", en: "Offer cards" },
    { id: "doctors", bn: "ভিডিও ডাক্তার", en: "Video doctors" },
    { id: "formulary", bn: "ফর্মুয়ারি", en: "Formulary" },
    { id: "bookings", bn: "বুকিং অপস", en: "Bookings ops" },
    { id: "gemini", bn: "Gemini টেলি প্রম্পট", en: "Gemini tele prompts" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {bn
          ? "ভিডিও কনসালটেশন CMS — অফার, ফি, ফ্ল্যাগ, ফর্মুয়ারি কোডে হার্ডকোড নয়। Zoom সিক্রেট Edge Secrets-এ।"
          : "Video consult CMS — offers, fees, flags, formulary are not hardcoded. Zoom secrets live in Edge Secrets."}
      </p>
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              sub === t.id ? "bg-rose-600 text-white" : "border border-slate-700 text-slate-300"
            }`}
          >
            {bn ? t.bn : t.en}
          </button>
        ))}
      </div>
      {sub === "settings" && <SettingsPanel canEdit={canEdit} bn={bn} />}
      {sub === "offers" && <OffersPanel canEdit={canEdit} bn={bn} />}
      {sub === "doctors" && <DoctorsPanel canEdit={canEdit} bn={bn} />}
      {sub === "formulary" && <FormularyPanel canEdit={canEdit} bn={bn} />}
      {sub === "bookings" && <BookingsPanel canEdit={canEdit} bn={bn} />}
      {sub === "gemini" && <GeminiTelePanel canEdit={canEdit} bn={bn} />}
    </div>
  );
}

function SettingsPanel({ canEdit, bn }: { canEdit: boolean; bn: boolean }) {
  const [s, setS] = useState<TeleSettings>(DEFAULT_TELE_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTeleSettings().then(setS).catch(() => undefined);
  }, []);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await saveTeleSettings(s);
      toast.success(bn ? "সেভ হয়েছে" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
        {(
          [
            ["tele_enabled", "Video enabled"],
            ["instant_enabled", "Instant pool"],
            ["require_payment_before_join", "Pay before join"],
            ["ai_summary_enabled", "AI summary"],
            ["consultant_can_edit_schedule", "Consultant can edit schedule"],
            ["require_slot_for_named", "Require slot for named booking"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!s[key]}
              disabled={!canEdit}
              onChange={(e) => setS({ ...s, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Join window (min)">
          <input
            className={ainp}
            type="number"
            value={s.join_window_minutes}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, join_window_minutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Default duration (min)">
          <input
            className={ainp}
            type="number"
            value={s.default_duration_minutes}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, default_duration_minutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Default slot minutes">
          <input
            className={ainp}
            type="number"
            value={s.default_slot_minutes}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, default_slot_minutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Slot horizon (days)">
          <input
            className={ainp}
            type="number"
            value={s.slot_horizon_days}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, slot_horizon_days: Number(e.target.value) })}
          />
        </Field>
        <Field label="VAT % (blank = invoice default)">
          <input
            className={ainp}
            type="number"
            value={s.vat_percent ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setS({ ...s, vat_percent: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Transcript retention days">
          <input
            className={ainp}
            type="number"
            value={s.transcript_retention_days}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, transcript_retention_days: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label={bn ? "ট্রাস্ট বুলেট (BN, লাইনপ্রতি)" : "Trust bullets BN"}>
        <textarea
          className={ainp}
          rows={3}
          value={s.trust_bullets_bn.join("\n")}
          disabled={!canEdit}
          onChange={(e) =>
            setS({ ...s, trust_bullets_bn: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })
          }
        />
      </Field>
      <Field label="Hub title BN / EN">
        <div className="grid grid-cols-2 gap-2">
          <input
            className={ainp}
            value={s.ui.hub_title_bn}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, ui: { ...s.ui, hub_title_bn: e.target.value } })}
          />
          <input
            className={ainp}
            value={s.ui.hub_title_en}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, ui: { ...s.ui, hub_title_en: e.target.value } })}
          />
        </div>
      </Field>
      <div className="rounded-lg border border-slate-700 p-2 space-y-2 text-[11px] text-slate-300">
        <p className="font-semibold text-slate-200">{bn ? "ইনস্ট্যান্ট অ্যাসাইন রুল" : "Instant assign rules"}</p>
        {(
          [
            ["prefer_online", "Prefer online"],
            ["prefer_rating", "Prefer higher rating"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!s.instant_assign[key]}
              disabled={!canEdit}
              onChange={(e) =>
                setS({ ...s, instant_assign: { ...s.instant_assign, [key]: e.target.checked } })
              }
            />
            {label}
          </label>
        ))}
        <Field label="Max wait (minutes)">
          <input
            className={ainp}
            type="number"
            value={s.instant_assign.max_wait_minutes}
            disabled={!canEdit}
            onChange={(e) =>
              setS({
                ...s,
                instant_assign: { ...s.instant_assign, max_wait_minutes: Number(e.target.value) },
              })
            }
          />
        </Field>
      </div>
      <div className="rounded-lg border border-slate-700 p-2 space-y-2 text-[11px] text-slate-300">
        <p className="font-semibold text-slate-200">Zoom policies</p>
        {(
          [
            ["waiting_room", "Waiting room"],
            ["auto_recording", "Auto cloud recording"],
            ["auto_transcript", "Auto transcript"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!s.zoom[key]}
              disabled={!canEdit}
              onChange={(e) => setS({ ...s, zoom: { ...s.zoom, [key]: e.target.checked } })}
            />
            {label}
          </label>
        ))}
        <p className="text-slate-400 pt-1">
          Zoom S2S secrets: <code className="text-slate-300">ZOOM_ACCOUNT_ID</code>,{" "}
          <code className="text-slate-300">ZOOM_CLIENT_ID</code>,{" "}
          <code className="text-slate-300">ZOOM_CLIENT_SECRET</code>,{" "}
          <code className="text-slate-300">ZOOM_WEBHOOK_SECRET</code>
        </p>
        <label className="flex items-center gap-2 text-slate-200">
          <input
            type="checkbox"
            checked={s.zoom.configured}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, zoom: { ...s.zoom, configured: e.target.checked } })}
          />
          Zoom configured
        </label>
      </div>
      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Save className="h-3.5 w-3.5" /> {bn ? "সেভ" : "Save"}
        </button>
      )}
    </div>
  );
}

function OffersPanel({ canEdit, bn }: { canEdit: boolean; bn: boolean }) {
  const [rows, setRows] = useState<TeleOfferCard[]>([]);
  const [specs, setSpecs] = useState<CareSpecialty[]>([]);

  async function reload() {
    const [o, sp] = await Promise.all([fetchTeleOfferCards(false), fetchCareSpecialties()]);
    setRows(o);
    setSpecs(sp);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  async function add() {
    const slug = `offer-${Date.now()}`;
    await upsertTeleOfferCard({
      slug,
      title_bn: "নতুন অফার",
      title_en: "New offer",
      sale_price: 199,
      list_price: 299,
      mode: "instant",
      is_active: true,
      sort_order: (rows.length + 1) * 10,
    });
    await reload();
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <button type="button" onClick={() => void add()} className="inline-flex items-center gap-1 text-xs text-rose-400">
          <Plus className="h-3.5 w-3.5" /> {bn ? "অফার যোগ" : "Add offer"}
        </button>
      )}
      {rows.map((r) => (
        <div key={r.id} className="grid gap-2 rounded-xl border border-slate-800 p-2 sm:grid-cols-6">
          <input
            className={ainp}
            value={r.title_bn}
            disabled={!canEdit}
            onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, title_bn: e.target.value } : x)))}
          />
          <input
            className={ainp}
            value={r.title_en}
            disabled={!canEdit}
            onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, title_en: e.target.value } : x)))}
          />
          <input
            className={ainp}
            type="number"
            value={r.sale_price}
            disabled={!canEdit}
            onChange={(e) =>
              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, sale_price: Number(e.target.value) } : x)))
            }
          />
          <select
            className={ainp}
            value={r.specialty_id ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((x) => (x.id === r.id ? { ...x, specialty_id: e.target.value || null } : x)),
              )
            }
          >
            <option value="">Specialty</option>
            {specs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_en}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={r.is_active}
              disabled={!canEdit}
              onChange={(e) =>
                setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: e.target.checked } : x)))
              }
            />
            Active
          </label>
          {canEdit && (
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded bg-rose-600 px-2 py-1 text-[10px] text-white"
                onClick={() =>
                  void upsertTeleOfferCard(r)
                    .then(() => toast.success("Saved"))
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Save
              </button>
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300"
                onClick={() =>
                  void deleteTeleOfferCard(r.id)
                    .then(reload)
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DoctorsPanel({ canEdit, bn }: { canEdit: boolean; bn: boolean }) {
  const [docs, setDocs] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [video, setVideo] = useState<TeleVideoDoctor[]>([]);
  const [pick, setPick] = useState("");
  const [linkUserByDoctor, setLinkUserByDoctor] = useState<Record<string, string>>({});

  async function reload() {
    const [{ data }, v] = await Promise.all([
      supabase
        .from("care_doctors")
        .select("id, full_name, user_id")
        .eq("is_active", true)
        .order("full_name")
        .limit(300),
      searchTeleDoctors({}),
    ]);
    setDocs((data ?? []) as { id: string; full_name: string; user_id: string | null }[]);
    setVideo(v);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  async function enable() {
    if (!pick || !canEdit) return;
    await upsertTeleDoctorProfile({
      doctor_id: pick,
      video_enabled: true,
      fee_amount: 650,
      is_popular: false,
      instant_enabled: false,
    });
    setPick("");
    await reload();
    toast.success(bn ? "ভিডিও চালু" : "Video enabled");
  }

  async function linkUser(doctorId: string) {
    const raw = (linkUserByDoctor[doctorId] || "").trim();
    if (!raw) {
      toast.error(bn ? "User UUID দিন" : "Enter user UUID");
      return;
    }
    try {
      await adminLinkTeleDoctor(doctorId, raw);
      toast.success(bn ? "ইউজার লিংক হয়েছে" : "User linked");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">
        {bn
          ? "কনসালট্যান্ট ডেস্কের জন্য care_doctors.user_id লিংক করুন (profiles.id / auth user UUID)।"
          : "Link care_doctors.user_id (profiles.id / auth UUID) for the consultant desk."}
      </p>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <select className={`${ainp} max-w-xs`} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{bn ? "ডাক্তার বেছে নিন" : "Pick doctor"}</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void enable()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white">
            {bn ? "ভিডিও চালু করুন" : "Enable video"}
          </button>
        </div>
      )}
      {video.map((d) => {
        const linked = docs.find((x) => x.id === d.doctor_id)?.user_id ?? null;
        return (
        <div key={d.doctor_id} className="grid gap-2 rounded-xl border border-slate-800 p-2 sm:grid-cols-5">
          <div className="text-xs text-slate-100 sm:col-span-2">
            <p className="font-semibold">{d.full_name}</p>
            <p className="text-slate-400">{bn ? d.specialty_name_bn : d.specialty_name_en}</p>
            <p className={`mt-1 text-[10px] ${linked ? "text-emerald-400" : "text-amber-400"}`}>
              {linked ? `Linked: ${linked.slice(0, 8)}…` : bn ? "ইউজার লিংক নেই" : "No user linked"}
            </p>
          </div>
          <input
            className={ainp}
            type="number"
            value={d.fee_amount ?? 0}
            disabled={!canEdit}
            onChange={(e) =>
              setVideo((prev) =>
                prev.map((x) => (x.doctor_id === d.doctor_id ? { ...x, fee_amount: Number(e.target.value) } : x)),
              )
            }
          />
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
            {(
              [
                ["video_enabled", "Video"],
                ["instant_enabled", "Instant"],
                ["is_popular", "Popular"],
                ["is_online", "Online"],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!d[k]}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setVideo((prev) =>
                      prev.map((x) => (x.doctor_id === d.doctor_id ? { ...x, [k]: e.target.checked } : x)),
                    )
                  }
                />
                {lab}
              </label>
            ))}
          </div>
          {canEdit && (
            <button
              type="button"
              className="rounded bg-rose-600 px-2 py-1 text-[10px] text-white"
              onClick={() =>
                void upsertTeleDoctorProfile({
                  doctor_id: d.doctor_id,
                  video_enabled: d.video_enabled,
                  instant_enabled: d.instant_enabled,
                  is_popular: d.is_popular,
                  is_online: d.is_online,
                  fee_amount: d.fee_amount,
                  about_bn: d.about_bn,
                  about_en: d.about_en,
                  experience_years: d.experience_years,
                  workplace_bn: d.workplace_bn,
                  workplace_en: d.workplace_en,
                })
                  .then(() => toast.success("Saved"))
                  .catch((e) => toast.error((e as Error).message))
              }
            >
              Save
            </button>
          )}
          {canEdit && (
            <div className="sm:col-span-5 flex flex-wrap gap-2 items-center">
              <input
                className={`${ainp} flex-1 min-w-48`}
                placeholder="User UUID (profiles.id)"
                value={linkUserByDoctor[d.doctor_id] ?? ""}
                onChange={(e) =>
                  setLinkUserByDoctor((prev) => ({ ...prev, [d.doctor_id]: e.target.value }))
                }
              />
              <button
                type="button"
                className="rounded border border-sky-600 px-2 py-1 text-[10px] text-sky-300"
                onClick={() => void linkUser(d.doctor_id)}
              >
                {bn ? "ইউজার লিংক" : "Link user"}
              </button>
            </div>
          )}
          {canEdit && (
            <div className="sm:col-span-5">
              <TeleScheduleEditor
                doctorId={d.doctor_id}
                bn={bn}
                canEdit={canEdit}
                variant="dark"
                profile={{
                  slot_minutes: d.slot_minutes ?? 15,
                  schedule_public: d.schedule_public !== false,
                }}
              />
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function FormularyPanel({ canEdit, bn }: { canEdit: boolean; bn: boolean }) {
  const [rows, setRows] = useState<TeleFormularyItem[]>([]);

  async function reload() {
    setRows(await fetchTeleFormulary(false));
  }
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-2">
      {canEdit && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-rose-400"
          onClick={() =>
            void upsertTeleFormulary({
              kind: "medicine",
              name_bn: "নতুন",
              name_en: "New item",
              is_active: true,
              sort_order: 99,
            })
              .then(reload)
              .catch((e) => toast.error((e as Error).message))
          }
        >
          <Plus className="h-3.5 w-3.5" /> {bn ? "আইটেম" : "Item"}
        </button>
      )}
      {rows.map((r) => (
        <div key={r.id} className="grid gap-2 rounded-xl border border-slate-800 p-2 sm:grid-cols-5">
          <select
            className={ainp}
            value={r.kind}
            disabled={!canEdit}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((x) =>
                  x.id === r.id ? { ...x, kind: e.target.value as TeleFormularyItem["kind"] } : x,
                ),
              )
            }
          >
            <option value="medicine">medicine</option>
            <option value="test">test</option>
            <option value="advice">advice</option>
          </select>
          <input
            className={ainp}
            value={r.name_bn}
            disabled={!canEdit}
            onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name_bn: e.target.value } : x)))}
          />
          <input
            className={ainp}
            value={r.name_en}
            disabled={!canEdit}
            onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name_en: e.target.value } : x)))}
          />
          <input
            className={ainp}
            placeholder="dose"
            value={r.default_dose ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, default_dose: e.target.value } : x)))
            }
          />
          {canEdit && (
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded bg-rose-600 px-2 py-1 text-[10px] text-white"
                onClick={() =>
                  void upsertTeleFormulary(r)
                    .then(() => toast.success("Saved"))
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Save
              </button>
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-1 text-[10px]"
                onClick={() => void deleteTeleFormulary(r.id).then(reload)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BookingsPanel({ canEdit, bn }: { canEdit: boolean; bn: boolean }) {
  const [rows, setRows] = useState<TeleBooking[]>([]);
  useEffect(() => {
    void fetchAllTeleBookingsAdmin().then(setRows).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-slate-500">{bn ? "কোনো বুকিং নেই" : "No bookings"}</p>}
      {rows.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 p-2 text-[11px] text-slate-200">
          <span className="font-mono text-slate-500">{b.id.slice(0, 8)}</span>
          <span>{b.mode}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5">{b.status}</span>
          <span>{b.payment_status}</span>
          <span>৳{b.net_amount}</span>
          {canEdit && (
            <>
              <button
                type="button"
                className="rounded bg-emerald-700 px-2 py-0.5 text-white"
                onClick={() =>
                  void setTelePayment(b.id, "paid")
                    .then((r) => setRows((prev) => prev.map((x) => (x.id === r.id ? r : x))))
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Mark paid
              </button>
              <button
                type="button"
                className="rounded border border-slate-600 px-2 py-0.5"
                onClick={() =>
                  void setTeleStatus(b.id, "completed")
                    .then((r) => setRows((prev) => prev.map((x) => (x.id === r.id ? r : x))))
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Complete
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function GeminiTelePanel({ canEdit, bn }: { canEdit: boolean; bn: boolean }) {
  const [bnPrompt, setBnPrompt] = useState("");
  const [enPrompt, setEnPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("app_settings")
      .select("gemini_settings")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const g = (data as { gemini_settings?: Record<string, string> } | null)?.gemini_settings ?? {};
        setBnPrompt(g.prompt_tele_summary_bn ?? "");
        setEnPrompt(g.prompt_tele_summary_en ?? "");
      });
  }, []);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      const { data } = await supabase.from("app_settings").select("gemini_settings").eq("id", 1).maybeSingle();
      const prev = ((data as { gemini_settings?: object } | null)?.gemini_settings ?? {}) as Record<string, unknown>;
      const { error } = await supabase.from("app_settings").upsert({
        id: 1,
        gemini_settings: {
          ...prev,
          prompt_tele_summary_bn: bnPrompt,
          prompt_tele_summary_en: enPrompt,
        },
      } as never);
      if (error) throw error;
      toast.success(bn ? "সেভ" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="prompt_tele_summary_bn (use {{transcript}})">
        <textarea className={ainp} rows={8} value={bnPrompt} disabled={!canEdit} onChange={(e) => setBnPrompt(e.target.value)} />
      </Field>
      <Field label="prompt_tele_summary_en">
        <textarea className={ainp} rows={8} value={enPrompt} disabled={!canEdit} onChange={(e) => setEnPrompt(e.target.value)} />
      </Field>
      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Save className="h-3.5 w-3.5" /> Save prompts
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
