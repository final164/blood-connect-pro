const shell = "mx-auto w-full max-w-5xl md:max-w-6xl px-4 sm:px-5";

const GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const PLACES = [
  { bn: "ঢাকা", en: "Dhaka" },
  { bn: "চট্টগ্রাম", en: "Chattogram" },
  { bn: "সিলেট", en: "Sylhet" },
  { bn: "রাজশাহী", en: "Rajshahi" },
  { bn: "খুলনা", en: "Khulna" },
  { bn: "বরিশাল", en: "Barishal" },
  { bn: "রংপুর", en: "Rangpur" },
  { bn: "ময়মনসিংহ", en: "Mymensingh" },
];

/**
 * Crawlable search topics in the first HTML response.
 * Google ranks pages it can read; this is real copy, not a hidden keyword list.
 */
export function LandingDiscover({ lang }: { lang: "bn" | "en" }) {
  const bn = lang === "bn";
  return (
    <section id="find-blood" className={`${shell} py-8 sm:py-10`} aria-labelledby="find-blood-heading">
      <h2 id="find-blood-heading" className="text-lg sm:text-xl font-bold landing-brand">
        {bn
          ? "বাংলাদেশে রক্তদাতা খুঁজুন — স্পন্দন"
          : "Find a blood donor in Bangladesh — Spandon"}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
        {bn
          ? "জরুরি রক্ত লাগলে স্পন্দনে ব্লাড ডোনার খুঁজুন। ঢাকা, চট্টগ্রামসহ ৬৪ জেলায় A+ B+ O+ AB+ এবং বিরল O- রক্তদাতা। রিকোয়েস্ট বিনামূল্যে, হাসপাতালের নাম দিয়ে পোস্ট করুন।"
          : "Need blood urgently? Search voluntary donors on Spandon across all 64 districts of Bangladesh, including rare O- and common A+, B+, O+, AB+ groups. Post a hospital request for free."}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <li
            key={g}
            className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold"
          >
            {bn ? `${g} রক্তদাতা` : `${g} donor`}
          </li>
        ))}
      </ul>
      <h3 className="mt-6 text-sm font-semibold">
        {bn ? "বিভাগ অনুযায়ী রক্তদান" : "Blood donation by division"}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {PLACES.map((p) => (
          <li key={p.en} className="text-xs" style={{ color: "var(--landing-muted)" }}>
            {bn ? `${p.bn} রক্তদাতা` : `${p.en} blood donor`}
          </li>
        ))}
      </ul>
    </section>
  );
}
