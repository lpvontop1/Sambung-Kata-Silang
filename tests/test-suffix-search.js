/**
 * Unit Tests for SearchModule Suffix Functions (Tahap 09 — Pencarian
 * Kata Berdasarkan Akhiran)
 * Run: node tests/test-suffix-search.js
 *
 * Mirrors test-prefix-search.js but for suffix search. Tests:
 * 1. SearchModule suffix API surface
 * 2. findWordsBySuffix — basic, normalize, limit, all words end with suffix
 * 3. findWordsBySuffix — edge cases (empty, non-string, KBBI not loaded)
 * 4. findValidWordsBySuffix — usedWords filtering (Set & Array inputs)
 * 5. getRandomWordBySuffix — reproducible (seeded), ends with suffix, excludes used
 * 6. getHintBySuffix — returns longest valid word ending with suffix
 * 7. KBBIModule.getWordsBySuffix wrapper — wired correctly to reverse trie
 * 8. Symmetry with prefix search (same word found via prefix and suffix)
 * 9. Direction-aware GameController.showAnchorSuggestions
 *    (LEFT/UP → suffix; RIGHT/DOWN → prefix)
 * 10. Spec anchor-letter scenario (POS to left of "S" from SELASA)
 * 11. Real suffix queries against full 74k-word KBBI dataset
 * 12. Performance — suffix search < 50 ms per query
 * 13. Hyphenated reduplications as suffix matches
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (reuse improved factory from test-prefix-search.js)
// ---------------------------------------------------------------------------
function _newElement(id) {
  const el = {
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
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) {
      this._innerHTML = v;
      this.children = [];
      this.childNodes = [];
    },
    appendChild: function(c) { this.children.push(c); c._parent = this; return c; },
    removeChild: function(c) {
      const idx = this.children.indexOf(c);
      if (idx >= 0) this.children.splice(idx, 1);
      return c;
    },
    remove: function() {},
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    addEventListener: function(event, handler) {
      if (!this._handlers) this._handlers = {};
      if (!this._handlers[event]) this._handlers[event] = [];
      this._handlers[event].push(handler);
    },
    removeEventListener: function() {},
    _dispatchEvent: function(event) {
      const handlers = this._handlers && this._handlers[event.type];
      if (handlers) handlers.forEach((h) => h(event));
    },
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
  return el;
}

const domElements = {};
function mockGetElementById(id) {
  if (!domElements[id]) domElements[id] = _newElement(id);
  return domElements[id];
}
global.document = {
  getElementById: mockGetElementById,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: (tag) => {
    const el = _newElement('auto-' + tag + '-' + Math.random().toString(36).slice(2, 8));
    el.tagName = tag.toUpperCase();
    return el;
  },
  documentElement: { style: { setProperty: () => {} } },
};
global.crypto = { randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 8) };
globalThis.require = require;
globalThis.process = process;
globalThis.__dirname = __dirname;
globalThis.__filename = __filename;

// Load game.js
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
  assert(ok, ok ? message : message);
}

function loadFullKBBI() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'kbbi.json'), 'utf8'));
  KBBIModule.loadFromJSON(data);
}

// ===========================================================================
console.log('\n🧪 SearchModule Suffix Tests — Tahap 09 (Pencarian Kata Berdasarkan Akhiran)\n');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('--- 1. SearchModule suffix API surface ---');
assertEqual(typeof SearchModule, 'object', 'SearchModule is defined');
assertEqual(typeof SearchModule.findWordsBySuffix, 'function', 'findWordsBySuffix is function');
assertEqual(typeof SearchModule.findValidWordsBySuffix, 'function', 'findValidWordsBySuffix is function');
assertEqual(typeof SearchModule.getRandomWordBySuffix, 'function', 'getRandomWordBySuffix is function');
assertEqual(typeof SearchModule.getHintBySuffix, 'function', 'getHintBySuffix is function');
// Prefix functions (from Tahap 08) still present
assertEqual(typeof SearchModule.findWordsByPrefix, 'function', 'findWordsByPrefix still defined (Tahap 08)');

loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI loaded for tests');

// ---------------------------------------------------------------------------
// 2. findWordsBySuffix — basic
// ---------------------------------------------------------------------------
console.log('\n--- 2. findWordsBySuffix — basic ---');

// All returned words end with the suffix
const sa10 = SearchModule.findWordsBySuffix('SA', 10);
assertEqual(sa10.length, 10, '"SA" limit=10 returns 10 words');
assert(sa10.every((w) => w.endsWith('SA')), 'all returned words end with "SA"');

// Limit enforcement
const sa5 = SearchModule.findWordsBySuffix('SA', 5);
assertEqual(sa5.length, 5, '"SA" limit=5 returns exactly 5');

// Default limit = 20
const saDefault = SearchModule.findWordsBySuffix('SA');
assert(saDefault.length <= 20, '"SA" default limit ≤ 20');

// Case-insensitivity
const lower = SearchModule.findWordsBySuffix('sa', 5);
assertDeepEqual(lower, sa5, '"sa" lowercase same as "SA"');
const mixed = SearchModule.findWordsBySuffix('Sa', 5);
assertDeepEqual(mixed, sa5, '"Sa" mixed case same as "SA"');

// Whitespace trimmed
const padded = SearchModule.findWordsBySuffix('  SA  ', 5);
assertDeepEqual(padded, sa5, '"  SA  " whitespace trimmed');

// Longer suffix → fewer matches
const saLong = SearchModule.findWordsBySuffix('NASA', 50);
const saShort = SearchModule.findWordsBySuffix('SA', 50);
assert(saLong.length <= saShort.length, 'longer suffix → fewer matches');

// ---------------------------------------------------------------------------
// 3. findWordsBySuffix — edge cases
// ---------------------------------------------------------------------------
console.log('\n--- 3. findWordsBySuffix — edge cases ---');

// Empty / non-string
assertDeepEqual(SearchModule.findWordsBySuffix('', 5), [], '"" → []');
assertDeepEqual(SearchModule.findWordsBySuffix(null, 5), [], 'null → []');
assertDeepEqual(SearchModule.findWordsBySuffix(undefined, 5), [], 'undefined → []');
assertDeepEqual(SearchModule.findWordsBySuffix(123, 5), [], 'number → []');
assertDeepEqual(SearchModule.findWordsBySuffix('   ', 5), [], 'whitespace-only → []');

// Suffix not in KBBI
assertDeepEqual(SearchModule.findWordsBySuffix('QQQ', 5), [], '"QQQ" no match → []');
assertDeepEqual(SearchModule.findWordsBySuffix('ZZZZZ', 5), [], '"ZZZZZ" no match → []');

// Single-letter suffix (all 26 letters are KBBI lemmas, so 'A' as suffix matches them)
const aSuf = SearchModule.findWordsBySuffix('A', 5);
assert(aSuf.length === 5 && aSuf.every((w) => w.endsWith('A')),
  '"A" returns 5 words ending in A');

// Behavior when KBBI not loaded
KBBIModule.reset();
assertDeepEqual(SearchModule.findWordsBySuffix('SA', 5), [], '"SA" returns [] when KBBI not loaded');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 4. findValidWordsBySuffix — usedWords filtering
// ---------------------------------------------------------------------------
console.log('\n--- 4. findValidWordsBySuffix — usedWords filtering ---');

// Without usedWords → same as findWordsBySuffix (up to limit)
const noUsed = SearchModule.findValidWordsBySuffix('SA', new Set(), 5);
const noUsedRaw = SearchModule.findWordsBySuffix('SA', 5);
assertDeepEqual(noUsed, noUsedRaw, '"SA" with empty usedSet = same as findWordsBySuffix');

// With usedWords as Set
const usedSet = new Set([sa5[0]]); // exclude the first matched word
const filtered1 = SearchModule.findValidWordsBySuffix('SA', usedSet, 5);
assert(!filtered1.includes(sa5[0]), `excluded "${sa5[0]}" is not in filtered results`);
assert(filtered1.every((w) => w.endsWith('SA') && w !== sa5[0]),
  'all returned words end with "SA" and exclude the used word');

// With usedWords as Array (also accepted)
const usedArr = [sa5[0], sa5[1]];
const filtered2 = SearchModule.findValidWordsBySuffix('SA', usedArr, 5);
assert(!filtered2.includes(sa5[0]) && !filtered2.includes(sa5[1]),
  'both used words excluded when passed as Array');

// Case-insensitive usedWords
const usedMixed = new Set([sa5[0].toLowerCase()]);
const filtered3 = SearchModule.findValidWordsBySuffix('SA', usedMixed, 5);
assert(!filtered3.includes(sa5[0]), 'lowercase used word excludes the uppercase match');

// Excluding all matches → empty result
const allSA = SearchModule.findWordsBySuffix('SA', 100);
const allUsedSet = new Set(allSA);
const filteredAll = SearchModule.findValidWordsBySuffix('SA', allUsedSet, 5);
assertDeepEqual(filteredAll, [], 'when ALL suffix matches are used, returns []');

// limit=0 edge case
assertDeepEqual(SearchModule.findValidWordsBySuffix('SA', new Set(), 0), [], 'limit=0 → []');

// ---------------------------------------------------------------------------
// 5. getRandomWordBySuffix — random pick
// ---------------------------------------------------------------------------
console.log('\n--- 5. getRandomWordBySuffix ---');

// Valid random pick
const rand1 = SearchModule.getRandomWordBySuffix('SA', new Set());
assert(rand1 !== null && typeof rand1 === 'string', 'getRandomWordBySuffix returns a string');
assert(rand1.endsWith('SA'), 'random pick ends with "SA"');
assert(KBBIModule.search(rand1), 'random pick is a valid KBBI word');

// Reproducibility — same suffix → same pick (seeded RNG)
const rand2 = SearchModule.getRandomWordBySuffix('SA', new Set());
const rand3 = SearchModule.getRandomWordBySuffix('SA', new Set());
assertEqual(rand2, rand1, 'same suffix → same pick (seeded RNG, deterministic)');
assertEqual(rand3, rand1, 'third call returns same pick');

// Different suffix → likely different pick
const randNg = SearchModule.getRandomWordBySuffix('NG', new Set());
assert(randNg !== null && randNg.endsWith('NG'), '"NG" random pick is valid NG-ending word');

// With usedWords — should not return excluded words
const usedRandom = new Set([rand1]);
const randAvoid = SearchModule.getRandomWordBySuffix('SA', usedRandom);
assert(randAvoid !== null && randAvoid !== rand1, 'random pick excludes used word');
assert(randAvoid.endsWith('SA'), 'random pick still ends with "SA"');

// No valid words → null
const randNone = SearchModule.getRandomWordBySuffix('QQQQQ', new Set());
assertEqual(randNone, null, 'non-existent suffix → null');
assertEqual(SearchModule.getRandomWordBySuffix('', new Set()), null, 'empty suffix → null');

// ---------------------------------------------------------------------------
// 6. getHintBySuffix — longest-first priority
// ---------------------------------------------------------------------------
console.log('\n--- 6. getHintBySuffix — longest-first priority ---');

const hintSA = SearchModule.getHintBySuffix('SA', new Set());
assert(hintSA !== null && hintSA.endsWith('SA'), '"SA" hint ends with "SA"');

// Hint should be the LONGEST valid word for the suffix
const allSAForHint = SearchModule.findValidWordsBySuffix('SA', new Set(), 500);
let maxLen = 0;
for (const w of allSAForHint) if (w.length > maxLen) maxLen = w.length;
assertEqual(hintSA.length, maxLen, `hint "${hintSA}" is the longest "SA"-suffixed word (${maxLen} chars)`);

// Hint excludes used words
const usedHint = new Set([hintSA]);
const hint2 = SearchModule.getHintBySuffix('SA', usedHint);
assert(hint2 !== null && hint2 !== hintSA, 'second hint excludes previously-suggested word');
assert(hint2.endsWith('SA'), 'second hint still ends with "SA"');

// No valid words → null
const hintEmpty = SearchModule.getHintBySuffix('ZZZZZZZZZ', new Set());
assertEqual(hintEmpty, null, 'non-existent suffix hint → null');

// -----------------------------------------------------------------------
// 7. KBBIModule.getWordsBySuffix wrapper
// -----------------------------------------------------------------------
console.log('\n--- 7. KBBIModule.getWordsBySuffix wrapper ---');

assertEqual(typeof KBBIModule.getWordsBySuffix, 'function', 'KBBIModule.getWordsBySuffix is function');
const viaModule = KBBIModule.getWordsBySuffix('SA', 5);
const viaTrie = KBBIModule.getTrie().getWordsBySuffix('SA', 5);
assertDeepEqual(viaModule, viaTrie, 'KBBIModule.getWordsBySuffix == KBBITrie.getWordsBySuffix');

// Returns [] when KBBI not loaded
KBBIModule.reset();
assertDeepEqual(KBBIModule.getWordsBySuffix('SA', 5), [], 'getWordsBySuffix returns [] when KBBI not loaded');
loadFullKBBI();

// ---------------------------------------------------------------------------
// 8. Symmetry with prefix search
// ---------------------------------------------------------------------------
console.log('\n--- 8. Symmetry with prefix search ---');

// A word that's both prefix-matched and suffix-matched should appear in both
// e.g. "INDONESIA" → findWordsByPrefix("INDONESIA") AND findWordsBySuffix("INDONESIA")
const prefMatch = SearchModule.findWordsByPrefix('INDONESIA', 10);
const sufMatch = SearchModule.findWordsBySuffix('INDONESIA', 10);
assert(prefMatch.includes('INDONESIA'), '"INDONESIA" in findWordsByPrefix("INDONESIA")');
assert(sufMatch.includes('INDONESIA'), '"INDONESIA" in findWordsBySuffix("INDONESIA")');

// Same word as prefix and suffix → both should include it
const symWord = 'ABADI';
const symPrefix = SearchModule.findWordsByPrefix(symWord, 50);
const symSuffix = SearchModule.findWordsBySuffix(symWord, 50);
assert(symPrefix.includes(symWord), `"${symWord}" in findWordsByPrefix("${symWord}")`);
assert(symSuffix.includes(symWord), `"${symWord}" in findWordsBySuffix("${symWord}")`);

// ---------------------------------------------------------------------------
// 9. Direction-aware GameController.showAnchorSuggestions
// ---------------------------------------------------------------------------
console.log('\n--- 9. GameController.showAnchorSuggestions (direction-aware) ---');

assertEqual(typeof GameController.showAnchorSuggestions, 'function', 'GameController.showAnchorSuggestions is function');

// Pre-create #autocomplete-suggestions + #word-input elements
const container = mockGetElementById('autocomplete-suggestions');
const inputEl = mockGetElementById('word-input');
// Init GameController to bind event handlers (used by Tahap 08 tests)
try { GameController.init(); } catch (e) { /* mock DOM limitation, ignore */ }

