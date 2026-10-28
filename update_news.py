#!/usr/bin/env python3
"""Pull free RSS news feeds and write news.json (+ translations) for the Ops Room app.

Runs every hour on GitHub Actions (free for public repos). A free AI (pollinations.ai,
no key) writes the Operator/Commander/Analyst dialogue and the translations. If a free
Gemini API key is saved as the GEMINI_API_KEY secret, Gemini is used instead.
Built by Awais Amin.
"""
import email.utils
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "news.json")
UA = "Mozilla/5.0 (OpsRoom news app; +https://github.com)"


def gnews(q):
    return ("https://news.google.com/rss/search?q=" + urllib.parse.quote(q + " when:1d")
            + "&hl=en-AE&gl=AE&ceid=AE:en")


# (url, weight) — higher weight = more likely to be picked
FEEDS = [
    ("https://news.google.com/rss?hl=en-AE&gl=AE&ceid=AE:en", 3),
    ("https://feeds.bbci.co.uk/news/world/rss.xml", 3),
    ("https://www.aljazeera.com/xml/rss/all.xml", 3),
    ("https://www.dawn.com/feeds/home", 2),
    (gnews("UAE OR Dubai OR Sharjah OR \"Abu Dhabi\""), 3),
    (gnews("Pakistan"), 2),
    (gnews("Iran OR Hormuz OR Houthi"), 2),
    (gnews("oil prices OR Brent OR gold price"), 2),
    (gnews("Saudi Arabia OR Qatar OR Oman OR Kuwait"), 1),
    (gnews("Ukraine OR Russia OR China OR Taiwan OR \"North Korea\""), 1),
    (gnews("Africa OR Iraq OR Georgia OR Uzbekistan OR Tajikistan"), 1),
]

