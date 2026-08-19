/**
 * Unit Tests for ValidationModule — Tahap 07
 * Run: node tests/test-validation.js
 *
 * Tests word validation against the KBBI Trie (from Tahap 06):
 *
 * 1. API surface (isValidWord, validateWordWithDetail, isTypo, levenshtein)
 * 2. isValidWord — basic cases per spec (SELASA, HALO, XYZQQ)
 * 3. validateWordWithDetail — all 4 reason values (valid/empty/too_short/not_in_kbbi)
 * 4. Case-insensitivity & whitespace trimming
 * 5. Hyphenated reduplications (ANAK-ANAK, KUDA-KUDA)
 * 6. Single-letter words (KBBI has all 26 letters A-Z)
 * 7. Edge cases: empty/null/undefined/number/whitespace-only
 * 8. Behavior when KBBI not loaded (returns not_in_kbbi)
 * 9. Levenshtein distance function
 * 10. _editDistance1Variants generator (counts, content)
 * 11. isTypo — distance 1: deletion, substitution, insertion near KBBI words
 * 12. isTypo — distance 2 (explicit opt-in)
 * 13. isTypo — exact match returns false (not a typo)
 * 14. isTypo — random garbage returns false
 * 15. Performance: isTypo runs in reasonable time
 * 16. Spec sanity check: SELASA valid, XYZQQ invalid, HALO valid, etc.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (same pattern as test-trie.js)
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
global.crypto = { randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 8) };

// Expose CommonJS locals to vm context (Node 24 quirk — see Tahap 06 changelog)
globalThis.require = require;
globalThis.process = process;
globalThis.__dirname = __dirname;
globalThis.__filename = __filename;

// Load game.js — exposes ValidationModule, KBBIModule, KBBITrie as globals
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

// Load full KBBI dataset for the tests
function loadFullKBBI() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'kbbi.json'), 'utf8'));
  KBBIModule.loadFromJSON(data);
}

// ===========================================================================
console.log('\n🧪 ValidationModule Tests — Tahap 07\n');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('--- 1. API surface ---');
assertEqual(typeof ValidationModule.isValidWord, 'function', 'isValidWord is function');
assertEqual(typeof ValidationModule.validateWordWithDetail, 'function', 'validateWordWithDetail is function');
assertEqual(typeof ValidationModule.isTypo, 'function', 'isTypo is function');
assertEqual(typeof ValidationModule.levenshtein, 'function', 'levenshtein is function');
// Internal helpers exposed for tests
assertEqual(typeof ValidationModule._normalize, 'function', '_normalize helper exposed');
assertEqual(typeof ValidationModule._editDistance1Variants, 'function', '_editDistance1Variants helper exposed');
// Stubs preserved for later tahaps
assertEqual(typeof ValidationModule.validatePlacement, 'function', 'validatePlacement stub (Tahap 16)');
assertEqual(typeof ValidationModule.validateNoAdjacentConflict, 'function', 'validateNoAdjacentConflict stub (Tahap 16)');
assertEqual(typeof ValidationModule.validateAccidentalWords, 'function', 'validateAccidentalWords stub (Tahap 16)');
assertEqual(typeof ValidationModule.isWordUsed, 'function', 'isWordUsed stub (Tahap 17)');

// ---------------------------------------------------------------------------
// 2. isValidWord — basic cases per spec
// ---------------------------------------------------------------------------
console.log('\n--- 2. isValidWord — spec examples ---');
loadFullKBBI();
assertEqual(ValidationModule.isValidWord('SELASA'), true, 'isValidWord("SELASA") → true (spec example)');
assertEqual(ValidationModule.isValidWord('HALO'), true, 'isValidWord("HALO") → true (spec example)');
assertEqual(ValidationModule.isValidWord('XYZQQ'), false, 'isValidWord("XYZQQ") → false (spec example)');
assertEqual(ValidationModule.isValidWord('ABADI'), true, 'isValidWord("ABADI") → true');
assertEqual(ValidationModule.isValidWord('INDONESIA'), true, 'isValidWord("INDONESIA") → true');
assertEqual(ValidationModule.isValidWord('ANAK-ANAK'), true, 'isValidWord("ANAK-ANAK") → true');
assertEqual(ValidationModule.isValidWord('MATA-MATA'), true, 'isValidWord("MATA-MATA") → true');
assertEqual(ValidationModule.isValidWord('BAGUS'), true, 'isValidWord("BAGUS") → true');

// ---------------------------------------------------------------------------
// 3. validateWordWithDetail — all 4 reason values
// ---------------------------------------------------------------------------
console.log('\n--- 3. validateWordWithDetail — all 4 reasons ---');

// 3a. reason: "valid"
const validRes = ValidationModule.validateWordWithDetail('SELASA');
assertEqual(validRes.valid, true, '"SELASA" → valid=true');
assertEqual(validRes.reason, 'valid', '"SELASA" → reason="valid"');
assertEqual(validRes.normalized, 'SELASA', '"SELASA" → normalized="SELASA"');

const validRes2 = ValidationModule.validateWordWithDetail('HALO');
assertEqual(validRes2.reason, 'valid', '"HALO" → reason="valid"');

// 3b. reason: "empty"
const emptyRes = ValidationModule.validateWordWithDetail('');
assertEqual(emptyRes.valid, false, '"" → valid=false');
assertEqual(emptyRes.reason, 'empty', '"" → reason="empty"');
assertEqual(emptyRes.normalized, '', '"" → normalized=""');

const whitespaceRes = ValidationModule.validateWordWithDetail('   ');
assertEqual(whitespaceRes.valid, false, '"   " → valid=false');
assertEqual(whitespaceRes.reason, 'empty', '"   " → reason="empty" (whitespace trimmed to empty)');

const nullRes = ValidationModule.validateWordWithDetail(null);
assertEqual(nullRes.reason, 'empty', 'null → reason="empty"');

const undefinedRes = ValidationModule.validateWordWithDetail(undefined);
assertEqual(undefinedRes.reason, 'empty', 'undefined → reason="empty"');

const numberRes = ValidationModule.validateWordWithDetail(12345);
assertEqual(numberRes.reason, 'empty', '12345 → reason="empty" (non-string)');

// 3c. reason: "too_short" (length 1 and not in KBBI)
// All 26 letters A-Z ARE in KBBI V, so 'A'..'Z' are valid.
// Single non-letter char like '1' or '!' is length-1 and not in KBBI → too_short.
const oneNumRes = ValidationModule.validateWordWithDetail('1');
assertEqual(oneNumRes.valid, false, '"1" → valid=false');
assertEqual(oneNumRes.reason, 'too_short', '"1" → reason="too_short" (length 1, not in KBBI)');
assertEqual(oneNumRes.normalized, '1', '"1" → normalized="1"');

const oneSymRes = ValidationModule.validateWordWithDetail('!');
assertEqual(oneSymRes.reason, 'too_short', '"!" → reason="too_short"');

// Single-letter KBBI words are valid
assertEqual(ValidationModule.validateWordWithDetail('A').valid, true, '"A" → valid (in KBBI)');
assertEqual(ValidationModule.validateWordWithDetail('A').reason, 'valid', '"A" → reason="valid"');
assertEqual(ValidationModule.validateWordWithDetail('Q').reason, 'valid', '"Q" → reason="valid" (Q is in KBBI)');

// 3d. reason: "not_in_kbbi" (length ≥ 2 and not in KBBI)
const notFoundRes = ValidationModule.validateWordWithDetail('XYZQQ');
assertEqual(notFoundRes.valid, false, '"XYZQQ" → valid=false');
assertEqual(notFoundRes.reason, 'not_in_kbbi', '"XYZQQ" → reason="not_in_kbbi"');
assertEqual(notFoundRes.normalized, 'XYZQQ', '"XYZQQ" → normalized="XYZQQ"');

const notFoundRes2 = ValidationModule.validateWordWithDetail('QQQQQ');
assertEqual(notFoundRes2.reason, 'not_in_kbbi', '"QQQQQ" → reason="not_in_kbbi"');

const notFoundRes3 = ValidationModule.validateWordWithDetail('ASDFGHJKL');
assertEqual(notFoundRes3.reason, 'not_in_kbbi', '"ASDFGHJKL" → reason="not_in_kbbi"');

// 3e. Return-shape consistency
const r = ValidationModule.validateWordWithDetail('test');
assert(typeof r === 'object' && r !== null, 'result is object');
assert('valid' in r && 'reason' in r && 'normalized' in r,
  'result has {valid, reason, normalized} keys');

// ---------------------------------------------------------------------------
// 4. Case-insensitivity & whitespace trimming
// ---------------------------------------------------------------------------
console.log('\n--- 4. Case-insensitivity & whitespace ---');
assertEqual(ValidationModule.isValidWord('selasa'), true, '"selasa" (lower) → true');
assertEqual(ValidationModule.isValidWord('Selasa'), true, '"Selasa" (mixed) → true');
assertEqual(ValidationModule.isValidWord('  SELASA  '), true, '"  SELASA  " (whitespace) → true');
assertEqual(ValidationModule.isValidWord('\tHALO\n'), true, '"\\tHALO\\n" → true');
assertEqual(ValidationModule.isValidWord('  halo  '), true, '"  halo  " → true (trimmed + uppercased)');
assertEqual(ValidationModule.isValidWord('  anak-anak  '), true, '"  anak-anak  " → true');
assertEqual(ValidationModule.isValidWord('Kuda-Kuda'), true, '"Kuda-Kuda" → true (mixed case + hyphen)');

// Verify normalized field reflects trim+upper
const trimRes = ValidationModule.validateWordWithDetail('  selasa  ');
assertEqual(trimRes.normalized, 'SELASA', 'normalized reflects trim+upper');

// ---------------------------------------------------------------------------
// 5. Hyphenated reduplications
// ---------------------------------------------------------------------------
console.log('\n--- 5. Hyphenated reduplications ---');
assertEqual(ValidationModule.isValidWord('ANAK-ANAK'), true, 'ANAK-ANAK valid');
assertEqual(ValidationModule.isValidWord('MATA-MATA'), true, 'MATA-MATA valid');
assertEqual(ValidationModule.isValidWord('KUDA-KUDA'), true, 'KUDA-KUDA valid');
assertEqual(ValidationModule.isValidWord('LARI-LARI'), true, 'LARI-LARI valid');
assertEqual(ValidationModule.isValidWord('anak-anak'), true, 'anak-anak (lower) valid');

// ANAK alone is valid too (it's a separate KBBI entry)
assertEqual(ValidationModule.isValidWord('ANAK'), true, 'ANAK (without hyphen) valid');

// ANAKANAK (no hyphen) — usually not a KBBI lemma
const noHyphenRes = ValidationModule.validateWordWithDetail('ANAKANAK');
console.log(`  ℹ️  "ANAKANAK" (no hyphen): ${noHyphenRes.reason}`);

// ---------------------------------------------------------------------------
// 6. Single-letter words
// ---------------------------------------------------------------------------
console.log('\n--- 6. Single-letter words (KBBI has A-Z) ---');
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
for (const L of letters) {
  const r = ValidationModule.validateWordWithDetail(L);
  assertEqual(r.valid, true, `"${L}" valid (single-letter KBBI entry)`);
  assertEqual(r.reason, 'valid', `"${L}" reason="valid"`);
}

// Lowercase single letters
for (const L of 'abc'.split('')) {
  assertEqual(ValidationModule.isValidWord(L), true, `"${L}" (lower) valid`);
}

// ---------------------------------------------------------------------------
// 7. Edge cases
// ---------------------------------------------------------------------------
console.log('\n--- 7. Edge cases ---');
assertEqual(ValidationModule.isValidWord(''), false, '"" → false');
assertEqual(ValidationModule.isValidWord(' '), false, '" " → false');
assertEqual(ValidationModule.isValidWord(null), false, 'null → false');
assertEqual(ValidationModule.isValidWord(undefined), false, 'undefined → false');
assertEqual(ValidationModule.isValidWord(123), false, 'number → false');
assertEqual(ValidationModule.isValidWord({}), false, 'object → false');
assertEqual(ValidationModule.isValidWord([]), false, 'array → false');
assertEqual(ValidationModule.isValidWord(true), false, 'boolean → false');

// Very long string (not in KBBI)
const longStr = 'A'.repeat(50);
const longRes = ValidationModule.validateWordWithDetail(longStr);
assertEqual(longRes.reason, 'not_in_kbbi', '50-char A string → not_in_kbbi');
assertEqual(longRes.normalized, longStr, '50-char A string normalized correctly');

// Words with digits (after trim+upper, still has digits — not in KBBI)
const digitsRes = ValidationModule.validateWordWithDetail('KATA123');
assertEqual(digitsRes.reason, 'not_in_kbbi', '"KATA123" → not_in_kbbi (digits make it not a KBBI word)');

// ---------------------------------------------------------------------------
// 8. Behavior when KBBI not loaded
// ---------------------------------------------------------------------------
console.log('\n--- 8. Behavior when KBBI not loaded ---');
KBBIModule.reset();
assertEqual(KBBIModule.isLoaded(), false, 'KBBI not loaded after reset');
const notLoadedRes = ValidationModule.validateWordWithDetail('SELASA');
assertEqual(notLoadedRes.valid, false, 'when KBBI not loaded, "SELASA" → valid=false');
assertEqual(notLoadedRes.reason, 'not_in_kbbi', 'when KBBI not loaded, reason="not_in_kbbi"');
assertEqual(notLoadedRes.normalized, 'SELASA', 'normalized still computed');
assertEqual(ValidationModule.isValidWord('SELASA'), false, 'isValidWord returns false when KBBI not loaded');
assertEqual(ValidationModule.isTypo('SELAS'), false, 'isTypo returns false when KBBI not loaded');

// Reload for subsequent tests
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 9. Levenshtein distance
// ---------------------------------------------------------------------------
console.log('\n--- 9. Levenshtein distance ---');
assertEqual(ValidationModule.levenshtein('', ''), 0, 'lev("","")=0');
assertEqual(ValidationModule.levenshtein('ABC', ''), 3, 'lev("ABC","")=3');
assertEqual(ValidationModule.levenshtein('', 'ABC'), 3, 'lev("","ABC")=3');
assertEqual(ValidationModule.levenshtein('ABC', 'ABC'), 0, 'lev("ABC","ABC")=0 (identical)');
assertEqual(ValidationModule.levenshtein('SELASA', 'SELAS'), 1, 'lev("SELASA","SELAS")=1 (one deletion)');
assertEqual(ValidationModule.levenshtein('SELAS', 'SELASA'), 1, 'lev("SELAS","SELASA")=1 (one insertion)');
assertEqual(ValidationModule.levenshtein('SELASA', 'SELASA'), 0, 'lev("SELASA","SELASA")=0');
assertEqual(ValidationModule.levenshtein('ABC', 'XYZ'), 3, 'lev("ABC","XYZ")=3 (3 substitutions)');
assertEqual(ValidationModule.levenshtein('KUCING', 'KUCIGN'), 2, 'lev("KUCING","KUCIGN")=2 (transposition = 2 edits)');
assertEqual(ValidationModule.levenshtein('KUCING', 'KUCING'), 0, 'lev("KUCING","KUCING")=0');
assertEqual(ValidationModule.levenshtein('HALO', 'HALLO'), 1, 'lev("HALO","HALLO")=1 (one insertion)');
assertEqual(ValidationModule.levenshtein('ABADI', 'ABADAI'), 1, 'lev("ABADI","ABADAI")=1');
// Case-insensitive? — Levenshtein operates on raw strings; "ABC" vs "abc" = 3 substitutions
assertEqual(ValidationModule.levenshtein('ABC', 'abc'), 3, 'lev("ABC","abc")=3 (case-sensitive)');

// ---------------------------------------------------------------------------
// 10. _editDistance1Variants generator
// ---------------------------------------------------------------------------
console.log('\n--- 10. _editDistance1Variants ---');
// For "AB" (length 2):
// - Deletions: 2 (A, B → ["", "B"], ["A", ""]) → "B", "A"
// - Insertions: 3 positions * 26 letters = 78 variants
// - Substitutions: 2 positions * 25 other letters = 50 variants
// Total: 2 + 78 + 50 = 130 variants
const variantsAB = Array.from(ValidationModule._editDistance1Variants('AB'));
assertEqual(variantsAB.length, 130, '"AB" has 130 edit-distance-1 variants (2 del + 78 ins + 50 sub)');

// Check some specific variants
assert(variantsAB.includes('A'), '"AB" → deletion of B → "A" included');
assert(variantsAB.includes('B'), '"AB" → deletion of A → "B" included');
assert(variantsAB.includes('ACB'), '"AB" → insertion C at index 1 → "ACB" included');
assert(variantsAB.includes('AC'), '"AB" → substitution B→C → "AC" included');
assert(!variantsAB.includes('AB'), '"AB" → no substitution to itself (variant must differ)');

// For length 1 (e.g. "A"):
// - Deletions: 1 → ""
// - Insertions: 2 positions * 26 = 52
// - Substitutions: 1 position * 25 = 25
// Total: 1 + 52 + 25 = 78
const variantsA = Array.from(ValidationModule._editDistance1Variants('A'));
assertEqual(variantsA.length, 78, '"A" has 78 edit-distance-1 variants');

// Empty string:
// - Deletions: 0
// - Insertions: 1 position * 26 = 26
// - Substitutions: 0
// Total: 26
const variantsEmpty = Array.from(ValidationModule._editDistance1Variants(''));
assertEqual(variantsEmpty.length, 26, '"" has 26 insertion variants');

// ---------------------------------------------------------------------------
// 11. isTypo — distance 1 cases
// ---------------------------------------------------------------------------
console.log('\n--- 11. isTypo — distance 1 ---');

// Exact match → false (not a typo)
assertEqual(ValidationModule.isTypo('SELASA'), false, '"SELASA" is exact match → not a typo');
assertEqual(ValidationModule.isTypo('HALO'), false, '"HALO" is exact match → not a typo');
assertEqual(ValidationModule.isTypo('ABADI'), false, '"ABADI" exact → not a typo');

// 1-char deletion (close to a KBBI word)
assertEqual(ValidationModule.isTypo('SELAS'), true, '"SELAS" → 1 deletion from SELASA → typo');
assertEqual(ValidationModule.isTypo('HALO'), false, '"HALO" → exact match (sanity)');
assertEqual(ValidationModule.isTypo('HALLO'), true, '"HALLO" → 1 insertion from HALO → typo');
assertEqual(ValidationModule.isTypo('ABADO'), true, '"ABADO" → 1 substitution from ABADI → typo');

// 1-char substitution (close to a KBBI word)
assertEqual(ValidationModule.isTypo('SELASA'), false, '"SELASA" exact → not a typo');

// Empty / null input → false
assertEqual(ValidationModule.isTypo(''), false, '"" → false');
assertEqual(ValidationModule.isTypo(null), false, 'null → false');
assertEqual(ValidationModule.isTypo(undefined), false, 'undefined → false');

// maxDistance=0 → no checks, returns false
assertEqual(ValidationModule.isTypo('SELAS', 0), false, '"SELAS" with maxDistance=0 → false');

// ---------------------------------------------------------------------------
// 12. isTypo — distance 2 (explicit opt-in)
// ---------------------------------------------------------------------------
console.log('\n--- 12. isTypo — distance 2 ---');

// "XXLASA" — 2 substitutions from SELASA (E→X, S→X). No KBBI word within
// distance 1 (XELASA and SXLASA aren't KBBI entries), but distance 2
// reaches SELASA. Verified empirically against the 74k KBBI dataset.
assertEqual(ValidationModule.isTypo('XXLASA', 1), false, '"XXLASA" not detected at distance 1 (no KBBI word nearby)');
assertEqual(ValidationModule.isTypo('XXLASA', 2), true, '"XXLASA" detected at distance 2 (2 substitutions from SELASA)');

// "SESA" has many KBBI words at distance 1 (DESA, ESA, LESA, SELA, ...)
// so it IS detected at distance 1 — confirm this correct behavior
assertEqual(ValidationModule.isTypo('SESA', 1), true, '"SESA" detected at distance 1 (near DESA/LESA/SELA/etc.)');

// maxDistance > 2 is capped at 2 (no crash)
const cap = ValidationModule.isTypo('SELAS', 5);
assertEqual(cap, true, 'maxDistance=5 capped to 2, still detects "SELAS"');

// ---------------------------------------------------------------------------
// 13. isTypo — exact match returns false
// ---------------------------------------------------------------------------
console.log('\n--- 13. isTypo — exact match returns false ---');
const knownWords = ['SELASA', 'HALO', 'ABADI', 'INDONESIA', 'ANAK-ANAK', 'KUCING'];
for (const w of knownWords) {
  if (KBBIModule.search(w)) {
    assertEqual(ValidationModule.isTypo(w), false, `"${w}" exact match → not a typo`);
  }
}

// ---------------------------------------------------------------------------
// 14. isTypo — random garbage returns false
// ---------------------------------------------------------------------------
console.log('\n--- 14. isTypo — random garbage ---');
assertEqual(ValidationModule.isTypo('XYZQQ'), false, '"XYZQQ" — no nearby KBBI word → false');
assertEqual(ValidationModule.isTypo('QQQQQ'), false, '"QQQQQ" → false');
assertEqual(ValidationModule.isTypo('ASDFGHJKL'), false, '"ASDFGHJKL" → false');
assertEqual(ValidationModule.isTypo('ZZZZZZZZZZ'), false, '"ZZZZZZZZZZ" → false');

// ---------------------------------------------------------------------------
// 15. Performance — isTypo should complete quickly
// ---------------------------------------------------------------------------
console.log('\n--- 15. Performance ---');
const start = Date.now();
ValidationModule.isTypo('SELAS', 1);
const ms1 = Date.now() - start;
assert(ms1 < 1000, `isTypo distance 1 completes in < 1 sec (got ${ms1} ms)`);

const start2 = Date.now();
ValidationModule.isTypo('SELAS', 2);
const ms2 = Date.now() - start2;
assert(ms2 < 5000, `isTypo distance 2 completes in < 5 sec (got ${ms2} ms)`);

// ---------------------------------------------------------------------------
// 16. Spec sanity check
// ---------------------------------------------------------------------------
console.log('\n--- 16. Spec sanity check (SELASA valid, XYZQQ invalid, HALO valid) ---');
assertEqual(ValidationModule.isValidWord('SELASA'), true, 'Spec: "SELASA" valid');
assertEqual(ValidationModule.isValidWord('XYZQQ'), false, 'Spec: "XYZQQ" tidak valid');
assertEqual(ValidationModule.isValidWord('HALO'), true, 'Spec: "HALO" valid');

// Additional spec-mentioned cases (from Tahap 07 spec line: "dll")
const specCases = [
  ['BAGUS', true], ['CINTA', true], ['DUNIA', true], ['EMAS', true],
  ['FANA', true], ['GUNUNG', true], ['HATI', true], ['INDONESIA', true],
  ['JALAN', true], ['KASIH', true], ['LARI', true], ['MATA', true],
  ['NAMA', true], ['ORANG', true], ['PINTU', true], ['RUMAH', true],
  ['SEHAT', true], ['TANAH', true], ['UMUR', true], ['WARNA', true],
  ['YANG', true], ['ZAMAN', true],
];
for (const [w, expected] of specCases) {
  assertEqual(ValidationModule.isValidWord(w), expected, `Spec: "${w}" valid`);
}

// Invalid spec examples
assertEqual(ValidationModule.isValidWord('QQQQQ'), false, 'Spec: "QQQQQ" invalid');
assertEqual(ValidationModule.isValidWord('ASDFGHJKL'), false, 'Spec: "ASDFGHJKL" invalid');

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
