/**
 * Seed 5 complete, verified ambulance vendors with fleet, drivers,
 * pricing, coverage and 24/7 availability.
 *
 * Run: bun --env-file=.env run scripts/seed-ambulance-vendors.mjs
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
  global: { headers: { "User-Agent": "BloodLink-AmbulanceSeed/1.0" } },
});

const AUTH_EMAIL = (phone) => `bd${phone}@bloodlink.app`;
const pinToPassword = (pin) => `bl${pin}xx`;

const VENDORS = [
  {
    phone: "01766666666",
    pin: "6666",
    owner: "Md. Rahim Uddin",
    name: "LifeLine Ambulance Dhaka",
    name_bn: "লাইফলাইন অ্যাম্বুলেন্স ঢাকা",
    email: "lifeline.dhaka@demo.bloodlink.app",
    district: "Dhaka",
    upazila: "Dhanmondi",
    address: "House 42, Road 27, Dhanmondi, Dhaka-1209",
    description: "24/7 emergency and ICU ambulance across Dhaka. Neonatal and freezer vans available.",
    description_bn: "ঢাকায় ২৪/৭ জরুরি ও আইসিইউ অ্যাম্বুলেন্স। নিওনেটাল ও ফ্রিজার ভ্যান আছে।",
    featured: true,
    offerings: {
      basic: { base: 800, perKm: 35, min: 500, discount: 10 },
      icu: { base: 2500, perKm: 80, min: 2000, discount: 15 },
      freezer: { base: 1800, perKm: 50, min: 1500, discount: 12 },
      neonatal: { base: 3200, perKm: 90, min: 2800, discount: 18 },
    },
    coverage: [
      { district: "Dhaka", upazilas: ["Dhanmondi", "Mirpur", "Gulshan", "Motijheel", "Uttara"], radius: 40 },
    ],
    vehicles: [
      { plate: "DHAKA-MET-11-1234", type: "basic", label: "Basic-1", status: "available", equipment: ["oxygen", "stretcher"] },
      { plate: "DHAKA-MET-11-5678", type: "icu", label: "ICU-1", status: "available", equipment: ["oxygen", "ventilator", "monitor", "stretcher"] },
      { plate: "DHAKA-MET-12-9012", type: "neonatal", label: "Neo-1", status: "available", equipment: ["oxygen", "monitor"] },
      { plate: "DHAKA-MET-13-3456", type: "freezer", label: "Freezer-1", status: "offline", equipment: ["stretcher"] },
    ],
    drivers: [
      { name: "Karim Ahmed", phone: "01866666661", license: "DH-DRV-6601" },
      { name: "Shahin Mia", phone: "01866666662", license: "DH-DRV-6602" },
      { name: "Rafiqul Islam", phone: "01866666663", license: "DH-DRV-6603" },
      { name: "Jamal Uddin", phone: "01866666664", license: "DH-DRV-6604" },
    ],
  },
  {
    phone: "01777777777",
    pin: "7777",
    owner: "Abdul Jabbar",
    name: "SafeRide Ambulance Chattogram",
    name_bn: "সেফরাইড অ্যাম্বুলেন্স চট্টগ্রাম",
    email: "saferide.ctg@demo.bloodlink.app",
    district: "Chattogram",
    upazila: "Kotwali",
    address: "Sheikh Mujib Road, Agrabad C/A, Chattogram",
    description: "Port city emergency dispatch with ICU support. Covers Agrabad, Panchlaish and Halishahar.",
    description_bn: "বন্দর শহরের জরুরি ডিসপ্যাচ ও আইসিইউ। আগ্রাবাদ, পাঁচলাইশ ও হালিশহর কভার।",
    featured: true,
    offerings: {
      basic: { base: 700, perKm: 30, min: 450, discount: 10 },
      icu: { base: 2200, perKm: 70, min: 1800, discount: 15 },
      freezer: { base: 1600, perKm: 45, min: 1300, discount: 12 },
    },
    coverage: [
      { district: "Chattogram", upazilas: ["Kotwali", "Panchlaish", "Halishahar", "Double Mooring"], radius: 35 },
    ],
    vehicles: [
      { plate: "CTG-MET-22-1001", type: "basic", label: "Basic-A", status: "available", equipment: ["oxygen", "stretcher"] },
      { plate: "CTG-MET-22-1002", type: "icu", label: "ICU-A", status: "available", equipment: ["oxygen", "ventilator", "monitor"] },
      { plate: "CTG-MET-22-1003", type: "freezer", label: "Freezer-A", status: "busy", equipment: ["stretcher"] },
    ],
    drivers: [
      { name: "Hasan Ali", phone: "01877777771", license: "CTG-DRV-7701" },
      { name: "Nurul Amin", phone: "01877777772", license: "CTG-DRV-7702" },
      { name: "Sohag Chowdhury", phone: "01877777773", license: "CTG-DRV-7703" },
    ],
  },
  {
    phone: "01788888888",
    pin: "8888",
    owner: "Farida Begum",
    name: "Padma Rescue Ambulance Rajshahi",
    name_bn: "পদ্মা রেসকিউ অ্যাম্বুলেন্স রাজশাহী",
    email: "padma.raj@demo.bloodlink.app",
    district: "Rajshahi",
    upazila: "Boalia",
    address: "Greater Road, Laxmipur, Rajshahi",
    description: "Regional ambulance for Rajshahi city and nearby upazilas. Basic and ICU fleet.",
    description_bn: "রাজশাহী শহর ও আশপাশের উপজেলার আঞ্চলিক অ্যাম্বুলেন্স। বেসিক ও আইসিইউ ফ্লিট।",
    featured: false,
    offerings: {
      basic: { base: 600, perKm: 28, min: 400, discount: 8 },
      icu: { base: 1800, perKm: 60, min: 1500, discount: 12 },
    },
    coverage: [
      { district: "Rajshahi", upazilas: ["Boalia", "Rajpara", "Paba", "Puthia"], radius: 45 },
    ],
    vehicles: [
      { plate: "RAJ-GA-11-4401", type: "basic", label: "Padma-1", status: "available", equipment: ["oxygen", "stretcher"] },
      { plate: "RAJ-GA-11-4402", type: "icu", label: "Padma-ICU", status: "available", equipment: ["oxygen", "ventilator", "monitor", "stretcher"] },
      { plate: "RAJ-GA-11-4403", type: "basic", label: "Padma-2", status: "offline", equipment: ["stretcher"] },
    ],
    drivers: [
      { name: "Mizanur Rahman", phone: "01888888881", license: "RAJ-DRV-8801" },
      { name: "Abul Kalam", phone: "01888888882", license: "RAJ-DRV-8802" },
      { name: "Shafiqul Haque", phone: "01888888883", license: "RAJ-DRV-8803" },
    ],
  },
  {
    phone: "01799999999",
    pin: "9999",
    owner: "Eng. Tariqul Hasan",
    name: "TeaCity Ambulance Sylhet",
    name_bn: "টিসিটি অ্যাম্বুলেন্স সিলেট",
    email: "teacity.syl@demo.bloodlink.app",
    district: "Sylhet",
    upazila: "Sylhet Sadar",
    address: "Zindabazar, Amberkhana, Sylhet",
    description: "Hill-district emergency runs plus neonatal transfer to Dhaka. 24/7 dispatcher.",
    description_bn: "পাহাড়ি জেলার জরুরি রান ও ঢাকায় নিওনেটাল ট্রান্সফার। ২৪/৭ ডিসপ্যাচার।",
    featured: true,
    offerings: {
      basic: { base: 750, perKm: 32, min: 500, discount: 10 },
      icu: { base: 2400, perKm: 75, min: 2000, discount: 15 },
      neonatal: { base: 3500, perKm: 95, min: 3000, discount: 18 },
    },
    coverage: [
      { district: "Sylhet", upazilas: ["Sylhet Sadar", "South Surma", "Bishwanath"], radius: 50 },
    ],
    vehicles: [
      { plate: "SYL-KHA-18-2101", type: "basic", label: "Tea-1", status: "available", equipment: ["oxygen", "stretcher"] },
      { plate: "SYL-KHA-18-2102", type: "icu", label: "Tea-ICU", status: "available", equipment: ["oxygen", "ventilator", "monitor"] },
      { plate: "SYL-KHA-18-2103", type: "neonatal", label: "Tea-Neo", status: "available", equipment: ["oxygen", "monitor"] },
    ],
    drivers: [
      { name: "Jalal Ahmed", phone: "01899999991", license: "SYL-DRV-9901" },
      { name: "Masud Rana", phone: "01899999992", license: "SYL-DRV-9902" },
      { name: "Kamrul Hasan", phone: "01899999993", license: "SYL-DRV-9903" },
    ],
  },
  {
    phone: "01611111111",
    pin: "1611",
    owner: "Nasrin Akter",
    name: "Sundarban Ambulance Khulna",
    name_bn: "সুন্দরবন অ্যাম্বুলেন্স খুলনা",
    email: "sundarban.kln@demo.bloodlink.app",
    district: "Khulna",
    upazila: "Khulna Sadar",
    address: "KDA Avenue, Shibbari Mor, Khulna",
    description: "Khulna metro and coastal transfer. Basic, ICU and freezer vans.",
    description_bn: "খুলনা মেট্রো ও উপকূলীয় ট্রান্সফার। বেসিক, আইসিইউ ও ফ্রিজার ভ্যান।",
    featured: false,
    offerings: {
      basic: { base: 650, perKm: 28, min: 400, discount: 10 },
      icu: { base: 2000, perKm: 65, min: 1600, discount: 14 },
      freezer: { base: 1500, perKm: 42, min: 1200, discount: 12 },
    },
    coverage: [
      { district: "Khulna", upazilas: ["Khulna Sadar", "Khalishpur", "Daulatpur", "Sonadanga"], radius: 40 },
    ],
    vehicles: [
      { plate: "KHL-GA-15-3301", type: "basic", label: "Sundor-1", status: "available", equipment: ["oxygen", "stretcher"] },
      { plate: "KHL-GA-15-3302", type: "icu", label: "Sundor-ICU", status: "available", equipment: ["oxygen", "ventilator", "monitor", "stretcher"] },
      { plate: "KHL-GA-15-3303", type: "freezer", label: "Sundor-FZ", status: "available", equipment: ["stretcher"] },
    ],
    drivers: [
      { name: "Liton Sheikh", phone: "01611111112", license: "KHL-DRV-1612" },
      { name: "Babul Hossain", phone: "01611111113", license: "KHL-DRV-1613" },
      { name: "Ripon Mondol", phone: "01611111114", license: "KHL-DRV-1614" },
    ],
  },
];

async function must(res, label) {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

async function findUserIdByEmail(email) {
  for (let page = 1; page <= 8; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (!data.users.length || data.users.length < 200) break;
  }
  return null;
}

async function ensureUser({ phone, pin, owner }) {
  const email = AUTH_EMAIL(phone);
  const password = pinToPassword(pin);
  let userId = await findUserIdByEmail(email);
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: owner, phone, pin },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        userId = await findUserIdByEmail(email);
      } else {
        throw new Error(`createUser ${phone}: ${error.message}`);
      }
    } else {
      userId = data.user?.id ?? null;
    }
  } else {
    await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: owner, phone, pin },
    });
  }
  if (!userId) throw new Error(`No user id for ${phone}`);

  const profile = { id: userId, full_name: owner, phone, account_kind: "care_vendor" };
  const up = await sb.from("profiles").upsert(profile);
  if (up.error && /account_kind/i.test(up.error.message)) {
    const { error } = await sb.from("profiles").upsert({ id: userId, full_name: owner, phone });
    if (error) throw new Error(`profiles: ${error.message}`);
    console.warn("  (profiles.account_kind missing — apply care vendor migrations)");
  } else if (up.error) {
    throw new Error(`profiles: ${up.error.message}`);
  }

  await must(
    await sb.from("user_login_credentials").upsert({ user_id: userId, phone, pin }, { onConflict: "user_id" }),
    "credentials",
  );
  return userId;
}

async function districtId(nameEn) {
  const { data, error } = await sb.from("districts").select("id, name_en").ilike("name_en", nameEn).limit(8);
  if (error) throw new Error(`districts: ${error.message}`);
  const exact = (data ?? []).find((d) => String(d.name_en).toLowerCase() === nameEn.toLowerCase());
  return exact?.id ?? data?.[0]?.id ?? null;
}

async function main() {
  const { data: kind, error: kindErr } = await sb.from("care_vendor_types").select("id").eq("slug", "ambulance").maybeSingle();
  if (kindErr) throw new Error(kindErr.message);
  if (!kind?.id) {
    console.error("care_vendor_types.ambulance missing. Apply supabase/migrations/20260817500000_ambulance_platform.sql first.");
    process.exit(1);
  }

  const serviceTypes = await must(await sb.from("ambulance_service_types").select("id, slug"), "service types");
  const typeBySlug = Object.fromEntries((serviceTypes ?? []).map((t) => [t.slug, t.id]));

  const equipment = await must(await sb.from("ambulance_equipment_options").select("id, slug"), "equipment");
  const eqBySlug = Object.fromEntries((equipment ?? []).map((e) => [e.slug, e.id]));

  const phones = VENDORS.map((v) => v.phone);
  const { data: oldOrgs } = await sb.from("care_orgs").select("id, name").in("phone", phones);
  if (oldOrgs?.length) {
    await sb.from("care_orgs").delete().in("id", oldOrgs.map((o) => o.id));
    console.log(`Removed ${oldOrgs.length} previous demo ambulance org(s)`);
  }

  console.log("\nSeeding 5 ambulance vendors…\n");

  for (const v of VENDORS) {
    const userId = await ensureUser(v);
    const did = await districtId(v.district);

    const orgRow = {
      org_kind_id: kind.id,
      name: v.name,
      name_bn: v.name_bn,
      phone: v.phone,
      email: v.email,
      website: "https://bloodlink.app/ambulance",
      description: v.description,
      description_bn: v.description_bn,
      district_id: did,
      upazila: v.upazila,
      address: v.address,
      is_active: true,
      is_verified: true,
      is_listed: true,
      kyc_status: "verified",
      kyc_notes: "Demo seed — auto-approved",
      featured: !!v.featured,
      profile_completed: true,
      profile_submitted_at: new Date().toISOString(),
    };

    let ins = await sb.from("care_orgs").insert(orgRow).select("id").single();
    if (ins.error && /profile_completed|profile_submitted/i.test(ins.error.message)) {
      delete orgRow.profile_completed;
      delete orgRow.profile_submitted_at;
      ins = await sb.from("care_orgs").insert(orgRow).select("id").single();
    }
    if (ins.error) throw new Error(`care_orgs ${v.name}: ${ins.error.message}`);
    const orgId = ins.data.id;

    await sb.rpc("ensure_care_default_roles", { _org_id: orgId });
    const { data: ownerRole } = await sb
      .from("care_org_roles")
      .select("id")
      .eq("org_id", orgId)
      .eq("slug", "owner")
      .maybeSingle();

    await must(
      await sb.from("care_org_members").insert({
        org_id: orgId,
        user_id: userId,
        role: "owner",
        role_id: ownerRole?.id ?? null,
      }),
      "member",
    );

    await must(
      await sb.from("care_locations").insert({
        org_id: orgId,
        name: `${v.district} garage`,
        name_bn: `${v.name_bn} গ্যারেজ`,
        district_id: did,
        upazila: v.upazila,
        address: v.address,
        phone: v.phone,
        is_active: true,
        sort_order: 0,
      }),
      "location",
    );

    for (const [slug, price] of Object.entries(v.offerings)) {
      const typeId = typeBySlug[slug];
      if (!typeId) continue;
      const disc = Number(price.discount) || 0;
      await must(
        await sb.from("ambulance_service_offerings").upsert(
          {
            org_id: orgId,
            service_type_id: typeId,
            base_price: price.base,
            per_km_price: price.perKm,
            min_fare: price.min,
            discount_percent: disc,
            home_pickup: true,
            is_active: true,
          },
          { onConflict: "org_id,service_type_id" },
        ),
        `offering ${slug}`,
      );
    }

    for (const cov of v.coverage) {
      const covDid = (await districtId(cov.district)) ?? did;
      await must(
        await sb.from("ambulance_coverage_areas").insert({
          org_id: orgId,
          district_id: covDid,
          upazilas: cov.upazilas,
          radius_km: cov.radius,
          is_active: true,
        }),
        "coverage",
      );
    }

    await must(
      await sb.from("ambulance_availability_rules").insert({
        org_id: orgId,
        is_24_7: true,
        weekly_hours: {},
        holiday_overrides: [],
      }),
      "availability",
    );

    const driverIds = [];
    for (const d of v.drivers) {
      const { data, error } = await sb
        .from("ambulance_drivers")
        .insert({
          org_id: orgId,
          full_name: d.name,
          phone: d.phone,
          license_no: d.license,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw new Error(`driver: ${error.message}`);
      driverIds.push(data.id);
    }

    const vehicleIds = [];
    for (const veh of v.vehicles) {
      const eqIds = (veh.equipment ?? []).map((s) => eqBySlug[s]).filter(Boolean);
      const { data, error } = await sb
        .from("ambulance_vehicles")
        .insert({
          org_id: orgId,
          service_type_id: typeBySlug[veh.type] ?? null,
          plate_no: veh.plate,
          label: veh.label,
          equipment_ids: eqIds,
          capacity: veh.type === "neonatal" ? 1 : 2,
          gps_phone: v.phone,
          status: veh.status,
          is_active: veh.status !== "offline",
        })
        .select("id")
        .single();
      if (error) throw new Error(`vehicle ${veh.plate}: ${error.message}`);
      vehicleIds.push(data.id);
    }

    const pairCount = Math.min(vehicleIds.length, driverIds.length);
    for (let i = 0; i < pairCount; i++) {
      await must(
        await sb.from("ambulance_vehicle_assignments").insert({
          org_id: orgId,
          vehicle_id: vehicleIds[i],
          driver_id: driverIds[i],
          is_primary: true,
        }),
        "assignment",
      );
    }

    console.log(
      `✓ ${v.name}\n    phone ${v.phone}  PIN ${v.pin}\n    ${v.vehicles.length} vehicles · ${v.drivers.length} drivers · ${Object.keys(v.offerings).join(", ")}`,
    );

    // Demo active board for LifeLine Dhaka (first featured vendor)
    if (v.phone === "01766666666" && typeBySlug.basic) {
      const demos = [
        {
          guest_name: "Fatema Begum",
          guest_phone: "01911112222",
          pickup_address: "House 12, Road 27, Dhanmondi",
          dropoff_address: "Square Hospital, Panthapath",
          distance_km: 6,
          service_type_id: typeBySlug.basic,
          mode: "emergency",
          status: "requested",
          patient_condition: "Chest pain — oxygen ready",
        },
        {
          guest_name: "Karim Hossain",
          guest_phone: "01822223333",
          pickup_address: "Gulshan 2, Road 55",
          dropoff_address: "United Hospital",
          distance_km: 4,
          service_type_id: typeBySlug.icu || typeBySlug.basic,
          mode: "emergency",
          status: "accepted",
          patient_condition: "ICU transfer",
        },
        {
          guest_name: "Nusrat Jahan",
          guest_phone: "01733334444",
          pickup_address: "Mirpur 10 Bus Stand",
          dropoff_address: "National Heart Foundation",
          distance_km: 11,
          service_type_id: typeBySlug.basic,
          mode: "scheduled",
          status: "dispatched",
          patient_condition: "Dialysis appointment",
        },
      ];

      for (const d of demos) {
        let list = null;
        let sale = null;
        let disc = 0;
        const { data: br } = await sb.rpc("ambulance_fare_breakdown", {
          _org_id: orgId,
          _service_type_id: d.service_type_id,
          _distance_km: d.distance_km,
        });
        if (br && typeof br === "object") {
          list = Number(br.list_fare);
          sale = Number(br.sale_fare);
          disc = Number(br.discount_percent) || 0;
        }
        const { error: reqErr } = await sb.from("ambulance_requests").insert({
          org_id: orgId,
          guest_name: d.guest_name,
          guest_phone: d.guest_phone,
          mode: d.mode,
          service_type_id: d.service_type_id,
          status: d.status,
          source: "phone",
          pickup_address: d.pickup_address,
          dropoff_address: d.dropoff_address,
          patient_condition: d.patient_condition,
          distance_km: d.distance_km,
          estimated_fare: sale,
          fare_original: disc > 0 ? list : null,
          discount_percent: disc > 0 ? disc : null,
          payment_status: "pending",
          invoice_no: `BLA-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        });
        if (reqErr && !/duplicate|already/i.test(reqErr.message)) {
          console.warn(`  demo request skip: ${reqErr.message}`);
        }
      }
      console.log("    + demo dispatch board (3 sample trips)");
    }
  }

  console.log("\nLogin: /care/auth  →  /care/portal/ambulance\n");
  for (const v of VENDORS) {
    console.log(`  ${v.phone}  /  ${v.pin}  —  ${v.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
