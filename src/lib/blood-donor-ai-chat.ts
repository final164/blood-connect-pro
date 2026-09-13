import { createServerFn } from "@tanstack/react-start";
import { optionalSupabaseAuth } from "@/lib/optional-supabase-auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeBloodDonorAiSettings,
  SLOT_QUESTION_BN,
  SLOT_QUESTION_EN,
  toPublicBloodDonorAiConfig,
  type BloodDonorAiIntentAction,
  type BloodDonorAiPublicConfig,
  type BloodDonorAiSettings,
  type BloodDonorAiSlot,
} from "@/lib/blood-donor-ai-settings";
import { BLOOD_GROUPS } from "@/lib/format";
import { applySmsTemplate, normalizeMessagingSettings } from "@/lib/messaging-settings";
import { isCommunityDonorUnavailable } from "@/lib/community-donor-import";
import {
  UPAZILA_ALL_SLOT,
  isUpazilaSlotSet,
  parseUpazilaSlotInput,
  upazilaFilterForQuery,
  upazilaSlotLabel,
} from "@/lib/blood-donor-ai-slots";

export type BloodDonorAiChatMessage = { role: "user" | "assistant"; text: string };

export type BloodDonorAiSlots = {
  district: string;
  blood_group: string;
  upazila: string;
  bags: string;
  urgency: string;
  notes: string;
};

export type BloodDonorAiDonorCard = {
  id: string;
  name: string;
  phone: string;
  blood_group: string | null;
  gender: string | null;
  upazila: string | null;
  district: string | null;
  source: "org" | "app";
};

export type BloodDonorAiOrgCard = {
  id: string;
  name: string;
  phone: string | null;
  district_id: string | null;
};

export type BloodDonorAiToolResults = {
  donors: BloodDonorAiDonorCard[];
  orgs: BloodDonorAiOrgCard[];
  sms_body: string;
  district_id: string | null;
  district_label: string;
  blood_group: string;
};

export type BloodDonorAiChatResult = {
  reply: string;
  questions: string[];
  intent: BloodDonorAiIntentAction;
  slots: BloodDonorAiSlots;
  ready_for_tools: boolean;
  tool_results: BloodDonorAiToolResults | null;
};

type AiAuthContext = {
  supabase: SupabaseClient;
  userId: string | null;
  isGuest: boolean;
};

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI returned non-JSON");
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

function asString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function emptySlots(): BloodDonorAiSlots {
  return {
    district: "",
    blood_group: "",
    upazila: "",
    bags: "",
    urgency: "",
    notes: "",
  };
}

function normalizeBloodGroup(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  const hit = BLOOD_GROUPS.find((g) => g === t || g.replace("+", "POS").replace("-", "NEG") === t);
  if (hit) return hit;
  const map: Record<string, string> = {
    "A POSITIVE": "A+",
    "A NEGATIVE": "A-",
    "B POSITIVE": "B+",
    "B NEGATIVE": "B-",
    "AB POSITIVE": "AB+",
    "AB NEGATIVE": "AB-",
    "O POSITIVE": "O+",
    "O NEGATIVE": "O-",
    APOS: "A+",
    ANEG: "A-",
    BPOS: "B+",
    BNEG: "B-",
    ABPOS: "AB+",
    ABNEG: "AB-",
    OPOS: "O+",
    ONEG: "O-",
  };
  return map[t] || map[raw.trim().toUpperCase()] || t;
}

function extractTaggedSlots(
  historyText: string,
  ui: BloodDonorAiSettings["ui"],
): Partial<BloodDonorAiSlots> {
  const out: Partial<BloodDonorAiSlots> = {};
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const qTag = esc(ui.question_tag);
  const aTag = esc(ui.answer_inline);
  const pairRe = new RegExp(
    `${qTag}\\s*(.+?)\\n${aTag}\\s*(.+?)(?=\\n\\n|${qTag}|\\[Answer\\]|$)`,
    "gis",
  );
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(historyText)) !== null) {
    const q = m[1]!.trim();
    const a = m[2]!.trim();
    if (!a) continue;
    const isUpazilaQ = /উপজেলা|upazila|এলাকা/i.test(q);
    const isDistrictQ = /জেলা|district/i.test(q) && !isUpazilaQ;
    if (isUpazilaQ) out.upazila = parseUpazilaSlotInput(a);
    else if (isDistrictQ) out.district = a;
    else if (/রক্ত|blood|গ্রুপ|group/i.test(q)) out.blood_group = normalizeBloodGroup(a);
    else if (/ব্যাগ|bags/i.test(q)) out.bags = a;
    else if (/urgency|জরুরি|critical|urgent|normal/i.test(q)) out.urgency = a;
    else if (/notes|নোট/i.test(q)) out.notes = a;
  }
  return out;
}

