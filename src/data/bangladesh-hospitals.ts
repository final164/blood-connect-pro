/**
 * Bangladesh hospitals, clinics & diagnostic centres catalog.
 * Used for typeahead + admin seed (district slug → facilities).
 */
import { generateClinicsAndDiagnostics } from "./bangladesh-clinics";

export type HospitalSeed = {
  slug: string;
  name_en: string;
  name_bn: string;
  type: "government" | "private" | "clinic" | "diagnostic" | "ngo";
  districtSlug: string;
};

const sadar = (slug: string, en: string, bn: string): HospitalSeed => ({
  slug: `${slug}-sadar`,
  name_en: `${en} General Hospital (Sadar)`,
  name_bn: `${bn} সদর হাসপাতাল`,
  type: "government",
  districtSlug: slug,
});

/** All 64 district sadar / general hospitals */
const DISTRICT_SADAR: HospitalSeed[] = [
  sadar("dhaka", "Dhaka", "ঢাকা"),
  sadar("gazipur", "Gazipur", "গাজীপুর"),
  sadar("narayanganj", "Narayanganj", "নারায়ণগঞ্জ"),
  sadar("tangail", "Tangail", "টাঙ্গাইল"),
  sadar("kishoreganj", "Kishoreganj", "কিশোরগঞ্জ"),
  sadar("manikganj", "Manikganj", "মানিকগঞ্জ"),
  sadar("munshiganj", "Munshiganj", "মুন্সিগঞ্জ"),
  sadar("narsingdi", "Narsingdi", "নরসিংদী"),
  sadar("rajbari", "Rajbari", "রাজবাড়ী"),
  sadar("faridpur", "Faridpur", "ফরিদপুর"),
  sadar("gopalganj", "Gopalganj", "গোপালগঞ্জ"),
  sadar("madaripur", "Madaripur", "মাদারীপুর"),
  sadar("shariatpur", "Shariatpur", "শরীয়তপুর"),
  sadar("chattogram", "Chattogram", "চট্টগ্রাম"),
  sadar("coxs-bazar", "Cox's Bazar", "কক্সবাজার"),
  sadar("cumilla", "Cumilla", "কুমিল্লা"),
  sadar("feni", "Feni", "ফেনী"),
  sadar("noakhali", "Noakhali", "নোয়াখালী"),
  sadar("lakshmipur", "Lakshmipur", "লক্ষ্মীপুর"),
  sadar("chandpur", "Chandpur", "চাঁদপুর"),
  sadar("brahmanbaria", "Brahmanbaria", "ব্রাহ্মণবাড়িয়া"),
  sadar("rangamati", "Rangamati", "রাঙ্গামাটি"),
  sadar("khagrachhari", "Khagrachhari", "খাগড়াছড়ি"),
  sadar("bandarban", "Bandarban", "বান্দরবান"),
  sadar("rajshahi", "Rajshahi", "রাজশাহী"),
  sadar("natore", "Natore", "নাটোর"),
  sadar("naogaon", "Naogaon", "নওগাঁ"),
  sadar("chapainawabganj", "Chapainawabganj", "চাঁপাইনবাবগঞ্জ"),
  sadar("pabna", "Pabna", "পাবনা"),
  sadar("sirajganj", "Sirajganj", "সিরাজগঞ্জ"),
  sadar("bogura", "Bogura", "বগুড়া"),
  sadar("joypurhat", "Joypurhat", "জয়পুরহাট"),
  sadar("khulna", "Khulna", "খুলনা"),
  sadar("bagerhat", "Bagerhat", "বাগেরহাট"),
  sadar("satkhira", "Satkhira", "সাতক্ষীরা"),
  sadar("jashore", "Jashore", "যশোর"),
  sadar("jhenaidah", "Jhenaidah", "ঝিনাইদহ"),
  sadar("magura", "Magura", "মাগুরা"),
  sadar("narail", "Narail", "নড়াইল"),
  sadar("kushtia", "Kushtia", "কুষ্টিয়া"),
  sadar("chuadanga", "Chuadanga", "চুয়াডাঙ্গা"),
  sadar("meherpur", "Meherpur", "মেহেরপুর"),
  sadar("barishal", "Barishal", "বরিশাল"),
  sadar("bhola", "Bhola", "ভোলা"),
  sadar("patuakhali", "Patuakhali", "পটুয়াখালী"),
  sadar("pirojpur", "Pirojpur", "পিরোজপুর"),
  sadar("barguna", "Barguna", "বরগুনা"),
  sadar("jhalokati", "Jhalokati", "ঝালকাঠি"),
  sadar("sylhet", "Sylhet", "সিলেট"),
  sadar("moulvibazar", "Moulvibazar", "মৌলভীবাজার"),
  sadar("habiganj", "Habiganj", "হবিগঞ্জ"),
  sadar("sunamganj", "Sunamganj", "সুনামগঞ্জ"),
  sadar("rangpur", "Rangpur", "রংপুর"),
  sadar("dinajpur", "Dinajpur", "দিনাজপুর"),
  sadar("nilphamari", "Nilphamari", "নীলফামারী"),
  sadar("gaibandha", "Gaibandha", "গাইবান্ধা"),
  sadar("kurigram", "Kurigram", "কুড়িগ্রাম"),
  sadar("lalmonirhat", "Lalmonirhat", "লালমনিরহাট"),
  sadar("thakurgaon", "Thakurgaon", "ঠাকুরগাঁও"),
  sadar("panchagarh", "Panchagarh", "পঞ্চগড়"),
  sadar("mymensingh", "Mymensingh", "ময়মনসিংহ"),
  sadar("jamalpur", "Jamalpur", "জামালপুর"),
  sadar("sherpur", "Sherpur", "শেরপুর"),
  sadar("netrokona", "Netrokona", "নেত্রকোণা"),
];

