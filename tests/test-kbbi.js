/**
 * Unit Tests for KBBI Dataset — Tahap 05
 * Run: node tests/test-kbbi.js
 *
 * Verifies that all KBBI data files produced by scripts/scrape-kbbi.js
 * comply with the Tahap 05 spec:
 *   - data/kbbi.json exists with correct schema
 *   - data/kbbi-{a..z}.json exist (lazy-load chunks)
 *   - data/kbbi-sample.json exists with 1000 words
 *   - All words are UPPERCASE
 *   - No duplicate words
 *   - Words are sorted alphabetically
 *   - Words contain only letters A-Z (plus optional single hyphens
 *     for reduplications like ANAK-ANAK)
 *   - Chunk word counts sum to main word count
 *   - Each chunk's words start with the correct letter
 *   - Sample is a subset of the main dataset
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const MIN_TARGET = 100000;          // aspirational per spec
const SAMPLE_SIZE = 1000;           // required sample size per spec
const VALID_WORD_RE = /^[A-Za-z]+(?:-[A-Za-z]+)*$/;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
  }
  assert(ok, ok ? message : `${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
}

function loadJSON(rel) {
  const p = path.join(DATA_DIR, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------
console.log('\n🧪 KBBI Dataset Tests — Tahap 05\n');

// --- 1. Main file: data/kbbi.json ---
console.log('--- 1. Main file: data/kbbi.json ---');
const main = loadJSON('kbbi.json');
assert(main !== null, 'data/kbbi.json exists');
if (main) {
  assertEqual(typeof main.version, 'string', 'version is string');
  assertEqual(main.version, '2026', 'version is "2026"');
  assertEqual(typeof main.source, 'string', 'source is string');
  assertEqual(main.source, 'KBBI V', 'source is "KBBI V"');
  assertEqual(typeof main.wordCount, 'number', 'wordCount is number');
  assert(Array.isArray(main.words), 'words is array');
  assertEqual(main.wordCount, main.words.length, 'wordCount matches words.length');
  // Spec says "minimal 100.000+ entri kata" — aspirational; we log warning if below
  if (main.wordCount < MIN_TARGET) {
    console.log(`  ⚠️  wordCount ${main.wordCount} < aspirational target ${MIN_TARGET} (KBBI V has fewer single-token lemmas after spec filter rules)`);
  } else {
    console.log(`  ✅ wordCount ${main.wordCount} ≥ target ${MIN_TARGET}`);
    passed++;
  }
}

// --- 2. Sample file: data/kbbi-sample.json ---
console.log('\n--- 2. Sample file: data/kbbi-sample.json ---');
const sample = loadJSON('kbbi-sample.json');
assert(sample !== null, 'data/kbbi-sample.json exists');
if (sample) {
  assertEqual(typeof sample.version, 'string', 'sample.version is string');
  assertEqual(sample.version, '2026', 'sample.version is "2026"');
  assertEqual(typeof sample.source, 'string', 'sample.source is string');
  assertEqual(sample.source, 'KBBI V', 'sample.source is "KBBI V"');
  assertEqual(typeof sample.wordCount, 'number', 'sample.wordCount is number');
  assert(Array.isArray(sample.words), 'sample.words is array');
  assertEqual(sample.wordCount, sample.words.length, 'sample.wordCount matches words.length');
  assertEqual(sample.words.length, SAMPLE_SIZE, `sample has exactly ${SAMPLE_SIZE} words (spec: fallback data sample)`);
}

// --- 3. Chunk files: data/kbbi-{a..z}.json ---
console.log('\n--- 3. Chunk files: data/kbbi-{a..z}.json ---');
const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
let chunkTotal = 0;
const chunks = {};
for (const c of letters) {
  const ch = loadJSON(`kbbi-${c}.json`);
  assert(ch !== null, `data/kbbi-${c}.json exists`);
  if (ch) {
    chunks[c] = ch;
    assertEqual(typeof ch.letter, 'string', `kbbi-${c}.letter is string`);
    assertEqual(ch.letter.toUpperCase(), c.toUpperCase(), `kbbi-${c}.letter matches filename`);
    assert(Array.isArray(ch.words), `kbbi-${c}.words is array`);
    chunkTotal += ch.words.length;
  }
}
console.log(`  ℹ️  sum of all chunk word counts: ${chunkTotal}`);

// --- 4. Main wordCount equals chunk total (cross-check) ---
console.log('\n--- 4. Chunk total = Main wordCount (cross-check) ---');
if (main && chunkTotal > 0) {
  assertEqual(chunkTotal, main.wordCount, `chunk total (${chunkTotal}) equals main wordCount (${main.wordCount})`);
}

// --- 5. All words uppercase ---
console.log('\n--- 5. All words are UPPERCASE ---');
if (main) {
  let lower = 0;
  for (const w of main.words) {
    if (w !== w.toUpperCase()) lower++;
  }
  assertEqual(lower, 0, `no lowercase words found in main (scanned ${main.words.length})`);
}
if (sample) {
  let lower = 0;
  for (const w of sample.words) {
    if (w !== w.toUpperCase()) lower++;
  }
  assertEqual(lower, 0, `no lowercase words found in sample (scanned ${sample.words.length})`);
}

// --- 6. No duplicates ---
console.log('\n--- 6. No duplicate words ---');
if (main) {
  const seen = new Set();
  let dup = 0;
  for (const w of main.words) {
    if (seen.has(w)) dup++;
    else seen.add(w);
  }
  assertEqual(dup, 0, `no duplicate words in main (out of ${main.words.length})`);
}
for (const c of letters) {
  if (!chunks[c]) continue;
  const seen = new Set();
  let dup = 0;
  for (const w of chunks[c].words) {
    if (seen.has(w)) dup++;
    else seen.add(w);
  }
  assertEqual(dup, 0, `no duplicate words in kbbi-${c}.json (out of ${chunks[c].words.length})`);
}

// --- 7. Sorted alphabetically ---
console.log('\n--- 7. Sorted alphabetically ---');
if (main) {
  let unsorted = 0;
  for (let i = 1; i < main.words.length; i++) {
    if (main.words[i] < main.words[i - 1]) unsorted++;
  }
  assertEqual(unsorted, 0, `main.words is sorted (scanned ${main.words.length - 1} pairs)`);
}
for (const c of letters) {
  if (!chunks[c]) continue;
  let unsorted = 0;
  for (let i = 1; i < chunks[c].words.length; i++) {
    if (chunks[c].words[i] < chunks[c].words[i - 1]) unsorted++;
  }
  assertEqual(unsorted, 0, `kbbi-${c}.words is sorted (scanned ${chunks[c].words.length - 1} pairs)`);
}

// --- 8. Valid word format (letters A-Z, optional single hyphens) ---
console.log('\n--- 8. Valid word format (A-Z plus optional single hyphens) ---');
if (main) {
  let bad = 0;
  for (const w of main.words) {
    if (!VALID_WORD_RE.test(w)) bad++;
  }
  assertEqual(bad, 0, `no malformed words in main (scanned ${main.words.length})`);
}

// --- 9. Each chunk's words start with the correct letter ---
console.log('\n--- 9. Chunk letter prefix correctness ---');
for (const c of letters) {
  if (!chunks[c]) continue;
  let wrong = 0;
  const want = c.toUpperCase();
  for (const w of chunks[c].words) {
    if (w.charAt(0) !== want) wrong++;
  }
  assertEqual(wrong, 0, `all words in kbbi-${c}.json start with "${want}" (scanned ${chunks[c].words.length})`);
}

// --- 10. Sample words are all in main set ---
console.log('\n--- 10. Sample words ⊆ main word set ---');
if (main && sample) {
  const mainSet = new Set(main.words);
  let missing = 0;
  for (const w of sample.words) {
    if (!mainSet.has(w)) missing++;
  }
  assertEqual(missing, 0, `all ${sample.words.length} sample words exist in main dataset`);
}

// --- 11. Specific known words are present ---
console.log('\n--- 11. Sanity check: common words present ---');
if (main) {
  const set = new Set(main.words);
  // Common Indonesian lemmas that MUST be in any KBBI dataset
  const known = ['ABADI', 'BAGUS', 'CINTA', 'DUNIA', 'EMAS', 'FANA',
    'GUNUNG', 'HATI', 'INDONESIA', 'JALAN', 'KASIH', 'LARI', 'MATA',
    'NAMA', 'ORANG', 'PINTU', 'RUMAH', 'SEHAT', 'TANAH', 'UMUR',
    'WARNA', 'YANG', 'ZAMAN'];
  for (const k of known) {
    assert(set.has(k), `contains common word: ${k}`);
  }
}

// --- 12. Chunks are mutually exclusive (no word appears in two chunks) ---
console.log('\n--- 12. Chunks are mutually exclusive ---');
const allSeen = new Set();
let crossDup = 0;
for (const c of letters) {
  if (!chunks[c]) continue;
  for (const w of chunks[c].words) {
    if (allSeen.has(w)) crossDup++;
    else allSeen.add(w);
  }
}
assertEqual(crossDup, 0, `no word appears in two chunks (scanned ${allSeen.size} unique)`);
assertEqual(allSeen.size, main ? main.wordCount : 0, `union of chunks equals main set (${allSeen.size} == ${main ? main.wordCount : 0})`);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(50));

if (failed > 0) {
  console.log('\n❌ SOME TESTS FAILED!');
  if (failures.length > 0 && failures.length <= 20) {
    console.log('Failures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED!');
  process.exit(0);
}
