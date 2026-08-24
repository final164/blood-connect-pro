# Android APK for website download

1. Build: `cd android && .\\gradlew.bat assembleDebug`
2. Copy:
   `Copy-Item android\\app\\build\\outputs\\apk\\debug\\app-debug.apk public\\downloads\\BloodLink.apk`
3. Deploy web so `https://blood.pgdiary.cloud/downloads/BloodLink.apk` serves the file.

Optional env: `VITE_ANDROID_APK_URL=https://...` overrides the path.
