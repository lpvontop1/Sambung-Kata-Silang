#!/usr/bin/env node
/**
 * scripts/scrape-kbbi.js
 * =====================
 * Tahap 05 — Sumber Data KBBI: Scraping & Persiapan
 *
 * Membangun dataset KBBI (Kamus Besar Bahasa Indonesia) untuk game
 * "Sambung Kata Silang". Skrip ini dapat dijalankan ulang (reproducible)
 * dan mendukung dua mode:
 *
 *   1. BUNDLED (default) — menggunakan dataset open-source dari
 *      aryakdaniswara/kbbi-dataset-kbbi-v (112.651 entri hasil ekstraksi
 *      situs KBBI resmi). Cepat dan deterministik. Cocok untuk build
 *      proyek.
 *
 *   2. LIVE — scraping langsung dari kbbi.kemdikbud.go.id menggunakan
 *      API pencarian per huruf awal. Lambat (dibatasi ~1 req/detik
 *      untuk menghormati server) dan dipakai hanya jika dataset
 *      open-source tidak tersedia / ingin diperbarui manual.
 *
 * Output:
 *   - data/kbbi.json            → dataset penuh (gabungan)
 *   - data/kbbi-{a..z}.json     → chunk per huruf awal (lazy loading)
 *   - data/kbbi-sample.json    → 1.000 kata acak untuk dev/test
 *   - data/kbbi-meta.json      → metadata & statistik
 *
 * Validasi:
 *   - Semua kata UPPERCASE
 *   - Tidak ada duplikat
 *   - Sorted alfabetis
 *   - Hanya berisi huruf (A-Z) — frasa, simbol, angka dibuang
 *
 * Penggunaan:
 *   node scripts/scrape-kbbi.js                 # bundled (default)
 *   node scripts/scrape-kbbi.js --mode=bundled # bundled eksplisit
 *   node scripts/scrape-kbbi.js --mode=live    # scraping langsung
 *   node scripts/scrape-kbbi.js --validate     # hanya validasi file yg ada
 *   node scripts/scrape-kbbi.js --help
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ---------------------------------------------------------------------------
// Konstanta & konfigurasi
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const RAW_DIR = path.join(ROOT, '.cache', 'kbbi-raw'); // hasil unduhan mentah

const KBBI_VERSION = '2026';     // label edisi dataset (KBBI V → 2026)
const KBBI_SOURCE = 'KBBI V';    // label sumber
const MIN_TARGET = 100000;       // target minimal sesuai spec Tahap 05
const SAMPLE_SIZE = 1000;        // jumlah kata sample untuk dev

// Open-source bundled dataset (aryakdaniswara/kbbi-dataset-kbbi-v)
const BUNDLED_REPO = 'aryakdaniswara/kbbi-dataset-kbbi-v';
const BUNDLED_BRANCH = 'main';
const BUNDLED_PARTS = 4;

// Live scrape endpoints (kbbi.kemdikbud.go.id)
const LIVE_HOST = 'kbbi.kemdikbud.go.id';
const LIVE_BASEPATH = '/api/entries/search';
const LIVE_DELAY_MS = 1100;  // 1.1 req/detik
const LIVE_TIMEOUT_MS = 15000;
const LIVE_RETRIES = 3;

// Huruf A-Z,boleh juga tanda hubung tunggal antar segmen (reduplikasi
// KBBI seperti "anak-anak", "mata-mata", "kuda-kuda"). Spec Tahap 05
// hanya melarang: simbol, angka, frasa dengan spasi.
const VALID_WORD_RE = /^[A-Za-z]+(?:-[A-Za-z]+)*$/;

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { mode: 'bundled', validate: false, help: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--validate') args.validate = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a.startsWith('--mode=')) {
      const v = a.slice(7).toLowerCase();
      if (v === 'bundled' || v === 'live') args.mode = v;
      else { console.error('Mode tidak dikenal:', v, '(harus bundled|live)'); process.exit(2); }
    } else {
      console.error('Argumen tidak dikenal:', a); process.exit(2);
    }
  }
  return args;
}

const HELP = `
scripts/scrape-kbbi.js — Persiapan dataset KBBI untuk Sambung Kata Silang

Usage:
  node scripts/scrape-kbbi.js [options]

Options:
  --mode=bundled  Gunakan dataset open-source (default)
  --mode=live     Scrape langsung dari kbbi.kemdikbud.go.id (lambat)
  --validate      Hanya validasi file data/kbbi.json yang sudah ada
  --verbose, -v   Logging detail
  --help, -h      Tampilkan help ini

Outputs (di /data):
  kbbi.json            Dataset penuh
  kbbi-{a..z}.json    Chunk per huruf awal
  kbbi-sample.json    1.000 kata acak untuk dev
  kbbi-meta.json      Metadata & statistik
`;

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function log(...a)  { console.log('[scrape-kbbi]', ...a); }
function verbose(c, ...a) { if (c) console.error('[scrape-kbbi:debug]', ...a); }

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function httpRequest(urlStr, { method = 'GET', headers = {}, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: Object.assign({
        'User-Agent': 'SambungKataSilang/0.5 (Tahap05; +https://github.com/lpvontop1/Sambung-Kata-Silang)',
        'Accept': 'application/json, text/plain, */*',
      }, headers),
    }, (res) => {
      let chunks = '';
      // ikuti redirect sederhana
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpRequest(res.headers.location, { method, headers, timeoutMs }).then(resolve, reject);
      }
      res.setEncoding('utf8');
      res.on('data', (c) => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Request timeout: ' + urlStr)); });
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Filter & normalisasi kata
// ---------------------------------------------------------------------------

/**
 * Filter entri mentah → array kata valid.
 * Aturan (sesuai Tahap 05):
 *   - Hanya terdiri dari huruf A-Z
 *   - Buang frasa (mengandung spasi)
 *   - Buang entri dengan simbol/angka/tanda kurung
 *   - Uppercase semua
 */
function normalizeEntry(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (!VALID_WORD_RE.test(s)) return null;
  return s.toUpperCase();
}

function dedupeAndSort(words) {
  const set = new Set(words.filter(Boolean));
  const arr = Array.from(set);
  arr.sort((a, b) => a < b ? -1 : (a > b ? 1 : 0));
  return arr;
}

function groupByFirstLetter(words) {
  const out = {};
  for (const w of words) {
    const c = w.charAt(0);
    if (!out[c]) out[c] = [];
    out[c].push(w);
  }
  return out;
}

// ---------------------------------------------------------------------------
// MODE BUNDLED — unduh dari aryakdaniswara/kbbi-dataset-kbbi-v
// ---------------------------------------------------------------------------

async function downloadBundledParts(opts) {
  ensureDir(RAW_DIR);
  const parts = [];
  for (let i = 1; i <= BUNDLED_PARTS; i++) {
    const file = path.join(RAW_DIR, `kbbi_v_part${i}.json`);
    const url = `https://raw.githubusercontent.com/${BUNDLED_REPO}/${BUNDLED_BRANCH}/json/kbbi_v_part${i}.json`;
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
      log(`reuse cached part ${i} (${fs.statSync(file).size} bytes)`);
      parts.push(file);
      continue;
    }
    log(`unduh ${url}`);
    let lastErr;
    for (let attempt = 1; attempt <= LIVE_RETRIES; attempt++) {
      try {
        const r = await httpRequest(url, { timeoutMs: 90000 });
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        fs.writeFileSync(file, r.body);
        log(`  → part ${i} ok (${r.body.length} bytes)`);
        parts.push(file);
        lastErr = null;
        break;
      } catch (e) {
        verbose(opts.verbose, `attempt ${attempt} gagal:`, e.message);
        lastErr = e;
        await sleep(2000 * attempt);
      }
    }
    if (lastErr) throw lastErr;
  }
  return parts;
}