function mergeSlots(
  base: BloodDonorAiSlots,
  fromModel: Partial<BloodDonorAiSlots>,
  historyText: string,
  ui: BloodDonorAiSettings["ui"],
): BloodDonorAiSlots {
  const next = { ...base };
  for (const key of Object.keys(next) as (keyof BloodDonorAiSlots)[]) {
    const v = asString(fromModel[key]);
    if (v) {
      if (key === "blood_group") next[key] = normalizeBloodGroup(v);
      else if (key === "upazila") next[key] = parseUpazilaSlotInput(v);
      else next[key] = v;
    }
  }
  const tagged = extractTaggedSlots(historyText, ui);
  for (const key of Object.keys(tagged) as (keyof BloodDonorAiSlots)[]) {
    const v = tagged[key];
    if (v) next[key] = v;
  }
  // Soft extract from tagged answers / free text
  const bgMatch = historyText.match(
    /\b(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)\b/i,
  );
  if (!next.blood_group && bgMatch) next.blood_group = normalizeBloodGroup(bgMatch[1]!);
  const bagsMatch = historyText.match(/(?:bags?|ব্যাগ)\s*[:：]?\s*(\d{1,2})/i);
  if (!next.bags && bagsMatch) next.bags = bagsMatch[1]!;
  const urgMatch = historyText.match(/\b(normal|urgent|critical|সাধারণ|জরুরি|জরুরী|অতি জরুরি)\b/i);
  if (!next.urgency && urgMatch) {
    const u = urgMatch[1]!.toLowerCase();
    next.urgency =
      /critical|অতি/.test(u) ? "critical" : /urgent|জরুরি|জরুরী/.test(u) ? "urgent" : "normal";
  }
  if (!isUpazilaSlotSet(next.upazila)) {
    const upAll = historyText.match(
      /(?:উপজেলা|upazila)[^\n]{0,40}(?:সব|all|__all__)/i,
    );
    if (upAll) next.upazila = UPAZILA_ALL_SLOT;
  }
  return next;
}

function applySlotDefaults(
  slots: BloodDonorAiSlots,
  settings: BloodDonorAiSettings,
): BloodDonorAiSlots {
  const next = { ...slots };
  if (
    settings.defaults.upazila_all &&
    !isUpazilaSlotSet(next.upazila) &&
    settings.optional_slots.includes("upazila") &&
    !settings.required_slots.includes("upazila")
  ) {
    next.upazila = UPAZILA_ALL_SLOT;
  }
  return next;
}

function filterFilledQuestions(questions: string[], slots: BloodDonorAiSlots): string[] {
  return questions.filter((q) => {
    if (isUpazilaSlotSet(slots.upazila) && /উপজেলা|upazila|এলাকা/i.test(q)) return false;
    if (slots.district.trim() && /জেলা|district/i.test(q) && !/উপজেলা|upazila/i.test(q)) {
      return false;
    }
    if (slots.blood_group.trim() && /রক্ত|blood|গ্রুপ|group/i.test(q)) return false;
    if (slots.bags.trim() && /ব্যাগ|bags/i.test(q)) return false;
    if (slots.urgency.trim() && /urgency|জরুরি|critical|urgent|normal/i.test(q)) return false;
    return true;
  });
}

function missingRequired(
  slots: BloodDonorAiSlots,
  required: BloodDonorAiSlot[],
): BloodDonorAiSlot[] {
  return required.filter((s) => !slots[s]?.trim());
}

function defaultQuestions(
  missing: BloodDonorAiSlot[],
  lang: "bn" | "en",
): string[] {
  const map = lang === "bn" ? SLOT_QUESTION_BN : SLOT_QUESTION_EN;
  return missing.map((s) => map[s]);
}

