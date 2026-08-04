export type SeoGuideSection = {
  title: string;
  body: string[];
  bullets?: string[];
};

export type SeoGuideContent = {
  title: string;
  intro: string;
  checklist: string[];
  sections: SeoGuideSection[];
};

export const SEO_GUIDE_BN: SeoGuideContent = {
  title: "BloodLink SEO সম্পূর্ণ গাইড",
  intro:
    "এই গাইড আপনাকে Admin → Settings → SEO থেকে সাইটের সার্চ ইঞ্জিন অপ্টিমাইজেশন সেটআপ করতে সাহায্য করবে। সঠিক SEO-তে Google/Bing-এ BloodLink খুঁজে পাওয়া সহজ হয় এবং Facebook/WhatsApp শেয়ারে সুন্দর প্রিভিউ দেখায়।",
  checklist: [
    "Site URL নিশ্চিত করুন: https://blood.pgdiary.cloud",
    "Title ও Description BN/EN লিখুন — ৫৫–৬০ অক্ষরের title, ১৫০–১৬০ অক্ষরের description",
    "OG image আপলোড করুন (১২০০×৬৩০ px, JPG/PNG)",
    "Google Search Console-এ সাইট যোগ করুন ও verification code দিন",
    "Sitemap submit করুন: https://blood.pgdiary.cloud/sitemap.xml",
    "robots.txt চেক করুন: https://blood.pgdiary.cloud/robots.txt",
    "Facebook/WhatsApp-এ লিংক শেয়ার করে OG preview দেখুন",
  ],
  sections: [
    {
      title: "১. Site URL ও Canonical",
      body: [
        "Site URL আপনার লাইভ ডোমেইন। Canonical URL খালি রাখলে হোমপেজ (/ ) canonical হিসেবে ব্যবহার হবে।",
        "একই কনটেন্ট একাধিক URL-এ থাকলে canonical duplicate SEO সমস্যা কমায়।",
      ],
    },
    {
      title: "২. Title ও Description",
      body: [
        "Title সার্চ রেজাল্টে নীল লিংক হিসেবে দেখায়। BloodLink-এর জন্য রক্তদান, জরুরি রক্ত, বাংলাদেশ — এসব কীওয়ার্ড প্রাকৃতিকভাবে রাখুন।",
        "Description সার্চ স্নিপেটে দেখায়; ক্লিক বাড়াতে স্পষ্ট CTA দিন (যেমন: 'রক্তদাতা খুঁজুন')।",
      ],
      bullets: [
        "Title BN: বাংলা ইউজারদের জন্য",
        "Title EN: ইংরেজি সার্চের জন্য",
        "Keywords: কমা দিয়ে আলাদা — overstuffing করবেন না",
      ],
    },
    {
      title: "৩. Open Graph (Facebook/WhatsApp)",
      body: [
        "OG title/description/image সোশ্যাল শেয়ার প্রিভিউ নিয়ন্ত্রণ করে।",
        "OG image খালি থাকলে /icon-512.png ব্যবহার হবে; তবে 1200×630 বANNER-style image ভালো ফল দেয়।",
      ],
      bullets: ["og:type সাধারণত website", "Image URL absolute হলে ভালো (https://...)"],
    },
    {
      title: "৪. Twitter Card",
      body: [
        "summary_large_image বড় ইমেজ সহ কার্ড দেখায় — BloodLink-এর জন্য recommended।",
        "Twitter fields খালি থাকলে OG values fallback হিসেবে ব্যবহার হবে।",
      ],
    },
    {
      title: "৫. Robots ও Indexing",
      body: [
        "robots_index + robots_follow চালু থাকলে Google পেজ crawl/index করতে পারবে।",
        "Maintenance বা staging সাইটে noindex/nofollow ব্যবহার করুন।",
        "Custom robots.txt textarea দিয়ে advanced rule লিখতে পারেন; খালি থাকলে default ব্যবহার হবে।",
      ],
    },
    {
      title: "৬. Google Search Console",
      body: [
        "https://search.google.com/search-console এ যান এবং Google account দিয়ে লগইন করুন।",
        "‘Add property’ চাপুন এবং URL prefix হিসেবে https://blood.pgdiary.cloud দিন।",
        'Verification methods থেকে ‘HTML tag’ বেছে নিন। Google আপনাকে এমন একটি meta tag দেবে: <meta name="google-site-verification" content="abc123..." />',
        'ওই tag-এর শুধু content="..." এর ভেতরের value কপি করুন। যেমন abc123... অংশটুকু।',
        "Admin → Settings → SEO → Google Site Verification field-এ ওই copied value paste করুন এবং Save চাপুন।",
        "তারপর Search Console-এ ফিরে Verify চাপুন।",
        "Verify সফল হলে বাঁদিকের Sitemaps মেনুতে গিয়ে https://blood.pgdiary.cloud/sitemap.xml submit করুন।",
      ],
    },
    {
      title: "৭. Bing Webmaster",
      body: [
        "https://www.bing.com/webmasters — Bing Site Verification code দিন।",
        "Google-এর মতো sitemap submit করুন।",
      ],
    },
    {
      title: "৮. JSON-LD Structured Data",
      body: [
        "Organization schema Google-কে BloodLink কী তা বোঝায় — logo, phone, social links দিন।",
        "Rich results test: https://search.google.com/test/rich-results",
      ],
    },
    {
      title: "৯. Sitemap",
      body: [
        "/sitemap.xml অটো জেনারেট হয় — /, /auth এবং Extra paths অন্তর্ভুক্ত।",
        "নতুন পাবলিক পেজ যোগ করলে Sitemap extra paths-এ path দিন (যেমন /about)।",
      ],
    },
    {
      title: "১০. বাংলাদেশ-নির্দিষ্ট টিপস",
      body: [
        "স্থানীয় কীওয়ার্ড: রক্তদান, রক্তদাতা, জরুরি রক্ত, [জেলার নাম] + রক্তদাতা।",
        "BN primary রাখুন; EN duplicate content নয় — ভাষা অনুযায়ী আলাদা title/description।",
        "Hotline/হেল্পলাইন org_phone-এ দিলে trust signal বাড়ে।",
      ],
    },
    {
      title: "সাধারণ ভুল",
      body: [],
      bullets: [
        "Site URL http/https mismatch",
        "OG image খুব ছোট বা broken URL",
        "Title একই শব্দ বারবার (keyword stuffing)",
        "Staging সাইট indexable রাখা",
        "Sitemap submit না করা",
      ],
    },
  ],
};

