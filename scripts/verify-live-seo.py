import urllib.request

def get(url):
    return urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")

robots = get("https://spandonbd.com/robots.txt")
print("ROBOTS_LEN", len(robots))
print(robots)
html = get("https://spandonbd.com/")
html = get("https://spandonbd.com/")
start = html.find("<title>")
end = html.find("</title>")
print("TITLE", html[start:end])
for needle in ["rel=\"canonical\"", "og:image", "og:url", "name=\"description\"", "name=\"robots\""]:
    i = html.find(needle)
    print(needle, html[i:i + 160].replace("\n", " ") if i >= 0 else "MISSING")
