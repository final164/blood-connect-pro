import { supabase } from "@/integrations/supabase/client";

export type BloodDonorAiIntentAction = "sms" | "list" | "orgs" | "auto";

export type BloodDonorAiIntent = {
  id: string;
  label_bn: string;
  label_en: string;
  action: BloodDonorAiIntentAction;
};

export type BloodDonorAiSlot =
  | "district"
  | "blood_group"
  | "upazila"
  | "bags"
  | "urgency"
  | "notes";

export type BloodDonorAiGenderFilter = "male" | "female" | "any";

/** Fields shown on each donor row in AI results (admin-controlled). */
export type BloodDonorAiListField =
  | "name"
  | "phone"
  | "blood_group"
  | "gender"
  | "upazila"
  | "district"
  | "source";

export const BLOOD_DONOR_AI_LIST_FIELDS: BloodDonorAiListField[] = [
  "name",
  "phone",
  "blood_group",
  "gender",
  "upazila",
  "district",
  "source",
];

export type BloodDonorAiListFields = Record<BloodDonorAiListField, boolean>;

export type BloodDonorAiSettings = {
  enabled: boolean;
  entry_points: {
    community: boolean;
    home: boolean;
    care_hub: boolean;
  };
  intents: BloodDonorAiIntent[];
  required_slots: BloodDonorAiSlot[];
  optional_slots: BloodDonorAiSlot[];
  filters: {
    gender: BloodDonorAiGenderFilter;
    max_donors: number;
    include_app_users: boolean;
    /** Only donors who are currently available / উপলব্ধ */
    available_only: boolean;
  };
  /** Which columns appear on donor list cards */
  list_fields: BloodDonorAiListFields;
  actions: {
    show_list: boolean;
    show_orgs: boolean;
    open_sms: boolean;
    open_whatsapp: boolean;
    copy_list: boolean;
  };
  prompts: {
    system_bn: string;
    system_en: string;
  };
  ui: {
    welcome_bn: string;
    welcome_en: string;
    disclaimer_bn: string;
    disclaimer_en: string;
    one_label_bn: string;
    one_label_en: string;
    all_label_bn: string;
    all_label_en: string;
    answer_tag: string;
    question_tag: string;
    answer_inline: string;
    bubble_prefix: string;
  };
  messaging: {
    use_messaging_templates: boolean;
  };
  /** UI / slot defaults (admin-controlled) */
  defaults: {
    /** When true, optional upazila defaults to whole district unless user picks one */
    upazila_all: boolean;
  };
};