function detectIntent(text: string, fallback: BloodDonorAiIntentAction): BloodDonorAiIntentAction {
  const t = text.toLowerCase();
  if (/sms|হোয়াটসঅ্যাপ|whatsapp|পাঠা/.test(t)) return "sms";
  if (/org|সংগঠন|organization|অর্গ/.test(t)) return "orgs";
  if (/list|তালিকা|donor|ডোনার/.test(t)) return "list";
  return fallback;
}

async function loadBloodDonorAiSettings(sb: SupabaseClient): Promise<BloodDonorAiSettings> {
  try {
    const { adminClient } = await import("@/lib/gemini-rotate.server");
    const { data } = await adminClient()
      .from("app_settings")
      .select("blood_donor_ai_settings")
      .eq("id", 1)
      .maybeSingle();
    return normalizeBloodDonorAiSettings(
      (data as { blood_donor_ai_settings?: unknown } | null)?.blood_donor_ai_settings,
    );
  } catch {
    const { data } = await sb
      .from("app_settings")
      .select("blood_donor_ai_settings")
      .eq("id", 1)
      .maybeSingle();
    return normalizeBloodDonorAiSettings(
      (data as { blood_donor_ai_settings?: unknown } | null)?.blood_donor_ai_settings,
    );
  }
}

async function resolveDistrictId(
  sb: SupabaseClient,
  label: string,
): Promise<{ id: string | null; name: string }> {
  const q = label.trim();
  if (!q) return { id: null, name: "" };
  try {
    const { adminClient } = await import("@/lib/gemini-rotate.server");
    const admin = adminClient();
    const { data } = await admin
      .from("districts")
      .select("id, name_bn, name_en, slug")
      .or(`name_bn.ilike.%${q}%,name_en.ilike.%${q}%,slug.ilike.%${q}%`)
      .limit(8);
    const rows = (data ?? []) as {
      id: string;
      name_bn: string;
      name_en: string;
      slug: string;
    }[];
    if (!rows.length) return { id: null, name: q };
    const lower = q.toLowerCase();
    const exact =
      rows.find(
        (r) =>
          r.name_bn.toLowerCase() === lower ||
          r.name_en.toLowerCase() === lower ||
          r.slug.toLowerCase() === lower,
      ) ?? rows[0]!;
    return { id: exact.id, name: exact.name_bn || exact.name_en };
  } catch {
    const { data } = await sb
      .from("districts")
      .select("id, name_bn, name_en")
      .ilike("name_en", `%${q}%`)
      .limit(5);
    const row = (data ?? [])[0] as { id: string; name_bn: string; name_en: string } | undefined;
    return row
      ? { id: row.id, name: row.name_bn || row.name_en }
      : { id: null, name: q };
  }
}

