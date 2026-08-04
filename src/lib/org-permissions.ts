/** Organization permission catalog — keep in sync with SQL defaults. */

export type OrgPermissionKey =
  | "overview.view"
  | "donors.view"
  | "donors.add"
  | "donors.edit"
  | "donors.delete"
  | "donors.import"
  | "settings.view"
  | "settings.edit"
  | "requests.view"
  | "requests.edit"
  | "contact.send"
  | "members.view"
  | "members.manage"
  | "roles.manage";

export type OrgPermissionDef = {
  key: OrgPermissionKey;
  group: string;
  label_en: string;
  label_bn: string;
};

export const ORG_PERMISSION_CATALOG: OrgPermissionDef[] = [
  { key: "overview.view", group: "overview", label_en: "View overview", label_bn: "ওভারভিউ দেখা" },
  { key: "donors.view", group: "donors", label_en: "View donors", label_bn: "রক্তদাতা দেখা" },
  { key: "donors.add", group: "donors", label_en: "Add donors manually", label_bn: "রক্তদাতা ম্যানুয়াল যোগ" },
  { key: "donors.edit", group: "donors", label_en: "Edit donors", label_bn: "রক্তদাতা এডিট" },
  { key: "donors.delete", group: "donors", label_en: "Delete donors", label_bn: "রক্তদাতা ডিলিট" },
  { key: "donors.import", group: "donors", label_en: "Bulk import donors", label_bn: "বাল্ক ইমপোর্ট" },
  { key: "settings.view", group: "settings", label_en: "View contact settings", label_bn: "কন্টাক্ট সেটিংস দেখা" },
  { key: "settings.edit", group: "settings", label_en: "Edit contact settings", label_bn: "কন্টাক্ট সেটিংস এডিট" },
  { key: "requests.view", group: "requests", label_en: "View inbound requests", label_bn: "ইনবাউন্ড রিকোয়েস্ট দেখা" },
  { key: "requests.edit", group: "requests", label_en: "Update request status", label_bn: "রিকোয়েস্ট স্ট্যাটাস" },
  { key: "contact.send", group: "contact", label_en: "Outbound call / SMS / WhatsApp", label_bn: "আউটবাউন্ড কল / SMS / WhatsApp" },
  { key: "members.view", group: "members", label_en: "View members", label_bn: "মেম্বার দেখা" },
  { key: "members.manage", group: "members", label_en: "Assign / remove members", label_bn: "মেম্বার যোগ/সরানো" },
  { key: "roles.manage", group: "roles", label_en: "Create & edit roles", label_bn: "রোল তৈরি ও এডিট" },
];

export const ALL_ORG_PERMISSION_KEYS = ORG_PERMISSION_CATALOG.map((p) => p.key);

export const DEFAULT_ORG_ROLE_PERMISSIONS: Record<string, OrgPermissionKey[]> = {
  owner: [...ALL_ORG_PERMISSION_KEYS],
  editor: ALL_ORG_PERMISSION_KEYS.filter((k) => k !== "roles.manage" && k !== "members.manage"),
  viewer: ["overview.view", "donors.view", "settings.view", "requests.view", "members.view"],
};

export function orgPermissionsByGroup() {
  const map = new Map<string, OrgPermissionDef[]>();
  for (const p of ORG_PERMISSION_CATALOG) {
    const list = map.get(p.group) ?? [];
    list.push(p);
    map.set(p.group, list);
  }
  return map;
}

export function slugifyRoleName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || `role_${Date.now().toString(36)}`;
}
