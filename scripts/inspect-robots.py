import urllib.request
from pathlib import Path

body = urllib.request.urlopen("http://127.0.0.1:3000/robots.txt", timeout=20).read()
print("HTTP", len(body))
print(repr(body))
for path in [
    Path("/var/www/blood/.output/public/robots.txt"),
    Path("/var/www/blood/public/robots.txt"),
]:
    data = path.read_bytes() if path.exists() else b""
    print(path, path.exists(), len(data))
