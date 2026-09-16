/**
 * Build university upazila seeds from UGC registry JSON (BD-Univeristy-Index).
 * Sources: scripts/bd-universities-ugc.json + manual district/BN fixes.
 *
 * Run: node scripts/generate-bd-university-upazilas.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const JSON_PATH = path.join(ROOT, "scripts", "bd-universities-ugc.json");
const OUT_TS = path.join(ROOT, "src", "data", "bd-universities-upazilas.ts");
const OUT_SQL = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260916130000_bd_universities_upazilas.sql",
);

const DISTRICT_TO_SLUG = {
  Dhaka: "dhaka",
  Gazipur: "gazipur",
  Narayanganj: "narayanganj",
  Tangail: "tangail",
  Kishoreganj: "kishoreganj",
  Manikganj: "manikganj",
  Munshiganj: "munshiganj",
  Narsingdi: "narsingdi",
  Rajbari: "rajbari",
  Faridpur: "faridpur",
  Gopalganj: "gopalganj",
  Madaripur: "madaripur",
  Shariatpur: "shariatpur",
  Chittagong: "chattogram",
  Chattogram: "chattogram",
  "Cox's Bazar": "coxs-bazar",
  Comilla: "cumilla",
  Feni: "feni",
  Noakhali: "noakhali",
  Lakshmipur: "lakshmipur",
  Chandpur: "chandpur",
  Brahmanbaria: "brahmanbaria",
  Rangamati: "rangamati",
  Khagrachhari: "khagrachhari",
  Bandarban: "bandarban",
  Rajshahi: "rajshahi",
  Natore: "natore",
  Naogaon: "naogaon",
  Chapainawabganj: "chapainawabganj",
  Pabna: "pabna",
  Sirajganj: "sirajganj",
  Bogura: "bogura",
  Joypurhat: "joypurhat",
  Khulna: "khulna",
  Bagerhat: "bagerhat",
  Satkhira: "satkhira",
  Jessore: "jashore",
  Jashore: "jashore",
  Jhenaidah: "jhenaidah",
  Magura: "magura",
  Narail: "narail",
  Kushtia: "kushtia",
  Chuadanga: "chuadanga",
  Meherpur: "meherpur",
  Barishal: "barishal",
  Barisal: "barishal",
  Bhola: "bhola",
  Patuakhali: "patuakhali",
  Pirojpur: "pirojpur",
  Barguna: "barguna",
  Jhalokati: "jhalokati",
  Sylhet: "sylhet",
  Moulvibazar: "moulvibazar",
  Habiganj: "habiganj",
  Sunamganj: "sunamganj",
  Rangpur: "rangpur",
  Dinajpur: "dinajpur",
  Nilphamari: "nilphamari",
  Gaibandha: "gaibandha",
  Kurigram: "kurigram",
  Lalmonirhat: "lalmonirhat",
  Thakurgaon: "thakurgaon",
  Panchagarh: "panchagarh",
  Mymensingh: "mymensingh",
  Jamalpur: "jamalpur",
  Sherpur: "sherpur",
  Netrokona: "netrokona",
};

/** When UGC JSON lacks district — campus is in this district (Wikipedia / UGC). */
const ID_DISTRICT_OVERRIDE = {
  "jessore-university-of-science-technology": "jashore",
  "rajshahi-medical-university": "rajshahi",
  "khulna-agricultural-university": "khulna",
  "chandpur-science-and-technology-university": "chandpur",
  "kishoreganj-university": "kishoreganj",
  "naogaon-university": "naogaon",
  "meherpur-university": "meherpur",
  "thakurgaon-university": "thakurgaon",
  "lakshmipur-science-technology-university": "lakshmipur",
  "narayanganj-science-and-technology-university": "narayanganj",
  "satkhira-university-of-science-and-technology": "satkhira",
  "pirojpur-science-technology-university": "pirojpur",
  "khulna-medical-university-khulna": "khulna",
  "university-of-science-technology-chittagong": "chattogram",
  "bgc-trust-university-bangladesh": "chattogram",
  "zh-sikder-university-of-science-technology": "shariatpur",
  "exim-bank-agricultural-university-bangladesh": "chapainawabganj",
  "khwaja-yunus-ali-university": "sirajganj",
  "port-city-international-university": "chattogram",
  "coxs-bazar-international-university": "coxs-bazar",
  "bangladesh-army-international-university-of-science-technologybaiust-comilla": "cumilla",
  "r-p-shaha-university": "narayanganj",
  "rupayan-akm-shamsuzzoha-university-academic-programs-have-not-yet-started": "kushtia",
  "shah-makhdum-management-university-rajshahi-academic-programs-have-not-yet-started": "rajshahi",
  "university-of-skill-enrichment-and-technology": "dhaka",
  "microland-university-of-science-and-technology-academic-programs-have-not-yet-started": "dhaka",
  "justice-abu-zafar-siddiquie-science-and-technology-university-kustia-academic-program-has-not-started-yet":
    "kushtia",
  "university-of-creative-technology-chittagong": "chattogram",
  "teesta-university-rangpur": "rangpur",
  "ibais-university": "dhaka",
  "queens-university": "dhaka",
  "america-bangladesh-university": "dhaka",
  "south-asian-university": "dhaka",
  "bogura-science-and-technology-university": "bogura",
  "university-of-bogura": "bogura",
  "dhaka-central-university": "dhaka",
  "habiganj-agricultural-university": "habiganj",
  "kurigram-agricultural-university": "kurigram",
  "shariatpur-agriculture-university": "shariatpur",
  "aviation-and-aerospace-university-bangladesh": "lalmonirhat",
};