# keyword -> (map country name or None, label, lat, lon, flag)
PLACES = [
    (r"hormuz", ("Iran", "STRAIT OF HORMUZ", 26.6, 56.4, "🇮🇷")),
    (r"\b(uae|emirati|dubai|sharjah|abu dhabi|ajman|ras al khaimah|fujairah|emirates|flydubai|etihad)\b",
     ("United Arab Emirates", "UNITED ARAB EMIRATES", 25.2, 55.3, "🇦🇪")),
    (r"\b(pakistan\w*|karachi|lahore|islamabad|peshawar|khyber|balochistan|quetta|rawalpindi|swabi)\b",
     ("Pakistan", "PAKISTAN", 30.4, 69.3, "🇵🇰")),
    (r"\b(iran\w*|tehran|khamenei|pezeshkian|irgc|araghchi)\b", ("Iran", "IRAN", 32.4, 53.7, "🇮🇷")),
    (r"\b(israel\w*|netanyahu|tel aviv|jerusalem|idf)\b", ("Israel", "ISRAEL", 31.4, 35.0, "🇮🇱")),
    (r"\b(gaza|west bank|palestin\w*|hamas)\b", ("Palestine", "PALESTINE", 31.6, 34.6, "🇵🇸")),
    (r"\b(lebanon|lebanese|hezbollah|beirut)\b", ("Lebanon", "LEBANON", 33.9, 35.8, "🇱🇧")),
    (r"\b(saudi\w*|riyadh|jeddah|aramco|mbs)\b", ("Saudi Arabia", "SAUDI ARABIA", 24.7, 46.7, "🇸🇦")),
    (r"\b(yemen\w*|houthi\w*|sanaa|aden)\b", ("Yemen", "YEMEN", 15.5, 48.0, "🇾🇪")),
    (r"\b(qatar\w*|doha)\b", ("Qatar", "QATAR", 25.3, 51.2, "🇶🇦")),
    (r"\b(oman\w*|muscat)\b", ("Oman", "OMAN", 21.5, 57.0, "🇴🇲")),
    (r"\b(kuwait\w*)\b", ("Kuwait", "KUWAIT", 29.3, 47.7, "🇰🇼")),
    (r"\b(bahrain\w*|manama)\b", ("Bahrain", "BAHRAIN", 26.1, 50.6, "🇧🇭")),
    (r"\b(iraq\w*|baghdad|basra|erbil)\b", ("Iraq", "IRAQ", 33.2, 43.7, "🇮🇶")),
    (r"\b(syria\w*|damascus)\b", ("Syria", "SYRIA", 35.0, 38.5, "🇸🇾")),
    (r"\b(egypt\w*|cairo|suez)\b", ("Egypt", "EGYPT", 26.8, 30.8, "🇪🇬")),
    (r"\b(turkey|turkish|türkiye|ankara|istanbul|erdogan)\b", ("Turkey", "TURKEY", 39.0, 35.2, "🇹🇷")),
    (r"\b(afghan\w*|kabul|taliban)\b", ("Afghanistan", "AFGHANISTAN", 33.9, 67.7, "🇦🇫")),
    (r"\b(india\w*|delhi|mumbai|modi)\b", ("India", "INDIA", 22.0, 79.0, "🇮🇳")),
    (r"\b(ukrain\w*|kyiv|zelensky\w*)\b", ("Ukraine", "UKRAINE", 49.0, 31.4, "🇺🇦")),
    (r"\b(russia\w*|moscow|kremlin|putin)\b", ("Russia", "RUSSIA", 55.75, 37.6, "🇷🇺")),
    (r"\b(china|chinese|beijing|xi jinping|shanghai|guangzhou)\b", ("China", "CHINA", 35.0, 104.0, "🇨🇳")),
    (r"\b(taiwan\w*|taipei)\b", ("Taiwan", "TAIWAN", 23.7, 121.0, "🇹🇼")),
    (r"\b(north korea\w*|pyongyang|kim jong)\b", ("North Korea", "NORTH KOREA", 40.0, 127.0, "🇰🇵")),
    (r"\b(south korea\w*|seoul)\b", ("South Korea", "SOUTH KOREA", 36.5, 127.8, "🇰🇷")),
    (r"\b(japan\w*|tokyo)\b", ("Japan", "JAPAN", 36.2, 138.3, "🇯🇵")),
    (r"\b(uzbek\w*|tashkent)\b", ("Uzbekistan", "UZBEKISTAN", 41.4, 64.6, "🇺🇿")),
    (r"\b(tajik\w*|dushanbe)\b", ("Tajikistan", "TAJIKISTAN", 38.9, 71.3, "🇹🇯")),
    (r"\b(georgia's|tbilisi|georgian)\b", ("Georgia", "GEORGIA", 42.3, 43.4, "🇬🇪")),
    (r"\b(nigeria\w*|lagos|abuja)\b", ("Nigeria", "NIGERIA", 9.1, 8.7, "🇳🇬")),
    (r"\b(kenya\w*|nairobi)\b", ("Kenya", "KENYA", 0.0, 37.9, "🇰🇪")),
    (r"\b(sudan\w*|khartoum)\b", ("Sudan", "SUDAN", 15.5, 30.2, "🇸🇩")),
    (r"\b(ethiopia\w*|addis ababa)\b", ("Ethiopia", "ETHIOPIA", 9.1, 40.5, "🇪🇹")),
    (r"\b(somalia\w*|mogadishu)\b", ("Somalia", "SOMALIA", 5.2, 46.2, "🇸🇴")),
    (r"\b(south africa\w*|johannesburg|cape town)\b", ("South Africa", "SOUTH AFRICA", -30.6, 22.9, "🇿🇦")),
    (r"\b(uk|britain|british|london|starmer)\b", ("United Kingdom", "UNITED KINGDOM", 52.5, -1.5, "🇬🇧")),
    (r"\b(france|french|paris|macron)\b", ("France", "FRANCE", 46.6, 2.2, "🇫🇷")),
    (r"\b(germany|german|berlin)\b", ("Germany", "GERMANY", 51.2, 10.4, "🇩🇪")),
    (r"(?-i:\bUS\b)|\b(u\.s\.|usa|america\w*|washington|pentagon|white house|trump|congress)\b",
     ("United States of America", "UNITED STATES", 39.0, -98.0, "🇺🇸")),
]
PLACES = [(re.compile(p, re.I), v) for p, v in PLACES]

