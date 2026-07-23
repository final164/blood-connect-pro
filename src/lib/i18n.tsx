import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

const dict = {
  appName: { bn: "BloodLink", en: "BloodLink" },
  tagline: { bn: "রক্তদানে জীবন বাঁচান", en: "Save lives by donating blood" },
  // Auth
  login: { bn: "লগইন", en: "Log in" },
  signup: { bn: "সাইনআপ", en: "Sign up" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  fullName: { bn: "পুরো নাম", en: "Full name" },
  havingAccount: { bn: "অ্যাকাউন্ট আছে?", en: "Have an account?" },
  noAccount: { bn: "নতুন?", en: "New here?" },
  createAccount: { bn: "অ্যাকাউন্ট তৈরি", en: "Create account" },
  // Nav
  feed: { bn: "ফিড", en: "Feed" },
  requests: { bn: "রিকোয়েস্ট", en: "Requests" },
  map: { bn: "ম্যাপ", en: "Map" },
  chat: { bn: "চ্যাট", en: "Chat" },
  profile: { bn: "প্রোফাইল", en: "Profile" },
  settings: { bn: "সেটিংস", en: "Settings" },
  // Actions
  post: { bn: "পোস্ট", en: "Post" },
  send: { bn: "পাঠান", en: "Send" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  save: { bn: "সেভ", en: "Save" },
  logout: { bn: "লগআউট", en: "Log out" },
  createRequest: { bn: "নতুন রিকোয়েস্ট", en: "New request" },
  respond: { bn: "সাড়া দিন", en: "Respond" },
  // Fields
  patientName: { bn: "রোগীর নাম", en: "Patient name" },
  bloodGroup: { bn: "রক্তের গ্রুপ", en: "Blood group" },
  bagsNeeded: { bn: "ব্যাগ প্রয়োজন", en: "Bags needed" },
  hospital: { bn: "হাসপাতাল", en: "Hospital" },
  city: { bn: "শহর", en: "City" },
  area: { bn: "এলাকা", en: "Area" },
  contact: { bn: "যোগাযোগ", en: "Contact" },
  neededBy: { bn: "কতক্ষণে দরকার", en: "Needed by" },
  urgency: { bn: "জরুরিতা", en: "Urgency" },
  notes: { bn: "নোট", en: "Notes" },
  normal: { bn: "সাধারণ", en: "Normal" },
  urgent: { bn: "জরুরি", en: "Urgent" },
  critical: { bn: "সংকটাপন্ন", en: "Critical" },
  bio: { bn: "সংক্ষেপ পরিচয়", en: "Bio" },
  phone: { bn: "ফোন", en: "Phone" },
  isDonor: { bn: "আমি ডোনার", en: "I'm a donor" },
  isRecipient: { bn: "আমি রক্ত গ্রহীতা", en: "I'm a recipient" },
  available: { bn: "উপলব্ধ", en: "Available" },
  lastDonation: { bn: "সর্বশেষ দান", en: "Last donation" },
  totalDonations: { bn: "মোট দান", en: "Donations" },
  livesSaved: { bn: "বাঁচানো জীবন", en: "Lives saved" },
  // Settings
  language: { bn: "ভাষা", en: "Language" },
  theme: { bn: "থিম", en: "Theme" },
  notifications: { bn: "বিজ্ঞপ্তি", en: "Notifications" },
  privacy: { bn: "প্রাইভেসি ও নিরাপত্তা", en: "Privacy & Security" },
  e2ee: { bn: "এন্ড-টু-এন্ড এনক্রিপশন", en: "End-to-end encryption" },
  e2eeOn: { bn: "চ্যাট, লোকেশন ও মেডিকেল তথ্য এনক্রিপ্টেড", en: "Chat, location & medical info encrypted" },
  googleMapsApi: { bn: "Google Maps API কী", en: "Google Maps API key" },
  googleMapsHint: { bn: "এই কী দিয়ে ম্যাপ কাজ করবে (ডিভাইসে সংরক্ষিত)", en: "Enables the map (stored per user)" },
  shareLocation: { bn: "লোকেশন শেয়ার", en: "Share location" },
  radius: { bn: "সার্চ রেডিয়াস (কিমি)", en: "Search radius (km)" },
  backend: { bn: "ব্যাকএন্ড", en: "Backend" },
  backendConnected: { bn: "সংযুক্ত", en: "Connected" },
  // Feed
  writeSomething: { bn: "কিছু লিখুন…", en: "Write something…" },
  like: { bn: "লাইক", en: "Like" },
  comment: { bn: "কমেন্ট", en: "Comment" },
  share: { bn: "শেয়ার", en: "Share" },
  // Empty
  emptyFeed: { bn: "এখনো কোনো পোস্ট নেই", en: "No posts yet" },
  emptyRequests: { bn: "সক্রিয় রিকোয়েস্ট নেই", en: "No active requests" },
  emptyChat: { bn: "কোনো কনভারসেশন নেই", en: "No conversations" },
  typeMessage: { bn: "একটি বার্তা লিখুন…", en: "Type a message…" },
  // Misc
  loading: { bn: "লোড হচ্ছে…", en: "Loading…" },
  saving: { bn: "সেভ হচ্ছে…", en: "Saving…" },
  saved: { bn: "সেভ হয়েছে", en: "Saved" },
  error: { bn: "ত্রুটি", en: "Error" },
  chatWith: { bn: "চ্যাট করুন", en: "Message" },
  encrypted: { bn: "এনক্রিপ্টেড", en: "Encrypted" },
  realtime: { bn: "রিয়েলটাইম", en: "Realtime" },
  km: { bn: "কিমি", en: "km" },
  now: { bn: "এখন", en: "now" },
  postedBy: { bn: "পোস্টকারী", en: "Posted by" },
  needed: { bn: "প্রয়োজন", en: "Needed" },
  addMapKeyPrompt: { bn: "Google Maps কী সেটিংসে যোগ করুন", en: "Add a Google Maps key in Settings" },
  editProfile: { bn: "প্রোফাইল এডিট", en: "Edit profile" },
  darkMode: { bn: "ডার্ক মোড", en: "Dark mode" },
} as const;

type Key = keyof typeof dict;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("lang") as Lang | null;
    if (stored === "bn" || stored === "en") setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("lang", l);
  };
  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (k) => dict[k][lang] ?? dict[k].en }),
    [lang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const c = useContext(LangContext);
  if (!c) throw new Error("useI18n must be used inside LangProvider");
  return c;
}
