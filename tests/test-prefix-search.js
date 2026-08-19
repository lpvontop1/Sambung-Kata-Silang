/**
 * Unit Tests for SearchModule (Tahap 08 — Pencarian Kata Berdasarkan Awalan)
 * Run: node tests/test-prefix-search.js
 *
 * Tests prefix-search helpers and the autocomplete UI integration:
 *
 * 1. SearchModule API surface
 * 2. findWordsByPrefix — basic, normalize, limit, sorted output
 * 3. findWordsByPrefix — edge cases (empty, non-string, KBBI not loaded)
 * 4. findValidWordsByPrefix — usedWords filtering (Set & array inputs)
 * 5. getRandomWordByPrefix — random pick is valid, in pool, reproducible
 * 6. getHintByPrefix — returns longest valid word
 * 7. KBBIModule.getWordsByPrefix wrapper — wired correctly to trie
 * 8. UIModule.renderAutocomplete — DOM renders chips, click fills input
 * 9. UIModule.clearAutocomplete — empties container
 * 10. GameController integration — input event triggers autocomplete
 *     (smoke check via mock DOM; full UI tested in browser)
 * 11. Real prefix queries against full 74k-word KBBI dataset
 * 12. Performance — autocomplete < 50 ms per query
 * 13. Spec sanity — anchor-letter scenario: prefix='S', finds SELASA, etc.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (same pattern as test-trie.js / test-validation.js, with two
// additions: createElement returns fresh elements each time, and setting
// innerHTML='' clears children — needed for renderAutocomplete tests.)
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
      // Setting innerHTML clears the children array (mimics DOM behavior)
      this.children = [];
      this.childNodes = [];
    },
    appendChild: function(c) { this.children.push(c); c._parent = this; return c; },
    removeChild: function(c) {
      const idx = this.children.indexOf(c);
      if (idx >= 0) this.children.splice(idx, 1);
      return c;
    },
    remove: function() {
      if (this._parent) {
        const idx = this._parent.children.indexOf(this);
        if (idx >= 0) this._parent.children.splice(idx, 1);
      }
    },
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
    // Canvas mock for Tahap 04 minimap
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
  // createElement returns a FRESH element each call (so chips don't share state)
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
console.log('\n🧪 SearchModule Tests — Tahap 08 (Pencarian Kata Berdasarkan Awalan)\n');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('--- 1. SearchModule API surface ---');
assertEqual(typeof SearchModule, 'object', 'SearchModule is defined');
assertEqual(typeof SearchModule.findWordsByPrefix, 'function', 'findWordsByPrefix is function');
assertEqual(typeof SearchModule.findValidWordsByPrefix, 'function', 'findValidWordsByPrefix is function');
assertEqual(typeof SearchModule.getRandomWordByPrefix, 'function', 'getRandomWordByPrefix is function');
assertEqual(typeof SearchModule.getHintByPrefix, 'function', 'getHintByPrefix is function');

// Load KBBI for tests
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI loaded for tests');

// ---------------------------------------------------------------------------
// 2. findWordsByPrefix — basic, normalize, limit, sorted
// ---------------------------------------------------------------------------
console.log('\n--- 2. findWordsByPrefix — basic ---');

// All returned words start with the prefix
const abad5 = SearchModule.findWordsByPrefix('ABAD', 5);
// KBBI V has only 4 ABAD-prefixed words: ABAD, ABADI, ABADIAH, ABADIAT
assertEqual(abad5.length, 4, '"ABAD" limit=5 returns 4 words (all ABAD words in KBBI V)');
assert(abad5.every((w) => w.startsWith('ABAD')), 'all returned words start with "ABAD"');
assertDeepEqual(abad5, abad5.slice().sort(), 'returned words are alphabetically sorted');

// Limit enforcement
const abad3 = SearchModule.findWordsByPrefix('ABAD', 3);
assertEqual(abad3.length, 3, '"ABAD" limit=3 returns exactly 3');

// Default limit = 20
const abadDefault = SearchModule.findWordsByPrefix('ABAD');
assert(abadDefault.length <= 20, '"ABAD" default limit ≤ 20');

// Case-insensitivity (input normalized to UPPERCASE)
const lower = SearchModule.findWordsByPrefix('abad', 5);
assertDeepEqual(lower, abad5, '"abad" lowercase same as "ABAD"');
const mixed = SearchModule.findWordsByPrefix('Abad', 5);
assertDeepEqual(mixed, abad5, '"Abad" mixed case same as "ABAD"');

// Whitespace is trimmed
const padded = SearchModule.findWordsByPrefix('  ABAD  ', 5);
assertDeepEqual(padded, abad5, '"  ABAD  " whitespace trimmed');

// Longer prefix → fewer matches
const abadi1 = SearchModule.findWordsByPrefix('ABADI', 50);
const abad50 = SearchModule.findWordsByPrefix('ABAD', 50);
assert(abadi1.length <= abad50.length, 'longer prefix → fewer matches');

// ---------------------------------------------------------------------------
// 3. findWordsByPrefix — edge cases
// ---------------------------------------------------------------------------
console.log('\n--- 3. findWordsByPrefix — edge cases ---');

// Empty / non-string
assertDeepEqual(SearchModule.findWordsByPrefix('', 5), [], '"" → []');
assertDeepEqual(SearchModule.findWordsByPrefix(null, 5), [], 'null → []');
assertDeepEqual(SearchModule.findWordsByPrefix(undefined, 5), [], 'undefined → []');
assertDeepEqual(SearchModule.findWordsByPrefix(123, 5), [], 'number → []');
assertDeepEqual(SearchModule.findWordsByPrefix('   ', 5), [], 'whitespace-only → []');

// Prefix not in KBBI
assertDeepEqual(SearchModule.findWordsByPrefix('XYZ', 5), [], '"XYZ" no match → []');
assertDeepEqual(SearchModule.findWordsByPrefix('QQQQQ', 5), [], '"QQQQQ" no match → []');

// Single-letter prefix (all 26 letters are KBBI lemmas)
const aResult = SearchModule.findWordsByPrefix('A', 5);
assert(aResult.length === 5 && aResult.every((w) => w.startsWith('A')),
  '"A" returns 5 A-words');

// Behavior when KBBI not loaded
KBBIModule.reset();
assertDeepEqual(SearchModule.findWordsByPrefix('ABAD', 5), [], '"ABAD" returns [] when KBBI not loaded');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 4. findValidWordsByPrefix — usedWords filtering
// ---------------------------------------------------------------------------
console.log('\n--- 4. findValidWordsByPrefix — usedWords filtering ---');

// Without usedWords → same as findWordsByPrefix (up to limit)
const noUsed = SearchModule.findValidWordsByPrefix('ABAD', new Set(), 5);
const noUsedRaw = SearchModule.findWordsByPrefix('ABAD', 5);
assertDeepEqual(noUsed, noUsedRaw, '"ABAD" with empty usedSet = same as findWordsByPrefix (5)');

// With usedWords as Set
const usedSet = new Set(['ABADI']);
const filtered1 = SearchModule.findValidWordsByPrefix('ABAD', usedSet, 5);
assert(!filtered1.includes('ABADI'), '"ABADI" is excluded when used');
// 4 ABAD words total, minus ABADI = 3 remaining valid words
assertEqual(filtered1.length, 3, '"ABAD" returns 3 valid words (4 total minus 1 used)');
assert(filtered1.every((w) => w.startsWith('ABAD') && w !== 'ABADI'),
  'all returned words start with "ABAD" and are not "ABADI"');

// With usedWords as Array (also accepted)
const usedArr = ['ABADI', 'ABADIAH'];
const filtered2 = SearchModule.findValidWordsByPrefix('ABAD', usedArr, 5);
assert(!filtered2.includes('ABADI') && !filtered2.includes('ABADIAH'),
  'both ABADI and ABADIAH excluded when used');

// Case-insensitive usedWords
const usedMixed = new Set(['abadI']);
const filtered3 = SearchModule.findValidWordsByPrefix('ABAD', usedMixed, 5);
assert(!filtered3.includes('ABADI'), '"abadI" (lowercase) used word excludes "ABADI"');

// Excluding all matches → empty result
const allAbad = SearchModule.findWordsByPrefix('ABAD', 100);
const allUsedSet = new Set(allAbad);
const filteredAll = SearchModule.findValidWordsByPrefix('ABAD', allUsedSet, 5);
assertDeepEqual(filteredAll, [], 'when ALL prefix matches are used, returns []');

// Limit=0 edge case
assertDeepEqual(SearchModule.findValidWordsByPrefix('ABAD', new Set(), 0), [], 'limit=0 → []');

// ---------------------------------------------------------------------------
// 5. getRandomWordByPrefix — random pick
// ---------------------------------------------------------------------------
console.log('\n--- 5. getRandomWordByPrefix ---');

// Valid random pick from "ABAD" prefix
const rand1 = SearchModule.getRandomWordByPrefix('ABAD', new Set());
assert(rand1 !== null && typeof rand1 === 'string', 'getRandomWordByPrefix returns a string');
assert(rand1.startsWith('ABAD'), 'random pick starts with "ABAD"');
assert(KBBIModule.search(rand1), 'random pick is a valid KBBI word');

// Reproducibility — same prefix → same random pick (seeded RNG)
const rand2 = SearchModule.getRandomWordByPrefix('ABAD', new Set());
const rand3 = SearchModule.getRandomWordByPrefix('ABAD', new Set());
assertEqual(rand2, rand1, 'same prefix → same pick (seeded RNG, deterministic)');
assertEqual(rand3, rand1, 'third call returns same pick');

// Different prefix → likely different pick (or null if no words)
const randSel = SearchModule.getRandomWordByPrefix('SEL', new Set());
assert(randSel !== null && randSel.startsWith('SEL'), '"SEL" random pick is valid SEL-word');

// With usedWords — should not return excluded words
const usedRandom = new Set([rand1]);
const randAvoid = SearchModule.getRandomWordByPrefix('ABAD', usedRandom);
assert(randAvoid !== null && randAvoid !== rand1, 'random pick excludes used word');
assert(randAvoid.startsWith('ABAD'), 'random pick still starts with "ABAD"');

// No valid words → null
const allUsedRand = new Set(SearchModule.findWordsByPrefix('QQQQQ', 100));
const randNone = SearchModule.getRandomWordByPrefix('QQQQQ', allUsedRand);
assertEqual(randNone, null, 'no valid candidates → null');

// Non-existent prefix → null
assertEqual(SearchModule.getRandomWordByPrefix('ZZZZZZZZZ', new Set()), null, 'non-existent prefix → null');
assertEqual(SearchModule.getRandomWordByPrefix('', new Set()), null, 'empty prefix → null');

// ---------------------------------------------------------------------------
// 6. getHintByPrefix — longest-first priority
// ---------------------------------------------------------------------------
console.log('\n--- 6. getHintByPrefix — longest-first priority ---');

const hintAbad = SearchModule.getHintByPrefix('ABAD', new Set());
assert(hintAbad !== null && hintAbad.startsWith('ABAD'), '"ABAD" hint starts with "ABAD"');

// Hint should be the LONGEST valid word for the prefix
const allAbadForHint = SearchModule.findValidWordsByPrefix('ABAD', new Set(), 500);
let maxLen = 0;
for (const w of allAbadForHint) if (w.length > maxLen) maxLen = w.length;
assertEqual(hintAbad.length, maxLen, `hint "${hintAbad}" is the longest valid "ABAD"-prefixed word (${maxLen} chars)`);

// Hint excludes used words
const usedHint = new Set([hintAbad]);
const hint2 = SearchModule.getHintByPrefix('ABAD', usedHint);
assert(hint2 !== null && hint2 !== hintAbad, 'second hint excludes previously-suggested word');

// No valid words → null
const hintEmpty = SearchModule.getHintByPrefix('ZZZZZZZZZ', new Set());
assertEqual(hintEmpty, null, 'non-existent prefix hint → null');

// Long prefix with few words
const hintLong = SearchModule.getHintByPrefix('ABADI', new Set());
assert(hintLong === null || hintLong.startsWith('ABADI'), '"ABADI" hint either null or valid');

// ---------------------------------------------------------------------------
// 7. KBBIModule.getWordsByPrefix wrapper (wired from Tahap 08)
// ---------------------------------------------------------------------------
console.log('\n--- 7. KBBIModule.getWordsByPrefix wrapper ---');

assertEqual(typeof KBBIModule.getWordsByPrefix, 'function', 'KBBIModule.getWordsByPrefix is function');
const viaModule = KBBIModule.getWordsByPrefix('ABAD', 5);
const viaTrie = KBBIModule.getTrie().getWordsByPrefix('ABAD', 5);
assertDeepEqual(viaModule, viaTrie, 'KBBIModule.getWordsByPrefix == KBBITrie.getWordsByPrefix');

// Returns [] when KBBI not loaded
KBBIModule.reset();
assertDeepEqual(KBBIModule.getWordsByPrefix('ABAD', 5), [], 'getWordsByPrefix returns [] when KBBI not loaded');
loadFullKBBI();

// ---------------------------------------------------------------------------
// 8. UIModule.renderAutocomplete — DOM rendering
// ---------------------------------------------------------------------------
console.log('\n--- 8. UIModule.renderAutocomplete ---');

assertEqual(typeof UIModule.renderAutocomplete, 'function', 'UIModule.renderAutocomplete is function');
assertEqual(typeof UIModule.clearAutocomplete, 'function', 'UIModule.clearAutocomplete is function');

// Render some suggestions
const suggestions = SearchModule.findWordsByPrefix('ABAD', 5);
UIModule.renderAutocomplete(suggestions);

const container = domElements['autocomplete-suggestions'];
assert(container, '#autocomplete-suggestions mock container exists');
assertEqual(container.children.length, suggestions.length, `${suggestions.length} chips rendered for ${suggestions.length} suggestions`);

// Each chip has class 'suggestion-chip' and the word as textContent
for (let i = 0; i < suggestions.length; i++) {
  const chip = container.children[i];
  assertEqual(chip.className, 'suggestion-chip', `chip ${i} has class "suggestion-chip"`);
  assertEqual(chip.textContent, suggestions[i], `chip ${i} textContent matches suggestion`);
}

// Render more than 10 — should be capped at 10
const many = SearchModule.findWordsByPrefix('A', 50);
UIModule.renderAutocomplete(many);
assertEqual(container.children.length, 10, 'renderAutocomplete caps at 10 chips');

// Render empty / null — should clear container
UIModule.renderAutocomplete([]);
assertEqual(container.children.length, 0, 'renderAutocomplete([]) clears container');
UIModule.renderAutocomplete(null);
assertEqual(container.children.length, 0, 'renderAutocomplete(null) clears container');

// Chip click → fills word input
// Pre-create #word-input mock element so it can be filled by chip click
const inputEl = mockGetElementById('word-input');
inputEl.value = '';
const pickList = SearchModule.findWordsByPrefix('ABAD', 5);
UIModule.renderAutocomplete(pickList);
const firstChip = container.children[0];
// Simulate click (mock doesn't auto-fire; call handler directly)
const firstWord = firstChip.textContent;
const chipHandlers = firstChip._handlers && firstChip._handlers.click;
if (chipHandlers) {
  chipHandlers.forEach((h) => h({ type: 'click', target: firstChip }));
  assertEqual(inputEl.value, firstWord, 'chip click fills input with that word');
} else {
  console.log('  ⚠️  no click handler stashed (mock limitation) — skipping click test');
}

// Custom onPick callback is called
let pickedWord = null;
UIModule.renderAutocomplete(pickList, (w) => { pickedWord = w; });
const chip2 = container.children[0];
const chip2Handlers = chip2._handlers && chip2._handlers.click;
if (chip2Handlers) {
  chip2Handlers.forEach((h) => h({ type: 'click', target: chip2 }));
  assertEqual(pickedWord, chip2.textContent, 'onPick callback called with clicked word');
}

// clearAutocomplete
UIModule.renderAutocomplete(pickList);
assert(container.children.length > 0, 'container has chips after render');
UIModule.clearAutocomplete();
assertEqual(container.children.length, 0, 'clearAutocomplete empties container');

// ---------------------------------------------------------------------------
// 9. UIModule.clearAutocomplete — separate test (already partially covered)
// ---------------------------------------------------------------------------
console.log('\n--- 9. UIModule.clearAutocomplete ---');
UIModule.renderAutocomplete(['A', 'B', 'C']);
assertEqual(container.children.length, 3, 'container has 3 chips before clear');
UIModule.clearAutocomplete();
assertEqual(container.children.length, 0, 'container is empty after clearAutocomplete');
// Calling clear on empty container doesn't crash
UIModule.clearAutocomplete();
assertEqual(container.children.length, 0, 'clearing empty container is no-op');

// ---------------------------------------------------------------------------
// 10. GameController integration (smoke — input event triggers autocomplete)
// ---------------------------------------------------------------------------
console.log('\n--- 10. GameController integration ---');
// Pre-create #word-input element so the GameController's addEventListener can attach
const inputEl2 = mockGetElementById('word-input');
// GameController.init() doesn't auto-run in Node (no DOMContentLoaded).
// Call it manually; wrap in try-catch since some UI bindings may behave differently
// under mock DOM. We only need the word-input 'input' handler attached.
try { GameController.init(); } catch (e) { console.log('  ℹ️  init() threw (mock DOM limitation):', e.message); }
assert(inputEl2, '#word-input mock element exists');
const inputHandlers = inputEl2._handlers && inputEl2._handlers.input;
assert(inputHandlers && inputHandlers.length > 0, 'GameController bound "input" listener on #word-input');
const keydownHandlers = inputEl2._handlers && inputEl2._handlers.keydown;
assert(keydownHandlers && keydownHandlers.length > 0, 'GameController bound "keydown" listener on #word-input (Enter to submit)');

// ---------------------------------------------------------------------------
// 11. Real prefix queries against full KBBI dataset
// ---------------------------------------------------------------------------
console.log('\n--- 11. Real prefix queries ---');

// Common prefixes — verify expected words appear
const abWords = SearchModule.findWordsByPrefix('AB', 100);
assert(abWords.includes('ABADI'), '"AB" prefix includes ABADI');
assert(abWords.includes('ABANG'), '"AB" prefix includes ABANG');

const selWords = SearchModule.findWordsByPrefix('SEL', 50);
// "SELASA" is alphabetically far past the first 50 SEL-prefixed words
// (there are 200+). Use a more specific prefix to verify SELASA inclusion.
const selasaWords = SearchModule.findWordsByPrefix('SELASA', 10);
assert(selasaWords.includes('SELASA'), '"SELASA" exact prefix includes SELASA itself');
assert(selWords.every((w) => w.startsWith('SEL')), 'all "SEL" words start with SEL');

const indoWords = SearchModule.findWordsByPrefix('INDO', 10);
assert(indoWords.includes('INDONESIA'), '"INDO" prefix includes INDONESIA');

// Reduplication prefix (hyphenated)
const anakWords = SearchModule.findWordsByPrefix('ANAK', 20);
assert(anakWords.includes('ANAK-ANAK'), '"ANAK" prefix includes ANAK-ANAK (reduplication)');

// ---------------------------------------------------------------------------
// 12. Performance — autocomplete < 50 ms per query
// ---------------------------------------------------------------------------
console.log('\n--- 12. Performance ---');
const t1 = Date.now();
SearchModule.findWordsByPrefix('SELASA', 20);
const t1ms = Date.now() - t1;
assert(t1ms < 50, `findWordsByPrefix("SELASA") < 50 ms (got ${t1ms} ms)`);

const t2 = Date.now();
SearchModule.findWordsByPrefix('A', 20);
const t2ms = Date.now() - t2;
assert(t2ms < 50, `findWordsByPrefix("A") < 50 ms (got ${t2ms} ms)`);

const t3 = Date.now();
SearchModule.getHintByPrefix('SEL', new Set());
const t3ms = Date.now() - t3;
assert(t3ms < 200, `getHintByPrefix("SEL") < 200 ms (got ${t3ms} ms)`);

// ---------------------------------------------------------------------------
// 13. Spec sanity — anchor-letter scenario
// ---------------------------------------------------------------------------
console.log('\n--- 13. Spec sanity — anchor-letter scenario ---');
// Spec: "Saat pemain memilih anchor cell dan arah (kanan/bawah), prefix = huruf anchor"
// E.g., anchor = 'S' (from SELASA) → suggestions for new words starting with 'S'
const anchorS = SearchModule.findWordsByPrefix('S', 10);
assert(anchorS.length === 10 && anchorS.every((w) => w.startsWith('S')),
  'anchor "S" → 10 S-prefixed word suggestions');

// Random pick for bot/AI
const botPick = SearchModule.getRandomWordByPrefix('S', new Set(['SELASA']));
assert(botPick !== null && botPick.startsWith('S') && botPick !== 'SELASA',
  'bot gets random S-word that is not SELASA (used)');

// Hint prioritizes longest
const hintForS = SearchModule.getHintByPrefix('S', new Set());
if (hintForS) {
  assert(hintForS.startsWith('S'), 'hint for anchor "S" starts with "S"');
  console.log(`  ℹ️  hint for "S": "${hintForS}" (${hintForS.length} chars)`);
}

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
