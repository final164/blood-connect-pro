/**
 * Backfill demo profile fields on DEMO- / TELE-DEMO- doctors
 * (names, DOB, gender, ID doc kind+number, type, quals, etc.).
 *
 * Run: bun --env-file=.env run scripts/seed-doctor-profiles.mjs
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

const KINDS = ["nid", "passport", "driving_license"];
const TYPES = ["general", "specialist", "consultant", "surgeon"];

function splitName(full) {
  const cleaned = String(full || "")
    .replace(/^(Prof\.\s*)?Dr\.\s*/i, "")
    .trim();
  const parts = cleaned.split(/\s+/);
  return {
    title: /Prof/i.test(full) ? "Prof. Dr." : "Dr.",
    first_name: parts[0] || "Demo",
    last_name: parts.slice(1).join(" ") || "Doctor",
  };
}

function idNo(kind, i) {
  if (kind === "nid") return `198${String(5000000000 + i).slice(0, 10)}`;
  if (kind === "passport") return `BP${String(1000000 + i).slice(0, 7)}`;
  return `DL-DHA-${100000 + i}`;
}

const { data: rows, error } = await sb
  .from("care_doctors")
  .select(
    "id, full_name, full_name_bn, bmdc_no, doctor_code, phone, email, specialty_id, qualifications",
  )
  .or("bmdc_no.ilike.DEMO-%,bmdc_no.ilike.TELE-DEMO-%")
  .eq("is_active", true);
if (error) throw error;

console.log(`Updating ${rows?.length ?? 0} demo doctors…`);

let i = 0;
for (const d of rows ?? []) {
  i += 1;
  const kind = KINDS[(i - 1) % KINDS.length];
  const doctor_type = TYPES[(i - 1) % TYPES.length];
  const names = splitName(d.full_name);
  const y = 1975 + ((i * 3) % 20);
  const m = String(((i * 5) % 12) + 1).padStart(2, "0");
  const day = String(((i * 7) % 27) + 1).padStart(2, "0");
  const base = {
    title: names.title,
    first_name: names.first_name,
    last_name: names.last_name,
    full_name_bn: d.full_name_bn || d.full_name,
    date_of_birth: `${y}-${m}-${day}`,
    gender: i % 3 === 0 ? "female" : "male",
    nid_passport: idNo(kind, i),
    doctor_type,
    qualifications: d.qualifications || "MBBS, FCPS",
    email: d.email || `demo.doctor.${String(i).padStart(3, "0")}@muktosheba.app`,
    phone: d.phone || `0171${String(2000000 + i).slice(0, 7)}`,
  };
  let { error: uErr } = await sb
    .from("care_doctors")
    .update({ ...base, id_document_kind: kind })
    .eq("id", d.id);
  if (uErr && /id_document_kind|schema cache/i.test(uErr.message)) {
    ({ error: uErr } = await sb.from("care_doctors").update(base).eq("id", d.id));
  }
  if (uErr) {
    console.error("  ✗", d.doctor_code || d.bmdc_no, uErr.message);
    continue;
  }
  console.log(
    `  ✓ ${d.doctor_code || d.bmdc_no}  ${kind}/${base.nid_passport}  · ${doctor_type}`,
  );
}

console.log("Done.");
