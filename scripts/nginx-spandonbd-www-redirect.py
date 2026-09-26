from pathlib import Path

path = Path("/etc/nginx/sites-enabled/spandonbd.com")
text = path.read_text()
marker = "return 301 https://spandonbd.com$request_uri;"
if marker in text:
    print("redirect already present")
else:
    snippet = """
    if ($host = www.spandonbd.com) {
        return 301 https://spandonbd.com$request_uri;
    }

"""
    blocks = text.split("server {")
    placed = False
    out = [blocks[0]]
    for block in blocks[1:]:
        if not placed and "listen 443" in block:
            needle = "    location "
            at = block.find(needle)
            if at == -1:
                raise SystemExit("443 server has no location")
            block = block[:at] + snippet + block[at:]
            placed = True
        out.append("server {" + block)
    if not placed:
        raise SystemExit("no 443 server block")
    path.write_text("".join(out))
    print("updated")