// LEFT direction → suffix search (new word's LAST letter = anchor)
GameController.showAnchorSuggestions('S', 'left', new Set());
const leftChips = container.children.length;
assert(leftChips > 0, 'LEFT direction → renders chips (suffix search)');
const leftChipsWords = Array.from(container.children).map((c) => c.textContent);
assert(leftChipsWords.every((w) => w.endsWith('S')),
  `all LEFT-direction chips end with "S" (suffix match)`);

// UP direction → also suffix search
GameController.showAnchorSuggestions('A', 'up', new Set());
const upChips = Array.from(container.children).map((c) => c.textContent);
assert(upChips.length > 0, 'UP direction → renders chips (suffix search)');
assert(upChips.every((w) => w.endsWith('A')),
  'all UP-direction chips end with "A" (suffix match)');

// RIGHT direction → prefix search (new word's FIRST letter = anchor)
GameController.showAnchorSuggestions('S', 'right', new Set());
const rightChips = Array.from(container.children).map((c) => c.textContent);
assert(rightChips.length > 0, 'RIGHT direction → renders chips (prefix search)');
assert(rightChips.every((w) => w.startsWith('S')),
  'all RIGHT-direction chips start with "S" (prefix match)');

// DOWN direction → prefix search
GameController.showAnchorSuggestions('A', 'down', new Set());
const downChips = Array.from(container.children).map((c) => c.textContent);
assert(downChips.length > 0, 'DOWN direction → renders chips (prefix search)');
assert(downChips.every((w) => w.startsWith('A')),
  'all DOWN-direction chips start with "A" (prefix match)');

