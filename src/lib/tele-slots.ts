import type { TeleDoctorSlot } from "@/lib/tele-cms";

export type TeleSlotStatus = "available" | "booked" | "past";

export type TeleGeneratedSlot = {
  start: Date;
  end: Date;
  status: TeleSlotStatus;
  label: string;
};

export type TeleSlotPeriod = "morning" | "afternoon" | "evening";

export type TeleDaySchedule = {
  dateKey: string;
  date: Date;
  weekday: number;
  windows: { start_time: string; end_time: string }[];
  slots: TeleGeneratedSlot[];
  byPeriod: Record<TeleSlotPeriod, TeleGeneratedSlot[]>;
};

const TZ = "Asia/Dhaka";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Calendar Y-M-D in Asia/Dhaka */
export function dhakaDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatSlotLabel(d: Date, lang: "bn" | "en" = "en"): string {
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function periodForHour(hour: number): TeleSlotPeriod {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Build a Date for Y-M-D + HH:MM in Asia/Dhaka as absolute Instant */
export function dhakaLocalToDate(dateKey: string, timeHHmm: string): Date {
  const [y, mo, da] = dateKey.split("-").map(Number);
  const [h, mi] = timeHHmm.slice(0, 5).split(":").map(Number);
  // Interpret as Dhaka wall time via fixed offset +06:00 (Bangladesh has no DST)
  const iso = `${y}-${pad(mo)}-${pad(da)}T${pad(h)}:${pad(mi || 0)}:00+06:00`;
  return new Date(iso);
}

function hourInDhaka(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(d),
  );
}

export function summarizeWindows(
  windows: TeleDoctorSlot[],
  lang: "bn" | "en",
): string {
  if (!windows.length) return lang === "bn" ? "সময়সূচি নেই" : "No schedule";
  const byDay = new Map<number, string[]>();
  for (const w of windows) {
    const list = byDay.get(w.weekday) ?? [];
    list.push(`${w.start_time.slice(0, 5)}–${w.end_time.slice(0, 5)}`);
    byDay.set(w.weekday, list);
  }
  if (byDay.size === 7) {
    const first = [...byDay.values()][0]?.join(", ");
    const allSame = [...byDay.values()].every((v) => v.join(", ") === first);
    if (allSame) {
      return lang === "bn" ? `প্রতিদিন (${first})` : `Everyday (${first})`;
    }
  }
  const labels = lang === "bn" ? ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wd, times]) => `${labels[wd]} ${times.join(", ")}`)
    .join(" · ");
}

export function buildDaySchedules(input: {
  windows: TeleDoctorSlot[];
  slotMinutes: number;
  horizonDays: number;
  bookedStarts: string[]; // ISO timestamps
  now?: Date;
}): TeleDaySchedule[] {
  const now = input.now ?? new Date();
  const minutes = Math.max(5, Math.min(120, input.slotMinutes || 15));
  const horizon = Math.max(1, Math.min(60, input.horizonDays || 14));
  const booked = new Set(
    input.bookedStarts.map((s) => new Date(s).getTime()).filter((t) => !Number.isNaN(t)),
  );

  const windowsByDow = new Map<number, TeleDoctorSlot[]>();
  for (const w of input.windows.filter((x) => x.is_active !== false)) {
    const list = windowsByDow.get(w.weekday) ?? [];
    list.push(w);
    windowsByDow.set(w.weekday, list);
  }

  const days: TeleDaySchedule[] = [];
  for (let i = 0; i < horizon; i++) {
    const cursor = new Date(now.getTime() + i * 86400000);
    const dateKey = dhakaDateKey(cursor);
    // weekday in Dhaka
    const probe = dhakaLocalToDate(dateKey, "12:00");
    const weekday = probe.getUTCDay(); // +06 noon → same DOW as Dhaka calendar
    // Actually: Date getUTCDay for +06:00 noon is correct DOW for Dhaka date
    const wins = windowsByDow.get(weekday) ?? [];
    if (!wins.length) continue;

    const slots: TeleGeneratedSlot[] = [];
    for (const win of wins) {
      let startM = parseTimeToMinutes(win.start_time);
      const endM = parseTimeToMinutes(win.end_time);
      while (startM + minutes <= endM) {
        const hh = Math.floor(startM / 60);
        const mm = startM % 60;
        const start = dhakaLocalToDate(dateKey, `${pad(hh)}:${pad(mm)}`);
        const end = new Date(start.getTime() + minutes * 60_000);
        let status: TeleSlotStatus = "available";
        if (start.getTime() <= now.getTime()) status = "past";
        else if (booked.has(start.getTime())) status = "booked";
        slots.push({
          start,
          end,
          status,
          label: formatSlotLabel(start),
        });
        startM += minutes;
      }
    }

    slots.sort((a, b) => a.start.getTime() - b.start.getTime());
    const byPeriod: Record<TeleSlotPeriod, TeleGeneratedSlot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const s of slots) {
      byPeriod[periodForHour(hourInDhaka(s.start))].push(s);
    }

    days.push({
      dateKey,
      date: dhakaLocalToDate(dateKey, "00:00"),
      weekday,
      windows: wins.map((w) => ({ start_time: w.start_time, end_time: w.end_time })),
      slots,
      byPeriod,
    });
  }
  return days;
}
