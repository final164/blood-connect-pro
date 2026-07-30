/** Per-organization donor contact icons (call / SMS / chat=WhatsApp) by gender */

export type GenderContactFlags = {
  call: boolean;
  sms: boolean;
  chat: boolean;
};

export type DonorContactSettings = {
  female: GenderContactFlags;
  male: GenderContactFlags;
};

export const DEFAULT_GENDER_CONTACT: Record<"female" | "male", GenderContactFlags> = {
  female: { call: false, sms: false, chat: true },
  male: { call: true, sms: true, chat: true },
};

export const DEFAULT_DONOR_CONTACT_SETTINGS: DonorContactSettings = {
  female: { ...DEFAULT_GENDER_CONTACT.female },
  male: { ...DEFAULT_GENDER_CONTACT.male },
};

function flags(raw: unknown, fallback: GenderContactFlags): GenderContactFlags {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<GenderContactFlags>;
  return {
    call: typeof r.call === "boolean" ? r.call : fallback.call,
    sms: typeof r.sms === "boolean" ? r.sms : fallback.sms,
    chat: typeof r.chat === "boolean" ? r.chat : fallback.chat,
  };
}

export function normalizeDonorContactSettings(raw: unknown): DonorContactSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DonorContactSettings>;
  return {
    female: flags(r.female, DEFAULT_DONOR_CONTACT_SETTINGS.female),
    male: flags(r.male, DEFAULT_DONOR_CONTACT_SETTINGS.male),
  };
}

export function contactFlagsForGender(
  settings: DonorContactSettings | null | undefined,
  gender: string | null | undefined,
): GenderContactFlags {
  const s = settings ? normalizeDonorContactSettings(settings) : DEFAULT_DONOR_CONTACT_SETTINGS;
  if (gender === "female") return s.female;
  // male + unknown → male defaults (show all)
  return s.male;
}
