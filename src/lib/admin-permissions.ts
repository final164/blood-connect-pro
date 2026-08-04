/** Admin permission catalog — must stay in sync with SQL seed. */

export type AdminModule =
  | "overview"
  | "users"
  | "requests"
  | "reports"
  | "districts"
  | "hospitals"
  | "cms"
  | "community"
  | "notifications"
  | "settings"
  | "architecture"
  | "access";

export type PermissionKey = `${AdminModule}.${string}`;

export type PermissionDef = {
  key: PermissionKey;
  module: AdminModule;
  action: string;
  label_en: string;
  label_bn: string;
  sort_order: number;
};

export const ADMIN_PERMISSION_CATALOG: PermissionDef[] = [
  { key: "overview.view", module: "overview", action: "view", label_en: "View overview", label_bn: "ওভারভিউ দেখা", sort_order: 10 },
  { key: "users.view", module: "users", action: "view", label_en: "View users", label_bn: "ইউজার দেখা", sort_order: 20 },
  { key: "users.edit", module: "users", action: "edit", label_en: "Edit users", label_bn: "ইউজার এডিট", sort_order: 21 },
  { key: "users.set_role", module: "users", action: "set_role", label_en: "Set user/admin role", label_bn: "ইউজার/অ্যাডমিন রোল", sort_order: 22 },
  { key: "users.toggle_available", module: "users", action: "toggle_available", label_en: "Toggle availability", label_bn: "উপলব্ধ টগল", sort_order: 23 },
  { key: "users.filter_search", module: "users", action: "filter_search", label_en: "Filter: phone search", label_bn: "ফিল্টার: ফোন সার্চ", sort_order: 24 },
  { key: "users.filter_role", module: "users", action: "filter_role", label_en: "Filter: role", label_bn: "ফিল্টার: রোল", sort_order: 25 },
  { key: "users.filter_district", module: "users", action: "filter_district", label_en: "Filter: district (use geo scope below)", label_bn: "ফিল্টার: জেলা (নিচে স্কোপ)", sort_order: 26 },
  { key: "users.filter_upazila", module: "users", action: "filter_upazila", label_en: "Filter: upazila (use geo scope below)", label_bn: "ফিল্টার: উপজেলা (নিচে স্কোপ)", sort_order: 27 },
  { key: "users.filter_blood_group", module: "users", action: "filter_blood_group", label_en: "Filter: blood group", label_bn: "ফিল্টার: রক্তের গ্রুপ", sort_order: 28 },
  { key: "users.filter_donated", module: "users", action: "filter_donated", label_en: "Filter: donated", label_bn: "ফিল্টার: দান করেছে", sort_order: 29 },
  { key: "users.filter_received", module: "users", action: "filter_received", label_en: "Filter: received", label_bn: "ফিল্টার: গ্রহণ (complete)", sort_order: 30 },
  { key: "users.view_pin", module: "users", action: "view_pin", label_en: "View user PIN", label_bn: "ইউজার PIN দেখা", sort_order: 31 },
  { key: "users.block", module: "users", action: "block", label_en: "Block / unblock users", label_bn: "ইউজার ব্লক", sort_order: 32 },
  { key: "users.delete", module: "users", action: "delete", label_en: "Delete users", label_bn: "ইউজার ডিলিট", sort_order: 33 },
  { key: "requests.view", module: "requests", action: "view", label_en: "View requests", label_bn: "রিকোয়েস্ট দেখা", sort_order: 30 },
  { key: "requests.edit", module: "requests", action: "edit", label_en: "Edit request status", label_bn: "রিকোয়েস্ট স্ট্যাটাস", sort_order: 31 },
  { key: "requests.delete", module: "requests", action: "delete", label_en: "Delete requests", label_bn: "রিকোয়েস্ট ডিলিট", sort_order: 32 },
  { key: "reports.view", module: "reports", action: "view", label_en: "View reports", label_bn: "রিপোর্ট দেখা", sort_order: 85 },
  { key: "reports.edit", module: "reports", action: "edit", label_en: "Update report status", label_bn: "রিপোর্ট স্ট্যাটাস", sort_order: 86 },
  { key: "reports.delete", module: "reports", action: "delete", label_en: "Delete reports", label_bn: "রিপোর্ট ডিলিট", sort_order: 87 },
  { key: "districts.view", module: "districts", action: "view", label_en: "View districts", label_bn: "জেলা দেখা", sort_order: 40 },
  { key: "districts.add", module: "districts", action: "add", label_en: "Add districts", label_bn: "জেলা যোগ", sort_order: 41 },
  { key: "districts.edit", module: "districts", action: "edit", label_en: "Edit districts", label_bn: "জেলা এডিট", sort_order: 42 },
  { key: "districts.delete", module: "districts", action: "delete", label_en: "Delete districts", label_bn: "জেলা ডিলিট", sort_order: 43 },
  { key: "districts.toggle", module: "districts", action: "toggle", label_en: "Toggle district active", label_bn: "জেলা অন/অফ", sort_order: 44 },
  { key: "hospitals.view", module: "hospitals", action: "view", label_en: "View hospitals", label_bn: "হাসপাতাল দেখা", sort_order: 50 },
  { key: "hospitals.add", module: "hospitals", action: "add", label_en: "Add hospitals", label_bn: "হাসপাতাল যোগ", sort_order: 51 },
  { key: "hospitals.edit", module: "hospitals", action: "edit", label_en: "Edit hospitals", label_bn: "হাসপাতাল এডিট", sort_order: 52 },
  { key: "hospitals.delete", module: "hospitals", action: "delete", label_en: "Delete hospitals", label_bn: "হাসপাতাল ডিলিট", sort_order: 53 },
  { key: "hospitals.toggle", module: "hospitals", action: "toggle", label_en: "Toggle hospital active", label_bn: "হাসপাতাল অন/অফ", sort_order: 54 },
  { key: "hospitals.seed", module: "hospitals", action: "seed", label_en: "Seed hospitals", label_bn: "হাসপাতাল সিড", sort_order: 55 },
  { key: "cms.view", module: "cms", action: "view", label_en: "View CMS", label_bn: "CMS দেখা", sort_order: 60 },
  { key: "cms.edit", module: "cms", action: "edit", label_en: "Edit CMS strings", label_bn: "CMS এডিট", sort_order: 61 },
  { key: "cms.seed", module: "cms", action: "seed", label_en: "Seed CMS", label_bn: "CMS সিড", sort_order: 62 },
  { key: "community.view", module: "community", action: "view", label_en: "View community", label_bn: "কমিউনিটি দেখা", sort_order: 70 },
  { key: "community.add", module: "community", action: "add", label_en: "Add organizations", label_bn: "সংস্থা যোগ", sort_order: 71 },
  { key: "community.edit", module: "community", action: "edit", label_en: "Edit organizations", label_bn: "সংস্থা এডিট", sort_order: 72 },
  { key: "community.delete", module: "community", action: "delete", label_en: "Delete organizations", label_bn: "সংস্থা ডিলিট", sort_order: 73 },
  { key: "community.toggle", module: "community", action: "toggle", label_en: "Toggle org active", label_bn: "সংস্থা অন/অফ", sort_order: 74 },
  { key: "community.import", module: "community", action: "import", label_en: "Bulk import donors", label_bn: "বাল্ক ইমপোর্ট", sort_order: 75 },
  { key: "community.donors_edit", module: "community", action: "donors_edit", label_en: "Edit donors", label_bn: "রক্তদাতা এডিট", sort_order: 76 },
  { key: "community.donors_delete", module: "community", action: "donors_delete", label_en: "Delete donors", label_bn: "রক্তদাতা ডিলিট", sort_order: 77 },
  { key: "notifications.view", module: "notifications", action: "view", label_en: "View notifications", label_bn: "নোটিফিকেশন দেখা", sort_order: 80 },
  { key: "notifications.broadcast", module: "notifications", action: "broadcast", label_en: "Broadcast", label_bn: "ব্রডকাস্ট", sort_order: 81 },
  { key: "notifications.delete", module: "notifications", action: "delete", label_en: "Delete notifications", label_bn: "নোটিফিকেশন ডিলিট", sort_order: 82 },
  { key: "notifications.settings", module: "notifications", action: "settings", label_en: "Notification settings", label_bn: "নোটিফিকেশন সেটিংস", sort_order: 83 },
  { key: "notifications.purge", module: "notifications", action: "purge", label_en: "Purge expired", label_bn: "পুরানো মুছা", sort_order: 84 },
  { key: "settings.view", module: "settings", action: "view", label_en: "View settings", label_bn: "সেটিংস দেখা", sort_order: 90 },
  { key: "settings.edit", module: "settings", action: "edit", label_en: "Edit settings", label_bn: "সেটিংস এডিট", sort_order: 91 },
  { key: "architecture.view", module: "architecture", action: "view", label_en: "View architecture", label_bn: "আর্কিটেকচার দেখা", sort_order: 100 },
  { key: "access.view", module: "access", action: "view", label_en: "View access control", label_bn: "অ্যাক্সেস দেখা", sort_order: 110 },
  { key: "access.manage", module: "access", action: "manage", label_en: "Manage roles & ACL", label_bn: "রোল ও ACL ম্যানেজ", sort_order: 111 },
];

