from pathlib import Path

p = Path("/etc/nginx/sites-available/blood.pgdiary.cloud")
text = p.read_text()

new_block = """
    # Android APK (outside git/build; Nitro only serves build-time public assets)
    location = /downloads/BloodLink.apk {
        root /var/www/blood-assets;
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition "attachment; filename=BloodLink.apk";
        add_header Cache-Control "public, max-age=3600";
    }

"""

start = text.find("# Android APK")
loc = text.find("    location / {")
if start != -1 and loc != -1 and start < loc:
    cut = text.rfind("\n", 0, start)
    text = text[: cut + 1] + new_block + text[loc:]
elif loc != -1:
    text = text[:loc] + new_block + text[loc:]
else:
    raise SystemExit("could not find insertion point")

p.write_text(text)
print("ok")
