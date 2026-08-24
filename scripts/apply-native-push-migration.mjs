import fs from "fs";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const ref = env.SUPABASE_PROJECT_ID;
const pass = env.SUPABASE_SERVICE_ROLE_KEY;
const sql = fs.readFileSync("supabase/migrations/20260824100000_native_push_platform.sql", "utf8");

const regions = [
  "ap-southeast-1",
  "ap-south-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-central-1",
  "sa-east-1",
];

const urls = [
  ...regions.map(
    (r) =>
      `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${r}.pooler.supabase.com:6543/postgres`,
  ),
  `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/postgres`,
];

// First: probe if column already exists via REST
const rest = await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?select=platform&limit=1`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
const restText = await rest.text();
console.log("REST_PROBE", rest.status, restText.slice(0, 200));
if (rest.ok) {
  console.log("MIGRATION_ALREADY_APPLIED");
  process.exit(0);
}

let ok = false;
for (const url of urls) {
  const host = url.split("@")[1].split("/")[0];
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    console.log("CONNECTED", host);
    await client.query(sql);
    console.log("MIGRATION_OK");
    await client.end();
    ok = true;
    break;
  } catch (e) {
    console.log("FAIL", host, String(e.message).slice(0, 140));
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

if (!ok) process.exit(1);
