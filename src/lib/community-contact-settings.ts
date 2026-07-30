/**
 * Per-organization contact icons:
 * which icons a logged-in viewer (by their profile gender) may see
 * on donors of each gender.
 *
 * settings[viewerGender][donorGender] = { call, sms, chat }
 */

export type GenderContactFlags = {
  call: boolean;
  sms: boolean;
  chat: boolean;
};

export type ViewerDonorContactMap = {
  male: GenderContactFlags;
  female: GenderContactFlags;
};

export type DonorContactSettings = {
  /** Logged-in user profile = male → icons for male/female donors */
  male: ViewerDonorContactMap;
  /** Logged-in user profile = female → icons for male/female donors */
  female: ViewerDonorContactMap;
};

/** Female donors: chat only. Male donors: all. Same for both viewer genders by default. */
const DONOR_MALE_DEFAULT: GenderContactFlags = { call: true, sms: true, chat: true };
const DONOR_FEMALE_DEFAULT: GenderContactFlags = { call: false, sms: false, chat: true };

export const DEFAULT_DONOR_CONTACT_SETTINGS: DonorContactSettings = {
  male: {
    male: { ...DONOR_MALE_DEFAULT },
    female: { ...DONOR_FEMALE_DEFAULT },
  },
  female: {
    male: { ...DONOR_MALE_DEFAULT },
    female: { ...DONOR_FEMALE_DEFAULT },
  },
};

function flags(raw: unknown, fallback: GenderContactFlags): GenderContactFlags {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<GenderContactFlags>;
  return {
    call: typeof r.call === "boolean" ? r.call : fallback.call,
    sms: typeof r.sms === "boolean" ? r.sms : fallback.sms,
    chat: typeof r.chat === "boolean" ? r.chat : fallback.chat,
  };
}

function isFlatFlags(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return "call" in r || "sms" in r || "chat" in r;
}

function viewerMap(raw: unknown, fallback: ViewerDonorContactMap): ViewerDonorContactMap {
  // Legacy flat shape: { call, sms, chat } applied to both donor genders
  if (isFlatFlags(raw)) {
    const f = flags(raw, fallback.male);
    return { male: { ...f }, female: { ...f } };
  }
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ViewerDonorContactMap>;
  return {
    male: flags(r.male, fallback.male),
    female: flags(r.female, fallback.female),
  };
}

export function normalizeDonorContactSettings(raw: unknown): DonorContactSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DonorContactSettings>;
  return {
    male: viewerMap(r.male, DEFAULT_DONOR_CONTACT_SETTINGS.male),
    female: viewerMap(r.female, DEFAULT_DONOR_CONTACT_SETTINGS.female),
  };
}

function normGender(g: string | null | undefined): "male" | "female" {
  return (g ?? "").trim().toLowerCase() === "female" ? "female" : "male";
}

/** Icons for this viewer looking at this donor (org settings). */
export function contactFlagsForViewerDonor(
  settings: DonorContactSettings | null | undefined,
  viewerGender: string | null | undefined,
  donorGender: string | null | undefined,
): GenderContactFlags {
  const s = settings ? normalizeDonorContactSettings(settings) : DEFAULT_DONOR_CONTACT_SETTINGS;
  const viewer = normGender(viewerGender);
  const donor = normGender(donorGender);
  return s[viewer][donor];
}

/** @deprecated use contactFlagsForViewerDonor */
export function contactFlagsForViewer(
  settings: DonorContactSettings | null | undefined,
  viewerGender: string | null | undefined,
): GenderContactFlags {
  // Without donor gender, use male-donor row for the viewer
  return contactFlagsForViewerDonor(settings, viewerGender, "male");
}
