import { supabase } from "@/integrations/supabase/client";

export type LocalizedText = { bn: string; en: string };

export type NeedReasonCategory = {
  id: string;
  label: LocalizedText;
  /** Note suggestion chips — bilingual */
  suggestions: LocalizedText[];
  is_active: boolean;
  sort_order: number;
};

/** Force reason/suggestion language in composer regardless of app UI language */
export type NeedReasonDisplayLang = "app" | "bn" | "en";

export type NeedReasonCatalog = {
  display_lang: NeedReasonDisplayLang;
  categories: NeedReasonCategory[];
};

/** Expert defaults: common blood-need causes in BD hospitals + practical note chips */
export const DEFAULT_NEED_REASON_CATEGORIES: NeedReasonCategory[] = [
  {
    id: "surgery",
    label: { bn: "অস্ত্রোপচার / অপারেশন", en: "Surgery / Operation" },
    suggestions: [
      {
        bn: "রোগীর জরুরি অস্ত্রোপচার আছে। অপারেশনের আগে/সময় রক্তের প্রয়োজন। দয়া করে সাড়া দিন।",
        en: "Patient has urgent surgery. Blood needed before/during the operation. Please respond.",
      },
      {
        bn: "অপারেশন চলমান/নির্ধারিত। প্রয়োজনীয় ব্যাগ দ্রুত সংগ্রহ করতে হবে।",
        en: "Surgery is scheduled/ongoing. Bags must be collected quickly.",
      },
      {
        bn: "হাসপাতালে রক্তের স্টক কম। সার্জারির জন্য ম্যাচিং ডোনার খুঁজছি।",
        en: "Hospital blood stock is low. Looking for a matching donor for surgery.",
      },
    ],
    is_active: true,
    sort_order: 10,
  },
  {
    id: "accident",
    label: { bn: "দুর্ঘটনা / ট্রমা", en: "Accident / Trauma" },
    suggestions: [
      {
        bn: "রোড অ্যাক্সিডেন্ট/আঘাতজনিত রক্তক্ষরণ। রোগী সংকটাপন্ন, জরুরি রক্ত দরকার।",
        en: "Road accident / traumatic bleeding. Patient critical — urgent blood needed.",
      },
      {
        bn: "ইমারজেন্সিতে ভর্তি। রক্তপাত নিয়ন্ত্রণ ও স্থিতিশীলতার জন্য রক্ত প্রয়োজন।",
        en: "Admitted to ER. Blood needed to control bleeding and stabilize the patient.",
      },
      {
        bn: "মাল্টিপল ইনজুরি। অপারেশন থিয়েটারে রক্তের চাহিদা বেশি।",
        en: "Multiple injuries. High blood demand in the OT.",
      },
    ],
    is_active: true,
    sort_order: 20,
  },
  {
    id: "pregnancy",
    label: { bn: "গর্ভধারণ / প্রসব / পিপিএইচ", en: "Pregnancy / Delivery / PPH" },
    suggestions: [
      {
        bn: "প্রসব/সিজারিয়ান—রক্তপাতের ঝুঁকি। মায়ের জন্য জরুরি রক্ত প্রয়োজন।",
        en: "Delivery/C-section with bleeding risk. Urgent blood needed for mother.",
      },
      {
        bn: "পোস্টপার্টাম হেমোরেজ (PPH)। মায়ের অবস্থা জটিল, দ্রুত রক্ত দরকার।",
        en: "Postpartum hemorrhage (PPH). Mother unstable — blood needed immediately.",
      },
      {
        bn: "অ্যান্টেনেটাল হিমোরেজ। গর্ভবতী মায়ের জন্য রক্ত সংগ্রহ করছি।",
        en: "Antenatal hemorrhage. Collecting blood for a pregnant mother.",
      },
    ],
    is_active: true,
    sort_order: 30,
  },
  {
    id: "anemia",
    label: { bn: "রক্তশূন্যতা (অ্যানিমিয়া)", en: "Severe anemia" },
    suggestions: [
      {
        bn: "গুরুতর অ্যানিমিয়া। হিমোগ্লোবিন খুব কম—ট্রান্সফিউশন জরুরি।",
        en: "Severe anemia. Hemoglobin is very low — transfusion urgently needed.",
      },
      {
        bn: "দুর্বলতা ও শ্বাসকষ্টসহ অ্যানিমিয়া। চিকিৎসকের পরামর্শে রক্ত প্রয়োজন।",
        en: "Anemia with weakness/shortness of breath. Blood advised by doctor.",
      },
      {
        bn: "প্রি-অপারেটিভ অ্যানিমিয়া কারেকশনের জন্য রক্ত খুঁজছি।",
        en: "Looking for blood to correct pre-operative anemia.",
      },
    ],
    is_active: true,
    sort_order: 40,
  },
  {
    id: "thalassemia",
    label: { bn: "থ্যালাসেমিয়া", en: "Thalassemia" },
    suggestions: [
      {
        bn: "থ্যালাসেমিয়া রোগীর নিয়মিত ট্রান্সফিউশন দরকার। আজকের সিডিউলের জন্য রক্ত খুঁজছি।",
        en: "Thalassemia patient needs regular transfusion. Looking for today’s scheduled bags.",
      },
      {
        bn: "শিশু থ্যালাসেমিয়া রোগী। নিরাপদ ম্যাচড রক্ত প্রয়োজন।",
        en: "Pediatric thalassemia patient. Need safely matched blood.",
      },
      {
        bn: "হিমোগ্লোবিন কমে গেছে। থ্যালাসেমিয়া ট্রান্সফিউশনের জন্য সাহায্য প্রার্থী।",
        en: "Hemoglobin dropped. Seeking help for thalassemia transfusion.",
      },
    ],
    is_active: true,
    sort_order: 50,
  },
  {
    id: "cancer",
    label: { bn: "ক্যান্সার / কেমোথেরাপি", en: "Cancer / Chemotherapy" },
    suggestions: [
      {
        bn: "ক্যান্সার চিকিৎসা/কেমোর সময় রক্তকণিকা কমেছে। ট্রান্সফিউশন দরকার।",
        en: "Blood counts dropped during cancer treatment/chemo. Transfusion needed.",
      },
      {
        bn: "অনকোলজি ওয়ার্ডের রোগী। প্লেটলেট/লাল রক্তকণিকার জন্য সহায়তা চাই।",
        en: "Oncology ward patient. Need support for RBC/platelet transfusion.",
      },
      {
        bn: "টিউমার সার্জারির আগে/পরে রক্তের প্রয়োজন।",
        en: "Blood needed before/after tumor surgery.",
      },
    ],
    is_active: true,
    sort_order: 60,
  },
  {
    id: "dengue",
    label: { bn: "ডেঙ্গু / ভাইরাল জ্বর", en: "Dengue / Viral fever" },
    suggestions: [
      {
        bn: "ডেঙ্গুতে প্লেটলেট/রক্তচাপ কমেছে। জরুরি রক্ত/প্লেটলেট প্রয়োজন।",
        en: "Dengue with falling platelets/pressure. Urgent blood/platelets needed.",
      },
      {
        bn: "ডেঙ্গু হেমোরেজিক জ্বর—রক্তপাতের ঝুঁকি। দ্রুত সাড়া দিন।",
        en: "Dengue hemorrhagic fever — bleeding risk. Please respond quickly.",
      },
      {
        bn: "হাসপাতালে ডেঙ্গু রোগী। ট্রান্সফিউশনের জন্য ম্যাচিং ডোনার খুঁজছি।",
        en: "Dengue patient in hospital. Looking for a matching donor for transfusion.",
      },
    ],
    is_active: true,
    sort_order: 70,
  },
  {
    id: "dialysis",
    label: { bn: "কিডনি রোগ / ডায়ালিসিস", en: "Kidney disease / Dialysis" },
    suggestions: [
      {
        bn: "কিডনি রোগী/ডায়ালিসিস চলাকালীন অ্যানিমিয়া। রক্ত ট্রান্সফিউশন দরকার।",
        en: "Kidney patient/dialysis-related anemia. Blood transfusion needed.",
      },
      {
        bn: "রেনাল ফেইলিউর রোগীর হিমোগ্লোবিন কম। দয়া করে সাহায্য করুন।",
        en: "Renal failure patient with low hemoglobin. Please help.",
      },
      {
        bn: "কিডনি সার্জারির প্রস্তুতিতে রক্ত সংগ্রহ করছি।",
        en: "Collecting blood in preparation for kidney surgery.",
      },
    ],
    is_active: true,
    sort_order: 80,
  },
  {
    id: "liver",
    label: { bn: "লিভার রোগ", en: "Liver disease" },
    suggestions: [
      {
        bn: "লিভার সিরোসিস/লিভার রোগে রক্তপাত। ক্লোটিং সাপোর্টের জন্য রক্ত দরকার।",
        en: "Bleeding due to liver cirrhosis/disease. Blood needed for clotting support.",
      },
      {
        bn: "লিভার সার্জারির আগে/পরে রক্তের চাহিদা।",
        en: "Blood required before/after liver surgery.",
      },
      {
        bn: "গ্যাস্ট্রিক/ইসোফেজিয়াল ভ্যারিক্স ব্লিডিং। জরুরি রক্ত প্রয়োজন।",
        en: "Gastric/esophageal variceal bleeding. Urgent blood needed.",
      },
    ],
    is_active: true,
    sort_order: 90,
  },
  {
    id: "heart",
    label: { bn: "হার্ট সার্জারি / কার্ডিয়াক", en: "Heart surgery / Cardiac" },
    suggestions: [
      {
        bn: "কার্ডিয়াক সার্জারির জন্য একাধিক ব্যাগ রক্ত প্রয়োজন হতে পারে।",
        en: "Cardiac surgery may require multiple blood bags.",
      },
      {
        bn: "হার্টের অপারেশন নির্ধারিত। ম্যাচিং ডোনার জরুরি।",
        en: "Heart operation scheduled. Matching donor urgently needed.",
      },
      {
        bn: "কার্ডিয়াক ওয়ার্ডের রোগী—পোস্ট-অপ রক্তক্ষরণ সাপোর্ট।",
        en: "Cardiac ward patient — post-op bleeding support needed.",
      },
    ],
    is_active: true,
    sort_order: 100,
  },
  {
    id: "pediatric",
    label: { bn: "শিশু রোগী", en: "Pediatric patient" },
    suggestions: [
      {
        bn: "শিশু রোগীর জন্য নিরাপদ ম্যাচড রক্ত জরুরি। দয়া করে সাড়া দিন।",
        en: "Safely matched blood urgently needed for a child. Please respond.",
      },
      {
        bn: "পেডিয়াট্রিক ওয়ার্ড। শিশুর অস্ত্রোপচার/অ্যানিমিয়ার জন্য রক্ত খুঁজছি।",
        en: "Pediatric ward. Looking for blood for a child’s surgery/anemia.",
      },
      {
        bn: "কম বয়সী রোগী—দ্রুত ও নিরাপদ ট্রান্সফিউশন প্রয়োজন।",
        en: "Young patient — need fast, safe transfusion support.",
      },
    ],
    is_active: true,
    sort_order: 110,
  },
  {
    id: "gi_bleed",
    label: { bn: "পেটের রক্তপাত (GI bleed)", en: "GI bleeding" },
    suggestions: [
      {
        bn: "অ্যান্টেরিয়র/গ্যাস্ট্রিক ব্লিডিং। রোগীর হিমোগ্লোবিন দ্রুত কমছে।",
        en: "GI/gastric bleeding. Patient’s hemoglobin is dropping fast.",
      },
      {
        bn: "মেলেনা/হেমাটেমিসিস। স্টেবিলাইজেশনের জন্য রক্ত দরকার।",
        en: "Melena/hematemesis. Blood needed for stabilization.",
      },
      {
        bn: "এন্ডোস্কপি/অপারেশনের সময় রক্তের প্রস্তুতি নিতে হবে।",
        en: "Need blood ready for endoscopy/operation.",
      },
    ],
    is_active: true,
    sort_order: 120,
  },
  {
    id: "burn",
    label: { bn: "পোড়া / বার্ন", en: "Burn injury" },
    suggestions: [
      {
        bn: "বার্ন ইনজুরি রোগী। রক্ত/প্লাজমা সাপোর্ট প্রয়োজন হতে পারে।",
        en: "Burn injury patient. May need blood/plasma support.",
      },
      {
        bn: "গুরুতর পোড়া—সার্জিক্যাল ম্যানেজমেন্টের জন্য রক্ত খুঁজছি।",
        en: "Severe burns — looking for blood for surgical management.",
      },
    ],
    is_active: true,
    sort_order: 130,
  },
  {
    id: "other",
    label: { bn: "অন্যান্য", en: "Other" },
    suggestions: [
      {
        bn: "রোগীর চিকিৎসায় রক্ত প্রয়োজন। বিস্তারিত নোটে উল্লেখ করা হয়েছে।",
        en: "Patient needs blood for treatment. Details mentioned in notes.",
      },
      {
        bn: "হাসপাতালে জরুরি রক্তের চাহিদা। ম্যাচিং ডোনারের সহায়তা চাই।",
        en: "Urgent hospital blood need. Seeking a matching donor’s help.",
      },
      {
        bn: "দয়া করে যোগাযোগ করুন—সময় ও স্থান নোটে দেওয়া আছে।",
        en: "Please contact us — time and place are in the notes.",
      },
    ],
    is_active: true,
    sort_order: 900,
  },
];

