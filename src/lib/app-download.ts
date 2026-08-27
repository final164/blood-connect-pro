/**
 * Public Android APK download (sideload until Play Store).
 * Place the file at: public/downloads/Muktosheba.apk
 * Or override with VITE_ANDROID_APK_URL.
 */
export const ANDROID_APK_PATH = "/downloads/Muktosheba.apk";

export function androidApkUrl(): string {
  const env = String(import.meta.env.VITE_ANDROID_APK_URL ?? "").trim();
  if (env) return env;
  return ANDROID_APK_PATH;
}

export function isAndroidUserAgent(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /Android/i.test(ua);
}
