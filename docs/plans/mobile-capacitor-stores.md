# BloodLink mobile (Capacitor) — Play / App Store

Status: native shell ready. UI = live web at `https://blood.pgdiary.cloud` (no redesign).

## App identity

| Key | Value |
|-----|--------|
| appId | `app.bloodlink.care` |
| appName | BloodLink |
| server.url | `https://blood.pgdiary.cloud` |
| Custom scheme | `bloodlink://` |

## One-time setup

```bash
npm install
npm run cap:add:android   # Windows OK
npm run cap:add:ios       # Mac required to build/sign
npm run cap:sync
```

### Firebase (native push)

1. Create Firebase project → add Android app `app.bloodlink.care`
2. Download `google-services.json` → `android/app/google-services.json` (gitignored)
3. iOS: `GoogleService-Info.plist` → `ios/App/App/`
4. Supabase Edge secret: `FCM_SERVER_KEY` (Firebase Cloud Messaging legacy server key)  
   Redeploy: `supabase functions deploy send-push`
5. Apply migration: `20260824100000_native_push_platform.sql`

### Deep links (Android App Links)

Host at `https://blood.pgdiary.cloud/.well-known/assetlinks.json` (after you have signing cert SHA-256):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.bloodlink.care",
    "sha256_cert_fingerprints": ["YOUR_UPLOAD_KEY_SHA256"]
  }
}]
```

Custom scheme works immediately: `bloodlink://feed` / `bloodlink://ambulance/request/...`

## Build Play Store AAB

1. Android Studio → Open `android/`
2. Create upload keystore (keep offline backup)
3. `Build` → `Generate Signed Bundle / APK` → Android App Bundle
4. Play Console → create app → Internal testing → upload AAB

### Play policy checklist

- [ ] Privacy policy URL (in-app + listing)
- [ ] Data safety form (phone, profile, notifications, AI text)
- [ ] Account deletion (in-app + web URL)
- [ ] Store description disclaimer: *Not a medical device and does not diagnose, treat, cure, or prevent any medical condition.*
- [ ] AI Health: keep existing non-diagnosis disclaimer visible
- [ ] Only required permissions (notification; no unused SMS/camera)
- [ ] Target latest Play API level

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run cap:sync` | Copy www + plugins → android/ios |
| `npm run cap:android` | Open Android Studio |
| `npm run cap:ios` | Open Xcode (Mac) |

## What the shell does (no UI redesign)

- SplashScreen + StatusBar (brand `#c1121f`)
- Android back / lifecycle
- Keyboard resize
- Haptics on native share
- Push: FCM/APNs token → `push_subscriptions` (`fcm:` / `apns:`)
- External links → Capacitor Browser
- Preferences helpers (`nativePrefGet` / `nativePrefSet`)
- Deep links → in-app navigation

## Performance

- Live site behind Cloudflare CDN
- Existing Vite route code-splitting unchanged
- Hardware-accelerated WebView (default)
- Remote URL = zero design drift with Lovable deploys
