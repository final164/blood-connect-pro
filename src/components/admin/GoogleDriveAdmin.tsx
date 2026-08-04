import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Save, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_GOOGLE_DRIVE_SETTINGS,
  checkDriveUploadHealth,
  clearDriveServiceAccount,
  extractDriveFolderId,
  fetchDriveSecretMeta,
  fetchGoogleDriveSettings,
  invalidateGoogleDriveSettingsCache,
  saveDriveServiceAccountJson,
  saveGoogleDriveSettings,
  testDriveConnection,
  type DriveHealth,
  type DriveImageInputMode,
  type DriveSecretMeta,
  type DriveTestResult,
  type GoogleDriveSettings,
} from "@/lib/google-drive";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-slate-500 font-mono";

const DRIVE_API_URL =
  "https://console.cloud.google.com/apis/library/drive.googleapis.com";
const SA_URL = "https://console.cloud.google.com/iam-admin/serviceaccounts";

export function GoogleDriveAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [s, setS] = useState<GoogleDriveSettings>({ ...DEFAULT_GOOGLE_DRIVE_SETTINGS });
  const [saJson, setSaJson] = useState("");
  const [secretMeta, setSecretMeta] = useState<DriveSecretMeta>({ configured: false, client_email: "" });
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<DriveHealth | null>(null);
  const [testResult, setTestResult] = useState<DriveTestResult | null>(null);

  async function reload() {
    const [settings, meta, h] = await Promise.all([
      fetchGoogleDriveSettings(true),
      fetchDriveSecretMeta(),
      checkDriveUploadHealth(),
    ]);
    setS(settings);
    setSecretMeta(meta);
    setHealth(h);
  }

  useEffect(() => {
    void reload();
  }, []);

  function setFolder(
    key: "folder_id" | "folder_requests" | "folder_avatars" | "folder_media",
    value: string,
  ) {
    setS((p) => ({ ...p, [key]: extractDriveFolderId(value) }));
  }

  async function saveAll() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    try {
      if (saJson.trim()) {
        const saved = await saveDriveServiceAccountJson(saJson.trim());
        setSecretMeta({ configured: true, client_email: saved.client_email });
        setSaJson("");
      }
      await saveGoogleDriveSettings(s);
      invalidateGoogleDriveSettingsCache();
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onClearSecret() {
    if (!can("settings.edit")) return;
    if (!confirm(lang === "bn" ? "Service Account মুছে ফেলবেন?" : "Remove service account?")) return;
    setBusy(true);
    try {
      await clearDriveServiceAccount();
      setSecretMeta({ configured: false, client_email: "" });
      toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Cleared");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    if (!can("settings.view") && !can("settings.edit")) return;
    setBusy(true);
    setTestResult(null);
    try {
      // Save folder settings first so test uses latest IDs
      if (can("settings.edit")) {
        await saveGoogleDriveSettings(s);
        invalidateGoogleDriveSettingsCache();
      }
      const result = await testDriveConnection();
      setTestResult(result);
      if (result.ok && result.folder_ok) {
        toast.success(result.message || (lang === "bn" ? "কানেকশন OK" : "Connection OK"));
      } else if (result.ok && result.token_ok) {
        toast.message(result.message || (lang === "bn" ? "টোকেন OK — ফোল্ডার শেয়ার করুন" : "Token OK — share folder"));
      } else {
        toast.error(result.error || (lang === "bn" ? "টেস্ট ব্যর্থ" : "Test failed"));
      }
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Setup steps */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "১) একবারের Google সেটআপ" : "1) One-time Google setup"}
        </h3>
        <ol className="list-decimal pl-4 space-y-2 text-[11px] text-slate-400">
          <li>
            {lang === "bn" ? "Google Cloud প্রজেক্টে " : "In Google Cloud, enable "}
            <a href={DRIVE_API_URL} target="_blank" rel="noreferrer" className="text-rose-300 inline-flex items-center gap-0.5 hover:underline">
              Google Drive API <ExternalLink className="h-3 w-3" />
            </a>
            {lang === "bn" ? " চালু করুন (ফ্রি)।" : " (free)."}
          </li>
          <li>
            <a href={SA_URL} target="_blank" rel="noreferrer" className="text-rose-300 inline-flex items-center gap-0.5 hover:underline">
              Service Account <ExternalLink className="h-3 w-3" />
            </a>
            {lang === "bn"
              ? " তৈরি করুন → Keys → Add key → JSON ডাউনলোড।"
              : " → Keys → Add key → download JSON."}
          </li>
          <li>
            {lang === "bn"
              ? "Drive-এ একটি ফোল্ডার খুলুন → Share → নিচের Service Account ইমেইলে Editor দিন।"
              : "Create a Drive folder → Share → give Editor to the service account email below."}
          </li>
          <li>
            {lang === "bn"
              ? "নিচে JSON পেস্ট করুন, ফোল্ডার URL/ID দিন, সেভ ও টেস্ট করুন।"
              : "Paste the JSON below, set folder URL/ID, Save, then Test."}
          </li>
        </ol>
      </div>

      {/* Service account JSON */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "২) Service Account JSON" : "2) Service Account JSON"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === "bn"
                ? "পুরো JSON এখানে পেস্ট করুন — Admin Settings থেকেই সেভ হবে (Supabase secret আলাদা করে লাগবে না)।"
                : "Paste the full JSON here — saved from Admin Settings (no separate Supabase secret required)."}
            </p>
          </div>
          {secretMeta.configured && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onClearSecret()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
              {lang === "bn" ? "মুছুন" : "Clear"}
            </button>
          )}
        </div>

        {secretMeta.configured ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {lang === "bn" ? "কনফিগার করা আছে" : "Configured"}
              </p>
              <p className="opacity-90 break-all">{secretMeta.client_email || health?.service_account_email}</p>
              <p className="mt-1 text-[10px] opacity-70">
                {lang === "bn"
                  ? "নতুন JSON পেস্ট করলে আগেরটা রিপ্লেস হবে।"
                  : "Paste a new JSON below to replace."}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-amber-200/90">
            {lang === "bn" ? "এখনো সেট করা হয়নি — JSON পেস্ট করুন।" : "Not set yet — paste JSON below."}
          </p>
        )}

        <textarea
          className={`${ainp} min-h-[120px] text-[11px]`}
          placeholder='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...","client_email":"...@....iam.gserviceaccount.com",...}'
          value={saJson}
          onChange={(e) => setSaJson(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Folders + toggles */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "৩) ফোল্ডার ও অপশন" : "3) Folders & options"}
        </h3>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">
              {lang === "bn" ? "Drive আপলোড চালু" : "Enable Drive uploads"}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {lang === "bn"
                ? "বন্ধ থাকলে Supabase storage ব্যবহার হবে"
                : "When off, falls back to Supabase storage"}
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500"
            checked={s.enabled}
            onChange={(e) => setS({ ...s, enabled: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Anyone with the link</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {lang === "bn"
                ? "আপলোডের পর পাবলিক রিডার — অ্যাপে ইমেজ দেখাবে"
                : "Public reader after upload so images display in the app"}
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-500"
            checked={s.make_public}
            onChange={(e) => setS({ ...s, make_public: e.target.checked })}
          />
        </label>

        <p className="text-[10px] text-slate-500">
          {lang === "bn"
            ? "ফোল্ডার URL পেস্ট করলে ID অটো বের হবে (drive.google.com/drive/folders/…)"
            : "Paste a folder URL — ID is extracted automatically"}
        </p>

        {(
          [
            ["folder_id", lang === "bn" ? "ডিফল্ট ফোল্ডার" : "Default folder"],
            ["folder_requests", lang === "bn" ? "রিকোয়েস্ট পোস্ট" : "Request posts"],
            ["folder_avatars", lang === "bn" ? "প্রোফাইল ছবি" : "Avatars"],
            ["folder_media", lang === "bn" ? "অ্যাডমিন মিডিয়া (ক্যারোজেল/ল্যান্ডিং)" : "Admin media (carousel/landing)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1">
            <span className="text-[10px] font-medium text-slate-400">{label}</span>
            <input
              className={ainp}
              value={s[key]}
              placeholder="https://drive.google.com/drive/folders/…"
              onChange={(e) => setFolder(key, e.target.value)}
              onBlur={(e) => setFolder(key, e.target.value)}
            />
          </label>
        ))}
      </div>

      {/* Image input modes + feature toggles */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "৪) ইমেজ যোগ করার ধরন" : "4) How images are added"}
        </h3>
        <p className="text-[11px] text-slate-400">
          {lang === "bn"
            ? "ইউজার/অ্যাডমিন ইমেজ কীভাবে দিবে — শুধু Drive/লিংক URL, শুধু ফাইল আপলোড (অটো Drive), অথবা দুটোই।"
            : "Users/admins can paste a Drive/link URL, upload a file (auto to Drive), or both."}
        </p>

        <div className="grid gap-2">
          {(
            [
              {
                id: "url" as DriveImageInputMode,
                bn: "শুধু URL / Drive লিংক",
                en: "URL / Drive link only",
                hintBn: "ফাইল পিকার বন্ধ — শেয়ার লিংক পেস্ট করে ইমেজ যোগ",
                hintEn: "No file picker — paste share links to attach images",
              },
              {
                id: "upload" as DriveImageInputMode,
                bn: "শুধু অটো আপলোড",
                en: "Auto upload only",
                hintBn: "ফাইল সিলেক্ট → Drive/storage-এ আপলোড",
                hintEn: "Pick a file → uploads to Drive/storage",
              },
              {
                id: "both" as DriveImageInputMode,
                bn: "URL + অটো আপলোড (দুটোই)",
                en: "URL + auto upload (both)",
                hintBn: "লিংক পেস্ট অথবা ফাইল আপলোড — যেকোনো একটা",
                hintEn: "Paste a link or upload a file",
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${
                s.image_input_mode === opt.id
                  ? "border-rose-500/50 bg-rose-500/10"
                  : "border-slate-800 hover:bg-slate-950/50"
              }`}
            >
              <input
                type="radio"
                name="image_input_mode"
                className="mt-1 accent-rose-500"
                checked={s.image_input_mode === opt.id}
                onChange={() => setS({ ...s, image_input_mode: opt.id })}
              />
              <div>
                <p className="text-sm font-medium">{lang === "bn" ? opt.bn : opt.en}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {lang === "bn" ? opt.hintBn : opt.hintEn}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-3 space-y-2">
          <p className="text-[11px] font-medium text-slate-300">
            {lang === "bn" ? "ইউজার ফিচার অন/অফ" : "User feature on/off"}
          </p>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">
                {lang === "bn" ? "প্রোফাইল ছবি আপলোড" : "Profile photo"}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {lang === "bn"
                  ? "বন্ধ থাকলে প্রোফাইলে pen/URL দেখাবে না"
                  : "When off, hide pen/URL on profile"}
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-rose-500"
              checked={s.allow_profile_image}
              onChange={(e) => setS({ ...s, allow_profile_image: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">
                {lang === "bn" ? "পোস্টে (রিকোয়েস্ট) ছবি" : "Post (request) image"}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {lang === "bn"
                  ? "বন্ধ থাকলে নতুন রিকোয়েস্টে ইমেজ অপশন থাকবে না"
                  : "When off, hide image on new request compose"}
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-rose-500"
              checked={s.allow_post_image}
              onChange={(e) => setS({ ...s, allow_post_image: e.target.checked })}
            />
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveAll()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {lang === "bn" ? "সব সেভ করুন" : "Save all"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onTest()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
        >
          <Wifi className="h-3.5 w-3.5" />
          {lang === "bn" ? "কানেকশন টেস্ট" : "Test connection"}
        </button>
        <a
          href="https://drive.google.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2.5 text-xs text-slate-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Drive
        </a>
      </div>

      {(testResult || health) && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-[11px] space-y-1 ${
            (testResult?.ok && testResult.folder_ok) ||
            (health?.has_service_account && health?.folder_configured)
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          {testResult && (
            <>
              <p className="font-medium">
                {lang === "bn" ? "টেস্ট" : "Test"}:{" "}
                {testResult.error || testResult.message || (testResult.ok ? "OK" : "Failed")}
              </p>
              {testResult.client_email && <p className="break-all opacity-90">{testResult.client_email}</p>}
              {testResult.folder_name && (
                <p>
                  {lang === "bn" ? "ফোল্ডার" : "Folder"}: {testResult.folder_name}
                </p>
              )}
            </>
          )}
          {health && !testResult && (
            <>
              <p>
                SA:{" "}
                {health.has_service_account
                  ? health.service_account_email || "OK"
                  : lang === "bn"
                    ? "নেই"
                    : "missing"}
              </p>
              <p>
                {lang === "bn" ? "ফোল্ডার" : "Folder"}:{" "}
                {health.folder_configured
                  ? lang === "bn"
                    ? "কনফিগার করা"
                    : "set"
                  : lang === "bn"
                    ? "খালি"
                    : "empty"}
              </p>
            </>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-500 leading-relaxed">
        {lang === "bn"
          ? "নোট: Drive API চালু ও ফোল্ডার শেয়ার Google-এর সাইটে একবার করতে হবে — JSON ও ফোল্ডার ID এই পেজ থেকেই ম্যানেজ হবে। Edge function drive-upload ডিপ্লয় থাকতে হবে।"
          : "Note: Enabling Drive API and sharing the folder is done once on Google’s site — JSON and folder IDs are managed here. The drive-upload edge function must be deployed."}
      </p>
    </div>
  );
}
