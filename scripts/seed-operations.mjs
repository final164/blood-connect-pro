/**
 * Seed 10 complete demo operation offerings — package price, breakdown,
 * multi-doctor teams, and sample bookings — on top of the demo Care vendors.
 *
 * Depends on scripts/seed-care-vendors.mjs (demo orgs by phone).
 * Run: bun --env-file=.env run scripts/seed-operations.mjs
 *   or: npm run seed:operations
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
  global: { headers: { "User-Agent": "BloodLink-OperationSeed/1.0" } },
});

/** Surgeons shared across clinics so doctor/clinic filters have real data. */
const SURGEONS = [
  {
    bmdc: "DEMO-OP-01",
    name: "Prof. Dr. Mizanur Rahman",
    name_bn: "প্রফেসর ডাঃ মিজানুর রহমান",
    spec: "surgery",
    qual: "MBBS, FCPS (Surgery)",
  },
  {
    bmdc: "DEMO-OP-02",
    name: "Dr. Shirin Sultana",
    name_bn: "ডাঃ শিরিন সুলতানা",
    spec: "gynecology",
    qual: "MBBS, FCPS (Gynae & Obs)",
  },
  {
    bmdc: "DEMO-OP-03",
    name: "Dr. Habibur Rahman",
    name_bn: "ডাঃ হাবিবুর রহমান",
    spec: "orthopedics",
    qual: "MBBS, MS (Ortho)",
  },
  {
    bmdc: "DEMO-OP-04",
    name: "Dr. Nusrat Jahan",
    name_bn: "ডাঃ নুসরাত জাহান",
    spec: "ophthalmology",
    qual: "MBBS, DO, FCPS (Eye)",
  },
  {
    bmdc: "DEMO-OP-05",
    name: "Dr. Asaduzzaman Khan",
    name_bn: "ডাঃ আসাদুজ্জামান খান",
    spec: "urology",
    qual: "MBBS, MS (Urology)",
  },
  {
    bmdc: "DEMO-OP-06",
    name: "Dr. Rokeya Begum",
    name_bn: "ডাঃ রোকেয়া বেগম",
    spec: "anesthesiology",
    qual: "MBBS, DA",
  },
  {
    bmdc: "DEMO-OP-07",
    name: "Dr. Kamrul Hasan",
    name_bn: "ডাঃ কামরুল হাসান",
    spec: "ent",
    qual: "MBBS, FCPS (ENT)",
  },
  {
    bmdc: "DEMO-OP-08",
    name: "Prof. Dr. Nasreen Akter",
    name_bn: "প্রফেসর ডাঃ নাসরিন আক্তার",
    spec: "surgery",
    qual: "MBBS, MS (General Surgery)",
  },
];

/**
 * Exactly 10 demo offerings across 3 clinics.
 * Same operations at different clinics keep different prices for comparison.
 */
