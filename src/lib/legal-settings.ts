/**
 * Legal pages (Privacy Policy + Terms of Service) CMS.
 * Stored as JSONB `legal_settings` on the singleton public.app_settings row (id = 1),
 * same pattern as seo_settings / landing_settings.
 */

export type LegalSection = {
  id: string;
  heading_bn: string;
  heading_en: string;
  /** Paragraphs separated by blank lines; bullet lines may start with "- ". */
  body_bn: string;
  body_en: string;
  sort_order: number;
  is_active: boolean;
};

export type LegalDoc = {
  enabled: boolean;
  title_bn: string;
  title_en: string;
  intro_bn: string;
  intro_en: string;
  /** ISO date (YYYY-MM-DD) shown as "last updated". */
  effective_date: string;
  sections: LegalSection[];
};

export type LegalSettings = {
  privacy: LegalDoc;
  terms: LegalDoc;
  contact_email: string;
  contact_phone: string;
  contact_address_bn: string;
  contact_address_en: string;
};

export type LegalDocKey = "privacy" | "terms";

export const LEGAL_DOC_PATHS: Record<LegalDocKey, string> = {
  privacy: "/privacy",
  terms: "/terms",
};

function section(
  id: string,
  heading_bn: string,
  heading_en: string,
  body_bn: string,
  body_en: string,
  sort_order: number,
): LegalSection {
  return { id, heading_bn, heading_en, body_bn, body_en, sort_order, is_active: true };
}

