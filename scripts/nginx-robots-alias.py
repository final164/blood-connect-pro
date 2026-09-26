from pathlib import Path

path = Path("/etc/nginx/sites-enabled/spandonbd.com")
text = path.read_text()
marker = "location = /robots.txt"
block = """    location = /robots.txt {
        root /var/www/blood/.output/public;
        default_type text/plain;
        charset utf-8;
    }

"""
old = """    location = /robots.txt {
        alias /var/www/blood/.output/public/robots.txt;
        default_type text/plain;
        charset utf-8;
    }

"""
if old in text:
    path.write_text(text.replace(old, block, 1))
    print("rewritten")
elif marker in text:
    print("already present")
else:
    needle = "    location /assets/"
    fallback = "    location / {"
    if needle in text:
        text = text.replace(needle, block + needle, 1)
    elif fallback in text:
        text = text.replace(fallback, block + fallback, 1)
    else:
        raise SystemExit("no insertion point")
    path.write_text(text)
    print("updated")
