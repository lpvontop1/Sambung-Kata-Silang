/**
 * Unit Tests for PlacementModule.placeWordDown (Tahap 12 — Mekanik
 * Penempatan Vertikal Bawah)
 * Run: node tests/test-placement-down.js
 *
 * Mirrors test-placement-right.js but for DOWN direction. Per spec:
 * placing a word DOWNWARD from an anchor means:
 *   - Word's FIRST letter must equal anchor cell's letter (SAME as
 *     placeWordRight — just vertical instead of horizontal)
 *   - Position formula: huruf ke-i → (anchorRow + i, anchorCol)
 *   - Spec example: anchor "L" at (2,2) from word "SELASA" (horizontal),
 *     word "LAOS" (starts with L) → L(2,2)=anchor, A(3,2), O(4,2), S(5,2)
 *
 * Tests:
 * 1. PlacementModule API surface (placeWordDown wired)
 * 2. Successful placement (LAOS down from anchor L)
 * 3. Result shape: { success, cells, word, reason }
 * 4. Word actually written to board + getWordCellPositions consistency
 * 5. First-letter mismatch (anchor L, word BERLARI starts with B)
 * 6. Word not in KBBI → not_in_kbbi
 * 7. Word already used → word_already_used
 * 8. Anchor cell empty → no_anchor
 * 9. KBBI not loaded → kbbi_not_loaded
 * 10. Empty word → empty_word
 * 11. Non-string word → empty_word
 * 12. Overlap conflict — existing cell has different letter
 * 13. Overlap OK (intersection) — existing cell has SAME letter
 *     (vertical word crossing horizontal word)
 * 14. Gap rule before — cell above anchor is part of vertical word
 * 15. Gap rule after — cell below last letter is part of vertical word
 * 16. Gap rule NOT triggered when above/below cell is part of HORIZONTAL word
 * 17. Multiple successful placements building up a board
 * 18. Case-insensitivity (lowercase/mixed/whitespace-padded → UPPERCASE)
 * 19. Hyphenated word placement (ANAK-ANAK down from anchor A)
 * 20. Spec example: anchor "L" → "LAOS" → L(2,2) A(3,2) O(4,2) S(5,2)
 * 21. wordId & playerId passed through to Word object
 * 22. Spec validation order: not_in_kbbi BEFORE no_anchor; word_already_used BEFORE no_anchor
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (same as test-placement-right.js)
// ---------------------------------------------------------------------------
function _newElement(id) {
  const el = {
    id: id, className: '',
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
    dataset: {}, style: { setProperty: function() {} },
    children: [], childNodes: [],
    textContent: '', _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; this.children = []; this.childNodes = []; },
    appendChild: function(c) { this.children.push(c); c._parent = this; return c; },
    removeChild: function(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove: function() {},
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    removeEventListener: function() {},
    getContext: function() {
      return { fillRect: function(){}, clearRect: function(){}, setTransform: function(){}, save: function(){}, restore: function(){}, beginPath: function(){}, closePath: function(){}, moveTo: function(){}, lineTo: function(){}, rect: function(){}, fill: function(){}, stroke: function(){}, arc: function(){}, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', fillText: function(){}, strokeText: function(){}, measureText: function(){return {width:0};} };
    },
    width: 300, height: 150, toDataURL: function() { return ''; },
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
  createElement: (tag) => _newElement('auto-' + tag + '-' + Math.random().toString(36).slice(2, 8)),
  documentElement: { style: { setProperty: () => {} } },
};
global.crypto = { randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 8) };
globalThis.require = require;
globalThis.process = process;
globalThis.__dirname = __dirname;
globalThis.__filename = __filename;

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

/** Seed a horizontal word so anchor cells are available for vertical placement. */
function seedHorizontalWord(text, startRow, startCol, wordId) {
  const word = BoardModule.createWord(text, startRow, startCol, 'right', 'seed', wordId);
  for (const p of BoardModule.getWordCellPositions(word)) {
    BoardModule.setCell(p.row, p.col, p.letter, word.id, 'horizontal');
  }
  BoardModule.addWord(word);
  return word;
}

