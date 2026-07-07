/* ================= HELPERS & TABS ================= */
const $ = id => document.getElementById(id);
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
function showTab(t) {
  ['prayer', 'quran', 'duas', 'qibla', 'scholar'].forEach(x => {
    $('page-' + x).style.display = x === t ? (x === 'scholar' ? 'flex' : '') : 'none';
    $('tab-' + x).classList.toggle('active', x === t);
  });
  if (t === 'qibla') startQibla(); // tab tap doubles as the user gesture iOS needs
}

/* ================= PRAYER TIMES ================= */
const ALADHAN = 'https://api.aladhan.com/v1';
const TRACKED = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
let loc = store.get('dd-loc', null);
let method = store.get('dd-method', '2');
let todayTimings = null;
let countdownTimer = null;

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dateParam(d) {
  return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
}

function useMyLocation() {
  if (!navigator.geolocation) { alert('Location not supported on this device — enter your city instead.'); return; }
  $('prayer-content').innerHTML = '<div class="loading">Getting your location…</div>';
  navigator.geolocation.getCurrentPosition(
    p => { loc = { type: 'coords', lat: p.coords.latitude, lon: p.coords.longitude }; store.set('dd-loc', loc); loadPrayer(); },
    () => { $('prayer-content').innerHTML = '<div class="err">Location was blocked. Enter your city manually above.</div>'; }
  );
}
function useCity() {
  const city = $('loc-city').value.trim(), country = $('loc-country').value.trim();
  if (!city || !country) { alert('Enter both city and country.'); return; }
  loc = { type: 'city', city, country };
  store.set('dd-loc', loc);
  loadPrayer();
}
function methodChanged() { method = $('sel-method').value; store.set('dd-method', method); if (loc) loadPrayer(); }

async function fetchTimings(dateStr) {
  let url;
  if (loc.type === 'coords') url = `${ALADHAN}/timings/${dateStr}?latitude=${loc.lat}&longitude=${loc.lon}&method=${method}`;
  else url = `${ALADHAN}/timingsByCity/${dateStr}?city=${encodeURIComponent(loc.city)}&country=${encodeURIComponent(loc.country)}&method=${method}`;
  const r = await (await fetch(url)).json();
  if (r.code !== 200) throw new Error('bad response');
  return r.data;
}

async function loadPrayer() {
  if (!loc) return;
  $('prayer-content').innerHTML = '<div class="loading">Loading prayer times…</div>';
  try {
    const data = await fetchTimings(dateParam(new Date()));
    todayTimings = data.timings;
    renderHijri(data.date);
    renderPrayerTimes();
    renderStats();
  } catch {
    $('prayer-content').innerHTML = '<div class="err">Couldn\'t load prayer times. Check the city spelling (use a 2-letter country code like US) and try again.</div>';
  }
}

function renderHijri(dateObj) {
  const h = dateObj.hijri;
  $('hijri-box').innerHTML = `
    <div class="h-ar">${h.day} ${h.month.ar} ${h.year}</div>
    <div class="h-en">${h.day} ${h.month.en} ${h.year} AH · ${dateObj.readable}</div>`;
}

function to12h(t) {
  const [H, M] = t.split(':').map(Number);
  const am = H < 12;
  return ((H % 12) || 12) + ':' + String(M).padStart(2, '0') + (am ? ' AM' : ' PM');
}
function timeToDate(t) {
  const [H, M] = t.split(':').map(Number);
  const d = new Date(); d.setHours(H, M, 0, 0); return d;
}

function renderPrayerTimes() {
  const log = store.get('dd-tracker', {});
  const today = log[todayKey()] || {};
  const shown = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let next = null;
  const now = new Date();
  for (const p of TRACKED) { if (timeToDate(todayTimings[p]) > now) { next = p; break; } }

  let html = `<div class="card next-prayer">
      <div class="np-label">${next ? 'Next prayer' : 'All prayers done for today'}</div>
      <div class="np-name">${next || 'Fajr tomorrow'}</div>
      <div class="np-count" id="np-countdown">--:--:--</div>
      ${next ? `<div class="np-time">at ${to12h(todayTimings[next])}</div>` : ''}
    </div><div class="card">`;
  html += shown.map(p => {
    const trackable = TRACKED.includes(p);
    return `<div class="ptime ${p === next ? 'now' : ''}">
      <span class="pt-name">${p}</span>
      <span style="display:flex;align-items:center">
        <span class="pt-time">${to12h(todayTimings[p])}</span>
        ${trackable ? `<input type="checkbox" ${today[p] ? 'checked' : ''} onchange="trackPrayer('${p}', this.checked)" aria-label="Mark ${p} as prayed">` : ''}
      </span>
    </div>`;
  }).join('');
  html += '</div>';
  $('prayer-content').innerHTML = html;
  startCountdown(next);
}

