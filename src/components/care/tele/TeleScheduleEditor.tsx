import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTeleDoctorSlots,
  replaceTeleDoctorSlots,
  upsertTeleDoctorProfile,
  WEEKDAY_LABELS,
} from "@/lib/tele-api";
import type { TeleDoctorProfile, TeleDoctorSlot } from "@/lib/tele-cms";
import { buildDaySchedules, summarizeWindows } from "@/lib/tele-slots";

const field =
  "w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-500/40";

type Props = {
  doctorId: string;
  bn: boolean;
  canEdit: boolean;
  /** When provided, also edits slot_minutes / schedule_public */
  profile?: Pick<TeleDoctorProfile, "slot_minutes" | "schedule_public"> | null;
  onProfileSaved?: () => void;
  variant?: "light" | "dark";
};

export function TeleScheduleEditor({
  doctorId,
  bn,
  canEdit,
  profile,
  onProfileSaved,
  variant = "light",
}: Props) {
  const [slots, setSlots] = useState<{ weekday: number; start_time: string; end_time: string }[]>([]);
  const [slotMinutes, setSlotMinutes] = useState(profile?.slot_minutes ?? 15);
  const [schedulePublic, setSchedulePublic] = useState(profile?.schedule_public !== false);
  const [busy, setBusy] = useState(false);

  const ainp = variant === "dark" ? `${field} border-slate-700 bg-slate-950 text-slate-100` : field;

  async function reload() {
    const rows: TeleDoctorSlot[] = await fetchTeleDoctorSlots(doctorId);
    setSlots(rows.map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time })));
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [doctorId]);

  useEffect(() => {
    if (profile) {
      setSlotMinutes(profile.slot_minutes ?? 15);
      setSchedulePublic(profile.schedule_public !== false);
    }
  }, [profile?.slot_minutes, profile?.schedule_public]);

  const preview = useMemo(() => {
    const fakeWindows = slots.map((s, i) => ({
      id: String(i),
      doctor_id: doctorId,
      weekday: s.weekday,
      start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
      end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
      is_active: true,
    }));
    const days = buildDaySchedules({
      windows: fakeWindows,
      slotMinutes,
      horizonDays: 1,
      bookedStarts: [],
    });
    const today = days[0];
    const avail = today?.slots.filter((s) => s.status === "available").slice(0, 3) ?? [];
    return {
      summary: summarizeWindows(fakeWindows, bn ? "bn" : "en"),
      todayCount: today?.slots.filter((s) => s.status === "available").length ?? 0,
      samples: avail.map((s) => s.label),
    };
  }, [slots, slotMinutes, doctorId, bn]);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await replaceTeleDoctorSlots(
        doctorId,
        slots.map((s) => ({
          weekday: s.weekday,
          start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
          end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
        })),
      );
      if (profile !== undefined) {
        try {
          await upsertTeleDoctorProfile({
            doctor_id: doctorId,
            slot_minutes: slotMinutes,
            schedule_public: schedulePublic,
          });
          onProfileSaved?.();
        } catch (e) {
          console.warn(e);
          toast.message(
            bn
              ? "উইন্ডো সেভ হয়েছে; slot_minutes কলাম নেই — মাইগ্রেশন চালান"
              : "Windows saved; apply migration for slot_minutes",
          );
        }
      }
      toast.success(bn ? "শিডিউল সেভ হয়েছে" : "Schedule saved");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-3 rounded-xl border p-3 ${variant === "dark" ? "border-slate-700" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs font-bold ${variant === "dark" ? "text-slate-100" : ""}`}>
          {bn ? "সাপ্তাহিক শিডিউল" : "Weekly schedule"}
        </p>
        {canEdit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
          >
            {bn ? "সেভ" : "Save"}
          </button>
        )}
      </div>

      {profile !== undefined && (
        <div className="grid grid-cols-2 gap-2">
          <label className={`text-[10px] space-y-1 ${variant === "dark" ? "text-slate-300" : "text-muted-foreground"}`}>
            {bn ? "স্লট ইন্টারভাল (মিনিট)" : "Slot interval (min)"}
            <input
              className={ainp}
              type="number"
              min={5}
              max={60}
              disabled={!canEdit}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value) || 15)}
            />
          </label>
          <label
            className={`flex items-end gap-2 text-[11px] pb-1.5 ${variant === "dark" ? "text-slate-300" : ""}`}
          >
            <input
              type="checkbox"
              checked={schedulePublic}
              disabled={!canEdit}
              onChange={(e) => setSchedulePublic(e.target.checked)}
            />
            {bn ? "অ্যাপয়েন্টমেন্ট গ্রহণ" : "Accept appointments"}
          </label>
        </div>
      )}

      {slots.map((sl, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
          <select
            className={ainp}
            disabled={!canEdit}
            value={sl.weekday}
            onChange={(e) =>
              setSlots((prev) =>
                prev.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)),
              )
            }
          >
            {(bn ? WEEKDAY_LABELS.bn : WEEKDAY_LABELS.en).map((lab, wi) => (
              <option key={wi} value={wi}>
                {lab}
              </option>
            ))}
          </select>
          <input
            className={ainp}
            type="time"
            disabled={!canEdit}
            value={sl.start_time.slice(0, 5)}
            onChange={(e) =>
              setSlots((prev) =>
                prev.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)),
              )
            }
          />
          <input
            className={ainp}
            type="time"
            disabled={!canEdit}
            value={sl.end_time.slice(0, 5)}
            onChange={(e) =>
              setSlots((prev) =>
                prev.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)),
              )
            }
          />
          {canEdit && (
            <button
              type="button"
              className="text-rose-500 px-1"
              onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600"
          onClick={() =>
            setSlots((prev) => [...prev, { weekday: 0, start_time: "14:40", end_time: "23:50" }])
          }
        >
          <Plus className="h-3.5 w-3.5" /> {bn ? "উইন্ডো যোগ" : "Add window"}
        </button>
      )}

      <div
        className={`rounded-lg px-2 py-1.5 text-[10px] ${
          variant === "dark" ? "bg-slate-800 text-slate-300" : "bg-muted/50 text-muted-foreground"
        }`}
      >
        <p>{preview.summary}</p>
        <p className="mt-0.5">
          {bn ? "আজকের খালি স্লট" : "Available today"}: {preview.todayCount}
          {preview.samples.length > 0 ? ` · ${preview.samples.join(", ")}` : ""}
        </p>
      </div>
    </div>
  );
}