async function runDonorTools(opts: {
  sb: SupabaseClient;
  settings: BloodDonorAiSettings;
  slots: BloodDonorAiSlots;
  intent: BloodDonorAiIntentAction;
  lang: "bn" | "en";
  viewerId: string | null;
}): Promise<BloodDonorAiToolResults> {
  const { settings, slots, lang } = opts;
  const district = await resolveDistrictId(opts.sb, slots.district);
  const blood = normalizeBloodGroup(slots.blood_group);
  const upazilaFilter = upazilaFilterForQuery(slots.upazila);
  const max = settings.filters.max_donors;
  const availableOnly = settings.filters.available_only;

  const { adminClient } = await import("@/lib/gemini-rotate.server");
  const admin = adminClient();

  let donorQuery = admin
    .from("community_donors")
    .select(
      "id, org_id, full_name, phone, blood_group, gender, district_id, upazila, address, is_active, unavailable_until, districts(name_bn, name_en)",
    )
    .eq("is_active", true)
    .limit(Math.min(120, max * 3));
  if (blood) donorQuery = donorQuery.eq("blood_group", blood);
  if (district.id) donorQuery = donorQuery.eq("district_id", district.id);
  if (upazilaFilter) donorQuery = donorQuery.ilike("upazila", `%${upazilaFilter}%`);
  if (settings.filters.gender !== "any") {
    donorQuery = donorQuery.eq("gender", settings.filters.gender);
  }

  const { data: donorRows } = await donorQuery;
  type DonorRow = {
    id: string;
    full_name: string;
    phone: string;
    blood_group: string | null;
    gender: string | null;
    upazila: string | null;
    unavailable_until?: string | null;
    districts?:
      | { name_bn: string; name_en: string }
      | { name_bn: string; name_en: string }[]
      | null;
  };
  let donors: BloodDonorAiDonorCard[] = ((donorRows ?? []) as unknown as DonorRow[])
    .filter((d) => !availableOnly || !isCommunityDonorUnavailable(d))
    .map((d) => {
      const dist = Array.isArray(d.districts) ? d.districts[0] : d.districts;
      return {
        id: d.id,
        name: d.full_name,
        phone: d.phone,
        blood_group: d.blood_group,
        gender: d.gender,
        upazila: d.upazila,
        district: dist
          ? lang === "bn"
            ? dist.name_bn
            : dist.name_en
          : district.name,
        source: "org" as const,
      };
    });

  if (settings.filters.include_app_users && district.id) {
    try {
      let profileQ = admin
        .from("profiles")
        .select(
          "id, full_name, phone, blood_group, gender, district_id, upazila, is_available, unavailable_until",
        )
        .eq("show_in_community", true)
        .not("phone", "is", null)
        .limit(Math.min(80, max));
      if (blood) profileQ = profileQ.eq("blood_group", blood);
      profileQ = profileQ.eq("district_id", district.id);
      if (upazilaFilter) profileQ = profileQ.ilike("upazila", `%${upazilaFilter}%`);
      if (settings.filters.gender !== "any") {
        profileQ = profileQ.eq("gender", settings.filters.gender);
      }
      if (availableOnly) {
        profileQ = profileQ.or("is_available.is.null,is_available.eq.true");
      }
      const { data: profiles } = await profileQ;
      const existingPhones = new Set(
        donors.map((d) => d.phone.replace(/\D/g, "")).filter((p) => p.length >= 10),
      );
      for (const p of (profiles ?? []) as {
        id: string;
        full_name: string | null;
        phone: string | null;
        blood_group: string | null;
        gender: string | null;
        upazila: string | null;
        is_available?: boolean | null;
        unavailable_until?: string | null;
      }[]) {
        if (availableOnly) {
          if (p.is_available === false) continue;
          if (isCommunityDonorUnavailable({ unavailable_until: p.unavailable_until })) continue;
        }
        const phone = (p.phone ?? "").trim();
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10 || existingPhones.has(digits)) continue;
        donors.push({
          id: `app:${p.id}`,
          name: p.full_name || (lang === "bn" ? "ডোনার" : "Donor"),
          phone,
          blood_group: p.blood_group,
          gender: p.gender,
          upazila: p.upazila,
          district: district.name,
          source: "app",
        });
        existingPhones.add(digits);
      }
    } catch {
      /* profiles filter columns may differ */
    }
  }

  donors = donors
    .filter((d) => (d.phone ?? "").replace(/\D/g, "").length >= 10)
    .slice(0, max);

  let orgs: BloodDonorAiOrgCard[] = [];
  if (settings.actions.show_orgs) {
    try {
      let q = admin
        .from("community_orgs")
        .select("id,name,name_bn,phone,district_id")
        .eq("is_active", true)
        .order("sort_order")
        .limit(30);
      if (district.id) q = q.eq("district_id", district.id);
      const { data } = await q;
      orgs = ((data ?? []) as {
        id: string;
        name: string;
        name_bn: string | null;
        phone: string | null;
        district_id: string | null;
      }[]).map((o) => ({
        id: o.id,
        name: lang === "bn" ? o.name_bn || o.name : o.name,
        phone: o.phone,
        district_id: o.district_id,
      }));
    } catch {
      orgs = [];
    }
  }

  let sms_body = "";
  if (settings.messaging.use_messaging_templates) {
    try {
      const { data } = await admin
        .from("app_settings")
        .select("messaging_settings")
        .eq("id", 1)
        .maybeSingle();
      const msg = normalizeMessagingSettings(
        (data as { messaging_settings?: unknown } | null)?.messaging_settings,
      );
      const tpl = lang === "bn" ? msg.community_sms_bn : msg.community_sms_en;
      sms_body = applySmsTemplate(tpl, {
        blood_group: blood,
        patient_name: lang === "bn" ? "রোগী" : "Patient",
        hospital: "",
        upazila: upazilaFilter || upazilaSlotLabel(slots.upazila || UPAZILA_ALL_SLOT, lang),
        district: district.name || slots.district,
        bags: slots.bags || "1",
        urgency: slots.urgency || "urgent",
        notes: slots.notes,
        reason: "",
        link: "",
      });
    } catch {
      sms_body = `${blood} blood needed — ${district.name || slots.district}`;
    }
  } else {
    sms_body = `${blood} blood needed — ${district.name || slots.district}`;
  }

  return {
    donors: settings.actions.show_list || settings.actions.open_sms ? donors : [],
    orgs,
    sms_body,
    district_id: district.id,
    district_label: district.name || slots.district,
    blood_group: blood,
  };
}

