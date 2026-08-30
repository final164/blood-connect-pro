/**
 * Backfill demo profile fields on DEMO- / TELE-DEMO- / DEMO-OP- doctors
 * (names, DOB, gender, ID doc, type, quals, photo, bio).
 *
 * Run: bun --env-file=.env run scripts/seed-doctor-profiles.mjs
 *   or: npm run seed:doctor-profiles
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
const PHOTOS = [
  "/landing/care-team.jpg",
  "/landing/nurse.jpg",
  "/landing/hospital.jpg",
  "/landing/clinic.jpg",
  "/landing/ward.jpg",
  "/landing/volunteer.jpg",
];

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

function demoBio(name, years, specialtyHint) {
  const short = String(name || "ডাক্তার").replace(/^(Prof\.\s*)?Dr\.\s*/i, "").trim();
  return {
    bio_bn: `ডা. ${short} ${years}+ বছরের অভিজ্ঞ ${specialtyHint || "চিকিৎসক"}। রোগী-বান্ধব পরামর্শ, স্বচ্ছ ফি এবং নিয়মিত ফলো-আপ। চেম্বার সিরিয়াল ও প্রয়োজনে ভিডিও কনসালটেশন উপলব্ধ।`,
    bio: `Dr. ${short} is an experienced ${specialtyHint || "physician"} with ${years}+ years of practice. Patient-friendly consultation, transparent fees, and regular follow-up. Chamber serials and video consult available.`,
  };
}

const { data: rows, error } = await sb
  .from("care_doctors")
  .select(
    "id, full_name, full_name_bn, bmdc_no, doctor_code, phone, email, specialty_id, qualifications, photo_url, bio, bio_bn, care_specialties(name_bn, name_en)",
  )
  .or("bmdc_no.ilike.DEMO-%,bmdc_no.ilike.TELE-DEMO-%,bmdc_no.ilike.DEMO-OP-%")
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
  const years = 8 + ((i * 2) % 20);
  const spec = d.care_specialties;
  const specHint = spec?.name_bn || spec?.name_en || "চিকিৎসক";
  const bios = demoBio(d.full_name, years, specHint);
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
    photo_url: d.photo_url || PHOTOS[(i - 1) % PHOTOS.length],
    bio: d.bio || bios.bio,
    bio_bn: d.bio_bn || bios.bio_bn,
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
    `  ✓ ${d.doctor_code || d.bmdc_no}  photo · bio · ${kind}/${doctor_type}`,
  );

  // Enrich linked tele profile when present
  const { data: tele } = await sb
    .from("tele_doctor_profiles")
    .select("doctor_id, about_bn, about_en, experience_years, workplace_bn, workplace_en, fee_amount, hero_image_url")
    .eq("doctor_id", d.id)
    .maybeSingle();
  if (tele) {
    const telePatch = {
      about_bn: tele.about_bn || bios.bio_bn,
      about_en: tele.about_en || bios.bio,
      experience_years: tele.experience_years ?? years,
      workplace_bn: tele.workplace_bn || "ডেমো মেডিকেল কলেজ হাসপাতাল",
      workplace_en: tele.workplace_en || "Demo Medical College Hospital",
      fee_amount: tele.fee_amount ?? 400 + (i % 5) * 50,
      hero_image_url: tele.hero_image_url || base.photo_url,
      follow_up_fee: 250 + (i % 4) * 20,
      follow_up_days: 7,
      avg_consult_minutes: 15,
      notice_bn:
        tele.notice_bn ||
        "এই সেবা জরুরি, অচেতন বা পুলিশ কেস রোগীর জন্য নয়।",
      notice_en:
        tele.notice_en ||
        "This service is not for emergency, unconscious, or police-case patients.",
      instructions_bn:
        tele.instructions_bn ||
        "• শান্ত পরিবেশ রাখুন\n• হেডফোন ব্যবহার করুন\n• লক্ষণ ও পুরনো রিপোর্ট প্রস্তুত রাখুন",
      instructions_en:
        tele.instructions_en ||
        "• Keep a quiet environment\n• Use headphones\n• Keep symptoms and prior reports ready",
      helpline: tele.helpline || "09612885599",
      updated_at: new Date().toISOString(),
    };
    const { error: tErr } = await sb
      .from("tele_doctor_profiles")
      .update(telePatch)
      .eq("doctor_id", d.id);
    if (tErr) console.warn("  tele", tErr.message);
    else console.log("    ↳ tele profile enriched");
  }
}

console.log("Done.");
