import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Lang } from "@/lib/i18n";
import { Toggle } from "@/routes/_app.profile";
import { ShieldCheck, Globe, MapPin, Bell, Database, LogOut, Moon } from "lucide-react";
import { toast } from "sonner";
import { enableDeviceNotifications, disableDeviceNotifications, canUseDeviceNotifications } from "@/lib/device-push";
import { hasWebPushConfigured } from "@/lib/push-config";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — BloodLink" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") setDark(document.documentElement.classList.contains("dark"));
    if (!user) return;
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setS(data ?? { user_id: user.id }));
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
      share_location: !!s.share_location,
      google_maps_api_key: s.google_maps_api_key ?? null,
      e2ee_enabled: !!s.e2ee_enabled,
      radius_km: Number(s.radius_km) || 25,
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
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 glass border-b safe-top">
        <div className="px-4 py-3">
          <h1 className="text-base font-bold">{t("settings")}</h1>
        </div>
      </header>

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
          {!hasWebPushConfigured() && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 px-1">
              {lang === "bn"
                ? "VITE_VAPID_PUBLIC_KEY সেট না থাকলে শুধু অ্যাপ খোলা থাকলে নোটিফিকেশন কাজ করবে।"
                : "Without VITE_VAPID_PUBLIC_KEY, notifications only work while the app is open."}
            </p>
          )}
          <Toggle
            label={lang === "bn" ? "ডিভাইস নোটিফিকেশন" : "Device push"}
            checked={!!s.notif_push}
            onChange={(v) => void togglePush(v)}
          />
          <Toggle label="Email" checked={!!s.notif_email} onChange={(v) => setS({ ...s, notif_email: v })} />
          <Toggle label={lang === "bn" ? "নতুন রিকোয়েস্ট" : "New requests"} checked={!!s.notif_new_request} onChange={(v) => setS({ ...s, notif_new_request: v })} />
        </Section>

        <Section title={t("privacy")} icon={<ShieldCheck className="h-4 w-4" />}>
          <Toggle
            label={t("e2ee")}
            checked={!!s.e2ee_enabled}
            hint={t("e2eeOn")}
            onChange={(v) => setS({ ...s, e2ee_enabled: v })}
          />
          <Toggle label={t("shareLocation")} checked={!!s.share_location} onChange={(v) => setS({ ...s, share_location: v })} />
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">{t("radius")}</label>
            <input
              type="number"
              min={1}
              max={500}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
              value={s.radius_km ?? 25}
              onChange={(e) => setS({ ...s, radius_km: e.target.value })}
            />
          </div>
        </Section>

        <Section title={t("googleMapsApi")} icon={<MapPin className="h-4 w-4" />}>
          <p className="text-[11px] text-muted-foreground -mt-1">{t("googleMapsHint")}</p>
          <input
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-mono"
            placeholder="AIza…"
            value={s.google_maps_api_key ?? ""}
            onChange={(e) => setS({ ...s, google_maps_api_key: e.target.value })}
          />
        </Section>

        <Section title={t("backend")} icon={<Database className="h-4 w-4" />}>
          <div className="rounded-xl border bg-card p-3 text-xs space-y-1.5">
            <Row k="Status" v={<span className="text-success font-semibold">● {t("backendConnected")}</span>} />
            <Row k="Provider" v="Lovable Cloud (Postgres)" />
            <Row k="Realtime" v="Enabled" />
            <Row k="RLS" v="Enforced" />
            <Row k="E2EE" v="AES-GCM 256" />
          </div>
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
