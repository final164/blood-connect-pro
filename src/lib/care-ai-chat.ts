import { createServerFn } from "@tanstack/react-start";
import { optionalSupabaseAuth } from "@/lib/optional-supabase-auth";
import {
  buildChatSystemPrompt,
  buildPrescriptionSystemPrompt,
  getPublicAiConfig,
  normalizeGeminiSettingsExtended,
  type CareAiPublicConfig,
} from "@/lib/gemini-ai-config";
export type { CareAiPublicConfig } from "@/lib/gemini-ai-config";
import { fillPrompt } from "@/lib/gemini-shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CareAiChatMessage = { role: "user" | "assistant"; text: string };

export type CareAiSuggestedTest = { catalog_id: string; code: string; reason: string };

export type CareAiSuggestedSpecialty = {
  specialty_id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  reason: string;
};

export type CareAiExpertAnalysis = {
  urgency: "routine" | "soon" | "urgent" | "emergency";
  red_flags: string[];
  likely_systems: string[];
  analysis_summary: string;
};

export type CareAiMedicine = {
  name_as_written: string;
  suggested_name: string;
  dose: string;
  frequency: string;
  timing: string;
  duration: string;
  notes: string;
};

export type CareAiChatImage = { mimeType: string; data: string };

export type CareAiChatResult = {
  reply: string;
  medical_advice: string;
  catalog_notes: string;
  questions: string[];
  suggested_tests: CareAiSuggestedTest[];
  suggested_specialties: CareAiSuggestedSpecialty[];
  expert_analysis: CareAiExpertAnalysis | null;
  first_aid: string[];
  medicines: CareAiMedicine[];
  offer_bundle: boolean;
  from_prescription: boolean;
};

type CatalogRow = {
  id: string;
  code: string;
  name_bn: string;
  name_en: string;
  category_id: string | null;
};

type SpecialtyRow = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
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

function friendlyAiError(e: unknown, lang: "bn" | "en"): string {
  const msg = e instanceof Error ? e.message : String(e);
  const bn = lang === "bn";
  if (/No Gemini API keys/i.test(msg)) {
    return bn
      ? "Admin → Settings → Gemini API-তে API key যোগ করুন।"
      : "Add a Gemini API key in Admin → Settings → Gemini API.";
  }
  if (/does not exist|schema cache|gemini_api_keys|gemini_settings/i.test(msg)) {
    return bn ? "Supabase-এ Gemini SQL migration চালান।" : "Run the Gemini SQL migration in Supabase.";
  }
  if (/SERVICE_ROLE|Server auth is not configured/i.test(msg)) {
    return bn ? "সার্ভারে SUPABASE_SERVICE_ROLE_KEY সেট নেই।" : "Set SUPABASE_SERVICE_ROLE_KEY on the server.";
  }
  if (/disabled/i.test(msg)) {
    return bn ? "Admin-এ Gemini AI বন্ধ আছে — চালু করুন।" : "Gemini AI is disabled in Admin. Turn it on.";
  }
  if (/404|not found for api version|is not found/i.test(msg)) {
    return bn
      ? "এই মডেল API-তে নেই। Admin-এ Primary মডেল বদলান (gemini-3.6-flash)।"
      : "That model is not available. Change Primary in Admin (gemini-3.6-flash).";
  }
  if (/API_KEY_INVALID|API key not valid|401|403/i.test(msg)) {
    return bn ? "Gemini API key অবৈধ। Admin-এ key এডিট করে নতুন key দিন।" : "Gemini API key is invalid. Update it in Admin.";
  }
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return bn ? "সব API key-এর কোটা শেষ। অন্য key যোগ করুন।" : "All Gemini keys hit quota. Add another key.";
  }
  if (/Empty Gemini|blocked/i.test(msg)) {
    return bn ? "মডেল খালি/ব্লকড উত্তর দিয়েছে। অন্য মডেল চেষ্টা করুন।" : "The model returned an empty or blocked reply. Try another model.";
  }
  if (/non-JSON|invalid JSON/i.test(msg)) {
    return bn ? "AI উত্তর পার্স করা যায়নি। অন্য মডেল চেষ্টা করুন।" : "Could not parse the AI reply. Try another model.";
  }
  return bn ? `AI কাজ করেনি: ${msg.slice(0, 180)}` : `AI failed: ${msg.slice(0, 180)}`;
}

