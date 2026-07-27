/**
 * Bootstrap BloodLink on a fresh Supabase project:
 * 1) Apply scripts/full-schema.sql in Supabase Dashboard → SQL Editor (Run)
 * 2) bun run scripts/bootstrap-admin.mjs
 *
 * Creates admin user blood@gmail.com with password blood12
 * (Supabase default min password length is 6; typing "blood" in Admin login maps to blood12)
 */
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SECRET) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const email = "blood@gmail.com";
const password = "blood12";

async function main() {
  // Create or update admin user via Auth Admin API
  const listRes = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "User-Agent": "BloodLink-Bootstrap/1.0",
    },
  });
  const listJson = await listRes.json();
  if (!listRes.ok) {
    console.error("List users failed", listRes.status, listJson);
    process.exit(1);
  }
  const users = listJson.users || listJson || [];
  let user = (Array.isArray(users) ? users : []).find((u) => u.email === email);

  if (!user) {
    const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SECRET,
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
        "User-Agent": "BloodLink-Bootstrap/1.0",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Blood Admin" },
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      console.error("Create user failed", createRes.status, created);
      process.exit(1);
    }
    user = created;
    console.log("Created admin user", user.id);
  } else {
    const upd = await fetch(`${URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        apikey: SECRET,
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
        "User-Agent": "BloodLink-Bootstrap/1.0",
      },
      body: JSON.stringify({ password, email_confirm: true }),
    });
    console.log("Updated admin password", upd.status);
  }

  // Grant admin role + ensure profile (requires schema applied)
  const roleRes = await fetch(`${URL}/rest/v1/user_roles?on_conflict=user_id,role`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
      "User-Agent": "BloodLink-Bootstrap/1.0",
    },
    body: JSON.stringify({ user_id: user.id, role: "admin" }),
  });
  console.log("Grant admin role:", roleRes.status, await roleRes.text());

  const profileRes = await fetch(`${URL}/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
      "User-Agent": "BloodLink-Bootstrap/1.0",
    },
    body: JSON.stringify({ id: user.id, full_name: "Blood Admin" }),
  });
  console.log("Upsert profile:", profileRes.status, await profileRes.text());
  console.log("\nAdmin login: blood@gmail.com / blood  (maps to blood12)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
