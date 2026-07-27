import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCmsStrings } from "@/lib/api";

export type Lang = "bn" | "en";

/** Fallback only — live copy comes from cms_strings (Admin → CMS) */
const fallback: Record<string, { bn: string; en: string }> = {
  appName: { bn: "BloodLink", en: "BloodLink" },
  tagline: { bn: "রক্তদানে জীবন বাঁচান", en: "Save lives by donating blood" },
  login: { bn: "লগইন", en: "Log in" },
  signup: { bn: "সাইনআপ", en: "Sign up" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  fullName: { bn: "পুরো নাম", en: "Full name" },
  createAccount: { bn: "অ্যাকাউন্ট তৈরি", en: "Create account" },
  feed: { bn: "ফিড", en: "Feed" },
  requests: { bn: "রিকোয়েস্ট", en: "Requests" },
  community: { bn: "কমিউনিটি", en: "Community" },
  chat: { bn: "চ্যাট", en: "Chat" },
  profile: { bn: "প্রোফাইল", en: "Profile" },
  settings: { bn: "সেটিংস", en: "Settings" },
  district: { bn: "জেলা", en: "District" },
  searchDistrict: { bn: "জেলা খুঁজুন…", en: "Search district…" },
  confirmPassword: { bn: "পাসওয়ার্ড নিশ্চিত করুন", en: "Confirm password" },
  adminLogin: { bn: "অ্যাডমিন লগইন", en: "Admin login" },
  adminPanel: { bn: "অ্যাডমিন প্যানেল", en: "Admin panel" },
  post: { bn: "পোস্ট", en: "Post" },
  send: { bn: "পাঠান", en: "Send" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  save: { bn: "সেভ", en: "Save" },
  logout: { bn: "লগআউট", en: "Log out" },
  createRequest: { bn: "নতুন রিকোয়েস্ট", en: "New request" },
  respond: { bn: "সাড়া দিন", en: "Respond" },
  patientName: { bn: "রোগীর নাম", en: "Patient name" },
  bloodGroup: { bn: "রক্তের গ্রুপ", en: "Blood group" },
  bagsNeeded: { bn: "ব্যাগ প্রয়োজন", en: "Bags needed" },
  hospital: { bn: "হাসপাতাল", en: "Hospital" },
  contact: { bn: "যোগাযোগ", en: "Contact" },
  neededBy: { bn: "কতক্ষণে দরকার", en: "Needed by" },
  urgency: { bn: "জরুরিতা", en: "Urgency" },
  notes: { bn: "নোট", en: "Notes" },
  normal: { bn: "সাধারণ", en: "Normal" },
  urgent: { bn: "জরুরি", en: "Urgent" },
  critical: { bn: "সংকটাপন্ন", en: "Critical" },
  bio: { bn: "সংক্ষেপ পরিচয়", en: "Bio" },
  phone: { bn: "ফোন", en: "Phone" },
  available: { bn: "উপলব্ধ", en: "Available" },
  lastDonation: { bn: "সর্বশেষ দান", en: "Last donation" },
  totalDonations: { bn: "মোট দান", en: "Donations" },
  livesSaved: { bn: "বাঁচানো জীবন", en: "Lives saved" },
  language: { bn: "ভাষা", en: "Language" },
  theme: { bn: "থিম", en: "Theme" },
  share: { bn: "শেয়ার", en: "Share" },
  notifications: { bn: "নোটিফ", en: "Alerts" },
  markAllRead: { bn: "সব পড়া", en: "Mark all read" },
  emptyNotifications: { bn: "কোনো নোটিফিকেশন নেই", en: "No notifications yet" },
  emptyRequests: { bn: "সক্রিয় রিকোয়েস্ট নেই", en: "No active requests" },
  emptyChat: { bn: "কোনো কনভারসেশন নেই", en: "No conversations" },
  typeMessage: { bn: "একটি বার্তা লিখুন…", en: "Type a message…" },
  loading: { bn: "লোড হচ্ছে…", en: "Loading…" },
  saving: { bn: "সেভ হচ্ছে…", en: "Saving…" },
  saved: { bn: "সেভ হয়েছে", en: "Saved" },
  encrypted: { bn: "এনক্রিপ্টেড", en: "Encrypted" },
  realtime: { bn: "রিয়েলটাইম", en: "Realtime" },
  postedBy: { bn: "পোস্টকারী", en: "Posted by" },
  darkMode: { bn: "ডার্ক মোড", en: "Dark mode" },
  offlineMode: { bn: "অফলাইন — ক্যাশড ডেটা", en: "Offline — cached data" },
  liveRequests: { bn: "লাইভ রিকোয়েস্ট", en: "Live requests" },
  postToFeed: { bn: "ফিডে পোস্ট করুন", en: "Post to feed" },
  users: { bn: "ইউজার", en: "Users" },
  overview: { bn: "ওভারভিউ", en: "Overview" },
  cms: { bn: "টেক্সট / CMS", en: "Text / CMS" },
  architecture: { bn: "আর্কিটেকচার প্ল্যান", en: "Architecture plan" },
  manageRequests: { bn: "রিকোয়েস্ট ম্যানেজ", en: "Manage requests" },
  openApp: { bn: "অ্যাপে যান", en: "Open app" },
  searchHospital: { bn: "হাসপাতাল / ক্লিনিক / ডায়াগনস্টিক খুঁজুন…", en: "Search hospital / clinic / diagnostic…" },
  hospital: { bn: "হাসপাতাল", en: "Hospital" },
  hospitals: { bn: "হাসপাতালসমূহ", en: "Hospitals" },
  government: { bn: "সরকারি", en: "Government" },
  private: { bn: "বেসরকারি", en: "Private" },
  clinic: { bn: "ক্লিনিক", en: "Clinic" },
  diagnostic: { bn: "ডায়াগনস্টিক", en: "Diagnostic" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
  reloadCms: () => Promise<void>;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");
  const [cms, setCms] = useState<Record<string, { bn: string; en: string }>>({});

  const reloadCms = async () => {
    try {
      const map = await fetchCmsStrings();
      setCms(map);
    } catch {
      /* keep fallback */
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("lang") as Lang | null;
    if (stored === "bn" || stored === "en") setLangState(stored);
    void reloadCms();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("lang", l);
  };

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      reloadCms,
      t: (k) => {
        const row = cms[k] ?? fallback[k];
        if (!row) return k;
        return row[lang] || row.en || k;
      },
    }),
    [lang, cms],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const c = useContext(LangContext);
  if (!c) throw new Error("useI18n must be used inside LangProvider");
  return c;
}

/** Seed missing CMS keys from fallback (admin can edit after) */
export async function ensureCmsSeed(upsert: (rows: { key: string; value_bn: string; value_en: string; category: string }[]) => Promise<void>) {
  const rows = Object.entries(fallback).map(([key, v]) => ({
    key,
    value_bn: v.bn,
    value_en: v.en,
    category: "ui",
  }));
  await upsert(rows);
}