function asString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function parseMedicines(raw: unknown, max: number): CareAiMedicine[] {
  if (!Array.isArray(raw) || max <= 0) return [];
  const out: CareAiMedicine[] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name_as_written = asString(row.name_as_written) || asString(row.name) || asString(row.drug);
    const suggested_name =
      asString(row.suggested_name) || asString(row.clarified_name) || name_as_written;
    if (!name_as_written && !suggested_name) continue;
    out.push({
      name_as_written: name_as_written.slice(0, 120),
      suggested_name: suggested_name.slice(0, 120),
      dose: asString(row.dose).slice(0, 80),
      frequency: asString(row.frequency).slice(0, 80),
      timing: asString(row.timing || row.when).slice(0, 120),
      duration: asString(row.duration).slice(0, 80),
      notes: asString(row.notes).slice(0, 200),
    });
  }
  return out;
}

function sanitizeChatImages(raw: unknown, maxImages: number): CareAiChatImage[] {
  if (!Array.isArray(raw) || maxImages <= 0) return [];
  const out: CareAiChatImage[] = [];
  for (const item of raw) {
    if (out.length >= maxImages) break;
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const mimeType = asString(row.mimeType || row.mime_type).toLowerCase();
    let data = asString(row.data);
    if (!data) continue;
    data = data.replace(/^data:[^;]+;base64,/, "");
    if (!/^(image\/(jpeg|jpg|png|webp|heic|heif))$/.test(mimeType) && !mimeType.startsWith("image/")) {
      continue;
    }
    // ~4MB base64 ≈ 3MB binary — reject absurd payloads
    if (data.length > 5_500_000) continue;
    out.push({ mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType, data });
  }
  return out;
}

async function loadCatalog(sb: SupabaseClient, limit: number): Promise<CatalogRow[]> {
  const { data, error } = await sb
    .from("care_test_catalog")
    .select("id, code, name_bn, name_en, category_id")
    .eq("is_active", true)
    .order("sort_order")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogRow[];
}

function compactCatalog(catalog: CatalogRow[]) {
  return catalog.map((c) => `${c.id}|${c.code}|${c.name_bn}|${c.name_en}`).join("\n");
}

function compactSpecialties(rows: SpecialtyRow[]) {
  if (!rows.length) return "(none)";
  return rows.map((s) => `${s.id}|${s.slug}|${s.name_bn}|${s.name_en}`).join("\n");
}

async function loadSpecialties(sb: SupabaseClient): Promise<SpecialtyRow[]> {
  const { data, error } = await sb
    .from("care_specialties")
    .select("id, slug, name_bn, name_en")
    .eq("is_active", true)
    .order("sort_order")
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []) as SpecialtyRow[];
}

async function loadSpecialtiesForAi(sb: SupabaseClient, _isGuest: boolean): Promise<SpecialtyRow[]> {
  // Prefer service role so RLS never blanks the specialty list used in prompts.
  try {
    const { adminClient } = await import("@/lib/gemini-rotate.server");
    return loadSpecialties(adminClient() as unknown as SupabaseClient);
  } catch {
    return loadSpecialties(sb);
  }
}