const DEFAULT_PRIVACY: LegalDoc = {
  enabled: true,
  title_bn: "গোপনীয়তা নীতি",
  title_en: "Privacy Policy",
  intro_bn:
    "মুক্তসেবা একটি স্বেচ্ছাসেবী রক্তদান ও স্বাস্থ্যসেবা প্ল্যাটফর্ম। আপনার ব্যক্তিগত তথ্যের গোপনীয়তা আমাদের কাছে অত্যন্ত গুরুত্বপূর্ণ। এই নীতিতে আমরা কী তথ্য সংগ্রহ করি, কেন করি, কীভাবে সংরক্ষণ করি এবং আপনার কী অধিকার আছে তা ব্যাখ্যা করা হয়েছে।",
  intro_en:
    "Muktosheba is a volunteer blood donation and healthcare platform. Protecting your personal information matters deeply to us. This policy explains what data we collect, why we collect it, how we store it, and what rights you have.",
  effective_date: "2026-08-27",
  sections: [
    section(
      "collect",
      "আমরা কী তথ্য সংগ্রহ করি",
      "Information we collect",
      `অ্যাকাউন্ট তৈরি ও সেবা প্রদানের জন্য আমরা নিচের তথ্যগুলো সংগ্রহ করি:

- নাম, মোবাইল নম্বর এবং প্রোফাইল ছবি
- রক্তের গ্রুপ, সর্বশেষ রক্তদানের তারিখ এবং রক্তদানের যোগ্যতা সংক্রান্ত তথ্য
- জেলা, উপজেলা ও অবস্থান সংক্রান্ত তথ্য (রক্তদাতা খোঁজার জন্য)
- রক্তের অনুরোধের বিবরণ — রোগীর নাম, হাসপাতাল, প্রয়োজনীয় ব্যাগ সংখ্যা ও জরুরিতা
- অ্যাপ ব্যবহারের প্রযুক্তিগত তথ্য — ডিভাইসের ধরন, অ্যাপ সংস্করণ ও পুশ নোটিফিকেশন টোকেন
- AI স্বাস্থ্য সহায়ক ব্যবহার করলে আপনার প্রশ্ন ও সংযুক্ত ছবি

আমরা কখনোই আপনার জাতীয় পরিচয়পত্র নম্বর, ব্যাংক তথ্য বা পাসওয়ার্ড প্লেইন টেক্সটে সংরক্ষণ করি না।`,
      `To create your account and provide our services, we collect:

- Name, mobile number and profile photo
- Blood group, last donation date and donation eligibility details
- District, upazila and location data (used to match donors with requests)
- Blood request details — patient name, hospital, bags needed and urgency
- Technical usage data — device type, app version and push notification tokens
- Your questions and attached images if you use the AI health assistant

We never store your national ID number, banking details, or passwords in plain text.`,
      1,
    ),
    section(
      "use",
      "তথ্য কীভাবে ব্যবহার করি",
      "How we use your information",
      `- উপযুক্ত রক্তদাতা ও রক্তগ্রহীতার মধ্যে সংযোগ স্থাপন
- জরুরি রক্তের অনুরোধ সম্পর্কে আপনাকে নোটিফিকেশন পাঠানো
- আপনার রক্তদানের যোগ্যতা ও পরবর্তী রক্তদানের সময় হিসাব করা
- অ্যাকাউন্টের নিরাপত্তা রক্ষা ও ভুয়া অ্যাকাউন্ট প্রতিরোধ
- সেবার গুণমান উন্নয়নের জন্য পরিসংখ্যানগত বিশ্লেষণ (নাম-পরিচয়হীনভাবে)

আমরা আপনার তথ্য বিজ্ঞাপন প্রদর্শনের জন্য ব্যবহার করি না।`,
      `- Connecting suitable donors with people who need blood
- Sending you notifications about urgent blood requests near you
- Calculating your donation eligibility and next eligible donation date
- Keeping accounts secure and preventing fake profiles
- Anonymous, aggregated analysis to improve the service

We do not use your data to serve advertisements.`,
      2,
    ),
    section(
      "share",
      "তথ্য কার সাথে শেয়ার করা হয়",
      "Who your information is shared with",
      `আপনার প্রোফাইলের যে অংশ আপনি পাবলিক করেছেন (নাম, রক্তের গ্রুপ, জেলা) তা অন্য ব্যবহারকারীরা দেখতে পারেন। আপনার মোবাইল নম্বর কেবল তখনই দেখানো হয় যখন আপনি নিজে তা প্রকাশ করার অনুমতি দেন, অথবা আপনি কোনো রক্তের অনুরোধে যোগাযোগ নম্বর দেন।

আমরা তৃতীয় পক্ষের কাছে আপনার ব্যক্তিগত তথ্য বিক্রি করি না। কেবল নিচের ক্ষেত্রে সীমিত তথ্য শেয়ার করা হয়:

- প্রযুক্তিগত সেবাদাতা — ডেটাবেজ হোস্টিং, পুশ নোটিফিকেশন ও SMS পাঠানোর জন্য
- আইনি বাধ্যবাধকতা — উপযুক্ত আদালত বা আইন প্রয়োগকারী সংস্থার বৈধ আদেশে`,
      `The parts of your profile you choose to make public (name, blood group, district) are visible to other users. Your mobile number is shown only when you explicitly allow it, or when you provide a contact number on a blood request.

We do not sell your personal information. Limited data is shared only in these cases:

- Technical service providers — for database hosting, push notifications and SMS delivery
- Legal obligations — in response to a valid order from a competent court or law enforcement agency`,
      3,
    ),
    section(
      "security",
      "নিরাপত্তা ও সংরক্ষণ",
      "Security and retention",
      `আপনার তথ্য এনক্রিপ্টেড সংযোগ (HTTPS) দিয়ে আদান-প্রদান হয় এবং row-level security সহ সুরক্ষিত ডেটাবেজে সংরক্ষিত থাকে। ব্যক্তিগত চ্যাট মেসেজ এন্ড-টু-এন্ড এনক্রিপশন দিয়ে সুরক্ষিত।

আপনার অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত তথ্য সংরক্ষিত থাকে। অ্যাকাউন্ট মুছে ফেললে ব্যক্তিগত তথ্য ৩০ দিনের মধ্যে স্থায়ীভাবে মুছে ফেলা হয়, তবে আইনি প্রয়োজনে বা পরিসংখ্যানের জন্য নাম-পরিচয়হীন রেকর্ড থাকতে পারে।`,
      `Your data travels over encrypted connections (HTTPS) and is stored in a secured database with row-level security. Private chat messages are protected with end-to-end encryption.

We retain your data while your account is active. If you delete your account, personal data is permanently removed within 30 days, though anonymised records may be retained for legal or statistical purposes.`,
      4,
    ),
    section(
      "rights",
      "আপনার অধিকার",
      "Your rights",
      `- আপনার সংরক্ষিত তথ্য দেখা ও সংশোধন করা
- প্রোফাইলের গোপনীয়তা সেটিংস পরিবর্তন করে কী দেখানো হবে তা নিয়ন্ত্রণ করা
- নোটিফিকেশন বন্ধ করা
- অ্যাকাউন্ট ও সমস্ত তথ্য স্থায়ীভাবে মুছে ফেলার অনুরোধ করা

এই অধিকারগুলো প্রয়োগ করতে অ্যাপের সেটিংস ব্যবহার করুন অথবা নিচের ঠিকানায় যোগাযোগ করুন।`,
      `- Access and correct the information we hold about you
- Control what others see through your profile privacy settings
- Turn notifications off
- Request permanent deletion of your account and all associated data

Use the in-app settings to exercise these rights, or contact us using the details below.`,
      5,
    ),
    section(
      "children",
      "অপ্রাপ্তবয়স্কদের তথ্য",
      "Children's data",
      `মুক্তসেবা ১৮ বছরের কম বয়সীদের জন্য নয়। রক্তদানের ন্যূনতম বয়স ১৮ বছর। আমরা জেনেশুনে অপ্রাপ্তবয়স্কদের তথ্য সংগ্রহ করি না। এমন কোনো অ্যাকাউন্ট শনাক্ত হলে তা মুছে ফেলা হয়।`,
      `Muktosheba is not intended for anyone under 18. The minimum age for blood donation is 18. We do not knowingly collect data from minors, and any such account is removed when identified.`,
      6,
    ),
    section(
      "changes",
      "নীতির পরিবর্তন",
      "Changes to this policy",
      `এই নীতি সময়ে সময়ে হালনাগাদ হতে পারে। গুরুত্বপূর্ণ পরিবর্তন হলে অ্যাপে নোটিফিকেশন দিয়ে জানানো হবে। পরিবর্তনের পর সেবা ব্যবহার চালিয়ে গেলে ধরে নেওয়া হবে আপনি নতুন নীতিতে সম্মত।`,
      `We may update this policy from time to time. Significant changes will be announced through an in-app notification. Continuing to use the service after a change means you accept the updated policy.`,
      7,
    ),
  ],
};