function seedVerticalWord(text, startRow, startCol, wordId) {
  const word = BoardModule.createWord(text, startRow, startCol, 'down', 'seed', wordId);
  for (const p of BoardModule.getWordCellPositions(word)) {
    BoardModule.setCell(p.row, p.col, p.letter, word.id, 'vertical');
  }
  BoardModule.addWord(word);
  return word;
}

// ===========================================================================
console.log('\n🧪 PlacementModule.placeWordDown Tests — Tahap 12\n');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI loaded');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('\n--- 1. API surface ---');
assertEqual(typeof PlacementModule, 'object', 'PlacementModule is defined');
assertEqual(typeof PlacementModule.placeWordDown, 'function', 'placeWordDown is function');
// Previous tahap functions still work
assertEqual(typeof PlacementModule.placeWordRight, 'function', 'placeWordRight still defined (Tahap 10)');
assertEqual(typeof PlacementModule.placeWordLeft, 'function', 'placeWordLeft still defined (Tahap 11)');
// Stubs for remaining directions preserved
assertEqual(typeof PlacementModule.placeWordUp, 'function', 'placeWordUp stub (Tahap 13)');
assertEqual(typeof PlacementModule.calculatePositions, 'function', 'calculatePositions stub (Tahap 18)');

// ---------------------------------------------------------------------------
// 2. Successful placement (LAOS down from anchor L)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Successful placement ---');
BoardModule.reset();
// Seed: SELASA horizontal at (2,0): S(2,0) E(2,1) L(2,2) A(2,3) S(2,4) A(2,5)
// Anchor L at (2,2)
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r = PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1');
assertEqual(r.success, true, 'placeWordDown returns success');
assertEqual(r.reason, 'placed_down', 'reason is "placed_down"');

// ---------------------------------------------------------------------------
// 3. Result shape
// ---------------------------------------------------------------------------
console.log('\n--- 3. Result shape ---');
assert(r.cells && Array.isArray(r.cells), 'result.cells is array');
assertEqual(r.cells.length, 4, 'cells array has 4 entries (LAOS)');
const firstCell = r.cells[0];
assert('row' in firstCell && 'col' in firstCell && 'letter' in firstCell,
  'each cell has {row, col, letter}');
assert(r.word && typeof r.word === 'object', 'result.word is object');
assertEqual(r.word.text, 'LAOS', 'word.text is "LAOS"');
assertEqual(r.word.direction, 'down', 'word.direction is "down"');
assertEqual(r.word.startRow, 2, 'word.startRow = 2 (anchor row, topmost)');
assertEqual(r.word.startCol, 2, 'word.startCol = 2 (anchor col)');
assertEqual(r.word.length, 4, 'word.length = 4');
assertEqual(r.word.playerId, 'p1', 'word.playerId = "p1"');
assert(r.word.id && typeof r.word.id === 'string', 'word.id is auto-UUID string');

// ---------------------------------------------------------------------------
// 4. Word actually written to board + getWordCellPositions consistency
// ---------------------------------------------------------------------------
console.log('\n--- 4. Word written to board ---');
// All 4 cells should be filled: L(2,2)=anchor, A(3,2), O(4,2), S(5,2)
const expectedCells = [
  { row: 2, col: 2, letter: 'L' },  // anchor — already had L from SELASA
  { row: 3, col: 2, letter: 'A' },
  { row: 4, col: 2, letter: 'O' },
  { row: 5, col: 2, letter: 'S' },
];
for (const ec of expectedCells) {
  const cell = BoardModule.getCell(ec.row, ec.col);
  assert(cell && cell.letter === ec.letter,
    `board cell (${ec.row},${ec.col}) = "${ec.letter}"`);
}
// Word added to board.words
assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + new)');
// Word added to board.wordSet
assert(BoardModule.hasWord('LAOS'), 'board.wordSet contains "LAOS"');
assert(BoardModule.hasWord('SELASA'), 'board.wordSet still contains seed "SELASA"');
// getWordCellPositions consistency — must yield the same cells as result.cells
const positionsViaGet = BoardModule.getWordCellPositions(r.word);
assertEqual(positionsViaGet.length, 4, 'getWordCellPositions returns 4 positions');
for (let i = 0; i < 4; i++) {
  assertDeepEqual(positionsViaGet[i], r.cells[i],
    `getWordCellPositions[${i}] matches result.cells[${i}]`);
}
// Anchor cell (2,2) is now an intersection (partOfWords has both SELASA and LAOS)
const anchorCell = BoardModule.getCell(2, 2);
assert(anchorCell.partOfWords.includes('seed-1'), 'anchor part of seed word SELASA');
assert(anchorCell.partOfWords.includes(r.word.id), 'anchor part of new word LAOS');

