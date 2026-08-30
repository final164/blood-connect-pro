/**
 * Seed demo “About institute” content (gallery, about BN/EN, FAQs, logo)
 * for Care clinic / hospital / diagnostic / chamber desks.
 *
 * Run: bun --env-file=.env run scripts/seed-org-about.mjs
 *   or: npm run seed:org-about
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SECRET) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const sb = createClient(URL, SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "User-Agent": "BloodLink-OrgAboutSeed/1.0" } },
});

const IMG = {
  hospital: "/landing/hospital.jpg",
  clinic: "/landing/clinic.jpg",
  lab: "/landing/lab.jpg",
  careTeam: "/landing/care-team.jpg",
  nurse: "/landing/nurse.jpg",
  ward: "/landing/ward.jpg",
  community: "/landing/community.jpg",
  hands: "/landing/hands.jpg",
  volunteer: "/landing/volunteer.jpg",
  hero: "/landing/hero.jpg",
};

function faq(qBn, qEn, aBn, aEn) {
  return {
    id: randomUUID(),
    question_bn: qBn,
    question_en: qEn,
    answer_bn: aBn,
    answer_en: aEn,
  };
}

const COMMON_FAQS = [
  faq(
    "অ্যাপয়েন্টমেন্ট কীভাবে নেব?",
    "How do I book an appointment?",
    "BloodLink Care অ্যাপ বা ওয়েবসাইট থেকে সিরিয়াল/টেস্ট/অপারেশন বুক করুন। ডেস্ক থেকেও ওয়াক-ইন সিরিয়াল নেওয়া যায়।",
    "Book serials, lab tests, or operations via the BloodLink Care app or website. Walk-in serials are also available at the desk.",
  ),
  faq(
    "রিপোর্ট কখন পাব?",
    "When will I get my report?",
    "সাধারণ রক্ত পরীক্ষা একই দিনে; ইমেজিং ও বিশেষ টেস্টের সময় নির্ভর করে পরীক্ষার ধরনের উপর। SMS/অ্যাপে নোটিফিকেশন পাবেন।",
    "Routine blood tests are often same-day; imaging and specialised tests vary. You will get SMS/app notifications when ready.",
  ),
  faq(
    "পেমেন্ট কীভাবে করব?",
    "How can I pay?",
    "ক্যাশ, মোবাইল ব্যাংকিং ও কার্ড গ্রহণযোগ্য। প্যাকেজ অপারেশনে অগ্রিম ও বাকি পরিশোধের নিয়ম ডেস্কে জানানো হয়।",
    "Cash, mobile banking, and cards are accepted. Package surgery deposits and balances are explained at the desk.",
  ),
  faq(
    "জরুরি সেবা আছে কি?",
    "Is emergency care available?",
    "জরুরি কেসে হটলাইন বা অ্যাম্বুলেন্স ডেস্ক ব্যবহার করুন। অপারেশন প্যাকেজ জরুরি OT-এর জন্য আলাদা মূল্যায়ন লাগতে পারে।",
    "For emergencies use the hotline or ambulance desk. Surgery packages may need separate assessment for urgent OT.",
  ),
];

/** Demo institutes keyed by vendor phone (seed-care-vendors). */
const BY_PHONE = {
  "01711111111": {
    logo: IMG.clinic,
    gallery: [IMG.clinic, IMG.careTeam, IMG.nurse, IMG.ward, IMG.community],
    about_bn: `গ্রিন লাইফ চেম্বার ধানমন্ডির একটি আধুনিক সন্ধ্যাকালীন কনসালট্যান্ট চেম্বার। মেডিসিন, কার্ডিওলজি, গাইনি ও পেডিয়াট্রিক্সে অভিজ্ঞ চিকিৎসকরা নিয়মিত বসেন।

আমাদের লক্ষ্য—দ্রুত সিরিয়াল, স্বচ্ছ ফি এবং রোগী-বান্ধব পরিবেশ। অ্যাপে সিরিয়াল নিয়ে এলে অপেক্ষার সময় কমে এবং প্রেসক্রিপশন ডিজিটালি সংরক্ষিত থাকে।

মিরপুর শাখায়ও একই মানের সেবা চালু আছে।`,
    about_en: `Green Life Chamber is a modern evening consultant chamber in Dhanmondi. Experienced physicians in medicine, cardiology, gynecology and pediatrics consult regularly.

We focus on fast serials, transparent fees, and a patient-friendly environment. App bookings reduce wait times and keep prescriptions digital.

The same standard of care is available at our Mirpur branch.`,
    faqs: [
      ...COMMON_FAQS.slice(0, 2),
      faq(
        "চেম্বারের সময়সূচি কী?",
        "What are chamber hours?",
        "সাধারণত সন্ধ্যা ৪টা–৯টা (সপ্তাহে ৬ দিন)। ছুটির দিন ডাক্তার অনুযায়ী পরিবর্তন হতে পারে—অ্যাপে লাইভ স্লট দেখুন।",
        "Typically 4–9 PM (six days a week). Holiday hours vary by doctor—check live slots in the app.",
      ),
      faq(
        "নতুন রোগী কি আসতে পারবে?",
        "Can new patients visit?",
        "হ্যাঁ। প্রথম ভিজিটে NID/জন্ম তারিখ ও পূর্ববর্তী রিপোর্ট সাথে আনুন।",
        "Yes. Bring NID/date of birth and prior reports on the first visit.",
      ),
    ],
  },
  "01722222222": {
    logo: IMG.hospital,
    gallery: [IMG.hospital, IMG.careTeam, IMG.nurse, IMG.ward],
    about_bn: `পোর্ট সিটি হার্ট চেম্বার চট্টগ্রামের আগ্রাবাদে অবস্থিত কার্ডিওলজি-কেন্দ্রিক সন্ধ্যাকালীন চেম্বার। অন-সাইট ইসিজি ও অভিজ্ঞ কার্ডিওলজিস্টদের পরামর্শ একই স্থানে পাওয়া যায়।

হার্টের লক্ষণ, ফলো-আপ ও ঝুঁকি মূল্যায়নে আমরা গুরুত্ব দিই। রোগীদের জন্য স্পষ্ট পরামর্শ ও প্রয়োজনে রেফারেল ব্যবস্থা রয়েছে।`,
    about_en: `Port City Heart Chamber is a cardiology-focused evening chamber near Agrabad, Chattogram. On-site ECG and consultant cardiologists are available under one roof.

We emphasise symptom review, follow-up, and risk assessment—with clear advice and referral pathways when needed.`,
    faqs: [
      ...COMMON_FAQS.slice(0, 3),
      faq(
        "ইসিজি কি চেম্বারেই হয়?",
        "Is ECG available on site?",
        "হ্যাঁ, আগ্রাবাদ চেম্বারে ইসিজি করা যায়। রিপোর্ট সাধারণত একই ভিজিটে দেওয়া হয়।",
        "Yes—ECG is available at the Agrabad chamber. Reports are usually ready the same visit.",
      ),
    ],
  },
  "01733333333": {
    logo: IMG.lab,
    gallery: [IMG.lab, IMG.hospital, IMG.careTeam, IMG.nurse, IMG.hands, IMG.ward],
    about_bn: `পপুলার ডায়াগনস্টিক সেন্টার (ডেমো) — প্যাথলজি, ইমেজিং ও কার্ডিয়াক টেস্টের সম্পূর্ণ সেটআপ। ধানমন্ডি ও শান্তিনগর—দুই শাখায় সিবিসি, সুগার, লিপিড, ইউএসজি, এক্স-রে, ইসিজি ও ইকো সেবা চালু।

আমরা মানসম্মত ল্যাব প্রোটোকল, স্বচ্ছ মূল্য এবং একই দিনের রুটিন রিপোর্টের উপর জোর দিই। অপারেশন প্যাকেজ ও সার্জন টিমও কেয়ার পোর্টালের মাধ্যমে বুক করা যায়।

BloodLink-এর মাধ্যমে অনলাইন বুকিং, ইনভয়েস ও রিপোর্ট ট্র্যাকিং এক জায়গায়।`,
    about_en: `Popular Diagnostic Center (Demo) offers full pathology, imaging and cardiac testing. Dhanmondi and Shantinagar branches run CBC, sugar, lipid, USG, X-ray, ECG and echo.

We emphasise quality lab protocols, transparent pricing, and same-day routine reports. Surgery packages and surgeon teams can also be booked via the Care portal.

Online booking, invoices and report tracking stay in one place through BloodLink.`,
    faqs: [
      ...COMMON_FAQS,
      faq(
        "হোম কালেকশন আছে কি?",
        "Do you offer home collection?",
        "নির্বাচিত এলাকায় হোম স্যাম্পল কালেকশন পাওয়া যায়। বুকিংয়ের সময় ঠিকানা নিশ্চিত করুন।",
        "Home sample collection is available in selected areas. Confirm your address when booking.",
      ),
      faq(
        "অপারেশন প্যাকেজে কী কী থাকে?",
        "What is included in surgery packages?",
        "সার্জন ফি, OT, অ্যানেস্থেসিয়া ও বেড—প্যাকেজ অনুযায়ী আলাদা। বিস্তারিত অপারেশন ডেস্ক বা অ্যাপে দেখুন।",
        "Surgeon fee, OT, anesthesia and bed vary by package. See Operation desk or the app for a full breakdown.",
      ),
    ],
  },
  "01744444444": {
    logo: IMG.lab,
    gallery: [IMG.lab, IMG.clinic, IMG.nurse, IMG.community, IMG.volunteer],
    about_bn: `ইবনে সিনা ডায়াগনস্টিক, রাজশাহী — আঞ্চলিক ডায়াগনস্টিক ক্লিনিক। লক্ষ্মীপুরে প্যাথলজি ও ইমেজিং সেবা এবং শহর এলাকায় হোম কালেকশন সুবিধা রয়েছে।

আমাদের অগ্রাধিকার—নির্ভরযোগ্য রিপোর্ট, সাশ্রয়ী মূল্য এবং স্থানীয় রোগীদের দ্রুত সেবা। BloodLink Care দিয়ে অনলাইন টেস্ট বুকিং সহজ।`,
    about_en: `Ibn Sina Diagnostic, Rajshahi is a regional diagnostic clinic. Pathology and imaging at Laxmipur, plus home collection across the city.

We prioritise reliable reports, fair pricing, and fast local access. Online lab booking is available through BloodLink Care.`,
    faqs: [
      ...COMMON_FAQS.slice(0, 3),
      faq(
        "রাজশাহী শহরে হোম কালেকশন কভার করে?",
        "Does home collection cover Rajshahi city?",
        "হ্যাঁ, শহরের নির্বাচিত এলাকায়। সময় স্লট বুকিংয়ের সময় নিশ্চিত করা হয়।",
        "Yes, in selected city areas. Time slots are confirmed at booking.",
      ),
    ],
  },
  "01755555555": {
    logo: IMG.hospital,
    gallery: [IMG.hospital, IMG.ward, IMG.careTeam, IMG.lab, IMG.nurse, IMG.clinic],
    about_bn: `সিলেট কেয়ার হাসপাতাল ডেস্ক — আম্বরখানায় চেম্বার ও ইন-হাউস ডায়াগনস্টিক ল্যাব একসাথে। ওপিডি সিরিয়াল, ল্যাব বুকিং এবং অপারেশন প্যাকেজ একই পোর্টালে পরিচালিত হয়।

মেডিসিন, ইএনটি ও অর্থোপেডিক্সসহ একাধিক বিশেষজ্ঞ চেম্বারে বসেন। হাসপাতাল মানের OT ও ল্যাব সমন্বয়ে রোগীদের এক জায়গায় সম্পূর্ণ কেয়ার পাথ অফার করি।

প্রতিষ্ঠান সম্পর্কে ছবি, সেবা ও প্রশ্নোত্তর এই পেজে আপডেট রাখা হয়।`,
    about_en: `Sylhet Care Hospital Desk combines chamber OPD and an in-house diagnostic lab at Amberkhana. Serials, lab booking and surgery packages run from one portal.

Consultants in medicine, ENT and orthopedics sit regularly. With hospital-grade OT and lab coordination, patients get a full care path in one place.

Photos, services and FAQs on this page stay up to date for visitors.`,
    faqs: [
      ...COMMON_FAQS,
      faq(
        "চেম্বার ও ল্যাব কি একই ভবনে?",
        "Are chamber and lab in the same building?",
        "হ্যাঁ, আম্বরখানা ক্যাম্পাসে ওপিডি ও ল্যাব একসাথে। একই ভিজিটে সিরিয়াল ও টেস্ট সম্ভব।",
        "Yes—OPD and lab share the Amberkhana campus. Serial and tests can be done in one visit.",
      ),
      faq(
        "অপারেশনের আগে কী প্রস্তুতি লাগে?",
        "What preparation is needed before surgery?",
        "প্রি-অপ চেকআপ, প্রয়োজনীয় টেস্ট ও অ্যানেস্থেসিয়া ক্লিয়ারেন্স। ডেস্ক টিম চেকলিস্ট দিয়ে সাহায্য করবে।",
        "Pre-op checks, required tests and anesthesia clearance. The desk team provides a checklist.",
      ),
    ],
  },
};

