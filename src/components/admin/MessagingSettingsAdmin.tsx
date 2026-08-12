import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  invalidateMessagingSettingsCache,
  saveMessagingSettings,
  type MessagingSettings,
  type PostIconSettings,
} from "@/lib/messaging-settings";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-slate-500";

const POST_ICON_KEYS: (keyof PostIconSettings)[] = [
  "like",
  "comment",
  "chat",
  "phone",
  "whatsapp",
  "save",
  "share",
];

export function MessagingSettingsAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [s, setS] = useState<MessagingSettings>({ ...DEFAULT_MESSAGING_SETTINGS });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchMessagingSettings(true).then(setS);
  }, []);

  async function save() {
    if (!can("settings.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    try {
      await saveMessagingSettings(s);
      invalidateMessagingSettingsCache();
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const iconLabels: Record<keyof PostIconSettings, { bn: string; en: string }> = {
    like: { bn: "লাইক", en: "Like" },
    comment: { bn: "কমেন্ট", en: "Comment" },
    chat: { bn: "চ্যাট", en: "Chat" },
    phone: { bn: "কল", en: "Call" },
    whatsapp: { bn: "WhatsApp", en: "WhatsApp" },
    save: { bn: "সেভ", en: "Save" },
    share: { bn: "শেয়ার", en: "Share" },
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "কমিউনিটি পেজ বাটন" : "Community page buttons"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {lang === "bn"
            ? "Send SMS ও Save request বাটন চালু/বন্ধ এবং লেবেল নিয়ন্ত্রণ।"
            : "Show/hide Send SMS & Save request, and edit their labels."}
        </p>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300">
            {lang === "bn" ? "Send SMS বাটন দেখাবে" : "Show Send SMS button"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500"
            checked={s.show_community_send_sms}
            onChange={(e) => setS({ ...s, show_community_send_sms: e.target.checked })}
          />
        </label>
        {s.show_community_send_sms && (
          <div className="grid sm:grid-cols-2 gap-2 pl-1">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Send SMS · BN</label>
              <input
                className={ainp}
                value={s.community_send_sms_label_bn}
                onChange={(e) => setS({ ...s, community_send_sms_label_bn: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Send SMS · EN</label>
              <input
                className={ainp}
                value={s.community_send_sms_label_en}
                onChange={(e) => setS({ ...s, community_send_sms_label_en: e.target.value })}
              />
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300">
            {lang === "bn" ? "Save request বাটন দেখাবে" : "Show Save request button"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500"
            checked={s.show_community_save_request}
            onChange={(e) => setS({ ...s, show_community_save_request: e.target.checked })}
          />
        </label>
        {s.show_community_save_request && (
          <div className="grid sm:grid-cols-2 gap-2 pl-1">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Save request · BN</label>
              <input
                className={ainp}
                value={s.community_save_request_label_bn}
                onChange={(e) => setS({ ...s, community_save_request_label_bn: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Save request · EN</label>
              <input
                className={ainp}
                value={s.community_save_request_label_en}
                onChange={(e) => setS({ ...s, community_save_request_label_en: e.target.value })}
              />
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "Save request সেভ হলে ফিডে পোস্ট হবে"
              : "Post to feed when Save request is saved"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_save_posts_to_feed}
            onChange={(e) => setS({ ...s, community_save_posts_to_feed: e.target.checked })}
          />
        </label>
        <div>
          <label className="text-[10px] text-slate-400 block mb-1">
            {lang === "bn"
              ? "একসাথে সর্বোচ্চ কতজন ডোনার সিলেক্ট"
              : "Max donors selectable per SMS"}
          </label>
          <input
            type="number"
            min={1}
            max={100}
            className={ainp}
            value={s.max_sms_donors}
            onChange={(e) =>
              setS({
                ...s,
                max_sms_donors: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
              })
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "কমিউনিটি ফিল্টার ও অ্যাভেইলেবিলিটি" : "Community filter & availability"}
        </h3>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "হেডারের নিচে ব্লাড গ্রুপ ফিল্টার দেখাবে"
              : "Show blood group filter chips under header"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.show_community_blood_filter}
            onChange={(e) => setS({ ...s, show_community_blood_filter: e.target.checked })}
          />
        </label>
        <p className="text-[10px] text-slate-500 leading-relaxed px-1">
          {lang === "bn"
            ? "Save request-এর ব্লাড গ্রুপ / জেলা / উপজেলা দিয়ে ডোনার অটো-ফিল্টার (নিচের টগল দিয়ে আলাদা নিয়ন্ত্রণ)।"
            : "Auto-filter donors from save-request blood / district / upazila (toggles below)."}
        </p>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "Save request ব্লাড গ্রুপ → ডোনার ফিল্টার"
              : "Save-request blood group → donor filter"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_apply_save_request_blood}
            onChange={(e) =>
              setS({ ...s, community_apply_save_request_blood: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "Save request জেলা → ডোনার ফিল্টার"
              : "Save-request district → donor filter"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_apply_save_request_district}
            onChange={(e) =>
              setS({ ...s, community_apply_save_request_district: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "Save request উপজেলা → ডোনার ফিল্টার"
              : "Save-request upazila → donor filter"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_apply_save_request_upazila}
            onChange={(e) =>
              setS({ ...s, community_apply_save_request_upazila: e.target.checked })
            }
          />
        </label>
        <div className="rounded-lg border border-slate-800 px-3 py-2.5 space-y-1.5">
          <label className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300 leading-snug">
              {lang === "bn"
                ? "Save request কত ঘণ্টা পর অটো-ক্লিয়ার"
                : "Auto-clear save request after (hours)"}
            </span>
            <input
              type="number"
              min={0}
              max={720}
              className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40"
              value={s.community_save_request_ttl_hours}
              onChange={(e) =>
                setS({
                  ...s,
                  community_save_request_ttl_hours: Math.max(
                    0,
                    Math.min(720, Math.floor(Number(e.target.value) || 0)),
                  ),
                })
              }
            />
          </label>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {lang === "bn"
              ? "ডিফল্ট ২৪ = একদিন। ০ = কখনো অটো-ক্লিয়ার হবে না (ম্যানুয়ালি ক্লিয়ার করতে হবে)।"
              : "Default 24 = one day. 0 = never auto-clear (manual clear only)."}
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "অনুপলব্ধ ডোনারদের তালিকার শেষে রাখবে"
              : "Sort unavailable donors to the end"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_sort_unavailable_last}
            onChange={(e) => setS({ ...s, community_sort_unavailable_last: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "অনুপলব্ধ হলে কল/SMS/WhatsApp আইকন লুকাবে"
              : "Hide call/SMS/WhatsApp while unavailable"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_hide_contact_when_unavailable}
            onChange={(e) =>
              setS({ ...s, community_hide_contact_when_unavailable: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "অনুপলব্ধ ডোনারে “Not available” লেবেল"
              : "Show “Not available” on cooldown donors"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_show_unavailable_label}
            onChange={(e) => setS({ ...s, community_show_unavailable_label: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "অ্যাপ ইউজারদের কমিউনিটিতে দেখাবে (জেলা/উপজেলা অনুযায়ী)"
              : "Show app users in Community (by district/upazila)"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_include_app_users}
            onChange={(e) => setS({ ...s, community_include_app_users: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "কমিউনিটি ফিল্টারে নিজের জেলা/উপজেলা অটো সেট"
              : "Auto-set Community filters to viewer district/upazila"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.community_default_to_viewer_location}
            onChange={(e) =>
              setS({ ...s, community_default_to_viewer_location: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300 leading-snug">
            {lang === "bn"
              ? "অর্গ ডোনার একই ফোন দিয়ে সাইনআপ করলে হিস্ট্রি প্রোফাইলে মিলবে"
              : "Link org-donor history when they sign up with same phone"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500 shrink-0"
            checked={s.link_org_donor_on_signup}
            onChange={(e) => setS({ ...s, link_org_donor_on_signup: e.target.checked })}
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "কমিউনিটি SMS টেমপ্লেট" : "Community SMS template"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {"{{blood_group}} {{patient_name}} {{hospital}} {{upazila}} {{district}} {{bags}} {{urgency}} {{reason}} {{notes}} {{link}}"}
        </p>
        <label className="block text-[10px] text-slate-400 mb-1">Bangla</label>
        <textarea
          className={`${ainp} min-h-[100px] font-mono text-xs`}
          value={s.community_sms_bn}
          onChange={(e) => setS({ ...s, community_sms_bn: e.target.value })}
        />
        <label className="block text-[10px] text-slate-400 mb-1">English</label>
        <textarea
          className={`${ainp} min-h-[100px] font-mono text-xs`}
          value={s.community_sms_en}
          onChange={(e) => setS({ ...s, community_sms_en: e.target.value })}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "পোস্ট শেয়ার / SMS টেমপ্লেট" : "Post share / SMS template"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {"{{blood_group}} {{patient_name}} {{location}} {{hospital}} {{link}} …"}
        </p>
        <label className="block text-[10px] text-slate-400 mb-1">Bangla</label>
        <textarea
          className={`${ainp} min-h-[80px] font-mono text-xs`}
          value={s.share_sms_bn}
          onChange={(e) => setS({ ...s, share_sms_bn: e.target.value })}
        />
        <label className="block text-[10px] text-slate-400 mb-1">English</label>
        <textarea
          className={`${ainp} min-h-[80px] font-mono text-xs`}
          value={s.share_sms_en}
          onChange={(e) => setS({ ...s, share_sms_en: e.target.value })}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "ফিড পোস্ট ডিভাইডার" : "Feed post divider"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {lang === "bn"
            ? "প্রত্যেক পোস্টের নিচে আলাদা করার লাইন চালু/বন্ধ, রঙ ও পুরুত্ব।"
            : "Show/hide the line under each feed post; set color and thickness."}
        </p>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
          <span className="text-slate-300">
            {lang === "bn" ? "পোস্টের নিচে লাইন দেখাবে" : "Show divider under posts"}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500"
            checked={s.feed_show_post_divider}
            onChange={(e) => setS({ ...s, feed_show_post_divider: e.target.checked })}
          />
        </label>
        {s.feed_show_post_divider && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                {lang === "bn" ? "রঙ" : "Color"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                  value={
                    /^#[0-9A-Fa-f]{6}$/.test(s.feed_post_divider_color)
                      ? s.feed_post_divider_color
                      : "#E4E6EB"
                  }
                  onChange={(e) => setS({ ...s, feed_post_divider_color: e.target.value })}
                />
                <input
                  className={ainp}
                  value={s.feed_post_divider_color}
                  onChange={(e) => setS({ ...s, feed_post_divider_color: e.target.value })}
                  placeholder="#E4E6EB"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                {lang === "bn" ? "পুরুত্ব (px)" : "Thickness (px)"}
              </label>
              <input
                type="number"
                min={0}
                max={48}
                className={ainp}
                value={s.feed_post_divider_height_px}
                onChange={(e) =>
                  setS({
                    ...s,
                    feed_post_divider_height_px: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div
              className="sm:col-span-2 rounded-md overflow-hidden border border-slate-800"
              aria-hidden
            >
              <div className="h-6 bg-slate-950" />
              <div
                style={{
                  height: Math.max(1, s.feed_post_divider_height_px || 0),
                  backgroundColor: s.feed_post_divider_color || "#E4E6EB",
                }}
              />
              <div className="h-6 bg-slate-950" />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "পোস্ট আইকন (ফিড)" : "Post icons (feed)"}
        </h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {POST_ICON_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs"
            >
              <span className="text-slate-300">{lang === "bn" ? iconLabels[key].bn : iconLabels[key].en}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-rose-500"
                checked={s.post_icons[key]}
                onChange={(e) =>
                  setS({
                    ...s,
                    post_icons: { ...s.post_icons, [key]: e.target.checked },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-lg bg-rose-600 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
      >
        {busy ? "…" : lang === "bn" ? "সেভ" : "Save"}
      </button>
    </div>
  );
}