const DEFAULT_TERMS: LegalDoc = {
  enabled: true,
  title_bn: "সেবার শর্তাবলী",
  title_en: "Terms of Service",
  intro_bn:
    "মুক্তসেবা ব্যবহার করার মাধ্যমে আপনি এই শর্তাবলীতে সম্মত হচ্ছেন। অনুগ্রহ করে অ্যাকাউন্ট তৈরির আগে মনোযোগ দিয়ে পড়ুন।",
  intro_en:
    "By using Muktosheba you agree to these terms. Please read them carefully before creating an account.",
  effective_date: "2026-08-27",
  sections: [
    section(
      "service",
      "সেবার প্রকৃতি",
      "Nature of the service",
      `মুক্তসেবা একটি সংযোগকারী প্ল্যাটফর্ম — আমরা স্বেচ্ছাসেবী রক্তদাতা ও রক্তের প্রয়োজন আছে এমন মানুষের মধ্যে যোগাযোগ সহজ করি। আমরা কোনো হাসপাতাল, ব্লাড ব্যাংক বা চিকিৎসা প্রতিষ্ঠান নই। আমরা রক্ত সংগ্রহ, সংরক্ষণ বা সরবরাহ করি না।`,
      `Muktosheba is a connecting platform — we make it easier for voluntary blood donors and people in need of blood to reach each other. We are not a hospital, blood bank or medical institution. We do not collect, store or supply blood.`,
      1,
    ),
    section(
      "eligibility",
      "ব্যবহারের যোগ্যতা",
      "Eligibility",
      `- আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে
- আপনাকে সঠিক ও সত্য তথ্য দিতে হবে
- একজন ব্যক্তি একটিই অ্যাকাউন্ট রাখতে পারবেন
- রক্তদানের আগে নিজের শারীরিক যোগ্যতা নিশ্চিত করা আপনার দায়িত্ব`,
      `- You must be at least 18 years old
- You must provide accurate and truthful information
- One person may hold only one account
- It is your responsibility to confirm your own medical fitness before donating`,
      2,
    ),
    section(
      "conduct",
      "ব্যবহারকারীর আচরণ",
      "User conduct",
      `নিচের কাজগুলো সম্পূর্ণ নিষিদ্ধ:

- রক্ত বা রক্তদানের বিনিময়ে টাকা বা কোনো সুবিধা দাবি করা
- ভুয়া রক্তের অনুরোধ বা মিথ্যা জরুরি অবস্থা তৈরি করা
- অন্যের পরিচয় বা ছবি ব্যবহার করা
- অন্য ব্যবহারকারীকে হুমকি, হয়রানি বা অশালীন বার্তা পাঠানো
- প্ল্যাটফর্ম থেকে সংগৃহীত নম্বর বিপণন বা অন্য কোনো উদ্দেশ্যে ব্যবহার করা
- স্বয়ংক্রিয় বট বা স্ক্রিপ্ট দিয়ে তথ্য সংগ্রহ করা

বাংলাদেশে রক্ত বিক্রি করা আইনত দণ্ডনীয়। এমন কার্যক্রম শনাক্ত হলে অ্যাকাউন্ট স্থায়ীভাবে বন্ধ করা হবে এবং প্রয়োজনে আইনি ব্যবস্থা নেওয়া হবে।`,
      `The following are strictly prohibited:

- Demanding money or any benefit in exchange for blood or donation
- Posting fake blood requests or fabricating emergencies
- Impersonating another person or using someone else's photo
- Threatening, harassing or sending abusive messages to other users
- Using phone numbers obtained from the platform for marketing or any unrelated purpose
- Harvesting data using automated bots or scripts

Selling blood is a punishable offence in Bangladesh. Accounts found engaging in such activity will be permanently disabled and reported to the authorities where appropriate.`,
      3,
    ),
    section(
      "medical",
      "চিকিৎসা সংক্রান্ত দাবিত্যাগ",
      "Medical disclaimer",
      `প্ল্যাটফর্মের কোনো তথ্য, এবং AI স্বাস্থ্য সহায়ক বা টেস্ট সহায়কের কোনো উত্তর, চিকিৎসকের পরামর্শের বিকল্প নয়। এগুলো কেবল সাধারণ তথ্যগত সহায়তা। যেকোনো স্বাস্থ্য সমস্যায় নিবন্ধিত চিকিৎসকের পরামর্শ নিন।

রক্তদান বা রক্তগ্রহণের আগে অনুমোদিত ব্লাড ব্যাংকে ক্রস-ম্যাচিং ও প্রয়োজনীয় স্ক্রিনিং টেস্ট করানো বাধ্যতামূলক। প্ল্যাটফর্মে দেখানো রক্তের গ্রুপ ব্যবহারকারীর নিজের দেওয়া তথ্য — আমরা তা যাচাই করি না।`,
      `No information on this platform, and no answer from the AI health assistant or test assistant, is a substitute for advice from a doctor. It is general informational support only. Always consult a registered physician about any health concern.

Cross-matching and required screening tests at an authorised blood bank are mandatory before any donation or transfusion. Blood groups shown on the platform are self-reported by users and are not verified by us.`,
      4,
    ),
    section(
      "liability",
      "দায়সীমা",
      "Limitation of liability",
      `মুক্তসেবা ব্যবহারকারীদের দেওয়া তথ্যের সত্যতা যাচাই করে না এবং ব্যবহারকারীদের মধ্যে হওয়া যেকোনো লেনদেন, সাক্ষাৎ বা ঘটনার জন্য দায়ী নয়। রক্তদান বা রক্তগ্রহণের ফলে সৃষ্ট কোনো শারীরিক, আর্থিক বা অন্য যেকোনো ক্ষতির দায়ভার প্ল্যাটফর্মের উপর বর্তাবে না।

সেবাটি "যেমন আছে" (as-is) ভিত্তিতে প্রদান করা হয়। আমরা নিরবচ্ছিন্ন সেবা বা রক্তদাতা পাওয়ার নিশ্চয়তা দিই না।`,
      `Muktosheba does not verify information provided by users and is not responsible for any transaction, meeting or incident between users. The platform bears no liability for physical, financial or other harm arising from any donation or transfusion.

The service is provided on an "as-is" basis. We do not guarantee uninterrupted availability or that a donor will be found.`,
      5,
    ),
    section(
      "account",
      "অ্যাকাউন্ট বন্ধ করা",
      "Account suspension",
      `শর্তাবলী ভঙ্গ করলে আমরা পূর্ব নোটিশ ছাড়াই যেকোনো অ্যাকাউন্ট সাময়িক বা স্থায়ীভাবে বন্ধ করার অধিকার রাখি। আপনি নিজেও যেকোনো সময় অ্যাপের সেটিংস থেকে অ্যাকাউন্ট মুছে ফেলতে পারেন।`,
      `We reserve the right to suspend or permanently disable any account that breaches these terms, without prior notice. You may also delete your own account at any time from the app settings.`,
      6,
    ),
    section(
      "ip",
      "মেধাস্বত্ব",
      "Intellectual property",
      `মুক্তসেবা নাম, লোগো, ডিজাইন ও সোর্স কোড প্ল্যাটফর্মের মালিকানাধীন। অনুমতি ছাড়া এগুলো ব্যবহার বা অনুকরণ করা যাবে না। আপনি আপলোড করা কনটেন্টের মালিকানা আপনারই থাকে, তবে সেবা পরিচালনার জন্য তা প্রদর্শনের অনুমতি আপনি আমাদের দিচ্ছেন।`,
      `The Muktosheba name, logo, design and source code belong to the platform. They may not be used or imitated without permission. You retain ownership of content you upload, but grant us permission to display it as needed to operate the service.`,
      7,
    ),
    section(
      "law",
      "প্রযোজ্য আইন",
      "Governing law",
      `এই শর্তাবলী বাংলাদেশের প্রচলিত আইন অনুসারে পরিচালিত হবে। যেকোনো বিরোধ বাংলাদেশের উপযুক্ত আদালতের এক্তিয়ারাধীন।`,
      `These terms are governed by the laws of Bangladesh. Any dispute falls under the jurisdiction of the competent courts of Bangladesh.`,
      8,
    ),
  ],
};

