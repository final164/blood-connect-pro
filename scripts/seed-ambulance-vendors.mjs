/**
 * Seed demo ambulance vendors with fleet, pricing, coverage.
 * Run: bun --env-file=.env run scripts/seed-ambulance-vendors.mjs
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

const AUTH_EMAIL = (phone) => `bd${phone}@bloodlink.app`;
const pinToPassword = (pin) => `bl${pin}xx`;

const VENDORS = [
  {
    phone: "01766666666",
    pin: "6666",
    owner: "Md. Rahim Uddin",
    name: "LifeLine Ambulance Dhaka",
    name_bn: "লাইফলাইন অ্যাম্বুলেন্স ঢাকা",
    district: "Dhaka",
    upazila: "Dhanmondi",
    address: "Road 27, Dhanmondi, Dhaka",
    plate: "DHAKA-AMB-01",
    driver: { name: "Karim Ahmed", phone: "01866666661" },
  },
  {
    phone: "01777777777",
    pin: "7777",
    owner: "Abdul Jabbar",
    name: "SafeRide Ambulance Ctg",
    name_bn: "সেফরাইড অ্যাম্বুলেন্স চট্টগ্রাম",
    district: "Chattogram",
    upazila: "Kotwali",
    address: "Agrabad, Chattogram",
    plate: "CTG-AMB-01",
    driver: { name: "Hasan Ali", phone: "01877777771" },
  },
];

async function ensureAuthUser(phone, pin) {
  const email = AUTH_EMAIL(phone);
  const { data: existing } = await sb.auth.admin.listUsers();
  const hit = existing?.users?.find((u) => u.email === email);
  if (hit) return hit.id;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: pinToPassword(pin),
    email_confirm: true,
    user_metadata: { phone },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const { data: kind } = await sb.from("care_vendor_types").select("id").eq("slug", "ambulance").maybeSingle();
  if (!kind?.id) {
    console.error("Run ambulance_platform migration first (care_vendor_types ambulance)");
    process.exit(1);
  }

  const { data: basicType } = await sb.from("ambulance_service_types").select("id").eq("slug", "basic").maybeSingle();
  const { data: icuType } = await sb.from("ambulance_service_types").select("id").eq("slug", "icu").maybeSingle();

  for (const v of VENDORS) {
    const userId = await ensureAuthUser(v.phone, v.pin);
    await sb.from("profiles").upsert({ id: userId, phone: v.phone, full_name: v.owner, account_kind: "care_vendor" } as never);

    const { data: dist } = await sb.from("districts").select("id").ilike("name", v.district).maybeSingle();

    let orgId;
    const { data: existingOrg } = await sb.from("care_orgs").select("id").eq("phone", v.phone).maybeSingle();
    if (existingOrg?.id) {
      orgId = existingOrg.id;
    } else {
      const { data: org, error } = await sb
        .from("care_orgs")
        .insert({
          org_kind_id: kind.id,
          name: v.name,
          name_bn: v.name_bn,
          phone: v.phone,
          district_id: dist?.id ?? null,
          upazila: v.upazila,
          address: v.address,
          is_active: true,
          is_verified: true,
          is_listed: true,
          kyc_status: "verified",
          profile_completed: true,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      orgId = org.id;
    }

    await sb.rpc("ensure_care_default_roles", { _org_id: orgId });
    const { data: ownerRole } = await sb.from("care_org_roles").select("id").eq("org_id", orgId).eq("slug", "owner").maybeSingle();
    await sb.from("care_org_members").upsert({ org_id: orgId, user_id: userId, role: "owner", role_id: ownerRole?.id ?? null } as never);

    if (basicType?.id) {
      await sb.from("ambulance_service_offerings").upsert({
        org_id: orgId,
        service_type_id: basicType.id,
        base_price: 800,
        per_km_price: 35,
        min_fare: 500,
        is_active: true,
      } as never);
    }
    if (icuType?.id) {
      await sb.from("ambulance_service_offerings").upsert({
        org_id: orgId,
        service_type_id: icuType.id,
        base_price: 2500,
        per_km_price: 80,
        min_fare: 2000,
        is_active: true,
      } as never);
    }

    if (dist?.id) {
      await sb.from("ambulance_coverage_areas").upsert({
        org_id: orgId,
        district_id: dist.id,
        upazilas: [v.upazila],
        radius_km: 30,
        is_active: true,
      } as never);
    }

    await sb.from("ambulance_availability_rules").upsert({ org_id: orgId, is_24_7: true } as never);

    const { data: veh } = await sb
      .from("ambulance_vehicles")
      .upsert({ org_id: orgId, plate_no: v.plate, service_type_id: basicType?.id ?? null, status: "available", is_active: true } as never)
      .select("id")
      .maybeSingle();

    const { data: drv } = await sb
      .from("ambulance_drivers")
      .upsert({ org_id: orgId, full_name: v.driver.name, phone: v.driver.phone, is_active: true } as never)
      .select("id")
      .maybeSingle();

    if (veh?.id && drv?.id) {
      await sb.from("ambulance_vehicle_assignments").upsert({
        org_id: orgId,
        vehicle_id: veh.id,
        driver_id: drv.id,
        is_primary: true,
      } as never);
    }

    console.log(`✓ ${v.name} (${v.phone} / PIN ${v.pin}) org=${orgId}`);
  }

  console.log("\nAmbulance vendors seeded. Portal: /care/auth → /care/portal/ambulance");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