const DEMO_OFFERINGS = [
  // 1 — Popular Diagnostic · Appendectomy
  {
    phone: "01733333333",
    code: "OP-APPEN",
    price: 38000,
    original: 45000,
    doctors: ["DEMO-OP-01", "DEMO-OP-06"],
    items: [
      ["surgeon", 18000],
      ["ot", 9000],
      ["anesthesia", 6000],
      ["bed", 5000],
    ],
    note_bn: "ঔষধ ও পোস্ট-অপ টেস্ট আলাদা",
    note_en: "Medicine and post-op tests billed separately",
  },
  // 2 — Popular · Gallbladder
  {
    phone: "01733333333",
    code: "OP-GALL",
    price: 62000,
    original: 72000,
    doctors: ["DEMO-OP-01", "DEMO-OP-08", "DEMO-OP-06"],
    items: [
      ["surgeon", 28000],
      ["ot", 14000],
      ["anesthesia", 9000],
      ["bed", 9000],
      ["investigation", 2000],
    ],
    note_bn: "ল্যাপারোস্কোপিক প্যাকেজ",
    note_en: "Laparoscopic package",
  },
  // 3 — Popular · C-section
  {
    phone: "01733333333",
    code: "OP-CS",
    price: 55000,
    original: null,
    doctors: ["DEMO-OP-02", "DEMO-OP-06"],
    items: [
      ["surgeon", 25000],
      ["ot", 12000],
      ["anesthesia", 8000],
      ["bed", 10000],
    ],
    note_bn: "মা ও শিশুর কেবিন অন্তর্ভুক্ত",
    note_en: "Mother & baby cabin included",
  },
  // 4 — Popular · Cataract
  {
    phone: "01733333333",
    code: "OP-CATARACT",
    price: 26000,
    original: 32000,
    doctors: ["DEMO-OP-04"],
    items: [
      ["surgeon", 14000],
      ["ot", 7000],
      ["investigation", 5000],
    ],
    note_bn: "লেন্স খরচ প্যাকেজে",
    note_en: "Lens cost included in package",
  },
  // 5 — Sylhet Care · Appendectomy (cheaper — same surgeon, compare price)
  {
    phone: "01755555555",
    code: "OP-APPEN",
    price: 32000,
    original: null,
    doctors: ["DEMO-OP-01", "DEMO-OP-06"],
    items: [
      ["surgeon", 15000],
      ["ot", 8000],
      ["anesthesia", 5000],
      ["bed", 4000],
    ],
    note_bn: "জেনারেল ওয়ার্ড প্যাকেজ",
    note_en: "General ward package",
  },
  // 6 — Sylhet · C-section
  {
    phone: "01755555555",
    code: "OP-CS",
    price: 48000,
    original: 58000,
    doctors: ["DEMO-OP-02", "DEMO-OP-06"],
    items: [
      ["surgeon", 22000],
      ["ot", 10000],
      ["anesthesia", 7000],
      ["bed", 9000],
    ],
    note_bn: "জরুরি সিজারিয়ানও সম্ভব",
    note_en: "Emergency C-section also available",
  },
  // 7 — Sylhet · Fracture fixation
  {
    phone: "01755555555",
    code: "OP-FRACT",
    price: 72000,
    original: null,
    doctors: ["DEMO-OP-03", "DEMO-OP-06"],
    items: [
      ["surgeon", 32000],
      ["ot", 16000],
      ["anesthesia", 9000],
      ["bed", 15000],
    ],
    note_bn: "ইমপ্লান্ট খরচ আলাদা হতে পারে",
    note_en: "Implant cost may be extra",
  },
  // 8 — Sylhet · Kidney stone
  {
    phone: "01755555555",
    code: "OP-KIDSTONE",
    price: 85000,
    original: 95000,
    doctors: ["DEMO-OP-05", "DEMO-OP-06"],
    items: [
      ["surgeon", 40000],
      ["ot", 20000],
      ["anesthesia", 10000],
      ["bed", 15000],
    ],
    note_bn: "PCNL প্যাকেজ · ইউরিন কালচার লাগবে",
    note_en: "PCNL package · urine culture required",
  },
  // 9 — Ibn Sina Rajshahi · Cataract (same doctor, cheaper clinic)
  {
    phone: "01744444444",
    code: "OP-CATARACT",
    price: 19000,
    original: 24000,
    doctors: ["DEMO-OP-04"],
    items: [
      ["surgeon", 11000],
      ["ot", 5000],
      ["investigation", 3000],
    ],
    note_bn: "ডে-কেয়ার · একই দিনে ছাড়া",
    note_en: "Day-care · same-day discharge",
  },
  // 10 — Ibn Sina · Tonsillectomy
  {
    phone: "01744444444",
    code: "OP-TONSIL",
    price: 28000,
    original: 34000,
    doctors: ["DEMO-OP-07", "DEMO-OP-06"],
    items: [
      ["surgeon", 12000],
      ["ot", 7000],
      ["anesthesia", 5000],
      ["bed", 4000],
    ],
    note_bn: "শিশু ও প্রাপ্তবয়স্ক উভয়ের জন্য",
    note_en: "For both children and adults",
  },
];

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function must(res, label) {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

function roleFor(bmdc, idx) {
  if (bmdc === "DEMO-OP-06") return "anesthetist";
  if (idx === 0) return "lead_surgeon";
  return "assistant";
}

async function main() {
  const catalog = await must(
    await sb.from("care_operation_catalog").select("id, code, name_en"),
    "operation catalog",
  );
  if (!catalog?.length) {
    console.error(
      "care_operation_catalog is empty. Apply supabase/migrations/20260828030000_care_operations.sql first.",
    );
    process.exit(1);
  }
  const catalogByCode = Object.fromEntries(catalog.map((c) => [c.code, c]));

  const specs = await must(await sb.from("care_specialties").select("id, slug"), "specialties");
  const specBySlug = Object.fromEntries((specs ?? []).map((s) => [s.slug, s.id]));

  const phones = [...new Set(DEMO_OFFERINGS.map((o) => o.phone))];
  const orgs = await must(
    await sb.from("care_orgs").select("id, name, phone").in("phone", phones),
    "demo orgs",
  );
  if (!orgs?.length) {
    console.error("No demo Care orgs found. Run scripts/seed-care-vendors.mjs first.");
    process.exit(1);
  }
  const orgByPhone = Object.fromEntries(orgs.map((o) => [o.phone, o]));

  const orgIds = orgs.map((o) => o.id);
  await sb.from("care_operation_bookings").delete().like("reference_code", "DEMO-OP-%");
  await sb.from("care_operation_offerings").delete().in("org_id", orgIds);
  await sb.from("care_doctors").delete().like("bmdc_no", "DEMO-OP-%");

  const doctorByBmdc = {};
  for (const s of SURGEONS) {
    const { data, error } = await sb
      .from("care_doctors")
      .insert({
        full_name: s.name,
        full_name_bn: s.name_bn,
        bmdc_no: s.bmdc,
        specialty_id: specBySlug[s.spec] ?? specBySlug.surgery ?? null,
        qualifications: s.qual,
        bio: `${s.name} performs surgery at partner hospitals on the platform.`,
        bio_bn: `${s.name_bn} প্লাটফর্মের পার্টনার হাসপাতালে অপারেশন করেন।`,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`surgeon ${s.bmdc}: ${error.message}`);
    doctorByBmdc[s.bmdc] = data.id;
  }
  console.log(`✓ ${SURGEONS.length} demo surgeons`);

  const locCache = {};
  async function locFor(orgId) {
    if (locCache[orgId]) return locCache[orgId];
    const locs = await must(
      await sb.from("care_locations").select("id").eq("org_id", orgId).order("sort_order"),
      "locations",
    );
    locCache[orgId] = locs?.[0]?.id ?? null;
    return locCache[orgId];
  }

  const seeded = [];
  let n = 0;

  for (const demo of DEMO_OFFERINGS) {
    const org = orgByPhone[demo.phone];
    if (!org) {
      console.warn(`  (skip ${demo.code} — org ${demo.phone} not found)`);
      continue;
    }
    const cat = catalogByCode[demo.code];
    if (!cat) {
      console.warn(`  (skip ${demo.code} — not in catalog)`);
      continue;
    }
    const locId = await locFor(org.id);
    if (!locId) {
      console.warn(`  (skip ${demo.code} @ ${org.name} — no location)`);
      continue;
    }

    const discount =
      demo.original && demo.original > demo.price
        ? Math.round(((demo.original - demo.price) / demo.original) * 100)
        : 0;

    const { data: off, error } = await sb
      .from("care_operation_offerings")
      .insert({
        org_id: org.id,
        location_id: locId,
        catalog_id: cat.id,
        package_price: demo.price,
        price_original: demo.original,
        discount_percent: discount,
        price_note: demo.note_en,
        includes_bn:
          "সার্জন ফি, ওটি চার্জ, অ্যানেস্থেশিয়া ও কেবিন ভাড়া প্যাকেজে অন্তর্ভুক্ত।",
        includes_en: "Surgeon fee, OT charge, anaesthesia and cabin rent are included.",
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`offering ${demo.code} @ ${org.name}: ${error.message}`);

    await must(
      await sb.from("care_operation_price_items").insert(
        demo.items.map(([kind, amount], idx) => ({
          offering_id: off.id,
          kind,
          amount,
          sort_order: idx * 10,
        })),
      ),
      "price items",
    );

    await must(
      await sb.from("care_operation_offering_doctors").insert(
        demo.doctors.map((bmdc, idx) => ({
          offering_id: off.id,
          doctor_id: doctorByBmdc[bmdc],
          role: roleFor(bmdc, idx),
          sort_order: idx * 10,
        })),
      ),
      "offering doctors",
    );

    n += 1;
    seeded.push({ id: off.id, org, locId, catalogId: cat.id, demo, name_en: cat.name_en });
    console.log(
      `✓ [${n}/10] ${cat.name_en} @ ${org.name} — ৳${demo.price.toLocaleString("en-US")}`,
    );
  }

  if (seeded.length < 10) {
    console.warn(`\nOnly ${seeded.length}/10 offerings seeded — check catalog codes & demo orgs.\n`);
  }

  const bookings = [
    {
      offering: seeded[0],
      reference_code: "DEMO-OP-REQ-1",
      invoice_no: "BLO-DEMO-0001",
      status: "requested",
      requested_date: addDays(6),
      scheduled_date: null,
      scheduled_start: null,
      scheduled_end: null,
      guest_name: "Rahim Uddin",
      guest_phone: "01800000001",
      guest_age: "34",
      guest_sex: "M",
      guest_address: "Mirpur-10, Dhaka",
      patient_note: "Pain for two weeks; earliest possible date please.",
      payment_status: "pending",
    },
    {
      offering: seeded[2],
      reference_code: "DEMO-OP-CNF-1",
      invoice_no: "BLO-DEMO-0002",
      status: "confirmed",
      requested_date: addDays(3),
      scheduled_date: addDays(4),
      scheduled_start: "10:00",
      scheduled_end: "12:00",
      admission_date: addDays(3),
      guest_name: "Sabina Yasmin",
      guest_phone: "01800000002",
      guest_age: "29",
      guest_sex: "F",
      guest_address: "Dhanmondi, Dhaka",
      desk_note: "Admission the evening before; bring all reports.",
      payment_status: "pending",
    },
    {
      offering: seeded[4],
      reference_code: "DEMO-OP-PROG-1",
      invoice_no: "BLO-DEMO-0003",
      status: "in_progress",
      requested_date: addDays(-1),
      scheduled_date: addDays(0),
      scheduled_start: "09:00",
      scheduled_end: "11:00",
      admission_date: addDays(-1),
      guest_name: "Karim Mia",
      guest_phone: "01800000003",
      guest_age: "42",
      guest_sex: "M",
      guest_address: "Amberkhana, Sylhet",
      desk_note: "OT started.",
      payment_status: "paid",
      amount_received: seeded[4]?.demo.price ?? null,
    },
    {
      offering: seeded[8],
      reference_code: "DEMO-OP-DONE-1",
      invoice_no: "BLO-DEMO-0004",
      status: "completed",
      requested_date: addDays(-10),
      scheduled_date: addDays(-7),
      scheduled_start: "14:00",
      scheduled_end: "15:00",
      guest_name: "Fatema Begum",
      guest_phone: "01800000004",
      guest_age: "61",
      guest_sex: "F",
      guest_address: "Laxmipur, Rajshahi",
      desk_note: "Uneventful; discharged same day.",
      payment_status: "paid",
      amount_received: seeded[8]?.demo.price ?? null,
    },
  ].filter((b) => b.offering);

  for (const b of bookings) {
    const { offering } = b;
    const { data: booking, error } = await sb
      .from("care_operation_bookings")
      .insert({
        offering_id: offering.id,
        org_id: offering.org.id,
        location_id: offering.locId,
        catalog_id: offering.catalogId,
        guest_name: b.guest_name,
        guest_phone: b.guest_phone,
        guest_age: b.guest_age,
        guest_sex: b.guest_sex,
        guest_address: b.guest_address ?? null,
        source: "desk",
        status: b.status,
        requested_date: b.requested_date,
        scheduled_date: b.scheduled_date,
        scheduled_start: b.scheduled_start,
        scheduled_end: b.scheduled_end,
        admission_date: b.admission_date ?? null,
        price: offering.demo.price,
        price_original: offering.demo.original,
        discount_percent:
          offering.demo.original && offering.demo.original > offering.demo.price
            ? Math.round(
                ((offering.demo.original - offering.demo.price) / offering.demo.original) * 100,
              )
            : 0,
        invoice_no: b.invoice_no,
        reference_code: b.reference_code,
        payment_status: b.payment_status,
        amount_received: b.amount_received ?? null,
        patient_note: b.patient_note ?? null,
        desk_note: b.desk_note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`booking ${b.reference_code}: ${error.message}`);

    await must(
      await sb.from("care_operation_booking_doctors").insert(
        offering.demo.doctors.map((bmdc, idx) => {
          const surgeon = SURGEONS.find((s) => s.bmdc === bmdc);
          return {
            booking_id: booking.id,
            doctor_id: doctorByBmdc[bmdc],
            role: roleFor(bmdc, idx),
            doctor_name_snapshot: surgeon?.name ?? null,
          };
        }),
      ),
      "booking doctors",
    );
    console.log(`✓ booking ${b.reference_code} (${b.status})`);
  }

  console.log(`\nDone. ${seeded.length} offerings + ${bookings.length} bookings.`);
  console.log("Browse: /care?tab=operations");
  console.log("Desk:   /care/portal/desk → Operations / Operation bookings\n");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message || e);
  process.exit(1);
});
