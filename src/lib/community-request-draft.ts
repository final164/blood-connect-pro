import type { District, Hospital } from "@/lib/api";

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
    o.district && typeof o.district === "object"
      ? (o.district as District)
      : null;
  const hospital =
    o.hospital && typeof o.hospital === "object"
      ? (o.hospital as Hospital)
      : null;

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
    district,
    hospital,
    updatedAt: o.updatedAt,
  };
}

export function loadCommunityRequestDraft(userId: string | null | undefined): CommunityRequestDraft | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return parseDraft(JSON.parse(raw) as unknown);
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