export const DEFAULT_NEED_REASON_CATALOG: NeedReasonCatalog = {
  display_lang: "app",
  categories: DEFAULT_NEED_REASON_CATEGORIES.map((c) => ({
    ...c,
    label: { ...c.label },
    suggestions: c.suggestions.map((s) => ({ ...s })),
  })),
};

const CUSTOM_ID = "custom";

export function isCustomNeedReason(id: string | null | undefined) {
  return id === CUSTOM_ID;
}

export const NEED_REASON_CUSTOM_ID = CUSTOM_ID;

function slugify(raw: string) {
  return (
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0980-\u09FF]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `cat-${Date.now().toString(36)}`
  );
}

export function newNeedReasonId(labelEn?: string) {
  return slugify(labelEn || `reason-${Date.now().toString(36)}`);
}

export function pickLocalized(text: LocalizedText, lang: "bn" | "en") {
  return lang === "bn" ? text.bn || text.en : text.en || text.bn;
}

function normalizeSuggestion(raw: unknown): LocalizedText | null {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) return { bn: raw.trim(), en: raw.trim() };
    return null;
  }
  const o = raw as Record<string, unknown>;
  const bn = typeof o.bn === "string" ? o.bn.trim() : "";
  const en = typeof o.en === "string" ? o.en.trim() : "";
  if (!bn && !en) return null;
  return { bn: bn || en, en: en || bn };
}

