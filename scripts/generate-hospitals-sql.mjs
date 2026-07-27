import { readFileSync, writeFileSync } from "fs";
import { BANGLADESH_HOSPITALS } from "../src/data/bangladesh-hospitals.ts";

const ddl = [
  readFileSync(new URL("../supabase/migrations/20260728020000_hospitals_catalog.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../supabase/migrations/20260728030000_hospital_types_clinic_dx.sql", import.meta.url), "utf8"),
].join("\n\n");

const esc = (s) => s.replace(/'/g, "''");

const values = BANGLADESH_HOSPITALS.map((h) => {
  return `((SELECT id FROM public.districts WHERE slug='${h.districtSlug}' LIMIT 1), '${esc(h.name_bn)}', '${esc(h.name_en)}', '${esc(h.slug)}', '${h.type}')`;
}).join(",\n");

const seed = `
-- Seed hospitals (idempotent)
INSERT INTO public.hospitals (district_id, name_bn, name_en, slug, hospital_type)
SELECT v.district_id, v.name_bn, v.name_en, v.slug, v.hospital_type::text
FROM (VALUES
${values}
) AS v(district_id, name_bn, name_en, slug, hospital_type)
WHERE v.district_id IS NOT NULL
ON CONFLICT (district_id, slug) DO UPDATE SET
  name_bn = EXCLUDED.name_bn,
  name_en = EXCLUDED.name_en,
  hospital_type = EXCLUDED.hospital_type,
  is_active = true;
`;

writeFileSync(new URL("./hospitals-full.sql", import.meta.url), `${ddl}\n${seed}`);
console.log("Wrote scripts/hospitals-full.sql — hospitals:", BANGLADESH_HOSPITALS.length);