const NAME_BN = {
  "University of Dhaka": "ঢাকা বিশ্ববিদ্যালয়",
  "University of Rajshahi": "রাজশাহী বিশ্ববিদ্যালয়",
  "University of Chittagong": "চট্টগ্রাম বিশ্ববিদ্যালয়",
  "Jahangirnagar University": "জাহাঙ্গীরনগর বিশ্ববিদ্যালয়",
  "Islamic University, Bangladesh": "ইসলামী বিশ্ববিদ্যালয়, বাংলাদেশ",
  "Khulna University": "খুলনা বিশ্ববিদ্যালয়",
  "Jagannath University": "জগন্নাথ বিশ্ববিদ্যালয়",
  "Comilla University": "কুমিল্লা বিশ্ববিদ্যালয়",
  "Jatiya Kabi Kazi Nazrul Islam University": "জাতীয় কবি কাজী নজরুল ইসলাম বিশ্ববিদ্যালয়",
  "Bangladesh University of Professionals": "বাংলাদেশ প্রফেশনাল বিশ্ববিদ্যালয়",
  "Begum Rokeya University": "বেগম রোকেয়া বিশ্ববিদ্যালয়",
  "University of Barisal": "বরিশাল বিশ্ববিদ্যালয়",
  "Rabindra University, Bangladesh": "রবীন্দ্র বিশ্ববিদ্যালয়, বাংলাদেশ",
  "Netrokona University": "নেত্রকোণা বিশ্ববিদ্যালয়",
  "Kishoreganj University": "কিশোরগঞ্জ বিশ্ববিদ্যালয়",
  "Meherpur University": "মেহেরপুর বিশ্ববিদ্যালয়",
  "Thakurgaon University": "ঠাকুরগাঁও বিশ্ববিদ্যালয়",
  "Naogaon University": "নওগাঁ বিশ্ববিদ্যালয়",
  "Shahjalal University of Science and Technology": "শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Hajee Mohammad Danesh Science & Technology University": "হাজী মোহাম্মদ দানেশ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Mawlana Bhashani Science and Technology University": "মাওলানা ভাসানী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Patuakhali Science and Technology University": "পটুয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Noakhali Science and Technology University": "নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Jessore University of Science & Technology": "যশোর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Pabna University of Science and Technology": "পাবনা বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Gopalganj Science and Technology University": "গোপালগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Rangamati Science and Technology University": "রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Jamalpur Science and Technology University": "জামালপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Chandpur Science and Technology University": "চাঁদপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Sunamganj Science and Technology University": "সুনামগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Bangladesh University of Engineering & Technology": "বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয় (BUET)",
  "Rajshahi University of Engineering & Technology": "রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Khulna University of Engineering & Technology": "খুলনা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Chittagong University of Engineering & Technology": "চট্টগ্রাম প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়",
  "Dhaka University of Engineering & Technology": "ঢাকা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয় (DUET)",
  "Bangladesh Agricultural University": "বাংলাদেশ কৃষি বিশ্ববিদ্যালয়",
  "Gazipur Agricultural University": "গাজীপুর কৃষি বিশ্ববিদ্যালয়",
  "Sher-e-Bangla Agricultural University": "শের-ই-বাংলা কৃষি বিশ্ববিদ্যালয়",
  "Sylhet Agricultural University": "সিলেট কৃষি বিশ্ববিদ্যালয়",
  "Khulna Agricultural University": "খুলনা কৃষি বিশ্ববিদ্যালয়",
  "National University": "জাতীয় বিশ্ববিদ্যালয়",
  "Bangladesh Open University": "বাংলাদেশ উন্মুক্ত বিশ্ববিদ্যালয়",
};

