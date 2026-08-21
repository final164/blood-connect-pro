/** Client-only multi-thread AI chat — one device key (no userId split / no server). */

const DEVICE_KEY = "bloodlink:care-ai-chats:device";
const LEGACY_PREFIX = "bloodlink:care-ai-chat:";
const VERSION = 2;
const DEFAULT_MAX_AGE_DAYS = 7;
const MAX_MESSAGES = 40;
const MAX_CHARS = 120_000;
const MAX_THREADS = 30;

export type CareAiChatStoredMessage = {
  role: "user" | "assistant";
  text: string;
  apiText?: string;
  medicalAdvice?: string;
  catalogNotes?: string;
  questions?: string[];
  suggestions?: { catalog_id: string; code: string; reason: string }[];
  specialties?: {
    specialty_id: string;
    slug: string;
    name_bn: string;
    name_en: string;
    reason: string;
  }[];
  expertAnalysis?: {
    urgency: "routine" | "soon" | "urgent" | "emergency";
    red_flags: string[];
    likely_systems: string[];
    analysis_summary: string;
  } | null;
  firstAid?: string[];
  offerBundle?: boolean;
  followUpQuestion?: string;
  followUpBatch?: boolean;
};

export type CareAiChatStoredCard = {
  catalogId: string;
  code: string;
  reason: string;
  nameBn: string;
  nameEn: string;
  cheapest: number | null;
  clinicCount: number;
  cheapestOfferingId: string | null;
};

export type CareAiChatThread = {
  id: string;
  topic: string;
  title: string;
  lang: "bn" | "en";
  createdAt: number;
  updatedAt: number;
  messages: CareAiChatStoredMessage[];
  cards: CareAiChatStoredCard[];
  cart: string[];
};

export type CareAiChatLibrary = {
  v: number;
  /** Always "device" — kept for shape compatibility */
  userId: string;
  activeId: string | null;
  threads: CareAiChatThread[];
};

export type CareAiChatSnapshot = {
  v: number;
  userId: string;
  lang: "bn" | "en";
  at: number;
  messages: CareAiChatStoredMessage[];
  cards: CareAiChatStoredCard[];
  cart: string[];
  threadId?: string;
};

export type CareAiChatThreadSummary = {
  id: string;
  topic: string;
  title: string;
  updatedAt: number;
  preview: string;
  active: boolean;
};

function maxAgeMs(days: number) {
  const d = Math.min(90, Math.max(1, Number(days) || DEFAULT_MAX_AGE_DAYS));
  return d * 24 * 60 * 60 * 1000;
}

function newId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLibrary(): CareAiChatLibrary {
  return { v: VERSION, userId: "device", activeId: null, threads: [] };
}

function isMeaningful(messages: CareAiChatStoredMessage[]) {
  if (messages.some((m) => m.role === "user" && String(m.text ?? "").trim())) return true;
  return messages.some(
    (m) =>
      m.role === "assistant" &&
      (Boolean(m.suggestions?.length) ||
        Boolean(m.specialties?.length) ||
        Boolean(m.medicalAdvice?.trim()) ||
        Boolean(m.expertAnalysis) ||
        Boolean(m.firstAid?.length) ||
        (Boolean(m.text?.trim()) && messages.some((x) => x.role === "user"))),
  );
}

function isFollowUpOnlyMessage(m: CareAiChatStoredMessage) {
  return Boolean(m.followUpQuestion || m.followUpBatch);
}