/** Fallback for other non-ambulance clinics/hospitals without a phone match. */
function fallbackAbout(org) {
  const nameBn = org.name_bn || org.name;
  const nameEn = org.name || org.name_bn;
  return {
    logo: IMG.clinic,
    gallery: [IMG.clinic, IMG.hospital, IMG.careTeam, IMG.lab, IMG.nurse],
    about_bn: `${nameBn} BloodLink Care নেটওয়ার্কের একটি যাচাইকৃত প্রতিষ্ঠান। আমরা মানসম্মত চিকিৎসা সেবা, স্বচ্ছ মূল্য এবং ডিজিটাল বুকিংয়ের মাধ্যমে রোগীদের সেবা দিই।

সিরিয়াল, ল্যাব ও অপারেশন সংক্রান্ত তথ্য কেয়ার পোর্টাল ও অ্যাপে পাওয়া যায়। এই পেজে প্রতিষ্ঠানের পরিচিতি, ছবি ও সাধারণ প্রশ্নোত্তর দেখুন।`,
    about_en: `${nameEn} is a verified institute on the BloodLink Care network. We deliver quality care, transparent pricing, and digital booking for patients.

Serial, lab and surgery information is available in the Care portal and app. Use this page for institute intro, photos and FAQs.`,
    faqs: COMMON_FAQS,
  };
}

