/**
 * Unit Tests for KBBITrie & KBBIModule — Tahap 06
 * Run: node tests/test-trie.js
 *
 * Tests the Trie data structure and the KBBIModule singleton wrapper:
 *
 * 1. KBBITrie class structure & API surface
 * 2. insert + search basics
 * 3. Case-insensitivity
 * 4. Hyphenated reduplications (ANAK-ANAK)
 * 5. startsWith (prefix boolean check)
 * 6. getWordsByPrefix with limit (autocomplete)
 * 7. getWordsBySuffix with limit (reverse trie)
 * 8. loadFromJSON batch insert
 * 9. Idempotent inserts (no dup count)
 * 10. clear() & size()
 * 11. Performance: load 74,536-word dataset in < 2 sec (spec target)
 * 12. KBBIModule singleton: loadFromJSON, isLoaded, getWordCount, search, startsWith
 * 13. KBBIModule.loadChunk (lazy loading per letter)
 * 14. KBBIModule.reset
 * 15. Edge cases: empty string, non-string, undefined
 * 16. Real KBBI words sanity check (ABADI, INDONESIA, SELASA, ...)
 */

// NB: no 'use strict' here — global.crypto assignment must silently no-op
// in Node 24+ (where crypto is a getter-only property on globalThis).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (same pattern as test-board.js / test-render.js / test-zoom.js)
// ---------------------------------------------------------------------------
const domElements = {};
function mockGetElementById(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id: id,
      className: '',
      classList: {
        _c: new Set(),
        add: function(...xs) { xs.forEach((x) => this._c.add(x)); },
        remove: function(...xs) { xs.forEach((x) => this._c.delete(x)); },
        toggle: function(x, f) {
          if (f !== undefined) { f ? this._c.add(x) : this._c.delete(x); }
          else { this._c.has(x) ? this._c.delete(x) : this._c.add(x); }
          return this._c.has(x);
        },
        contains: function(x) { return this._c.has(x); },
      },
      dataset: {},
      style: { setProperty: function() {} },
      children: [],
      childNodes: [],
      textContent: '',
      innerHTML: '',
      appendChild: function(c) { this.children.push(c); c._parent = this; return c; },
      remove: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      addEventListener: function() {},
      removeEventListener: function() {},
      // Canvas mock (Tahap 04 minimap)
      getContext: function() {
        return {
          fillRect: function() {}, clearRect: function() {},
          getImageData: function() { return { data: [] }; },
          putImageData: function() {},
          createImageData: function() { return { data: [] }; },
          setTransform: function() {}, save: function() {}, restore: function() {},
          scale: function() {}, translate: function() {},
          beginPath: function() {}, closePath: function() {},
          moveTo: function() {}, lineTo: function() {}, rect: function() {},
          fill: function() {}, stroke: function() {}, arc: function() {},
          fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
          textAlign: '',
          fillText: function() {}, strokeText: function() {},
          measureText: function() { return { width: 0 }; },
        };
      },
      width: 300, height: 150,
      toDataURL: function() { return ''; },
    };
  }
  return domElements[id];
}
global.document = {
  getElementById: mockGetElementById,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: (tag) => mockGetElementById('auto-' + tag),
  documentElement: { style: { setProperty: () => {} } },
};
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 8),
};

// Expose CommonJS locals as globals so game.js (run via vm.runInThisContext)
// can access them. In Node 24+, `require` is a function-scope parameter of
// the CommonJS wrapper, NOT a property of globalThis — so scripts executed
// via vm cannot see it unless we expose it explicitly. Browser has no
// equivalent; game.js's loadChunk falls back to fetch there.
globalThis.require = require;
globalThis.process  = process;
globalThis.__dirname = __dirname;
globalThis.__filename = __filename;

