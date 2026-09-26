import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/var/www/blood/.env", "utf8")
    .split(/\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      let value = line.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, i).trim(), value];
    }),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing supabase env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const SITE = "https://spandonbd.com";
const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /auth
Disallow: /home
Disallow: /chat
Disallow: /community
Disallow: /profile
Disallow: /settings
Disallow: /notifications
Disallow: /onboarding
Disallow: /me
Disallow: /ai
Disallow: /care
Disallow: /org
Disallow: /join-organization
Disallow: /api

Sitemap: ${SITE}/sitemap.xml
`;

function swapHost(value) {
  if (typeof value !== "string" || !value.trim()) return value;
  return value.replace(/https?:\/\/(www\.)?blood\.pgdiary\.cloud/gi, SITE);
}

const res = await fetch(`${url}/rest/v1/app_settings?id=eq.1&select=seo_settings`, { headers });
if (!res.ok) {
  console.error("read failed", res.status);
  process.exit(1);
}
const rows = await res.json();
const seo = { ...(rows[0]?.seo_settings ?? {}) };
seo.site_url = SITE;
seo.canonical_url = seo.canonical_url?.trim() && seo.canonical_url !== "https://blood.pgdiary.cloud" ? seo.canonical_url : "/";
seo.hreflang_bn = seo.hreflang_bn?.trim() || "/";
seo.hreflang_en = seo.hreflang_en?.trim() || "/?lang=en";
const hero = `${SITE}/landing/hero.jpg`;
const logo = `${SITE}/spandon-logo.jpg`;
seo.og_image_url = hero;
seo.twitter_image_url = hero;
seo.org_logo_url = logo;
seo.title_bn = "BloodLink — বাংলাদেশে রক্তদাতা খুঁজুন, জীবন বাঁচান";
seo.title_en = "BloodLink — Find blood donors across Bangladesh";
seo.og_title_bn = seo.title_bn;
seo.og_title_en = seo.title_en;
seo.description_bn =
  "বাংলাদেশজুড়ে জেলাভিত্তিক রক্তদাতা খুঁজুন, জরুরি রক্তের রিকোয়েস্ট দিন এবং কাছের ডোনারের সাথে যোগাযোগ করুন। BloodLink বিনামূল্যের রিয়েলটাইম রক্তদান নেটওয়ার্ক।";
seo.description_en =
  "Find blood donors by district across Bangladesh, post an urgent request, and reach nearby donors. BloodLink is a free realtime blood donation network.";
seo.og_description_bn = seo.description_bn;
seo.og_description_en = seo.description_en;
seo.twitter_title = seo.title_en;
seo.twitter_description = seo.description_en;
seo.keywords_bn =
  "রক্তদাতা খুঁজুন, জরুরি রক্ত লাগবে, জরুরি রক্তের রিকোয়েস্ট, ব্লাড ডোনার বাংলাদেশ, রক্তদান বাংলাদেশ, কাছের রক্তদাতা, জেলাভিত্তিক রক্তদাতা, ঢাকায় রক্তদাতা, চট্টগ্রাম রক্তদাতা, হাসপাতালে রক্ত, রক্তের গ্রুপ, এ পজিটিভ রক্তদাতা, বি পজিটিভ রক্তদাতা, ও পজিটিভ রক্তদাতা, এবি পজিটিভ রক্তদাতা, ও নেগেটিভ রক্তদাতা, রক্তের ব্যাগ, ফ্রি ব্লাড ডোনার, BloodLink, স্পন্দন";
seo.keywords_en =
  "find blood donor Bangladesh, urgent blood needed Bangladesh, blood donation Bangladesh, blood donor near me, emergency blood request, free blood donor network, district blood donor, blood donor Dhaka, blood donor Chittagong, A positive blood donor, B positive blood donor, O positive blood donor, AB positive blood donor, O negative rare blood donor, hospital blood request, BloodLink, Spandon";
seo.robots_index = true;
seo.robots_follow = true;
seo.json_ld_enabled = true;
seo.sitemap_enabled = true;
seo.robots_txt = robots;
if (!seo.title_bn) seo.title_bn = "Muktosheba — বাংলাদেশে রক্তদাতা খুঁজুন ও জরুরি রক্তদান";
if (!seo.title_en) seo.title_en = "Muktosheba — Find blood donors across Bangladesh";
if (!seo.description_bn) {
  seo.description_bn =
    "বাংলাদেশজুড়ে জেলাভিত্তিক রক্তদাতা খুঁজুন, জরুরি রক্তের রিকোয়েস্ট দিন এবং কাছের ডোনারের সাথে যোগাযোগ করুন। Muktosheba বিনামূল্যের রিয়েলটাইম রক্তদান নেটওয়ার্ক।";
}
if (!seo.description_en) {
  seo.description_en =
    "Find blood donors by district across Bangladesh, post an urgent request, and reach nearby donors. Muktosheba is a free realtime blood donation network.";
}

const upd = await fetch(`${url}/rest/v1/app_settings?id=eq.1`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ seo_settings: seo }),
});
if (!upd.ok) {
  console.error("write failed", upd.status);
  process.exit(1);
}
const saved = (await upd.json())[0]?.seo_settings ?? {};
console.log(
  JSON.stringify({
    site_url: saved.site_url,
    canonical_url: saved.canonical_url,
    sitemap_enabled: saved.sitemap_enabled,
    robots_index: saved.robots_index,
    has_robots_txt: Boolean(saved.robots_txt),
    google_verification: Boolean(String(saved.google_site_verification || "").trim()),
  }),
);