/** Build a short topic label from what the user asked about (no AI / no server). */
export function generateCareAiChatTopic(
  messages: CareAiChatStoredMessage[],
  lang: "bn" | "en",
): string {
  const fallback = lang === "bn" ? "স্বাস্থ্য আলোচনা" : "Health chat";

  const primaryUser = messages.find(
    (m) => m.role === "user" && m.text.trim() && !isFollowUpOnlyMessage(m),
  );
  let raw = primaryUser?.text?.trim() ?? "";

  raw = raw
    .replace(/^(উত্তর|Answer)\s*[:：]\s*/i, "")
    .replace(/^\[.*?\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (raw) {
    const clause = raw.split(/[।.!?\n]/)[0]?.trim() || raw;
    const topic = clause.length > 48 ? `${clause.slice(0, 46).trim()}…` : clause;
    if (topic.length >= 2) return topic;
  }

  const assistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (assistant?.specialties?.length) {
    const s = assistant.specialties[0];
    const name = lang === "bn" ? s.name_bn || s.name_en : s.name_en || s.name_bn;
    if (name?.trim()) {
      return lang === "bn" ? `${name.trim()} সংক্রান্ত` : `${name.trim()} concern`;
    }
  }
  if (assistant?.expertAnalysis?.likely_systems?.length) {
    const sys = assistant.expertAnalysis.likely_systems.slice(0, 2).join(" · ");
    if (sys) return sys;
  }
  if (assistant?.suggestions?.length) {
    const codes = assistant.suggestions
      .slice(0, 2)
      .map((s) => s.code)
      .filter(Boolean)
      .join(", ");
    if (codes) return lang === "bn" ? `টেস্ট: ${codes}` : `Tests: ${codes}`;
  }

  const anyUser = messages.find((m) => m.role === "user" && m.text.trim());
  if (anyUser) {
    const t = anyUser.text.trim().replace(/\s+/g, " ");
    return t.length > 48 ? `${t.slice(0, 46)}…` : t;
  }

  return fallback;
}

function previewFromMessages(messages: CareAiChatStoredMessage[]) {
  const firstAsk = messages.find(
    (m) => m.role === "user" && m.text.trim() && !isFollowUpOnlyMessage(m),
  );
  if (firstAsk) {
    const t = firstAsk.text.trim().replace(/\s+/g, " ");
    return t.length > 72 ? `${t.slice(0, 70)}…` : t;
  }
  return "";
}

function trimMessages(messages: CareAiChatStoredMessage[]): CareAiChatStoredMessage[] {
  const sliced = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m.role,
    text: String(m.text ?? "").slice(0, 4000),
    apiText: m.apiText ? String(m.apiText).slice(0, 4000) : undefined,
    medicalAdvice: m.medicalAdvice ? String(m.medicalAdvice).slice(0, 2000) : undefined,
    catalogNotes: m.catalogNotes ? String(m.catalogNotes).slice(0, 2500) : undefined,
    questions: Array.isArray(m.questions) ? m.questions.slice(0, 8).map((q) => String(q).slice(0, 240)) : undefined,
    suggestions: Array.isArray(m.suggestions) ? m.suggestions.slice(0, 12) : undefined,
    specialties: Array.isArray(m.specialties) ? m.specialties.slice(0, 6) : undefined,
    expertAnalysis: m.expertAnalysis ?? undefined,
    firstAid: Array.isArray(m.firstAid)
      ? m.firstAid.slice(0, 8).map((s) => String(s).slice(0, 280))
      : undefined,
    offerBundle: m.offerBundle,
    followUpQuestion: m.followUpQuestion,
    followUpBatch: m.followUpBatch,
  }));
  let json = JSON.stringify(sliced);
  while (json.length > MAX_CHARS && sliced.length > 4) {
    sliced.shift();
    json = JSON.stringify(sliced);
  }
  return sliced;
}

function normalizeThread(t: Partial<CareAiChatThread> & { messages?: CareAiChatStoredMessage[] }): CareAiChatThread {
  const lang = t.lang === "en" ? "en" : "bn";
  const messages = Array.isArray(t.messages) ? t.messages : [];
  const topic =
    generateCareAiChatTopic(messages, lang) ||
    (typeof t.topic === "string" && t.topic.trim()) ||
    (typeof t.title === "string" && t.title.trim()) ||
    (lang === "bn" ? "স্বাস্থ্য আলোচনা" : "Health chat");
  return {
    id: typeof t.id === "string" && t.id ? t.id : newId(),
    topic,
    title: topic,
    lang,
    createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
    messages,
    cards: Array.isArray(t.cards) ? t.cards : [],
    cart: Array.isArray(t.cart) ? t.cart : [],
  };
}

function pruneThreads(lib: CareAiChatLibrary, persistDays: number): CareAiChatLibrary {
  const cutoff = Date.now() - maxAgeMs(persistDays);
  const threads = lib.threads
    .filter((t) => t.updatedAt >= cutoff && isMeaningful(t.messages))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS);
  const activeId =
    lib.activeId && threads.some((t) => t.id === lib.activeId) ? lib.activeId : null;
  return { ...lib, userId: "device", threads, activeId };
}

