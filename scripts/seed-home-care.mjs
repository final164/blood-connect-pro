/**
 * Seed Home Doctor profiles + home_collection lab offerings; enable platform flags.
 * Run: bun --env-file=.env run scripts/seed-home-care.mjs
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

const HOME_DOCTORS = [
  {
    bmdc_no: "TELE-DEMO-001",
    fee: 800,
    visit_minutes: 30,
    about_bn: "বাড়িতে সাধারণ মেডিসিন ও ফলো-আপ ভিজিট।",
    about_en: "Home visits for general medicine and follow-up.",
    districts: ["dhaka", "gazipur"],
  },
  {
    bmdc_no: "TELE-DEMO-002",
    fee: 1200,
    visit_minutes: 40,
    about_bn: "হৃদরোগ রোগীর হোম চেকআপ ও প্রেসক্রিপশন রিভিউ।",
    about_en: "Home check-ups and prescription review for cardiac patients.",
    districts: ["dhaka"],
  },
  {
    bmdc_no: "TELE-DEMO-003",
    fee: 1000,
    visit_minutes: 35,
    about_bn: "নারী স্বাস্থ্য বিষয়ে হোম কনসালটেশন।",
    about_en: "Home consultation for women's health.",
    districts: ["dhaka", "narayanganj"],
  },
];

const HOME_SLOTS = [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, start_time: "09:00:00", end_time: "12:00:00" },
  { weekday, start_time: "16:00:00", end_time: "20:00:00" },
]);

async function must(res, label) {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

async function districtIdBySlug(slug) {
  const { data } = await sb
    .from("districts")
    .select("id, slug")
    .ilike("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

async function main() {
  console.log("Enabling home_doctor + home_diagnostic flags…");
  const { data: settings } = await sb
    .from("app_settings")
    .select("care_feature_flags")
    .eq("id", 1)
    .maybeSingle();
  const flags = {
    ...((settings?.care_feature_flags && typeof settings.care_feature_flags === "object"
      ? settings.care_feature_flags
      : {})),
    home_doctor: true,
    home_diagnostic: true,
    home_collection: true,
  };
  await must(
    await sb
      .from("app_settings")
      .update({ care_feature_flags: flags })
      .eq("id", 1),
    "flags",
  );

  await must(
    await sb.from("care_hub_modules").upsert(
      [
        {
          slug: "home_doctor",
          label_bn: "হোম ডাক্তার",
          label_en: "Home Doctor",
          icon: "HousePlus",
          href: "/care/home-doctor",
          audience: "patient",
          is_enabled: true,
          sort_order: 18,
        },
        {
          slug: "home_diagnostic",
          label_bn: "হোম ডায়াগনস্টিক",
          label_en: "Home Diagnostic",
          icon: "Home",
          href: "/care/home-diagnostic",
          audience: "patient",
          is_enabled: true,
          sort_order: 19,
        },
      ],
      { onConflict: "slug" },
    ),
    "hub modules",
  );

  for (const d of HOME_DOCTORS) {
    const { data: doc } = await sb
      .from("care_doctors")
      .select("id, full_name")
      .eq("bmdc_no", d.bmdc_no)
      .maybeSingle();
    if (!doc?.id) {
      console.warn(`Skip ${d.bmdc_no}: doctor not found (run seed:tele-doctors first)`);
      continue;
    }

    await must(
      await sb.from("care_home_doctor_profiles").upsert({
        doctor_id: doc.id,
        is_active: true,
        is_online: true,
        fee_amount: d.fee,
        about_bn: d.about_bn,
        about_en: d.about_en,
        visit_minutes: d.visit_minutes,
        updated_at: new Date().toISOString(),
      }),
      `profile ${d.bmdc_no}`,
    );

    await sb.from("care_home_doctor_areas").delete().eq("doctor_id", doc.id);
    for (const slug of d.districts) {
      const distId = await districtIdBySlug(slug);
      if (!distId) {
        console.warn(`District slug missing: ${slug}`);
        continue;
      }
      await must(
        await sb.from("care_home_doctor_areas").insert({
          doctor_id: doc.id,
          district_id: distId,
          upazila: null,
        }),
        `area ${slug}`,
      );
    }

    await sb.from("care_home_doctor_slots").delete().eq("doctor_id", doc.id);
    await must(
      await sb.from("care_home_doctor_slots").insert(
        HOME_SLOTS.map((s) => ({ ...s, doctor_id: doc.id, is_active: true })),
      ),
      `slots ${d.bmdc_no}`,
    );
    console.log(`Home doctor ready: ${doc.full_name} (${d.bmdc_no})`);
  }

  console.log("Marking sample lab offerings as home_collection…");
  const { data: offs } = await sb
    .from("care_test_offerings")
    .select("id, org_id, home_collection")
    .eq("is_active", true)
    .limit(40);
  const byOrg = new Map();
  for (const o of offs ?? []) {
    const list = byOrg.get(o.org_id) ?? [];
    if (list.length < 2) list.push(o);
    byOrg.set(o.org_id, list);
  }
  let marked = 0;
  for (const list of byOrg.values()) {
    for (const o of list) {
      if (o.home_collection) continue;
      const { error } = await sb
        .from("care_test_offerings")
        .update({ home_collection: true })
        .eq("id", o.id);
      if (!error) marked += 1;
    }
  }
  console.log(`Marked ${marked} offerings home_collection`);
  console.log("Done. Flags enabled — browse /care/home-doctor and /care/home-diagnostic");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
