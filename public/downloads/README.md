# Android APK for website download

APK is **gitignored** (`public/downloads/*.apk`). Nitro only serves files that exist at **build time**.

## Local / VPS upload

1. Build: `npm run cap:apk` (or `cd android && ./gradlew assembleDebug`)
2. Copy to:
   - Local: `public/downloads/Muktosheba.apk`
   - VPS (persistent, survives `git reset`): `/var/www/blood-assets/downloads/Muktosheba.apk`
3. Nginx serves `https://blood.pgdiary.cloud/downloads/Muktosheba.apk` from that assets path.
4. `scripts/vps-redeploy.sh` also copies the assets APK into `public/downloads/` **before** `npm run build` so Node can serve it after rebuild.

Optional: `VITE_ANDROID_APK_URL=https://...` overrides the download URL.