function startCountdown(next) {
  if (countdownTimer) clearInterval(countdownTimer);
  const el = () => $('np-countdown');
  const target = next ? timeToDate(todayTimings[next]) : null;
  const tick = () => {
    if (!el()) return;
    if (!target) { el().textContent = '🌙'; return; }
    let diff = Math.floor((target - new Date()) / 1000);
    if (diff <= 0) { loadPrayer(); return; }
    const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
    el().textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ================= INSPIRATION & CELEBRATION ================= */
const QUOTES = [
  { ar: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", en: "Indeed, with hardship comes ease.", src: "Qur'an 94:6" },
  { ar: "فَاذْكُرُونِي أَذْكُرْكُمْ", en: "So remember Me; I will remember you.", src: "Qur'an 2:152" },
  { ar: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا", en: "Allah does not burden a soul beyond what it can bear.", src: "Qur'an 2:286" },
  { ar: "ادْعُونِي أَسْتَجِبْ لَكُمْ", en: "Call upon Me; I will respond to you.", src: "Qur'an 40:60" },
  { ar: "إِنَّ الصَّلَاةَ تَنْهَى عَنِ الْفَحْشَاءِ وَالْمُنكَرِ", en: "Indeed, prayer restrains from immorality and wrongdoing.", src: "Qur'an 29:45" },
  { ar: "", en: "The most beloved deeds to Allah are those done most consistently, even if they are small.", src: "Sahih al-Bukhari, Sahih Muslim" },
  { ar: "", en: "Whoever prays the dawn prayer is under the protection of Allah.", src: "Sahih Muslim" },
  { ar: "", en: "The strong believer is better and more beloved to Allah than the weak believer, while there is good in both.", src: "Sahih Muslim" },
  { ar: "", en: "Supplication is itself worship.", src: "Abu Dawud, At-Tirmidhi" },
  { ar: "وَقُل رَّبِّ زِدْنِي عِلْمًا", en: "And say: My Lord, increase me in knowledge.", src: "Qur'an 20:114" },
];

function renderInspo() {
  // rotate deterministically every 5 minutes
  const idx = Math.floor(Date.now() / (5 * 60 * 1000)) % QUOTES.length;
  const q = QUOTES[idx];
  if (!$('inspo-text')) return;
  $('inspo-text').textContent = '"' + q.en + '"';
  $('inspo-src').textContent = '— ' + q.src;
}
setInterval(renderInspo, 30 * 1000); // check every 30s; text changes on the 5-min boundary

function celebrate(titleText) {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  $('cel-title').textContent = titleText;
  $('cel-ar').textContent = q.ar;
  $('cel-ar').style.display = q.ar ? '' : 'none';
  $('cel-quote').textContent = '"' + q.en + '"';
  $('cel-src').textContent = '— ' + q.src;
  $('celebrate-overlay').style.display = 'flex';
  // confetti burst
  const colors = ['#B9A05C', '#5CB98A', '#E7E9F4', '#9CC4E8', '#F5A524'];
  for (let i = 0; i < 45; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    c.style.animationDelay = (Math.random() * 0.4) + 's';
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
}
function closeCelebrate(e) {
  // close when clicking the dark background or the button (no event passed)
  if (e && e.target !== $('celebrate-overlay')) return;
  $('celebrate-overlay').style.display = 'none';
}
// button version without event check
function closeCelebrateBtn() { $('celebrate-overlay').style.display = 'none'; }

function trackPrayer(p, done) {
  const log = store.get('dd-tracker', {});
  const k = todayKey();
  log[k] = log[k] || {};
  log[k][p] = done;
  store.set('dd-tracker', log);
  renderStats();
  if (done) celebrate(p + ' logged — may Allah accept it');
}

function renderStats() {
  const log = store.get('dd-tracker', {});
  const k = todayKey();
  const today = log[k] || {};
  const doneToday = TRACKED.filter(p => today[p]).length;

  // streak: consecutive past days (ending yesterday or today-if-complete) with all 5
  let streak = 0;
  const d = new Date();
  if (doneToday === 5) streak++;
  for (let i = 1; i < 400; i++) {
    const dd = new Date(); dd.setDate(d.getDate() - i);
    const kk = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
    const day = log[kk];
    if (day && TRACKED.every(p => day[p])) streak++;
    else break;
  }

  // missed: over days that have any record, count unchecked (excluding today)
  let missed = 0;
  for (const key of Object.keys(log)) {
    if (key === k) continue;
    missed += TRACKED.filter(p => !log[key][p]).length;
  }

  $('stats-box').innerHTML = `
    <div class="stat"><b class="gold">${doneToday}/5</b><span>Prayed today</span></div>
    <div class="stat"><b class="green">${streak}</b><span>Day streak</span></div>
    <div class="stat"><b class="red">${missed}</b><span>Missed (logged days)</span></div>`;
}

/* ================= ISLAMIC CALENDAR ================= */
const HOLIDAYS = [
  { d: 1, m: 1, name: 'Islamic New Year' },
  { d: 10, m: 1, name: 'Day of Ashura' },
  { d: 1, m: 9, name: 'First day of Ramadan' },
  { d: 27, m: 9, name: 'Laylat al-Qadr (sought in the last ten nights)' },
  { d: 1, m: 10, name: 'Eid al-Fitr' },
  { d: 9, m: 12, name: 'Day of Arafah' },
  { d: 10, m: 12, name: 'Eid al-Adha' },
];

async function loadHolidays() {
  try {
    const todayH = await (await fetch(`${ALADHAN}/gToH/${dateParam(new Date())}`)).json();
    const hy = parseInt(todayH.data.hijri.year);
    const items = [];
    for (const yr of [hy, hy + 1]) {
      for (const h of HOLIDAYS) {
        const r = await (await fetch(`${ALADHAN}/hToG/${String(h.d).padStart(2, '0')}-${String(h.m).padStart(2, '0')}-${yr}`)).json();
        if (r.code !== 200) continue;
        const g = r.data.gregorian;
        const gd = new Date(+g.year, g.month.number - 1, +g.day);
        if (gd >= new Date(new Date().setHours(0, 0, 0, 0))) {
          items.push({ name: h.name, when: `${g.day} ${g.month.en} ${g.year}`, sort: gd });
        }
      }
      if (items.length >= 6) break;
    }
    items.sort((a, b) => a.sort - b.sort);
    $('holidays-box').innerHTML = items.slice(0, 7).map(i =>
      `<div class="holiday"><span>${i.name}</span><span class="h-when">${i.when}</span></div>`).join('') ||
      '<div class="loading">No upcoming dates found.</div>';
  } catch {
    $('holidays-box').innerHTML = '<div class="err">Couldn\'t load calendar dates.</div>';
  }
}

/* ================= QURAN ================= */
const QAPI = 'https://api.alquran.cloud/v1';
/* Curated reciters. type 'islamic' = cdn.islamic.network (global ayah number);
   type 'everyayah' = everyayah.com (surah+ayah, fixed quality in path) */
const CURATED_RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', type: 'islamic' },
  { id: 'yasser.dossary', name: 'Yasser Al-Dosari', type: 'everyayah', path: 'Yasser_Ad-Dussary_128kbps' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdur-Rahman As-Sudais', type: 'islamic' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly', type: 'islamic' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq El-Minshawi', type: 'islamic' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', type: 'islamic' },
  { id: 'ar.saoodshuraym', name: "Sa'ud Ash-Shuraym", type: 'islamic' },
];
const pad3 = n => String(n).padStart(3, '0');
function reciterDef() { return CURATED_RECITERS.find(r => r.id === reciter) || CURATED_RECITERS[0]; }
/* Famous-verse shortcuts: name → surah (+ optional ayah to scroll to) */
const SHORTCUTS = {
  'kursi': { surah: 2, ayah: 255 }, 'ayat al-kursi': { surah: 2, ayah: 255 }, 'ayatul kursi': { surah: 2, ayah: 255 },
  'yaseen': { surah: 36 }, 'yasin': { surah: 36 }, 'ya-sin': { surah: 36 },
  'mulk': { surah: 67 }, 'kahf': { surah: 18 }, 'rahman': { surah: 55 }, 'ar-rahman': { surah: 55 },
  'waqiah': { surah: 56 }, 'waqia': { surah: 56 }, 'fatiha': { surah: 1 }, 'ikhlas': { surah: 112 },
  'falaq': { surah: 113 }, 'nas': { surah: 114 }, 'baqarah': { surah: 2 }, 'juz amma': { surah: 78 },
  'amanar rasul': { surah: 2, ayah: 285 }, 'last two of baqarah': { surah: 2, ayah: 285 },
};
let surahList = [];
let quranMode = 'surah';
let currentJuz = store.get('dd-juz', 30);
let scrollToAyahAfterLoad = null;
let currentSurah = store.get('dd-surah', 1);
let translation = store.get('dd-translation', 'en.pickthall');
let reciter = store.get('dd-reciter', 'ar.alafasy');
let prefs = store.get('dd-qprefs', { translit: false, english: true });
let currentAudio = null, playAllQueue = [], surahData = null;

async function initQuran() {
  try {
    const s = await (await fetch(QAPI + '/surah')).json();
    surahList = s.data;
    renderSurahOptions(surahList);
    $('sel-surah').value = currentSurah;
    $('sel-surah').onchange = () => { currentSurah = +$('sel-surah').value; store.set('dd-surah', currentSurah); loadSurah(); };

    const t = await (await fetch(QAPI + '/edition?format=text&language=en&type=translation')).json();
    $('sel-translation').innerHTML = t.data.map(x => `<option value="${x.identifier}">${x.englishName}</option>`).join('');
    if ([...$('sel-translation').options].some(o => o.value === translation)) $('sel-translation').value = translation;
    else translation = $('sel-translation').value;
    $('sel-translation').onchange = () => { translation = $('sel-translation').value; store.set('dd-translation', translation); loadSurah(); };

    // Curated top reciters only
    $('sel-reciter').innerHTML = CURATED_RECITERS.map(x => `<option value="${x.id}">🎙 ${x.name}</option>`).join('');
    if (CURATED_RECITERS.some(x => x.id === reciter)) $('sel-reciter').value = reciter;
    else { reciter = CURATED_RECITERS[0].id; store.set('dd-reciter', reciter); }
    $('sel-reciter').onchange = () => { reciter = $('sel-reciter').value; store.set('dd-reciter', reciter); delete bitrateCache[reciter]; stopAudio(); };

    // Juz selector
    $('sel-juz').innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Juz ${i + 1}</option>`).join('');
    $('sel-juz').value = currentJuz;
    $('sel-juz').onchange = () => { currentJuz = +$('sel-juz').value; store.set('dd-juz', currentJuz); loadJuz(); };

    $('tg-translit').checked = prefs.translit;
    $('tg-english').checked = prefs.english;
    renderResume(); renderBookmarks(); loadSurah();
  } catch {
    $('surah-container').innerHTML = '<div class="err">Couldn\'t load the Qur\'an. Check your connection and refresh.</div>';
  }
}

function renderSurahOptions(list) {
  $('sel-surah').innerHTML = list.map(x =>
    `<option value="${x.number}">${x.number}. ${x.englishName} — ${x.englishNameTranslation}</option>`).join('');
}
function setQuranMode(m) {
  quranMode = m;
  $('qm-surah').classList.toggle('active', m === 'surah');
  $('qm-juz').classList.toggle('active', m === 'juz');
  $('wrap-surah').style.display = m === 'surah' ? '' : 'none';
  $('wrap-juz').style.display = m === 'juz' ? '' : 'none';
  stopAudio();
  if (m === 'surah') loadSurah(); else loadJuz();
}

function filterSurahs() {
  const q = $('q-search').value.trim().toLowerCase();
  // Famous-verse shortcuts: "kursi" → Al-Baqarah 2:255, "yaseen" → Surah 36, etc.
  for (const key of Object.keys(SHORTCUTS)) {
    if (q.length >= 3 && (key === q || key.includes(q) || q.includes(key))) {
      const t = SHORTCUTS[key];
      setQuranMode('surah');
      currentSurah = t.surah;
      $('sel-surah').value = t.surah;
      store.set('dd-surah', t.surah);
      scrollToAyahAfterLoad = t.ayah || null;
      loadSurah();
      return;
    }
  }
  const filtered = q ? surahList.filter(s =>
    String(s.number) === q ||
    s.englishName.toLowerCase().includes(q) ||
    s.englishNameTranslation.toLowerCase().includes(q)) : surahList;
  renderSurahOptions(filtered.length ? filtered : surahList);
  if (q && filtered.length) { $('sel-surah').value = filtered[0].number; currentSurah = filtered[0].number; store.set('dd-surah', currentSurah); loadSurah(); }
}
function jumpToAyah() {
  const n = parseInt($('q-ayah-jump').value);
  if (!n || !surahData) return;
  const a = surahData.ayahs.find(x => x.numberInSurah === n);
  if (a) { const el = $('ayah-' + a.number); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else alert('This surah has ' + surahData.numberOfAyahs + ' ayahs.');
}
function togglePref(k) {
  prefs[k] = $('tg-' + k).checked;
  store.set('dd-qprefs', prefs);
  loadSurah();
}

function renderResume() {
  const last = store.get('dd-lastread', null);
  $('resume-box').innerHTML = (last && last.surah !== currentSurah)
    ? `<div class="resume"><span>Continue where you left off: ${last.surahName} (${last.surah}:${last.ayah})</span>
       <button onclick="resumeReading(${last.surah})">Resume</button></div>` : '';
}
function resumeReading(n) { currentSurah = n; $('sel-surah').value = n; store.set('dd-surah', n); loadSurah(); }

function renderBookmarks() {
  const bms = store.get('dd-bookmarks', []);
  $('bookmarks-box').innerHTML = bms.length ? `<div class="card">
    <div style="font-size:12px;color:var(--gold);font-weight:700;margin-bottom:6px">★ Bookmarks</div>
    ${bms.map(b => `<div class="bm-item"><span>${b.surahName} ${b.surah}:${b.ayah}</span>
      <span><button onclick="resumeReading(${b.surah})">Open</button>
      <button onclick="removeBookmark(${b.surah},${b.ayah})">✕</button></span></div>`).join('')}
  </div>` : '';
}
function toggleBookmark(surah, ayah, surahName) {
  let bms = store.get('dd-bookmarks', []);
  const i = bms.findIndex(b => b.surah === surah && b.ayah === ayah);
  if (i >= 0) bms.splice(i, 1); else bms.push({ surah, ayah, surahName });
  store.set('dd-bookmarks', bms);
  renderBookmarks(); loadSurahButtonsOnly(surah, ayah);
}
function removeBookmark(surah, ayah) {
  store.set('dd-bookmarks', store.get('dd-bookmarks', []).filter(b => !(b.surah === surah && b.ayah === ayah)));
  renderBookmarks(); loadSurah();
}
function loadSurahButtonsOnly() { loadSurah(); } // simple full refresh keeps state consistent

async function loadSurah() {
  stopAudio();
  const c = $('surah-container');
  c.innerHTML = '<div class="loading">Loading surah…</div>';
  try {
    const editions = ['quran-uthmani', translation];
    if (prefs.translit) editions.push('en.transliteration');
    const res = await (await fetch(`${QAPI}/surah/${currentSurah}/editions/${editions.join(',')}`)).json();
    const ar = res.data[0], en = res.data[1], tr = prefs.translit ? res.data[2] : null;
    surahData = ar;
    const bms = store.get('dd-bookmarks', []);
    let html = `<div class="surah-head">
        <div class="surah-arabic">${ar.name}</div>
        <div class="surah-meta">Surah ${ar.number} · ${ar.englishName} · ${ar.numberOfAyahs} ayahs · ${ar.revelationType}</div>
      </div>`;
    if (ar.number !== 1 && ar.number !== 9) html += `<div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    html += `<button class="btn playall" id="btn-playall" onclick="togglePlayAll()">▶ Play full surah</button>`;
    html += ar.ayahs.map((a, i) => {
      const isBm = bms.some(b => b.surah === ar.number && b.ayah === a.numberInSurah);
      return `<div class="ayah" id="ayah-${a.number}">
        <div class="ayah-top">
          <span class="ayah-num">${ar.number}:${a.numberInSurah}</span>
          <span class="ayah-actions">
            <button class="abtn ${isBm ? 'bookmarked' : ''}" onclick="toggleBookmark(${ar.number},${a.numberInSurah},'${ar.englishName}')">★</button>
            <button class="abtn" id="pb-${a.number}" onclick="toggleAyah(${a.number},${ar.number},${a.numberInSurah})">▶ Play</button>
          </span>
        </div>
        <div class="arabic">${a.text}</div>
        ${tr ? `<div class="translit">${tr.ayahs[i].text}</div>` : ''}
        ${prefs.english ? `<div class="english">${en.ayahs[i].text}</div>` : ''}
      </div>`;
    }).join('');
    c.innerHTML = html;
    renderResume();
    if (scrollToAyahAfterLoad) {
      const target = ar.ayahs.find(x => x.numberInSurah === scrollToAyahAfterLoad);
      scrollToAyahAfterLoad = null;
      if (target) setTimeout(() => {
        const el = $('ayah-' + target.number);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.borderColor = 'var(--gold)'; }
      }, 150);
    }
  } catch {
    c.innerHTML = '<div class="err">Couldn\'t load this surah. Please try again.</div>';
  }
}

/* Audio with automatic quality fallback (islamic.network) or direct URL (everyayah) */
const BITRATES = ['128', '64', '192', '32'];
let bitrateCache = store.get('dd-bitrates', {});
function audioSrc(item, br) {
  const rd = reciterDef();
  if (rd.type === 'everyayah') return `https://everyayah.com/data/${rd.path}/${pad3(item.s)}${pad3(item.a)}.mp3`;
  return `https://cdn.islamic.network/quran/audio/${br}/${reciter}/${item.g}.mp3`;
}

function buildAudio(item, onended, onallfail) {
  const rd = reciterDef();
  const order = rd.type === 'everyayah'
    ? ['x'] // single fixed-quality URL
    : (bitrateCache[reciter] ? [bitrateCache[reciter], ...BITRATES.filter(b => b !== bitrateCache[reciter])] : BITRATES.slice());
  let idx = 0;
  const a = new Audio();
  a.playbackRate = playbackRate;
  const tryNext = () => {
    if (idx >= order.length) { if (onallfail) onallfail(); return; }
    a.src = audioSrc(item, order[idx]);
    a.load();
    a.play().then(() => {
      if (rd.type !== 'everyayah') { bitrateCache[reciter] = order[idx]; store.set('dd-bitrates', bitrateCache); }
    }).catch(() => { idx++; tryNext(); });
  };
  a.onerror = () => { idx++; tryNext(); };
  a.onended = onended;
  a.startPlay = tryNext;
  return a;
}

let playbackRate = store.get('dd-speed', 1);
function speedChanged() {
  playbackRate = parseFloat($('sel-speed').value);
  store.set('dd-speed', playbackRate);
  if (currentAudio) currentAudio.playbackRate = playbackRate;
}
/* ---- Player state: supports pause/resume for single ayahs and full sequences ---- */
let player = { mode: null, g: null, paused: false, items: null, index: 0 };

function markLastRead(inSurah) {
  if (!surahData || quranMode !== 'surah') return;
  store.set('dd-lastread', { surah: surahData.number, surahName: surahData.englishName, ayah: inSurah });
}

function setBtnLabels() {
  // Big play-all button
  const big = $('btn-playall');
  if (big) {
    if (player.mode === 'seq') big.textContent = player.paused ? '▶ Resume' : '⏸ Pause';
    else big.textContent = quranMode === 'juz' ? '▶ Play full juz' : '▶ Play full surah';
  }
  // Per-ayah buttons
  document.querySelectorAll('[id^="pb-"]').forEach(b => { b.textContent = '▶ Play'; });
  if (player.g !== null) {
    const b = $('pb-' + player.g);
    if (b) b.textContent = player.paused ? '▶ Resume' : '⏸ Pause';
  }
}

function pausePlayback() {
  if (currentAudio && !player.paused) { currentAudio.pause(); player.paused = true; setBtnLabels(); }
}
function resumePlayback() {
  if (currentAudio && player.paused) {
    currentAudio.playbackRate = playbackRate;
    currentAudio.play().catch(() => {});
    player.paused = false;
    setBtnLabels();
  }
}
function stopAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; currentAudio.onerror = null; currentAudio = null; }
  playAllQueue = [];
  player = { mode: null, g: null, paused: false, items: null, index: 0 };
  document.querySelectorAll('.ayah.playing').forEach(el => el.classList.remove('playing'));
  setBtnLabels();
}

function toggleAyah(g, surahNum, inSurah) {
  if (player.g === g && currentAudio) {
    player.paused ? resumePlayback() : pausePlayback();
    return;
  }
  stopAudio();
  const el = $('ayah-' + g);
  if (el) { el.classList.add('playing'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  markLastRead(inSurah);
  player = { mode: 'single', g, paused: false, items: null, index: 0 };
  const item = { g, s: surahNum, a: inSurah };
  const a = buildAudio(item,
    () => { if (el) el.classList.remove('playing'); player.g = null; setBtnLabels(); },
    () => { if (el) el.classList.remove('playing'); player.g = null; setBtnLabels(); });
  currentAudio = a;
  a.startPlay();
  setBtnLabels();
}

function playSequence(items) {
  stopAudio();
  playAllQueue = items;
  player = { mode: 'seq', g: null, paused: false, items, index: 0 };
  const preloadEl = {};
  const preload = (i) => {
    if (i >= items.length || preloadEl[i]) return;
    const br = bitrateCache[reciter] || '128';
    const a = new Audio(audioSrc(items[i], br));
    a.preload = 'auto';
    preloadEl[i] = a;
  };
  preload(0); preload(1); preload(2);
  const playIndex = (i) => {
    if (i >= items.length || playAllQueue !== items) { if (playAllQueue === items) stopAudio(); return; }
    player.index = i;
    const item = items[i];
    player.g = item.g;
    const el = $('ayah-' + item.g);
    document.querySelectorAll('.ayah.playing').forEach(x => x.classList.remove('playing'));
    if (el) { el.classList.add('playing'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (item.a) markLastRead(item.a);
    preload(i + 1); preload(i + 2);
    const pre = preloadEl[i];
    delete preloadEl[i];
    if (pre && pre.readyState >= 2) {
      pre.playbackRate = playbackRate;
      currentAudio = pre;
      pre.onended = () => { if (el) el.classList.remove('playing'); playIndex(i + 1); };
      pre.onerror = () => { if (el) el.classList.remove('playing'); playIndex(i + 1); };
      pre.play().catch(() => playIndex(i + 1));
    } else {
      const a = buildAudio(item,
        () => { if (el) el.classList.remove('playing'); playIndex(i + 1); },
        () => { if (el) el.classList.remove('playing'); playIndex(i + 1); });
      currentAudio = a;
      a.startPlay();
    }
    setBtnLabels();
  };
  playIndex(0);
}

function togglePlayAll() {
  if (player.mode === 'seq' && currentAudio) {
    player.paused ? resumePlayback() : pausePlayback();
    return;
  }
  if (quranMode === 'juz' && juzData) {
    playSequence(juzData.ayahs.map(a => ({ g: a.number, s: a.surah.number, a: a.numberInSurah })));
  } else if (surahData) {
    playSequence(surahData.ayahs.map(a => ({ g: a.number, s: surahData.number, a: a.numberInSurah })));
  }
}
function playAll() { togglePlayAll(); }
function playAyah(g, s, n) { toggleAyah(g, s, n); }

/* ---- JUZ MODE ---- */
let juzData = null;
async function loadJuz() {
  stopAudio();
  const c = $('surah-container');
  c.innerHTML = '<div class="loading">Loading Juz ' + currentJuz + '…</div>';
  try {
    const fetches = [
      fetch(`${QAPI}/juz/${currentJuz}/quran-uthmani`).then(r => r.json()),
      fetch(`${QAPI}/juz/${currentJuz}/${translation}`).then(r => r.json()),
    ];
    if (prefs.translit) fetches.push(fetch(`${QAPI}/juz/${currentJuz}/en.transliteration`).then(r => r.json()));
    const results = await Promise.all(fetches);
    const ar = results[0].data, en = results[1].data, tr = prefs.translit ? results[2].data : null;
    juzData = ar;
    const bms = store.get('dd-bookmarks', []);
    let html = `<div class="surah-head">
        <div class="surah-arabic">الجزء ${currentJuz}</div>
        <div class="surah-meta">Juz ${currentJuz} · ${ar.ayahs.length} ayahs</div>
      </div>
      <button class="btn playall" id="btn-playall" onclick="togglePlayAll()">▶ Play full juz</button>`;
    let lastSurah = null;
    html += ar.ayahs.map((a, i) => {
      let sep = '';
      if (a.surah.number !== lastSurah) {
        lastSurah = a.surah.number;
        sep = `<div class="juz-surah-head">${a.surah.name}<small>Surah ${a.surah.number} · ${a.surah.englishName}</small></div>`;
      }
      const isBm = bms.some(b => b.surah === a.surah.number && b.ayah === a.numberInSurah);
      return sep + `<div class="ayah" id="ayah-${a.number}">
        <div class="ayah-top">
          <span class="ayah-num">${a.surah.number}:${a.numberInSurah}</span>
          <span class="ayah-actions">
            <button class="abtn ${isBm ? 'bookmarked' : ''}" onclick="toggleBookmark(${a.surah.number},${a.numberInSurah},'${a.surah.englishName}')">★</button>
            <button class="abtn" id="pb-${a.number}" onclick="toggleAyah(${a.number},${a.surah.number},${a.numberInSurah})">▶ Play</button>
          </span>
        </div>
        <div class="arabic">${a.text}</div>
        ${tr ? `<div class="translit">${tr.ayahs[i].text}</div>` : ''}
        ${prefs.english ? `<div class="english">${en.ayahs[i].text}</div>` : ''}
      </div>`;
    }).join('');
    c.innerHTML = html;
  } catch {
    c.innerHTML = '<div class="err">Couldn\'t load this juz. Please try again.</div>';
  }
}

/* ================= DUAS ================= */
const DUAS = [
  { cat: 'Morning', title: "Sayyid al-Istighfar — the best du'a for forgiveness", ar: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ", translit: "Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mastata'tu, a'udhu bika min sharri ma sana'tu, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li, fa innahu la yaghfirudh-dhunuba illa ant", en: "O Allah, You are my Lord, there is no god but You. You created me and I am Your servant, and I keep Your covenant and promise as much as I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favor upon me and I acknowledge my sin, so forgive me — for none forgives sins but You.", src: "Sahih al-Bukhari", rep: "Morning & evening" },
  { cat: 'Morning', title: "Asbahna wa asbahal-mulku lillah", ar: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ", translit: "Asbahna wa asbahal-mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah", en: "We have entered the morning, and the dominion belongs to Allah. All praise is for Allah. There is no god but Allah alone, without partner.", src: "Sahih Muslim", rep: "Morning (evening: Amsayna…)" },
  { cat: 'Morning', title: "Protection through Allah's name", ar: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ", translit: "Bismillahil-ladhi la yadurru ma'a ismihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-'Alim", en: "In the name of Allah, with whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, All-Knowing.", src: "Abu Dawud, At-Tirmidhi (graded sahih)", rep: "3× morning & evening" },
  { cat: 'Evening', title: "Hasbiyallah — Allah is sufficient for me", verses: [[9,129]], ar: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ", translit: "Hasbiyallahu la ilaha illa huwa, 'alayhi tawakkaltu wa huwa Rabbul-'arshil-'azim", en: "Allah is sufficient for me. There is no god but Him. In Him I place my trust, and He is the Lord of the Mighty Throne.", src: "Qur'an 9:129; Abu Dawud", rep: "7× morning & evening" },
  { cat: 'Evening', title: "The three Quls", verses: [[112,1],[112,2],[112,3],[112,4],[113,1],[113,2],[113,3],[113,4],[113,5],[114,1],[114,2],[114,3],[114,4],[114,5],[114,6]], ar: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ", translit: "Surah Al-Ikhlas, Surah Al-Falaq, Surah An-Nas", en: "Recite Surah Al-Ikhlas, Al-Falaq, and An-Nas — the Prophet ﷺ said they suffice you for everything.", src: "Abu Dawud, At-Tirmidhi", rep: "3× morning & evening" },
  { cat: 'Sleep', title: "Before sleeping", ar: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", translit: "Bismika Allahumma amutu wa ahya", en: "In Your name, O Allah, I die and I live.", src: "Sahih al-Bukhari" },
  { cat: 'Sleep', title: "Waking up", ar: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ", translit: "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur", en: "All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection.", src: "Sahih al-Bukhari" },
  { cat: 'Eating', title: "Before eating", ar: "بِسْمِ اللَّهِ", translit: "Bismillah — and if you forget, say: Bismillahi awwalahu wa akhirahu", en: "In the name of Allah. (If you forget at the start: 'In the name of Allah at its beginning and its end.')", src: "Abu Dawud, At-Tirmidhi" },
  { cat: 'Eating', title: "After eating", ar: "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ", translit: "Alhamdu lillahil-ladhi at'amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah", en: "All praise is for Allah who fed me this and provided it for me, without any power or strength from myself.", src: "Abu Dawud, At-Tirmidhi" },
  { cat: 'Travel', title: "Du'a of travel", verses: [[43,13],[43,14]], ar: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ", translit: "Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila Rabbina lamunqalibun", en: "Glory to Him who has subjected this to us, for we could never have accomplished it ourselves — and surely to our Lord we will return.", src: "Qur'an 43:13-14; Sahih Muslim" },
  { cat: 'Prayer', title: "After salah", ar: "أَسْتَغْفِرُ اللَّهَ (ثَلَاثًا) اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ", translit: "Astaghfirullah (3×). Allahumma antas-salamu wa minkas-salam, tabarakta ya Dhal-jalali wal-ikram", en: "I seek Allah's forgiveness (3×). O Allah, You are Peace and from You is peace. Blessed are You, O Possessor of Majesty and Honor.", src: "Sahih Muslim" },
  { cat: 'Prayer', title: "Tasbih after salah", ar: "سُبْحَانَ اللَّهِ (٣٣) الْحَمْدُ لِلَّهِ (٣٣) اللَّهُ أَكْبَرُ (٣٤)", translit: "SubhanAllah 33×, Alhamdulillah 33×, Allahu Akbar 34×", en: "Glory be to Allah (33×), All praise is for Allah (33×), Allah is the Greatest (34×).", src: "Sahih Muslim", rep: "After each prayer" },
  { cat: 'Protection', title: "Refuge in Allah's perfect words", ar: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", translit: "A'udhu bikalimatillahit-tammati min sharri ma khalaq", en: "I seek refuge in the perfect words of Allah from the evil of what He has created.", src: "Sahih Muslim", rep: "3× in the evening" },
  { cat: 'Family', title: "For spouse and children", verses: [[25,74]], ar: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا", translit: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yunin waj'alna lil-muttaqina imama", en: "Our Lord, grant us from our spouses and offspring comfort to our eyes, and make us leaders of the righteous.", src: "Qur'an 25:74" },
  { cat: 'Ramadan', title: "Laylat al-Qadr du'a", ar: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي", translit: "Allahumma innaka 'afuwwun tuhibbul-'afwa fa'fu 'anni", en: "O Allah, You are Pardoning and You love to pardon, so pardon me.", src: "At-Tirmidhi, Ibn Majah (graded sahih)" },
  { cat: 'Hajj & Umrah', title: "The Talbiyah", ar: "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ", translit: "Labbayk Allahumma labbayk, labbayka la sharika laka labbayk, innal-hamda wan-ni'mata laka wal-mulk, la sharika lak", en: "Here I am, O Allah, here I am. Here I am, You have no partner, here I am. Truly all praise, favor, and sovereignty are Yours. You have no partner.", src: "Sahih al-Bukhari, Sahih Muslim" },
];
let duaCat = 'Morning';

function initDuas() {
  const cats = [...new Set(DUAS.map(d => d.cat))];
  cats.push('★ Favorites');
  $('dua-cats').innerHTML = cats.map(c =>
    `<button class="cat ${c === duaCat ? 'active' : ''}" onclick="setDuaCat('${c}')">${c}</button>`).join('');
  renderDuas();
}
function setDuaCat(c) { duaCat = c; initDuas(); }
function renderDuas() {
  const favs = store.get('dd-favduas', []);
  const list = duaCat === '★ Favorites' ? DUAS.filter((d, i) => favs.includes(i)) : DUAS.filter(d => d.cat === duaCat);
  $('dua-list').innerHTML = list.length ? list.map(d => {
    const i = DUAS.indexOf(d);
    const on = favs.includes(i);
    return `<div class="card dua">
      <div class="d-title"><span>${d.title}</span>
        <span style="display:flex;gap:4px;align-items:center">
          ${d.verses ? `<button class="abtn" onclick="readDua(${i})" aria-label="Listen" title="Recitation by Alafasy">🔊</button>` : ''}
          <button class="fav ${on ? 'on' : ''}" onclick="toggleFavDua(${i})" aria-label="Favorite">★</button>
        </span></div>
      <div class="arabic">${d.ar}</div>
      <div class="translit">${d.translit}</div>
      <div class="english">${d.en}</div>
      <div class="d-src">Source: ${d.src}</div>
      ${d.rep ? `<span class="d-rep">${d.rep}</span>` : ''}
    </div>`;
  }).join('') : '<div class="loading">No favorites yet — tap the ★ on any du\'a.</div>';
}

/* Du'a audio — real recitation (Alafasy via EveryAyah) for duas that are Qur'anic verses */
let duaAudio = null;
function readDua(i) {
  if (duaAudio) { duaAudio.pause(); duaAudio = null; return; }
  const d = DUAS[i];
  if (!d.verses) return;
  const seq = d.verses.slice();
  const playNext = () => {
    const v = seq.shift();
    if (!v) { duaAudio = null; return; }
    const a = new Audio(`https://everyayah.com/data/Alafasy_128kbps/${pad3(v[0])}${pad3(v[1])}.mp3`);
    duaAudio = a;
    a.onended = playNext;
    a.onerror = playNext;
    a.play().catch(playNext);
  };
  playNext();
}

function toggleFavDua(i) {
  let favs = store.get('dd-favduas', []);
  favs = favs.includes(i) ? favs.filter(x => x !== i) : [...favs, i];
  store.set('dd-favduas', favs);
  initDuas();
}

/* Tasbih */
let tasbihCount = store.get('dd-tasbih', 0);
let tasbihTarget = store.get('dd-tasbih-target', 33);
function renderTasbih() {
  $('tasbih-count').textContent = tasbihCount;
  $('tasbih-target-label').textContent = 'of ' + tasbihTarget;
}
function tasbihTap() {
  tasbihCount++;
  if (tasbihCount % 33 === 0) {
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    celebrate(tasbihCount + ' dhikr completed — masha\'Allah, keep going');
  }
  store.set('dd-tasbih', tasbihCount);
  renderTasbih();
}
function tasbihReset() { tasbihCount = 0; store.set('dd-tasbih', 0); renderTasbih(); }
function setTasbihTarget(t) { tasbihTarget = t; store.set('dd-tasbih-target', t); renderTasbih(); }

/* ================= QIBLA (auto-starts when the tab opens) ================= */
const KAABA = { lat: 21.4225, lon: 39.8262 };
let qiblaBearing = null;
let smoothHeading = null;
let wasAligned = false;
let qiblaStarted = false;
let compassAttached = false;

function startQibla(force) {
  if (qiblaStarted && !force) return;
  qiblaStarted = true;
  $('qibla-retry').style.display = 'none';

  // 1. Compass permission — must happen inside the tap that opened the tab (iOS rule)
  attachCompass();

  // 2. Location → bearing to the Kaaba
  if (!navigator.geolocation) { qiblaFail('Location not supported on this device.'); return; }
  $('qibla-info').textContent = 'Finding your direction to the Kaaba…';
  navigator.geolocation.getCurrentPosition(p => {
    const φ1 = p.coords.latitude * Math.PI / 180, φ2 = KAABA.lat * Math.PI / 180;
    const Δλ = (KAABA.lon - p.coords.longitude) * Math.PI / 180;
    let brng = Math.atan2(Math.sin(Δλ), Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ)) * 180 / Math.PI;
    qiblaBearing = (brng + 360) % 360;
    $('needle').style.transform = `translate(-50%,-100%) rotate(${qiblaBearing}deg)`;
    $('qibla-dir').textContent = Math.round(qiblaBearing) + '° from North';
    $('qibla-info').textContent = 'Turn slowly until the Kaaba lights up.';
  }, () => qiblaFail('Location was blocked. Allow location access, then tap Try again.'));
}
function qiblaFail(msg) {
  $('qibla-info').textContent = msg;
  $('qibla-retry').style.display = '';
  qiblaStarted = false;
}

function attachCompass() {
  if (compassAttached) return;
  const handler = e => {
    let heading = null;
    if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') heading = 360 - e.alpha;
    if (heading !== null) onHeading(heading);
  };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') { window.addEventListener('deviceorientation', handler); compassAttached = true; }
      else $('qibla-info').textContent = 'Compass permission denied — the fixed direction above still works.';
    }).catch(() => {}); // desktop / unsupported: fixed bearing still shows
  } else {
    window.addEventListener('deviceorientationabsolute', handler);
    window.addEventListener('deviceorientation', handler);
    compassAttached = true;
  }
}

/* Smooth noisy compass readings (exponential average with 360° wraparound) */
function smoothTo(target) {
  if (smoothHeading === null) { smoothHeading = target; return target; }
  let diff = ((target - smoothHeading + 540) % 360) - 180;
  smoothHeading = (smoothHeading + diff * 0.15 + 360) % 360;
  return smoothHeading;
}

function onHeading(rawHeading) {
  if (qiblaBearing === null) return;
  const heading = smoothTo(rawHeading);
  const rot = (qiblaBearing - heading + 360) % 360;
  $('needle').style.transform = `translate(-50%,-100%) rotate(${rot}deg)`;
  let off = ((qiblaBearing - heading + 540) % 360) - 180;
  const aligned = Math.abs(off) <= 12;
  $('compass').classList.toggle('aligned', aligned);
  const dir = $('qibla-dir');
  if (aligned) {
    dir.textContent = '🕋 This way — you\'re facing the Qibla';
    dir.classList.add('on');
    $('qibla-deg').textContent = '';
    if (!wasAligned && navigator.vibrate) navigator.vibrate([60, 40, 60]);
  } else {
    dir.classList.remove('on');
    dir.textContent = off > 0 ? '↻ Turn right' : '↺ Turn left';
    $('qibla-deg').textContent = Math.abs(Math.round(off)) + '° to go';
  }
  wasAligned = aligned;
}

/* ================= SCHOLAR ================= */
let history = [];
let busy = false;
async function sendMsg(preset) {
  const input = $('chat-input');
  const content = (preset ?? input.value).trim();
  if (!content || busy) return;
  input.value = '';
  const w = $('welcome'); if (w) w.remove();
  history.push({ role: 'user', content });
  addBubble('user', content);
  busy = true; $('send-btn').disabled = true;
  const thinking = addBubble('ai', 'Reflecting…', true);
  try {
    const res = await fetch('/api/scholar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });
    const data = await res.json();
    if (!res.ok || !data.reply) throw new Error(data.error || 'no reply');
    thinking.remove();
    history.push({ role: 'assistant', content: data.reply });
    addBubble('ai', data.reply);
  } catch {
    thinking.remove(); history.pop();
    addBubble('ai', "Sorry — Scholar couldn't respond right now. Please try again in a moment.");
  } finally { busy = false; $('send-btn').disabled = false; }
}
function addBubble(kind, text, pulse) {
  const chat = $('chat');
  const row = document.createElement('div');
  row.className = 'row ' + (kind === 'user' ? 'user' : '');
  if (kind === 'ai') row.innerHTML = '<div class="avatar">🎓</div>';
  const b = document.createElement('div');
  b.className = 'bubble ' + (kind === 'user' ? 'user' : 'ai');
  if (pulse) b.innerHTML = '<span class="pulse">' + text + '</span>';
  else b.textContent = text;
  row.appendChild(b);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  return row;
}

/* ================= BOOT ================= */
(function boot() {
  $('sel-method').value = method;
  if (loc) {
    if (loc.type === 'city') { $('loc-city').value = loc.city; $('loc-country').value = loc.country; }
    loadPrayer();
  }
  renderStats();
  renderInspo();
  if ($('sel-speed')) $('sel-speed').value = String(playbackRate);
  loadHolidays();
  initQuran();
  initDuas();
  renderTasbih();
})();