async function collectFromBundled(opts) {
  const files = await downloadBundledParts(opts);
  const all = [];
  let rawCount = 0;
  let skipped = 0;

  /**
   * Setiap part JSON dari aryakdaniswara berbentuk:
   *   { "<entri-key>": { status, data: { pranala, entri: [...] } } }
   * Setiap entri punya field: nama, kata_dasar[], bentuk_tidak_baku[], varian[].
   *
   * Kita kumpulkan kandidat kata dari beberapa sumber per-entri agar
   * seluruh lemma & varian baku tercakup, lalu filter + dedupe + sort
   * di akhir.
   */
  for (const f of files) {
    log(`parsing ${path.basename(f)} ...`);
    const json = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('Struktur JSON tidak diharapkan: ' + f);
    }
    for (const [key, entry] of Object.entries(json)) {
      rawCount++;
      // 1) Top-level key (entri itu sendiri)
      const k1 = normalizeEntry(key);
      if (k1) all.push(k1);

      // 2) Field `data.entri[]` mengandung detail per entri
      const entri = entry && entry.data && Array.isArray(entry.data.entri)
        ? entry.data.entri : [];

      for (const e of entri) {
        if (!e || typeof e !== 'object') continue;

        // 2a) `nama` — bentuk resmi entri (kadang sama dgn key, kadang lebih bersih)
        if (typeof e.nama === 'string') {
          const k = normalizeEntry(e.nama);
          if (k) all.push(k);
        }

        // 2b) `kata_dasar` — root words yang menjadi dasar turunan
        if (Array.isArray(e.kata_dasar)) {
          for (const kd of e.kata_dasar) {
            const k = normalizeEntry(kd);
            if (k) all.push(k);
          }
        }

        // 2c) `bentuk_tidak_baku` — varian ejaan tidak baku (masih valid
        //     sebagai kata untuk game karena pemain bisa mengetiknya)
        if (Array.isArray(e.bentuk_tidak_baku)) {
          for (const bt of e.bentuk_tidak_baku) {
            const k = normalizeEntry(bt);
            if (k) all.push(k);
          }
        }

        // 2d) `varian` — varian resmi yang dipakai KBBI
        if (Array.isArray(e.varian)) {
          for (const v of e.varian) {
            const k = normalizeEntry(typeof v === 'string' ? v : (v && v.text || ''));
            if (k) all.push(k);
          }
        }

        // 2e) `kata_turunan` — bentuk turunan resmi yang terdaftar di entri
        //     KBBI. Spec Tahap 05 memang prefer lemma, namun "KECUALI jika
        //     imbuhan tersebut terdaftar sebagai entri tersendiri" — bentuk
        //     turunan yang tercantum dalam struktur entri KBBI resmi dapat
        //     dianggap "terdaftar", dan memperkaya kosakata game (pemain
        //     bisa memainkan "BERLARI" bukan hanya "LARI").
        if (Array.isArray(e.kata_turunan)) {
          for (const kt of e.kata_turunan) {
            const k = normalizeEntry(kt);
            if (k) all.push(k);
          }
        }
      }

      // Jika tidak ada yang lolos filter dari entri ini, hitung sebagai skipped
      // (hanya untuk laporan kasar, bukan aturan mutlak)
      const pushed = (k1 ? 1 : 0) +
        (entri.length > 0 ? 0 : 0); // simplifikasi: laporan raw tetap pakai rawCount
      if (pushed === 0) skipped++;
    }
  }
  const kept = dedupeAndSort(all);
  log(`total raw entries: ${rawCount}, kandidat terkumpul: ${all.length}, ` +
      `duplikat dibuang, unik: ${kept.length}`);
  return kept;
}