export function normalizeNeedReasonCategory(
  raw: Partial<NeedReasonCategory> | null | undefined,
  index = 0,
): NeedReasonCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const labelBn =
    typeof raw.label === "object" && raw.label && typeof raw.label.bn === "string"
      ? raw.label.bn.trim()
      : "";
  const labelEn =
    typeof raw.label === "object" && raw.label && typeof raw.label.en === "string"
      ? raw.label.en.trim()
      : "";
  if (!labelBn && !labelEn) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim() && raw.id !== CUSTOM_ID
      ? raw.id.trim()
      : newNeedReasonId(labelEn || labelBn);
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.map(normalizeSuggestion).filter((s): s is LocalizedText => !!s)
    : [];
  return {
    id,
    label: { bn: labelBn || labelEn, en: labelEn || labelBn },
    suggestions,
    is_active: raw.is_active !== false,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : (index + 1) * 10,
  };
}

export function resolveNeedReasonLang(
  displayLang: NeedReasonDisplayLang | undefined,
  appLang: "bn" | "en",
): "bn" | "en" {
  if (displayLang === "bn" || displayLang === "en") return displayLang;
  return appLang;
}

export function normalizeNeedReasonCatalog(raw: unknown): NeedReasonCatalog {
  const r = raw && typeof raw === "object" ? (raw as { categories?: unknown; display_lang?: unknown }) : {};
  const display_lang: NeedReasonDisplayLang =
    r.display_lang === "bn" || r.display_lang === "en" || r.display_lang === "app"
      ? r.display_lang
      : "app";
  const list = Array.isArray(r.categories) ? r.categories : [];
  const categories = list
    .map((c, i) => normalizeNeedReasonCategory(c as Partial<NeedReasonCategory>, i))
    .filter((c): c is NeedReasonCategory => !!c)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.en.localeCompare(b.label.en));

  if (categories.length === 0) {
    return {
      display_lang,
      categories: DEFAULT_NEED_REASON_CATEGORIES.map((c) => ({
        ...c,
        label: { ...c.label },
        suggestions: c.suggestions.map((s) => ({ ...s })),
      })),
    };
  }
  return { display_lang, categories };
}

export function activeNeedReasons(catalog: NeedReasonCatalog) {
  return catalog.categories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
}

let cached: NeedReasonCatalog | null = null;
let cachedAt = 0;
let inflight: Promise<NeedReasonCatalog> | null = null;

export function invalidateNeedReasonCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export async function fetchNeedReasonCatalog(force = false): Promise<NeedReasonCatalog> {
  if (!force && cached && Date.now() - cachedAt < 120_000) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("need_reason_catalog")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      cached = normalizeNeedReasonCatalog(null);
    } else {
      cached = normalizeNeedReasonCatalog(
        (data as { need_reason_catalog?: unknown }).need_reason_catalog,
      );
    }
    cachedAt = Date.now();
    inflight = null;
    return cached!;
  })();

  return inflight;
}

export async function saveNeedReasonCatalog(catalog: NeedReasonCatalog) {
  const normalized = normalizeNeedReasonCatalog(catalog);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    need_reason_catalog: normalized,
  });
  if (!error) {
    cached = normalized;
    cachedAt = Date.now();
  }
  return { error, catalog: normalized };
}
