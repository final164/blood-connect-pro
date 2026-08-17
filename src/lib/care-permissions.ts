/** Care vendor permission keys — catalog lives in DB; this is the engine fallback. */

export type CarePermissionKey =
  | "overview.view"
  | "queue.view"
  | "queue.manage"
  | "serial.issue"
  | "doctors.manage"
  | "schedule.manage"
  | "lab.offerings"
  | "lab.calendar"
  | "lab.checkin"
  | "staff.manage"
  | "roles.manage"
  | "settings.edit"
  | "ambulance.dispatch.view"
  | "ambulance.dispatch.manage"
  | "ambulance.fleet.manage"
  | "ambulance.pricing.manage"
  | "ambulance.requests.view";

export type CarePermissionDef = {
  key: CarePermissionKey;
  group: string;
  label_en: string;
  label_bn: string;
};

export const CARE_PERMISSION_FALLBACK: CarePermissionDef[] = [
  { key: "overview.view", group: "overview", label_en: "View overview", label_bn: "ওভারভিউ দেখা" },
  { key: "queue.view", group: "queue", label_en: "View queue", label_bn: "কিউ দেখা" },
  { key: "queue.manage", group: "queue", label_en: "Open / pause / close session", label_bn: "সেশন খোলা/পজ/বন্ধ" },
  { key: "serial.issue", group: "queue", label_en: "Issue walk-in serial", label_bn: "ওয়াক-ইন সিরিয়াল" },
  { key: "doctors.manage", group: "doctors", label_en: "Manage doctors", label_bn: "ডাক্তার ম্যানেজ" },
  { key: "schedule.manage", group: "schedule", label_en: "Manage schedules", label_bn: "শিডিউল ম্যানেজ" },
  { key: "lab.offerings", group: "lab", label_en: "Manage test offerings", label_bn: "টেস্ট অফার" },
  { key: "lab.calendar", group: "lab", label_en: "Manage lab calendar", label_bn: "ল্যাব ক্যালেন্ডার" },
  { key: "lab.checkin", group: "lab", label_en: "Lab check-in / status", label_bn: "ল্যাব চেক-ইন" },
  { key: "staff.manage", group: "staff", label_en: "Manage staff", label_bn: "স্টাফ ম্যানেজ" },
  { key: "roles.manage", group: "staff", label_en: "Manage roles", label_bn: "রোল ম্যানেজ" },
  { key: "settings.edit", group: "settings", label_en: "Edit org settings", label_bn: "অর্গ সেটিংস" },
  { key: "ambulance.dispatch.view", group: "ambulance", label_en: "View dispatch board", label_bn: "ডিসপ্যাচ বোর্ড" },
  { key: "ambulance.dispatch.manage", group: "ambulance", label_en: "Manage dispatch", label_bn: "ডিসপ্যাচ ম্যানেজ" },
  { key: "ambulance.fleet.manage", group: "ambulance", label_en: "Manage fleet", label_bn: "ফ্লিট ম্যানেজ" },
  { key: "ambulance.pricing.manage", group: "ambulance", label_en: "Manage pricing", label_bn: "প্রাইসিং ম্যানেজ" },
  { key: "ambulance.requests.view", group: "ambulance", label_en: "View requests", label_bn: "রিকোয়েস্ট দেখা" },
];

export const ALL_CARE_PERMISSION_KEYS = CARE_PERMISSION_FALLBACK.map((p) => p.key);

export const DEFAULT_CARE_ROLE_PERMISSIONS: Record<string, CarePermissionKey[]> = {
  owner: [...ALL_CARE_PERMISSION_KEYS],
  reception: ["overview.view", "queue.view", "queue.manage", "serial.issue", "lab.checkin"],
  doctor: ["overview.view", "queue.view"],
  lab_tech: ["overview.view", "lab.checkin", "lab.calendar"],
  dispatcher: ["overview.view", "ambulance.dispatch.view", "ambulance.dispatch.manage", "ambulance.requests.view", "ambulance.fleet.manage", "ambulance.pricing.manage"],
  driver: ["overview.view", "ambulance.dispatch.view", "ambulance.requests.view"],
};

export function slugifyRoleName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || `role_${Date.now().toString(36)}`
  );
}
