import re
import time
import urllib.request

urllib.request.urlopen("https://spandonbd.com/", timeout=40).read()
time.sleep(3)
html = urllib.request.urlopen("https://spandonbd.com/", timeout=40).read().decode("utf-8", "replace")
print("LEN", len(html))
print("H1", re.findall(r"<h1[^>]*>.*?</h1>", html, flags=re.I | re.S)[:3])
for phrase in ["রক্তদাতা খুঁজুন", "জরুরি রক্ত", "ব্লাড ডোনার", "BloodLink", "canonical"]:
    print(phrase, phrase in html)
title = html[html.find("<title>"): html.find("</title>")]
desc = re.search(r'name="description" content="([^"]*)"', html)
print("TITLE", title)
print("DESC", desc.group(1)[:220] if desc else None)
print("CANON", re.search(r'rel="canonical" href="([^"]+)"', html).group(1) if re.search(r'rel="canonical" href="([^"]+)"', html) else None)