export const ADMIN_MODULES: { id: AdminModule; label_en: string; label_bn: string }[] = [
  { id: "overview", label_en: "Overview", label_bn: "ওভারভিউ" },
  { id: "users", label_en: "Users", label_bn: "ইউজার" },
  { id: "requests", label_en: "Requests", label_bn: "রিকোয়েস্ট" },
  { id: "reports", label_en: "Reports", label_bn: "রিপোর্ট" },
  { id: "districts", label_en: "Districts", label_bn: "জেলা" },
  { id: "hospitals", label_en: "Hospitals", label_bn: "হাসপাতাল" },
  { id: "cms", label_en: "CMS", label_bn: "CMS" },
  { id: "community", label_en: "Community", label_bn: "কমিউনিটি" },
  { id: "notifications", label_en: "Notifications", label_bn: "নোটিফিকেশন" },
  { id: "settings", label_en: "Settings", label_bn: "সেটিংস" },
  { id: "architecture", label_en: "Architecture", label_bn: "আর্কিটেকচার" },
  { id: "access", label_en: "Access Control", label_bn: "অ্যাক্সেস কন্ট্রোল" },
];

export type AdminRoleRow = {
  id: string;
  slug: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  users_geo_scope?: unknown;
};

export type OverrideEffect = "grant" | "deny";

export function permissionsByModule(catalog = ADMIN_PERMISSION_CATALOG) {
  const map = new Map<AdminModule, PermissionDef[]>();
  for (const p of catalog) {
    const list = map.get(p.module) ?? [];
    list.push(p);
    map.set(p.module, list);
  }
  return map;
}

export function permLabel(key: string, lang: "bn" | "en") {
  const hit = ADMIN_PERMISSION_CATALOG.find((p) => p.key === key);
  if (!hit) return key;
  return lang === "bn" ? hit.label_bn : hit.label_en;
}