function resolveAgainstSpecialties(
  raw: unknown,
  specialties: SpecialtyRow[],
  max: number,
): CareAiSuggestedSpecialty[] {
  const byId = new Map(specialties.map((s) => [s.id, s]));
  const bySlug = new Map(specialties.map((s) => [s.slug.trim().toLowerCase(), s]));
  const byName = new Map<string, SpecialtyRow>();
  for (const s of specialties) {
    byName.set(s.name_en.trim().toLowerCase(), s);
    byName.set(s.name_bn.trim().toLowerCase(), s);
  }

  function fuzzyName(name: string): SpecialtyRow | undefined {
    const n = name.trim().toLowerCase();
    if (!n || n.length < 2) return undefined;
    const exact = byName.get(n);
    if (exact) return exact;
    // common aliases
    const aliases: Record<string, string[]> = {
      cardiology: ["কার্ডিও", "হার্ট", "হৃদ", "cardio", "heart"],
      medicine: ["মেডিসিন", "ইন্টারনাল", "general medicine", "মেডিকেল"],
      gynecology: ["গাইনি", "স্ত্রী", "গর্ভ", "obgyn", "gynae", "gyne"],
      pediatrics: ["পেডিয়া", "শিশু", "child", "kids"],
      ent: ["নাক কান গলা", "নাক-কান", "otorhinolaryngology"],
      orthopedics: ["অর্থো", "হাড়", "joint", "ortho", "হাড়"],
      dermatology: ["ডার্মা", "চর্ম", "skin", "চুল"],
      general: ["জেনারেল", "সাধারণ", "gp", "family"],
    };
    for (const s of specialties) {
      const slug = s.slug.trim().toLowerCase();
      const en = s.name_en.trim().toLowerCase();
      const bn = s.name_bn.trim().toLowerCase();
      if (en.includes(n) || n.includes(en) || bn.includes(n) || n.includes(bn) || slug.includes(n) || n.includes(slug)) {
        return s;
      }
      const al = aliases[slug];
      if (al?.some((a) => n.includes(a) || a.includes(n))) return s;
    }
    return undefined;
  }

  const items = Array.isArray(raw) ? raw : [];
  const out: CareAiSuggestedSpecialty[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const id = asString(row.specialty_id) || asString(row.id);
    const slug = asString(row.slug);
    const name =
      asString(row.name) ||
      asString(row.name_en) ||
      asString(row.name_bn) ||
      asString(row.specialty) ||
      asString(row.title);
    const hit =
      byId.get(id) ||
      (slug ? bySlug.get(slug.toLowerCase()) : undefined) ||
      (name ? byName.get(name.toLowerCase()) : undefined) ||
      (slug ? fuzzyName(slug) : undefined) ||
      (name ? fuzzyName(name) : undefined);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push({
      specialty_id: hit.id,
      slug: hit.slug,
      name_bn: hit.name_bn,
      name_en: hit.name_en,
      reason: asString(row.reason).slice(0, 280) || hit.name_en || hit.name_bn,
    });
  }
  return out.slice(0, max);
}

function parseExpertAnalysis(raw: Record<string, unknown>): CareAiExpertAnalysis | null {
  const urgencyRaw = asString(raw.urgency).toLowerCase();
  const urgency =
    urgencyRaw === "emergency" || urgencyRaw === "urgent" || urgencyRaw === "soon" || urgencyRaw === "routine"
      ? urgencyRaw
      : "soon";
  const red_flags = Array.isArray(raw.red_flags)
    ? raw.red_flags.map(asString).filter(Boolean).slice(0, 8)
    : [];
  const likely_systems = Array.isArray(raw.likely_systems)
    ? raw.likely_systems.map(asString).filter(Boolean).slice(0, 8)
    : [];
  const analysis_summary = asString(raw.analysis_summary).slice(0, 1600);
  if (!analysis_summary && !red_flags.length && !likely_systems.length && urgencyRaw === "") return null;
  return { urgency, red_flags, likely_systems, analysis_summary };
}

