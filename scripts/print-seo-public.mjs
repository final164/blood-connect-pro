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
const res = await fetch(`${url}/rest/v1/app_settings?id=eq.1&select=seo_settings`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const seo = (await res.json())[0]?.seo_settings ?? {};
console.log(
  JSON.stringify(
    {
      site_url: seo.site_url,
      title_bn: seo.title_bn,
      title_en: seo.title_en,
      og_image_url: seo.og_image_url,
      twitter_image_url: seo.twitter_image_url,
      org_name: seo.org_name,
      robots_txt_start: String(seo.robots_txt || "").slice(0, 80),
    },
    null,
    2,
  ),
);