CRITICAL = re.compile(r"\b(missile|strike[sd]?|airstrike|killed|kills|dead|attack\w*|war\b|explosion|blast|bomb\w*|invasion|mines?\b|drone attack|shot down|intercept\w*)", re.I)
HIGH = re.compile(r"\b(military|troops|army|navy|sanction\w*|protest\w*|clash\w*|emergency|ceasefire|nuclear|threat\w*|arrest\w*|charged|evacuat\w*|earthquake|flood\w*)", re.I)
MARKETS = re.compile(r"\b(oil|brent|crude|stocks?|shares|gold|market\w*|prices?|inflation|interest rate|rate hike|economy|dollar|rupee|dirham|bitcoin|trade)\b", re.I)
WATCH = re.compile(r"\b(flight\w*|airline\w*|airport|travel|visa|talks|summit|election\w*|vote)\b", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def clean(text):
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"\s+", " ", text).strip()


def parse_feed(data, weight):
    items = []
    root = ET.fromstring(data)
    for it in root.iter("item"):
        title = clean(it.findtext("title"))
        if not title:
            continue
        link = (it.findtext("link") or "").strip()
        desc = clean(it.findtext("description"))
        src_el = it.find("source")
        source = clean(src_el.text) if src_el is not None and src_el.text else ""
        # Google News titles end in " - Source"
        m = re.match(r"^(.*) - ([^-]{2,60})$", title)
        if m and ("news.google" in link or not source):
            title, source = m.group(1).strip(), source or m.group(2).strip()
        if desc.startswith(title[:30]) or "news.google" in link:
            desc = ""  # Google News descriptions only repeat the title
        when = None
        pd = it.findtext("pubDate")
        if pd:
            try:
                when = email.utils.parsedate_to_datetime(pd).astimezone(timezone.utc)
            except Exception:
                when = None
        if not source:
            host = urllib.parse.urlparse(link).netloc.replace("www.", "")
            source = host
        items.append({"title": title, "desc": desc, "link": link, "source": source,
                      "when": when, "weight": weight})
    return items


STOP = {"the", "a", "an", "to", "of", "in", "on", "for", "and", "as", "at", "with", "after", "is", "says", "by",
        "from", "over", "amid", "its", "new", "news", "other", "live", "updates", "during", "said"}


def words_of(title):
    return {w for w in re.findall(r"[a-z0-9]+", title.lower()) if w not in STOP and len(w) > 2}


def overlap(a, b):
    if not a or not b:
        return 0
    return len(a & b) / min(len(a), len(b))


def place_for(text):
    for rx, v in PLACES:
        if rx.search(text):
            return v
    return None


SOFT = re.compile(r"\b(honou?rs?\w*|awards?\w*|celebrat\w*|festival|wins?|launch\w*)\b", re.I)
MKT_STRONG = re.compile(r"\b(oil prices?|brent|wti|crude|gold price|stocks?|shares|forecast|markets?)\b", re.I)


def severity_for(text):
    if MKT_STRONG.search(text):
        return "markets"
    if SOFT.search(text):
        return "info"
    if CRITICAL.search(text):
        return "critical"
    if MARKETS.search(text):
        return "markets"
    if HIGH.search(text):
        return "high"
    if WATCH.search(text):
        return "watch"
    return "info"


COMMANDER_ASKS = {
    "critical": ["Any casualties?", "What do we know so far?", "Is it confirmed?", "Who is behind it?"],
    "high": ["What's the situation now?", "Give me the details.", "How serious is it?"],
    "markets": ["What does it mean for prices?", "Why the move?"],
    "watch": ["What's the impact?", "Okay. Details?"],
    "info": ["Okay, what else?", "Understood. Go on."],
}


def first_sentences(text, limit=260):
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    out = ""
    for p in parts:
        if len(out) + len(p) > limit and out:
            break
        out = (out + " " + p).strip()
    return out[:limit]


def heuristic(candidates, n=14):
    stories, seen_place = [], {}
    for i, c in enumerate(candidates):
        text = c["title"] + " " + c["desc"]
        pl = place_for(text)
        if not pl:
            continue
        country = pl[0]
        if seen_place.get(country, 0) >= 2:
            continue
        seen_place[country] = seen_place.get(country, 0) + 1
        sev = severity_for(text)
        summary = first_sentences(c["desc"]) or c["title"]
        asks = COMMANDER_ASKS[sev]
        lines = [{"role": "OPERATOR", "text": c["title"] + "."}]
        if c["desc"] and summary != c["title"]:
            lines.append({"role": "COMMANDER", "text": asks[i % len(asks)]})
            lines.append({"role": "ANALYST", "text": summary})
        stories.append({
            "id": re.sub(r"[^a-z0-9]+", "-", c["title"].lower())[:48],
            "country": country, "label": pl[1], "lat": pl[2], "lon": pl[3], "flag": pl[4],
            "severity": sev, "category": sev,
            "headline": c["title"], "summary": summary,
            "lines": lines, "source": c["source"], "url": c["link"],
            "time": c["when"].isoformat().replace("+00:00", "Z") if c["when"] else None,
        })
        if len(stories) >= n:
            break
    return stories


GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
LANGS = {"ur": "Urdu (Urdu script)", "ar": "Arabic", "hi": "Hindi (Devanagari)", "zh": "Simplified Chinese",
         "ru": "Russian", "fr": "French"}
_free_next = [0.0]


def _post(url, payload, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _gemini_text(prompt, key):
    last = None
    for model in GEMINI_MODELS:
        try:
            data = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                         {"contents": [{"parts": [{"text": prompt}]}],
                          "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4}})
            return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
        except Exception as e:
            last = e
            print(f"gemini {model} failed: {e}", file=sys.stderr)
    raise RuntimeError(f"Gemini failed: {last}")


def _free_text(prompt):
    """pollinations.ai: free, no key; one request at a time, ~30 s apart."""
    last = None
    for _ in range(4):
        wait = _free_next[0] - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            data = _post("https://text.pollinations.ai/openai",
                         {"model": "openai", "private": True, "referrer": "opsroom",
                          "messages": [{"role": "system", "content": "You return only valid JSON, no commentary."},
                                       {"role": "user", "content": prompt}]}, timeout=180)
            _free_next[0] = time.time() + 32
            return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            last = e
            ra = e.headers.get("Retry-After") if e.headers else None
            _free_next[0] = time.time() + (int(ra) if ra and ra.isdigit() else 35)
        except Exception as e:
            last = e
            _free_next[0] = time.time() + 35
    raise RuntimeError(f"free AI failed: {last}")


def llm_json(prompt, key):
    text = _gemini_text(prompt, key) if key else _free_text(prompt)
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    a, b = text.find("["), text.rfind("]")
    c, d = text.find("{"), text.rfind("}")
    if a != -1 and (c == -1 or a < c):
        text = text[a:b + 1]
    elif c != -1:
        text = text[c:d + 1]
    return json.loads(text)


def editor(candidates, key):
    listing = "\n".join(
        f"{i+1}. [{c['source']}] {c['title']} — {c['desc'][:300]} ({c['link']})"
        for i, c in enumerate(candidates[:40]))
    prompt = f"""You are the editor of a TV-style "Operations Room" news stream for a businessman in Sharjah, UAE
(auto spare parts trader, from Pakistan, exports to Africa, Iraq, Middle East, Georgia, Central Asia).
From the headlines below, pick the 14 most important stories of the day: world security first, then
UAE, Pakistan, Gulf, oil/gold/markets, shipping and trade. Merge duplicates. Use ONLY facts in the headlines.

Return ONLY a JSON array. Each item:
{{"id": short-slug, "country": exact country name as in Natural Earth maps (e.g. "United States of America",
"United Arab Emirates", "Iran") or null for global, "label": UPPERCASE place label, "lat": number, "lon": number,
"flag": emoji flag, "severity": one of critical|high|markets|watch|info, "category": one word,
"headline": max 70 chars, "summary": 1-2 sentences max 260 chars,
"lines": 3 dialogue lines [{{"role":"OPERATOR"|"COMMANDER"|"ANALYST","text": short spoken sentence}}]
(OPERATOR reports the news, COMMANDER asks one short question, ANALYST answers it with facts; write numbers so they read well aloud),
"source": outlet name, "url": link from the list, "time": null}}

Headlines:
{listing}"""
    arr = llm_json(prompt, key)
    if isinstance(arr, dict):
        arr = arr.get("stories") or next(iter(arr.values()))
    good = []
    for s in arr:
        if not isinstance(s, dict) or not s.get("headline") or not s.get("lines"):
            continue
        try:
            s["lat"] = float(s.get("lat") or 0)
            s["lon"] = float(s.get("lon") or 0)
        except (TypeError, ValueError):
            continue
        s["lines"] = [l for l in s["lines"] if isinstance(l, dict) and l.get("text")][:4]
        if s.get("severity") not in ("critical", "high", "markets", "watch", "info"):
            s["severity"] = "info"
        good.append(s)
    if len(good) < 5:
        raise RuntimeError("editor returned too few stories")
    return good


def translate(stories, code, key):
    """Translate the spoken/visible text of every story; keep everything else."""
    slim = [{"i": i, "label": s.get("label", ""), "headline": s["headline"], "summary": s.get("summary", ""),
             "lines": [l["text"] for l in s["lines"]]} for i, s in enumerate(stories)]
    prompt = (f"Translate the text fields of this JSON array into {LANGS[code]} for a TV news broadcast. "
              "Keep the same structure, the same 'i' numbers and the same number of lines. "
              "Keep names correct; write numbers naturally for speaking. Return ONLY the JSON array.\n\n"
              + json.dumps(slim, ensure_ascii=False))
    arr = llm_json(prompt, key)
    if isinstance(arr, dict):
        arr = next(iter(arr.values()))
    by_i = {int(x["i"]): x for x in arr if isinstance(x, dict) and "i" in x}
    out = []
    for i, s in enumerate(stories):
        t = by_i.get(i)
        if not t or not t.get("headline"):
            raise RuntimeError(f"missing translation for story {i}")
        n = dict(s)
        n["label"] = t.get("label") or s.get("label")
        n["headline"] = t["headline"]
        n["summary"] = t.get("summary") or s.get("summary", "")
        tl = t.get("lines") or []
        n["lines"] = [{"role": l["role"], "text": (tl[j] if j < len(tl) and tl[j] else l["text"])}
                      for j, l in enumerate(s["lines"])]
        out.append(n)
    return out


def main():
    all_items = []
    for url, w in FEEDS:
        try:
            all_items += parse_feed(fetch(url), w)
        except Exception as e:
            print(f"feed failed {url}: {e}", file=sys.stderr)
    if len(all_items) < 5:
        print("Too few items; keeping the old news.json", file=sys.stderr)
        return 0

    now = datetime.now(timezone.utc)
    items = []
    for it in all_items:
        ws = words_of(it["title"])
        dup = next((x for x in items if overlap(ws, x["_w"]) >= 0.45), None)
        if dup:
            dup["weight"] += 1  # reported by several feeds = more important
            if not dup["desc"] and it["desc"]:
                dup["desc"] = it["desc"]
        else:
            it["_w"] = ws
            items.append(it)

    def score(it):
        text = it["title"] + " " + it["desc"]
        age_h = (now - it["when"]).total_seconds() / 3600 if it["when"] else 12
        if age_h > 36:
            return -99
        s = it["weight"] * 2 - age_h * 0.25 + (2 if it["desc"] else 0)
        sev = severity_for(text)
        s += {"critical": 6, "high": 4, "markets": 3, "watch": 2, "info": 0}[sev]
        if re.search(r"\b(uae|dubai|sharjah|pakistan|hormuz|oil|gold)\b", text, re.I):
            s += 3
        return s

    items.sort(key=score, reverse=True)
    items = [i for i in items if score(i) > -99]

    stories, generator = None, "rss"
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    try:
        stories = editor(items, key)
        generator = "gemini" if key else "free-ai"
    except Exception as e:
        print(f"AI editor failed, using plain headlines: {e}", file=sys.stderr)
    if not stories:
        stories = heuristic(items)
    if len(stories) < 3:
        print("Too few stories; keeping the old news.json", file=sys.stderr)
        return 0

    stamp = now.isoformat().replace("+00:00", "Z")
    out = {"updated": stamp, "generator": generator, "stories": stories}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"Wrote {len(stories)} stories via {generator}")

    for code in LANGS:
        try:
            tr = translate(stories, code, key)
            with open(os.path.join(ROOT, f"news-{code}.json"), "w", encoding="utf-8") as f:
                json.dump({"updated": stamp, "generator": generator, "lang": code, "stories": tr},
                          f, ensure_ascii=False, indent=1)
            print(f"Translated into {code}")
        except Exception as e:
            print(f"translation {code} failed (keeping previous file): {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
