/** Persist in-progress Care book state across guest → auth → return. */

const KEY = "muktosheba:care-book-resume";
const TTL_MS = 30 * 60 * 1000;

export type CareLabBookResume = {
  kind: "lab";
  orgId: string;
  selectedOfferingIds: string[];
  date?: string | null;
  home?: boolean;
  openCheckout?: boolean;
  at: number;
};

export type CareDoctorBookResume = {
  kind: "doctor";
  doctorId: string;
  scheduleId: string;
  date: string;
  affiliationId: string;
  orgName?: string;
  locationLabel?: string;
  dayLabel?: string;
  timeLabel?: string;
  at: number;
};

export type CareBookResume = CareLabBookResume | CareDoctorBookResume;

export function saveCareBookResume(state: Omit<CareLabBookResume, "at"> | Omit<CareDoctorBookResume, "at">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

export function peekCareBookResume(): CareBookResume | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareBookResume;
    if (!parsed?.kind || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumeCareBookResume(): CareBookResume | null {
  const parsed = peekCareBookResume();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  return parsed;
}

export function clearCareBookResume() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