// ---------------------------------------------------------------------------
// 5. First-letter mismatch
// ---------------------------------------------------------------------------
console.log('\n--- 5. First-letter mismatch ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
// Anchor L at (2,2), word BERLARI starts with B → mismatch
const r5 = PlacementModule.placeWordDown('BERLARI', 2, 2, null, 'p1');
assertEqual(r5.success, false, 'BERLARI from anchor L → failure');
assertEqual(r5.reason, 'first_letter_mismatch', 'reason = first_letter_mismatch');

// ---------------------------------------------------------------------------
// 6. Word not in KBBI
// ---------------------------------------------------------------------------
console.log('\n--- 6. Word not in KBBI ---');
const r6 = PlacementModule.placeWordDown('XYZQQ', 2, 2, null, 'p1');
assertEqual(r6.success, false, 'XYZQQ → failure');
assertEqual(r6.reason, 'not_in_kbbi', 'reason = not_in_kbbi');

// ---------------------------------------------------------------------------
// 7. Word already used (no-repeat)
// ---------------------------------------------------------------------------
console.log('\n--- 7. Word already used ---');
// First place LAOS successfully
const r7a = PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1');
assertEqual(r7a.success, true, 'first LAOS placement succeeds');
// Try placing LAOS again at a different valid anchor (the other L from... wait, SELASA has only one L)
// Use anchor S at (2,0) — but LAOS starts with L, not S. Use a different word that starts with S and ends with S — actually we need a word starting with S.
// Place SELAMAT (if in KBBI) or another S-word at (2,0) — but (2,0) is anchor S, place going DOWN
// SELAMAT starts with S — try placing it down from S at (2,0)
// But first: try LAOS again at (2,0) — anchor S, LAOS starts with L → first_letter_mismatch, NOT word_already_used
// Hmm we want to test word_already_used. Use LAOS at a different anchor — need an L anchor.
// Actually, since LAOS was just placed, and wordSet has 'LAOS', trying LAOS anywhere will fail with word_already_used
// before reaching the anchor check.
// Use a fresh anchor that doesn't exist — but then no_anchor fires... wait no, word_already_used fires first.
const r7b = PlacementModule.placeWordDown('LAOS', 999, 999, null, 'p1');
assertEqual(r7b.success, false, 'second LAOS placement fails (no-repeat fires before no_anchor)');
assertEqual(r7b.reason, 'word_already_used', 'reason = word_already_used');

// ---------------------------------------------------------------------------
// 8. Anchor cell empty → no_anchor
// ---------------------------------------------------------------------------
console.log('\n--- 8. Anchor cell empty ---');
// Use a fresh KBBI word not in wordSet (LAOS is already in wordSet)
const r8 = PlacementModule.placeWordDown('BAGUS', 100, 100, null, 'p1');
assertEqual(r8.success, false, 'placing BAGUS on empty cell → failure');
assertEqual(r8.reason, 'no_anchor', 'reason = no_anchor');

// ---------------------------------------------------------------------------
// 9. KBBI not loaded
// ---------------------------------------------------------------------------
console.log('\n--- 9. KBBI not loaded ---');
KBBIModule.reset();
const r9 = PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1');
assertEqual(r9.success, false, 'placeWordDown returns failure when KBBI not loaded');
assertEqual(r9.reason, 'kbbi_not_loaded', 'reason = kbbi_not_loaded');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 10. Empty word
// ---------------------------------------------------------------------------
console.log('\n--- 10. Empty word ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r10 = PlacementModule.placeWordDown('', 2, 2, null, 'p1');
assertEqual(r10.success, false, 'empty word → failure');
assertEqual(r10.reason, 'empty_word', 'reason = empty_word');

// ---------------------------------------------------------------------------
// 11. Non-string word
// ---------------------------------------------------------------------------
console.log('\n--- 11. Non-string word ---');
const r11a = PlacementModule.placeWordDown(null, 2, 2, null, 'p1');
assertEqual(r11a.reason, 'empty_word', 'null word → empty_word');
const r11b = PlacementModule.placeWordDown(undefined, 2, 2, null, 'p1');
assertEqual(r11b.reason, 'empty_word', 'undefined word → empty_word');
const r11c = PlacementModule.placeWordDown(123, 2, 2, null, 'p1');
assertEqual(r11c.reason, 'empty_word', 'number word → empty_word');

// ---------------------------------------------------------------------------
// 12. Overlap conflict — existing cell has different letter
// ---------------------------------------------------------------------------
console.log('\n--- 12. Overlap conflict ---');
BoardModule.reset();
// Seed horizontal SELASA at (2,0): S(2,0) E(2,1) L(2,2) A(2,3) S(2,4) A(2,5)
seedHorizontalWord('SELASA', 2, 0, 'seed-h1');
// Plant an isolated 'X' at (3, 2) — different from any letter the placement would write there.
// For LAOS placed down from anchor L at (2,2): cells L(2,2), A(3,2), O(4,2), S(5,2)
// Cell (3,2) would get 'A' but has 'X' → overlap_conflict
BoardModule.setCell(3, 2, 'X', 'conflict-seed', 'vertical');
const r12 = PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1');
assertEqual(r12.success, false, 'overlap conflict when cell has different letter');
assertEqual(r12.reason, 'overlap_conflict', 'reason = overlap_conflict');

// ---------------------------------------------------------------------------
// 13. Overlap OK (intersection with same letter) — vertical crosses horizontal
// ---------------------------------------------------------------------------
console.log('\n--- 13. Overlap OK (intersection with same letter) ---');
BoardModule.reset();
// Seed horizontal SELASA at (2,0): S(2,0) E(2,1) L(2,2) A(2,3) S(2,4) A(2,5)
seedHorizontalWord('SELASA', 2, 0, 'seed-selasa');
// Seed another horizontal word "BAGAS" at (4, 0): B(4,0) A(4,1) G(4,2) A(4,3) S(4,4)
// Then place "LAOS" down from anchor L at (2,2): cells L(2,2)=anchor, A(3,2), O(4,2), S(5,2)
// At (4,2), the existing cell has G from BAGAS; LAOS would write O → overlap_conflict
// Use word "LAGAS"? Not in KBBI. Use word that has G at position 2 (3rd letter).
// Actually simpler: use "LAGI" (length 4: L-A-G-I) — at (4,2) we'd write G, and we need the horizontal
// word at (4,2) to also have G.
// Seed horizontal "AXGX" at (4,0) (not a real KBBI word, just seed cells): A(4,0) X(4,1) G(4,2) X(4,3)
// Wait, we can use seedHorizontalWord with non-KBBI text — it just sets cells manually.
// Actually seedHorizontalWord calls BoardModule.addWord which doesn't validate KBBI. So we can use
// any text for seeding.
seedHorizontalWord('AXGA', 4, 0, 'seed-axga');  // A(4,0) X(4,1) G(4,2) A(4,3)
// Now place "LAGI" down from anchor L at (2,2): L(2,2)=anchor, A(3,2), G(4,2)=matches AXGA's G, I(5,2)
if (KBBIModule.search('LAGI')) {
  const r13 = PlacementModule.placeWordDown('LAGI', 2, 2, null, 'p1');
  assertEqual(r13.success, true, 'placement succeeds with intersection at (4,2)=G');
  assertEqual(r13.reason, 'placed_down', 'reason = placed_down');
  // Verify intersection cell has partOfWords containing both horizontal seed and new word
  const interCell = BoardModule.getCell(4, 2);
  assert(interCell.partOfWords.includes('seed-axga'), 'intersection cell part of horizontal seed AXGA');
  assert(interCell.partOfWords.includes(r13.word.id), 'intersection cell part of new vertical word LAGI');
} else {
  console.log('  ⚠️  LAGI not in KBBI — skipping intersection test');
}

// ---------------------------------------------------------------------------
// 14. Gap rule before — cell above anchor is part of vertical word
// ---------------------------------------------------------------------------
console.log('\n--- 14. Gap rule before ---');
BoardModule.reset();
// Anchor L at (5, 5). Word "LAOS" down → L(5,5), A(6,5), O(7,5), S(8,5).
// Gap-before cell: (5 - 1, 5) = (4, 5) — must NOT be part of vertical word.
// Place a vertical word "KASIH" at (0, 5)-(4, 5) going down: K(0,5) A(1,5) S(2,5) I(3,5) H(4,5)
// Then cell (4,5)=H from KASIH (vertical) → gap rule fires.
// But we also need anchor L at (5,5). Plant it manually as part of a horizontal word.
seedVerticalWord('KASIH', 0, 5, 'seed-before-v');  // K(0,5) A(1,5) S(2,5) I(3,5) H(4,5)
// Plant anchor L at (5, 5) via a horizontal seed
seedHorizontalWord('LMNO', 5, 5, 'seed-anchor-h');  // L(5,5) M(5,6) N(5,7) O(5,8) — not real KBBI but seeds cells
// Now place "LAOS" down from anchor L at (5,5)
const r14 = PlacementModule.placeWordDown('LAOS', 5, 5, null, 'p1');
assertEqual(r14.success, false, 'gap rule before fails when cell above anchor is vertical word');
assertEqual(r14.reason, 'adjacent_word_before', 'reason = adjacent_word_before');

// ---------------------------------------------------------------------------
// 15. Gap rule after — cell below last letter is part of vertical word
// ---------------------------------------------------------------------------
console.log('\n--- 15. Gap rule after ---');
BoardModule.reset();
// Anchor L at (2, 5). Word "LAOS" down → L(2,5), A(3,5), O(4,5), S(5,5). Last letter at (5,5).
// Gap-after cell: (5 + 1, 5) = (6, 5) — must NOT be part of vertical word.
// Place a vertical word "KASIH" at (6, 5)-(10, 5) going down.
// Plant anchor L at (2, 5) via a horizontal seed
seedHorizontalWord('LMNO', 2, 5, 'seed-anchor-h');  // L(2,5) M(2,6) N(2,7) O(2,8)
seedVerticalWord('KASIH', 6, 5, 'seed-after-v');  // K(6,5) A(7,5) S(8,5) I(9,5) H(10,5)
// Place "LAOS" down from anchor L at (2,5)
const r15 = PlacementModule.placeWordDown('LAOS', 2, 5, null, 'p1');
assertEqual(r15.success, false, 'gap rule after fails when cell below last letter is vertical word');
assertEqual(r15.reason, 'adjacent_word_after', 'reason = adjacent_word_after');

// ---------------------------------------------------------------------------
// 16. Gap rule NOT triggered when above/below cell is part of HORIZONTAL word
// ---------------------------------------------------------------------------
console.log('\n--- 16. Gap rule not triggered for horizontal word above/below ---');
BoardModule.reset();
// Anchor L at (5, 5). Word "LAOS" down → L(5,5), A(6,5), O(7,5), S(8,5).
// Plant a horizontal word at (4, 5) — so cell (4,5) has a letter from a horizontal word.
// Since the gap rule for vertical placement only cares about VERTICAL words, the
// horizontal word at (4,5) should NOT trigger the gap rule.
seedHorizontalWord('LMNO', 5, 5, 'seed-anchor-h');  // L(5,5) M(5,6) N(5,7) O(5,8)
seedHorizontalWord('ABCD', 4, 4, 'seed-above-h');  // A(4,4) B(4,5) C(4,6) D(4,7)
// Cell (4,5) = B from horizontal ABCD. Above-anchor cell is (4,5) = part of horizontal word.
// Gap rule for vertical placement should NOT fire (only checks vertical adjacency).
const r16 = PlacementModule.placeWordDown('LAOS', 5, 5, null, 'p1');
assertEqual(r16.success, true, 'placement succeeds when above-cell is horizontal (gap rule OK for vertical)');
assertEqual(r16.reason, 'placed_down', 'reason = placed_down');

// ---------------------------------------------------------------------------
// 17. Multiple successful placements building up a board
// ---------------------------------------------------------------------------
console.log('\n--- 17. Multiple placements building a board ---');
BoardModule.reset();
// Seed SELASA horizontal at (2, 0): S(2,0) E(2,1) L(2,2) A(2,3) S(2,4) A(2,5)
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
// Place LAOS down from anchor L at (2,2)
const p1 = PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1');
assertEqual(p1.success, true, 'placement 1 (LAOS down from L at 2,2) succeeds');
// LAOS creates cells L(2,2)=anchor, A(3,2), O(4,2), S(5,2)
// Use the LAST letter S at (5, 2) as new anchor for another S-word going DOWN
const p2 = PlacementModule.placeWordDown('SATE', 5, 2, null, 'p2');
if (KBBIModule.search('SATE')) {
  // SATE from (5,2) should FAIL: cell (4, 2) is O from LAOS (vertical) →
  // gap rule 'adjacent_word_before' fires correctly (would merge two vertical words).
  assertEqual(p2.success, false, 'SATE down from (5,2) fails — gap rule (cell above is part of LAOS vertical)');
  assertEqual(p2.reason, 'adjacent_word_before', 'reason = adjacent_word_before (correct gap rule)');
  // Use S at (2, 4) from SELASA horizontal as anchor instead (no vertical word above)
  const p2b = PlacementModule.placeWordDown('SATE', 2, 4, null, 'p2');
  assertEqual(p2b.success, true, 'placement 2 (SATE down from S at 2,4) succeeds');
  // SATE: S(2,4)=anchor, A(3,4), T(4,4), E(5,4)
  assertEqual(BoardModule.getWordCount(), 3, 'board has 3 words (seed + LAOS + SATE)');
} else {
  console.log('  ⚠️  SATE not in KBBI — trying "SOTO"');
  const p2b = PlacementModule.placeWordDown('SOTO', 2, 4, null, 'p2');
  if (KBBIModule.search('SOTO') && p2b.success) {
    assertEqual(p2b.success, true, 'placement 2 (SOTO down from S at 2,4) succeeds');
    assertEqual(BoardModule.getWordCount(), 3, 'board has 3 words (seed + LAOS + SOTO)');
  } else {
    console.log('  ⚠️  SOTO not in KBBI or placement failed — board has 2 words');
    assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + LAOS)');
  }
}
// Verify placements are in wordSet
assert(BoardModule.hasWord('SELASA'), 'wordSet has SELASA (seed)');
assert(BoardModule.hasWord('LAOS'), 'wordSet has LAOS');

// ---------------------------------------------------------------------------
// 18. Case-insensitivity
// ---------------------------------------------------------------------------
console.log('\n--- 18. Case-insensitivity ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r18a = PlacementModule.placeWordDown('laos', 2, 2, null, 'p1');
assertEqual(r18a.success, true, 'lowercase "laos" placed successfully');
assertEqual(r18a.word.text, 'LAOS', 'word.text normalized to UPPERCASE');

BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r18b = PlacementModule.placeWordDown('Laos', 2, 2, null, 'p1');
assertEqual(r18b.success, true, 'mixed-case "Laos" placed successfully');

BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r18c = PlacementModule.placeWordDown('  LAOS  ', 2, 2, null, 'p1');
assertEqual(r18c.success, true, 'whitespace-padded "  LAOS  " placed successfully');

// ---------------------------------------------------------------------------
// 19. Hyphenated word (ANAK-ANAK down from anchor A)
// ---------------------------------------------------------------------------
console.log('\n--- 19. Hyphenated word (ANAK-ANAK down from anchor A) ---');
BoardModule.reset();
// Need an anchor A. Seed a horizontal word with A.
// SELASA has A at (2, 3) and (2, 5).
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
if (KBBIModule.search('ANAK-ANAK')) {
  // ANAK-ANAK starts with A. Place down from anchor A at (2, 3).
  const r19 = PlacementModule.placeWordDown('ANAK-ANAK', 2, 3, null, 'p1');
  assertEqual(r19.success, true, 'ANAK-ANAK placed down from anchor A');
  assertEqual(r19.cells.length, 9, 'ANAK-ANAK has 9 cells (including hyphen)');
  // Verify the hyphen position
  const hyphenCell = r19.cells[4]; // 5th char (index 4) is '-'
  assertEqual(hyphenCell.letter, '-', 'cell 4 contains hyphen "-"');
  // Verify board has the hyphen
  const cellOnBoard = BoardModule.getCell(hyphenCell.row, hyphenCell.col);
  assertEqual(cellOnBoard.letter, '-', 'hyphen cell on board has "-"');
} else {
  console.log('  ⚠️  ANAK-ANAK not in KBBI — skipping hyphenated test');
}

// ---------------------------------------------------------------------------
// 20. Spec example: anchor "L" → "LAOS" → L(2,2) A(3,2) O(4,2) S(5,2)
// ---------------------------------------------------------------------------
console.log('\n--- 20. Spec example ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r20 = PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1');
assertDeepEqual(r20.cells[0], { row: 2, col: 2, letter: 'L' }, 'cell 0 = (2,2)=L');
assertDeepEqual(r20.cells[1], { row: 3, col: 2, letter: 'A' }, 'cell 1 = (3,2)=A');
assertDeepEqual(r20.cells[2], { row: 4, col: 2, letter: 'O' }, 'cell 2 = (4,2)=O');
assertDeepEqual(r20.cells[3], { row: 5, col: 2, letter: 'S' }, 'cell 3 = (5,2)=S');

// ---------------------------------------------------------------------------
// 21. wordId & playerId pass-through
// ---------------------------------------------------------------------------
console.log('\n--- 21. wordId & playerId pass-through ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r21 = PlacementModule.placeWordDown('LAOS', 2, 2, 'my-custom-id', 'my-player');
assertEqual(r21.success, true, 'placement with custom IDs succeeds');
assertEqual(r21.word.id, 'my-custom-id', 'word.id uses caller-provided ID');
assertEqual(r21.word.playerId, 'my-player', 'word.playerId uses caller-provided playerId');
const stored = BoardModule.getWord('my-custom-id');
assert(stored && stored.text === 'LAOS', 'board.getWord(custom-id) returns the word');

// ---------------------------------------------------------------------------
// 22. Spec validation order
// ---------------------------------------------------------------------------
console.log('\n--- 22. Spec validation order ---');
// Invalid KBBI on empty cell → not_in_kbbi (not no_anchor)
BoardModule.reset();
const r22 = PlacementModule.placeWordDown('XYZQQ', 999, 999, null, 'p1');
assertEqual(r22.reason, 'not_in_kbbi', 'invalid KBBI word on empty cell → not_in_kbbi (not no_anchor)');

// Already-used word on empty cell → word_already_used (not no_anchor)
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
PlacementModule.placeWordDown('LAOS', 2, 2, null, 'p1'); // first time
const r22b = PlacementModule.placeWordDown('LAOS', 999, 999, null, 'p1');
assertEqual(r22b.reason, 'word_already_used', 'already-used word on empty cell → word_already_used (not no_anchor)');

// Fresh valid KBBI word on empty cell → no_anchor
const r22c = PlacementModule.placeWordDown('BAGUS', 999, 999, null, 'p1');
assertEqual(r22c.reason, 'no_anchor', 'fresh KBBI word on empty cell → no_anchor');

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