const NAMED: HospitalSeed[] = [
  // Dhaka — government
  { districtSlug: "dhaka", type: "government", slug: "dmch", name_en: "Dhaka Medical College Hospital", name_bn: "ঢাকা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "bsmmu", name_en: "Bangabandhu Sheikh Mujib Medical University (BSMMU)", name_bn: "বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয় হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "ssmch", name_en: "Sir Salimullah Medical College Mitford Hospital", name_bn: "স্যার সলিমুল্লাহ মেডিকেল কলেজ মিটফোর্ড হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "shsmch", name_en: "Shaheed Suhrawardy Medical College Hospital", name_bn: "শহীদ সোহরাওয়ার্দী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "nicvd", name_en: "National Institute of Cardiovascular Diseases (NICVD)", name_bn: "জাতীয় হৃদরোগ ইনস্টিটিউট" },
  { districtSlug: "dhaka", type: "government", slug: "nitor", name_en: "National Institute of Traumatology & Orthopaedic Rehabilitation (NITOR)", name_bn: "জাতীয় অর্থোপেডিক হাসপাতাল (নিটোর)" },
  { districtSlug: "dhaka", type: "government", slug: "nicrh", name_en: "National Institute of Cancer Research & Hospital", name_bn: "জাতীয় ক্যানসার গবেষণা ইনস্টিটিউট ও হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "nimh", name_en: "National Institute of Mental Health", name_bn: "জাতীয় মানসিক স্বাস্থ্য ইনস্টিটিউট" },
  { districtSlug: "dhaka", type: "government", slug: "nidch", name_en: "National Institute of Diseases of the Chest & Hospital", name_bn: "জাতীয় বক্ষব্যাধি ইনস্টিটিউট" },
  { districtSlug: "dhaka", type: "government", slug: "nigeb", name_en: "National Institute of Neurosciences & Hospital", name_bn: "জাতীয় নিউরোসায়েন্স ইনস্টিটিউট" },
  { districtSlug: "dhaka", type: "government", slug: "dmch-burn", name_en: "Sheikh Hasina National Burn & Plastic Surgery Institute", name_bn: "শেখ হাসিনা জাতীয় বার্ন ও প্লাস্টিক সার্জারি ইনস্টিটিউট" },
  { districtSlug: "dhaka", type: "government", slug: "dghs-kurmitola", name_en: "Kurmitola General Hospital", name_bn: "কুর্মিটোলা জেনারেল হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "mugda", name_en: "Mugda Medical College Hospital", name_bn: "মুগদা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "dncc-mohakhali", name_en: "DNCC Dedicated COVID / Mohakhali Hospital", name_bn: "ডিএনসিসি মহাখালী হাসপাতাল" },
  { districtSlug: "dhaka", type: "government", slug: "bangladesh-secretariat-clinic", name_en: "Bangladesh Secretariat Clinic", name_bn: "বাংলাদেশ সচিবালয় ক্লিনিক" },
  // Dhaka — private
  { districtSlug: "dhaka", type: "private", slug: "square", name_en: "Square Hospital", name_bn: "স্কয়ার হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "united", name_en: "United Hospital", name_bn: "ইউনাইটেড হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "evercare", name_en: "Evercare Hospital Dhaka", name_bn: "এভারকেয়ার হাসপাতাল ঢাকা" },
  { districtSlug: "dhaka", type: "private", slug: "apollo-dhaka", name_en: "Apollo Imperial Hospitals", name_bn: "অ্যাপোলো ইম্পেরিয়াল হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "labaid", name_en: "Labaid Specialized Hospital", name_bn: "ল্যাবএইড স্পেশালাইজড হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "popular", name_en: "Popular Diagnostic Centre & Hospital", name_bn: "পপুলার ডায়াগনস্টিক সেন্টার ও হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "ibn-sina", name_en: "Ibn Sina Hospital", name_bn: "ইবনে সিনা হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "anwer-khan", name_en: "Anwer Khan Modern Medical College Hospital", name_bn: "আনোয়ার খান মডার্ন মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "holy-family", name_en: "Holy Family Red Crescent Medical College Hospital", name_bn: "হলি ফ্যামিলি রেড ক্রিসেন্ট মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "bangladesh-specialized", name_en: "Bangladesh Specialized Hospital", name_bn: "বাংলাদেশ স্পেশালাইজড হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "asgar-ali", name_en: "Asgar Ali Hospital", name_bn: "আসগার আলী হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "japan-bangladesh", name_en: "Japan Bangladesh Friendship Hospital", name_bn: "জাপান বাংলাদেশ ফ্রেন্ডশিপ হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "green-life", name_en: "Green Life Medical College Hospital", name_bn: "গ্রিন লাইফ মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "delta", name_en: "Delta Hospital Limited", name_bn: "ডেল্টা হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "central", name_en: "Central Hospital Limited", name_bn: "সেন্ট্রাল হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "samorita", name_en: "Samorita Hospital", name_bn: "সামরিতা হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "comfort", name_en: "Comfort Nursing Home / Hospital", name_bn: "কমফোর্ট হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "ahrar", name_en: "Ahsania Mission Cancer & General Hospital", name_bn: "আহছানিয়া মিশন ক্যানসার ও জেনারেল হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "birdem", name_en: "BIRDEM General Hospital", name_bn: "বারডেম জেনারেল হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "impulse", name_en: "Impulse Hospital", name_bn: "ইমপালস হাসপাতাল" },
  { districtSlug: "dhaka", type: "private", slug: "praava", name_en: "Praava Health", name_bn: "প্রাভা হেলথ" },
  // Gazipur / Narayanganj
  { districtSlug: "gazipur", type: "government", slug: "gazipur-mch", name_en: "Shaheed Tajuddin Ahmad Medical College Hospital", name_bn: "শহীদ তাজউদ্দীন আহমদ মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "narayanganj", type: "government", slug: "narayanganj-250", name_en: "Narayanganj 300-Bed Hospital", name_bn: "নারায়ণগঞ্জ ৩০০ শয্যা হাসপাতাল" },
  { districtSlug: "narayanganj", type: "private", slug: "us-bangla", name_en: "US-Bangla Medical College Hospital", name_bn: "ইউএস-বাংলা মেডিকেল কলেজ হাসপাতাল" },
  // Chattogram
  { districtSlug: "chattogram", type: "government", slug: "cmch", name_en: "Chittagong Medical College Hospital", name_bn: "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "chattogram", type: "government", slug: "cghs", name_en: "Chattogram General Hospital", name_bn: "চট্টগ্রাম জেনারেল হাসপাতাল" },
  { districtSlug: "chattogram", type: "private", slug: "imperial", name_en: "Imperial Hospital Limited", name_bn: "ইম্পেরিয়াল হাসপাতাল" },
  { districtSlug: "chattogram", type: "private", slug: "max-ctg", name_en: "Max Hospital & Diagnostic Chattogram", name_bn: "ম্যাক্স হাসপাতাল চট্টগ্রাম" },
  { districtSlug: "chattogram", type: "private", slug: "cscr", name_en: "Chattogram Metropolitan Hospital", name_bn: "চট্টগ্রাম মেট্রোপলিটন হাসপাতাল" },
  { districtSlug: "chattogram", type: "private", slug: "national-hospital-ctg", name_en: "National Hospital Chattogram", name_bn: "ন্যাশনাল হাসপাতাল চট্টগ্রাম" },
  { districtSlug: "coxs-bazar", type: "government", slug: "coxs-mch", name_en: "Cox's Bazar Medical College Hospital", name_bn: "কক্সবাজার মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "cumilla", type: "government", slug: "cumilla-mch", name_en: "Cumilla Medical College Hospital", name_bn: "কুমিল্লা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "noakhali", type: "government", slug: "noakhali-mch", name_en: "Abdul Malek Ukil Medical College Hospital", name_bn: "আব্দুল মালেক উকিল মেডিকেল কলেজ হাসপাতাল" },
  // Rajshahi division
  { districtSlug: "rajshahi", type: "government", slug: "rmch", name_en: "Rajshahi Medical College Hospital", name_bn: "রাজশাহী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "rajshahi", type: "private", slug: "islami-bank-raj", name_en: "Islami Bank Medical College Hospital Rajshahi", name_bn: "ইসলামী ব্যাংক মেডিকেল কলেজ হাসপাতাল রাজশাহী" },
  { districtSlug: "bogura", type: "government", slug: "shmch-bogura", name_en: "Shaheed Ziaur Rahman Medical College Hospital", name_bn: "শহীদ জিয়াউর রহমান মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "pabna", type: "government", slug: "pabna-mch", name_en: "Pabna Medical College Hospital", name_bn: "পাবনা মেডিকেল কলেজ হাসপাতাল" },
  // Khulna
  { districtSlug: "khulna", type: "government", slug: "kmch", name_en: "Khulna Medical College Hospital", name_bn: "খুলনা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "khulna", type: "private", slug: "gazi-medical", name_en: "Gazi Medical College Hospital", name_bn: "গাজী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "jashore", type: "government", slug: "jashore-mch", name_en: "Jashore Medical College Hospital", name_bn: "যশোর মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "kushtia", type: "government", slug: "kushtia-mch", name_en: "Kushtia Medical College Hospital", name_bn: "কুষ্টিয়া মেডিকেল কলেজ হাসপাতাল" },
  // Barishal
  { districtSlug: "barishal", type: "government", slug: "sher-e-bangla", name_en: "Sher-e-Bangla Medical College Hospital", name_bn: "শের-ই-বাংলা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "patuakhali", type: "government", slug: "patuakhali-mch", name_en: "Patuakhali Medical College Hospital", name_bn: "পটুয়াখালী মেডিকেল কলেজ হাসপাতাল" },
  // Sylhet
  { districtSlug: "sylhet", type: "government", slug: "somch", name_en: "Sylhet MAG Osmani Medical College Hospital", name_bn: "সিলেট এম.এ.জি. ওসমানী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "sylhet", type: "private", slug: "oasis", name_en: "Oasis Hospital Sylhet", name_bn: "ওয়েসিস হাসপাতাল সিলেট" },
  { districtSlug: "sylhet", type: "private", slug: "mount-adora", name_en: "Mount Adora Hospital", name_bn: "মাউন্ট অ্যাডোরা হাসপাতাল" },
  { districtSlug: "moulvibazar", type: "government", slug: "moulvibazar-mch", name_en: "Moulvibazar Medical College (planned) / District Hospital", name_bn: "মৌলভীবাজার জেলা হাসপাতাল" },
  // Rangpur
  { districtSlug: "rangpur", type: "government", slug: "rangpur-mch", name_en: "Rangpur Medical College Hospital", name_bn: "রংপুর মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "dinajpur", type: "government", slug: "dinajpur-mch", name_en: "M Abdur Rahim Medical College Hospital", name_bn: "এম আব্দুর রহিম মেডিকেল কলেজ হাসপাতাল" },
  // Mymensingh
  { districtSlug: "mymensingh", type: "government", slug: "mmch", name_en: "Mymensingh Medical College Hospital", name_bn: "ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "jamalpur", type: "government", slug: "jamalpur-mch", name_en: "Sheikh Hasina Medical College Hospital Jamalpur", name_bn: "শেখ হাসিনা মেডিকেল কলেজ হাসপাতাল জামালপুর" },
  { districtSlug: "netrokona", type: "government", slug: "netrokona-mch", name_en: "Netrokona Medical College Hospital", name_bn: "নেত্রকোণা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "tangail", type: "government", slug: "tangail-mch", name_en: "Sheikh Hasina Medical College Hospital Tangail", name_bn: "শেখ হাসিনা মেডিকেল কলেজ হাসপাতাল টাঙ্গাইল" },
  { districtSlug: "faridpur", type: "government", slug: "faridpur-mch", name_en: "Faridpur Medical College Hospital", name_bn: "ফরিদপুর মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "kishoreganj", type: "government", slug: "kishoreganj-mch", name_en: "Shahid Syed Nazrul Islam Medical College Hospital", name_bn: "শহীদ সৈয়দ নজরুল ইসলাম মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "manikganj", type: "government", slug: "manikganj-mch", name_en: "Colonel Malek Medical College Hospital", name_bn: "কর্ণেল মালেক মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "gopalganj", type: "government", slug: "gopalganj-mch", name_en: "Sheikh Sayera Khatun Medical College Hospital", name_bn: "শেখ সায়েরা খাতুন মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "brahmanbaria", type: "government", slug: "brahmanbaria-mch", name_en: "Brahmanbaria Medical College Hospital", name_bn: "ব্রাহ্মণবাড়িয়া মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "chandpur", type: "government", slug: "chandpur-mch", name_en: "Chandpur Medical College Hospital", name_bn: "চাঁদপুর মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "feni", type: "government", slug: "feni-mch", name_en: "Feni Medical College Hospital", name_bn: "ফেনী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "satkhira", type: "government", slug: "satkhira-mch", name_en: "Satkhira Medical College Hospital", name_bn: "সাতক্ষীরা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "naogaon", type: "government", slug: "naogaon-mch", name_en: "Naogaon Medical College Hospital", name_bn: "নওগাঁ মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "sirajganj", type: "government", slug: "sirajganj-mch", name_en: "Shaheed M. Monsur Ali Medical College Hospital", name_bn: "শহীদ এম. মনসুর আলী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "habiganj", type: "government", slug: "habiganj-mch", name_en: "Habiganj Medical College Hospital", name_bn: "হবিগঞ্জ মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "sunamganj", type: "government", slug: "sunamganj-mch", name_en: "Sunamganj Medical College Hospital", name_bn: "সুনামগঞ্জ মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "nilphamari", type: "government", slug: "nilphamari-mch", name_en: "Nilphamari Medical College Hospital", name_bn: "নীলফামারী মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "kurigram", type: "government", slug: "kurigram-mch", name_en: "Kurigram Medical College Hospital", name_bn: "কুড়িগ্রাম মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "gaibandha", type: "government", slug: "gaibandha-mch", name_en: "Gaibandha Medical College Hospital", name_bn: "গাইবান্ধা মেডিকেল কলেজ হাসপাতাল" },
  { districtSlug: "sherpur", type: "government", slug: "sherpur-mch", name_en: "Sheikh Hasina Medical College Hospital Sherpur", name_bn: "শেখ হাসিনা মেডিকেল কলেজ হাসপাতাল শেরপুর" },
];

/** Mother & Child / 250-bed style govt hospitals for major districts */
const EXTRA_GOVT: HospitalSeed[] = [
  "dhaka", "chattogram", "rajshahi", "khulna", "barishal", "sylhet", "rangpur", "mymensingh", "cumilla", "bogura",
].flatMap((slug) => [
  {
    districtSlug: slug,
    type: "government" as const,
    slug: `${slug}-mch-wing`,
    name_en: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Maternal & Child Health Training Institute`,
    name_bn: "মাতৃ ও শিশু স্বাস্থ্য প্রশিক্ষণ ইনস্টিটিউট",
  },
  {
    districtSlug: slug,
    type: "government" as const,
    slug: `${slug}-tb`,
    name_en: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} TB Hospital / Chest Clinic`,
    name_bn: "যক্ষ্মা / বক্ষব্যাধি হাসপাতাল",
  },
]);

export const BANGLADESH_HOSPITALS: HospitalSeed[] = (() => {
  const map = new Map<string, HospitalSeed>();
  for (const h of [...DISTRICT_SADAR, ...NAMED, ...EXTRA_GOVT, ...generateClinicsAndDiagnostics()]) {
    map.set(`${h.districtSlug}::${h.slug}`, h);
  }
  return [...map.values()];
})();

export function hospitalCmsKey(h: HospitalSeed) {
  return `hosp:${h.type}:${h.districtSlug}:${h.slug}`;
}

export function parseHospitalCmsKey(key: string): { type: string; districtSlug: string; slug: string } | null {
  if (!key.startsWith("hosp:")) return null;
  const parts = key.split(":");
  if (parts.length < 4) return null;
  return { type: parts[1], districtSlug: parts[2], slug: parts.slice(3).join(":") };
}
