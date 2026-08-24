import type { CapacitorConfig } from "@capacitor/cli";

/**
 * BloodLink native shell — loads the live web app (design-identical).
 * Change CAP_SERVER_URL only via env at build time if needed.
 */
const SERVER_URL =
  process.env.CAP_SERVER_URL?.trim() || "https://blood.pgdiary.cloud";

const config: CapacitorConfig = {
  appId: "app.bloodlink.care",
  appName: "BloodLink",
  webDir: "www",
  // Remote URL keeps Lovable/web deploys in sync with zero UI drift.
  server: {
    url: SERVER_URL,
    cleartext: false,
    androidScheme: "https",
    hostname: "blood.pgdiary.cloud",
    allowNavigation: [
      "blood.pgdiary.cloud",
      "*.pgdiary.cloud",
      "*.supabase.co",
      "accounts.google.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#c1121f",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#c1121f",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#c1121f",
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: "#c1121f",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "BloodLink",
  },
};

export default config;
