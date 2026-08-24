import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { ProfileToggle as Toggle } from "@/components/profile/ProfileToggle";
import { ChangePinSheet } from "@/components/settings/ChangePinSheet";
import { ReportProblemSheet } from "@/components/settings/ReportProblemSheet";
import { ShieldCheck, Globe, Bell, LogOut, KeyRound, ChevronRight, Flag, Download } from "lucide-react";
import { toast } from "sonner";
import { enableDeviceNotifications, disableDeviceNotifications, canUseDeviceNotifications, isNativePushConfigured } from "@/lib/device-push";
import { hasWebPushConfigured } from "@/lib/push-config";
import { isNativeApp } from "@/lib/native-app";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { AppDownloadButton } from "@/components/AppDownloadButton";

type SettingsSearch = {
  report?: boolean;
};

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — BloodLink" }] }),
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    report:
      search.report === true ||
      search.report === "1" ||
      search.report === "true",
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const { report: openReportFromSearch } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    if (openReportFromSearch) {
      setReportOpen(true);
      void navigate({ search: {}, replace: true });
    }
  }, [openReportFromSearch, navigate]);

  useEffect(() => {
    if (typeof document !== "undefined") setDark(document.documentElement.classList.contains("dark"));
    if (!user) return;
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setS(data ?? { user_id: user.id }));
    Promise.all([
      supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
      supabase.from("user_login_credentials").select("phone").eq("user_id", user.id).maybeSingle(),
    ]).then(([{ data: profile }, { data: creds }]) => {
      setUserPhone((creds?.phone as string) || (profile?.phone as string) || "");
    });
  }, [user]);

  function toggleDark(v: boolean) {
    setDark(v);
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", v);
    if (typeof window !== "undefined") window.localStorage.setItem("theme", v ? "dark" : "light");
  }

  async function save() {
    if (!user || !s) return;
    setBusy(true);
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      language: s.language ?? lang,
      theme: dark ? "dark" : "light",
      notif_push: !!s.notif_push,
      notif_email: !!s.notif_email,
      notif_new_request: !!s.notif_new_request,
      e2ee_enabled: !!s.e2ee_enabled,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      if (s.notif_push && canUseDeviceNotifications()) {
        const ok = await enableDeviceNotifications(user.id);
        if (!ok) toast.message(lang === "bn" ? "ডিভাইস নোটিফিকেশন অনুমতি দিন" : "Allow device notification permission");
      } else if (!s.notif_push) {
        await disableDeviceNotifications(user.id);
      }
      toast.success(t("saved"));
    }
  }

  async function togglePush(v: boolean) {
    setS({ ...s, notif_push: v });
    if (!user) return;
    if (v && canUseDeviceNotifications()) {
      const ok = await enableDeviceNotifications(user.id);
      if (!ok) {
        setS({ ...s, notif_push: false });
        toast.message(lang === "bn" ? "ডিভাইস নোটিফিকেশন অনুমতি দিন" : "Allow device notification permission");
      }
    } else if (!v) {
      await disableDeviceNotifications(user.id);
    }
  }

  if (!s) return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 glass border-b safe-top">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
          <PageBackButton fallbackTo="/home" />
          <h1 className="text-base font-bold tracking-tight">{t("settings")}</h1>
        </div>
      </AutoHideHeader>

      <div className="p-4 space-y-5">
        <Section title={t("language")} icon={<Globe className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
            {(["bn", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  setS({ ...s, language: l });
                }}
                className={`py-2 text-sm font-medium rounded-lg ${lang === l ? "bg-card shadow" : "text-muted-foreground"}`}
              >
                {l === "bn" ? "বাংলা" : "English"}
              </button>
            ))}
          </div>
          <Toggle label={t("darkMode")} checked={dark} onChange={toggleDark} />
        </Section>

        <Section title={t("notifications")} icon={<Bell className="h-4 w-4" />}>
          {isNativeApp() && !isNativePushConfigured() ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 px-1">
              {lang === "bn"
                ? "নেটিভ পুশ এখনো সেটআপ হয়নি (Firebase)। অ্যাপ খোলা থাকলে ইন-অ্যাপ নোটিফিকেশন কাজ করবে।"
                : "Native push is not configured yet (Firebase). In-app alerts still work while open."}
            </p>
          ) : !hasWebPushConfigured() && !isNativeApp() ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 px-1">
              {lang === "bn"
                ? "VITE_VAPID_PUBLIC_KEY সেট না থাকলে শুধু অ্যাপ খোলা থাকলে নোটিফিকেশন কাজ করবে।"
                : "Without VITE_VAPID_PUBLIC_KEY, notifications only work while the app is open."}
            </p>
          ) : null}
          <Toggle
            label={lang === "bn" ? "ডিভাইস নোটিফিকেশন" : "Device push"}
            checked={!!s.notif_push}
            onChange={(v) => void togglePush(v)}
          />
          <Toggle label="Email" checked={!!s.notif_email} onChange={(v) => setS({ ...s, notif_email: v })} />
          <Toggle label={lang === "bn" ? "নতুন রিকোয়েস্ট" : "New requests"} checked={!!s.notif_new_request} onChange={(v) => setS({ ...s, notif_new_request: v })} />
        </Section>

        {!isNativeApp() && (
          <Section title={lang === "bn" ? "মোবাইল অ্যাপ" : "Mobile app"} icon={<Download className="h-4 w-4" />}>
            <AppDownloadButton lang={lang} variant="full" force className="w-full" />
            <p className="text-[10px] text-muted-foreground px-1">
              {lang === "bn"
                ? "অ্যান্ড্রয়েড APK ডাউনলোড করুন (সাইডলোড)। Play Store শীঘ্রই আসছে।"
                : "Download the Android APK (sideload). Play Store coming soon."}
            </p>
          </Section>
        )}

        <Section title={t("privacy")} icon={<ShieldCheck className="h-4 w-4" />}>
          <Toggle
            label={t("e2ee")}
            checked={!!s.e2ee_enabled}
            onChange={(v) => setS({ ...s, e2ee_enabled: v })}
          />
          <button
            type="button"
            onClick={() => setPinOpen(true)}
            className="w-full flex items-center justify-between rounded-xl border bg-card px-3 py-3 hover:bg-muted/50 transition"
          >
            <span className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              {lang === "bn" ? "PIN পরিবর্তন" : "Change PIN"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <p className="text-[11px] text-muted-foreground px-1">
            {lang === "bn"
              ? "প্রোফাইল লক করতে আপনার প্রোফাইল পেজে যান।"
              : "To lock your profile, go to your profile page."}
          </p>
        </Section>

        <Section
          title={lang === "bn" ? "সাহায্য" : "Support"}
          icon={<Flag className="h-4 w-4" />}
        >
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="w-full flex items-center justify-between rounded-xl border bg-card px-3 py-3 hover:bg-muted/50 transition"
          >
            <span className="flex items-center gap-2 text-sm">
              <Flag className="h-4 w-4 text-primary" />
              {lang === "bn" ? "রিপোর্ট / অভিযোগ জানান" : "Report / complain"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? t("saving") : t("save")}
        </button>

        <button
          onClick={() => signOut()}
          className="w-full rounded-xl border border-destructive/40 text-destructive py-3 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>

        <p className="text-center text-[10px] text-muted-foreground">v1.0 · BloodLink</p>
      </div>

      {user && (
        <ChangePinSheet
          open={pinOpen}
          onClose={() => setPinOpen(false)}
          userId={user.id}
          phone={userPhone}
          lang={lang}
          t={t}
        />
      )}

      <ReportProblemSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 px-1 pb-2">
        {icon}
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
