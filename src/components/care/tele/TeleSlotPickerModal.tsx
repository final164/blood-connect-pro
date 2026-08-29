import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Sunrise } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { fetchTeleSettings, type TeleDoctorSlot, type TeleSettings } from "@/lib/tele-cms";
import { fetchDoctorBookedSlotStarts } from "@/lib/tele-api";
import {
  buildDaySchedules,
  dhakaDateKey,
  formatSlotLabel,
  type TeleDaySchedule,
  type TeleGeneratedSlot,
  type TeleSlotPeriod,
} from "@/lib/tele-slots";
import { cn } from "@/lib/utils";

const PERIOD_META: Record<
  TeleSlotPeriod,
  { bn: string; en: string; Icon: typeof Sun }
> = {
  morning: { bn: "সকাল", en: "Morning", Icon: Sunrise },
  afternoon: { bn: "বিকাল", en: "Afternoon", Icon: Sun },
  evening: { bn: "সন্ধ্যা", en: "Evening", Icon: Moon },
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctorId: string;
  windows: TeleDoctorSlot[];
  slotMinutes: number;
  onConfirm: (slot: { start: Date; end: Date }) => void;
};

export function TeleSlotPickerModal({
  open,
  onOpenChange,
  doctorId,
  windows,
  slotMinutes,
  onConfirm,
}: Props) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [settings, setSettings] = useState<TeleSettings | null>(null);
  const [booked, setBooked] = useState<string[]>([]);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<TeleGeneratedSlot | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchTeleSettings().then(setSettings);
    const from = new Date();
    const to = new Date(from.getTime() + 20 * 86400000);
    void fetchDoctorBookedSlotStarts(doctorId, from.toISOString(), to.toISOString())
      .then(setBooked)
      .catch(() => setBooked([]));
    setSelected(null);
  }, [open, doctorId]);

  const days: TeleDaySchedule[] = useMemo(() => {
    return buildDaySchedules({
      windows,
      slotMinutes: slotMinutes || settings?.default_slot_minutes || 15,
      horizonDays: settings?.slot_horizon_days ?? 14,
      bookedStarts: booked,
    });
  }, [windows, slotMinutes, settings, booked]);

  useEffect(() => {
    if (!days.length) {
      setDateKey(null);
      return;
    }
    const withAvail = days.find((d) => d.slots.some((s) => s.status === "available"));
    setDateKey((prev) => {
      if (prev && days.some((d) => d.dateKey === prev)) return prev;
      return (withAvail ?? days[0]).dateKey;
    });
  }, [days]);

  const active = days.find((d) => d.dateKey === dateKey) ?? null;
  const ui = settings?.ui;

  function dayChipLabel(d: TeleDaySchedule) {
    const day = Number(d.dateKey.split("-")[2]);
    const wd = new Intl.DateTimeFormat(bn ? "bn-BD" : "en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "short",
    }).format(d.date);
    return { day, wd };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 left-0 right-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none border-x-0 border-b-0",
          "max-h-[min(92dvh,100%)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
          // Desktop: centered dialog
          "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%]",
          "sm:rounded-xl sm:border sm:max-h-[85dvh] sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
        )}
      >
        {/* Drag affordance (mobile) */}
        <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <DialogHeader className="shrink-0 px-4 pr-12 pt-2 pb-2 sm:pt-4 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {bn ? ui?.slot_modal_title_bn : ui?.slot_modal_title_en}
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 px-3 sm:px-4 pb-2">
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {days.map((d) => {
              const { day, wd } = dayChipLabel(d);
              const activeChip = d.dateKey === dateKey;
              const hasAvail = d.slots.some((s) => s.status === "available");
              return (
                <button
                  key={d.dateKey}
                  type="button"
                  disabled={!hasAvail && d.dateKey !== dhakaDateKey(new Date())}
                  onClick={() => {
                    setDateKey(d.dateKey);
                    setSelected(null);
                  }}
                  className={cn(
                    "snap-start shrink-0 h-14 w-12 sm:w-14 min-w-[3rem] rounded-full flex flex-col items-center justify-center text-[11px] font-semibold border transition-colors touch-manipulation",
                    activeChip
                      ? "bg-sky-600 text-white border-sky-600"
                      : hasAvail
                        ? "bg-background border-border text-foreground"
                        : "bg-muted/40 border-transparent text-muted-foreground opacity-60",
                  )}
                >
                  <span className="text-sm leading-none">{day}</span>
                  <span className="text-[9px] font-medium opacity-90 mt-0.5">{wd}</span>
                </button>
              );
            })}
          </div>
          <div className="h-0.5 bg-muted rounded-full" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {bn ? ui?.slot_select_hint_bn : ui?.slot_select_hint_en}
          </p>

          {!active || active.slots.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {bn ? "এই দিনে কোনো স্লট নেই" : "No slots on this day"}
            </p>
          ) : (
            (["morning", "afternoon", "evening"] as TeleSlotPeriod[]).map((period) => {
              const list = active.byPeriod[period];
              if (!list.length) return null;
              const meta = PERIOD_META[period];
              const Icon = meta.Icon;
              return (
                <div key={period} className="space-y-2">
                  <p className="text-xs font-bold inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    {bn ? meta.bn : meta.en}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {list.map((s) => {
                      const isSel =
                        selected?.start.getTime() === s.start.getTime() && s.status === "available";
                      const disabled = s.status !== "available";
                      return (
                        <button
                          key={s.start.toISOString()}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelected(s)}
                          className={cn(
                            "rounded-lg border min-h-11 px-0.5 py-2.5 text-[11px] sm:text-xs font-semibold transition-colors touch-manipulation active:scale-[0.98]",
                            isSel
                              ? "bg-sky-600 text-white border-sky-600"
                              : disabled
                                ? "bg-muted text-muted-foreground border-transparent cursor-not-allowed"
                                : "bg-background border-border hover:border-sky-400",
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <div className="flex items-start justify-between gap-3 text-xs">
            <span className="text-muted-foreground shrink-0">
              {bn ? "অ্যাপয়েন্টমেন্ট সময়:" : "Appointment Time:"}
            </span>
            <span className="font-semibold text-sky-700 text-right break-words">
              {selected
                ? formatSlotLabel(selected.start, bn ? "bn" : "en")
                : bn
                  ? "একটি স্লট বেছে নিন"
                  : "Select a time slot"}
            </span>
          </div>
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onConfirm({ start: selected.start, end: selected.end });
              onOpenChange(false);
            }}
            className="w-full rounded-xl min-h-11 py-2.5 text-sm font-semibold text-white disabled:bg-muted disabled:text-muted-foreground bg-sky-600 touch-manipulation active:opacity-90"
          >
            {bn ? "নিশ্চিত করুন" : "Confirm"}
          </button>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-[10px] text-muted-foreground pt-0.5">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded border bg-background shrink-0" />
              {bn ? ui?.slot_legend_available_bn : ui?.slot_legend_available_en}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-muted shrink-0" />
              {bn ? ui?.slot_legend_unavailable_bn : ui?.slot_legend_unavailable_en}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-sky-600 shrink-0" />
              {bn ? ui?.slot_legend_selected_bn : ui?.slot_legend_selected_en}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
