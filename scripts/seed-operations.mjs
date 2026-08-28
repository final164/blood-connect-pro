/**
 * Seed demo operation offerings, surgeon teams, price breakdowns and bookings
 * on top of the demo Care vendors.
 *
 * Depends on scripts/seed-care-vendors.mjs having been run first — it needs the
 * demo orgs (matched by phone) and their locations.
 *
 * Run: bun --env-file=.env run scripts/seed-operations.mjs
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

/** Surgeons deliberately shared across clinics so the doctor filter has data. */
const SURGEONS = [
  { bmdc: "DEMO-OP-01", name: "Prof. Dr. Mizanur Rahman", name_bn: "প্রফেসর ডাঃ মিজানুর রহমান", spec: "surgery", qual: "MBBS, FCPS (Surgery)" },
  { bmdc: "DEMO-OP-02", name: "Dr. Shirin Sultana", name_bn: "ডাঃ শিরিন সুলতানা", spec: "gynecology", qual: "MBBS, FCPS (Gynae & Obs)" },
  { bmdc: "DEMO-OP-03", name: "Dr. Habibur Rahman", name_bn: "ডাঃ হাবিবুর রহমান", spec: "orthopedics", qual: "MBBS, MS (Ortho)" },
  { bmdc: "DEMO-OP-04", name: "Dr. Nusrat Jahan", name_bn: "ডাঃ নুসরাত জাহান", spec: "ophthalmology", qual: "MBBS, DO, FCPS (Eye)" },
  { bmdc: "DEMO-OP-05", name: "Dr. Asaduzzaman Khan", name_bn: "ডাঃ আসাদুজ্জামান খান", spec: "urology", qual: "MBBS, MS (Urology)" },
  { bmdc: "DEMO-OP-06", name: "Dr. Rokeya Begum", name_bn: "ডাঃ রোকেয়া বেগম", spec: "anesthesiology", qual: "MBBS, DA" },
];

/**
 * Same operation at different clinics with different prices, so the patient-side
 * comparison is meaningful straight after seeding.
 */
