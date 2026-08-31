/**
 * Ensure tele demo doctors have varied experience_years for AI serial ranking QA.
 * Run: bun --env-file=.env run scripts/seed-ai-serial-qa.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SECRET) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(URL, SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** BMDC → experience years for ranking demos */
const EXP = {
  "TELE-DEMO-001": 8,
  "TELE-DEMO-002": 18,
  "TELE-DEMO-003": 12,
  "TELE-DEMO-004": 5,
  "TELE-DEMO-005": 22,
};

async function main() {
  for (const [bmdc, years] of Object.entries(EXP)) {
    const { data: doc } = await sb
      .from("care_doctors")
      .select("id")
      .eq("bmdc_no", bmdc)
      .maybeSingle();
    if (!doc?.id) {
      console.warn(`Skip ${bmdc}: not found`);
      continue;
    }
    const { data: existing } = await sb
      .from("tele_doctor_profiles")
      .select("doctor_id")
      .eq("doctor_id", doc.id)
      .maybeSingle();
    if (!existing) {
      console.warn(`Skip ${bmdc}: no tele profile (run seed:tele-doctors)`);
      continue;
    }
    const { error } = await sb
      .from("tele_doctor_profiles")
      .update({ experience_years: years, updated_at: new Date().toISOString() })
      .eq("doctor_id", doc.id);
    if (error) console.warn(bmdc, error.message);
    else console.log(`${bmdc} → ${years} yrs`);
  }
  console.log("Done. Test AI serial ranking: best_value vs experience_first in same district.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