function resolveAgainstCatalog(raw: unknown, catalog: CatalogRow[], max: number): CareAiSuggestedTest[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const byCode = new Map(catalog.map((c) => [c.code.trim().toLowerCase(), c]));
  const byName = new Map<string, CatalogRow>();
  for (const c of catalog) {
    byName.set(c.name_en.trim().toLowerCase(), c);
    byName.set(c.name_bn.trim().toLowerCase(), c);
  }

  function fuzzyName(name: string): CatalogRow | undefined {
    const n = name.trim().toLowerCase();
    if (!n || n.length < 2) return undefined;
    const exact = byName.get(n);
    if (exact) return exact;
    let best: CatalogRow | undefined;
    let bestScore = 0;
    for (const c of catalog) {
      const en = c.name_en.trim().toLowerCase();
      const bn = c.name_bn.trim().toLowerCase();
      const code = c.code.trim().toLowerCase();
      if (en === n || bn === n || code === n) return c;
      if (en.includes(n) || n.includes(en) || bn.includes(n) || n.includes(bn) || code.includes(n) || n.includes(code)) {
        const score = Math.min(en.length, n.length) / Math.max(en.length, n.length, 1);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    return bestScore >= 0.35 ? best : undefined;
  }

  const items = Array.isArray(raw) ? raw : [];
  const out: CareAiSuggestedTest[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const id = asString(row.catalog_id);
    const code = asString(row.code);
    const name = asString(row.name) || asString(row.test_name) || asString(row.title);
    const hit =
      byId.get(id) ||
      (code ? byCode.get(code.toLowerCase()) : undefined) ||
      (name ? byName.get(name.toLowerCase()) : undefined) ||
      (name ? fuzzyName(name) : undefined) ||
      (code ? fuzzyName(code) : undefined);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push({
      catalog_id: hit.id,
      code: hit.code,
      reason: asString(row.reason).slice(0, 280) || hit.name_en,
    });
  }
  return out.slice(0, max);
}

async function fetchSettingsRaw(sb: SupabaseClient): Promise<unknown> {
  const { data } = await sb.from("app_settings").select("gemini_settings").eq("id", 1).maybeSingle();
  return (data as { gemini_settings?: unknown } | null)?.gemini_settings;
}

async function fetchSettingsForAi(sb: SupabaseClient, isGuest: boolean): Promise<unknown> {
  if (!isGuest) return fetchSettingsRaw(sb);
  try {
    const { fetchSettingsRaw: adminFetch } = await import("@/lib/gemini-rotate.server");
    const { adminClient } = await import("@/lib/gemini-rotate.server");
    return adminFetch(adminClient());
  } catch {
    return fetchSettingsRaw(sb);
  }
}

async function loadCatalogForAi(sb: SupabaseClient, limit: number, isGuest: boolean): Promise<CatalogRow[]> {
  if (!isGuest) return loadCatalog(sb, limit);
  try {
    const { adminClient } = await import("@/lib/gemini-rotate.server");
    return loadCatalog(adminClient() as unknown as SupabaseClient, limit);
  } catch {
    return loadCatalog(sb, limit);
  }
}

async function matchFuzzy(unresolved: unknown[], catalog: CatalogRow[], prompt: string, max: number): Promise<CareAiSuggestedTest[]> {
  if (!unresolved.length) return [];
  try {
    const { geminiGenerate } = await import("@/lib/gemini-rotate.server");
    const text = await geminiGenerate({
      modelRole: "match",
      json: true,
      systemText: fillPrompt(prompt, { catalog: compactCatalog(catalog) }),
      userText: JSON.stringify({ mentions: unresolved }),
    });
    const parsed = parseJsonObject(text);
    return resolveAgainstCatalog(parsed.suggested_tests, catalog, max);
  } catch {
    return [];
  }
}

type AiAuthContext = {
  supabase: SupabaseClient;
  isGuest: boolean;
};

export const fetchCareAiPublicConfig = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((data: { lang?: "bn" | "en" }) => ({
    lang: data?.lang === "en" ? ("en" as const) : ("bn" as const),
  }))
  // Follow-up config includes RegExp; ServerFn JSON typing is overly strict here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (opts: any) => {
    const context = opts.context as AiAuthContext;
    const settings = normalizeGeminiSettingsExtended(
      await fetchSettingsForAi(context.supabase, context.isGuest),
    );
    return getPublicAiConfig(settings, opts.data.lang) as CareAiPublicConfig;
  });