// Invalid direction → no chips
GameController.showAnchorSuggestions('A', 'sideways', new Set());
assertEqual(container.children.length, 0, 'invalid direction → no chips');

// Invalid anchor letter (multi-char or non-letter) → no chips
GameController.showAnchorSuggestions('AB', 'left', new Set());
assertEqual(container.children.length, 0, 'multi-char anchor → no chips');
GameController.showAnchorSuggestions('1', 'left', new Set());
assertEqual(container.children.length, 0, 'non-letter anchor → no chips');

// usedWords excluded
GameController.showAnchorSuggestions('S', 'left', new Set([container.children[0]?.textContent || 'S']));
const afterExcl = Array.from(container.children).map((c) => c.textContent);
assert(afterExcl.length > 0, 'LEFT direction with usedWords still renders chips (pool is bigger)');

// ---------------------------------------------------------------------------
// 10. Spec anchor-letter scenario (POS to left of "S" from SELASA)
// ---------------------------------------------------------------------------
console.log('\n--- 10. Spec scenario — POS to left of "S" from SELASA ---');
// Spec: "kata 'POS' ditempatkan [P][O][S] di sebelah kiri 'S' dari 'SELASA'"
// → new word's LAST letter ("S" of POS) = anchor letter ("S")
// So suffix search for "S" should include "POS" (if it's in KBBI)
// Note: we don't assert POS specifically since KBBI V may not have it,
// but the suffix search for "S" must return words ending in "S".
const wordsEndingInS = SearchModule.findWordsBySuffix('S', 50);
assert(wordsEndingInS.every((w) => w.endsWith('S')),
  'suffix search for "S" returns words ending in S');
