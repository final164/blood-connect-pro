import type { District, Hospital } from "@/lib/api";
import {
  DEFAULT_MESSAGING_SETTINGS,
  getCachedMessagingSettings,
} from "@/lib/messaging-settings";

const STORAGE_PREFIX = "bloodlink:community-request-draft:v1:";

export type CommunityRequestDraft = {
  version: 1;
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  needed_by: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string;
  setDateTime: boolean;
  reasonKey: string;
  customReason: string;
  upazila: string;
  contact_phone: string;
  whatsapp_phone: string;
  /** Feed post id once created — reuse so contacting more donors does not duplicate posts. */
  feed_request_id: string | null;
  district: District | null;
  hospital: Hospital | null;
  updatedAt: number;
};

export type CommunityRequestDraftInput = Omit<CommunityRequestDraft, "version" | "updatedAt">;

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isUrgency(v: unknown): v is CommunityRequestDraft["urgency"] {
  return v === "normal" || v === "urgent" || v === "critical";
}

function parseDraft(raw: unknown): CommunityRequestDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.patient_name !== "string") return null;
  if (typeof o.blood_group !== "string" || !o.blood_group) return null;
  if (typeof o.bags_needed !== "number" || o.bags_needed < 1) return null;
  if (typeof o.needed_by !== "string") return null;
  if (!isUrgency(o.urgency)) return null;
  if (typeof o.notes !== "string") return null;
  if (typeof o.setDateTime !== "boolean") return null;
  if (typeof o.reasonKey !== "string") return null;
  if (typeof o.customReason !== "string") return null;
  if (typeof o.upazila !== "string") return null;
  if (typeof o.updatedAt !== "number") return null;

  const district =
    o.district && typeof o.district === "object" ? (o.district as District) : null;
  const hospital =
    o.hospital && typeof o.hospital === "object" ? (o.hospital as Hospital) : null;

  return {
    version: 1,
    patient_name: o.patient_name,
    blood_group: o.blood_group,
    bags_needed: o.bags_needed,
    needed_by: o.needed_by,
    urgency: o.urgency,
    notes: o.notes,
    setDateTime: o.setDateTime,
    reasonKey: o.reasonKey,
    customReason: o.customReason,
    upazila: o.upazila,
    contact_phone: typeof o.contact_phone === "string" ? o.contact_phone : "",
    whatsapp_phone: typeof o.whatsapp_phone === "string" ? o.whatsapp_phone : "",
    feed_request_id:
      typeof o.feed_request_id === "string" && o.feed_request_id.trim()
        ? o.feed_request_id.trim()
        : null,
    district,
    hospital,
    updatedAt: o.updatedAt,
  };
}

/** Resolve TTL hours: explicit arg → cached settings → default 24. 0 = never expire. */
export function resolveSaveRequestTtlHours(ttlHours?: number | null): number {
  if (typeof ttlHours === "number" && Number.isFinite(ttlHours) && ttlHours >= 0) {
    return Math.min(720, Math.floor(ttlHours));
  }
  const fromSettings = getCachedMessagingSettings().community_save_request_ttl_hours;
  if (typeof fromSettings === "number" && Number.isFinite(fromSettings) && fromSettings >= 0) {
    return Math.min(720, Math.floor(fromSettings));
  }
  return DEFAULT_MESSAGING_SETTINGS.community_save_request_ttl_hours;
}

export function isCommunityRequestDraftExpired(
  draft: CommunityRequestDraft,
  ttlHours?: number | null,
): boolean {
  const hours = resolveSaveRequestTtlHours(ttlHours);
  if (hours <= 0) return false;
  return Date.now() - draft.updatedAt >= hours * 60 * 60 * 1000;
}

/** ms until auto-clear; null if never expires or already expired. */
export function communityRequestDraftMsRemaining(
  draft: CommunityRequestDraft,
  ttlHours?: number | null,
): number | null {
  const hours = resolveSaveRequestTtlHours(ttlHours);
  if (hours <= 0) return null;
  const left = draft.updatedAt + hours * 60 * 60 * 1000 - Date.now();
  return left > 0 ? left : 0;
}

export function loadCommunityRequestDraft(
  userId: string | null | undefined,
  ttlHours?: number | null,
): CommunityRequestDraft | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const draft = parseDraft(JSON.parse(raw) as unknown);
    if (!draft) return null;
    if (isCommunityRequestDraftExpired(draft, ttlHours)) {
      clearCommunityRequestDraft(userId);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveCommunityRequestDraft(
  userId: string,
  input: CommunityRequestDraftInput,
): CommunityRequestDraft {
  const draft: CommunityRequestDraft = {
    version: 1,
    ...input,
    bags_needed: Math.max(1, input.bags_needed),
    feed_request_id: input.feed_request_id?.trim() || null,
    updatedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(userId), JSON.stringify(draft));
    window.dispatchEvent(new CustomEvent("community-request-draft-changed", { detail: { userId } }));
  }
  return draft;
}

export function clearCommunityRequestDraft(userId: string | null | undefined) {
  if (!userId || typeof window === "undefined") return;
  localStorage.removeItem(storageKey(userId));
  window.dispatchEvent(new CustomEvent("community-request-draft-changed", { detail: { userId } }));
}

export function communityRequestDraftFilled(draft: CommunityRequestDraft | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.patient_name.trim() ||
      draft.reasonKey ||
      draft.notes.trim() ||
      draft.district ||
      draft.hospital ||
      draft.upazila.trim(),
  );
}

/** Short label for dropdown / button summary. */
export function communityRequestDraftSummary(
  draft: CommunityRequestDraft,
  lang: "bn" | "en",
): string {
  const parts: string[] = [];
  if (draft.patient_name.trim()) parts.push(draft.patient_name.trim());
  if (draft.blood_group) parts.push(draft.blood_group);
  const hospitalName = draft.hospital
    ? lang === "bn"
      ? draft.hospital.name_bn
      : draft.hospital.name_en
    : "";
  if (hospitalName) parts.push(hospitalName);
  if (!parts.length) {
    return lang === "bn" ? "সংরক্ষিত রিকোয়েস্ট" : "Saved request";
  }
  return parts.join(" · ");
}