export const careAiTestChat = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(
    (data: {
      messages: CareAiChatMessage[];
      lang?: "bn" | "en";
      images?: CareAiChatImage[];
    }) => {
      const messages = Array.isArray(data?.messages) ? data.messages : [];
      const cleaned: CareAiChatMessage[] = messages
        .slice(-6)
        .map((m) => {
          const role: CareAiChatMessage["role"] = m?.role === "assistant" ? "assistant" : "user";
          return { role, text: String(m?.text ?? "").trim().slice(0, 2000) };
        })
        .filter((m) => m.text);
      const images = sanitizeChatImages(data?.images, 5);
      if (!cleaned.length && !images.length) throw new Error("Message required");
      if (!cleaned.length && images.length) {
        cleaned.push({
          role: "user",
          text: "Please read this prescription image.",
        });
      }
      return {
        messages: cleaned,
        lang: data?.lang === "en" ? ("en" as const) : ("bn" as const),
        images,
      };
    },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (opts: any): Promise<CareAiChatResult> => {
    const context = opts.context as AiAuthContext;
    const data = opts.data as {
      messages: CareAiChatMessage[];
      lang: "bn" | "en";
      images: CareAiChatImage[];
    };
    const settings = normalizeGeminiSettingsExtended(
      await fetchSettingsForAi(context.supabase, context.isGuest),
    );
    const { features } = settings;
    const hasImages = data.images.length > 0;
    const prescriptionMode = hasImages && features.prescription_scan;

    if (hasImages && !features.prescription_scan) {
      throw new Error(
        data.lang === "bn"
          ? "Admin-এ প্রেসক্রিপশন স্ক্যান বন্ধ আছে।"
          : "Prescription scan is disabled in Admin.",
      );
    }

    const emptyExtra = {
      suggested_specialties: [] as CareAiSuggestedSpecialty[],
      expert_analysis: null as CareAiExpertAnalysis | null,
      first_aid: [] as string[],
      medicines: [] as CareAiMedicine[],
      from_prescription: prescriptionMode,
    };
    const [catalog, specialties] = await Promise.all([
      loadCatalogForAi(context.supabase, settings.max_catalog_items, context.isGuest),
      !prescriptionMode && features.specialty_suggestions
        ? loadSpecialtiesForAi(context.supabase, context.isGuest)
        : Promise.resolve([] as SpecialtyRow[]),
    ]);
    if (!catalog.length) {
      return {
        reply:
          data.lang === "bn"
            ? "এখন ক্যাটালগে কোনো টেস্ট নেই। পরে আবার চেষ্টা করুন।"
            : "No tests are in the catalog yet. Please try again later.",
        medical_advice: "",
        catalog_notes: "",
        questions: [],
        suggested_tests: [],
        offer_bundle: false,
        ...emptyExtra,
      };
    }

    const catalogText = compactCatalog(catalog);
    const specialtiesText = compactSpecialties(specialties);
    const systemText = prescriptionMode
      ? buildPrescriptionSystemPrompt(settings, data.lang, catalogText)
      : buildChatSystemPrompt(settings, data.lang, catalogText, specialtiesText);

    const history = data.messages
      .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.text}`)
      .join("\n");

    const userText = prescriptionMode
      ? `${history}\n\nUSER_ATTACHED_PRESCRIPTION_IMAGES: ${data.images.length}`
      : history;

    let rawText: string;
    try {
      const { geminiGenerate } = await import("@/lib/gemini-rotate.server");
      rawText = await geminiGenerate({
        userText,
        systemText,
        json: true,
        modelRole: "primary",
        images: prescriptionMode ? data.images.slice(0, settings.max_prescription_images) : undefined,
      });
    } catch (e) {
      console.error("[careAiTestChat]", e);
      throw new Error(friendlyAiError(e, data.lang));
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(rawText);
    } catch (e) {
      console.error("[careAiTestChat] parse", e, rawText.slice(0, 400));
      throw new Error(friendlyAiError(e, data.lang));
    }

    const wantTests = prescriptionMode
      ? features.prescription_tests
      : features.test_suggestions;

    let suggested = wantTests
      ? resolveAgainstCatalog(parsed.suggested_tests, catalog, settings.max_suggestions)
      : [];
    const rawSuggestions = Array.isArray(parsed.suggested_tests) ? (parsed.suggested_tests as unknown[]) : [];
    const wantMin = Math.min(3, settings.max_suggestions);
    if (
      wantTests &&
      rawSuggestions.length > suggested.length &&
      (suggested.length < wantMin || features.match_fallback)
    ) {
      const have = new Set(suggested.map((s) => s.catalog_id));
      const unresolved = rawSuggestions.filter((item) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const id = asString(row.catalog_id);
        return !id || !have.has(id);
      });
      if (unresolved.length) {
        const extra = await matchFuzzy(
          unresolved,
          catalog,
          settings.prompt_match,
          settings.max_suggestions - suggested.length,
        );
        for (const e of extra) {
          if (have.has(e.catalog_id)) continue;
          have.add(e.catalog_id);
          suggested.push(e);
          if (suggested.length >= settings.max_suggestions) break;
        }
      }
    }

    const medicines =
      prescriptionMode && features.prescription_medicines
        ? parseMedicines(parsed.medicines ?? parsed.drugs ?? parsed.medications, settings.max_medicines)
        : [];

    let suggested_specialties =
      !prescriptionMode && features.specialty_suggestions && specialties.length
        ? resolveAgainstSpecialties(
            parsed.suggested_specialties ?? parsed.specialists ?? parsed.suggested_doctors,
            specialties,
            Math.max(1, settings.max_specialties || 3),
          )
        : [];

    const looksClinical =
      asString(parsed.medical_advice).length > 24 ||
      asString(parsed.analysis_summary).length > 24 ||
      (Array.isArray(parsed.suggested_tests) && parsed.suggested_tests.length > 0) ||
      suggested.length > 0;
    if (
      !prescriptionMode &&
      features.specialty_suggestions &&
      specialties.length &&
      suggested_specialties.length === 0 &&
      looksClinical
    ) {
      const fallback =
        specialties.find((s) => s.slug === "medicine") ||
        specialties.find((s) => s.slug === "general") ||
        specialties[0];
      if (fallback) {
        suggested_specialties = [
          {
            specialty_id: fallback.id,
            slug: fallback.slug,
            name_bn: fallback.name_bn,
            name_en: fallback.name_en,
            reason:
              data.lang === "bn"
                ? "লক্ষণ অনুযায়ী প্রথমে এই বিভাগের ডাক্তার দেখানো যায়।"
                : "A reasonable first specialist based on your symptoms.",
          },
        ];
      }
    }

    const questions =
      !prescriptionMode && features.follow_up_questions && Array.isArray(parsed.questions)
        ? parsed.questions.map(asString).filter(Boolean).slice(0, settings.max_questions)
        : [];
    const reply =
      asString(parsed.reply) ||
      (prescriptionMode
        ? data.lang === "bn"
          ? "প্রেসক্রিপশন পড়া হয়েছে।"
          : "Prescription read."
        : data.lang === "bn"
          ? "আরও বিস্তারিত লক্ষণ লিখুন, তাহলে ক্যাটালগ থেকে টেস্ট সাজেস্ট করতে পারব।"
          : "Tell me a bit more about the symptoms so I can suggest catalog tests.");
    const medical_advice =
      !prescriptionMode && features.medical_advice ? asString(parsed.medical_advice).slice(0, 1200) : "";
    const catalog_notes =
      !prescriptionMode && features.catalog_notes ? asString(parsed.catalog_notes).slice(0, 1600) : "";
    const expert_analysis =
      !prescriptionMode && features.expert_analysis ? parseExpertAnalysis(parsed) : null;
    const first_aid =
      !prescriptionMode && features.first_aid && Array.isArray(parsed.first_aid)
        ? parsed.first_aid.map(asString).filter(Boolean).slice(0, 8).map((s) => s.slice(0, 280))
        : !prescriptionMode && features.first_aid && typeof parsed.first_aid === "string" && asString(parsed.first_aid)
          ? asString(parsed.first_aid)
              .split(/\n+/)
              .map((s) => s.replace(/^[\s*•\-\d.)]+/, "").trim())
              .filter(Boolean)
              .slice(0, 8)
              .map((s) => s.slice(0, 280))
          : [];
    const offer_bundle =
      features.bundle_offer &&
      wantTests &&
      parsed.offer_bundle === true &&
      suggested.length >= 2;

    return {
      reply,
      medical_advice,
      catalog_notes,
      questions,
      suggested_tests: suggested,
      suggested_specialties,
      expert_analysis,
      first_aid,
      medicines,
      offer_bundle,
      from_prescription: prescriptionMode,
    };
  });