function threadToSnapshot(thread: CareAiChatThread): CareAiChatSnapshot {
  return {
    v: VERSION,
    userId: "device",
    lang: thread.lang,
    at: thread.updatedAt,
    messages: thread.messages,
    cards: thread.cards,
    cart: thread.cart,
    threadId: thread.id,
  };
}

function parseAny(raw: string, persistDays: number): CareAiChatLibrary {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return emptyLibrary();

    if (Array.isArray(data.threads)) {
      return pruneThreads(
        {
          v: VERSION,
          userId: "device",
          activeId: typeof data.activeId === "string" ? data.activeId : null,
          threads: (data.threads as CareAiChatThread[]).map((t) => normalizeThread(t)),
        },
        persistDays,
      );
    }

    // v1 single snapshot
    if (Array.isArray(data.messages) && isMeaningful(data.messages as CareAiChatStoredMessage[])) {
      const messages = data.messages as CareAiChatStoredMessage[];
      const lang = data.lang === "en" ? ("en" as const) : ("bn" as const);
      const at = typeof data.at === "number" ? data.at : Date.now();
      const topic = generateCareAiChatTopic(messages, lang);
      const thread = normalizeThread({
        id: newId(),
        topic,
        title: topic,
        lang,
        createdAt: at,
        updatedAt: at,
        messages,
        cards: Array.isArray(data.cards) ? (data.cards as CareAiChatStoredCard[]) : [],
        cart: Array.isArray(data.cart) ? (data.cart as string[]) : [],
      });
      return pruneThreads({ v: VERSION, userId: "device", activeId: thread.id, threads: [thread] }, persistDays);
    }
  } catch {
    /* ignore */
  }
  return emptyLibrary();
}

function mergeLibraries(libs: CareAiChatLibrary[], persistDays: number): CareAiChatLibrary {
  const byId = new Map<string, CareAiChatThread>();
  let activeId: string | null = null;
  for (const lib of libs) {
    for (const t of lib.threads) {
      const prev = byId.get(t.id);
      if (!prev || t.updatedAt >= prev.updatedAt) byId.set(t.id, t);
    }
    if (lib.activeId) activeId = lib.activeId;
  }
  return pruneThreads(
    { v: VERSION, userId: "device", activeId, threads: [...byId.values()] },
    persistDays,
  );
}

function collectLegacyLibraries(persistDays: number): CareAiChatLibrary[] {
  const out: CareAiChatLibrary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LEGACY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const lib = parseAny(raw, persistDays);
      if (lib.threads.length) out.push(lib);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function clearLegacyKeys() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function writeLibrary(lib: CareAiChatLibrary) {
  const payload: CareAiChatLibrary = { ...lib, userId: "device", v: VERSION };
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(payload));
  } catch {
    try {
      const slim: CareAiChatLibrary = {
        ...payload,
        threads: payload.threads.slice(0, 10).map((t) => ({
          ...t,
          messages: trimMessages(t.messages.slice(-10)),
          cards: [],
        })),
      };
      localStorage.setItem(DEVICE_KEY, JSON.stringify(slim));
    } catch {
      /* quota / private mode */
    }
  }
}

function readLibrary(persistDays: number): CareAiChatLibrary {
  if (typeof window === "undefined") return emptyLibrary();
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    const current = raw ? parseAny(raw, persistDays) : emptyLibrary();
    const legacy = collectLegacyLibraries(persistDays);
    if (!legacy.length) return current;

    const merged = mergeLibraries([current, ...legacy], persistDays);
    writeLibrary(merged);
    clearLegacyKeys();
    return merged;
  } catch {
    return emptyLibrary();
  }
}

/** userId ignored — kept so call sites stay compatible */
export function loadCareAiLibrary(
  _userId?: string | null,
  persistDays = DEFAULT_MAX_AGE_DAYS,
): CareAiChatLibrary {
  return readLibrary(persistDays);
}

