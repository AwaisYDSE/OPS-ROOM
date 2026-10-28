/* Ops Room — AI news streamer. Built by Awais Amin.
   All free: news.json is refreshed hourly by GitHub Actions, the voice is Google's free
   speech (phone voice as offline fallback), answers come from free AI (Gemini key optional). */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const SEV = {
    critical: { col: "#ff3341", glow: "rgba(255,51,65,", name: "Critical" },
    high: { col: "#ff9f1a", glow: "rgba(255,159,26,", name: "High" },
    markets: { col: "#2fd3b3", glow: "rgba(47,211,179,", name: "Markets" },
    watch: { col: "#f5d142", glow: "rgba(245,209,66,", name: "Watch" },
    info: { col: "#5b8cff", glow: "rgba(91,140,255,", name: "Info" },
  };
  const sev = (s) => SEV[s] || SEV.info;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= languages ================= */
  const LANGS = {
    en: { name: "English", tts: "en", sr: "en-US" },
    ur: { name: "اردو · Urdu", tts: "ur", sr: "ur-PK", rtl: true, ai: "Urdu (Urdu script)" },
    ar: { name: "العربية · Arabic", tts: "ar", sr: "ar-AE", rtl: true, ai: "Arabic" },
    hi: { name: "हिन्दी · Hindi", tts: "hi", sr: "hi-IN", ai: "Hindi" },
    zh: { name: "中文 · Chinese", tts: "zh-CN", sr: "zh-CN", ai: "Simplified Chinese" },
    ru: { name: "Русский · Russian", tts: "ru", sr: "ru-RU", ai: "Russian" },
    fr: { name: "Français · French", tts: "fr", sr: "fr-FR", ai: "French" },
  };
  let lang = store.get("lang", "en"); if (!LANGS[lang]) lang = "en";
  const PHRASE = {
    hello: { en: "{g}, sir. Operations room is live. {n} reports on the board.", ur: "السلام علیکم سر۔ آپریشنز روم لائیو ہے۔ بورڈ پر {n} رپورٹس ہیں۔", ar: "مرحباً سيدي. غرفة العمليات على الهواء. لدينا {n} تقارير.", hi: "नमस्ते सर। ऑपरेशंस रूम लाइव है। बोर्ड पर {n} रिपोर्ट्स हैं।", zh: "您好。作战室已上线，共有{n}条报告。", ru: "Здравствуйте. Оперативный штаб в эфире. На доске {n} сообщений.", fr: "Bonjour monsieur. La salle des opérations est en direct. {n} rapports à l'écran." },
    end: { en: "That's the full briefing, sir. Monitoring all sectors.", ur: "یہ تھی مکمل بریفنگ، سر۔ تمام محاذوں پر نظر ہے۔", ar: "هذا هو الموجز الكامل يا سيدي. نراقب جميع القطاعات.", hi: "यह थी पूरी ब्रीफिंग, सर। सभी क्षेत्रों पर नज़र है।", zh: "以上是完整简报。正在监控所有区域。", ru: "Это была полная сводка. Следим за всеми секторами.", fr: "C'était le briefing complet. Nous surveillons tous les secteurs." },
    fresh: { en: "New reports coming in.", ur: "نئی رپورٹس آ رہی ہیں۔", ar: "تقارير جديدة تصل الآن.", hi: "नई रिपोर्ट्स आ रही हैं।", zh: "新的报告正在传入。", ru: "Поступают новые сообщения.", fr: "De nouveaux rapports arrivent." },
  };
  const phrase = (k, vars = {}) => (PHRASE[k][lang] || PHRASE[k].en).replace(/\{(\w)\}/g, (_, v) => vars[v] ?? "");
  function applyLang() {
    $("app").classList.toggle("nolatin", lang !== "en" && lang !== "fr" && lang !== "ru");
    $("app").classList.toggle("rtl", !!LANGS[lang].rtl);
  }

  /* ================= state ================= */
  let news = { updated: null, stories: [] };
  let stories = [];
  let idx = 0, lineIdx = 0, playing = false, started = false, runId = 0;
  let wakeLock = null;

  /* ================= clock ================= */
  const pad = (n) => String(n).padStart(2, "0");
  function tick() {
    const d = new Date();
    $("clock").textContent = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  tick(); setInterval(tick, 1000);
  { const d = new Date(); $("introDate").textContent = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }

  function ago(iso) {
    if (!iso) return "";
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return "just now";
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const days = Math.round(h / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  }
  function toast(msg, ms = 2600) {
    const t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), ms);
  }

  /* ================= stars ================= */
  function drawStars() {
    const c = $("stars"), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const x = c.getContext("2d"); x.scale(dpr, dpr);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 160; i++) {
      x.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
      const r = rnd() * 1.1 + 0.2;
      x.beginPath(); x.arc(rnd() * innerWidth, rnd() * innerHeight, r, 0, 7); x.fill();
    }
  }

  /* ================= globe ================= */
  const gc = $("globe"), g = gc.getContext("2d");
  const proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
  const path = d3.geoPath(proj, g);
  const graticule = d3.geoGraticule10();
  let land = null, borders = null, byName = new Map();
  let W = 0, H = 0, R = 0, CY = 0;
  let rot = [-55, -22, 0], zoom = 1;          // current view
  let fly = null;                              // active flight tween
  let focus = null;                            // current story
  let pulseT = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    gc.width = W * dpr; gc.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W * 0.46, H * 0.3);
    CY = H * 0.46;
    drawStars();
  }

  async function loadWorld() {
    // light map for the globe (fast on phones), detailed shapes only for highlighting
    const world = await (await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json")).json();
    const obj = world.objects.countries;
    land = topojson.merge(world, obj.geometries);
    borders = topojson.mesh(world, obj, (a, b) => a !== b);
    for (const f of topojson.feature(world, obj).features) byName.set(f.properties.name, f);
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json").then((r) => r.json()).then((w) => {
      for (const f of topojson.feature(w, w.objects.countries).features) byName.set(f.properties.name, f);
    }).catch(() => {});
  }

  function flyTo(s) {
    focus = s;
    const target = [-s.lon, -Math.max(-60, Math.min(60, s.lat)), 0];
    const f = byName.get(s.country);
    let tz = 2.1;
    if (f) { // zoom so the country fills a good part of the globe
      const b = d3.geoBounds(f);
      const span = Math.max(Math.abs(b[1][0] - b[0][0]) % 360, Math.abs(b[1][1] - b[0][1]));
      tz = span > 60 ? 1.15 : span > 30 ? 1.5 : span > 12 ? 2.1 : 2.8;
    }
    if (s.country === null) tz = 1.3;
    const r0 = rot.slice(), z0 = zoom;
    // shortest way round
    let dl = target[0] - r0[0]; dl = ((dl + 540) % 360) - 180;
    const ri = d3.interpolate(r0, [r0[0] + dl, target[1], 0]);
    const t0 = performance.now(), dur = reduce ? 1 : 1800;
    const midZ = Math.min(z0, tz, 1) * 0.92; // pull back mid-flight
    fly = { t0, dur, ri, z0, tz, midZ };
  }

  function frame(now) {
    pulseT = now;
    if (fly) {
      let k = Math.min(1, (now - fly.t0) / fly.dur);
      const e = d3.easeCubicInOut(k);
      rot = fly.ri(e);
      zoom = k < 0.5 ? fly.z0 + (fly.midZ - fly.z0) * d3.easeCubicOut(k * 2)
                     : fly.midZ + (fly.tz - fly.midZ) * d3.easeCubicInOut((k - 0.5) * 2);
      if (k >= 1) fly = null;
    } else if (!playing && !reduce) {
      rot[0] += 0.04; // idle spin
      zoom += (1 - zoom) * 0.02;
    }
    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    if (!W) return;
    g.clearRect(0, 0, W, H);
    const r = R * zoom;
    proj.translate([W / 2, CY]).scale(r).rotate(rot);
    const s = focus ? sev(focus.severity) : { glow: "rgba(70,130,255," };

    // atmosphere glow
    const atm = g.createRadialGradient(W / 2, CY, r * 0.92, W / 2, CY, r * 1.18);
    atm.addColorStop(0, s.glow + "0.35)"); atm.addColorStop(0.35, s.glow + "0.12)"); atm.addColorStop(1, s.glow + "0)");
    g.fillStyle = atm; g.beginPath(); g.arc(W / 2, CY, r * 1.2, 0, 7); g.fill();

    // ocean
    const oc = g.createRadialGradient(W / 2 - r * 0.35, CY - r * 0.4, r * 0.1, W / 2, CY, r);
    oc.addColorStop(0, "#0d1824"); oc.addColorStop(1, "#03060a");
    g.fillStyle = oc; g.beginPath(); path({ type: "Sphere" }); g.fill();

    // graticule
    g.strokeStyle = "rgba(120,160,210,0.07)"; g.lineWidth = 0.6;
    g.beginPath(); path(graticule); g.stroke();

    if (land) {
      g.fillStyle = "#1a2029"; g.beginPath(); path(land); g.fill();
      g.strokeStyle = "rgba(160,175,195,0.22)"; g.lineWidth = 0.5;
      g.beginPath(); path(borders); g.stroke();

      // highlight focused country
      const f = focus && focus.country && byName.get(focus.country);
      if (f) {
        const ss = sev(focus.severity);
        g.fillStyle = ss.glow + "0.30)"; g.beginPath(); path(f); g.fill();
        g.strokeStyle = ss.glow + "0.35)"; g.lineWidth = 5; g.beginPath(); path(f); g.stroke();
        g.strokeStyle = ss.col; g.lineWidth = 1.4; g.stroke();
      }
    }

    // markers for all stories
    for (const st of stories) {
      const p = visible(st.lon, st.lat); if (!p) continue;
      const cur = st === focus, ss = sev(st.severity);
      g.fillStyle = cur ? "#fff" : ss.col;
      g.beginPath(); g.arc(p[0], p[1], cur ? 3.2 : 2.2, 0, 7); g.fill();
      if (cur) {
        const ph = (pulseT % 1600) / 1600;
        g.strokeStyle = ss.glow + (1 - ph).toFixed(2) + ")"; g.lineWidth = 1.5;
        g.beginPath(); g.arc(p[0], p[1], 4 + ph * 22, 0, 7); g.stroke();
      }
    }

    // label chip near the focused place
    if (focus && !fly) {
      const p = visible(focus.lon, focus.lat);
      if (p) label(p, (focus.flag ? focus.flag + " " : "") + (focus.label || focus.country || "").toUpperCase());
    }

    // rim light
    const rim = g.createLinearGradient(W / 2 - r, CY - r, W / 2 + r, CY + r);
    rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(0.5, s.glow + "0.0)"); rim.addColorStop(1, s.glow + "0.75)");
    g.strokeStyle = rim; g.lineWidth = 1.6; g.beginPath(); g.arc(W / 2, CY, r, 0, 7); g.stroke();
  }

  function visible(lon, lat) {
    const c = proj.rotate();
    const d = d3.geoDistance([lon, lat], [-c[0], -c[1]]);
    return d < Math.PI / 2 - 0.05 ? proj([lon, lat]) : null;
  }
  function label(p, text) {
    g.font = "600 11px 'Chakra Petch', sans-serif";
    const w = g.measureText(text).width + 14, x = Math.min(W - w - 8, Math.max(8, p[0] + 10)), y = p[1] - 24;
    g.fillStyle = "rgba(0,0,0,0.72)"; g.fillRect(x, y, w, 18);
    g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, 17);
    g.fillStyle = "#fff"; g.fillText(text, x + 7, y + 13);
  }

  /* ================= voices ================= */
  const synth = window.speechSynthesis;
  let voices = {};
  function pickVoices() {
    if (!synth) return;
    const all = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    if (!all.length) return;
    const find = (names, langs) => {
      for (const n of names) { const v = all.find((x) => x.name.toLowerCase().includes(n)); if (v) return v; }
      for (const l of langs) { const v = all.find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(l)); if (v) return v; }
      return all[0];
    };
    const op = find(["samantha", "ava", "allison", "susan", "zoe", "google us english"], ["en-us"]);
    const cmd = find(["daniel", "arthur", "oliver", "aaron", "alex", "evan", "google uk english male", "rishi"], ["en-gb", "en-in"]);
    let ana = find(["karen", "moira", "tessa", "serena", "kate", "catherine", "fiona", "google uk english female"], ["en-au", "en-ie", "en-za", "en-gb"]);
    if (ana === op || ana === cmd) ana = all.find((v) => v !== op && v !== cmd) || ana;
    voices = { OPERATOR: op, COMMANDER: cmd, ANALYST: ana };
  }
  if (synth) { pickVoices(); synth.onvoiceschanged = pickVoices; }
  let rate = parseFloat(store.get("rate", "1")) || 1;
  let engine = store.get("voice", "google"); // "google" = clear online voice, "device" = phone's built-in voice

  /* Phone's built-in voice (offline fallback) */
  function sayDevice(text) {
    return new Promise((resolve) => {
      const est = 1500 + (text.length * 70) / rate;
      let done = false; const fin = () => { if (!done) { done = true; clearTimeout(to); resolve(); } };
      const to = setTimeout(fin, est + 2500);
      if (!synth) return;
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/—/g, ", "));
        const L = LANGS[lang].sr;
        const v = lang === "en" ? voices.OPERATOR : synth.getVoices().find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(L.slice(0, 2).toLowerCase()));
        if (v) u.voice = v;
        u.lang = v ? v.lang : L; u.rate = rate; u.pitch = 1;
        u.onend = fin; u.onerror = fin;
        synth.speak(u);
      } catch { /* timer still advances */ }
    });
  }

  /* Clear natural voice: Google's free speech, one audio element (iOS allows it after the first tap) */
  const player = new Audio(); player.preload = "auto"; player.setAttribute("playsinline", "");
  const TLD = { OPERATOR: "com", COMMANDER: "co.uk", ANALYST: "com.au" }; // three English accents for the three roles
  let sayGen = 0, gFails = 0, curStop = null;
  function chunks(text) {
    const out = [];
    const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?؟۔。！？])\s*/);
    for (let p of parts) {
      while (p.length > 180) {
        let cut = p.lastIndexOf(",", 180); if (cut < 60) cut = p.lastIndexOf("،", 180);
        if (cut < 60) cut = p.lastIndexOf(" ", 180); if (cut < 60) cut = 180;
        out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1);
      }
      if (p.trim()) out.push(p.trim());
    }
    return out;
  }
  function ttsUrl(q, role) {
    const host = lang === "en" ? "translate.google." + (TLD[role] || "com") : "translate.google.com";
    return `https://${host}/translate_tts?ie=UTF-8&client=tw-ob&tl=${LANGS[lang].tts}&q=${encodeURIComponent(q)}`;
  }
  function playUrl(url, len) {
    return new Promise((res) => {
      let done = false;
      const fin = (ok) => { if (done) return; done = true; clearTimeout(t); player.onended = player.onerror = null; curStop = null; res(ok); };
      const t = setTimeout(() => fin(false), 5000 + len * 110 / rate);
      curStop = () => fin(true);
      player.onended = () => fin(true); player.onerror = () => fin(false);
      player.src = url; player.playbackRate = rate; player.defaultPlaybackRate = rate;
      const p = player.play(); if (p && p.catch) p.catch(() => fin(false));
    });
  }
  /** speak text in the current language; resolves when finished */
  async function say(text, role = "ANALYST") {
    if (!text) return;
    const gen = sayGen;
    if (engine === "google" && gFails < 3) {
      const cs = chunks(text);
      for (let i = 0; i < cs.length; i++) {
        if (gen !== sayGen) return;
        const ok = await playUrl(ttsUrl(cs[i], role), cs[i].length);
        if (gen !== sayGen) return;
        if (!ok) { gFails++; if (gFails >= 3) toast("Online voice unavailable, using phone voice"); return sayDevice(cs.slice(i).join(" ")); }
        gFails = 0;
      }
      return;
    }
    return sayDevice(text);
  }
  function hush() {
    sayGen++;
    try { player.pause(); } catch {}
    if (curStop) curStop();
    try { synth && synth.cancel(); } catch {}
  }

  /* ================= caption ================= */
  let typeTimer = null;
  function caption(role, text) {
    $("role").className = "role " + role; $("role").textContent = role;
    const el = $("line"); clearInterval(typeTimer);
    if (reduce) { el.textContent = text; return; }
    let i = 0; el.textContent = "";
    const step = Math.max(1, Math.round(text.length / 60));
    typeTimer = setInterval(() => { i += step; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeTimer); }, 28);
  }

  /* ================= card + progress ================= */
  function showCard(s) {
    const c = $("card");
    c.classList.remove("show");
    setTimeout(() => {
      c.className = "card" + (s.severity === "critical" ? " critical" : "");
      $("cFlag").textContent = s.flag || "🌐";
      $("cCountry").textContent = s.label || s.country || "World";
      const tag = $("cTag"); tag.className = "tag " + (SEV[s.severity] ? s.severity : "info"); tag.textContent = sev(s.severity).name;
      $("cHead").textContent = s.headline;
      const a = $("cSrc"); a.textContent = s.source || ""; if (s.url) a.href = s.url; else a.removeAttribute("href");
      $("cTime").textContent = s.time ? ago(s.time) : "";
      c.classList.add("show");
    }, 200);
    mediaInfo(s);
    renderProgress();
  }
  function mediaInfo(s) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.headline, artist: (s.label || s.country || "World") + " · Ops Room", album: "Built by Awais Amin", artwork: [{ src: "icon-512.png", sizes: "512x512", type: "image/png" }] });
    } catch {}
  }
  function renderProgress() {
    $("progress").innerHTML = stories.map((_, i) => `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("");
  }

  /* ================= broadcast ================= */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  async function run(fromLine = 0) {
    const my = ++runId;
    const alive = () => playing && my === runId;
    while (alive()) {
      if (!stories.length) { await sleep(3000); continue; }
      const s = stories[idx];
      if (fromLine === 0) { clearInterval(typeTimer); $("role").textContent = ""; $("line").textContent = ""; flyTo(s); showCard(s); await sleep(reduce ? 300 : 1500); if (!alive()) return; }
      const lines = s.lines && s.lines.length ? s.lines : [{ role: "OPERATOR", text: s.headline }, { role: "ANALYST", text: s.summary }];
      for (lineIdx = fromLine; lineIdx < lines.length; lineIdx++) {
        if (!alive()) return;
        const l = lines[lineIdx];
        const role = ["OPERATOR", "COMMANDER", "ANALYST"].includes(l.role) ? l.role : "ANALYST";
        caption(role, l.text);
        await say(l.text, role);
        if (!alive()) return;
        await sleep(350);
      }
      fromLine = 0;
      await sleep(700);
      if (!alive()) return;
      if (idx >= stories.length - 1) {
        caption("OPERATOR", phrase("end"));
        await say(phrase("end"), "OPERATOR");
        if (!alive()) return;
        await loadNews(true);
        idx = 0;
      } else idx++;
    }
  }

  function setPlaying(p) {
    playing = p;
    $("playIcon").innerHTML = p ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
    $("bPlay").setAttribute("aria-label", p ? "Pause" : "Play");
    $("live").classList.toggle("off", !p); $("liveTxt").textContent = p ? "Live" : "Paused";
    if (p) keepAwake(); else releaseAwake();
  }
  function play(fromLine = 0) { setPlaying(true); run(fromLine); }
  function pause() { setPlaying(false); runId++; hush(); }
  function jump(i) {
    if (!stories.length) return;
    idx = (i + stories.length) % stories.length; lineIdx = 0;
    hush(); runId++;
    if (playing) run(0); else { flyTo(stories[idx]); showCard(stories[idx]); const s = stories[idx]; caption("OPERATOR", s.headline); }
  }

  async function keepAwake() { try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); } } catch {} }
  function releaseAwake() { try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && playing) keepAwake(); });

  /* ================= news loading ================= */
  async function loadNews(announce) {
    try {
      let data = null;
      if (lang !== "en") {
        try { const rl = await fetch(`news-${lang}.json?t=` + Date.now(), { cache: "no-store" }); if (rl.ok) data = await rl.json(); } catch {}
        if (!data && !loadNews._warned) { loadNews._warned = true; toast(LANGS[lang].name + " reports arrive with the next hourly update. Showing English for now.", 4500); }
      }
      if (!data) { const r = await fetch("news.json?t=" + Date.now(), { cache: "no-store" }); data = await r.json(); }
      const fresh = !news.updated || data.updated !== news.updated;
      if (data.stories && data.stories.length) {
        const wasEmpty = !stories.length;
        news = data; stories = data.stories.filter((s) => s && s.headline);
        stories.forEach((s) => { s.lat = +s.lat || 0; s.lon = +s.lon || 0; });
        if (idx >= stories.length) idx = 0;
        renderList(); renderProgress(); renderInfo();
        if (announce && fresh && !wasEmpty && playing) {
          caption("OPERATOR", phrase("fresh"));
          await say(phrase("fresh"), "OPERATOR");
        }
      }
      return fresh;
    } catch {
      if (!stories.length) $("startMeta").textContent = "Couldn't load reports. Check your connection.";
      return false;
    }
  }
  function renderInfo() {
    const n = stories.length;
    $("startMeta").textContent = `${n} reports · updated ${ago(news.updated)}`;
    $("newsInfo").textContent = `${n} reports, updated ${ago(news.updated)}. New reports arrive every hour automatically.`;
  }
  setInterval(() => { if (!playing) loadNews(false); }, 10 * 60 * 1000);

  /* ================= list sheet ================= */
  function renderList() {
    $("listBody").innerHTML = "";
    stories.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "story" + (i === idx ? " cur" : "");
      b.innerHTML = `<span class="f"></span><span class="c"><span class="sv"></span><span class="n"></span></span><span class="h"></span>`;
      b.querySelector(".f").textContent = s.flag || "🌐";
      b.querySelector(".sv").style.background = sev(s.severity).col;
      b.querySelector(".n").textContent = (s.label || s.country || "World") + (s.time ? " · " + ago(s.time) : "");
      b.querySelector(".h").textContent = s.headline;
      b.querySelector(".h").dir = "auto";
      b.onclick = () => { closeSheets(); if (!started) begin(false); jump(i); if (!playing) play(); };
      $("listBody").appendChild(b);
    });
  }

  /* ================= sheets ================= */
  let openSheet = null, resumeAfter = false;
  function open(id) {
    closeSheets(true);
    openSheet = $(id); openSheet.classList.add("open"); $("scrim").classList.add("on");
  }
  function closeSheets(silent) {
    document.querySelectorAll(".sheet.open").forEach((s) => s.classList.remove("open"));
    $("scrim").classList.remove("on");
    if (!silent && resumeAfter) { resumeAfter = false; if (started) play(lineIdx); }
    openSheet = null;
  }
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeSheets()));
  $("scrim").onclick = () => closeSheets();

  /* ================= Ask the analyst ================= */
  const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
  let turns = [];
  const chips = [
    "Summarise today's news in 30 seconds",
    "What's the biggest risk to the UAE right now?",
    "How will this affect oil and shipping prices?",
    "What's happening in Pakistan?",
    "Is it safe to travel to Saudi Arabia this week?",
  ];
  chips.forEach((t) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = t; b.onclick = () => ask(t); $("chips").appendChild(b); });

  function newsContext() {
    return stories.map((s, i) => `${i + 1}. [${s.label || s.country || "World"}] ${s.headline} — ${s.summary || ""} (Source: ${s.source || "n/a"})`).join("\n");
  }

  function rules() {
    const L = LANGS[lang].ai || "English";
    return `You are the ANALYST in "Ops Room", a live news app, talking to Awais, a businessman in Sharjah, UAE
(auto spare parts trade; from Pakistan; exports to Africa, Iraq, the Middle East, Georgia and Central Asia).
Today is ${new Date().toDateString()}. Latest reports on the board:
${newsContext()}

How to answer:
- Answer ONLY the exact question. The first sentence must be the direct answer.
- At most 3 short sentences. Do not list other news that was not asked about.
- Use the reports above; if they don't cover it, say so in one short clause, then give what you know and mark anything uncertain.
- Plain spoken text: no markdown, no bullet points, no emojis. Write numbers so they read well aloud.
- Reply in ${L}.`;
  }

  async function gemini(question, key) {
    const contents = turns.map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text }] }))
      .concat([{ role: "user", parts: [{ text: question }] }]);
    let lastErr = null;
    for (const model of MODELS) {
      for (const withSearch of [true, false]) {
        const body = { systemInstruction: { parts: [{ text: rules() }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 600 } };
        if (withSearch) body.tools = [{ google_search: {} }];
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          });
          const data = await r.json();
          if (!r.ok) {
            lastErr = new Error((data.error && data.error.message) || "HTTP " + r.status);
            if (r.status === 400 && /api key/i.test(lastErr.message)) throw lastErr;
            if (r.status === 429) throw new Error("The free Gemini limit is used up for now.");
            continue;
          }
          const cand = data.candidates && data.candidates[0];
          const text = cand && cand.content && (cand.content.parts || []).map((p) => p.text || "").join("").trim();
          if (!text) { lastErr = new Error("Empty answer"); continue; }
          const chunksG = (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
          const sources = chunksG.map((c) => c.web).filter(Boolean).slice(0, 4);
          return { text: text.replace(/[*#_`]/g, ""), sources };
        } catch (e) { lastErr = e; if (/api key|limit/i.test(e.message)) throw e; }
      }
    }
    throw lastErr || new Error("No answer");
  }

  /* Free AI with no key at all (pollinations.ai). One question at a time, about 30 s apart. */
  let freeNext = 0;
  async function freeAI(question, onWait) {
    const messages = [{ role: "system", content: rules() }]
      .concat(turns.map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.text })))
      .concat([{ role: "user", content: question }]);
    for (let attempt = 0; attempt < 3; attempt++) {
      const wait = freeNext - Date.now();
      if (wait > 0) { onWait && onWait(Math.ceil(wait / 1000)); await sleep(wait); }
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai", messages, private: true, referrer: "opsroom" }),
      });
      freeNext = Date.now() + 31000;
      if (r.status === 402 || r.status === 429) {
        const ra = parseInt(r.headers.get("Retry-After") || "30", 10);
        freeNext = Date.now() + (isFinite(ra) ? ra : 30) * 1000 + 500;
        continue;
      }
      if (!r.ok) throw new Error("Free AI is busy (HTTP " + r.status + ")");
      const data = await r.json();
      const text = data.choices && data.choices[0] && data.choices[0].message && (data.choices[0].message.content || "").trim();
      if (text) return { text: text.replace(/[*#_`]/g, "").replace(/\n{2,}/g, "\n"), sources: [] };
    }
    throw new Error("Free AI is busy. Try again in a minute.");
  }

  function localAnswer(q) {
    const words = q.toLowerCase().match(/[a-z]{3,}/g) || [];
    const scored = stories.map((s) => {
      const hay = `${s.label} ${s.country} ${s.headline} ${s.summary}`.toLowerCase();
      return { s, n: words.filter((w) => hay.includes(w)).length };
    }).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 2);
    if (!scored.length) return "I couldn't reach the AI just now and I have no report on that. Please try again in a minute.";
    return scored[0].s.summary || scored[0].s.headline;
  }

  function addMsg(who, text, sources) {
    const m = document.createElement("div"); m.className = "msg " + (who === "me" ? "me" : "ai");
    if (who !== "me") { const h = document.createElement("div"); h.className = "who"; h.textContent = "ANALYST"; m.appendChild(h); }
    const p = document.createElement("div"); p.dir = "auto"; p.textContent = text; m.appendChild(p);
    if (sources && sources.length) {
      const s = document.createElement("div"); s.className = "src";
      sources.forEach((w) => { const a = document.createElement("a"); a.href = w.uri; a.target = "_blank"; a.rel = "noopener"; a.textContent = w.title || "Source"; s.appendChild(a); });
      m.appendChild(s);
    }
    $("chat").appendChild(m);
    $("chatBody").scrollTop = $("chatBody").scrollHeight;
    return { el: m, text: p };
  }

  let asking = false;
  async function ask(q) {
    q = (q || "").trim(); if (!q || asking) return;
    asking = true; $("q").value = ""; $("q").blur();
    hush();
    addMsg("me", q);
    const pending = addMsg("ai", "Thinking…");
    const key = store.get("gkey", "");
    let answer = null, sources = [];
    const waitNote = (n) => { pending.text.textContent = `Analyst is finishing the last answer… ${n}s`; };
    if (key) {
      try { const r = await gemini(q, key); answer = r.text; sources = r.sources; } catch (e) { console.warn(e); }
    }
    if (!answer) {
      try { const r = await freeAI(q, waitNote); answer = r.text; } catch (e) { console.warn(e); }
    }
    if (!answer) answer = localAnswer(q);
    pending.el.remove();
    addMsg("ai", answer, sources);
    turns.push({ role: "user", text: q }, { role: "model", text: answer });
    turns = turns.slice(-10);
    asking = false;
    caption("ANALYST", answer.length > 140 ? answer.slice(0, 137) + "…" : answer);
    await say(answer, "ANALYST");
  }
  $("askForm").onsubmit = (e) => { e.preventDefault(); ask($("q").value); };

  /* voice input */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  $("bMic").onclick = () => {
    if (!SR) { $("q").focus(); toast("Tap the mic on your keyboard to speak"); return; }
    if (rec) { rec.stop(); return; }
    hush();
    try {
      rec = new SR(); rec.lang = LANGS[lang].sr; rec.interimResults = true; rec.continuous = false;
      $("bMic").classList.add("rec");
      let final = "";
      rec.onresult = (e) => { let t = ""; for (const r of e.results) t += r[0].transcript; $("q").value = t; if (e.results[e.results.length - 1].isFinal) final = t; };
      rec.onerror = () => { toast("Couldn't hear you. Tap the keyboard mic instead."); };
      rec.onend = () => { $("bMic").classList.remove("rec"); rec = null; const v = final || $("q").value; if (v.trim()) ask(v); };
      rec.start();
    } catch { rec = null; $("bMic").classList.remove("rec"); $("q").focus(); }
  };

  /* ================= settings ================= */
  $("key").value = store.get("gkey", "");
  function keyNote() { $("keyNote").innerHTML = store.get("gkey", "") ? '<span class="ok">AI key saved. The analyst can search the web.</span>' : "The analyst already answers for free without a key. A free Gemini key adds live Google search for questions beyond today's reports."; }
  keyNote();
  $("bSaveKey").onclick = () => { store.set("gkey", $("key").value.trim()); keyNote(); toast($("key").value.trim() ? "Key saved" : "Key removed"); };
  $("bTestKey").onclick = async () => {
    const k = $("key").value.trim(); if (!k) { toast("Paste a key first"); return; }
    $("keyNote").textContent = "Testing…";
    try { const r = await gemini("Reply with exactly: Analyst online.", k); $("keyNote").innerHTML = '<span class="ok">Working: ' + r.text.replace(/</g, "&lt;") + "</span>"; store.set("gkey", k); }
    catch (e) { $("keyNote").textContent = "Didn't work: " + e.message; }
  };
  function fillSelect(el) {
    el.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
    el.value = lang;
    el.onchange = async () => {
      lang = el.value; store.set("lang", lang); loadNews._warned = false;
      document.querySelectorAll(".langSel").forEach((x) => (x.value = lang));
      applyLang(); hush(); runId++;
      await loadNews(false);
      idx = 0; if (playing) run(0);
    };
  }
  document.querySelectorAll(".langSel").forEach(fillSelect);
  applyLang();
  $("voiceSel").value = engine;
  $("voiceSel").onchange = () => { engine = $("voiceSel").value; gFails = 0; store.set("voice", engine); };
  $("rate").value = rate; $("rateVal").textContent = rate.toFixed(2) + "×";
  $("rate").oninput = () => { rate = parseFloat($("rate").value); store.set("rate", String(rate)); $("rateVal").textContent = rate.toFixed(2) + "×"; };
  $("bTestVoice").onclick = async () => {
    hush(); pickVoices();
    gFails = 0;
    say(phrase("fresh"), "OPERATOR").then(() => say(lang === "en" ? "Commander here." : "", "COMMANDER")).then(() => say(lang === "en" ? "Analyst ready." : "", "ANALYST"));
  };
  $("bRefresh").onclick = async () => { const f = await loadNews(false); toast(f ? "New reports loaded" : "No new reports yet"); };

  /* ================= controls ================= */
  function begin(withIntro = true) {
    if (started) return; started = true;
    $("start").hidden = true; $("app").classList.remove("pre");
    setTimeout(() => $("intro").classList.add("gone"), 1200);
    // first sound must start inside the tap, so iOS unlocks audio
    const first = phrase("hello", { g: greeting(), n: stories.length });
    caption("OPERATOR", first);
    if (withIntro) {
      setPlaying(true);
      const my = ++runId;
      say(first, "OPERATOR").then(() => { if (playing && my === runId) run(0); });
    } else { hush(); try { player.src = ttsUrl(".", "OPERATOR"); player.play().catch(() => {}); } catch {} }
  }
  $("bStart").onclick = () => begin(true);
  $("bSettings0").onclick = () => open("setSheet");
  $("bPlay").onclick = () => { if (!started) return begin(true); playing ? pause() : play(lineIdx); };
  $("bNext").onclick = () => { if (!started) begin(false); jump(idx + 1); };
  $("bPrev").onclick = () => { if (!started) begin(false); jump(idx - 1); };
  $("bList").onclick = () => { renderList(); open("listSheet"); };
  $("bAsk").onclick = () => {
    if (!started) { started = true; $("start").hidden = true; $("app").classList.remove("pre"); $("intro").classList.add("gone"); try { synth && synth.speak(new SpeechSynthesisUtterance("")); } catch {} try { player.src = ttsUrl(".", "OPERATOR"); player.play().catch(() => {}); } catch {} }
    resumeAfter = playing; if (playing) pause();
    open("askSheet");
  };
  $("bSet").onclick = () => { resumeAfter = playing; if (playing) pause(); open("setSheet"); };

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => { if (!playing) play(lineIdx); });
      navigator.mediaSession.setActionHandler("pause", () => { if (playing) pause(); });
      navigator.mediaSession.setActionHandler("nexttrack", () => jump(idx + 1));
      navigator.mediaSession.setActionHandler("previoustrack", () => jump(idx - 1));
    } catch {}
  }

  addEventListener("resize", resize);

  /* ================= boot ================= */
  resize();
  requestAnimationFrame(frame);
  loadWorld().catch(() => {});
  loadNews(false).then(() => { if (stories[0]) { focus = null; } });
})();
