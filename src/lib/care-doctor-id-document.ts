import { CARE_DOCTOR_TYPES } from "@/lib/care-cms";

export type CareIdDocumentKind = "nid" | "passport" | "driving_license";

export const CARE_ID_DOCUMENT_KINDS: {
  value: CareIdDocumentKind;
  label_bn: string;
  label_en: string;
  number_bn: string;
  number_en: string;
  placeholder: string;
}[] = [
  {
    value: "nid",
    label_bn: "জাতীয় পরিচয়পত্র (NID)",
    label_en: "National ID (NID)",
    number_bn: "NID নম্বর",
    number_en: "NID number",
    placeholder: "1990123456789",
  },
  {
    value: "passport",
    label_bn: "পাসপোর্ট",
    label_en: "Passport",
    number_bn: "পাসপোর্ট নম্বর",
    number_en: "Passport number",
    placeholder: "BP0123456",
  },
  {
    value: "driving_license",
    label_bn: "ড্রাইভিং লাইসেন্স",
    label_en: "Driving licence",
    number_bn: "লাইসেন্স নম্বর",
    number_en: "Licence number",
    placeholder: "DL-DHA-123456",
  },
];

export function careIdDocumentKindLabel(
  kind: string | null | undefined,
  lang: "bn" | "en",
): string {
  const hit = CARE_ID_DOCUMENT_KINDS.find((k) => k.value === kind);
  if (!hit) return kind?.trim() || "—";
  return lang === "bn" ? hit.label_bn : hit.label_en;
}

export function careIdDocumentNumberLabel(
  kind: string | null | undefined,
  lang: "bn" | "en",
): string {
  const hit = CARE_ID_DOCUMENT_KINDS.find((k) => k.value === kind);
  if (!hit) {
    return lang === "bn" ? "পরিচয়পত্র নম্বর" : "ID number";
  }
  return lang === "bn" ? hit.number_bn : hit.number_en;
}

/** Demo profile used to prefill chamber desk / registration testing. */
export const DOCTOR_FORM_DEMO = {
  title: "Dr.",
  firstName: "Karim",
  lastName: "Hassan",
  fullNameBn: "ডা. করিম হাসান",
  dateOfBirth: "1985-03-15",
  gender: "male",
  idDocumentKind: "nid" as CareIdDocumentKind,
  idDocumentNo: "1985123456789",
  bmdcNo: "A-991234",
  doctorType: CARE_DOCTOR_TYPES[2].value, // consultant
  phone: "01719998877",
  email: "dr.karim.demo@muktosheba.app",
  qualifications: "MBBS, FCPS (Medicine)",
  fee: "800",
  discType: "percent" as const,
  discValue: "20",
};

export function buildDoctorFullName(parts: {
  title?: string;
  firstName?: string;
  lastName?: string;
}): string {
  return [parts.title, parts.firstName, parts.lastName]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}