function friendlyError(e: unknown, lang: "bn" | "en"): string {
  const msg = e instanceof Error ? e.message : String(e);
  const bn = lang === "bn";
  if (/disabled|Blood Donor AI is disabled/i.test(msg)) {
    return bn ? "Blood Donor AI বন্ধ আছে (Admin)।" : "Blood Donor AI is disabled in Admin.";
  }
  if (/No Gemini API keys/i.test(msg)) {
    return bn
      ? "Admin → Gemini API-তে key যোগ করুন।"
      : "Add a Gemini API key in Admin → Gemini API.";
  }
  if (/Gemini AI is disabled/i.test(msg)) {
    return bn ? "Gemini AI বন্ধ আছে।" : "Gemini AI is disabled.";
  }
  return bn ? `AI ব্যর্থ: ${msg.slice(0, 160)}` : `AI failed: ${msg.slice(0, 160)}`;
}

function buildSystemPrompt(settings: BloodDonorAiSettings, lang: "bn" | "en"): string {
  const base = lang === "bn" ? settings.prompts.system_bn : settings.prompts.system_en;
  const schema = `Return ONLY JSON:
{
  "reply": string,
  "questions": string[],
  "intent": "sms"|"list"|"orgs"|"auto",
  "slots": {
    "district": string,
    "blood_group": string,
    "upazila": string,
    "bags": string,
    "urgency": string,
    "notes": string
  },
  "ready_for_tools": boolean
}
Required slots: ${settings.required_slots.join(", ")}.
Optional: ${settings.optional_slots.join(", ") || "(none)"}.
Gender filter applied by server: ${settings.filters.gender}.
Upazila slot: use "${UPAZILA_ALL_SLOT}" when user wants all upazilas / whole district (সব / all).
Default upazila when unset: ${settings.defaults.upazila_all ? UPAZILA_ALL_SLOT : "(ask user)"}.
Never invent phone numbers.`;
  return `${base}\n\n${schema}`;
}