function cleanUniversityName(raw) {
  let s = String(raw || "");
  s = s.replace(/\\n[\s\S]*/g, "").replace(/\n[\s\S]*/g, "");
  s = s.split(/\s{2,}/)[0].replace(/\*+/g, "").trim();
  return s.replace(/\s+/g, " ").trim();
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function titleCaseDistrict(s) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .replace(/Cox's Bazar/i, "Cox's Bazar");
}

function resolveDistrictSlug(u) {
  if (ID_DISTRICT_OVERRIDE[u.id]) return ID_DISTRICT_OVERRIDE[u.id];
  if (u.district && DISTRICT_TO_SLUG[u.district]) return DISTRICT_TO_SLUG[u.district];
  const nameClean = cleanUniversityName(u.name);
  for (const part of nameClean.split(",").map((p) => p.trim())) {
    if (DISTRICT_TO_SLUG[part]) return DISTRICT_TO_SLUG[part];
    if (part.toLowerCase() === "kustia") return "kushtia";
    if (/comilla/i.test(part)) return "cumilla";
    if (/rangpur/i.test(part)) return "rangpur";
    if (/rajshahi/i.test(part)) return "rajshahi";
    if (/khulna/i.test(part)) return "khulna";
    if (/chittagong|chattogram/i.test(part)) return "chattogram";
  }
  const hay = `${u.permanentCampus || ""} ${u.address || ""}`;
  const distTag = hay.match(/dist(?:rict)?\s*[:：]?\s*([A-Za-z\s']+)/i);
  if (distTag) {
    const key = titleCaseDistrict(distTag[1].replace(/[,.\s]+$/, ""));
    if (DISTRICT_TO_SLUG[key]) return DISTRICT_TO_SLUG[key];
    if (/chattogram|chittagong/i.test(key)) return "chattogram";
  }
  const hayLower = hay.toLowerCase();
  if (/cox[\u2019']?s bazar|coxs bazar|cox\u2019s bazar/.test(hayLower)) return "coxs-bazar";
  if (/sharia/i.test(hayLower)) return "shariatpur";
  if (/naryanganj|narayanganj/.test(hayLower)) return "narayanganj";
  if (/cumilla|comilla/.test(hayLower)) return "cumilla";
  for (const [name, slug] of Object.entries(DISTRICT_TO_SLUG)) {
    if (hayLower.includes(name.toLowerCase())) return slug;
  }
  return null;
}

function nameBn(name) {
  return NAME_BN[name] || name;
}

let raw = fs.readFileSync(JSON_PATH, "utf8");
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const universities = JSON.parse(raw);

const rows = [];
const seen = new Set();

for (const u of universities) {
  if (u.approvalStatus && u.approvalStatus !== "Approved") continue;
  const districtSlug = resolveDistrictSlug(u);
  if (!districtSlug) {
    console.warn("skip (no district):", u.name);
    continue;
  }
  const nameEn = cleanUniversityName(u.name);
  if (!nameEn || nameEn.length > 120) continue;
  const uniSlug = `uni-${u.slug || slugify(nameEn)}`.slice(0, 80);
  const key = `${districtSlug}::${uniSlug}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({
    districtSlug,
    nameEn,
    nameBn: nameBn(nameEn),
    uniSlug,
    sortOrder: 900 + rows.length,
  });
}

rows.sort((a, b) =>
  a.districtSlug.localeCompare(b.districtSlug) || a.nameEn.localeCompare(b.nameEn),
);

const ts = `/** Auto-generated — UGC Bangladesh university registry as district upazilas. */
import type { UpazilaOption } from "@/data/bangladesh-clinics";

export type UniversityUpazilaSeed = {
  districtSlug: string;
  en: string;
  bn: string;
  slug: string;
};

export const BD_UNIVERSITY_UPAZILA_SEEDS: UniversityUpazilaSeed[] = ${JSON.stringify(
  rows.map((r) => ({
    districtSlug: r.districtSlug,
    en: r.nameEn,
    bn: r.nameBn,
    slug: r.uniSlug,
  })),
  null,
  2,
)};

export function getUniversityUpazilaOptions(districtSlug: string): UpazilaOption[] {
  return BD_UNIVERSITY_UPAZILA_SEEDS.filter((u) => u.districtSlug === districtSlug).map((u) => ({
    en: u.en,
    bn: u.bn,
  }));
}
`;

const valueLines = rows.map(
  (r) =>
    `  ('${sqlEscape(r.districtSlug)}', '${sqlEscape(r.nameEn)}', '${sqlEscape(r.nameBn)}', '${sqlEscape(r.uniSlug)}', ${r.sortOrder})`,
);

const sql = `-- Bangladesh universities as upazilas (UGC registry + Wikipedia district fixes)
-- Generated by scripts/generate-bd-university-upazilas.mjs — re-run after updating bd-universities-ugc.json

WITH seeds(district_slug, name_en, name_bn, uni_slug, sort_order) AS (
  VALUES
${valueLines.join(",\n")}
)
INSERT INTO public.upazilas (district_id, name_bn, name_en, slug, sort_order, is_active)
SELECT
  d.id,
  s.name_bn,
  s.name_en,
  s.uni_slug,
  s.sort_order,
  true
FROM seeds s
JOIN public.districts d ON d.slug = s.district_slug
ON CONFLICT (district_id, slug) DO UPDATE SET
  name_bn = EXCLUDED.name_bn,
  name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
`;

fs.writeFileSync(OUT_TS, ts, "utf8");
fs.writeFileSync(OUT_SQL, sql, "utf8");
console.log(`Wrote ${rows.length} universities →`);
console.log(OUT_TS);
console.log(OUT_SQL);
