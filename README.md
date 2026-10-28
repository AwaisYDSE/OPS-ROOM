# Ops Room — free AI news streamer

Built by Awais Amin.

A home-screen app for iPhone: a 3D globe "operations room" that reads the news aloud
and answers questions about it.

- **News:** refreshed every hour, free, by GitHub Actions (`update_news.py` → `news.json`).
- **Voice:** the iPhone's built-in speech, free.
- **Questions:** Google Gemini with a free API key (paste it in the app's Settings).
  Optionally add the same key as the repo secret `GEMINI_API_KEY` so the hourly
  briefing is written as a dialogue by AI.

Install on iPhone: open the site in Safari → Share → **Add to Home Screen**.