export const DEFAULT_BLOOD_DONOR_AI_SETTINGS: BloodDonorAiSettings = {
  enabled: true,
  entry_points: {
    community: true,
    home: false,
    care_hub: true,
  },
  intents: [
    {
      id: "sms",
      label_bn: "আমাকে বলুন — আমি ডোনারদের SMS পাঠিয়ে দিচ্ছি",
      label_en: "Tell me — I will send SMS to donors",
      action: "sms",
    },
    {
      id: "list",
      label_bn: "আমাকে বলুন — এই এলাকার ডোনার তালিকা দিয়ে দিচ্ছি",
      label_en: "Tell me — I will give the donor list for this area",
      action: "list",
    },
    {
      id: "orgs",
      label_bn: "এই এলাকার organizations দেখান",
      label_en: "Show organizations in this area",
      action: "orgs",
    },
  ],
  required_slots: ["district", "blood_group"],
  optional_slots: ["upazila", "bags", "urgency", "notes"],
  filters: {
    gender: "male",
    max_donors: 40,
    include_app_users: true,
    available_only: true,
  },
  list_fields: {
    name: true,
    phone: true,
    blood_group: true,
    gender: false,
    upazila: true,
    district: false,
    source: false,
  },
  actions: {
    show_list: true,
    show_orgs: true,
    open_sms: true,
    open_whatsapp: true,
    copy_list: true,
  },
  prompts: {
    system_bn: `আপনি স্পন্দন Blood Donor AI। রক্তদাতা খুঁজে SMS/তালিকা/সংগঠন সাহায্য করেন।
নিয়ম:
- শুধু JSON উত্তর দিন। ফোন নম্বর কল্পনা করবেন না — টুল রেজাল্ট থেকেই আসবে।
- প্রয়োজনীয় স্লট না থাকলে questions[]-এ জিজ্ঞেস করুন (জেলা, রক্তের গ্রুপ ইত্যাদি)।
- স্লট পূর্ণ হলে ready_for_tools=true এবং intent সেট করুন (sms|list|orgs|auto)।
- বাংলায় সংক্ষিপ্ত, সহায়ক reply লিখুন।`,
    system_en: `You are Spandon Blood Donor AI. You help find blood donors for SMS, lists, and organizations.
Rules:
- Reply with JSON only. Never invent phone numbers — tools supply them.
- If required slots are missing, ask in questions[] (district, blood group, etc.).
- When slots are complete, set ready_for_tools=true and intent (sms|list|orgs|auto).
- Keep reply short and helpful.`,
  },
  ui: {
    welcome_bn:
      "ব্লাড ডোনার AI — জেলা ও রক্তের গ্রুপ বলুন, আমি তালিকা/SMS/সংগঠন সাজিয়ে দেব।",
    welcome_en:
      "Blood Donor AI — tell me district and blood group; I will prepare list / SMS / organizations.",
    disclaimer_bn: "ফোন নম্বর টুল থেকে আসে। SMS আপনার ফোনের অ্যাপ দিয়ে খুলবে।",
    disclaimer_en: "Phone numbers come from tools. SMS opens in your device app.",
    one_label_bn: "এক",
    one_label_en: "One",
    all_label_bn: "সব",
    all_label_en: "All",
    answer_tag: "[Answer]",
    question_tag: "Question:",
    answer_inline: "Answer:",
    bubble_prefix: "↳",
  },
  messaging: {
    use_messaging_templates: true,
  },
  defaults: {
    upazila_all: true,
  },
};

const ALL_SLOTS: BloodDonorAiSlot[] = [
  "district",
  "blood_group",
  "upazila",
  "bags",
  "urgency",
  "notes",
];

