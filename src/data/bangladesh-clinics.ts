/**
 * Local clinics, diagnostic centres & upazila facilities for all 64 districts.
 */
export type FacilitySeed = {
  slug: string;
  name_en: string;
  name_bn: string;
  type: "government" | "private" | "clinic" | "diagnostic" | "ngo";
  districtSlug: string;
  /** English upazila name — matches profiles/requests.area */
  upazila?: string;
};

export type UpazilaOption = { en: string; bn: string };
type Dist = { slug: string; en: string; bn: string; upazilas: UpazilaOption[] };

/** True if this option is the district sadar / city HQ */
function isSadarUpazila(u: UpazilaOption, districtEn: string): boolean {
  const en = u.en.toLowerCase().trim();
  const needle = `${districtEn} Sadar`.toLowerCase();
  return (
    en === needle ||
    en === "sadar" ||
    en === `${districtEn.toLowerCase()} sadar` ||
    /city corporation/i.test(u.en)
  );
}

/** Ensure every district list includes "{District} Sadar" / "{জেলা} সদর" at the front */
export function withDistrictSadar(
  district: { en: string; bn: string },
  upazilas: UpazilaOption[],
): UpazilaOption[] {
  const enName = district.en?.trim();
  const bnName = district.bn?.trim();
  if (!enName) return upazilas;
  const existing = upazilas.find((u) => isSadarUpazila(u, enName));
  const rest = upazilas.filter((u) => !isSadarUpazila(u, enName));
  const sadar: UpazilaOption = existing ?? {
    en: `${enName} Sadar`,
    bn: `${bnName || enName} সদর`,
  };
  return [sadar, ...rest];
}

export function getUpazilasForDistrictSlug(slug: string): UpazilaOption[] {
  const d = D.find((x) => x.slug === slug);
  if (!d) return [];
  return withDistrictSadar(d, d.upazilas);
}

/** All bundled upazila seeds keyed by district slug (for DB seeding). */
export function getAllDistrictUpazilaSeeds(): { districtSlug: string; upazilas: UpazilaOption[] }[] {
  return D.map((d) => ({
    districtSlug: d.slug,
    upazilas: withDistrictSadar(d, d.upazilas),
  }));
}

export function resolveUpazilaLabel(
  label: string | null | undefined,
  districtSlug: string | null | undefined,
): string | null {
  if (!label?.trim()) return null;
  const trimmed = label.trim();
  if (!districtSlug) return trimmed;
  const q = trimmed.toLowerCase();
  const hit = getUpazilasForDistrictSlug(districtSlug).find(
    (u) =>
      u.en.toLowerCase() === q ||
      u.bn.toLowerCase() === q ||
      u.en.toLowerCase().includes(q) ||
      u.bn.includes(trimmed),
  );
  return hit?.en ?? trimmed;
}

export function upazilaDisplayName(
  stored: string | null | undefined,
  districtSlug: string | null | undefined,
  lang: "bn" | "en",
): string | null {
  if (!stored) return null;
  if (!districtSlug) return stored;
  const hit = getUpazilasForDistrictSlug(districtSlug).find(
    (u) => u.en.toLowerCase() === stored.toLowerCase(),
  );
  return hit ? (lang === "bn" ? hit.bn : hit.en) : stored;
}

