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

const keywords_bn =
  "রক্তদাতা খুঁজুন, জরুরি রক্ত লাগবে, জরুরি রক্তের রিকোয়েস্ট, ব্লাড ডোনার বাংলাদেশ, রক্তদান বাংলাদেশ, কাছের রক্তদাতা, জেলাভিত্তিক রক্তদাতা, ঢাকায় রক্তদাতা, চট্টগ্রাম রক্তদাতা, হাসপাতালে রক্ত, রক্তের গ্রুপ, এ পজিটিভ রক্তদাতা, বি পজিটিভ রক্তদাতা, ও পজিটিভ রক্তদাতা, এবি পজিটিভ রক্তদাতা, ও নেগেটিভ রক্তদাতা, রক্তের ব্যাগ, ফ্রি ব্লাড ডোনার, BloodLink, স্পন্দন";
const keywords_en =
  "find blood donor Bangladesh, urgent blood needed Bangladesh, blood donation Bangladesh, blood donor near me, emergency blood request, free blood donor network, district blood donor, blood donor Dhaka, blood donor Chittagong, A positive blood donor, B positive blood donor, O positive blood donor, AB positive blood donor, O negative rare blood donor, hospital blood request, BloodLink, Spandon";

const res = await fetch(`${url}/rest/v1/app_settings?id=eq.1&select=seo_settings`, { headers });
if (!res.ok) {
  console.error("read failed", res.status);
  process.exit(1);
}
const seo = { ...((await res.json())[0]?.seo_settings ?? {}) };
seo.keywords_bn = keywords_bn;
seo.keywords_en = keywords_en;

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
    keywords_bn: saved.keywords_bn,
    keywords_en: saved.keywords_en,
    og_image_unchanged: saved.og_image_url,
  }),
);