const CLINICS = [
  {
    phone: "01733333333",
    operations: [
      { code: "OP-APPEN", price: 38000, original: 45000, doctors: ["DEMO-OP-01", "DEMO-OP-06"], items: [["surgeon", 18000], ["ot", 9000], ["anesthesia", 6000], ["bed", 5000]] },
      { code: "OP-GALL", price: 62000, original: 72000, doctors: ["DEMO-OP-01", "DEMO-OP-06"], items: [["surgeon", 30000], ["ot", 14000], ["anesthesia", 9000], ["bed", 9000]] },
      { code: "OP-CS", price: 55000, original: null, doctors: ["DEMO-OP-02", "DEMO-OP-06"], items: [["surgeon", 25000], ["ot", 12000], ["anesthesia", 8000], ["bed", 10000]] },
      { code: "OP-CATARACT", price: 26000, original: 32000, doctors: ["DEMO-OP-04"], items: [["surgeon", 14000], ["ot", 7000], ["investigation", 5000]] },
    ],
  },
  {
    phone: "01755555555",
    operations: [
      { code: "OP-APPEN", price: 32000, original: null, doctors: ["DEMO-OP-01"], items: [["surgeon", 15000], ["ot", 8000], ["anesthesia", 5000], ["bed", 4000]] },
      { code: "OP-CS", price: 48000, original: 58000, doctors: ["DEMO-OP-02", "DEMO-OP-06"], items: [["surgeon", 22000], ["ot", 10000], ["anesthesia", 7000], ["bed", 9000]] },
      { code: "OP-FRACT", price: 72000, original: null, doctors: ["DEMO-OP-03", "DEMO-OP-06"], items: [["surgeon", 32000], ["ot", 16000], ["anesthesia", 9000], ["bed", 15000]] },
      { code: "OP-KIDSTONE", price: 85000, original: 95000, doctors: ["DEMO-OP-05", "DEMO-OP-06"], items: [["surgeon", 40000], ["ot", 20000], ["anesthesia", 10000], ["bed", 15000]] },
    ],
  },
  {
    phone: "01744444444",
    operations: [
      { code: "OP-CATARACT", price: 19000, original: 24000, doctors: ["DEMO-OP-04"], items: [["surgeon", 11000], ["ot", 5000], ["investigation", 3000]] },
      { code: "OP-HYDRO", price: 24000, original: null, doctors: ["DEMO-OP-05"], items: [["surgeon", 12000], ["ot", 7000], ["anesthesia", 5000]] },
      { code: "OP-FRACT", price: 61000, original: 70000, doctors: ["DEMO-OP-03"], items: [["surgeon", 27000], ["ot", 14000], ["anesthesia", 8000], ["bed", 12000]] },
    ],
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

async function main() {
  const catalog = await must(
    await sb.from("care_operation_catalog").select("id, code"),
    "operation catalog",
  );
  if (!catalog?.length) {
    console.error(
      "care_operation_catalog is empty. Apply supabase/migrations/20260828030000_care_operations.sql first.",
    );
    process.exit(1);
  }
  const catalogByCode = Object.fromEntries(catalog.map((c) => [c.code, c.id]));

  const specs = await must(await sb.from("care_specialties").select("id, slug"), "specialties");
  const specBySlug = Object.fromEntries((specs ?? []).map((s) => [s.slug, s.id]));

  const phones = CLINICS.map((c) => c.phone);
  const orgs = await must(
    await sb.from("care_orgs").select("id, name, phone").in("phone", phones),
    "demo orgs",
  );
  if (!orgs?.length) {
    console.error("No demo Care orgs found. Run scripts/seed-care-vendors.mjs first.");
    process.exit(1);
  }
  const orgByPhone = Object.fromEntries(orgs.map((o) => [o.phone, o]));

  // Re-seedable: drop the previous demo surgeons and their offerings.
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

  const seededOfferings = [];

  for (const clinic of CLINICS) {
    const org = orgByPhone[clinic.phone];
    if (!org) {
      console.warn(`  (skipping ${clinic.phone} — demo org not found)`);
      continue;
    }
    const locs = await must(
      await sb.from("care_locations").select("id").eq("org_id", org.id).order("sort_order"),
      "locations",
    );
    const locId = locs?.[0]?.id;
    if (!locId) {
      console.warn(`  (skipping ${org.name} — no location)`);
      continue;
    }

    for (const op of clinic.operations) {
      const catalogId = catalogByCode[op.code];
      if (!catalogId) {
        console.warn(`  (skipping ${op.code} — not in catalog)`);
        continue;
      }
      const discount =
        op.original && op.original > op.price
          ? Math.round(((op.original - op.price) / op.original) * 100)
          : 0;

      const { data: off, error } = await sb
        .from("care_operation_offerings")
        .insert({
          org_id: org.id,
          location_id: locId,
          catalog_id: catalogId,
          package_price: op.price,
          price_original: op.original,
          discount_percent: discount,
          price_note: "Medicine and post-op investigations billed separately",
          includes_bn: "সার্জন ফি, ওটি চার্জ, অ্যানেস্থেশিয়া ও কেবিন ভাড়া প্যাকেজে অন্তর্ভুক্ত।",
          includes_en: "Surgeon fee, OT charge, anaesthesia and cabin rent are included.",
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw new Error(`offering ${op.code} @ ${org.name}: ${error.message}`);

      await must(
        await sb.from("care_operation_price_items").insert(
          op.items.map(([kind, amount], idx) => ({
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
          op.doctors.map((bmdc, idx) => ({
            offering_id: off.id,
            doctor_id: doctorByBmdc[bmdc],
            role: idx === 0 ? "lead_surgeon" : bmdc === "DEMO-OP-06" ? "anesthetist" : "assistant",
            sort_order: idx * 10,
          })),
        ),
        "offering doctors",
      );

      seededOfferings.push({ id: off.id, org, locId, catalogId, op });
    }
    console.log(`✓ ${org.name} — ${clinic.operations.length} operations`);
  }

  // Two demo bookings: one awaiting a date, one already confirmed with a window.
  const bookings = [
    {
      offering: seededOfferings[0],
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
      patient_note: "Pain for the last two weeks; needs the earliest possible date.",
    },
    {
      offering: seededOfferings[2] ?? seededOfferings[1],
      reference_code: "DEMO-OP-CNF-1",
      invoice_no: "BLO-DEMO-0002",
      status: "confirmed",
      requested_date: addDays(3),
      scheduled_date: addDays(4),
      scheduled_start: "10:00",
      scheduled_end: "12:00",
      guest_name: "Sabina Yasmin",
      guest_phone: "01800000002",
      guest_age: "29",
      guest_sex: "F",
      patient_note: null,
      admission_date: addDays(3),
      desk_note: "Admission the evening before; bring all reports.",
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
        source: "desk",
        status: b.status,
        requested_date: b.requested_date,
        scheduled_date: b.scheduled_date,
        scheduled_start: b.scheduled_start,
        scheduled_end: b.scheduled_end,
        admission_date: b.admission_date ?? null,
        price: offering.op.price,
        price_original: offering.op.original,
        discount_percent:
          offering.op.original && offering.op.original > offering.op.price
            ? Math.round(((offering.op.original - offering.op.price) / offering.op.original) * 100)
            : 0,
        invoice_no: b.invoice_no,
        reference_code: b.reference_code,
        payment_status: "pending",
        patient_note: b.patient_note,
        desk_note: b.desk_note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`booking ${b.reference_code}: ${error.message}`);

    await must(
      await sb.from("care_operation_booking_doctors").insert(
        offering.op.doctors.map((bmdc, idx) => {
          const surgeon = SURGEONS.find((s) => s.bmdc === bmdc);
          return {
            booking_id: booking.id,
            doctor_id: doctorByBmdc[bmdc],
            role: idx === 0 ? "lead_surgeon" : bmdc === "DEMO-OP-06" ? "anesthetist" : "assistant",
            doctor_name_snapshot: surgeon?.name ?? null,
          };
        }),
      ),
      "booking doctors",
    );
    console.log(`✓ booking ${b.reference_code} (${b.status})`);
  }

  console.log(
    `\nDone. ${seededOfferings.length} offerings seeded. Browse them at /care?tab=operations\n`,
  );
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message || e);
  process.exit(1);
});
