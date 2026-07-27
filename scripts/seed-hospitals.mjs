/**
 * Apply hospitals migration SQL pieces that can be done via REST,
 * then seed all Bangladesh hospitals into public.hospitals.
 * Run: bun --env-file=.env run scripts/seed-hospitals.mjs
 *
 * Prerequisite: run supabase/migrations/20260728020000_hospitals_catalog.sql
 * in Supabase SQL Editor once (creates the table).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SECRET) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(URL, SECRET, {
  auth: { persistSession: false },
  global: { headers: { "User-Agent": "BloodLink-Seed/1.0" } },
});

// Inline seed (mirrors src/data/bangladesh-hospitals.ts essentials via dynamic import of built list)
const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadSeed() {
  // Parse TS data file roughly by evaluating exported array through bun
  const { BANGLADESH_HOSPITALS } = await import("../src/data/bangladesh-hospitals.ts");
  return BANGLADESH_HOSPITALS;
}

async function main() {
  const probe = await sb.from("hospitals").select("id").limit(1);
  if (probe.error) {
    console.error("\n❌ hospitals table missing.");
    console.error("Open Supabase SQL Editor and run:");
    console.error("  supabase/migrations/20260728020000_hospitals_catalog.sql\n");
    console.error(probe.error.message);
    process.exit(1);
  }

  const { data: districts, error: dErr } = await sb.from("districts").select("id,slug");
  if (dErr) throw dErr;
  const bySlug = new Map((districts ?? []).map((d) => [d.slug, d.id]));

  const seed = await loadSeed();
  console.log(`Seeding ${seed.length} hospitals…`);

  const rows = seed
    .map((h, i) => {
      const district_id = bySlug.get(h.districtSlug);
      if (!district_id) {
        console.warn("skip unknown district", h.districtSlug, h.slug);
        return null;
      }
      return {
        name_bn: h.name_bn,
        name_en: h.name_en,
        slug: h.slug,
        district_id,
        hospital_type: h.type,
        is_active: true,
        sort_order: i + 1,
      };
    })
    .filter(Boolean);

  // upsert in chunks
  const chunk = 80;
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from("hospitals").upsert(slice, { onConflict: "district_id,slug" });
    if (error) {
      console.error("chunk failed", error.message);
      // fallback insert ignore duplicates
      for (const row of slice) {
        const { error: e2 } = await sb.from("hospitals").insert(row);
        if (!e2) ok++;
        else if (!e2.message.includes("duplicate")) console.warn(e2.message);
        else ok++;
      }
    } else {
      ok += slice.length;
    }
  }

  await sb.from("cms_strings").upsert(
    [
      { key: "searchHospital", value_bn: "হাসপাতাল খুঁজুন…", value_en: "Search hospital…", category: "form" },
      { key: "hospital", value_bn: "হাসপাতাল", value_en: "Hospital", category: "form" },
      { key: "hospitals", value_bn: "হাসপাতালসমূহ", value_en: "Hospitals", category: "admin" },
      { key: "government", value_bn: "সরকারি", value_en: "Government", category: "form" },
      { key: "private", value_bn: "বেসরকারি", value_en: "Private", category: "form" },
    ],
    { onConflict: "key" },
  );

  console.log(`Done. Upserted ~${ok} hospitals.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