console.log(`  ℹ️  suffix "S" pool size (first 50): ${wordsEndingInS.length}`);
console.log(`  ℹ️  sample: ${wordsEndingInS.slice(0, 5).join(', ')}`);

// The spec example POS — check if it's in KBBI
const posInKBBI = KBBIModule.search('POS');
console.log(`  ℹ️  "POS" in KBBI: ${posInKBBI}`);
if (posInKBBI) {
  // POS isn't in the first 50 S-ending words (reverse-trie DFS yields many
  // short S-ending words alphabetically before POS). Use the suffix "POS"
  // itself to verify POS is findable.
  const posMatch = SearchModule.findWordsBySuffix('POS', 10);
  assert(posMatch.includes('POS'), '"POS" found via findWordsBySuffix("POS") (specific suffix)');
}

// ---------------------------------------------------------------------------
// 11. Real suffix queries against full 74k-word KBBI dataset
// ---------------------------------------------------------------------------
console.log('\n--- 11. Real suffix queries ---');

const saWords = SearchModule.findWordsBySuffix('SA', 20);
assert(saWords.length === 20 && saWords.every((w) => w.endsWith('SA')),
  '"SA" suffix returns 20 SA-ending words');

const ngWords = SearchModule.findWordsBySuffix('NG', 20);
assert(ngWords.length === 20 && ngWords.every((w) => w.endsWith('NG')),
  '"NG" suffix returns 20 NG-ending words');

