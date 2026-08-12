/**
 * Facebook-like post text background styles.
 * Stored as a single meta line in notes: [PostStyle:id]
 * — no DB migration, zero network cost, CSS-only paint.
 */

export type PostTextStyleId =
  | "none"
  | "ember"
  | "love"
  | "sunset"
  | "ocean"
  | "mint"
  | "violet"
  | "night"
  | "gold"
  | "sky"
  | "coral"
  | "forest";

export type PostTextStyle = {
  id: PostTextStyleId;
  /** Swatch + panel background (CSS) */
  bg: string;
  /** Status text color */
  color: string;
  label_bn: string;
  label_en: string;
};

/** Curated FB-like backgrounds — solid/linear only (GPU-cheap, no images). */
export const POST_TEXT_STYLES: readonly PostTextStyle[] = [
  {
    id: "none",
    bg: "transparent",
    color: "inherit",
    label_bn: "সাধারণ",
    label_en: "Normal",
  },
  {
    id: "ember",
    bg: "linear-gradient(135deg, #8B0000 0%, #DC143C 55%, #FF4D6D 100%)",
    color: "#ffffff",
    label_bn: "এমবার",
    label_en: "Ember",
  },
  {
    id: "love",
    bg: "linear-gradient(135deg, #ED4264 0%, #FFEDBC 100%)",
    color: "#ffffff",
    label_bn: "লাভ",
    label_en: "Love",
  },
  {
    id: "sunset",
    bg: "linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 52%, #2BFF88 90%)",
    color: "#ffffff",
    label_bn: "সানসেট",
    label_en: "Sunset",
  },
  {
    id: "ocean",
    bg: "linear-gradient(135deg, #0077B6 0%, #00B4D8 50%, #90E0EF 100%)",
    color: "#ffffff",
    label_bn: "ওশান",
    label_en: "Ocean",
  },
  {
    id: "mint",
    bg: "linear-gradient(135deg, #0F9B8E 0%, #34D399 100%)",
    color: "#ffffff",
    label_bn: "মিন্ট",
    label_en: "Mint",
  },
  {
    id: "violet",
    bg: "linear-gradient(135deg, #5B21B6 0%, #A78BFA 100%)",
    color: "#ffffff",
    label_bn: "ভায়োলেট",
    label_en: "Violet",
  },
  {
    id: "night",
    bg: "linear-gradient(160deg, #0F172A 0%, #1E293B 60%, #334155 100%)",
    color: "#F8FAFC",
    label_bn: "নাইট",
    label_en: "Night",
  },
  {
    id: "gold",
    bg: "linear-gradient(135deg, #B45309 0%, #F59E0B 45%, #FDE68A 100%)",
    color: "#1C1917",
    label_bn: "গোল্ড",
    label_en: "Gold",
  },
  {
    id: "sky",
    bg: "linear-gradient(135deg, #1D4ED8 0%, #60A5FA 100%)",
    color: "#ffffff",
    label_bn: "স্কাই",
    label_en: "Sky",
  },
  {
    id: "coral",
    bg: "linear-gradient(135deg, #FF6B6B 0%, #FFA07A 100%)",
    color: "#ffffff",
    label_bn: "কোরাল",
    label_en: "Coral",
  },
  {
    id: "forest",
    bg: "linear-gradient(135deg, #14532D 0%, #22C55E 100%)",
    color: "#ffffff",
    label_bn: "ফরেস্ট",
    label_en: "Forest",
  },
] as const;

const STYLE_IDS = new Set(POST_TEXT_STYLES.map((s) => s.id));
const STYLE_MAP = Object.fromEntries(POST_TEXT_STYLES.map((s) => [s.id, s])) as Record<
  PostTextStyleId,
  PostTextStyle
>;

const STYLE_LINE = /^\s*\[PostStyle:([a-z0-9_-]+)\]\s*$/i;
const COMMUNITY_LINE = /^\s*\[Community\s*→/i;

export function isPostTextStyleId(v: unknown): v is PostTextStyleId {
  return typeof v === "string" && STYLE_IDS.has(v as PostTextStyleId);
}

export function getPostTextStyle(id: PostTextStyleId | string | null | undefined): PostTextStyle {
  if (id && isPostTextStyleId(id)) return STYLE_MAP[id];
  return STYLE_MAP.none;
}

/** Parse style meta + strip community lines. O(n) over lines only. */
export function extractPostNotes(notes: string | null | undefined): {
  styleId: PostTextStyleId;
  text: string;
} {
  if (!notes) return { styleId: "none", text: "" };
  let styleId: PostTextStyleId = "none";
  const out: string[] = [];
  for (const line of notes.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(STYLE_LINE);
    if (m) {
      const id = m[1].toLowerCase();
      if (isPostTextStyleId(id)) styleId = id;
      continue;
    }
    if (COMMUNITY_LINE.test(trimmed)) continue;
    out.push(line);
  }
  return { styleId, text: out.join("\n").trim() };
}

/** Persist style into notes (single meta line). */
export function withPostTextStyle(text: string, styleId: PostTextStyleId | string | null | undefined): string {
  const body = text.trim();
  const id = isPostTextStyleId(styleId) ? styleId : "none";
  if (id === "none") return body;
  if (!body) return `[PostStyle:${id}]`;
  return `[PostStyle:${id}]\n${body}`;
}

/** Font scale for FB-like background posts based on length. */
export function postStyleFontClass(text: string): string {
  const n = text.length;
  const lines = text.split("\n").length;
  if (n <= 40 && lines <= 2) return "text-[28px] sm:text-[32px] leading-snug font-bold";
  if (n <= 90 && lines <= 4) return "text-[22px] sm:text-[24px] leading-snug font-semibold";
  if (n <= 160) return "text-[18px] leading-snug font-semibold";
  return "text-[15px] leading-5 font-medium text-left";
}

export function postStyleAlignClass(text: string): string {
  return text.length <= 160 ? "text-center" : "text-left";
}
