import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DONOR_CONTACT_SETTINGS,
  normalizeDonorContactSettings,
  type DonorContactSettings,
  type GenderContactFlags,
} from "@/lib/community-contact-settings";
import { toast } from "sonner";

export function OrgContactSettingsForm({
  orgId,
  initial,
  lang,
  canEdit,
  onSaved,
  variant = "app",
}: {
  orgId: string;
  initial: unknown;
  lang: "bn" | "en";
  canEdit: boolean;
  onSaved?: () => void;
  variant?: "app" | "admin";
}) {
  const [settings, setSettings] = useState<DonorContactSettings>(() =>
    normalizeDonorContactSettings(initial ?? DEFAULT_DONOR_CONTACT_SETTINGS),
  );
  const [viewerTab, setViewerTab] = useState<"male" | "female">("male");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(normalizeDonorContactSettings(initial ?? DEFAULT_DONOR_CONTACT_SETTINGS));
  }, [orgId, initial]);

  function setFlag(donor: "male" | "female", key: keyof GenderContactFlags, value: boolean) {
    setSettings((prev) => ({
      ...prev,
      [viewerTab]: {
        ...prev[viewerTab],
        [donor]: { ...prev[viewerTab][donor], [key]: value },
      },
    }));
  }

  async function save() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    const { error } = await supabase
      .from("community_orgs")
      .update({ donor_contact_settings: settings })
      .eq("id", orgId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "কন্টাক্ট সেটিংস সেভ" : "Contact settings saved");
    onSaved?.();
  }

  const iconLabels: Record<keyof GenderContactFlags, string> = {
    call: "Call",
    sms: "SMS",
    chat: "WhatsApp",
  };

  const box =
    variant === "admin"
      ? "rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3"
      : "rounded-xl border bg-card p-3 space-y-3";
  const muted = variant === "admin" ? "text-slate-400" : "text-muted-foreground";
  const btnActive = variant === "admin" ? "bg-rose-600 text-white" : "bg-primary text-primary-foreground";

  return (
    <div className="space-y-3">
      <p className={`text-xs font-semibold ${muted}`}>
        {lang === "bn" ? "ডোনার কন্টাক্ট আইকন" : "Donor contact icons"}
      </p>
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border p-1">
        {(["male", "female"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewerTab(v)}
            className={`rounded-lg px-2 py-2.5 text-[11px] font-semibold transition ${
              viewerTab === v ? btnActive : muted
            }`}
          >
            {v === "male"
              ? lang === "bn"
                ? "ইউজার Male হলে"
                : "When viewer is Male"
              : lang === "bn"
                ? "ইউজার Female হলে"
                : "When viewer is Female"}
          </button>
        ))}
      </div>

      <div className={box}>
        {(["male", "female"] as const).map((donor) => (
          <div key={donor} className="rounded-lg border p-2.5 space-y-1.5">
            <p className="text-[11px] font-medium">
              {donor === "male"
                ? lang === "bn"
                  ? "পুরুষ ডোনার"
                  : "Male donors"
                : lang === "bn"
                  ? "মহিলা ডোনার"
                  : "Female donors"}
            </p>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(iconLabels) as (keyof GenderContactFlags)[]).map((key) => (
                <label key={key} className={`flex items-center gap-1.5 text-[11px] ${muted}`}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={!!settings[viewerTab][donor][key]}
                    onChange={(e) => setFlag(donor, key, e.target.checked)}
                  />
                  {iconLabels[key]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
            variant === "admin" ? "bg-rose-600 text-white" : "bg-primary text-primary-foreground"
          }`}
        >
          {busy ? (lang === "bn" ? "সেভ হচ্ছে…" : "Saving…") : lang === "bn" ? "সেভ" : "Save"}
        </button>
      )}
    </div>
  );
}
