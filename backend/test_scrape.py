import requests
import re
import json

url = "https://www.kaggle.com/gopi0505"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
resp = requests.get(url, headers=headers)
html = resp.text

# Let's search for script tags containing 'application/json' or global variables
scripts = re.findall(r'<script\b[^>]*>(.*?)</script>', html, re.DOTALL)
matches = []
for i, s in enumerate(scripts):
    if "initialState" in s or "State" in s:
        matches.append(f"Script {i} (len {len(s)}):\n{s[:1000]}\n...\n")

# Also let's extract any JSON objects inside window.Kaggle.State
# Or look for text like "performance" or "tier" to see context
performance_occurrences = [m.start() for m in re.finditer(r'tier|medal|competition', html, re.IGNORECASE)]
ctx_list = []
for idx in performance_occurrences[:10]:
    start = max(0, idx - 100)
    end = min(len(html), idx + 100)
    ctx_list.append(f"Match at {idx}: {html[start:end]}")

with open("kaggle_scrape_info.txt", "w", encoding="utf-8") as f:
    f.write("MATCHING SCRIPTS:\n" + "\n".join(matches) + "\n\nCONTEXTS:\n" + "\n".join(ctx_list))

print("Done writing to kaggle_scrape_info.txt")