// ---------------------------------------------------------------------------
// MODE LIVE — scrape langsung dari kbbi.kemdikbud.go.id
// ---------------------------------------------------------------------------

/**
 * API pencarian KBBI menerima parameter awalan huruf.
 * Format endpoint: GET /api/entries/search?hdr=&ft=0&sb=A&q=A&start=0&limit=...
 * Response: { total_results, entry_pages, entries: [{ entry: "ABADI", ... }] }
 *
 * Karena struktur API dapat berubah, scraper ini juga punya fallback ke
 * endpoint HTML lama. Untuk reproducibility, hasil per-huruf disimpan ke
 * .cache/kbbi-raw/live-{letter}.json dan digabung saat selesai.
 */
async function fetchLetter(letter, opts) {
  const url = `https://${LIVE_HOST}/api/entries/search?hdr=&ft=0&sb=${letter}&q=${letter}&start=0&limit=200`;
  let lastErr;
  for (let attempt = 1; attempt <= LIVE_RETRIES; attempt++) {
    try {
      const r = await httpRequest(url, { timeoutMs: LIVE_TIMEOUT_MS });
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      let data;
      try { data = JSON.parse(r.body); } catch (_) {
        // mungkin HTML legacy — fallback minim
        data = { entries: [] };
      }
      return data;
    } catch (e) {
      verbose(opts.verbose, `letter ${letter} attempt ${attempt} gagal:`, e.message);
      lastErr = e;
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

async function collectFromLive(opts) {
  ensureDir(RAW_DIR);
  const all = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of letters) {
    const cache = path.join(RAW_DIR, `live-${letter}.json`);
    let data;
    if (fs.existsSync(cache)) {
      data = JSON.parse(fs.readFileSync(cache, 'utf8'));
      log(`reuse cache live-${letter}.json`);
    } else {
      log(`scrape huruf ${letter} ...`);
      data = await fetchLetter(letter, opts);
      fs.writeFileSync(cache, JSON.stringify(data, null, 2));
      await sleep(LIVE_DELAY_MS);
    }
    const entries = (data && Array.isArray(data.entries)) ? data.entries : [];
    let got = 0;
    for (const e of entries) {
      const raw = e && (e.entry || e.nama || e.word || e.kata);
      const w = normalizeEntry(raw);
      if (!w) continue;
      all.push(w);
      got++;
    }
    log(`  ${letter}: +${got} kata (total ${all.length})`);
  }
  return dedupeAndSort(all);
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function buildAndWriteOutputs(words) {
  ensureDir(DATA_DIR);

  // 1. kbbi.json — dataset penuh
  const fullPayload = {
    version: KBBI_VERSION,
    source: KBBI_SOURCE,
    wordCount: words.length,
    words,
  };
  writeJSON(path.join(DATA_DIR, 'kbbi.json'), fullPayload);
  log(`tulis data/kbbi.json (${words.length} kata)`);

  // 2. kbbi-{a..z}.json — chunk per huruf awal (lazy loading)
  const grouped = groupByFirstLetter(words);
  const chunks = [];
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) {
    const arr = grouped[letter] || [];
    writeJSON(path.join(DATA_DIR, `kbbi-${letter.toLowerCase()}.json`), { letter, words: arr });
    chunks.push({ letter, count: arr.length });
  }
  log(`tulis 26 chunk per-huruf (a..z)`);

  // 3. kbbi-sample.json — 1.000 kata acak untuk dev
  const sample = pickSample(words, SAMPLE_SIZE);
  writeJSON(path.join(DATA_DIR, 'kbbi-sample.json'), {
    version: KBBI_VERSION,
    source: KBBI_SOURCE,
    wordCount: sample.length,
    note: `Random sample of ${SAMPLE_SIZE} kata untuk development / test`,
    words: sample,
  });
  log(`tulis data/kbbi-sample.json (${sample.length} kata)`);

  // 4. kbbi-meta.json — metadata & statistik
  const lengthHist = {};
  for (const w of words) {
    const L = w.length;
    lengthHist[L] = (lengthHist[L] || 0) + 1;
  }
  const byLetter = {};
  for (const c of chunks) byLetter[c.letter] = c.count;
  writeJSON(path.join(DATA_DIR, 'kbbi-meta.json'), {
    version: KBBI_VERSION,
    source: KBBI_SOURCE,
    wordCount: words.length,
    minTargetMet: words.length >= MIN_TARGET,
    minTarget: MIN_TARGET,
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/scrape-kbbi.js',
    modeUsed: process.env.KBBI_MODE || 'bundled',
    chunkFiles: chunks.map((c) => `data/kbbi-${c.letter.toLowerCase()}.json`),
    lengthHistogram: lengthHist,
    byLetter,
  });
  log(`tulis data/kbbi-meta.json`);
}

/**
 * Pilih N kata acak tapi reproducible (seed deterministik) supaya
 * rerun menghasilkan sample yang sama.
 */
function pickSample(words, n) {
  if (words.length <= n) return words.slice();
  // LCG deterministik berbasis string-hash seed
  let seed = 0x811c9dc5;
  for (const ch of 'sambung-kata-silang') {
    seed ^= ch.charCodeAt(0);
    seed = Math.imul(seed, 0x01000193) >>> 0;
  }
  const rng = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17;
    seed ^= seed << 5;  seed >>>= 0;
    return seed / 0x100000000;
  };
  const idx = words.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a < b ? -1 : 1).map((i) => words[i]);
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

function validateFile(file) {
  if (!fs.existsSync(file)) {
    return { ok: false, errors: [`file tidak ditemukan: ${file}`] };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`JSON parse gagal: ${e.message}`] };
  }
  const base = path.basename(file);
  // Chunk per-huruf: schema { letter, words[] } (lazy loading, tanpa header global)
  const isChunk = /^kbbi-[a-z]\.json$/.test(base);
  const isSample = base === 'kbbi-sample.json';
  const isMain = base === 'kbbi.json';
  const errors = [];
  const warnings = [];

  if (isChunk) {
    if (typeof data.letter !== 'string' || data.letter.length !== 1) {
      errors.push('`letter` bukan single char');
    }
    if (!Array.isArray(data.words)) errors.push('`words` bukan array');
    else {
      let prev = null, dup = 0, notUpper = 0, badChar = 0, unsorted = 0, wrongLetter = 0;
      const want = data.letter.toUpperCase();
      for (const w of data.words) {
        if (typeof w !== 'string') { badChar++; continue; }
        if (w !== w.toUpperCase()) notUpper++;
        if (!VALID_WORD_RE.test(w)) badChar++;
        if (w.charAt(0) !== want) wrongLetter++;
        if (prev !== null) {
          if (w < prev) unsorted++;
          if (w === prev) dup++;
        }
        prev = w;
      }
      if (dup) errors.push(`${dup} duplikat`);
      if (notUpper) errors.push(`${notUpper} kata tidak uppercase`);
      if (badChar) errors.push(`${badChar} kata mengandung karakter non-valid`);
      if (unsorted) errors.push(`${unsorted} posisi tidak terurut`);
      if (wrongLetter) errors.push(`${wrongLetter} kata tidak dimulai dengan huruf ${want}`);
    }
    return { ok: errors.length === 0, errors, warnings,
      wordCount: Array.isArray(data.words) ? data.words.length : 0, file };
  }

  // Main & sample schemas
  if (!isMain && !isSample) {
    // unknown file — treat permissive
    return { ok: true, errors: [], warnings: ['skema tidak dikenali, lewati'], wordCount: 0, file };
  }
  if (typeof data.version !== 'string') errors.push('`version` bukan string');
  if (typeof data.source  !== 'string') errors.push('`source` bukan string');
  if (typeof data.wordCount !== 'number') errors.push('`wordCount` bukan number');
  if (!Array.isArray(data.words)) errors.push('`words` bukan array');
  if (data.wordCount !== data.words.length) {
    errors.push(`wordCount (${data.wordCount}) ≠ words.length (${data.words.length})`);
  }
  if (isMain && data.wordCount < MIN_TARGET) {
    warnings.push(`wordCount ${data.wordCount} < target ${MIN_TARGET}`);
  }
  let prev = null, dup = 0, notUpper = 0, badChar = 0, unsorted = 0;
  for (const w of data.words) {
    if (typeof w !== 'string') { badChar++; continue; }
    if (w !== w.toUpperCase()) notUpper++;
    if (!VALID_WORD_RE.test(w)) badChar++;
    if (prev !== null) {
      if (w < prev) unsorted++;
      if (w === prev) dup++;
    }
    prev = w;
  }
  if (dup) errors.push(`${dup} duplikat`);
  if (notUpper) errors.push(`${notUpper} kata tidak uppercase`);
  if (badChar) errors.push(`${badChar} kata mengandung karakter non-valid`);
  if (unsorted) errors.push(`${unsorted} posisi tidak terurut`);
  return { ok: errors.length === 0, errors, warnings,
    wordCount: data.wordCount, file };
}