export const SEO_GUIDE_EN: SeoGuideContent = {
  title: "BloodLink Complete SEO Guide",
  intro:
    "Use Admin → Settings → SEO to configure search and social previews. Good SEO helps people find BloodLink on Google/Bing and improves link shares on Facebook/WhatsApp.",
  checklist: [
    "Confirm Site URL: https://blood.pgdiary.cloud",
    "Write BN/EN titles (~55–60 chars) and descriptions (~150–160 chars)",
    "Upload OG image (1200×630 px recommended)",
    "Add site in Google Search Console and paste verification code",
    "Submit sitemap: https://blood.pgdiary.cloud/sitemap.xml",
    "Verify robots.txt: https://blood.pgdiary.cloud/robots.txt",
    "Share homepage link on Facebook/WhatsApp to preview OG card",
  ],
  sections: [
    {
      title: "1. Site URL & Canonical",
      body: [
        "Site URL is your live domain. Leave Canonical empty to use homepage (/) as default.",
        "Canonical URLs reduce duplicate-content issues when the same page has multiple URLs.",
      ],
    },
    {
      title: "2. Title & Description",
      body: [
        "Title appears as the blue link in search results. Use natural keywords: blood donation, urgent blood, Bangladesh.",
        "Description is the snippet below the title — include a clear call to action.",
      ],
      bullets: [
        "Title BN for Bangla users",
        "Title EN for English searches",
        "Keywords: comma-separated, avoid stuffing",
      ],
    },
    {
      title: "3. Open Graph",
      body: [
        "OG fields control Facebook/WhatsApp share previews.",
        "Default OG image is /icon-512.png; a 1200×630 banner performs better.",
      ],
    },
    {
      title: "4. Twitter Card",
      body: [
        "summary_large_image shows a large image card — recommended for BloodLink.",
        "Empty Twitter fields fall back to OG values.",
      ],
    },
    {
      title: "5. Robots & Indexing",
      body: [
        "Keep robots_index and robots_follow enabled for production.",
        "Use noindex on staging or maintenance sites.",
        "Custom robots.txt overrides the default when filled in.",
      ],
    },
    {
      title: "6. Google Search Console",
      body: [
        "Open https://search.google.com/search-console and sign in with your Google account.",
        "Click 'Add property' and use URL prefix: https://blood.pgdiary.cloud",
        'Choose the \'HTML tag\' verification method. Google will show a tag like: <meta name="google-site-verification" content="abc123..." />',
        'Copy only the value inside content="...". For example, copy abc123... only.',
        "Paste that value into Admin → Settings → SEO → Google Site Verification and click Save.",
        "Go back to Search Console and click Verify.",
        "After verification, submit https://blood.pgdiary.cloud/sitemap.xml under the Sitemaps section.",
      ],
    },
    {
      title: "7. Bing Webmaster Tools",
      body: ["Verify at https://www.bing.com/webmasters", "Submit the same sitemap URL."],
    },
    {
      title: "8. JSON-LD",
      body: [
        "Organization schema tells search engines about BloodLink — logo, phone, social profiles.",
        "Test with Google Rich Results Test.",
      ],
    },
    {
      title: "9. Sitemap",
      body: [
        "/sitemap.xml is generated automatically with /, /auth, and extra paths.",
        "Add new public pages under Sitemap extra paths.",
      ],
    },
    {
      title: "10. Bangladesh-specific tips",
      body: [
        "Local keywords: blood donor, emergency blood, district + donor.",
        "BN and EN titles should differ by language, not duplicate content.",
        "Add hotline in org_phone for trust signals.",
      ],
    },
    {
      title: "Common mistakes",
      body: [],
      bullets: [
        "Wrong http/https in Site URL",
        "Broken or tiny OG image",
        "Keyword-stuffed titles",
        "Leaving staging site indexable",
        "Forgetting sitemap submission",
      ],
    },
  ],
};