const D: Dist[] = [
  { slug: "dhaka", en: "Dhaka", bn: "ঢাকা", upazilas: [
    { en: "Dhamrai", bn: "ধামরাই" }, { en: "Dohar", bn: "দোহার" }, { en: "Keraniganj", bn: "কেরানীগঞ্জ" },
    { en: "Nawabganj", bn: "নবাবগঞ্জ" }, { en: "Savar", bn: "সাভার" },
  ]},
  { slug: "gazipur", en: "Gazipur", bn: "গাজীপুর", upazilas: [
    { en: "Kaliakair", bn: "কালিয়াকৈর" }, { en: "Kaliganj", bn: "কালীগঞ্জ" }, { en: "Kapasia", bn: "কাপাসিয়া" },
    { en: "Sreepur", bn: "শ্রীপুর" }, { en: "Tongi", bn: "টঙ্গী" },
  ]},
  { slug: "narayanganj", en: "Narayanganj", bn: "নারায়ণগঞ্জ", upazilas: [
    { en: "Araihazar", bn: "আড়াইহাজার" }, { en: "Bandar", bn: "বন্দর" }, { en: "Rupganj", bn: "রূপগঞ্জ" },
    { en: "Sonargaon", bn: "সোনারগাঁও" },
  ]},
  { slug: "tangail", en: "Tangail", bn: "টাঙ্গাইল", upazilas: [
    { en: "Basail", bn: "বাসাইল" }, { en: "Bhuapur", bn: "ভূঞাপুর" }, { en: "Delduar", bn: "দেলদুয়ার" },
    { en: "Ghatail", bn: "ঘাটাইল" }, { en: "Gopalpur", bn: "গোপালপুর" }, { en: "Kalihati", bn: "কালিহাতী" },
    { en: "Madhupur", bn: "মধুপুর" }, { en: "Mirzapur", bn: "মির্জাপুর" }, { en: "Nagarpur", bn: "নাগরপুর" },
    { en: "Sakhipur", bn: "সখিপুর" },
  ]},
  { slug: "kishoreganj", en: "Kishoreganj", bn: "কিশোরগঞ্জ", upazilas: [
    { en: "Bhairab", bn: "ভৈরব" }, { en: "Bajitpur", bn: "বাজিতপুর" }, { en: "Itna", bn: "ইটনা" },
    { en: "Karimganj", bn: "করিমগঞ্জ" }, { en: "Katiadi", bn: "কটিয়াদী" }, { en: "Kuliarchar", bn: "কুলিয়ারচর" },
    { en: "Mithamain", bn: "মিঠামইন" }, { en: "Nikli", bn: "নিকলী" }, { en: "Pakundia", bn: "পাকুন্দিয়া" },
  ]},
  { slug: "manikganj", en: "Manikganj", bn: "মানিকগঞ্জ", upazilas: [
    { en: "Daulatpur", bn: "দৌলতপুর" }, { en: "Ghior", bn: "ঘিওর" }, { en: "Harirampur", bn: "হরিরামপুর" },
    { en: "Saturia", bn: "সাটুরিয়া" }, { en: "Shibalaya", bn: "শিবালয়" }, { en: "Singair", bn: "সিংগাইর" },
  ]},
  { slug: "munshiganj", en: "Munshiganj", bn: "মুন্সিগঞ্জ", upazilas: [
    { en: "Gazaria", bn: "গজারিয়া" }, { en: "Lohajang", bn: "লৌহজং" }, { en: "Sirajdikhan", bn: "সিরাজদিখান" },
    { en: "Sreenagar", bn: "শ্রীনগর" }, { en: "Tongibari", bn: "টংগিবাড়ি" },
  ]},
  { slug: "narsingdi", en: "Narsingdi", bn: "নরসিংদী", upazilas: [
    { en: "Belabo", bn: "বেলাবো" }, { en: "Monohardi", bn: "মনোহরদী" }, { en: "Palash", bn: "পলাশ" },
    { en: "Raipura", bn: "রায়পুরা" }, { en: "Shibpur", bn: "শিবপুর" },
  ]},
  { slug: "rajbari", en: "Rajbari", bn: "রাজবাড়ী", upazilas: [
    { en: "Baliakandi", bn: "বালিয়াকান্দি" }, { en: "Goalanda", bn: "গোয়ালন্দ" }, { en: "Pangsha", bn: "পাংশা" },
    { en: "Kalukhali", bn: "কালুখালী" },
  ]},
  { slug: "faridpur", en: "Faridpur", bn: "ফরিদপুর", upazilas: [
    { en: "Alfadanga", bn: "আলফাডাঙ্গা" }, { en: "Bhanga", bn: "ভাঙ্গা" }, { en: "Boalmari", bn: "বোয়ালমারী" },
    { en: "Charbhadrasan", bn: "চরভদ্রাসন" }, { en: "Madhukhali", bn: "মধুখালী" }, { en: "Nagarkanda", bn: "নগরকান্দা" },
    { en: "Sadarpur", bn: "সদরপুর" }, { en: "Saltha", bn: "সালথা" },
  ]},
  { slug: "gopalganj", en: "Gopalganj", bn: "গোপালগঞ্জ", upazilas: [
    { en: "Kashiani", bn: "কাশিয়ানী" }, { en: "Kotalipara", bn: "কোটালীপাড়া" }, { en: "Muksudpur", bn: "মুকসুদপুর" },
    { en: "Tungipara", bn: "টুঙ্গিপাড়া" },
  ]},
  { slug: "madaripur", en: "Madaripur", bn: "মাদারীপুর", upazilas: [
    { en: "Kalkini", bn: "কালকিনি" }, { en: "Rajoir", bn: "রাজৈর" }, { en: "Shibchar", bn: "শিবচর" },
  ]},
  { slug: "shariatpur", en: "Shariatpur", bn: "শরীয়তপুর", upazilas: [
    { en: "Bhedarganj", bn: "ভেদরগঞ্জ" }, { en: "Damudya", bn: "ডামুড্যা" }, { en: "Gosairhat", bn: "গোসাইরহাট" },
    { en: "Naria", bn: "নড়িয়া" }, { en: "Zanjira", bn: "জাজিরা" },
  ]},
  { slug: "chattogram", en: "Chattogram", bn: "চট্টগ্রাম", upazilas: [
    { en: "Anwara", bn: "আনোয়ারা" }, { en: "Banshkhali", bn: "বাঁশখালী" }, { en: "Boalkhali", bn: "বোয়ালখালী" },
    { en: "Chandanaish", bn: "চন্দনাইশ" }, { en: "Fatikchhari", bn: "ফটিকছড়ি" }, { en: "Hathazari", bn: "হাটহাজারী" },
    { en: "Lohagara", bn: "লোহাগাড়া" }, { en: "Mirsharai", bn: "মীরসরাই" }, { en: "Patiya", bn: "পটিয়া" },
    { en: "Rangunia", bn: "রাঙ্গুনিয়া" }, { en: "Raozan", bn: "রাউজান" }, { en: "Sandwip", bn: "সন্দ্বীপ" },
    { en: "Satkania", bn: "সাতকানিয়া" }, { en: "Sitakunda", bn: "সীতাকুণ্ড" },
  ]},
  { slug: "coxs-bazar", en: "Cox's Bazar", bn: "কক্সবাজার", upazilas: [
    { en: "Chakaria", bn: "চকরিয়া" }, { en: "Kutubdia", bn: "কুতুবদিয়া" }, { en: "Maheshkhali", bn: "মহেশখালী" },
    { en: "Pekua", bn: "পেকুয়া" }, { en: "Ramu", bn: "রামু" }, { en: "Teknaf", bn: "টেকনাফ" },
    { en: "Ukhia", bn: "উখিয়া" },
  ]},
  { slug: "cumilla", en: "Cumilla", bn: "কুমিল্লা", upazilas: [
    { en: "Barura", bn: "বরুড়া" }, { en: "Brahmanpara", bn: "ব্রাহ্মণপাড়া" }, { en: "Burichang", bn: "বুড়িচং" },
    { en: "Chandina", bn: "চান্দিনা" }, { en: "Chauddagram", bn: "চৌদ্দগ্রাম" }, { en: "Daudkandi", bn: "দাউদকান্দি" },
    { en: "Debidwar", bn: "দেবিদ্বার" }, { en: "Homna", bn: "হোমনা" }, { en: "Laksam", bn: "লাকসাম" },
    { en: "Muradnagar", bn: "মুরাদনগর" }, { en: "Nangalkot", bn: "নাঙ্গলকোট" }, { en: "Titas", bn: "তিতাস" },
  ]},
  { slug: "feni", en: "Feni", bn: "ফেনী", upazilas: [
    { en: "Chhagalnaiya", bn: "ছাগলনাইয়া" }, { en: "Daganbhuiyan", bn: "দাগনভূঞা" }, { en: "Parshuram", bn: "পরশুরাম" },
    { en: "Sonagazi", bn: "সোনাগাজী" }, { en: "Fulgazi", bn: "ফুলগাজী" },
  ]},
  { slug: "noakhali", en: "Noakhali", bn: "নোয়াখালী", upazilas: [
    { en: "Begumganj", bn: "বেগমগঞ্জ" }, { en: "Chatkhil", bn: "চাটখিল" }, { en: "Companiganj", bn: "কোম্পানীগঞ্জ" },
    { en: "Hatiya", bn: "হাতিয়া" }, { en: "Senbagh", bn: "সেনবাগ" }, { en: "Sonaimuri", bn: "সোনাইমুড়ী" },
    { en: "Subarnachar", bn: "সুবর্ণচর" },
  ]},
  { slug: "lakshmipur", en: "Lakshmipur", bn: "লক্ষ্মীপুর", upazilas: [
    { en: "Raipur", bn: "রায়পুর" }, { en: "Ramganj", bn: "রামগঞ্জ" }, { en: "Ramgati", bn: "রামগতি" },
    { en: "Kamalnagar", bn: "কমলনগর" },
  ]},
  { slug: "chandpur", en: "Chandpur", bn: "চাঁদপুর", upazilas: [
    { en: "Faridganj", bn: "ফরিদগঞ্জ" }, { en: "Haimchar", bn: "হাইমচর" }, { en: "Hajiganj", bn: "হাজীগঞ্জ" },
    { en: "Kachua", bn: "কচুয়া" }, { en: "Matlab Dakshin", bn: "মতলব দক্ষিণ" }, { en: "Matlab Uttar", bn: "মতলব উত্তর" },
    { en: "Shahrasti", bn: "শাহরাস্তি" },
  ]},
  { slug: "brahmanbaria", en: "Brahmanbaria", bn: "ব্রাহ্মণবাড়িয়া", upazilas: [
    { en: "Akhaura", bn: "আখাউড়া" }, { en: "Ashuganj", bn: "আশুগঞ্জ" }, { en: "Bancharampur", bn: "বাঞ্ছারামপুর" },
    { en: "Kasba", bn: "কসবা" }, { en: "Nabinagar", bn: "নবীনগর" }, { en: "Nasirnagar", bn: "নাসিরনগর" },
    { en: "Sarail", bn: "সরাইল" },
  ]},
  { slug: "rangamati", en: "Rangamati", bn: "রাঙ্গামাটি", upazilas: [
    { en: "Bagaichhari", bn: "বাঘাইছড়ি" }, { en: "Barkal", bn: "বরকল" }, { en: "Kawkhali", bn: "কাউখালী" },
    { en: "Kaptai", bn: "কাপ্তাই" }, { en: "Juraichhari", bn: "জুরাছড়ি" }, { en: "Langadu", bn: "লংগদু" },
    { en: "Naniarchar", bn: "নানিয়ারচর" }, { en: "Rajasthali", bn: "রাজস্থলী" },
  ]},
  { slug: "khagrachhari", en: "Khagrachhari", bn: "খাগড়াছড়ি", upazilas: [
    { en: "Dighinala", bn: "দিঘীনালা" }, { en: "Lakshmichhari", bn: "লক্ষীছড়ি" }, { en: "Mahalchhari", bn: "মহালছড়ি" },
    { en: "Manikchhari", bn: "মানিকছড়ি" }, { en: "Matiranga", bn: "মাটিরাঙ্গা" }, { en: "Panchhari", bn: "পানছড়ি" },
    { en: "Ramgarh", bn: "রামগড়" },
  ]},
  { slug: "bandarban", en: "Bandarban", bn: "বান্দরবান", upazilas: [
    { en: "Alikadam", bn: "আলীকদম" }, { en: "Lama", bn: "লামা" }, { en: "Naikhongchhari", bn: "নাইক্ষ্যংছড়ি" },
    { en: "Rowangchhari", bn: "রোয়াংছড়ি" }, { en: "Ruma", bn: "রুমা" }, { en: "Thanchi", bn: "থানচি" },
  ]},
  { slug: "rajshahi", en: "Rajshahi", bn: "রাজশাহী", upazilas: [
    { en: "Bagha", bn: "বাঘা" }, { en: "Bagmara", bn: "বাগমারা" }, { en: "Charghat", bn: "চারঘাট" },
    { en: "Durgapur", bn: "দুর্গাপুর" }, { en: "Godagari", bn: "গোদাগাড়ী" }, { en: "Mohanpur", bn: "মোহনপুর" },
    { en: "Paba", bn: "পবা" }, { en: "Puthia", bn: "পুঠিয়া" }, { en: "Tanore", bn: "তানোর" },
  ]},
  { slug: "natore", en: "Natore", bn: "নাটোর", upazilas: [
    { en: "Bagatipara", bn: "বাগাতিপাড়া" }, { en: "Baraigram", bn: "বড়াইগ্রাম" }, { en: "Gurudaspur", bn: "গুরুদাসপুর" },
    { en: "Lalpur", bn: "লালপুর" }, { en: "Singra", bn: "সিংড়া" }, { en: "Naldanga", bn: "নলডাঙ্গা" },
  ]},
  { slug: "naogaon", en: "Naogaon", bn: "নওগাঁ", upazilas: [
    { en: "Atrai", bn: "আত্রাই" }, { en: "Badalgachhi", bn: "বদলগাছী" }, { en: "Dhamoirhat", bn: "ধামইরহাট" },
    { en: "Manda", bn: "মান্দা" }, { en: "Mohadevpur", bn: "মহাদেবপুর" }, { en: "Niamatpur", bn: "নিয়ামতপুর" },
    { en: "Patnitala", bn: "পত্নীতলা" }, { en: "Porsha", bn: "পোরশা" }, { en: "Raninagar", bn: "রাণীনগর" },
    { en: "Sapahar", bn: "সাপাহার" },
  ]},
  { slug: "chapainawabganj", en: "Chapainawabganj", bn: "চাঁপাইনবাবগঞ্জ", upazilas: [
    { en: "Bholahat", bn: "ভোলাহাট" }, { en: "Gomostapur", bn: "গোমস্তাপুর" }, { en: "Nachole", bn: "নাচোল" },
    { en: "Shibganj", bn: "শিবগঞ্জ" },
  ]},
  { slug: "pabna", en: "Pabna", bn: "পাবনা", upazilas: [
    { en: "Atgharia", bn: "আটঘরিয়া" }, { en: "Bera", bn: "বেড়া" }, { en: "Bhangura", bn: "ভাঙ্গুড়া" },
    { en: "Chatmohar", bn: "চাটমোহর" }, { en: "Faridpur", bn: "ফরিদপুর" }, { en: "Ishwardi", bn: "ঈশ্বরদী" },
    { en: "Santhia", bn: "সাঁথিয়া" }, { en: "Sujanagar", bn: "সুজানগর" },
  ]},
  { slug: "sirajganj", en: "Sirajganj", bn: "সিরাজগঞ্জ", upazilas: [
    { en: "Belkuchi", bn: "বেলকুচি" }, { en: "Chauhali", bn: "চৌহালি" }, { en: "Kamarkhanda", bn: "কামারখন্দ" },
    { en: "Kazipur", bn: "কাজীপুর" }, { en: "Raiganj", bn: "রায়গঞ্জ" }, { en: "Shahjadpur", bn: "শাহজাদপুর" },
    { en: "Tarash", bn: "তাড়াশ" }, { en: "Ullahpara", bn: "উল্লাপাড়া" },
  ]},
  { slug: "bogura", en: "Bogura", bn: "বগুড়া", upazilas: [
    { en: "Adamdighi", bn: "আদমদিঘী" }, { en: "Dhunat", bn: "ধুনট" }, { en: "Dupchanchia", bn: "দুপচাঁচিয়া" },
    { en: "Gabtali", bn: "গাবতলী" }, { en: "Kahaloo", bn: "কাহালু" }, { en: "Nandigram", bn: "নন্দীগ্রাম" },
    { en: "Sariakandi", bn: "সারিয়াকান্দি" }, { en: "Shajahanpur", bn: "শাহজাহানপুর" }, { en: "Sherpur", bn: "শেরপুর" },
    { en: "Shibganj", bn: "শিবগঞ্জ" }, { en: "Sonatala", bn: "সোনাতলা" },
  ]},
  { slug: "joypurhat", en: "Joypurhat", bn: "জয়পুরহাট", upazilas: [
    { en: "Akkelpur", bn: "আক্কেলপুর" }, { en: "Kalai", bn: "কালাই" }, { en: "Khetlal", bn: "ক্ষেতলাল" },
    { en: "Panchbibi", bn: "পাঁচবিবি" },
  ]},
  { slug: "khulna", en: "Khulna", bn: "খুলনা", upazilas: [
    { en: "Batiaghata", bn: "বটিয়াঘাটা" }, { en: "Dacope", bn: "দাকোপ" }, { en: "Dumuria", bn: "ডুমুরিয়া" },
    { en: "Dighalia", bn: "দিঘলিয়া" }, { en: "Koyra", bn: "কয়রা" }, { en: "Paikgachha", bn: "পাইকগাছা" },
    { en: "Phultala", bn: "ফুলতলা" }, { en: "Rupsha", bn: "রূপসা" }, { en: "Terokhada", bn: "তেরখাদা" },
  ]},
  { slug: "bagerhat", en: "Bagerhat", bn: "বাগেরহাট", upazilas: [
    { en: "Chitalmari", bn: "চিতলমারী" }, { en: "Fakirhat", bn: "ফকিরহাট" }, { en: "Kachua", bn: "কচুয়া" },
    { en: "Mollahat", bn: "মোল্লাহাট" }, { en: "Mongla", bn: "মোংলা" }, { en: "Morrelganj", bn: "মোড়েলগঞ্জ" },
    { en: "Rampal", bn: "রামপাল" }, { en: "Sarankhola", bn: "শরণখোলা" },
  ]},
  { slug: "satkhira", en: "Satkhira", bn: "সাতক্ষীরা", upazilas: [
    { en: "Assasuni", bn: "আশাশুনি" }, { en: "Debhata", bn: "দেবহাটা" }, { en: "Kalaroa", bn: "কলারোয়া" },
    { en: "Kaliganj", bn: "কালীগঞ্জ" }, { en: "Shyamnagar", bn: "শ্যামনগর" }, { en: "Tala", bn: "তালা" },
  ]},
  { slug: "jashore", en: "Jashore", bn: "যশোর", upazilas: [
    { en: "Abhaynagar", bn: "অভয়নগর" }, { en: "Bagherpara", bn: "বাঘারপাড়া" }, { en: "Chaugachha", bn: "চৌগাছা" },
    { en: "Jhikargachha", bn: "ঝিকরগাছা" }, { en: "Keshabpur", bn: "কেশবপুর" }, { en: "Manirampur", bn: "মণিরামপুর" },
    { en: "Sharsha", bn: "শার্শা" },
  ]},
  { slug: "jhenaidah", en: "Jhenaidah", bn: "ঝিনাইদহ", upazilas: [
    { en: "Harinakunda", bn: "হরিণাকুণ্ডু" }, { en: "Kaliganj", bn: "কালীগঞ্জ" }, { en: "Kotchandpur", bn: "কোটচাঁদপুর" },
    { en: "Maheshpur", bn: "মহেশপুর" }, { en: "Shailkupa", bn: "শৈলকুপা" },
  ]},
  { slug: "magura", en: "Magura", bn: "মাগুরা", upazilas: [
    { en: "Mohammadpur", bn: "মহম্মদপুর" }, { en: "Shalikha", bn: "শালিখা" }, { en: "Sreepur", bn: "শ্রীপুর" },
  ]},
  { slug: "narail", en: "Narail", bn: "নড়াইল", upazilas: [
    { en: "Kalia", bn: "কালিয়া" }, { en: "Lohagara", bn: "লোহাগড়া" },
  ]},
  { slug: "kushtia", en: "Kushtia", bn: "কুষ্টিয়া", upazilas: [
    { en: "Bheramara", bn: "ভেড়ামারা" }, { en: "Daulatpur", bn: "দৌলতপুর" }, { en: "Khoksa", bn: "খোকসা" },
    { en: "Kumarkhali", bn: "কুমারখালী" }, { en: "Mirpur", bn: "মিরপুর" },
  ]},
  { slug: "chuadanga", en: "Chuadanga", bn: "চুয়াডাঙ্গা", upazilas: [
    { en: "Alamdanga", bn: "আলমডাঙ্গা" }, { en: "Damurhuda", bn: "দামুড়হুদা" }, { en: "Jibannagar", bn: "জীবননগর" },
  ]},
  { slug: "meherpur", en: "Meherpur", bn: "মেহেরপুর", upazilas: [
    { en: "Gangni", bn: "গাংনী" }, { en: "Mujibnagar", bn: "মুজিবনগর" },
  ]},
  { slug: "barishal", en: "Barishal", bn: "বরিশাল", upazilas: [
    { en: "Agailjhara", bn: "আগৈলঝাড়া" }, { en: "Babuganj", bn: "বাবুগঞ্জ" }, { en: "Bakerganj", bn: "বাকেরগঞ্জ" },
    { en: "Banaripara", bn: "বানারীপাড়া" }, { en: "Gaurnadi", bn: "গৌরনদী" }, { en: "Hizla", bn: "হিজলা" },
    { en: "Mehendiganj", bn: "মেহেন্দিগঞ্জ" }, { en: "Muladi", bn: "মুলাদী" }, { en: "Wazirpur", bn: "উজিরপুর" },
  ]},
  { slug: "bhola", en: "Bhola", bn: "ভোলা", upazilas: [
    { en: "Burhanuddin", bn: "বুরহানউদ্দিন" }, { en: "Char Fasson", bn: "চরফ্যাশন" }, { en: "Daulatkhan", bn: "দৌলতখান" },
    { en: "Lalmohan", bn: "লালমোহন" }, { en: "Manpura", bn: "মনপুরা" }, { en: "Tazumuddin", bn: "তজুমদ্দিন" },
  ]},
  { slug: "patuakhali", en: "Patuakhali", bn: "পটুয়াখালী", upazilas: [
    { en: "Bauphal", bn: "বাউফল" }, { en: "Dashmina", bn: "দশমিনা" }, { en: "Galachipa", bn: "গলাচিপা" },
    { en: "Kalapara", bn: "কলাপাড়া" }, { en: "Mirzaganj", bn: "মির্জাগঞ্জ" }, { en: "Rangabali", bn: "রাঙ্গাবালী" },
    { en: "Dumki", bn: "দুমকি" },
  ]},
  { slug: "pirojpur", en: "Pirojpur", bn: "পিরোজপুর", upazilas: [
    { en: "Bhandaria", bn: "ভাণ্ডারিয়া" }, { en: "Kawkhali", bn: "কাউখালী" }, { en: "Mathbaria", bn: "মঠবাড়িয়া" },
    { en: "Nazirpur", bn: "নাজিরপুর" }, { en: "Nesarabad", bn: "নেছারাবাদ" }, { en: "Indurkani", bn: "ইন্দুরকানী" },
  ]},
  { slug: "barguna", en: "Barguna", bn: "বরগুনা", upazilas: [
    { en: "Amtali", bn: "আমতলী" }, { en: "Bamna", bn: "বামনা" }, { en: "Betagi", bn: "বেতাগী" },
    { en: "Patharghata", bn: "পাথরঘাটা" }, { en: "Taltali", bn: "তালতলী" },
  ]},
  { slug: "jhalokati", en: "Jhalokati", bn: "ঝালকাঠি", upazilas: [
    { en: "Kathalia", bn: "কাঠালিয়া" }, { en: "Nalchity", bn: "নলছিটি" }, { en: "Rajapur", bn: "রাজাপুর" },
  ]},
  { slug: "sylhet", en: "Sylhet", bn: "সিলেট", upazilas: [
    { en: "Balaganj", bn: "বালাগঞ্জ" }, { en: "Beanibazar", bn: "বিয়ানীবাজার" }, { en: "Bishwanath", bn: "বিশ্বনাথ" },
    { en: "Companiganj", bn: "কোম্পানীগঞ্জ" }, { en: "Fenchuganj", bn: "ফেঞ্চুগঞ্জ" }, { en: "Golapganj", bn: "গোলাপগঞ্জ" },
    { en: "Gowainghat", bn: "গোয়াইনঘাট" }, { en: "Jaintiapur", bn: "জৈন্তাপুর" }, { en: "Kanaighat", bn: "কানাইঘাট" },
    { en: "Zakiganj", bn: "জকিগঞ্জ" }, { en: "Dakshin Surma", bn: "দক্ষিণ সুরমা" },
  ]},
  { slug: "moulvibazar", en: "Moulvibazar", bn: "মৌলভীবাজার", upazilas: [
    { en: "Barlekha", bn: "বড়লেখা" }, { en: "Juri", bn: "জুড়ী" }, { en: "Kamalganj", bn: "কমলগঞ্জ" },
    { en: "Kulaura", bn: "কুলাউড়া" }, { en: "Rajnagar", bn: "রাজনগর" }, { en: "Sreemangal", bn: "শ্রীমঙ্গল" },
  ]},
  { slug: "habiganj", en: "Habiganj", bn: "হবিগঞ্জ", upazilas: [
    { en: "Ajmiriganj", bn: "আজমিরীগঞ্জ" }, { en: "Bahubal", bn: "বাহুবল" }, { en: "Baniyachong", bn: "বানিয়াচং" },
    { en: "Chunarughat", bn: "চুনারুঘাট" }, { en: "Lakhai", bn: "লাখাই" }, { en: "Madhabpur", bn: "মাধবপুর" },
    { en: "Nabiganj", bn: "নবীগঞ্জ" }, { en: "Sayestaganj", bn: "শায়েস্তাগঞ্জ" },
  ]},
  { slug: "sunamganj", en: "Sunamganj", bn: "সুনামগঞ্জ", upazilas: [
    { en: "Bishwamvarpur", bn: "বিশ্বম্ভরপুর" }, { en: "Chhatak", bn: "ছাতক" }, { en: "Derai", bn: "দিরাই" },
    { en: "Dharampasha", bn: "ধর্মপাশা" }, { en: "Dowarabazar", bn: "দোয়ারাবাজার" }, { en: "Jagannathpur", bn: "জগন্নাথপুর" },
    { en: "Jamalganj", bn: "জামালগঞ্জ" }, { en: "Sullah", bn: "শাল্লা" }, { en: "Tahirpur", bn: "তাহিরপুর" },
  ]},
  { slug: "rangpur", en: "Rangpur", bn: "রংপুর", upazilas: [
    { en: "Badarganj", bn: "বদরগঞ্জ" }, { en: "Gangachara", bn: "গঙ্গাচড়া" }, { en: "Kaunia", bn: "কাউনিয়া" },
    { en: "Mithapukur", bn: "মিঠাপুকুর" }, { en: "Pirgachha", bn: "পীরগাছা" }, { en: "Pirganj", bn: "পীরগঞ্জ" },
    { en: "Taraganj", bn: "তারাগঞ্জ" },
  ]},
  { slug: "dinajpur", en: "Dinajpur", bn: "দিনাজপুর", upazilas: [
    { en: "Birampur", bn: "বিরামপুর" }, { en: "Birganj", bn: "বীরগঞ্জ" }, { en: "Biral", bn: "বিরল" },
    { en: "Bochaganj", bn: "বোচাগঞ্জ" }, { en: "Chirirbandar", bn: "চিরিরবন্দর" }, { en: "Fulbari", bn: "ফুলবাড়ী" },
    { en: "Ghoraghat", bn: "ঘোড়াঘাট" }, { en: "Hakimpur", bn: "হাকিমপুর" }, { en: "Kaharole", bn: "কাহারোল" },
    { en: "Khansama", bn: "খানসামা" }, { en: "Nawabganj", bn: "নবাবগঞ্জ" }, { en: "Parbatipur", bn: "পার্বতীপুর" },
  ]},
  { slug: "nilphamari", en: "Nilphamari", bn: "নীলফামারী", upazilas: [
    { en: "Dimla", bn: "ডিমলা" }, { en: "Domar", bn: "ডোমার" }, { en: "Jaldhaka", bn: "জলঢাকা" },
    { en: "Kishoreganj", bn: "কিশোরগঞ্জ" }, { en: "Saidpur", bn: "সৈয়দপুর" },
  ]},
  { slug: "gaibandha", en: "Gaibandha", bn: "গাইবান্ধা", upazilas: [
    { en: "Fulchhari", bn: "ফুলছড়ি" }, { en: "Gobindaganj", bn: "গোবিন্দগঞ্জ" }, { en: "Palashbari", bn: "পলাশবাড়ী" },
    { en: "Sadullapur", bn: "সাদুল্লাপুর" }, { en: "Saghata", bn: "সাঘাটা" }, { en: "Sundarganj", bn: "সুন্দরগঞ্জ" },
  ]},
  { slug: "kurigram", en: "Kurigram", bn: "কুড়িগ্রাম", upazilas: [
    { en: "Bhurungamari", bn: "ভুরুঙ্গামারী" }, { en: "Char Rajibpur", bn: "চর রাজিবপুর" }, { en: "Chilmari", bn: "চিলমারী" },
    { en: "Phulbari", bn: "ফুলবাড়ী" }, { en: "Nageshwari", bn: "নাগেশ্বরী" }, { en: "Rajarhat", bn: "রাজারহাট" },
    { en: "Raumari", bn: "রৌমারী" }, { en: "Ulipur", bn: "উলিপুর" },
  ]},
  { slug: "lalmonirhat", en: "Lalmonirhat", bn: "লালমনিরহাট", upazilas: [
    { en: "Aditmari", bn: "আদিতমারী" }, { en: "Hatibandha", bn: "হাতীবান্ধা" }, { en: "Kaliganj", bn: "কালীগঞ্জ" },
    { en: "Patgram", bn: "পাটগ্রাম" },
  ]},
  { slug: "thakurgaon", en: "Thakurgaon", bn: "ঠাকুরগাঁও", upazilas: [
    { en: "Baliadangi", bn: "বালিয়াডাঙ্গী" }, { en: "Haripur", bn: "হরিপুর" }, { en: "Pirganj", bn: "পীরগঞ্জ" },
    { en: "Ranisankail", bn: "রাণীশংকৈল" },
  ]},
  { slug: "panchagarh", en: "Panchagarh", bn: "পঞ্চগড়", upazilas: [
    { en: "Atwari", bn: "আটোয়ারী" }, { en: "Boda", bn: "বোদা" }, { en: "Debiganj", bn: "দেবীগঞ্জ" },
    { en: "Tetulia", bn: "তেঁতুলিয়া" },
  ]},
  { slug: "mymensingh", en: "Mymensingh", bn: "ময়মনসিংহ", upazilas: [
    { en: "Bhaluka", bn: "ভালুকা" }, { en: "Dhobaura", bn: "ধোবাউড়া" }, { en: "Fulbaria", bn: "ফুলবাড়িয়া" },
    { en: "Gaffargaon", bn: "গফরগাঁও" }, { en: "Gauripur", bn: "গৌরীপুর" }, { en: "Haluaghat", bn: "হালুয়াঘাট" },
    { en: "Ishwarganj", bn: "ঈশ্বরগঞ্জ" }, { en: "Muktagachha", bn: "মুক্তাগাছা" }, { en: "Nandail", bn: "নান্দাইল" },
    { en: "Phulpur", bn: "ফুলপুর" }, { en: "Trishal", bn: "ত্রিশাল" },
  ]},
  { slug: "jamalpur", en: "Jamalpur", bn: "জামালপুর", upazilas: [
    { en: "Bakshiganj", bn: "বকশীগঞ্জ" }, { en: "Dewanganj", bn: "দেওয়ানগঞ্জ" }, { en: "Islampur", bn: "ইসলামপুর" },
    { en: "Madarganj", bn: "মাদারগঞ্জ" }, { en: "Melandaha", bn: "মেলান্দহ" }, { en: "Sarishabari", bn: "সরিষাবাড়ী" },
  ]},
  { slug: "sherpur", en: "Sherpur", bn: "শেরপুর", upazilas: [
    { en: "Jhenaigati", bn: "ঝিনাইগাতী" }, { en: "Nakla", bn: "নকলা" }, { en: "Nalitabari", bn: "নালিতাবাড়ী" },
    { en: "Sreebardi", bn: "শ্রীবরদী" },
  ]},
  { slug: "netrokona", en: "Netrokona", bn: "নেত্রকোণা", upazilas: [
    { en: "Atpara", bn: "আটপাড়া" }, { en: "Barhatta", bn: "বারহাট্টা" }, { en: "Durgapur", bn: "দুর্গাপুর" },
    { en: "Kalmakanda", bn: "কলমাকান্দা" }, { en: "Kendua", bn: "কেন্দুয়া" }, { en: "Khaliajuri", bn: "খালিয়াজুরী" },
    { en: "Madan", bn: "মদন" }, { en: "Mohanganj", bn: "মোহনগঞ্জ" }, { en: "Purbadhala", bn: "পূর্বধলা" },
  ]},
];