// Load game.js — exposes KBBITrie & KBBIModule as globals
const code = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
vm.runInThisContext(code);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) { passed++; console.log(`  ✅ ${message}`); }
  else { failed++; failures.push(message); console.log(`  ❌ ${message}`); }
}
function assertEqual(actual, expected, message) {
  const ok = actual === expected;
  if (!ok) failures.push(`${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
  assert(ok, ok ? message : `${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
}
function assertDeepEqual(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
  assert(ok, ok ? message : `${message}`);
}

// Helpers to load real KBBI data files
function loadData(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8'));
}

// ===========================================================================
// Main test body (async IIFE so we can `await` loadChunk)
// ===========================================================================
(async () => {
console.log('\n🧪 KBBITrie & KBBIModule Tests — Tahap 06\n');

// ---------------------------------------------------------------------------
// 1. Class structure & API
// ---------------------------------------------------------------------------
console.log('--- 1. KBBITrie class structure & API ---');
assertEqual(typeof KBBITrie, 'function', 'KBBITrie is defined (class/function)');
assertEqual(typeof KBBITrie.prototype.insert, 'function', 'KBBITrie.prototype.insert is function');
assertEqual(typeof KBBITrie.prototype.search, 'function', 'KBBITrie.prototype.search is function');
assertEqual(typeof KBBITrie.prototype.startsWith, 'function', 'KBBITrie.prototype.startsWith is function');
assertEqual(typeof KBBITrie.prototype.getWordsByPrefix, 'function', 'KBBITrie.prototype.getWordsByPrefix is function');
assertEqual(typeof KBBITrie.prototype.getWordsBySuffix, 'function', 'KBBITrie.prototype.getWordsBySuffix is function');
assertEqual(typeof KBBITrie.prototype.loadFromJSON, 'function', 'KBBITrie.prototype.loadFromJSON is function');
assertEqual(typeof KBBITrie.prototype.clear, 'function', 'KBBITrie.prototype.clear is function');
assertEqual(typeof KBBITrie.prototype.size, 'function', 'KBBITrie.prototype.size is function');
assertEqual(typeof KBBITrie.prototype.getStats, 'function', 'KBBITrie.prototype.getStats is function');

// TrieNode structure
const t0 = new KBBITrie();
assert(t0.root && typeof t0.root === 'object', 'root is object');
assertDeepEqual(t0.root, { children: {}, isEndOfWord: false }, 'root is empty TrieNode');
assert(t0.reverseRoot && typeof t0.reverseRoot === 'object', 'reverseRoot is object');
assertDeepEqual(t0.reverseRoot, { children: {}, isEndOfWord: false }, 'reverseRoot is empty TrieNode');
assertEqual(t0.root.children instanceof Map, false, 'children uses plain object (not Map)');
assertEqual(t0.reverseRoot.children instanceof Map, false, 'reverse children uses plain object (not Map)');

// ---------------------------------------------------------------------------
// 2. insert + search basics
// ---------------------------------------------------------------------------
console.log('\n--- 2. insert + search basics ---');
const t1 = new KBBITrie();
t1.insert('KUCING');
t1.insert('KUDA');
t1.insert('KUDA-KUDA');
t1.insert('BURUNG');
assertEqual(t1.search('KUCING'), true, 'search KUCING → true');
assertEqual(t1.search('KUDA'), true, 'search KUDA → true');
assertEqual(t1.search('KUDA-KUDA'), true, 'search KUDA-KUDA (hyphen) → true');
assertEqual(t1.search('BURUNG'), true, 'search BURUNG → true');
assertEqual(t1.search('KUCINGG'), false, 'search KUCINGG (typo) → false');
assertEqual(t1.search('KUCIN'), false, 'search KUCIN (prefix only) → false');
assertEqual(t1.search('BURU'), false, 'search BURU (prefix only) → false');
assertEqual(t1.search('ANJING'), false, 'search ANJING (not inserted) → false');

// ---------------------------------------------------------------------------
// 3. Case-insensitivity
// ---------------------------------------------------------------------------
console.log('\n--- 3. Case-insensitivity ---');
assertEqual(t1.search('kucing'), true, 'search "kucing" (lowercase) → true');
assertEqual(t1.search('Kucing'), true, 'search "Kucing" (mixed case) → true');
assertEqual(t1.search('kuda-kuda'), true, 'search "kuda-kuda" (lowercase hyphen) → true');
assertEqual(t1.search('  KUCING  '), false, 'search "  KUCING  " (with spaces) → false (not auto-trimmed at Trie level)');

// ---------------------------------------------------------------------------
// 4. Hyphenated reduplications
// ---------------------------------------------------------------------------
console.log('\n--- 4. Hyphenated reduplications ---');
const t2 = new KBBITrie();
t2.insert('ANAK-ANAK');
t2.insert('MATA-MATA');
t2.insert('LARI-LARI');
assertEqual(t2.search('ANAK-ANAK'), true, 'search ANAK-ANAK → true');
assertEqual(t2.search('anak-anak'), true, 'search anak-anak (lower) → true');
assertEqual(t2.search('ANAK'), false, 'search ANAK (without hyphen) → false');
assertEqual(t2.search('ANAKANAK'), false, 'search ANAKANAK (no hyphen) → false');

// ---------------------------------------------------------------------------
// 5. startsWith (prefix boolean)
// ---------------------------------------------------------------------------
console.log('\n--- 5. startsWith (prefix boolean) ---');
const t3 = new KBBITrie();
['ABADI', 'ABANG', 'ABAI', 'BAHASA', 'BAGUS', 'CINTA'].forEach((w) => t3.insert(w));
assertEqual(t3.startsWith('AB'), true, 'startsWith AB → true');
assertEqual(t3.startsWith('ABA'), true, 'startsWith ABA → true');
assertEqual(t3.startsWith('ABAD'), true, 'startsWith ABAD → true');
assertEqual(t3.startsWith('B'), true, 'startsWith B → true');
assertEqual(t3.startsWith('BA'), true, 'startsWith BA → true');
assertEqual(t3.startsWith('BAH'), true, 'startsWith BAH → true');
assertEqual(t3.startsWith('XYZ'), false, 'startsWith XYZ → false');
assertEqual(t3.startsWith('CINTAX'), false, 'startsWith CINTAX (longer than any word) → false');
assertEqual(t3.startsWith('ABADIXYZ'), false, 'startsWith ABADIXYZ → false');
assertEqual(t3.startsWith(''), false, 'startsWith "" → false (empty)');

// ---------------------------------------------------------------------------
// 6. getWordsByPrefix with limit (autocomplete)
// ---------------------------------------------------------------------------
console.log('\n--- 6. getWordsByPrefix with limit ---');
const t4 = new KBBITrie();
['ABADI', 'ABADIAH', 'ABADIAT', 'ABAH', 'ABAI', 'ABAIAN', 'ABAIMANA',
 'BAHASA', 'BAGUS', 'BAGUSAN', 'CINTA', 'CINTAI'].forEach((w) => t4.insert(w));

const allAB = t4.getWordsByPrefix('AB', 100);
assert(allAB.length >= 7, `getWordsByPrefix AB returns ≥7 words (got ${allAB.length})`);
assertDeepEqual(allAB, ['ABADI', 'ABADIAH', 'ABADIAT', 'ABAH', 'ABAI', 'ABAIAN', 'ABAIMANA'],
  'getWordsByPrefix AB returns sorted list');

const limited3 = t4.getWordsByPrefix('AB', 3);
assertEqual(limited3.length, 3, 'getWordsByPrefix AB limit=3 returns 3 words');
assertDeepEqual(limited3, ['ABADI', 'ABADIAH', 'ABADIAT'], 'limit=3 returns first 3 alphabetical');

const defaultLimit = t4.getWordsByPrefix('AB');
assertEqual(defaultLimit.length, 7, 'default limit returns all matches (≤20 here)');

const noMatch = t4.getWordsByPrefix('XYZ', 5);
assertDeepEqual(noMatch, [], 'getWordsByPrefix with no match returns []');

const emptyPrefix = t4.getWordsByPrefix('', 5);
assertDeepEqual(emptyPrefix, [], 'getWordsByPrefix "" returns []');

// ---------------------------------------------------------------------------
// 7. getWordsBySuffix with limit (reverse trie)
// ---------------------------------------------------------------------------
console.log('\n--- 7. getWordsBySuffix with limit ---');
const t5 = new KBBITrie();
['KUCING', 'BURUNG', 'LARI', 'MENGALI', 'KUDA', 'KUDA-KUDA', 'PANTAI', 'BATAI'].forEach((w) => t5.insert(w));

const ngWords = t5.getWordsBySuffix('NG', 10);
assertDeepEqual(ngWords.sort(), ['BURUNG', 'KUCING'].sort(), `getWordsBySuffix NG returns words ending in NG (got ${JSON.stringify(ngWords)})`);

// Words ending in 'A' (last char is A): KUDA, KUDA-KUDA. PANTAI and BATAI end in 'I', not 'A'.
const aWords = t5.getWordsBySuffix('A', 10);
assertDeepEqual(aWords.sort(), ['KUDA', 'KUDA-KUDA'].sort(),
  `getWordsBySuffix A returns words ending in A (got ${JSON.stringify(aWords)})`);

// Words ending in 'I' (last char is I): LARI, MENGALI, PANTAI, BATAI.
const iWords = t5.getWordsBySuffix('I', 10);
assertDeepEqual(iWords.sort(), ['LARI', 'MENGALI', 'PANTAI', 'BATAI'].sort(),
  `getWordsBySuffix I returns words ending in I (got ${JSON.stringify(iWords)})`);

// Suffix 'KUDA' — both KUDA (ends in K-U-D-A) and KUDA-KUDA match.
const hyphenSuffix = t5.getWordsBySuffix('KUDA', 5);
assertDeepEqual(hyphenSuffix.sort(), ['KUDA', 'KUDA-KUDA'].sort(),
  'getWordsBySuffix KUDA returns [KUDA, KUDA-KUDA]');

const limit1 = t5.getWordsBySuffix('NG', 1);
assertEqual(limit1.length, 1, 'getWordsBySuffix NG limit=1 returns 1 word');

const noSuffix = t5.getWordsBySuffix('XYZ', 5);
assertDeepEqual(noSuffix, [], 'getWordsBySuffix XYZ (no match) returns []');

// ---------------------------------------------------------------------------
// 8. loadFromJSON batch insert
// ---------------------------------------------------------------------------
console.log('\n--- 8. loadFromJSON batch insert ---');
const t6 = new KBBITrie();
const miniJSON = {
  version: '2026', source: 'KBBI V',
  wordCount: 5,
  words: ['ABADI', 'BAGUS', 'CINTA', 'DUNIA', 'EMAS'],
};
t6.loadFromJSON(miniJSON);
assertEqual(t6.size(), 5, 'loadFromJSON inserts all 5 words');
assertEqual(t6.search('ABADI'), true, 'after loadFromJSON, search ABADI → true');
assertEqual(t6.search('EMAS'), true, 'after loadFromJSON, search EMAS → true');
assertEqual(t6.search('FANA'), false, 'search FANA (not in JSON) → false');

// Invalid input
let threw = false;
try { t6.loadFromJSON(null); } catch (_) { threw = true; }
assert(threw, 'loadFromJSON(null) throws');

threw = false;
try { t6.loadFromJSON({ words: 'not-array' }); } catch (_) { threw = true; }
assert(threw, 'loadFromJSON({words: "not-array"}) throws');

threw = false;
try { t6.loadFromJSON({}); } catch (_) { threw = true; }
assert(threw, 'loadFromJSON({}) (missing words) throws');

// ---------------------------------------------------------------------------
// 9. Idempotent inserts (no dup count)
// ---------------------------------------------------------------------------
console.log('\n--- 9. Idempotent inserts ---');
const t7 = new KBBITrie();
t7.insert('KATA');
assertEqual(t7.size(), 1, 'insert once → size 1');
t7.insert('KATA');
t7.insert('KATA');
t7.insert('kata'); // lowercase version — same word after normalize
assertEqual(t7.size(), 1, 'insert same word 4x → size still 1');

t7.insert('KATA-KATA');
assertEqual(t7.size(), 2, 'insert KATA-KATA → size 2');
t7.insert('KATA-KATA');
assertEqual(t7.size(), 2, 'insert KATA-KATA again → size still 2');

// ---------------------------------------------------------------------------
// 10. clear() and size()
// ---------------------------------------------------------------------------
console.log('\n--- 10. clear() and size() ---');
const t8 = new KBBITrie();
['A', 'B', 'C'].forEach((w) => t8.insert(w));
assertEqual(t8.size(), 3, 'size 3 after 3 inserts');
t8.clear();
assertEqual(t8.size(), 0, 'size 0 after clear()');
assertDeepEqual(t8.root, { children: {}, isEndOfWord: false }, 'root reset to empty after clear');
assertDeepEqual(t8.reverseRoot, { children: {}, isEndOfWord: false }, 'reverseRoot reset to empty after clear');
assertEqual(t8.search('A'), false, 'search A after clear → false');
assertEqual(t8.startsWith('A'), false, 'startsWith A after clear → false');

// ---------------------------------------------------------------------------
// 11. Performance: load 74,536-word dataset < 2 sec
// ---------------------------------------------------------------------------
console.log('\n--- 11. Performance: load 74,536-word KBBI dataset < 2 sec ---');
const fullData = loadData('data/kbbi.json');
assertEqual(fullData.wordCount, 74536, `data/kbbi.json has 74,536 words (got ${fullData.wordCount})`);

const perfTrie = new KBBITrie();
const tStart = process.hrtime.bigint();
perfTrie.loadFromJSON(fullData);
const tEnd = process.hrtime.bigint();
const msElapsed = Number(tEnd - tStart) / 1e6;
console.log(`  ℹ️  loaded ${fullData.wordCount} words in ${msElapsed.toFixed(1)} ms`);
assert(msElapsed < 2000, `load ${fullData.wordCount} words in < 2000 ms (got ${msElapsed.toFixed(1)} ms)`);
assert(perfTrie.size() === fullData.wordCount,
  `trie.size() === wordCount (${perfTrie.size()} === ${fullData.wordCount})`);

// ---------------------------------------------------------------------------
// 12. KBBIModule singleton integration
// ---------------------------------------------------------------------------
console.log('\n--- 12. KBBIModule singleton integration ---');
KBBIModule.reset();
assertEqual(KBBIModule.isLoaded(), false, 'KBBIModule.isLoaded() false initially');
assertEqual(KBBIModule.getWordCount(), 0, 'KBBIModule.getWordCount() 0 initially');
assertEqual(KBBIModule.search('ABADI'), false, 'KBBIModule.search() returns false before load');
assertEqual(KBBIModule.startsWith('ABADI'), false, 'KBBIModule.startsWith() returns false before load');

const sampleData = loadData('data/kbbi-sample.json');
KBBIModule.loadFromJSON(sampleData);
assertEqual(KBBIModule.isLoaded(), true, 'KBBIModule.isLoaded() true after loadFromJSON(sample)');
assertEqual(KBBIModule.getWordCount(), sampleData.wordCount, 'KBBIModule.getWordCount() === sample.wordCount');
assertEqual(KBBIModule.getWordCount(), 1000, 'sample has exactly 1000 words loaded');

// All sample words must be searchable
let allFound = true;
for (const w of sampleData.words) {
  if (!KBBIModule.search(w)) { allFound = false; break; }
}
assert(allFound, 'all 1000 sample words searchable via KBBIModule.search()');

// Sample word from head of file
assertEqual(KBBIModule.search('ABDIS'), true, 'sample head word ABDIS is searchable');

// Reset and load full
KBBIModule.reset();
const tStart2 = process.hrtime.bigint();
KBBIModule.loadFromJSON(fullData);
const msFull = Number(process.hrtime.bigint() - tStart2) / 1e6;
assertEqual(KBBIModule.getWordCount(), 74536, 'KBBIModule loaded full 74,536-word dataset');
assert(msFull < 2000, `KBBIModule.loadFromJSON(74k) < 2 sec (got ${msFull.toFixed(1)} ms)`);

// Singleton: multiple searches use the same trie instance
const trie1 = KBBIModule.getTrie();
KBBIModule.search('ABADI');
KBBIModule.startsWith('ABADI');
const trie2 = KBBIModule.getTrie();
assert(trie1 === trie2, 'singleton — same trie instance across multiple calls');

// ---------------------------------------------------------------------------
// 13. KBBIModule.loadChunk (lazy loading)
// ---------------------------------------------------------------------------
console.log('\n--- 13. KBBIModule.loadChunk (lazy loading per letter) ---');
KBBIModule.reset();
assertEqual(KBBIModule.isLoaded(), false, 'isLoaded false before any chunk');

// loadChunk returns a Promise
const p = KBBIModule.loadChunk('A');
assert(p && typeof p.then === 'function', 'loadChunk returns a Promise');

const nInserted = await p;
assertEqual(KBBIModule.isLoaded(), true, 'isLoaded true after loadChunk("A")');
assert(nInserted > 0, `loadChunk("A") inserted > 0 words (got ${nInserted})`);

// Now search should work for A-words but not for B-words not yet loaded
const chunkA = loadData('data/kbbi-a.json');
let aSampleFound = 0;
for (let i = 0; i < Math.min(20, chunkA.words.length); i++) {
  if (KBBIModule.search(chunkA.words[i])) aSampleFound++;
}
assertEqual(aSampleFound, 20, `all 20 sampled A-words searchable after loadChunk("A")`);

assertDeepEqual(KBBIModule.getLoadedLetters(), ['A'], 'loadedLetters = ["A"] after loadChunk("A")');

// Idempotent — calling loadChunk('A') again should insert 0
const dup = await KBBIModule.loadChunk('A');
assertEqual(dup, 0, 'second loadChunk("A") is no-op (returns 0)');
assertEqual(KBBIModule.getWordCount(), chunkA.words.length, 'wordCount still equals chunk A size');

// Load chunk B
const nB = await KBBIModule.loadChunk('B');
const chunkB = loadData('data/kbbi-b.json');
assertEqual(nB, chunkB.words.length, `loadChunk("B") inserted ${chunkB.words.length} words`);
assertDeepEqual(KBBIModule.getLoadedLetters(), ['A', 'B'], 'loadedLetters = ["A","B"]');

// Search B-words now work
let bSampleFound = 0;
for (let i = 0; i < Math.min(20, chunkB.words.length); i++) {
  if (KBBIModule.search(chunkB.words[i])) bSampleFound++;
}
assertEqual(bSampleFound, 20, 'all 20 sampled B-words searchable after loadChunk("B")');

// Invalid letter rejection
let chunkErr = false;
try { await KBBIModule.loadChunk('AB'); } catch (_) { chunkErr = true; }
assert(chunkErr, 'loadChunk("AB") throws (not single letter)');

chunkErr = false;
try { await KBBIModule.loadChunk('1'); } catch (_) { chunkErr = true; }
assert(chunkErr, 'loadChunk("1") throws (not A-Z letter)');

chunkErr = false;
try { await KBBIModule.loadChunk(null); } catch (_) { chunkErr = true; }
assert(chunkErr, 'loadChunk(null) throws');

// Case-insensitive
const nLower = await KBBIModule.loadChunk('C');
const chunkC = loadData('data/kbbi-c.json');
assertEqual(nLower, chunkC.words.length, 'loadChunk("c") (lowercase) works case-insensitively');

// ---------------------------------------------------------------------------
// 14. KBBIModule.reset
// ---------------------------------------------------------------------------
console.log('\n--- 14. KBBIModule.reset ---');
KBBIModule.reset();
assertEqual(KBBIModule.isLoaded(), false, 'isLoaded false after reset');
assertEqual(KBBIModule.getWordCount(), 0, 'wordCount 0 after reset');
assertEqual(KBBIModule.search('ABADI'), false, 'search returns false after reset');
assertEqual(KBBIModule.getLoadedLetters().length, 0, 'loadedLetters empty after reset');
assertEqual(KBBIModule.getTrie(), null, 'trie is null after reset');

// ---------------------------------------------------------------------------
// 15. Edge cases
// ---------------------------------------------------------------------------
console.log('\n--- 15. Edge cases ---');
const tEdge = new KBBITrie();
tEdge.insert('');              // empty string
tEdge.insert(null);            // null
tEdge.insert(undefined);       // undefined
tEdge.insert(123);              // non-string
tEdge.insert('VALID');
assertEqual(tEdge.size(), 1, 'insert garbage does not affect size; only "VALID" inserted');
assertEqual(tEdge.search(''), false, 'search "" → false');
assertEqual(tEdge.search(null), false, 'search null → false');
assertEqual(tEdge.search(undefined), false, 'search undefined → false');
assertEqual(tEdge.search(123), false, 'search 123 → false');

// Single-letter word
tEdge.insert('A');
assertEqual(tEdge.search('A'), true, 'single-letter word "A" works');
assertEqual(tEdge.startsWith('A'), true, 'startsWith("A") works for single-letter word');
assertDeepEqual(tEdge.getWordsByPrefix('A', 5), ['A'], 'getWordsByPrefix("A") returns ["A"]');

// ---------------------------------------------------------------------------
// 16. Real KBBI words sanity check
// ---------------------------------------------------------------------------
console.log('\n--- 16. Real KBBI words sanity check ---');
KBBIModule.reset();
KBBIModule.loadFromJSON(fullData);
const knownWords = [
  'ABADI', 'BAGUS', 'CINTA', 'DUNIA', 'EMAS', 'FANA',
  'GUNUNG', 'HATI', 'INDONESIA', 'JALAN', 'KASIH', 'LARI', 'MATA',
  'NAMA', 'ORANG', 'PINTU', 'RUMAH', 'SEHAT', 'TANAH', 'UMUR',
  'WARNA', 'YANG', 'ZAMAN', 'HALO', 'SELASA',
];
for (const w of knownWords) {
  assertEqual(KBBIModule.search(w), true, `KBBIModule.search("${w}") → true`);
}
// Invalid words
assertEqual(KBBIModule.search('XYZQQ'), false, 'KBBIModule.search("XYZQQ") → false (per Tahap 07 spec example)');
assertEqual(KBBIModule.search('QQQQQ'), false, 'KBBIModule.search("QQQQQ") → false');
assertEqual(KBBIModule.search('ASDFGHJKL'), false, 'KBBIModule.search("ASDFGHJKL") → false');

// Real prefix & suffix queries
const abPrefix = KBBIModule.getTrie().getWordsByPrefix('ABADI', 10);
assert(abPrefix.length > 0 && abPrefix[0] === 'ABADI', `getWordsByPrefix("ABADI") returns ≥1 word starting with ABADI`);
assert(abPrefix.every((w) => w.startsWith('ABADI')), 'all returned words start with ABADI');

const ngSuffix = KBBIModule.getTrie().getWordsBySuffix('NG', 10);
assert(ngSuffix.length > 0 && ngSuffix.every((w) => w.endsWith('NG')),
  `getWordsBySuffix("NG") returns words ending in NG (got ${ngSuffix.length} words)`);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(50));

if (failed > 0) {
  console.log('\n❌ SOME TESTS FAILED!');
  if (failures.length <= 25) {
    console.log('Failures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED!');
  process.exit(0);
}
})(); // end async IIFE