const AMBULANCE_PHONES = new Set([
  "01766666666",
  "01777777777",
  "01788888888",
  "01799999999",
  "01611111111",
]);

function isDemoInstitute(org) {
  const phone = String(org.phone || "");
  if (BY_PHONE[phone]) return true;
  if (AMBULANCE_PHONES.has(phone)) return false;
  // Skip unfinished placeholder orgs (name === phone / tiny names)
  if (!org.name || org.name === phone || org.name.length < 3) return false;
  if (/ambulance|rescue|saferide|teacity|lifeline|sundarban/i.test(org.name)) return false;
  return true;
}

async function main() {
  const { data: orgs, error } = await sb
    .from("care_orgs")
    .select("id, name, name_bn, phone, settings, logo_url, description, description_bn")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);

  const targets = (orgs ?? []).filter(isDemoInstitute);
  if (!targets.length) {
    console.log("No clinic/hospital orgs found to seed.");
    return;
  }

  console.log(`Seeding About institute for ${targets.length} org(s)…\n`);

  for (const org of targets) {
    const pack = BY_PHONE[String(org.phone || "")] ?? fallbackAbout(org);
    const prev =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? { ...org.settings }
        : {};

    const about = {
      about_bn: pack.about_bn,
      about_en: pack.about_en,
      gallery: pack.gallery,
      faqs: pack.faqs,
    };

    const nextSettings = { ...prev, about };
    const patch = {
      settings: nextSettings,
      logo_url: org.logo_url || pack.logo,
    };
    // Enrich empty descriptions from about when missing
    if (!org.description && pack.about_en) {
      patch.description = pack.about_en.split("\n\n")[0].slice(0, 280);
    }
    if (!org.description_bn && pack.about_bn) {
      patch.description_bn = pack.about_bn.split("\n\n")[0].slice(0, 280);
    }

    const { error: upErr } = await sb.from("care_orgs").update(patch).eq("id", org.id);
    if (upErr) {
      console.error(`✗ ${org.name}: ${upErr.message}`);
      continue;
    }
    console.log(
      `✓ ${org.name} — gallery ${pack.gallery.length}, faqs ${pack.faqs.length}, logo set`,
    );
  }

  console.log("\nDone. Open Care portal → About institute, or patient Details on facility pages.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