export const DEFAULT_LEGAL_SETTINGS: LegalSettings = {
  privacy: DEFAULT_PRIVACY,
  terms: DEFAULT_TERMS,
  contact_email: "support@muktosheba.com",
  contact_phone: "",
  contact_address_bn: "ঢাকা, বাংলাদেশ",
  contact_address_en: "Dhaka, Bangladesh",
};

let cache: LegalSettings | null = null;
let cachedAt = 0;
const TTL = 60_000;

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function makeLegalSectionId(): string {
  return `sec_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSections(raw: unknown, fallback: LegalSection[]): LegalSection[] {
  if (!Array.isArray(raw)) return fallback.map((s) => ({ ...s }));
  const list = raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x, i) => ({
      id: str(x.id, makeLegalSectionId()),
      heading_bn: str(x.heading_bn, ""),
      heading_en: str(x.heading_en, ""),
      body_bn: str(x.body_bn, ""),
      body_en: str(x.body_en, ""),
      sort_order: num(x.sort_order, i + 1),
      is_active: bool(x.is_active, true),
    }));
  return list.sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeDoc(raw: unknown, d: LegalDoc): LegalDoc {
  const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: bool(x.enabled, d.enabled),
    title_bn: str(x.title_bn, d.title_bn),
    title_en: str(x.title_en, d.title_en),
    intro_bn: str(x.intro_bn, d.intro_bn),
    intro_en: str(x.intro_en, d.intro_en),
    effective_date: str(x.effective_date, d.effective_date),
    sections: normalizeSections(x.sections, d.sections),
  };
}

export function normalizeLegalSettings(raw: unknown): LegalSettings {
  const d = DEFAULT_LEGAL_SETTINGS;
  const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    privacy: normalizeDoc(x.privacy, d.privacy),
    terms: normalizeDoc(x.terms, d.terms),
    contact_email: str(x.contact_email, d.contact_email),
    contact_phone: str(x.contact_phone, d.contact_phone),
    contact_address_bn: str(x.contact_address_bn, d.contact_address_bn),
    contact_address_en: str(x.contact_address_en, d.contact_address_en),
  };
}

export function activeLegalSections(doc: LegalDoc): LegalSection[] {
  return [...(doc.sections ?? [])]
    .filter((s) => s.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function legalDocTitle(doc: LegalDoc, lang: "bn" | "en"): string {
  return (lang === "bn" ? doc.title_bn : doc.title_en) || doc.title_en || doc.title_bn;
}

export function legalDocIntro(doc: LegalDoc, lang: "bn" | "en"): string {
  return lang === "bn" ? doc.intro_bn : doc.intro_en;
}

export function legalSectionHeading(s: LegalSection, lang: "bn" | "en"): string {
  return (lang === "bn" ? s.heading_bn : s.heading_en) || s.heading_en || s.heading_bn;
}

export function legalSectionBody(s: LegalSection, lang: "bn" | "en"): string {
  return (lang === "bn" ? s.body_bn : s.body_en) || s.body_en || s.body_bn;
}

export type LegalBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/**
 * Split plain-text body into paragraphs and bullet lists.
 * Lines starting with "-", "*" or "•" become list items. No markdown/HTML parsing,
 * so admin-authored copy can never inject markup.
 */
export function parseLegalBody(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const chunks = body.split(/\n{2,}/);
  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    let buffer: string[] = [];
    let items: string[] = [];
    const flushText = () => {
      if (buffer.length) {
        blocks.push({ kind: "paragraph", text: buffer.join(" ") });
        buffer = [];
      }
    };
    const flushList = () => {
      if (items.length) {
        blocks.push({ kind: "list", items });
        items = [];
      }
    };
    for (const line of lines) {
      const bullet = /^[-*•]\s+(.*)$/.exec(line);
      if (bullet) {
        flushText();
        items.push(bullet[1]);
      } else {
        flushList();
        buffer.push(line);
      }
    }
    flushText();
    flushList();
  }
  return blocks;
}

export function invalidateLegalSettingsCache() {
  cache = null;
  cachedAt = 0;
}

async function db() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export async function fetchLegalSettings(force = false): Promise<LegalSettings> {
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  const supabase = await db();
  const { data, error } = await supabase
    .from("app_settings")
    .select("legal_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Column may not exist yet — fall back to defaults
    cache = cache ?? DEFAULT_LEGAL_SETTINGS;
    cachedAt = Date.now();
    return cache;
  }
  const row = data as { legal_settings?: unknown } | null;
  cache = normalizeLegalSettings(row?.legal_settings);
  cachedAt = Date.now();
  return cache;
}

export function peekLegalSettingsCache(): LegalSettings {
  return cache ?? DEFAULT_LEGAL_SETTINGS;
}

/** Cached / raced fetch so SSR HTML stays fast but still gets CMS when warm. */
export async function fetchLegalSettingsForLoader(maxWaitMs = 400): Promise<LegalSettings> {
  if (cache && Date.now() - cachedAt < TTL) return cache;

  const pending = fetchLegalSettings(true).catch(() => peekLegalSettingsCache());

  if (maxWaitMs <= 0) {
    void pending;
    return peekLegalSettingsCache();
  }

  return await new Promise<LegalSettings>((resolve) => {
    let settled = false;
    const done = (s: LegalSettings) => {
      if (settled) return;
      settled = true;
      resolve(s);
    };
    const timer = setTimeout(() => done(peekLegalSettingsCache()), maxWaitMs);
    void pending.then((s) => {
      clearTimeout(timer);
      done(s);
    });
  });
}

export async function saveLegalSettings(settings: LegalSettings): Promise<void> {
  const normalized = normalizeLegalSettings(settings);
  const supabase = await db();
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    legal_settings: normalized,
  } as never);
  if (error) throw error;
  cache = normalized;
  cachedAt = Date.now();
}
