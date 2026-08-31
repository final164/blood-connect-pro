import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WEEKDAY_LABELS } from "@/lib/tele-api";
import {
  fetchHomeDoctorSlots,
  replaceHomeDoctorSlots,
} from "@/lib/care-home-api";

const field =
  "w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-teal-600/40";

type Props = {
  doctorId: string;
  bn: boolean;
  canEdit: boolean;
};

export function HomeVisitScheduleEditor({ doctorId, bn, canEdit }: Props) {
  const [slots, setSlots] = useState<{ weekday: number; start_time: string; end_time: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);

  async function reload() {
    const rows = await fetchHomeDoctorSlots(doctorId);
    setSlots(
      rows.map((r) => ({
        weekday: r.weekday,
        start_time: r.start_time.slice(0, 5),
        end_time: r.end_time.slice(0, 5),
      })),
    );
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [doctorId]);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await replaceHomeDoctorSlots(slots);
      toast.success(bn ? "হোম শিডিউল সেভ হয়েছে" : "Home schedule saved");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">{bn ? "সাপ্তাহিক হোম ভিজিট" : "Weekly home visits"}</p>
        {canEdit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-lg bg-teal-700 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
          >
            {bn ? "সেভ" : "Save"}
          </button>
        )}
      </div>

      {slots.map((sl, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
          <select
            className={field}
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
            className={field}
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
            className={field}
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
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800"
          onClick={() =>
            setSlots((prev) => [...prev, { weekday: 0, start_time: "09:00", end_time: "12:00" }])
          }
        >
          <Plus className="h-3.5 w-3.5" />
          {bn ? "উইন্ডো যোগ" : "Add window"}
        </button>
      )}
    </div>
  );
}