const iWords = SearchModule.findWordsBySuffix('I', 10);
assert(iWords.length === 10 && iWords.every((w) => w.endsWith('I')),
  '"I" suffix returns 10 I-ending words');

const indonesia = SearchModule.findWordsBySuffix('INDONESIA', 5);
assert(indonesia.includes('INDONESIA'), '"INDONESIA" suffix includes INDONESIA itself');

// Multi-letter suffix
const basa = SearchModule.findWordsBySuffix('BASA', 10);
assert(basa.every((w) => w.endsWith('BASA')), '"BASA" suffix matches all end with BASA');

// ---------------------------------------------------------------------------
// 12. Performance — suffix search < 50 ms per query
// ---------------------------------------------------------------------------
console.log('\n--- 12. Performance ---');
const t1 = Date.now();
SearchModule.findWordsBySuffix('SA', 20);
const t1ms = Date.now() - t1;
assert(t1ms < 50, `findWordsBySuffix("SA") < 50 ms (got ${t1ms} ms)`);

const t2 = Date.now();
SearchModule.findWordsBySuffix('A', 20);
const t2ms = Date.now() - t2;
assert(t2ms < 50, `findWordsBySuffix("A") < 50 ms (got ${t2ms} ms)`);

const t3 = Date.now();
SearchModule.getHintBySuffix('SA', new Set());
const t3ms = Date.now() - t3;
assert(t3ms < 200, `getHintBySuffix("SA") < 200 ms (got ${t3ms} ms)`);

// ---------------------------------------------------------------------------
// 13. Hyphenated reduplications as suffix matches
// ---------------------------------------------------------------------------
console.log('\n--- 13. Hyphenated reduplications ---');

// "KUDA-KUDA" ends with "KUDA" — suffix search for "KUDA" should include it
const kudaSuffix = SearchModule.findWordsBySuffix('KUDA', 20);
assert(kudaSuffix.includes('KUDA-KUDA'), '"KUDA" suffix includes KUDA-KUDA (reduplication)');
assert(kudaSuffix.every((w) => w.endsWith('KUDA')), 'all "KUDA"-suffix matches end with KUDA');

// "ANAK-ANAK" ends with "ANAK"
const anakSuffix = SearchModule.findWordsBySuffix('ANAK', 20);
assert(anakSuffix.includes('ANAK-ANAK'), '"ANAK" suffix includes ANAK-ANAK');

// "MATA-MATA" ends with "MATA"
const mataSuffix = SearchModule.findWordsBySuffix('MATA', 20);
assert(mataSuffix.includes('MATA-MATA'), '"MATA" suffix includes MATA-MATA');

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
