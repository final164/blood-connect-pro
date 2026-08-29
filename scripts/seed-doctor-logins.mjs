/**
 * Create phone+PIN doctor-portal logins for every DEMO / TELE-DEMO care_doctors row.
 * Run: bun --env-file=.env run scripts/seed-doctor-logins.mjs
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

const PIN = "1234";
const AUTH_EMAIL = (phone) => `bd${phone}@bloodlink.app`;
const pinToPassword = (pin) => `bl${pin}xx`;

/** Stable phone from BMDC so re-runs stay consistent. */
function phoneForBmdc(bmdc) {
  const tele = /^TELE-DEMO-(\d+)$/i.exec(bmdc);
  if (tele) return `017110000${String(Number(tele[1])).padStart(2, "0")}`;

  const op = /^DEMO-OP-(\d+)$/i.exec(bmdc);
  if (op) return `017130000${String(Number(op[1])).padStart(2, "0")}`;

  const chamber = /^DEMO-([A-Z]+)-(\d+)$/i.exec(bmdc);
  if (chamber) {
    const prefix = {
      GL: "017121",
      PC: "017122",
      SY: "017123",
      HL: "017124",
      ML: "017125",
    }[chamber[1].toUpperCase()] || "017129";
    return `${prefix}${String(Number(chamber[2])).padStart(5, "0")}`;
  }

  // Fallback: hash last 8 digits-ish from code
  let n = 0;
  for (const ch of bmdc) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return `01714${String(n % 100000).padStart(5, "0")}`;
}

async function findUserIdByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (!data.users.length || data.users.length < 200) break;
  }
  return null;
}

async function ensurePhoneUser({ phone, pin, fullName, bmdc }) {
  const email = AUTH_EMAIL(phone);
  const password = pinToPassword(pin);
  let userId = await findUserIdByEmail(email);
  const meta = {
    full_name: fullName,
    phone,
    pin,
    account_kind: "care_doctor",
    bmdc_no: bmdc,
  };
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        userId = await findUserIdByEmail(email);
      } else {
        throw new Error(`${phone}: ${error.message}`);
      }
    } else {
      userId = data.user?.id ?? null;
    }
  } else {
    await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: meta,
    });
  }
  if (!userId) throw new Error(`No user for ${phone}`);

  await sb.from("profiles").upsert({ id: userId, full_name: fullName, phone });
  await sb.from("user_login_credentials").upsert(
    { user_id: userId, phone, pin },
    { onConflict: "user_id" },
  );
  return userId;
}

async function main() {
  const { data: doctors, error } = await sb
    .from("care_doctors")
    .select("id, full_name, bmdc_no, doctor_code, registration_status")
    .or("bmdc_no.ilike.DEMO-%,bmdc_no.ilike.TELE-DEMO-%")
    .order("bmdc_no");
  if (error) throw new Error(error.message);
  if (!doctors?.length) {
    console.error("No DEMO / TELE-DEMO doctors found. Run seed:care-vendors, seed:operations, seed:tele-doctors first.");
    process.exit(1);
  }

  console.log(`\nLinking phone+PIN logins for ${doctors.length} doctors…\n`);
  const rows = [];

  for (const d of doctors) {
    const bmdc = d.bmdc_no || d.id;
    const phone = phoneForBmdc(bmdc);
    const userId = await ensurePhoneUser({
      phone,
      pin: PIN,
      fullName: d.full_name,
      bmdc,
    });

    // Free this user from any other doctor row, then bind.
    await sb.from("care_doctors").update({ user_id: null }).eq("user_id", userId).neq("id", d.id);
    const { error: upErr } = await sb
      .from("care_doctors")
      .update({
        user_id: userId,
        phone,
        registration_status: "active",
        is_active: true,
      })
      .eq("id", d.id);
    if (upErr) throw new Error(`link ${bmdc}: ${upErr.message}`);

    rows.push({
      code: d.doctor_code || "—",
      bmdc,
      name: d.full_name,
      phone,
      pin: PIN,
    });
    console.log(`  ✓ ${d.doctor_code || bmdc}  ${phone} / ${PIN}  · ${d.full_name}`);
  }

  console.log("\n========== All doctor portal credentials ==========");
  console.log("Login: /care/doctor/auth  →  Phone + PIN");
  console.log(`PIN (all): ${PIN}\n`);
  console.log("Code".padEnd(14) + "Phone".padEnd(14) + "PIN".padEnd(6) + "Name / BMDC");
  console.log("-".repeat(72));
  for (const r of rows) {
    console.log(
      `${String(r.code).padEnd(14)}${r.phone.padEnd(14)}${r.pin.padEnd(6)}${r.name} (${r.bmdc})`,
    );
  }
  console.log("==================================================\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