export const fetchBloodDonorAiPublicConfig = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((data: { lang?: "bn" | "en" }) => ({
    lang: data?.lang === "en" ? ("en" as const) : ("bn" as const),
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (opts: any): Promise<BloodDonorAiPublicConfig> => {
    const context = opts.context as AiAuthContext;
    const settings = await loadBloodDonorAiSettings(context.supabase);
    return toPublicBloodDonorAiConfig(settings);
  });

export const bloodDonorAiChat = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((data: { messages: BloodDonorAiChatMessage[]; lang?: "bn" | "en"; intentHint?: string }) => {
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const cleaned: BloodDonorAiChatMessage[] = messages
      .slice(-12)
      .map((m) => ({
        role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
        text: String(m?.text ?? "").trim().slice(0, 2000),
      }))
      .filter((m) => m.text);
    if (!cleaned.length) throw new Error("Message required");
    return {
      messages: cleaned,
      lang: data?.lang === "en" ? ("en" as const) : ("bn" as const),
      intentHint: String(data?.intentHint ?? "").slice(0, 40),
    };
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (opts: any): Promise<BloodDonorAiChatResult> => {
    const context = opts.context as AiAuthContext;
    const data = opts.data as {
      messages: BloodDonorAiChatMessage[];
      lang: "bn" | "en";
      intentHint: string;
    };
    try {
      const settings = await loadBloodDonorAiSettings(context.supabase);
      if (!settings.enabled) {
        throw new Error("Blood Donor AI is disabled");
      }

      const historyText = data.messages.map((m) => m.text).join("\n");
      const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.text ?? "";

      const { geminiGenerate } = await import("@/lib/gemini-rotate.server");
      const userBlock = data.messages
        .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.text}`)
        .join("\n\n");

      let parsed: Record<string, unknown> = {};
      try {
        const rawText = await geminiGenerate({
          systemText: buildSystemPrompt(settings, data.lang),
          userText: userBlock,
          json: true,
          modelRole: "primary",
        });
        parsed = parseJsonObject(rawText);
      } catch {
        parsed = {
          reply:
            data.lang === "bn"
              ? "জেলা ও রক্তের গ্রুপ বলুন — আমি ডোনার খুঁজে দেব।"
              : "Tell me district and blood group — I will find donors.",
          questions: [],
          intent: "auto",
          slots: {},
          ready_for_tools: false,
        };
      }

      const slotsRaw =
        parsed.slots && typeof parsed.slots === "object"
          ? (parsed.slots as Partial<BloodDonorAiSlots>)
          : {};
      let slots = mergeSlots(emptySlots(), slotsRaw, historyText, settings.ui);
      slots = applySlotDefaults(slots, settings);
      let intent = asString(parsed.intent) as BloodDonorAiIntentAction;
      if (intent !== "sms" && intent !== "list" && intent !== "orgs" && intent !== "auto") {
        intent = "auto";
      }
      if (data.intentHint === "sms" || data.intentHint === "list" || data.intentHint === "orgs") {
        intent = data.intentHint;
      } else {
        intent = detectIntent(lastUser, intent);
      }

      const missing = missingRequired(slots, settings.required_slots);
      let questions = Array.isArray(parsed.questions)
        ? parsed.questions.map((q) => asString(q)).filter(Boolean).slice(0, 6)
        : [];
      questions = filterFilledQuestions(questions, slots);
      let ready =
        parsed.ready_for_tools === true ||
        (missing.length === 0 && !!slots.district.trim() && !!slots.blood_group.trim());

      if (missing.length) {
        ready = false;
        if (!questions.length) questions = defaultQuestions(missing, data.lang);
        questions = filterFilledQuestions(questions, slots);
      }

      let reply = asString(parsed.reply);
      if (!reply) {
        reply =
          data.lang === "bn"
            ? "আরও তথ্য দিন যাতে ডোনার খুঁজে দিতে পারি।"
            : "Please share more details so I can find donors.";
      }

      let tool_results: BloodDonorAiToolResults | null = null;
      if (ready && missing.length === 0) {
        tool_results = await runDonorTools({
          sb: context.supabase,
          settings,
          slots,
          intent,
          lang: data.lang,
          viewerId: context.userId,
        });
        if (intent === "orgs" && !settings.actions.show_list) {
          tool_results = { ...tool_results, donors: [] };
        }
        if (data.lang === "bn") {
          reply = `${reply}\n\nজেলা: ${tool_results.district_label} · গ্রুপ: ${tool_results.blood_group} · ডোনার: ${tool_results.donors.length}${
            tool_results.orgs.length ? ` · অর্গ: ${tool_results.orgs.length}` : ""
          }`;
        } else {
          reply = `${reply}\n\nDistrict: ${tool_results.district_label} · Group: ${tool_results.blood_group} · Donors: ${tool_results.donors.length}${
            tool_results.orgs.length ? ` · Orgs: ${tool_results.orgs.length}` : ""
          }`;
        }
        questions = [];
      }

      return {
        reply,
        questions,
        intent,
        slots,
        ready_for_tools: !!tool_results,
        tool_results,
      };
    } catch (e) {
      return {
        reply: friendlyError(e, data.lang),
        questions: [],
        intent: "auto",
        slots: emptySlots(),
        ready_for_tools: false,
        tool_results: null,
      };
    }
  });
