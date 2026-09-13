import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  BLOOD_DONOR_AI_LIST_FIELDS,
  DEFAULT_BLOOD_DONOR_AI_SETTINGS,
  fetchBloodDonorAiSettings,
  invalidateBloodDonorAiSettingsCache,
  saveBloodDonorAiSettings,
  type BloodDonorAiGenderFilter,
  type BloodDonorAiIntent,
  type BloodDonorAiSettings,
  type BloodDonorAiSlot,
} from "@/lib/blood-donor-ai-settings";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-rose-500 shrink-0"
      />
    </label>
  );
}

const SLOT_OPTIONS: BloodDonorAiSlot[] = [
  "district",
  "blood_group",
  "upazila",
  "bags",
  "urgency",
  "notes",
];

export function BloodDonorAiAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const canEdit = can("settings.edit");
  const [cfg, setCfg] = useState<BloodDonorAiSettings>(DEFAULT_BLOOD_DONOR_AI_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchBloodDonorAiSettings(true)
      .then(setCfg)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await saveBloodDonorAiSettings(cfg);
      invalidateBloodDonorAiSettingsCache();
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function updateIntent(i: number, patch: Partial<BloodDonorAiIntent>) {
    setCfg((p) => ({
      ...p,
      intents: p.intents.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }

  function toggleSlot(list: "required_slots" | "optional_slots", slot: BloodDonorAiSlot) {
    setCfg((p) => {
      const has = p[list].includes(slot);
      const next = has ? p[list].filter((s) => s !== slot) : [...p[list], slot];
      const other = list === "required_slots" ? "optional_slots" : "required_slots";
      return {
        ...p,
        [list]: next,
        [other]: p[other].filter((s) => s !== slot || list === "optional_slots"),
      };
    });
  }

  if (loading) {
    return <p className="text-xs text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {lang === "bn" ? "ব্লাড ডোনার AI" : "Blood Donor AI"}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {lang === "bn"
              ? "কমিউনিটি ডোনার তালিকা / SMS / অর্গ — Care AI থেকে আলাদা"
              : "Community donors / SMS / orgs — separate from Care AI"}
          </p>
        </div>
        <button
          type="button"
          disabled={!canEdit || busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {lang === "bn" ? "সেভ" : "Save"}
        </button>
      </div>

      <ToggleRow
        title={lang === "bn" ? "চালু" : "Enabled"}
        hint="/ai/donors এবং এন্ট্রি পয়েন্ট"
        checked={cfg.enabled}
        onChange={(v) => setCfg((p) => ({ ...p, enabled: v }))}
      />

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "এন্ট্রি" : "Entry points"}
        </p>
        <ToggleRow
          title="Community"
          hint="/community হেডার বাটন"
          checked={cfg.entry_points.community}
          onChange={(v) =>
            setCfg((p) => ({ ...p, entry_points: { ...p.entry_points, community: v } }))
          }
        />
        <ToggleRow
          title="Home"
          hint="হোম শর্টকাট"
          checked={cfg.entry_points.home}
          onChange={(v) =>
            setCfg((p) => ({ ...p, entry_points: { ...p.entry_points, home: v } }))
          }
        />
        <ToggleRow
          title="Care hub"
          hint="কেয়ার হাব লিংক"
          checked={cfg.entry_points.care_hub}
          onChange={(v) =>
            setCfg((p) => ({ ...p, entry_points: { ...p.entry_points, care_hub: v } }))
          }
        />
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "ফিল্টার" : "Filters"}
        </p>
        <label className="block text-[11px] text-slate-400 mb-1">Gender</label>
        <select
          className={ainp}
          value={cfg.filters.gender}
          onChange={(e) =>
            setCfg((p) => ({
              ...p,
              filters: {
                ...p.filters,
                gender: e.target.value as BloodDonorAiGenderFilter,
              },
            }))
          }
        >
          <option value="male">male only</option>
          <option value="female">female only</option>
          <option value="any">any</option>
        </select>
        <label className="block text-[11px] text-slate-400 mt-2 mb-1">Max donors</label>
        <input
          className={ainp}
          type="number"
          min={5}
          max={100}
          value={cfg.filters.max_donors}
          onChange={(e) =>
            setCfg((p) => ({
              ...p,
              filters: { ...p.filters, max_donors: Number(e.target.value) || 40 },
            }))
          }
        />
        <ToggleRow
          title={lang === "bn" ? "অ্যাপ ইউজার ডোনার" : "Include app users"}
          hint="profiles.show_in_community"
          checked={cfg.filters.include_app_users}
          onChange={(v) =>
            setCfg((p) => ({ ...p, filters: { ...p.filters, include_app_users: v } }))
          }
        />
        <ToggleRow
          title={lang === "bn" ? "শুধু উপলব্ধ ডোনার" : "Available donors only"}
          hint="unavailable_until / is_available বাদ"
          checked={cfg.filters.available_only}
          onChange={(v) =>
            setCfg((p) => ({ ...p, filters: { ...p.filters, available_only: v } }))
          }
        />
        <ToggleRow
          title={lang === "bn" ? "উপজেলা ডিফল্ট: সব" : "Default upazila: All"}
          hint={
            lang === "bn"
              ? "চালু থাকলে জেলার সব উপজেলা; বন্ধ করলে উপজেলা জিজ্ঞেস হবে"
              : "When on, whole district; when off, user picks upazila"
          }
          checked={cfg.defaults.upazila_all}
          onChange={(v) =>
            setCfg((p) => ({ ...p, defaults: { ...p.defaults, upazila_all: v } }))
          }
        />
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "তালিকায় কী দেখাবে" : "List display fields"}
        </p>
        <p className="text-[10px] text-slate-500">
          {lang === "bn"
            ? "ডোনার কার্ডে কোন ফিল্ড দেখাবে (নাম, ফোন ইত্যাদি)"
            : "Which fields appear on each donor row (name, phone, etc.)"}
        </p>
        <div className="flex flex-wrap gap-2">
          {BLOOD_DONOR_AI_LIST_FIELDS.map((field) => (
            <label key={field} className="text-[11px] flex items-center gap-1.5 rounded-lg border border-slate-800 px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={cfg.list_fields[field]}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    list_fields: { ...p.list_fields, [field]: e.target.checked },
                  }))
                }
              />
              {field}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "অ্যাকশন" : "Actions"}
        </p>
        {(
          [
            ["show_list", "Show donor list"],
            ["show_orgs", "Show organizations"],
            ["open_sms", "Open SMS"],
            ["open_whatsapp", "Open WhatsApp"],
            ["copy_list", "Copy list"],
          ] as const
        ).map(([key, label]) => (
          <ToggleRow
            key={key}
            title={label}
            hint={key}
            checked={cfg.actions[key]}
            onChange={(v) => setCfg((p) => ({ ...p, actions: { ...p.actions, [key]: v } }))}
          />
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "স্টার্টার ইনটেন্ট" : "Starter intents"}
        </p>
        {cfg.intents.map((it, i) => (
          <div key={it.id + i} className="grid gap-2 rounded-lg border border-slate-800 p-2">
            <input
              className={ainp}
              value={it.label_bn}
              onChange={(e) => updateIntent(i, { label_bn: e.target.value })}
              placeholder="Label BN"
            />
            <input
              className={ainp}
              value={it.label_en}
              onChange={(e) => updateIntent(i, { label_en: e.target.value })}
              placeholder="Label EN"
            />
            <select
              className={ainp}
              value={it.action}
              onChange={(e) =>
                updateIntent(i, {
                  action: e.target.value as BloodDonorAiIntent["action"],
                })
              }
            >
              <option value="sms">sms</option>
              <option value="list">list</option>
              <option value="orgs">orgs</option>
              <option value="auto">auto</option>
            </select>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">Required slots</p>
        <div className="flex flex-wrap gap-2">
          {SLOT_OPTIONS.map((s) => (
            <label key={s} className="text-[11px] flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={cfg.required_slots.includes(s)}
                onChange={() => toggleSlot("required_slots", s)}
              />
              {s}
            </label>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-300 pt-2">Optional slots</p>
        <div className="flex flex-wrap gap-2">
          {SLOT_OPTIONS.map((s) => (
            <label key={`o-${s}`} className="text-[11px] flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={cfg.optional_slots.includes(s)}
                onChange={() => toggleSlot("optional_slots", s)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">UI copy</p>
        <textarea
          className={`${ainp} min-h-[56px]`}
          value={cfg.ui.welcome_bn}
          onChange={(e) => setCfg((p) => ({ ...p, ui: { ...p.ui, welcome_bn: e.target.value } }))}
          placeholder="Welcome BN"
        />
        <textarea
          className={`${ainp} min-h-[56px]`}
          value={cfg.ui.welcome_en}
          onChange={(e) => setCfg((p) => ({ ...p, ui: { ...p.ui, welcome_en: e.target.value } }))}
          placeholder="Welcome EN"
        />
        <textarea
          className={`${ainp} min-h-[48px]`}
          value={cfg.ui.disclaimer_bn}
          onChange={(e) =>
            setCfg((p) => ({ ...p, ui: { ...p.ui, disclaimer_bn: e.target.value } }))
          }
        />
        <textarea
          className={`${ainp} min-h-[48px]`}
          value={cfg.ui.disclaimer_en}
          onChange={(e) =>
            setCfg((p) => ({ ...p, ui: { ...p.ui, disclaimer_en: e.target.value } }))
          }
        />
      </div>

      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-300">System prompts</p>
        <textarea
          className={`${ainp} min-h-[100px] font-mono`}
          value={cfg.prompts.system_bn}
          onChange={(e) =>
            setCfg((p) => ({ ...p, prompts: { ...p.prompts, system_bn: e.target.value } }))
          }
        />
        <textarea
          className={`${ainp} min-h-[100px] font-mono`}
          value={cfg.prompts.system_en}
          onChange={(e) =>
            setCfg((p) => ({ ...p, prompts: { ...p.prompts, system_en: e.target.value } }))
          }
        />
      </div>
    </div>
  );
}