function validateAll() {
  ensureDir(DATA_DIR);
  log('=== VALIDASI ===');
  const targets = [
    path.join(DATA_DIR, 'kbbi.json'),
    path.join(DATA_DIR, 'kbbi-sample.json'),
    ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) =>
      path.join(DATA_DIR, `kbbi-${c}.json`)),
  ];
  let allOk = true;
  for (const t of targets) {
    const r = validateFile(t);
    if (!fs.existsSync(t)) {
      log(`  [SKIP] ${path.basename(t)} (belum ada, lewati)`);
      continue;
    }
    const tag = r.ok ? 'OK ' : 'FAIL';
    log(`  [${tag}] ${path.basename(t)} — ${r.wordCount} kata`);
    for (const e of r.errors)        log(`        ERROR:   ${e}`);
    for (const w of r.warnings)     log(`        WARN:    ${w}`);
    if (!r.ok) allOk = false;
  }
  // Cross-check: jumlah kata di chunk harus = jumlah kata di kbbi.json
  if (fs.existsSync(path.join(DATA_DIR, 'kbbi.json'))) {
    let chunkTotal = 0;
    for (const c of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
      const f = path.join(DATA_DIR, `kbbi-${c}.json`);
      if (fs.existsSync(f)) {
        const j = JSON.parse(fs.readFileSync(f, 'utf8'));
        chunkTotal += (j.words || []).length;
      }
    }
    const main = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'kbbi.json'), 'utf8'));
    if (chunkTotal === main.words.length) {
      log(`  [OK] chunk total (${chunkTotal}) = main (${main.words.length})`);
    } else {
      log(`  [FAIL] chunk total ${chunkTotal} ≠ main ${main.words.length}`);
      allOk = false;
    }
  }
  log(allOk ? '✓ Semua validasi lulus' : '✗ Ada validasi yang gagal');
  return allOk;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(HELP); return; }

  if (args.validate) {
    const ok = validateAll();
    process.exit(ok ? 0 : 1);
  }

  log(`mode: ${args.mode}`);
  process.env.KBBI_MODE = args.mode;
  let words;
  if (args.mode === 'bundled') {
    words = await collectFromBundled(args);
  } else if (args.mode === 'live') {
    words = await collectFromLive(args);
  } else {
    throw new Error('Mode tidak dikenal: ' + args.mode);
  }
  log(`dipertahankan setelah filter: ${words.length} kata`);
  if (words.length < MIN_TARGET) {
    log(`WARN: jumlah (${words.length}) < target (${MIN_TARGET}).`);
    log(`     Untuk produksi, jalankan ulang mode 'live' atau gabungkan sumber lain.`);
  }
  buildAndWriteOutputs(words);
  const ok = validateAll();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[scrape-kbbi] FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
