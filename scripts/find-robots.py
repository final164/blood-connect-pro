import os
import urllib.request

for dirpath, dirnames, filenames in os.walk("/var/www/blood"):
    dirnames[:] = [name for name in dirnames if name not in {"node_modules", ".git"}]
    for name in filenames:
        if name == "robots.txt":
            path = os.path.join(dirpath, name)
            print("FILE", path, os.path.getsize(path))

req = urllib.request.Request("https://spandonbd.com/robots.txt")
with urllib.request.urlopen(req, timeout=20) as res:
    body = res.read()
    print("STATUS", res.status)
    print("LEN_HDR", res.headers.get("content-length"))
    print("MOD", res.headers.get("last-modified"))
    print("ETAG", res.headers.get("etag"))
print("HTTP", len(body))
print(body.decode())
