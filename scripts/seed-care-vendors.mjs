/**
 * Seed 5 complete, verified Care vendors (chamber / lab / mixed)
 * plus doctors, schedules, lab offerings & calendars.
 *
 * Run: bun --env-file=.env run scripts/seed-care-vendors.mjs
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
  global: { headers: { "User-Agent": "BloodLink-CareSeed/1.0" } },
});

const AUTH_EMAIL = (phone) => `bd${phone}@bloodlink.app`;
const pinToPassword = (pin) => `bl${pin}xx`;

const VENDORS = [
  {
    phone: "01711111111",
    pin: "1111",
    owner: "Dr. Ayesha Rahman",
    kind: "chamber",
    name: "Green Life Chamber",
    name_bn: "গ্রিন লাইফ চেম্বার",
    email: "greenlife.chamber@demo.bloodlink.app",
    district: "Dhaka",
    upazila: "Dhanmondi",
    address: "House 12, Road 7, Dhanmondi, Dhaka-1205",
    description:
      "Evening consultant chamber with medicine, cardiology and gynecology. Walk-in and app serials.",
    description_bn: "সন্ধ্যায় মেডিসিন, কার্ডিও ও গাইনি চেম্বার। অ্যাপ ও ওয়াক-ইন সিরিয়াল।",
    featured: true,
    locations: [
      { name: "Dhanmondi Chamber", name_bn: "ধানমন্ডি চেম্বার", upazila: "Dhanmondi", address: "House 12, Road 7, Dhanmondi" },
      { name: "Mirpur Branch", name_bn: "মিরপুর শাখা", upazila: "Mirpur", address: "Plot 5, Section 10, Mirpur" },
    ],
    doctors: [
      { name: "Prof. Dr. Ayesha Rahman", name_bn: "প্রফেসর ডাঃ আয়েশা রহমান", spec: "medicine", fee: 800, bmdc: "DEMO-GL-01", days: [0, 1, 2, 3, 4, 6], start: "18:00", end: "21:00", loc: 0 },
      { name: "Dr. Kamal Hossain", name_bn: "ডাঃ কামাল হোসেন", spec: "cardiology", fee: 1200, bmdc: "DEMO-GL-02", days: [1, 3, 6], start: "17:30", end: "20:30", loc: 0 },
      { name: "Dr. Farhana Akter", name_bn: "ডাঃ ফারহানা আক্তার", spec: "gynecology", fee: 1000, bmdc: "DEMO-GL-03", days: [0, 2, 4], start: "16:00", end: "19:00", loc: 0 },
      { name: "Dr. Tanvir Ahmed", name_bn: "ডাঃ তানভীর আহমেদ", spec: "pediatrics", fee: 700, bmdc: "DEMO-GL-04", days: [2, 4, 6], start: "18:00", end: "21:00", loc: 1 },
    ],
    lab: false,
  },
  {
    phone: "01722222222",
    pin: "2222",
    owner: "Dr. Rezaul Karim",
    kind: "chamber",
    name: "Port City Heart Chamber",
    name_bn: "পোর্ট সিটি হার্ট চেম্বার",
    email: "portcity.heart@demo.bloodlink.app",
    district: "Chattogram",
    upazila: "Kotwali",
    address: "Agrabad C/A, Sheikh Mujib Road, Chattogram",
    description: "Cardiology-focused evening chamber near Agrabad. ECG on site.",
    description_bn: "আগ্রাবাদের কার্ডিওলজি চেম্বার। চেম্বারেই ইসিজি।",
    featured: false,
    locations: [
      { name: "Agrabad Chamber", name_bn: "আগ্রাবাদ চেম্বার", upazila: "Kotwali", address: "Sheikh Mujib Road, Agrabad" },
    ],
    doctors: [
      { name: "Prof. Dr. Rezaul Karim", name_bn: "প্রফেসর ডাঃ রেজাউল করিম", spec: "cardiology", fee: 1500, bmdc: "DEMO-PC-01", days: [0, 1, 2, 3, 4, 6], start: "18:00", end: "21:30", loc: 0 },
      { name: "Dr. Nafisa Chowdhury", name_bn: "ডাঃ নাফিসা চৌধুরী", spec: "medicine", fee: 900, bmdc: "DEMO-PC-02", days: [1, 3, 5], start: "17:00", end: "20:00", loc: 0 },
      { name: "Dr. Imran Kabir", name_bn: "ডাঃ ইমরান কবির", spec: "cardiology", fee: 1100, bmdc: "DEMO-PC-03", days: [2, 4, 6], start: "19:00", end: "22:00", loc: 0 },
    ],
    lab: false,
  },
  {
    phone: "01733333333",
    pin: "3333",
    owner: "Md. Shahidul Islam",
    kind: "diagnostic",
    name: "Popular Diagnostic Center (Demo)",
    name_bn: "পপুলার ডায়াগনস্টিক সেন্টার (ডেমো)",
    email: "popular.lab@demo.bloodlink.app",
    district: "Dhaka",
    upazila: "Motijheel",
    address: "House 16, Road 2, Dhanmondi / Shantinagar, Dhaka",
    description: "Full pathology, imaging and cardiac tests. Same-day CBC and blood sugar.",
    description_bn: "প্যাথলজি, ইমেজিং ও কার্ডিয়াক টেস্ট। সিবিসি ও সুগার একই দিনে।",
    featured: true,
    locations: [
      { name: "Dhanmondi Lab", name_bn: "ধানমন্ডি ল্যাব", upazila: "Dhanmondi", address: "House 16, Road 2, Dhanmondi" },
      { name: "Shantinagar Lab", name_bn: "শান্তিনগর ল্যাব", upazila: "Motijheel", address: "Shantinagar, Dhaka" },
    ],
    doctors: [],
    lab: true,
    labPrices: { cbc: 400, fbs: 150, lipid: 900, usg: 1200, xray: 500, ecg: 350, echo: 2500, urine: 200 },
  },
  {
    phone: "01744444444",
    pin: "4444",
    owner: "Dr. Mahmuda Begum",
    kind: "clinic",
    name: "Ibn Sina Diagnostic, Rajshahi",
    name_bn: "ইবনে সিনা ডায়াগনস্টিক, রাজশাহী",
    email: "ibnsina.raj@demo.bloodlink.app",
    district: "Rajshahi",
    upazila: "Boalia",
    address: "Greater Road, Laxmipur, Rajshahi",
    description: "Regional diagnostic clinic with home collection in Rajshahi city.",
    description_bn: "রাজশাহী শহরে হোম কালেকশনসহ ডায়াগনস্টিক ক্লিনিক।",
    featured: false,
    locations: [
      { name: "Laxmipur Lab", name_bn: "লক্ষ্মীপুর ল্যাব", upazila: "Boalia", address: "Greater Road, Laxmipur" },
    ],
    doctors: [],
    lab: true,
    labPrices: { cbc: 350, fbs: 120, lipid: 800, usg: 1000, xray: 450, ecg: 300, urine: 180 },
  },
  {
    phone: "01755555555",
    pin: "5555",
    owner: "Dr. Anwar Hossain",
    kind: "mixed",
    name: "Sylhet Care Hospital Desk",
    name_bn: "সিলেট কেয়ার হাসপাতাল ডেস্ক",
    email: "sylhet.care@demo.bloodlink.app",
    district: "Sylhet",
    upazila: "Sylhet Sadar",
    address: "Amberkhana, Airport Road, Sylhet",
    description: "Hospital chamber desk plus in-house diagnostic lab. Serials and lab booking together.",
    description_bn: "হাসপাতাল চেম্বার ডেস্ক ও ইন-হাউস ল্যাব। সিরিয়াল ও টেস্ট একসাথে।",
    featured: true,
    locations: [
      { name: "Amberkhana OPD", name_bn: "আম্বরখানা ওপিডি", upazila: "Sylhet Sadar", address: "Airport Road, Amberkhana" },
    ],
    doctors: [
      { name: "Prof. Dr. Anwar Hossain", name_bn: "প্রফেসর ডাঃ আনোয়ার হোসেন", spec: "medicine", fee: 1000, bmdc: "DEMO-SY-01", days: [0, 1, 2, 3, 4, 6], start: "09:00", end: "13:00", loc: 0 },
      { name: "Dr. Laila Yasmin", name_bn: "ডাঃ লায়লা ইয়াসমিন", spec: "ent", fee: 800, bmdc: "DEMO-SY-02", days: [1, 3, 6], start: "16:00", end: "19:00", loc: 0 },
      { name: "Dr. Sazzadul Haque", name_bn: "ডাঃ সাজ্জাদুল হক", spec: "orthopedics", fee: 900, bmdc: "DEMO-SY-03", days: [0, 2, 4], start: "17:00", end: "20:00", loc: 0 },
    ],
    lab: true,
    labPrices: { cbc: 380, fbs: 140, usg: 1100, xray: 480, ecg: 320, echo: 2200 },
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

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

  const profile = {
    id: userId,
    full_name: owner,
    phone,
    account_kind: "care_vendor",
  };
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
  const { data, error } = await sb
    .from("districts")
    .select("id, name_en")
    .ilike("name_en", nameEn)
    .limit(5);
  if (error) throw new Error(`districts: ${error.message}`);
  const exact = (data ?? []).find((d) => d.name_en.toLowerCase() === nameEn.toLowerCase());
  return exact?.id ?? data?.[0]?.id ?? null;
}

async function main() {
  const types = await must(await sb.from("care_vendor_types").select("id, slug"), "vendor types");
  if (!types?.length) {
    console.error("care_vendor_types empty. Apply supabase/migrations/20260814120000_care_platform.sql first.");
    process.exit(1);
  }
  const typeBySlug = Object.fromEntries(types.map((t) => [t.slug, t.id]));

  const specs = await must(await sb.from("care_specialties").select("id, slug"), "specialties");
  const specBySlug = Object.fromEntries((specs ?? []).map((s) => [s.slug, s.id]));

  const catalog = await must(
    await sb.from("care_test_catalog").select("id, code, is_active").eq("is_active", true),
    "test catalog",
  );

  const phones = VENDORS.map((v) => v.phone);

  await sb.from("care_doctors").delete().like("bmdc_no", "DEMO-%");
  const { data: oldOrgs } = await sb.from("care_orgs").select("id").in("phone", phones);
  if (oldOrgs?.length) {
    await sb.from("care_orgs").delete().in("id", oldOrgs.map((o) => o.id));
    console.log(`Removed ${oldOrgs.length} previous demo org(s)`);
  }

  console.log("\nSeeding 5 Care vendors…\n");

  for (const v of VENDORS) {
    const userId = await ensureUser(v);
    const did = await districtId(v.district);
    const kindId = typeBySlug[v.kind] ?? typeBySlug.chamber;

    const orgRow = {
      org_kind_id: kindId,
      name: v.name,
      name_bn: v.name_bn,
      phone: v.phone,
      email: v.email,
      website: "https://bloodlink.app/care",
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

    const locIds = [];
    for (let i = 0; i < v.locations.length; i++) {
      const loc = v.locations[i];
      const { data, error } = await sb
        .from("care_locations")
        .insert({
          org_id: orgId,
          name: loc.name,
          name_bn: loc.name_bn,
          district_id: did,
          upazila: loc.upazila,
          address: loc.address,
          phone: v.phone,
          is_active: true,
          sort_order: i,
        })
        .select("id")
        .single();
      if (error) throw new Error(`location: ${error.message}`);
      locIds.push(data.id);
    }

    for (const doc of v.doctors) {
      const doctorCode = `DR-${doc.bmdc.replace(/^DEMO-/, "")}`;
      const doctorEmail = `${doc.bmdc.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@demo.muktosheba.app`;
      const { data: doctor, error: dErr } = await sb
        .from("care_doctors")
        .insert({
          user_id: null,
          full_name: doc.name,
          full_name_bn: doc.name_bn,
          bmdc_no: doc.bmdc,
          doctor_code: doctorCode,
          title: doc.name.startsWith("Prof") ? "Prof. Dr." : "Dr.",
          doctor_type: "MBBS",
          phone: v.phone,
          email: doctorEmail,
          registration_status: "active",
          specialty_id: specBySlug[doc.spec] ?? specBySlug.general ?? null,
          qualifications: "MBBS, MD",
          bio: `${doc.name} consults at ${v.name}.`,
          bio_bn: `${doc.name_bn} ${v.name_bn}-এ পরামর্শ দেন।`,
          is_active: true,
        })
        .select("id")
        .single();
      if (dErr) throw new Error(`doctor: ${dErr.message}`);
      console.log(`    doctor ${doc.name} · ${doctorCode}`);
      const locId = locIds[doc.loc] ?? locIds[0];
      const { data: aff, error: aErr } = await sb
        .from("care_affiliations")
        .insert({
          org_id: orgId,
          doctor_id: doctor.id,
          location_id: locId,
          fee_amount: doc.fee,
          fee_note: "Consultation",
          is_active: true,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(`affiliation: ${aErr.message}`);

      for (const weekday of doc.days) {
        const { data: sch, error: sErr } = await sb
          .from("care_schedules")
          .insert({
            affiliation_id: aff.id,
            weekday,
            start_time: doc.start,
            end_time: doc.end,
            max_serial: 40,
            start_number: 1,
            allow_app_booking: true,
            allow_walk_in: true,
            booking_window_hours: 12,
            slot_minutes: 10,
            is_active: true,
          })
          .select("id")
          .single();
        if (sErr) throw new Error(`schedule: ${sErr.message}`);

        const wdToday = new Date().getDay();
        if (weekday === wdToday) {
          await sb.from("care_sessions").insert({
            schedule_id: sch.id,
            org_id: orgId,
            location_id: locId,
            doctor_id: doctor.id,
            session_date: todayIso(),
            status: "open",
            max_serial: 40,
            start_number: 1,
            last_issued: 3,
            now_serving: 1,
            opened_at: new Date().toISOString(),
          });
        }
      }
    }

    if (v.lab && catalog?.length) {
      const locId = locIds[0];
      const wanted = Object.keys(v.labPrices ?? {});
      const picks = catalog.filter((c) => wanted.includes((c.code ?? "").toLowerCase()));
      const extra = catalog.filter((c) => !picks.some((p) => p.id === c.id)).slice(0, 8 - picks.length);
      const tests = [...picks, ...extra].slice(0, 10);

      for (const t of tests) {
        const code = (t.code ?? "").toLowerCase();
        const price = v.labPrices?.[code] ?? 500;
        const { data: off, error: oErr } = await sb
          .from("care_test_offerings")
          .insert({
            org_id: orgId,
            location_id: locId,
            catalog_id: t.id,
            price,
            booking_mode: "day_quota",
            default_capacity: 40,
            home_collection: v.kind !== "chamber",
            is_active: true,
          })
          .select("id")
          .single();
        if (oErr) throw new Error(`offering: ${oErr.message}`);

        const days = [];
        for (let d = 0; d < 10; d++) days.push(addDays(d));
        await sb.from("care_lab_calendars").insert(
          days.map((cal_date) => ({
            offering_id: off.id,
            location_id: locId,
            cal_date,
            slot_key: "00:00",
            capacity: 40,
            reserved_count: dRand(cal_date),
            is_open: true,
          })),
        );
      }
    }

    console.log(`✓ ${v.name}`);
    console.log(`    login  ${v.phone}   PIN ${v.pin}`);
    console.log(`    portal /care/auth`);
  }

  // Optional doctor portal demo logins (email + password).
  const demoDoctors = [
    {
      bmdc: "DEMO-GL-01",
      email: "dr.ayesha.demo@muktosheba.app",
      password: "DoctorDemo1!",
      name: "Prof. Dr. Ayesha Rahman",
    },
    {
      bmdc: "DEMO-PC-01",
      email: "dr.rezaul.demo@muktosheba.app",
      password: "DoctorDemo1!",
      name: "Prof. Dr. Rezaul Karim",
    },
  ];
  console.log("\nLinking demo doctor portal accounts…");
  for (const d of demoDoctors) {
    const { data: row } = await sb
      .from("care_doctors")
      .select("id, doctor_code")
      .eq("bmdc_no", d.bmdc)
      .maybeSingle();
    if (!row) {
      console.warn(`  (skip ${d.bmdc} — doctor not found)`);
      continue;
    }
    let doctorUserId = await findUserIdByEmail(d.email);
    if (!doctorUserId) {
      const created = await sb.auth.admin.createUser({
        email: d.email,
        password: d.password,
        email_confirm: true,
        user_metadata: { full_name: d.name, account_kind: "care_doctor" },
      });
      if (created.error) {
        console.warn(`  ! ${d.email}: ${created.error.message}`);
        continue;
      }
      doctorUserId = created.data.user?.id ?? null;
    } else {
      await sb.auth.admin.updateUserById(doctorUserId, {
        password: d.password,
        email_confirm: true,
        user_metadata: { full_name: d.name, account_kind: "care_doctor" },
      });
    }
    if (!doctorUserId) continue;
    await sb.from("profiles").upsert({
      id: doctorUserId,
      full_name: d.name,
    });
    await sb
      .from("care_doctors")
      .update({
        user_id: doctorUserId,
        email: d.email,
        registration_status: "active",
      })
      .eq("id", row.id);
    console.log(`  ✓ ${d.name} · ${row.doctor_code ?? d.bmdc}`);
    console.log(`    login ${d.email} / ${d.password}`);
    console.log(`    portal /care/doctor/auth`);
  }

  console.log("\nDone. Login at /care/auth with any phone + PIN above.\n");
  console.log("Doctor portal: /care/doctor/auth (demo emails above).\n");
}

function dRand(dateStr) {
  let n = 0;
  for (const ch of dateStr) n += ch.charCodeAt(0);
  return n % 8;
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message || e);
  process.exit(1);
});