export function listCareAiChatThreads(
  _userId?: string | null,
  persistDays = DEFAULT_MAX_AGE_DAYS,
): CareAiChatThreadSummary[] {
  const lib = readLibrary(persistDays);
  return lib.threads.map((t) => {
    const topic = t.topic || t.title || generateCareAiChatTopic(t.messages, t.lang);
    return {
      id: t.id,
      topic,
      title: topic,
      updatedAt: t.updatedAt,
      preview: previewFromMessages(t.messages),
      active: t.id === lib.activeId,
    };
  });
}

export function loadCareAiChat(
  _userId?: string | null,
  persistDays = DEFAULT_MAX_AGE_DAYS,
): CareAiChatSnapshot | null {
  const lib = readLibrary(persistDays);
  const active = lib.activeId
    ? lib.threads.find((t) => t.id === lib.activeId)
    : null;
  // Prefer active; otherwise don't auto-open oldest — return null so UI shows welcome,
  // but threads still appear in the sidebar list.
  if (!active?.messages?.length) return null;
  return threadToSnapshot(active);
}

export function saveCareAiChat(params: {
  userId?: string | null;
  lang: "bn" | "en";
  messages: CareAiChatStoredMessage[];
  cards?: CareAiChatStoredCard[];
  cart?: string[];
  threadId?: string | null;
  persistDays?: number;
}): string | null {
  if (typeof window === "undefined") return null;
  const persistDays = params.persistDays ?? DEFAULT_MAX_AGE_DAYS;
  let lib = readLibrary(persistDays);

  if (!isMeaningful(params.messages)) {
    return lib.activeId;
  }

  const now = Date.now();
  const topic = generateCareAiChatTopic(params.messages, params.lang);
  const payload = {
    topic,
    title: topic,
    lang: params.lang,
    updatedAt: now,
    messages: trimMessages(params.messages),
    cards: (params.cards ?? []).slice(0, 16),
    cart: (params.cart ?? []).slice(0, 16),
  };

  const existingId =
    (params.threadId && lib.threads.some((t) => t.id === params.threadId) ? params.threadId : null) ||
    (lib.activeId && lib.threads.some((t) => t.id === lib.activeId) ? lib.activeId : null);

  if (existingId) {
    lib.threads = lib.threads.map((t) => (t.id === existingId ? { ...t, ...payload } : t));
    lib.activeId = existingId;
  } else {
    const id = newId();
    lib.threads = [{ id, createdAt: now, ...payload }, ...lib.threads];
    lib.activeId = id;
  }

  lib = pruneThreads(lib, persistDays);
  writeLibrary(lib);
  return lib.activeId;
}

export function startCareAiNewChat(
  _userId?: string | null,
  persistDays = DEFAULT_MAX_AGE_DAYS,
): null {
  if (typeof window === "undefined") return null;
  const lib = readLibrary(persistDays);
  lib.threads = lib.threads.filter((t) => isMeaningful(t.messages));
  lib.activeId = null;
  writeLibrary(pruneThreads(lib, persistDays));
  return null;
}

export function switchCareAiChat(
  _userId: string | null | undefined,
  threadId: string,
  persistDays = DEFAULT_MAX_AGE_DAYS,
): CareAiChatSnapshot | null {
  if (typeof window === "undefined") return null;
  const lib = readLibrary(persistDays);
  const thread = lib.threads.find((t) => t.id === threadId);
  if (!thread) return null;
  lib.activeId = threadId;
  writeLibrary(lib);
  return threadToSnapshot(thread);
}

export function deleteCareAiChatThread(
  _userId: string | null | undefined,
  threadId: string,
  persistDays = DEFAULT_MAX_AGE_DAYS,
): CareAiChatSnapshot | null {
  if (typeof window === "undefined") return null;
  let lib = readLibrary(persistDays);
  lib.threads = lib.threads.filter((t) => t.id !== threadId);
  if (lib.activeId === threadId) lib.activeId = null;
  lib = pruneThreads(lib, persistDays);
  writeLibrary(lib);
  const active = lib.threads.find((t) => t.id === lib.activeId);
  return active ? threadToSnapshot(active) : null;
}

export function clearCareAiChat(_userId?: string | null) {
  startCareAiNewChat(null);
}