const CHAINS: { slug: string; en: string; bn: string; type: "diagnostic" | "clinic" }[] = [
  { slug: "popular-dx", en: "Popular Diagnostic Centre", bn: "পপুলার ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "ibn-sina-dx", en: "Ibn Sina Diagnostic & Consultation Center", bn: "ইবনে সিনা ডায়াগনস্টিক ও কনসালটেশন সেন্টার", type: "diagnostic" },
  { slug: "labaid-dx", en: "Labaid Diagnostic", bn: "ল্যাবএইড ডায়াগনস্টিক", type: "diagnostic" },
  { slug: "ideal-dx", en: "Ideal Diagnostic Centre", bn: "আইডিয়াল ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "padma-dx", en: "Padma Diagnostic Centre", bn: "পদ্মা ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "medinova-dx", en: "Medinova Medical Services", bn: "মেডিনোভা মেডিকেল সার্ভিসেস", type: "diagnostic" },
  { slug: "chevron-dx", en: "Chevron Clinical Laboratory", bn: "শেভরন ক্লিনিক্যাল ল্যাবরেটরি", type: "diagnostic" },
  { slug: "healthcare-dx", en: "Health Care Diagnostic Center", bn: "হেলথ কেয়ার ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "comfort-dx", en: "Comfort Diagnostic Centre", bn: "কমফোর্ট ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "quest-dx", en: "Quest Diagnostics / Lab", bn: "কোয়েস্ট ডায়াগনস্টিক ল্যাব", type: "diagnostic" },
  { slug: "thyrocare-dx", en: "Thyrocare Bangladesh", bn: "থাইরোকেয়ার বাংলাদেশ", type: "diagnostic" },
  { slug: "doctors-lab", en: "Doctors Lab & Hospital Diagnostic", bn: "ডাক্তারস ল্যাব ডায়াগনস্টিক", type: "diagnostic" },
  { slug: "city-scan", en: "City Scan & Imaging Center", bn: "সিটি স্ক্যান ও ইমেজিং সেন্টার", type: "diagnostic" },
  { slug: "modern-dx", en: "Modern Diagnostic Centre", bn: "মডার্ন ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "life-care-dx", en: "Life Care Diagnostic Centre", bn: "লাইফ কেয়ার ডায়াগনস্টিক সেন্টার", type: "diagnostic" },
  { slug: "united-dx", en: "United Diagnostic Services", bn: "ইউনাইটেড ডায়াগনস্টিক সার্ভিসেস", type: "diagnostic" },
  { slug: "prime-clinic", en: "Prime Medical Clinic", bn: "প্রাইম মেডিকেল ক্লিনিক", type: "clinic" },
  { slug: "care-clinic", en: "Care Medical Clinic", bn: "কেয়ার মেডিকেল ক্লিনিক", type: "clinic" },
  { slug: "city-clinic", en: "City General Clinic", bn: "সিটি জেনারেল ক্লিনিক", type: "clinic" },
  { slug: "family-clinic", en: "Family Care Clinic", bn: "ফ্যামিলি কেয়ার ক্লিনিক", type: "clinic" },
  { slug: "eye-care", en: "Eye Care Hospital & Clinic", bn: "আই কেয়ার হাসপাতাল ও ক্লিনিক", type: "clinic" },
  { slug: "dental-care", en: "Dental Care Centre", bn: "ডেন্টাল কেয়ার সেন্টার", type: "clinic" },
  { slug: "skin-care", en: "Skin & Laser Clinic", bn: "স্কিন অ্যান্ড লেজার ক্লিনিক", type: "clinic" },
  { slug: "ent-clinic", en: "ENT Care Clinic", bn: "ইএনটি কেয়ার ক্লিনিক", type: "clinic" },
  { slug: "diabetes-clinic", en: "Diabetes & Hormone Clinic", bn: "ডায়াবেটিস ও হরমোন ক্লিনিক", type: "clinic" },
  { slug: "child-clinic", en: "Child Care / Pediatric Clinic", bn: "চাইল্ড কেয়ার / পেডিয়াট্রিক ক্লিনিক", type: "clinic" },
  { slug: "women-clinic", en: "Women & Child Clinic", bn: "উইমেন অ্যান্ড চাইল্ড ক্লিনিক", type: "clinic" },
  { slug: "physio-clinic", en: "Physiotherapy & Rehab Clinic", bn: "ফিজিওথেরাপি ও রিহ্যাব ক্লিনিক", type: "clinic" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Generate clinics, diagnostics, community clinics & upazila health complexes */
export function generateClinicsAndDiagnostics(): FacilitySeed[] {
  const out: FacilitySeed[] = [];

  for (const d of D) {
    const sadarName = `${d.en} Sadar`;
    const upazilas = withDistrictSadar(d, d.upazilas);

    // District HQ facilities → Sadar upazila
    const sadarFacilities: Omit<FacilitySeed, "districtSlug">[] = [
      {
        type: "government",
        slug: `${d.slug}-community-clinic-sadar`,
        name_en: `${d.en} Sadar Community Clinic`,
        name_bn: `${d.bn} সদর কমিউনিটি ক্লিনিক`,
      },
      {
        type: "government",
        slug: `${d.slug}-mcwc`,
        name_en: `${d.en} Mother & Child Welfare Centre (MCWC)`,
        name_bn: `${d.bn} মা ও শিশু কল্যাণ কেন্দ্র`,
      },
      {
        type: "diagnostic",
        slug: `${d.slug}-district-dx`,
        name_en: `${d.en} District Diagnostic Centre`,
        name_bn: `${d.bn} জেলা ডায়াগনস্টিক সেন্টার`,
      },
      {
        type: "clinic",
        slug: `${d.slug}-central-clinic`,
        name_en: `${d.en} Central Medical Clinic`,
        name_bn: `${d.bn} সেন্ট্রাল মেডিকেল ক্লিনিক`,
      },
      {
        type: "clinic",
        slug: `${d.slug}-sadar-pathology`,
        name_en: `${d.en} Sadar Pathology Lab`,
        name_bn: `${d.bn} সদর প্যাথলজি ল্যাব`,
      },
      {
        type: "clinic",
        slug: `${d.slug}-blood-bank-clinic`,
        name_en: `${d.en} Local Blood Bank / Transfusion Centre`,
        name_bn: `${d.bn} স্থানীয় ব্লাড ব্যাংক / ট্রান্সফিউশন সেন্টার`,
      },
    ];
    for (const f of sadarFacilities) {
      out.push({ ...f, districtSlug: d.slug, upazila: sadarName });
    }

    for (const c of CHAINS) {
      out.push({
        districtSlug: d.slug,
        type: c.type,
        slug: `${d.slug}-${c.slug}`,
        name_en: `${c.en} — ${d.en}`,
        name_bn: `${c.bn} — ${d.bn}`,
        upazila: sadarName,
      });
    }

    // Every upazila (including Sadar): UHC, community clinic, diagnostic, clinic, dental, private
    for (const u of upazilas) {
      const us = slugify(u.en);
      const items: FacilitySeed[] = [
        {
          districtSlug: d.slug,
          type: "government",
          slug: `${d.slug}-uhc-${us}`,
          name_en: `${u.en} Upazila Health Complex`,
          name_bn: `${u.bn} উপজেলা স্বাস্থ্য কমপ্লেক্স`,
          upazila: u.en,
        },
        {
          districtSlug: d.slug,
          type: "government",
          slug: `${d.slug}-cc-${us}`,
          name_en: `${u.en} Community Clinic`,
          name_bn: `${u.bn} কমিউনিটি ক্লিনিক`,
          upazila: u.en,
        },
        {
          districtSlug: d.slug,
          type: "diagnostic",
          slug: `${d.slug}-dx-${us}`,
          name_en: `${u.en} Diagnostic Centre`,
          name_bn: `${u.bn} ডায়াগনস্টিক সেন্টার`,
          upazila: u.en,
        },
        {
          districtSlug: d.slug,
          type: "clinic",
          slug: `${d.slug}-clinic-${us}`,
          name_en: `${u.en} Medical Clinic & Pathology`,
          name_bn: `${u.bn} মেডিকেল ক্লিনিক ও প্যাথলজি`,
          upazila: u.en,
        },
        {
          districtSlug: d.slug,
          type: "clinic",
          slug: `${d.slug}-dental-${us}`,
          name_en: `${u.en} Dental Clinic`,
          name_bn: `${u.bn} ডেন্টাল ক্লিনিক`,
          upazila: u.en,
        },
        {
          districtSlug: d.slug,
          type: "private",
          slug: `${d.slug}-private-${us}`,
          name_en: `${u.en} Private Hospital & Diagnostic`,
          name_bn: `${u.bn} প্রাইভেট হাসপাতাল ও ডায়াগনস্টিক`,
          upazila: u.en,
        },
      ];
      out.push(...items);
    }
  }

  // Extra well-known Dhaka city diagnostics / clinics (city → Dhaka Sadar)
  const dhakaSadar = "Dhaka Sadar";
  const dhakaExtra: FacilitySeed[] = [
    { districtSlug: "dhaka", type: "diagnostic", slug: "popular-dhanmondi", name_en: "Popular Diagnostic — Dhanmondi", name_bn: "পপুলার ডায়াগনস্টিক — ধানমন্ডি", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "popular-mirpur", name_en: "Popular Diagnostic — Mirpur", name_bn: "পপুলার ডায়াগনস্টিক — মিরপুর", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "popular-uttara", name_en: "Popular Diagnostic — Uttara", name_bn: "পপুলার ডায়াগনস্টিক — উত্তরা", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "popular-badda", name_en: "Popular Diagnostic — Badda", name_bn: "পপুলার ডায়াগনস্টিক — বাড্ডা", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "labaid-dhanmondi", name_en: "Labaid Diagnostic — Dhanmondi", name_bn: "ল্যাবএইড ডায়াগনস্টিক — ধানমন্ডি", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "labaid-gulshan", name_en: "Labaid Diagnostic — Gulshan", name_bn: "ল্যাবএইড ডায়াগনস্টিক — গুলশান", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "ibn-sina-dhanmondi", name_en: "Ibn Sina Diagnostic — Dhanmondi", name_bn: "ইবনে সিনা ডায়াগনস্টিক — ধানমন্ডি", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "ibn-sina-lalmatia", name_en: "Ibn Sina Diagnostic — Lalmatia", name_bn: "ইবনে সিনা ডায়াগনস্টিক — লালমাটিয়া", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "clinic", slug: "japan-bangladesh-clinic", name_en: "Japan-Bangladesh Friendship Medical Clinic", name_bn: "জাপান-বাংলাদেশ ফ্রেন্ডশিপ মেডিকেল ক্লিনিক", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "clinic", slug: "icddr-b-clinic", name_en: "icddr,b Travellers Clinic", name_bn: "আইসিডিডিআর,বি ট্রাভেলার্স ক্লিনিক", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "lab-aid-uttara", name_en: "Labaid Limited — Uttara", name_bn: "ল্যাবএইড — উত্তরা", upazila: dhakaSadar },
    { districtSlug: "dhaka", type: "diagnostic", slug: "anower-khan-dx", name_en: "Anwer Khan Modern Diagnostic", name_bn: "আনোয়ার খান মডার্ন ডায়াগনস্টিক", upazila: dhakaSadar },
  ];

  return [...out, ...dhakaExtra];
}
