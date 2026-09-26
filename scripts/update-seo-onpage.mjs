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
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const titleBn = "রক্তদাতা খুঁজুন বাংলাদেশ — BloodLink";
const titleEn = "Find a blood donor in Bangladesh — BloodLink";
const descBn =
  "জরুরি রক্ত লাগবে? বাংলাদেশে জেলাভিত্তিক রক্তদাতা খুঁজুন, ব্লাড ডোনার দেখুন এবং রিকোয়েস্ট দিন। ঢাকা, চট্টগ্রামসহ A+ B+ O+ AB+ ও O- ডোনার — বিনামূল্যে, BloodLink স্পন্দন।";
const descEn =
  "Urgent blood needed in Bangladesh? Find a blood donor by district, see A+ B+ O+ AB+ and O- donors, and post a request free on BloodLink Spandon.";

const res = await fetch(
  `${url}/rest/v1/app_settings?id=eq.1&select=seo_settings,landing_settings`,
  { headers },
);
if (!res.ok) {
  console.error("read failed", res.status);
  process.exit(1);
}
const row = (await res.json())[0] ?? {};
const seo = { ...(row.seo_settings ?? {}) };
const landing = { ...(row.landing_settings ?? {}) };
const hero = { ...(landing.hero ?? {}) };
const landingSeo = { ...(landing.seo ?? {}) };

const before = hero.headline_bn;
seo.title_bn = titleBn;
seo.title_en = titleEn;
seo.og_title_bn = titleBn;
seo.og_title_en = titleEn;
seo.description_bn = descBn;
seo.description_en = descEn;
seo.og_description_bn = descBn;
seo.og_description_en = descEn;
seo.twitter_title = titleEn;
seo.twitter_description = descEn;

hero.headline_bn = "বাংলাদেশে রক্তদাতা খুঁজুন";
hero.headline_en = "Find a blood donor in Bangladesh";
hero.sub_bn =
  "জরুরি রক্ত লাগবে? ঢাকা, চট্টগ্রামসহ সারা বাংলাদেশে জেলাভিত্তিক ব্লাড ডোনার খুঁজুন — A+, B+, O+, AB+ ও O-। রিকোয়েস্ট দিন, বিনামূল্যে।";
hero.sub_en =
  "Urgent blood needed? Find a district blood donor across Bangladesh, including Dhaka and Chittagong — A+, B+, O+, AB+ and O-. Post a request free.";
landing.hero = hero;
landingSeo.title_bn = titleBn;
landingSeo.title_en = titleEn;
landingSeo.description_bn = descBn;
landingSeo.description_en = descEn;
landing.seo = landingSeo;

const upd = await fetch(`${url}/rest/v1/app_settings?id=eq.1`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ seo_settings: seo, landing_settings: landing }),
});
if (!upd.ok) {
  console.error("write failed", upd.status, await upd.text());
  process.exit(1);
}
console.log(JSON.stringify({ before_h1: before, after_h1: hero.headline_bn, title: titleBn }));
