/* Ops Room — AI news streamer. Built by Awais Amin.
   All free: news.json is refreshed hourly by GitHub Actions, the voice is Google's free
   speech (phone voice as offline fallback), answers come from free AI (Gemini key optional),
   weather from Open-Meteo, place names from BigDataCloud. */
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
    caught: { en: "You're all caught up, sir. I'll brief you as soon as new reports arrive.", ur: "آپ تمام خبریں سن چکے ہیں، سر۔ نئی رپورٹس آتے ہی بتاؤں گا۔" },
    fresh: { en: "New reports coming in.", ur: "نئی رپورٹس آ رہی ہیں۔", ar: "تقارير جديدة تصل الآن.", hi: "नई रिपोर्ट्स आ रही हैं।", zh: "新的报告正在传入。", ru: "Поступают новые сообщения.", fr: "De nouveaux rapports arrivent." },
  };
  const WX = {
    cond: {
      en: ["clear skies", "mostly clear", "partly cloudy", "cloudy", "fog", "light drizzle", "rain", "snow", "thunderstorms"],
      ur: ["صاف آسمان", "زیادہ تر صاف", "جزوی ابر آلود", "ابر آلود", "دھند", "ہلکی بوندا باندی", "بارش", "برف باری", "گرج چمک کے ساتھ طوفان"],
      ar: ["سماء صافية", "صافية غالباً", "غائم جزئياً", "غائم", "ضباب", "رذاذ خفيف", "أمطار", "ثلوج", "عواصف رعدية"],
      hi: ["साफ़ आसमान", "ज़्यादातर साफ़", "आंशिक बादल", "बादल छाए", "कोहरा", "हल्की बूंदाबांदी", "बारिश", "बर्फ़बारी", "आंधी-तूफ़ान"],
      zh: ["晴朗", "大致晴朗", "局部多云", "多云", "有雾", "小毛毛雨", "下雨", "下雪", "雷暴"],
      ru: ["ясно", "преимущественно ясно", "переменная облачность", "облачно", "туман", "лёгкая морось", "дождь", "снег", "гроза"],
      fr: ["ciel dégagé", "plutôt dégagé", "partiellement nuageux", "nuageux", "brouillard", "bruine légère", "pluie", "neige", "orages"],
    },
    now: { en: "Local weather for {c}: {t} degrees and {w}.", ur: "{c} کا موسم: {t} ڈگری، {w}۔", ar: "الطقس في {c}: {t} درجة، {w}.", hi: "{c} का मौसम: {t} डिग्री, {w}।", zh: "{c}天气：{t}度，{w}。", ru: "Погода в {c}: {t} градусов, {w}.", fr: "Météo à {c} : {t} degrés, {w}." },
    day: { en: "Today's high {h}, low {l}. Feels like {f}. Wind {k} kilometres an hour, humidity {u} percent, chance of rain {p} percent.", ur: "آج زیادہ سے زیادہ {h} اور کم سے کم {l} ڈگری۔ ہوا {k} کلومیٹر فی گھنٹہ، نمی {u} فیصد، بارش کا امکان {p} فیصد۔", ar: "العظمى اليوم {h} والصغرى {l}. الرياح {k} كيلومتر في الساعة، الرطوبة {u} بالمئة، واحتمال المطر {p} بالمئة.", hi: "आज अधिकतम {h} और न्यूनतम {l} डिग्री। हवा {k} किलोमीटर प्रति घंटा, नमी {u} प्रतिशत, बारिश की संभावना {p} प्रतिशत।", zh: "今天最高{h}度，最低{l}度。风速每小时{k}公里，湿度百分之{u}，降雨概率百分之{p}。", ru: "Сегодня до {h}, минимум {l}. Ветер {k} км в час, влажность {u} процентов, вероятность дождя {p} процентов.", fr: "Aujourd'hui maximum {h}, minimum {l}. Vent {k} kilomètres heure, humidité {u} pour cent, risque de pluie {p} pour cent." },
    heat: { en: "Heat alert: stay hydrated and avoid the midday sun.", ur: "شدید گرمی: پانی زیادہ پئیں اور دوپہر کی دھوپ سے بچیں۔", ar: "تنبيه حرارة: اشرب الماء وتجنب شمس الظهيرة.", hi: "गर्मी की चेतावनी: पानी पीते रहें और दोपहर की धूप से बचें।", zh: "高温提醒：多喝水，避免正午日晒。", ru: "Жара: пейте больше воды и избегайте полуденного солнца.", fr: "Alerte chaleur : hydratez-vous et évitez le soleil de midi." },
    rain: { en: "Rain is likely today. Drive carefully.", ur: "آج بارش کا امکان ہے۔ احتیاط سے گاڑی چلائیں۔", ar: "من المرجح هطول أمطار اليوم. قُد بحذر.", hi: "आज बारिश की संभावना है। सावधानी से गाड़ी चलाएँ।", zh: "今天可能下雨，请小心驾驶。", ru: "Сегодня вероятен дождь. Будьте осторожны за рулём.", fr: "De la pluie est probable aujourd'hui. Prudence sur la route." },
  };
  const WX_ICON = ["☀️", "🌤️", "⛅", "☁️", "🌫️", "🌦️", "🌧️", "❄️", "⛈️"];
  const wxIndex = (c) => c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c === 3 ? 3 : c === 45 || c === 48 ? 4 : c >= 51 && c <= 57 ? 5 : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? 6 : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 7 : c >= 95 ? 8 : 2;
  const fill = (tpl, v) => tpl.replace(/\{(\w)\}/g, (_, k) => v[k] ?? "");
  const phrase = (k, vars = {}) => (PHRASE[k][lang] || PHRASE[k].en).replace(/\{(\w)\}/g, (_, v) => vars[v] ?? "");
  function applyLang() {
    $("app").classList.toggle("nolatin", lang !== "en" && lang !== "fr" && lang !== "ru");
    $("app").classList.toggle("rtl", !!LANGS[lang].rtl);
  }

  /* ================= state ================= */
  let news = { updated: null, stories: [] };
  let stories = [];                 // what is playing now (after the category filter)
  let allStories = [], localStories = [], localData = null, localCity = null;
  let weatherStory = null, wx = null, here = null;
  const CATS = ["All", "Local", "World", "Middle East", "UAE", "Pakistan", "Markets", "Business", "Tech", "Sports"];
  let cat = store.get("cat", "All"); if (!CATS.includes(cat)) cat = "All";
  try { here = JSON.parse(store.get("here", "null")); } catch { here = null; }
  let idx = 0, lineIdx = 0, playing = false, started = false, runId = 0;
  let wakeLock = null;

  /* ================= clock ================= */
  const pad = (n) => String(n).padStart(2, "0");
  function tick() {
    const d = new Date();
    $("clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
  let focusPrev = null, arcFrom = null, arcTo = null, arcT0 = 0;

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
      tz = span > 60 ? 1.3 : span > 30 ? 1.9 : span > 12 ? 2.9 : 3.8;
    }
    if (s.country === null) tz = 1.3;
    if (s.zoom) tz = s.zoom;
    arcFrom = focusPrev ? [focusPrev.lon, focusPrev.lat] : null; arcTo = [s.lon, s.lat]; arcT0 = performance.now();
    focusPrev = s;
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
        if ((focus.country === "Pakistan" || focus.country === "India") && byName.get("India")) drawKashmir(ss);
      }
    }

    // 3D shading: dark limb + soft specular highlight
    const sh = g.createRadialGradient(W / 2 - r * 0.3, CY - r * 0.35, r * 0.2, W / 2, CY, r * 1.02);
    sh.addColorStop(0, "rgba(255,255,255,0.06)"); sh.addColorStop(0.55, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = sh; g.beginPath(); path({ type: "Sphere" }); g.fill();

    // flight track from the previous story to this one
    if (arcFrom && arcTo) {
      const k = Math.min(1, (pulseT - arcT0) / 1900), ip = d3.geoInterpolate(arcFrom, arcTo);
      const pts = []; for (let i = 0; i <= 40 * k; i++) pts.push(ip(i / 40));
      if (pts.length > 1) {
        g.save(); g.setLineDash([4, 4]); g.lineDashOffset = -pulseT / 40;
        g.strokeStyle = s.glow + "0.85)"; g.lineWidth = 1.4;
        g.beginPath(); path({ type: "LineString", coordinates: pts }); g.stroke(); g.restore();
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

    // HUD ring with ticks and a slow sweep
    const rr = R * 1.14, t = pulseT / 9000; // fixed reticle ring around the globe
    g.save(); g.translate(W / 2, CY);
    g.strokeStyle = "rgba(255,255,255,0.10)"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke();
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2, L = i % 10 === 0 ? 8 : 3;
      g.strokeStyle = i % 10 === 0 ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.12)";
      g.beginPath(); g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); g.lineTo(Math.cos(a) * (rr + L), Math.sin(a) * (rr + L)); g.stroke();
    }
    const a0 = t * Math.PI * 2;
    g.strokeStyle = s.glow + "0.9)"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, rr, a0, a0 + 0.55); g.stroke();
    g.strokeStyle = s.glow + "0.35)"; g.beginPath(); g.arc(0, 0, rr, a0 + Math.PI, a0 + Math.PI + 0.25); g.stroke();
    g.restore();

    // rim light
    const rim = g.createLinearGradient(W / 2 - r, CY - r, W / 2 + r, CY + r);
    rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(0.5, s.glow + "0.0)"); rim.addColorStop(1, s.glow + "0.75)");
    g.strokeStyle = rim; g.lineWidth = 1.6; g.beginPath(); g.arc(W / 2, CY, r, 0, 7); g.stroke();
  }

  // Jammu & Kashmir (Indian-administered): marked as disputed territory, as on Pakistan's official map
  const KASH = { type: "Polygon", coordinates: [[[73.3, 32.25], [73.3, 37.2], [80.4, 37.2], [80.4, 32.25], [73.3, 32.25]]] };
  let hatch = null, hatchCol = "";
  function drawKashmir(ss) {
    if (!hatch || hatchCol !== ss.col) {
      const c = document.createElement("canvas"); c.width = c.height = 8; const x = c.getContext("2d");
      x.strokeStyle = ss.col; x.globalAlpha = 0.75; x.lineWidth = 1.4; x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke();
      hatch = g.createPattern(c, "repeat"); hatchCol = ss.col;
    }
    g.save();
    g.beginPath(); path(KASH); g.clip();
    g.fillStyle = ss.glow + "0.18)"; g.beginPath(); path(byName.get("India")); g.fill();
    g.fillStyle = hatch; g.fill();
    g.setLineDash([3, 3]); g.strokeStyle = ss.col; g.lineWidth = 1; g.stroke();
    g.restore();
    const p = !fly && visible(76.6, 34.6);
    if (p && zoom > 1.6) {
      g.font = "600 9px 'JetBrains Mono', monospace"; g.fillStyle = "rgba(255,255,255,.8)";
      g.fillText("J&K · DISPUTED", p[0] + 6, p[1] - 4);
    }
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
  let dialogue = store.get("dialogue", "on") !== "off"; // Commander & Analyst ask each other questions
  let engine = store.get("voice", "google"); // "google" = clear online voice, "device" = phone's built-in voice

  /* Phone's built-in voice (offline fallback) */
  function sayDevice(text, L0) {
    return new Promise((resolve) => {
      const est = 1500 + (text.length * 70) / rate;
      let done = false; const fin = () => { if (!done) { done = true; clearTimeout(to); resolve(); } };
      const to = setTimeout(fin, est + 2500);
      if (!synth) return;
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/—/g, ", "));
        const lg = L0 || lang, L = LANGS[lg].sr;
        const v = lg === "en" ? voices.OPERATOR : synth.getVoices().find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(L.slice(0, 2).toLowerCase()));
        if (v) u.voice = v;
        u.lang = v ? v.lang : L; u.rate = rate; u.pitch = sayDevice.pitch || 1;
        u.onend = fin; u.onerror = fin;
        synth.speak(u);
      } catch { /* timer still advances */ }
    });
  }

  /* Clear natural voice: Google's free speech. Two audio players take turns so the next sentence is
     already loaded while the current one plays (no gaps). Each role has its own accent and pitch. */
  const ROLE = {
    OPERATOR: { tld: "com", speed: 1.04, deep: false },   // American, slightly brisk
    COMMANDER: { tld: "co.uk", speed: 0.88, deep: true }, // British, deeper and slower
    ANALYST: { tld: "com.au", speed: 1.0, deep: false },  // Australian, natural
  };
  const SILENT = (() => { // 0.1 s of silence as a WAV, used to unlock both players on the first tap
    const n = 2400, buf = new Uint8Array(44 + n * 2), v = new DataView(buf.buffer);
    const w = (o, str) => [...str].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    let bin = ""; buf.forEach((x) => (bin += String.fromCharCode(x))); return "data:audio/wav;base64," + btoa(bin);
  })();
  const players = [new Audio(), new Audio()];
  players.forEach((p) => { p.preload = "auto"; p.setAttribute("playsinline", ""); });
  let unlocked = false;
  function unlockAudio() { // must run inside a tap so iOS lets these players speak later
    if (unlocked) return; unlocked = true;
    players.forEach((p) => { try { p.src = SILENT; const q = p.play(); if (q && q.catch) q.catch(() => {}); } catch {} });
    try { synth && synth.speak(new SpeechSynthesisUtterance("")); } catch {}
  }
  let sayGen = 0, gFails = 0, curStop = null;
  function chunks(text) {
    const out = [];
    const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?؟۔。！？])\s*/);
    for (let p of parts) {
      while (p.length > 190) {
        let cut = p.lastIndexOf(", ", 190); if (cut < 60) cut = p.lastIndexOf("، ", 190);
        if (cut < 60) cut = p.lastIndexOf(" ", 190); if (cut < 60) cut = 190;
        out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1);
      }
      if (p.trim()) out.push(p.trim());
    }
    // join very short pieces so the voice doesn't stop after two words
    const merged = [];
    for (const c of out) { const last = merged[merged.length - 1]; if (last && (last + " " + c).length <= 190 && last.length < 60) merged[merged.length - 1] = last + " " + c; else merged.push(c); }
    return merged;
  }
  function ttsUrl(q, role, L0) {
    const lg = L0 || lang, R = ROLE[role] || ROLE.ANALYST;
    const host = lg === "en" ? "translate.google." + R.tld : "translate.google.com";
    return `https://${host}/translate_tts?ie=UTF-8&client=tw-ob&tl=${LANGS[lg].tts}&q=${encodeURIComponent(q)}`;
  }
  function voiceOf(p, role) {
    const R = ROLE[role] || ROLE.ANALYST;
    const deep = R.deep;
    p.preservesPitch = !deep; p.webkitPreservesPitch = !deep; p.mozPreservesPitch = !deep;
    p.playbackRate = rate * R.speed; p.defaultPlaybackRate = rate * R.speed;
  }
  function preload(url) {
    if (players.some((p) => p.dataset.u === url)) return;
    const idle = players.find((p) => p.paused && p !== players.current);
    if (!idle) return;
    idle.dataset.u = url; idle.src = url; try { idle.load(); } catch {}
  }
  function playUrl(url, len, role) {
    return new Promise((res) => {
      let p = players.find((x) => x.dataset.u === url) || players.find((x) => x.paused && x !== players.current) || players[0];
      if (p.dataset.u !== url) { p.dataset.u = url; p.src = url; }
      players.current = p;
      let done = false;
      const fin = (ok) => { if (done) return; done = true; clearTimeout(t); p.onended = p.onerror = null; curStop = null; p.dataset.u = ""; res(ok); };
      const t = setTimeout(() => fin(false), 6000 + len * 120 / rate);
      curStop = () => { try { p.pause(); } catch {} fin(true); };
      p.onended = () => fin(true); p.onerror = () => fin(false);
      voiceOf(p, role);
      const q = p.play(); if (q && q.catch) q.catch(() => fin(false));
    });
  }
  let nextUp = null; // the next line, so its first sentence can load early
  function prefetch(text, role, L0) {
    nextUp = { text, role, L0 };
    if (engine !== "google" || !text) return;
    const c = chunks(text)[0]; if (c) preload(ttsUrl(c, role, L0));
  }
  /** speak text in the current language (or L0); resolves when finished */
  async function say(text, role = "ANALYST", L0) {
    if (!text) return;
    talk(true);
    try { return await sayInner(text, role, L0); } finally { talk(false); }
  }
  let talkN = 0;
  function talk(on) {
    talkN = Math.max(0, talkN + (on ? 1 : -1));
    const c = document.querySelector(".caption"); c.classList.toggle("talking", talkN > 0);
    $("eq").hidden = talkN === 0; $("eq").style.color = getComputedStyle($("role")).color;
  }
  async function sayInner(text, role, L0) {
    const gen = sayGen;
    if (engine === "google" && gFails < 3) {
      const cs = chunks(text);
      for (let i = 0; i < cs.length; i++) {
        if (gen !== sayGen) return;
        if (i + 1 < cs.length) setTimeout(() => preload(ttsUrl(cs[i + 1], role, L0)), 150);
        else if (nextUp && nextUp.text !== text) setTimeout(() => { const n = nextUp; const c = n && chunks(n.text)[0]; if (c) preload(ttsUrl(c, n.role, n.L0)); }, 150);
        const ok = await playUrl(ttsUrl(cs[i], role, L0), cs[i].length, role);
        if (gen !== sayGen) return;
        if (!ok) { gFails++; if (gFails >= 3) toast("Online voice unavailable, using phone voice"); return sayDevice(cs.slice(i).join(" "), L0); }
        gFails = 0;
      }
      return;
    }
    sayDevice.pitch = role === "COMMANDER" ? 0.8 : role === "OPERATOR" ? 1.1 : 1;
    return sayDevice(text, L0);
  }
  function hush() {
    sayGen++;
    players.forEach((p) => { try { p.pause(); } catch {} });
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
      const tag = $("cTag"); tag.className = "tag " + (SEV[s.severity] ? s.severity : "info"); tag.textContent = s.category && s.category !== "World" ? s.category : sev(s.severity).name;
      $("cHead").textContent = s.headline;
      $("cSum").textContent = s.summary && s.summary !== s.headline ? s.summary : "";
      $("coords").textContent = `LAT ${Math.abs(s.lat).toFixed(2)}°${s.lat >= 0 ? "N" : "S"}  LON ${Math.abs(s.lon).toFixed(2)}°${s.lon >= 0 ? "E" : "W"}`;
      $("sector").textContent = (s.category || s.severity || "").toUpperCase() + " · " + String(idx + 1).padStart(2, "0") + "/" + String(stories.length).padStart(2, "0");
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

  /* news that has been read out is remembered on this phone and never read again */
  let heard = new Set();
  try { heard = new Set(JSON.parse(store.get("heard", "[]"))); } catch {}
  const hKey = (s) => s.id === "weather" ? "wx-" + new Date().toISOString().slice(0, 13) : (s.id || s.headline);
  const isHeard = (s) => heard.has(hKey(s));
  function markHeard(s) {
    heard.add(hKey(s));
    const arr = [...heard].slice(-800); heard = new Set(arr); store.set("heard", JSON.stringify(arr));
  }
  let manualPick = false, caughtSaid = false;
  const nextUnheard = (from) => { for (let k = 0; k < stories.length; k++) { const i = (from + k) % stories.length; if (!isHeard(stories[i])) return i; } return -1; };

  async function run(fromLine = 0) {
    const my = ++runId;
    const alive = () => playing && my === runId;
    while (alive()) {
      if (!stories.length) { await sleep(3000); continue; }
      if (idx >= stories.length) idx = 0;
      if (manualPick) manualPick = false;      // the user chose this story, so play it
      else if (fromLine === 0 && isHeard(stories[idx])) {
        const n = nextUnheard(idx);
        if (n < 0) { // everything has been heard: wait quietly for new reports
          if (!caughtSaid) {
            caughtSaid = true;
            caption("OPERATOR", phrase("caught"));
            await say(phrase("caught"), "OPERATOR");
          }
          for (let t = 0; t < 40 && alive(); t++) await sleep(3000); // check again in 2 minutes
          if (!alive()) return;
          await checkFresh(); freshWaiting = false;
          if (nextUnheard(0) >= 0) { caption("OPERATOR", phrase("fresh")); await say(phrase("fresh"), "OPERATOR"); idx = nextUnheard(0); }
          continue;
        }
        idx = n;
      }
      caughtSaid = false;
      const s = stories[idx];
      let lines = s.lines && s.lines.length ? s.lines : [{ role: "OPERATOR", text: s.headline }, { role: "ANALYST", text: s.summary }];
      if (!dialogue) { // one presenter: headline then the facts, no questions
        const facts = s.summary && s.summary !== s.headline ? s.summary : (lines.find((l) => l.role === "ANALYST") || {}).text;
        lines = [{ role: "OPERATOR", text: lines[0].text }].concat(facts && facts !== lines[0].text ? [{ role: "OPERATOR", text: facts }] : []);
      }
      if (fromLine === 0) {
        clearInterval(typeTimer); $("role").textContent = ""; $("line").textContent = "";
        prefetch(lines[0].text, lines[0].role, s.forceLang); // load the first sentence while the globe flies
        flyTo(s); showCard(s); await sleep(reduce ? 300 : 1200); if (!alive()) return;
      }
      for (lineIdx = fromLine; lineIdx < lines.length; lineIdx++) {
        if (!alive()) return;
        const l = lines[lineIdx];
        const role = ["OPERATOR", "COMMANDER", "ANALYST"].includes(l.role) ? l.role : "ANALYST";
        caption(role, l.text);
        const nl = lines[lineIdx + 1], ns = stories[(idx + 1) % stories.length];
        if (nl) prefetch(nl.text, nl.role, s.forceLang); else if (ns && ns.lines && ns.lines[0]) prefetch(ns.lines[0].text, ns.lines[0].role, ns.forceLang);
        await say(l.text, role, s.forceLang);
        if (!alive()) return;
        if (lineIdx === 0) markHeard(s);
        await sleep(150);
      }
      fromLine = 0;
      await sleep(400);
      if (!alive()) return;
      if (freshWaiting) { // new reports arrived while playing: go straight to them
        freshWaiting = false;
        caption("OPERATOR", phrase("fresh"));
        await say(phrase("fresh"), "OPERATOR");
        if (!alive()) return;
        idx = 0; continue;
      }
      idx = (idx + 1) % stories.length;
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
    manualPick = true;
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
        const wasEmpty = !allStories.length;
        news = data; allStories = data.stories.filter((s) => s && s.headline);
        allStories.forEach((s) => { s.lat = +s.lat || 0; s.lon = +s.lon || 0; });
        applyCat(true);
        renderInfo();
        if (announce && fresh && !wasEmpty && playing) {
          caption("OPERATOR", phrase("fresh"));
          await say(phrase("fresh"), "OPERATOR");
        }
      }
      if (announce && here) await loadLocal(true);
      return fresh;
    } catch {
      if (!stories.length) $("startMeta").textContent = "Couldn't load reports. Check your connection.";
      return false;
    }
  }

  /* ================= categories ================= */
  function listFor(c) {
    if (c === "All") return [weatherStory, ...allStories].filter(Boolean);
    if (c === "Local") return [weatherStory, ...localStories].filter(Boolean);
    return allStories.filter((s) => s.category === c);
  }
  function applyCat(keep) {
    let list = listFor(cat);
    if (!list.length && cat !== "Local") { cat = "All"; list = listFor(cat); }
    const cur = stories[idx];
    stories = list;
    const k = keep && cur ? stories.indexOf(cur) : -1;
    idx = k >= 0 ? k : Math.min(idx, Math.max(0, stories.length - 1));
    renderCats(); renderList(); renderProgress(); renderTicker();
  }
  function renderCats() {
    const bar = $("cats"); bar.innerHTML = "";
    for (const c of CATS) {
      const n = listFor(c).length;
      if (!n && c !== "Local" && c !== "All") continue;
      const b = document.createElement("button");
      b.className = "cat" + (c === cat ? " on" : "");
      b.innerHTML = `<span></span><i>${n}</i>`; b.firstChild.textContent = c === "Local" && localCity ? "📍 " + localCity.name : c;
      b.onclick = () => chooseCat(c);
      bar.appendChild(b);
    }
  }
  function chooseCat(c) {
    cat = c; store.set("cat", c);
    if (c === "Local" && !here) { toast("Allow location to get your local weather and news"); startLocation(true); }
    hush(); runId++; idx = 0;
    applyCat(false);
    if (!stories.length) { toast("No reports in this category yet"); return; }
    if (playing) run(0); else if (started) { flyTo(stories[0]); showCard(stories[0]); }
  }

  /* ================= location, weather, local news ================= */
  const km = (a, b) => { const R = 6371, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  let watching = false, lastWx = 0;
  function startLocation(ask) {
    if (!("geolocation" in navigator) || watching) return;
    watching = true;
    navigator.geolocation.watchPosition(onPos, (e) => {
      watching = false;
      if (ask || e.code === 1) $("locNote").textContent = e.code === 1 ? "Location is off. Allow it in iPhone Settings → Privacy & Security → Location Services → Safari Websites, then tap Use my location." : "Couldn't get your location right now.";
    }, { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 30000 });
  }
  async function onPos(p) {
    const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
    const moved = !here || km(here, pos) > 3;
    if (!moved && Date.now() - lastWx < 30 * 60 * 1000) return;
    here = { ...(here || {}), ...pos };
    if (moved || !here.city) {
      try {
        const g = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat}&longitude=${pos.lon}&localityLanguage=en`)).json();
        here.city = g.city || g.locality || g.principalSubdivision || "your area";
        here.area = g.locality && g.locality !== here.city ? g.locality : "";
        here.country = g.countryName || "";
      } catch {}
    }
    store.set("here", JSON.stringify(here));
    await refreshLocal();
  }
  async function refreshLocal() {
    if (!here) return;
    await Promise.all([fetchWeather(), loadLocal()]);
    applyCat(true);
    $("locNote").textContent = `📍 ${here.area ? here.area + ", " : ""}${here.city || ""}${here.country ? ", " + here.country : ""} · local news from ${localCity ? localCity.name : "—"}`;
  }
  async function fetchWeather() {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${here.lat}&longitude=${here.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
      const d = await (await fetch(u)).json();
      wx = { t: Math.round(d.current.temperature_2m), f: Math.round(d.current.apparent_temperature), u: Math.round(d.current.relative_humidity_2m),
        k: Math.round(d.current.wind_speed_10m), code: d.current.weather_code,
        h: Math.round(d.daily.temperature_2m_max[0]), l: Math.round(d.daily.temperature_2m_min[0]), p: Math.round(d.daily.precipitation_probability_max[0] || 0) };
      lastWx = Date.now();
      buildWeather();
    } catch (e) { console.warn("weather", e); }
  }
  function buildWeather() {
    if (!wx || !here) return;
    const i = wxIndex(wx.code), L = lang, c = here.city || "your area";
    const cond = (WX.cond[L] || WX.cond.en)[i];
    const lines = [{ role: "OPERATOR", text: fill(WX.now[L] || WX.now.en, { c, t: wx.t, w: cond }) },
      { role: "ANALYST", text: fill(WX.day[L] || WX.day.en, { h: wx.h, l: wx.l, f: wx.f, k: wx.k, u: wx.u, p: wx.p }) }];
    if (wx.h >= 42) lines.push({ role: "ANALYST", text: WX.heat[L] || WX.heat.en });
    if (wx.p >= 60 || i === 8) lines.push({ role: "ANALYST", text: WX.rain[L] || WX.rain.en });
    const ws = weatherStory || {};
    Object.assign(ws, { id: "weather", country: null, zoom: 3.2, label: c.toUpperCase(), lat: here.lat, lon: here.lon, flag: WX_ICON[i],
      severity: wx.h >= 44 || i === 8 ? "watch" : "info", category: "Weather",
      headline: `${c} · ${wx.t}°C · ${cond}`, summary: lines[1].text, lines, source: "Open-Meteo weather", url: "https://open-meteo.com/", time: new Date().toISOString() });
    weatherStory = ws;
    $("wx").hidden = false; $("wx").textContent = `${WX_ICON[i]} ${wx.t}° ${c.toUpperCase()}`;
  }
  async function loadLocal(force) {
    try {
      if (force || !localData || Date.now() - localData._t > 20 * 60 * 1000) {
        const r = await fetch("news-local.json?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) { localData = await r.json(); localData._t = Date.now(); }
      }
    } catch {}
    localCity = null; localStories = [];
    if (!localData || !localData.cities || !here) return;
    let best = null, bd = 1e9;
    for (const c of Object.values(localData.cities)) { const d = km(here, c); if (d < bd) { bd = d; best = c; } }
    if (best && bd < 400) {
      localCity = best;
      localStories = best.stories.map((s) => ({ ...s, zoom: 3, lat: +s.lat, lon: +s.lon }));
    }
  }
  setInterval(() => { if (here && Date.now() - lastWx > 30 * 60 * 1000) refreshLocal(); }, 5 * 60 * 1000);

  function renderTicker() {
    const items = stories.map((s) => `<span dir="auto">${(s.label || s.country || "World").replace(/</g, "")} — ${s.headline.replace(/</g, "")}</span>`).join("");
    $("tickRun").innerHTML = items + items; // doubled for a seamless loop
    $("tickRun").style.animationDuration = Math.max(40, stories.length * 9) + "s";
  }
  function renderInfo() {
    const n = allStories.length;
    $("startMeta").textContent = `${n} reports · updated ${ago(news.updated)}`;
    $("newsInfo").textContent = `${n} reports, updated ${ago(news.updated)}. New reports arrive every 30 minutes automatically.`;
  }
  let freshWaiting = false;
  async function checkFresh() {
    const f = await loadNews(false);
    if (f && playing) freshWaiting = true;
    if (here) refreshLocal();
    return f;
  }
  setInterval(checkFresh, 5 * 60 * 1000); // keeps checking even while the briefing plays
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkFresh(); });

  /* ================= list sheet ================= */
  function renderList() {
    $("listBody").innerHTML = "";
    stories.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "story" + (i === idx ? " cur" : "");
      b.innerHTML = `<span class="f"></span><span class="c"><span class="sv"></span><span class="n"></span></span><span class="h"></span>`;
      b.querySelector(".f").textContent = s.flag || "🌐";
      b.querySelector(".sv").style.background = sev(s.severity).col;
      b.querySelector(".n").textContent = (s.label || s.country || "World") + (s.category ? " · " + s.category : "") + (s.time ? " · " + ago(s.time) : "");
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
    if (openSheet && openSheet.id === "askSheet") { talkOn = false; try { rec && rec.abort(); } catch {} orb("idle"); }
    if (!silent && resumeAfter) { resumeAfter = false; if (started) play(lineIdx); }
    openSheet = null;
  }
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeSheets()));
  $("scrim").onclick = () => closeSheets();

  /* ================= Ask the analyst ================= */
  const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash-lite"];
  let goodModel = store.get("gmodel", ""); // remember the model that worked for this key
  let turns = [];
  const chips = [
    "Summarise today's news in 30 seconds",
    "What's the weather here today?",
    "Any local news near me?",
    "What's the biggest risk to the UAE right now?",
    "How will this affect oil and shipping prices?",
    "What's happening in Pakistan?",
  ];
  chips.forEach((t) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = t; b.onclick = () => { unlockAudio(); ask(t); }; $("chips").appendChild(b); });

  function newsContext() {
    const all = [weatherStory, ...allStories, ...localStories].filter(Boolean);
    const where = here ? `The user is now in ${[here.area, here.city, here.country].filter(Boolean).join(", ")}.\n` : "";
    return where + all.map((s, i) => `${i + 1}. [${s.category || ""} · ${s.label || s.country || "World"}] ${s.headline} — ${s.summary || ""} (Source: ${s.source || "n/a"})`).join("\n");
  }

  function rules() {
    const L = LANGS[lang].ai || "English";
    return `You are the ANALYST in "Ops Room", a live news app, talking to Awais, a businessman in Sharjah, UAE
(auto spare parts trade; from Pakistan; exports to Africa, Iraq, the Middle East, Georgia and Central Asia).
Today is ${new Date().toDateString()}. Latest reports on the board (including local weather and local news):
${newsContext()}

How to answer:
- Answer ONLY the exact question. The first sentence must be the direct answer.
- At most 3 short sentences. Do not list other news that was not asked about.
- Use the reports above; if they don't cover it, say so in one short clause, then give what you know and mark anything uncertain.
- Plain spoken text: no markdown, no bullet points, no emojis. Write numbers so they read well aloud.
- Reply in ${L}.`;
  }

  async function gemini(question, key, opts = {}) {
    const contents = turns.map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text }] }))
      .concat([{ role: "user", parts: [{ text: question }] }]);
    const order = goodModel ? [goodModel, ...MODELS.filter((m) => m !== goodModel)] : MODELS;
    const errors = [];
    for (const model of order) {
      for (const withSearch of opts.noSearch ? [false] : [true, false]) {
        const body = { systemInstruction: { parts: [{ text: opts.system || rules() }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 600 } };
        if (withSearch) body.tools = [{ google_search: {} }];
        let r, data;
        try {
          r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          });
          data = await r.json();
        } catch (e) { errors.push(model + ": network"); continue; }
        if (!r.ok) {
          const msg = (data.error && data.error.message) || "HTTP " + r.status;
          errors.push(`${model}${withSearch ? "+search" : ""}: ${r.status}`);
          if (r.status === 400 && /api key not valid|API_KEY_INVALID/i.test(msg)) throw new Error("This key is not valid. Copy it again from aistudio.google.com/apikey.");
          if (r.status === 403) errors.push(msg.slice(0, 140));
          continue; // 429 (limit), 404 (model not available) or anything else: try the next option
        }
        const cand = data.candidates && data.candidates[0];
        const text = cand && cand.content && (cand.content.parts || []).map((p) => p.text || "").join("").trim();
        if (!text) { errors.push(model + ": empty"); continue; }
        if (goodModel !== model) { goodModel = model; store.set("gmodel", model); }
        const chunksG = (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
        const sources = chunksG.map((c) => c.web).filter(Boolean).slice(0, 4);
        return { text: text.replace(/[*#_`]/g, ""), sources, model };
      }
    }
    throw new Error("Google refused every model (" + errors.slice(0, 6).join("; ") + ")");
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
    if (/weather|temperature|rain|hot|mausam|موسم/i.test(q) && weatherStory) return weatherStory.lines.map((l) => l.text).join(" ");
    const words = q.toLowerCase().match(/[a-z]{3,}/g) || [];
    const pool = [...allStories, ...localStories];
    const scored = pool.map((s) => {
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

  let asking = false, geminiWarned = false;
  async function ask(q, fromVoice) {
    q = (q || "").trim(); if (!q || asking) return;
    asking = true; $("q").value = ""; $("q").blur();
    hush();
    addMsg("me", q);
    const pending = addMsg("ai", "Thinking…");
    orb("think");
    const key = store.get("gkey", "");
    let answer = null, sources = [];
    const waitNote = (n) => { pending.text.textContent = `Analyst is finishing the last answer… ${n}s`; };
    if (key) {
      try { const r = await gemini(q, key); answer = r.text; sources = r.sources; }
      catch (e) { console.warn(e); if (!geminiWarned) { geminiWarned = true; toast("Gemini key: " + e.message.slice(0, 160) + ". Using the free AI instead.", 6000); } }
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
    orb("speak");
    await say(answer, "ANALYST");
    if (!fromVoice) orb("idle");
  }
  $("askForm").onsubmit = (e) => { e.preventDefault(); unlockAudio(); ask($("q").value); };

  /* ================= hands-free talk (like Gemini Live) ================= */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, talkOn = false, orbState = "idle";
  function orb(state, text) {
    orbState = state;
    $("orb").className = "orb " + state;
    $("orbTxt").textContent = text || { idle: "Tap to talk", listen: "Listening… just speak", think: "Thinking…", speak: "Speaking… tap to stop" }[state];
  }
  function listen() {
    if (!SR) {
      orb("idle", "Voice input is off on this phone. Turn on Settings → Siri → \"Talk to Siri\", and Settings → General → Keyboard → Enable Dictation. Then reopen the app.");
      talkOn = false; return;
    }
    hush();
    try {
      rec = new SR(); rec.lang = LANGS[lang].sr; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let finalText = "", heard = "";
      rec.onresult = (e) => {
        let t = ""; for (const r of e.results) t += r[0].transcript;
        heard = t; $("orbTxt").textContent = "“" + t + "”";
        if (e.results[e.results.length - 1].isFinal) finalText = t;
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { talkOn = false; orb("idle", "Allow the microphone and speech recognition for this site, then tap again."); }
      };
      rec.onend = async () => {
        rec = null;
        const q = (finalText || heard).trim();
        if (!q) { if (talkOn) orb("idle", "I didn't hear anything. Tap to talk."); talkOn = false; return; }
        await ask(q, true);
        if (talkOn) setTimeout(() => { if (talkOn) listen(); }, 300); else orb("idle");
      };
      rec.start(); orb("listen");
    } catch (e) { talkOn = false; orb("idle", "Couldn't start the microphone. Tap to try again."); }
  }
  $("orb").onclick = () => {
    unlockAudio();
    if (orbState === "listen") { talkOn = false; try { rec && rec.stop(); } catch {} return; }
    if (orbState === "speak" || orbState === "think") { talkOn = false; hush(); orb("idle"); return; }
    talkOn = true; listen();
  };

  /* ================= settings ================= */
  $("key").value = store.get("gkey", "");
  function keyNote() { $("keyNote").innerHTML = store.get("gkey", "") ? '<span class="ok">AI key saved. The analyst can search the web.</span>' : "The analyst already answers for free without a key. A free Gemini key adds live Google search for questions beyond today's reports."; }
  keyNote();
  $("bSaveKey").onclick = () => { store.set("gkey", $("key").value.trim()); goodModel = ""; geminiWarned = false; keyNote(); toast($("key").value.trim() ? "Key saved" : "Key removed"); };
  $("bTestKey").onclick = async () => {
    const k = $("key").value.trim(); if (!k) { toast("Paste a key first"); return; }
    $("keyNote").textContent = "Testing every Gemini model…";
    try { goodModel = ""; const r = await gemini("Reply with exactly: Analyst online.", k, { noSearch: true, system: "Reply briefly." }); $("keyNote").innerHTML = '<span class="ok">Working with ' + r.model + ": " + r.text.replace(/</g, "&lt;") + "</span>"; store.set("gkey", k); }
    catch (e) { $("keyNote").textContent = "Didn't work: " + e.message; }
  };
  function fillSelect(el) {
    el.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
    el.value = lang;
    el.onchange = async () => {
      lang = el.value; store.set("lang", lang); loadNews._warned = false;
      document.querySelectorAll(".langSel").forEach((x) => (x.value = lang));
      applyLang(); hush(); runId++;
      buildWeather();
      await loadNews(false);
      idx = 0; if (playing) run(0);
    };
  }
  document.querySelectorAll(".langSel").forEach(fillSelect);
  applyLang();
  function showDialogue() { const t = $("tglDialogue"); t.setAttribute("aria-checked", String(dialogue)); t.querySelector("span").textContent = dialogue ? "On" : "Off"; }
  showDialogue();
  $("tglDialogue").onclick = () => { dialogue = !dialogue; store.set("dialogue", dialogue ? "on" : "off"); showDialogue(); toast(dialogue ? "Commander and Analyst will discuss each report" : "One presenter reads each report"); };
  $("voiceSel").value = engine;
  $("voiceSel").onchange = () => { engine = $("voiceSel").value; gFails = 0; store.set("voice", engine); };
  $("rate").value = rate; $("rateVal").textContent = rate.toFixed(2) + "×";
  $("rate").oninput = () => { rate = parseFloat($("rate").value); store.set("rate", String(rate)); $("rateVal").textContent = rate.toFixed(2) + "×"; };
  $("bTestVoice").onclick = async () => {
    unlockAudio(); hush(); pickVoices();
    gFails = 0;
    say(lang === "en" ? "Operator here. Reports are coming in." : phrase("fresh"), "OPERATOR").then(() => say(lang === "en" ? "Commander here. What's the situation?" : phrase("fresh"), "COMMANDER")).then(() => say(lang === "en" ? "Analyst here. Here are the facts." : phrase("fresh"), "ANALYST"));
  };
  $("bRefresh").onclick = async () => { const f = await checkFresh(); toast(f ? "New reports loaded" : "You already have the latest reports (" + ago(news.updated) + ")"); };

  /* ================= controls ================= */
  function begin(withIntro = true) {
    if (started) return; started = true;
    unlockAudio();
    $("start").hidden = true; $("app").classList.remove("pre");
    startLocation(false);
    setTimeout(() => $("intro").classList.add("gone"), 1200);
    const first = phrase("hello", { g: greeting(), n: allStories.length });
    caption("OPERATOR", first);
    if (withIntro) {
      setPlaying(true);
      const my = ++runId;
      say(first, "OPERATOR").then(() => { if (playing && my === runId) run(0); });
    } else { hush(); }
  }
  $("bStart").onclick = () => begin(true);
  $("bSettings0").onclick = () => open("setSheet");
  $("bPlay").onclick = () => { unlockAudio(); if (!started) return begin(true); playing ? pause() : play(lineIdx); };
  $("bNext").onclick = () => { if (!started) begin(false); jump(idx + 1); };
  $("bPrev").onclick = () => { if (!started) begin(false); jump(idx - 1); };
  $("bList").onclick = () => { renderList(); open("listSheet"); };
  $("bAsk").onclick = () => {
    if (!started) { started = true; $("start").hidden = true; $("app").classList.remove("pre"); $("intro").classList.add("gone"); startLocation(false); }
    unlockAudio();
    resumeAfter = playing; if (playing) pause();
    open("askSheet");
    if (SR && orbState === "idle") { talkOn = true; listen(); }
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
  loadNews(false).then(() => { if (here) refreshLocal(); });
  $("wx").onclick = () => { if (!weatherStory) return; if (!stories.includes(weatherStory)) chooseCat("All"); if (!started) begin(false); jump(stories.indexOf(weatherStory)); };
  $("bLoc").onclick = () => { watching = false; startLocation(true); $("locNote").textContent = "Getting your location…"; };
})();