function asBool(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

function asStr(v: unknown, fallback: string) {
  return typeof v === "string" ? v : fallback;
}

function asInt(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeSlot(v: unknown): BloodDonorAiSlot | null {
  const s = String(v ?? "");
  return (ALL_SLOTS as string[]).includes(s) ? (s as BloodDonorAiSlot) : null;
}

function normalizeIntent(raw: unknown, fallback: BloodDonorAiIntent): BloodDonorAiIntent {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const actionRaw = String(r.action ?? fallback.action);
  const action: BloodDonorAiIntentAction =
    actionRaw === "sms" || actionRaw === "list" || actionRaw === "orgs" || actionRaw === "auto"
      ? actionRaw
      : fallback.action;
  return {
    id: asStr(r.id, fallback.id).slice(0, 40) || fallback.id,
    label_bn: asStr(r.label_bn, fallback.label_bn).slice(0, 160),
    label_en: asStr(r.label_en, fallback.label_en).slice(0, 160),
    action,
  };
}

export function normalizeBloodDonorAiSettings(raw: unknown): BloodDonorAiSettings {
  const d = DEFAULT_BLOOD_DONOR_AI_SETTINGS;
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const entry = r.entry_points && typeof r.entry_points === "object"
    ? (r.entry_points as Record<string, unknown>)
    : {};
  const filters = r.filters && typeof r.filters === "object"
    ? (r.filters as Record<string, unknown>)
    : {};
  const listFieldsRaw =
    r.list_fields && typeof r.list_fields === "object"
      ? (r.list_fields as Record<string, unknown>)
      : {};
  const actions = r.actions && typeof r.actions === "object"
    ? (r.actions as Record<string, unknown>)
    : {};
  const prompts = r.prompts && typeof r.prompts === "object"
    ? (r.prompts as Record<string, unknown>)
    : {};
  const ui = r.ui && typeof r.ui === "object" ? (r.ui as Record<string, unknown>) : {};
  const messaging =
    r.messaging && typeof r.messaging === "object"
      ? (r.messaging as Record<string, unknown>)
      : {};
  const defaults =
    r.defaults && typeof r.defaults === "object"
      ? (r.defaults as Record<string, unknown>)
      : {};

  const genderRaw = String(filters.gender ?? d.filters.gender);
  const gender: BloodDonorAiGenderFilter =
    genderRaw === "female" || genderRaw === "any" || genderRaw === "male"
      ? genderRaw
      : d.filters.gender;

  const intentsIn = Array.isArray(r.intents) ? r.intents : d.intents;
  const intents = intentsIn
    .map((item, i) => normalizeIntent(item, d.intents[i] ?? d.intents[0]!))
    .filter((x) => x.label_bn.trim() || x.label_en.trim())
    .slice(0, 8);
  const finalIntents = intents.length ? intents : d.intents;

  const req = Array.isArray(r.required_slots)
    ? (r.required_slots.map(normalizeSlot).filter(Boolean) as BloodDonorAiSlot[])
    : d.required_slots;
  const opt = Array.isArray(r.optional_slots)
    ? (r.optional_slots.map(normalizeSlot).filter(Boolean) as BloodDonorAiSlot[])
    : d.optional_slots;

  return {
    enabled: asBool(r.enabled, d.enabled),
    entry_points: {
      community: asBool(entry.community, d.entry_points.community),
      home: asBool(entry.home, d.entry_points.home),
      care_hub: asBool(entry.care_hub, d.entry_points.care_hub),
    },
    intents: finalIntents,
    required_slots: req.length ? req : d.required_slots,
    optional_slots: opt,
    filters: {
      gender,
      max_donors: asInt(filters.max_donors, d.filters.max_donors, 5, 100),
      include_app_users: asBool(filters.include_app_users, d.filters.include_app_users),
      available_only: asBool(filters.available_only, d.filters.available_only),
    },
    list_fields: {
      name: asBool(listFieldsRaw.name, d.list_fields.name),
      phone: asBool(listFieldsRaw.phone, d.list_fields.phone),
      blood_group: asBool(listFieldsRaw.blood_group, d.list_fields.blood_group),
      gender: asBool(listFieldsRaw.gender, d.list_fields.gender),
      upazila: asBool(listFieldsRaw.upazila, d.list_fields.upazila),
      district: asBool(listFieldsRaw.district, d.list_fields.district),
      source: asBool(listFieldsRaw.source, d.list_fields.source),
    },
    actions: {
      show_list: asBool(actions.show_list, d.actions.show_list),
      show_orgs: asBool(actions.show_orgs, d.actions.show_orgs),
      open_sms: asBool(actions.open_sms, d.actions.open_sms),
      open_whatsapp: asBool(actions.open_whatsapp, d.actions.open_whatsapp),
      copy_list: asBool(actions.copy_list, d.actions.copy_list),
    },
    prompts: {
      system_bn: asStr(prompts.system_bn, d.prompts.system_bn),
      system_en: asStr(prompts.system_en, d.prompts.system_en),
    },
    ui: {
      welcome_bn: asStr(ui.welcome_bn, d.ui.welcome_bn),
      welcome_en: asStr(ui.welcome_en, d.ui.welcome_en),
      disclaimer_bn: asStr(ui.disclaimer_bn, d.ui.disclaimer_bn),
      disclaimer_en: asStr(ui.disclaimer_en, d.ui.disclaimer_en),
      one_label_bn: asStr(ui.one_label_bn, d.ui.one_label_bn),
      one_label_en: asStr(ui.one_label_en, d.ui.one_label_en),
      all_label_bn: asStr(ui.all_label_bn, d.ui.all_label_bn),
      all_label_en: asStr(ui.all_label_en, d.ui.all_label_en),
      answer_tag: asStr(ui.answer_tag, d.ui.answer_tag),
      question_tag: asStr(ui.question_tag, d.ui.question_tag),
      answer_inline: asStr(ui.answer_inline, d.ui.answer_inline),
      bubble_prefix: asStr(ui.bubble_prefix, d.ui.bubble_prefix),
    },
    messaging: {
      use_messaging_templates: asBool(
        messaging.use_messaging_templates,
        d.messaging.use_messaging_templates,
      ),
    },
    defaults: {
      upazila_all: asBool(defaults.upazila_all, d.defaults.upazila_all),
    },
  };
}

export type BloodDonorAiPublicConfig = {
  enabled: boolean;
  entry_points: BloodDonorAiSettings["entry_points"];
  intents: BloodDonorAiIntent[];
  required_slots: BloodDonorAiSlot[];
  optional_slots: BloodDonorAiSlot[];
  actions: BloodDonorAiSettings["actions"];
  ui: BloodDonorAiSettings["ui"];
  filters: Pick<BloodDonorAiSettings["filters"], "gender" | "max_donors">;
  list_fields: BloodDonorAiListFields;
  defaults: BloodDonorAiSettings["defaults"];
};

export function toPublicBloodDonorAiConfig(s: BloodDonorAiSettings): BloodDonorAiPublicConfig {
  return {
    enabled: s.enabled,
    entry_points: s.entry_points,
    intents: s.intents,
    required_slots: s.required_slots,
    optional_slots: s.optional_slots,
    actions: s.actions,
    ui: s.ui,
    filters: {
      gender: s.filters.gender,
      max_donors: s.filters.max_donors,
    },
    list_fields: s.list_fields,
    defaults: s.defaults,
  };
}

let cache: BloodDonorAiSettings | null = null;
let cachedAt = 0;
const TTL = 60_000;

export function invalidateBloodDonorAiSettingsCache() {
  cache = null;
  cachedAt = 0;
}

export function peekBloodDonorAiSettingsCache(): BloodDonorAiSettings {
  return cache ?? DEFAULT_BLOOD_DONOR_AI_SETTINGS;
}

export async function fetchBloodDonorAiSettings(force = false): Promise<BloodDonorAiSettings> {
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("blood_donor_ai_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    cache = cache ?? DEFAULT_BLOOD_DONOR_AI_SETTINGS;
    cachedAt = Date.now();
    return cache;
  }
  const row = data as { blood_donor_ai_settings?: unknown } | null;
  cache = normalizeBloodDonorAiSettings(row?.blood_donor_ai_settings);
  cachedAt = Date.now();
  return cache;
}

export async function saveBloodDonorAiSettings(next: BloodDonorAiSettings): Promise<void> {
  const normalized = normalizeBloodDonorAiSettings(next);
  const { error } = await supabase
    .from("app_settings")
    .update({ blood_donor_ai_settings: normalized } as never)
    .eq("id", 1);
  if (error) throw error;
  cache = normalized;
  cachedAt = Date.now();
}

export const SLOT_QUESTION_BN: Record<BloodDonorAiSlot, string> = {
  district: "কোন জেলায় রক্তদাতা লাগবে?",
  blood_group: "কোন রক্তের গ্রুপ?",
  upazila: "কোন উপজেলা? (সব উপজেলাও বেছে নিতে পারেন)",
  bags: "কত ব্যাগ রক্ত লাগবে?",
  urgency: "জরুরি অবস্থা কেমন? (normal / urgent / critical)",
  notes: "অন্য কোনো নোট আছে?",
};

export const SLOT_QUESTION_EN: Record<BloodDonorAiSlot, string> = {
  district: "Which district do you need donors in?",
  blood_group: "Which blood group?",
  upazila: "Which upazila? (or choose All)",
  bags: "How many bags are needed?",
  urgency: "How urgent? (normal / urgent / critical)",
  notes: "Any other notes?",
};
