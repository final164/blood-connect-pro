/**
 * Seed 10 video consultants (named booking ready).
 * Run: bun --env-file=.env run scripts/seed-tele-doctors.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SECRET) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const sb = createClient(URL, SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DOCTORS = [
  {
    id: "a1000001-0000-4000-8000-000000000001",
    full_name: "Dr. Rafiq Hasan",
    full_name_bn: "ডা. রফিক হাসান",
    bmdc_no: "TELE-DEMO-001",
    spec: "medicine",
    qualifications: "MBBS, FCPS (Medicine)",
    photo_url: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop",
    about_bn: "১৫+ বছর ধরে সাধারণ মেডিসিন ও দীর্ঘমেয়াদি রোগের ভিডিও পরামর্শ দিচ্ছেন।",
    about_en: "15+ years providing video consults for general medicine and chronic care.",
    experience_years: 15,
    workplace_bn: "ঢাকা মেডিকেল কলেজ হাসপাতাল",
    workplace_en: "Dhaka Medical College Hospital",
    fee_amount: 450,
    instant_enabled: true,
    is_popular: true,
    rating_avg: 4.85,
    rating_count: 42,
    sort_order: 10,
  },
  {
    id: "a1000001-0000-4000-8000-000000000002",
    full_name: "Dr. Nusrat Jahan",
    full_name_bn: "ডা. নুসরাত জাহান",
    bmdc_no: "TELE-DEMO-002",
    spec: "cardiology",
    qualifications: "MBBS, MD (Cardiology)",
    photo_url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop",
    about_bn: "হৃদরোগ, উচ্চ রক্তচাপ ও কোলেস্টেরল নিয়ন্ত্রণে অনলাইন ফলো-আপ।",
    about_en: "Online follow-up for heart disease, hypertension and cholesterol control.",
    experience_years: 12,
    workplace_bn: "ন্যাশনাল হার্ট ফাউন্ডেশন",
    workplace_en: "National Heart Foundation",
    fee_amount: 850,
    instant_enabled: false,
    is_popular: true,
    rating_avg: 4.92,
    rating_count: 68,
    sort_order: 20,
  },
  {
    id: "a1000001-0000-4000-8000-000000000003",
    full_name: "Dr. Farhana Akter",
    full_name_bn: "ডা. ফারহানা আক্তার",
    bmdc_no: "TELE-DEMO-003",
    spec: "gynecology",
    qualifications: "MBBS, FCPS (Obs & Gynae)",
    photo_url: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop",
    about_bn: "গর্ভাবস্থা, মাসিক সমস্যা ও নারী স্বাস্থ্য বিষয়ে ভিডিও কনসালট।",
    about_en: "Video consults for pregnancy care, menstrual issues and women's health.",
    experience_years: 14,
    workplace_bn: "স্কয়ার হাসপাতাল",
    workplace_en: "Square Hospital",
    fee_amount: 750,
    instant_enabled: true,
    is_popular: true,
    rating_avg: 4.78,
    rating_count: 55,
    sort_order: 30,
  },
  {
    id: "a1000001-0000-4000-8000-000000000004",
    full_name: "Dr. Tanvir Ahmed",
    full_name_bn: "ডা. তানভীর আহমেদ",
    bmdc_no: "TELE-DEMO-004",
    spec: "pediatrics",
    qualifications: "MBBS, DCH, FCPS (Pediatrics)",
    photo_url: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop",
    about_bn: "শিশু জ্বর, কাশি, খাদ্য ও টিকা পরামর্শ — বাবা-মায়ের জন্য সহজ ভিডিও সেশন।",
    about_en: "Child fever, cough, nutrition and vaccine advice via easy video sessions.",
    experience_years: 11,
    workplace_bn: "চাইল্ড কেয়ার সেন্টার",
    workplace_en: "Child Care Center",
    fee_amount: 550,
    instant_enabled: true,
    is_popular: true,
    rating_avg: 4.88,
    rating_count: 91,
    sort_order: 40,
  },
  {
    id: "a1000001-0000-4000-8000-000000000005",
    full_name: "Dr. Sabina Yasmin",
    full_name_bn: "ডা. সাবিনা ইয়াসমিন",
    bmdc_no: "TELE-DEMO-005",
    spec: "ent",
    qualifications: "MBBS, MS (ENT)",
    photo_url: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=400&h=400&fit=crop",
    about_bn: "সাইনাস, কানের ব্যথা, গলার ইনফেকশন ও অ্যালার্জি পরামর্শ।",
    about_en: "Consults for sinus, ear pain, throat infection and allergy.",
    experience_years: 10,
    workplace_bn: "বাংলাদেশ ইএনটি হাসপাতাল",
    workplace_en: "Bangladesh ENT Hospital",
    fee_amount: 600,
    instant_enabled: false,
    is_popular: false,
    rating_avg: 4.7,
    rating_count: 33,
    sort_order: 50,
  },
  {
    id: "a1000001-0000-4000-8000-000000000006",
    full_name: "Dr. Imran Chowdhury",
    full_name_bn: "ডা. ইমরান চৌধুরী",
    bmdc_no: "TELE-DEMO-006",
    spec: "orthopedics",
    qualifications: "MBBS, MS (Ortho)",
    photo_url: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop",
    about_bn: "কোমর ব্যথা, হাঁটু ব্যথা ও স্পোর্টস ইনজুরির প্রাথমিক অনলাইন মূল্যায়ন।",
    about_en: "Initial online assessment for back pain, knee pain and sports injury.",
    experience_years: 16,
    workplace_bn: "অ্যাপোলো হাসপাতাল",
    workplace_en: "Apollo Hospital",
    fee_amount: 800,
    instant_enabled: false,
    is_popular: true,
    rating_avg: 4.65,
    rating_count: 47,
    sort_order: 60,
  },
  {
    id: "a1000001-0000-4000-8000-000000000007",
    full_name: "Dr. Mehnaz Rahman",
    full_name_bn: "ডা. মেহনাজ রহমান",
    bmdc_no: "TELE-DEMO-007",
    spec: "dermatology",
    qualifications: "MBBS, DDV, FCPS (Dermatology)",
    photo_url: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=400&h=400&fit=crop",
    about_bn: "ব্রণ, একজিমা, চুল পড়া ও ত্বকের অ্যালার্জির ভিডিও পরামর্শ।",
    about_en: "Video advice for acne, eczema, hair fall and skin allergy.",
    experience_years: 9,
    workplace_bn: "লেজার ও ডার্মা কেয়ার",
    workplace_en: "Laser & Derma Care",
    fee_amount: 650,
    instant_enabled: true,
    is_popular: true,
    rating_avg: 4.91,
    rating_count: 112,
    sort_order: 70,
  },
  {
    id: "a1000001-0000-4000-8000-000000000008",
    full_name: "Dr. Karim Uddin",
    full_name_bn: "ডা. করিম উদ্দিন",
    bmdc_no: "TELE-DEMO-008",
    spec: "general",
    qualifications: "MBBS, MPH",
    photo_url: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop",
    about_bn: "সাধারণ অসুস্থতা, প্রেসক্রিপশন রিভিউ ও দ্রুত দ্বিতীয় মতামত।",
    about_en: "General illness, prescription review and quick second opinion.",
    experience_years: 8,
    workplace_bn: "মুক্তসেবা কেয়ার পার্টনার",
    workplace_en: "Muktosheba Care Partner",
    fee_amount: 350,
    instant_enabled: true,
    is_popular: false,
    rating_avg: 4.55,
    rating_count: 28,
    sort_order: 80,
  },
  {
    id: "a1000001-0000-4000-8000-000000000009",
    full_name: "Dr. Anika Sultana",
    full_name_bn: "ডা. আনিকা সুলতানা",
    bmdc_no: "TELE-DEMO-009",
    spec: "medicine",
    qualifications: "MBBS, MD (Internal Medicine)",
    photo_url: "https://images.unsplash.com/photo-1614608682850-af0d6d4d1d52?w=400&h=400&fit=crop",
    about_bn: "ডায়াবেটিস, থাইরয়েড ও গ্যাস্ট্রিক সমস্যার নিয়মিত ভিডিও ফলো-আপ।",
    about_en: "Regular video follow-up for diabetes, thyroid and gastric issues.",
    experience_years: 13,
    workplace_bn: "ইবনে সিনা হাসপাতাল",
    workplace_en: "Ibn Sina Hospital",
    fee_amount: 500,
    instant_enabled: true,
    is_popular: true,
    rating_avg: 4.8,
    rating_count: 76,
    sort_order: 90,
  },
  {
    id: "a1000001-0000-4000-8000-00000000000a",
    full_name: "Dr. Shahriar Kabir",
    full_name_bn: "ডা. শাহরিয়ার কবির",
    bmdc_no: "TELE-DEMO-010",
    spec: "cardiology",
    qualifications: "MBBS, MRCP, FACC",
    photo_url: "https://images.unsplash.com/photo-1607990283143-e81e7a2c9349?w=400&h=400&fit=crop",
    about_bn: "বুক ধড়ফড়, বুকে ব্যথা ও হার্ট ফেইলিউর ফলো-আপের জন্য বিশেষজ্ঞ ভিডিও কনসালট।",
    about_en: "Specialist video consult for palpitations, chest pain and heart-failure follow-up.",
    experience_years: 18,
    workplace_bn: "ইউনাইটেড হাসপাতাল",
    workplace_en: "United Hospital",
    fee_amount: 950,
    instant_enabled: false,
    is_popular: true,
    rating_avg: 4.95,
    rating_count: 120,
    sort_order: 100,
  },
];

const SLOTS = [
  { weekday: 0, start_time: "18:00:00", end_time: "21:00:00" },
  { weekday: 1, start_time: "18:00:00", end_time: "21:00:00" },
  { weekday: 2, start_time: "18:00:00", end_time: "21:00:00" },
  { weekday: 3, start_time: "18:00:00", end_time: "21:00:00" },
  { weekday: 4, start_time: "18:00:00", end_time: "21:00:00" },
  { weekday: 6, start_time: "09:00:00", end_time: "12:00:00" },
  { weekday: 6, start_time: "16:00:00", end_time: "19:00:00" },
];

async function must(res, label) {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

async function main() {
  const specs = await must(await sb.from("care_specialties").select("id, slug"), "specialties");
  const specBySlug = Object.fromEntries((specs ?? []).map((s) => [s.slug, s.id]));

  await sb.from("care_doctors").delete().like("bmdc_no", "TELE-DEMO-%");

  console.log("Seeding 10 tele demo doctors…");

  for (const d of DOCTORS) {
    const specialty_id = specBySlug[d.spec] ?? specBySlug.general ?? null;
    await must(
      await sb.from("care_doctors").upsert({
        id: d.id,
        full_name: d.full_name,
        full_name_bn: d.full_name_bn,
        bmdc_no: d.bmdc_no,
        specialty_id,
        qualifications: d.qualifications,
        photo_url: d.photo_url,
        bio: d.about_en,
        bio_bn: d.about_bn,
        is_active: true,
      }),
      d.bmdc_no,
    );

    await must(
      await sb.from("tele_doctor_profiles").upsert({
        doctor_id: d.id,
        video_enabled: true,
        instant_enabled: d.instant_enabled,
        is_online: d.instant_enabled,
        is_popular: d.is_popular,
        about_bn: d.about_bn,
        about_en: d.about_en,
        experience_years: d.experience_years,
        workplace_bn: d.workplace_bn,
        workplace_en: d.workplace_en,
        hero_image_url: d.photo_url,
        fee_amount: d.fee_amount,
        rating_avg: d.rating_avg,
        rating_count: d.rating_count,
        sort_order: d.sort_order,
        updated_at: new Date().toISOString(),
      }),
      `profile ${d.bmdc_no}`,
    );

    await sb.from("tele_doctor_slots").delete().eq("doctor_id", d.id);
    await must(
      await sb.from("tele_doctor_slots").insert(
        SLOTS.map((s) => ({ ...s, doctor_id: d.id, is_active: true })),
      ),
      `slots ${d.bmdc_no}`,
    );

    console.log(`  ✓ ${d.full_name} · ৳${d.fee_amount} · ${d.spec}`);
  }

  for (const slug of Object.keys(specBySlug)) {
    for (const [mode, fee] of [
      ["instant", 299],
      ["named", 650],
    ]) {
      await sb.from("tele_consult_products").upsert(
        {
          specialty_id: specBySlug[slug],
          mode,
          fee_amount: fee,
          duration_minutes: 20,
          is_active: true,
        },
        { onConflict: "specialty_id,mode" },
      );
    }
  }

  const { data: settings } = await sb.from("app_settings").select("tele_settings").eq("id", 1).maybeSingle();
  if (settings) {
    await sb
      .from("app_settings")
      .update({
        tele_settings: {
          ...(settings.tele_settings && typeof settings.tele_settings === "object"
            ? settings.tele_settings
            : {}),
          tele_enabled: true,
          instant_enabled: true,
        },
      })
      .eq("id", 1);
  }

  console.log("\nDone. Open /care/video — pick any doctor → Book Appointment.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
