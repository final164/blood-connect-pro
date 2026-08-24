/**
 * Capacitor native bridge — no UI redesign.
 * Safe no-ops on web; full behavior inside Android/iOS shells.
 */
import { Capacitor } from "@capacitor/core";

export const isNativeApp = () =>
  typeof window !== "undefined" && Capacitor.isNativePlatform();

export const nativePlatform = () =>
  isNativeApp() ? Capacitor.getPlatform() : "web";

const APP_HOST = "blood.pgdiary.cloud";
const CUSTOM_SCHEME = "bloodlink";

function sameAppHost(url: URL) {
  return url.hostname === APP_HOST || url.hostname.endsWith(".pgdiary.cloud");
}

function pathFromAppUrl(raw: string): string | null {
  try {
    if (raw.startsWith(`${CUSTOM_SCHEME}://`)) {
      const rest = raw.slice(`${CUSTOM_SCHEME}://`.length);
      return rest.startsWith("/") ? rest : `/${rest}`;
    }
    const u = new URL(raw);
    if (sameAppHost(u)) return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    /* ignore */
  }
  return null;
}

/** Light haptic for CTA taps (layout unchanged). */
export async function nativeHapticLight() {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* plugin missing */
  }
}

export async function nativeShare(opts: { title?: string; text?: string; url?: string }) {
  if (!isNativeApp()) {
    if (opts.url && navigator.share) {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    }
    return false;
  }
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: opts.title,
      text: opts.text,
      url: opts.url,
      dialogTitle: opts.title || "BloodLink",
    });
    await nativeHapticLight();
    return true;
  } catch {
    return false;
  }
}

export async function nativeOpenExternal(url: string) {
  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
  } catch {
    window.open(url, "_blank");
  }
}

export async function nativePrefGet(key: string): Promise<string | null> {
  if (!isNativeApp()) {
    try {
      return localStorage.getItem(`bl:native:${key}`);
    } catch {
      return null;
    }
  }
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    return null;
  }
}

export async function nativePrefSet(key: string, value: string) {
  if (!isNativeApp()) {
    try {
      localStorage.setItem(`bl:native:${key}`, value);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    /* ignore */
  }
}

/**
 * Boot native chrome once per session. Call from root (client).
 * Never throws — splash always hides; bad plugins must not blank the shell.
 */
export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  if ((window as unknown as { __blNativeReady?: boolean }).__blNativeReady) return;
  (window as unknown as { __blNativeReady?: boolean }).__blNativeReady = true;

  let SplashScreen: Awaited<typeof import("@capacitor/splash-screen")>["SplashScreen"] | null =
    null;

  const hideSplash = () => {
    if (!SplashScreen) return;
    void SplashScreen.hide({ fadeOutDuration: 280 }).catch(() => {});
  };

  try {
    const mods = await Promise.all([
      import("@capacitor/splash-screen"),
      import("@capacitor/status-bar"),
      import("@capacitor/app"),
      import("@capacitor/keyboard"),
    ]);
    SplashScreen = mods[0].SplashScreen;
    const { StatusBar, Style } = mods[1];
    const { App } = mods[2];
    const { Keyboard } = mods[3];

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#c1121f" });
    } catch {
      /* webview / older OS */
    }

    try {
      await Keyboard.setScroll({ isDisabled: false });
    } catch {
      /* iOS/Android differences */
    }

    if (document.readyState === "complete") hideSplash();
    else window.addEventListener("load", hideSplash, { once: true });
    window.setTimeout(hideSplash, 2500);

    // Only trust Capacitor WebView canGoBack — history.length is unreliable and
    // was sending first-launch back into a blank entry (app looked like it closed).
    let lastBackAt = 0;
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      const now = Date.now();
      if (now - lastBackAt < 1800) {
        void App.minimizeApp();
        return;
      }
      lastBackAt = now;
    });

    App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      void StatusBar.setBackgroundColor({ color: "#c1121f" }).catch(() => {});
    });

    const navigateDeep = (raw: string) => {
      const path = pathFromAppUrl(raw);
      if (!path) return;
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (path === here || path === "/" || path === "") return;
      // In-app path change without leaving the Capacitor origin
      window.location.assign(path);
    };

    App.addListener("appUrlOpen", ({ url }) => navigateDeep(url));

    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) navigateDeep(launch.url);
    } catch {
      /* no launch url */
    }

    document.addEventListener(
      "click",
      (ev) => {
        const t = ev.target as HTMLElement | null;
        const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!a?.href) return;
        let u: URL;
        try {
          u = new URL(a.href, window.location.href);
        } catch {
          return;
        }
        if (u.protocol !== "http:" && u.protocol !== "https:") return;
        if (sameAppHost(u)) return;
        ev.preventDefault();
        void nativeOpenExternal(u.toString());
      },
      true,
    );

    document.documentElement.classList.add("native-capacitor");
    document.documentElement.dataset.nativePlatform = nativePlatform();
  } catch {
    hideSplash();
    window.setTimeout(hideSplash, 500);
  }
}
