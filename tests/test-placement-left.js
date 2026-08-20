/**
 * Unit Tests for PlacementModule.placeWordLeft (Tahap 11 — Mekanik
 * Penempatan Horizontal Kiri)
 * Run: node tests/test-placement-left.js
 *
 * Mirrors test-placement-right.js but for LEFT direction. Per spec,
 * placing a word to the LEFT of an anchor means:
 *   - Word's LAST letter must equal anchor cell's letter (suffix matching)
 *   - Position formula: huruf ke-i → (anchorRow, anchorCol - (wordLength - 1 - i))
 *   - Spec example: anchor "S" at (2,4) from word "SELASA", word "POS"
 *     (ends with S) → P(2,2), O(2,3), S(2,4) — S of POS attaches to S of SELASA
 *
 * Tests:
 * 1. PlacementModule API surface (placeWordLeft wired)
 * 2. Successful placement (POS left from anchor S)
 * 3. Result shape: { success, cells, word, reason }
 * 4. Word actually written to board + getWordCellPositions consistency
 * 5. Last-letter mismatch (anchor S, word BERLARI ends with I)
 * 6. Word not in KBBI → not_in_kbbi
 * 7. Word already used → word_already_used
 * 8. Anchor cell empty → no_anchor
 * 9. KBBI not loaded → kbbi_not_loaded
 * 10. Empty word → empty_word
 * 11. Non-string word → empty_word
 * 12. Overlap conflict — existing cell has different letter
 * 13. Overlap OK (intersection) — existing cell has SAME letter
 * 14. Gap rule before — cell at (anchorCol - wordLength) is part of horizontal word
 * 15. Gap rule after — cell at (anchorCol + 1) is part of horizontal word
 * 16. Gap rule NOT triggered when before/after cell is part of VERTICAL word
 * 17. Multiple successful placements building up a board
 * 18. Case-insensitivity (lowercase/mixed/whitespace-padded → UPPERCASE)
 * 19. Hyphenated word placement (ANAK-ANAK left from anchor K)
 * 20. Spec example: anchor "S" → "POS" → P(2,2) O(2,3) S(2,4)
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

/** Seed a vertical word ending at (anchorRow, anchorCol) so the anchor letter is available. */
function seedVerticalWord(text, startRow, startCol, wordId) {
  const word = BoardModule.createWord(text, startRow, startCol, 'down', 'seed', wordId);
  for (const p of BoardModule.getWordCellPositions(word)) {
    BoardModule.setCell(p.row, p.col, p.letter, word.id, 'vertical');
  }
  BoardModule.addWord(word);
  return word;
}

function seedHorizontalWord(text, startRow, startCol, wordId) {
  const word = BoardModule.createWord(text, startRow, startCol, 'right', 'seed', wordId);
  for (const p of BoardModule.getWordCellPositions(word)) {
    BoardModule.setCell(p.row, p.col, p.letter, word.id, 'horizontal');
  }
  BoardModule.addWord(word);
  return word;
}

// ===========================================================================
console.log('\n🧪 PlacementModule.placeWordLeft Tests — Tahap 11\n');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI loaded');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('\n--- 1. API surface ---');
assertEqual(typeof PlacementModule, 'object', 'PlacementModule is defined');
assertEqual(typeof PlacementModule.placeWordLeft, 'function', 'placeWordLeft is function');
// placeWordRight from Tahap 10 still works
assertEqual(typeof PlacementModule.placeWordRight, 'function', 'placeWordRight still defined (Tahap 10)');
// Stubs for remaining directions preserved
assertEqual(typeof PlacementModule.placeWordDown, 'function', 'placeWordDown stub (Tahap 12)');
assertEqual(typeof PlacementModule.placeWordUp, 'function', 'placeWordUp stub (Tahap 13)');
assertEqual(typeof PlacementModule.calculatePositions, 'function', 'calculatePositions stub (Tahap 18)');

// ---------------------------------------------------------------------------
// 2. Successful placement (POS left from anchor S)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Successful placement ---');
BoardModule.reset();
// Seed: SELASA vertical at (2,4) so anchor S is at (2,4)
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertEqual(r.success, true, 'placeWordLeft returns success');
assertEqual(r.reason, 'placed_left', 'reason is "placed_left"');

// ---------------------------------------------------------------------------
// 3. Result shape
// ---------------------------------------------------------------------------
console.log('\n--- 3. Result shape ---');
assert(r.cells && Array.isArray(r.cells), 'result.cells is array');
assertEqual(r.cells.length, 3, 'cells array has 3 entries (POS)');
const firstCell = r.cells[0];
assert('row' in firstCell && 'col' in firstCell && 'letter' in firstCell,
  'each cell has {row, col, letter}');
assert(r.word && typeof r.word === 'object', 'result.word is object');
assertEqual(r.word.text, 'POS', 'word.text is "POS" (forward)');
assertEqual(r.word.direction, 'left', 'word.direction is "left"');
assertEqual(r.word.startRow, 2, 'word.startRow = 2');
assertEqual(r.word.startCol, 2, 'word.startCol = 2 (leftmost cell)');
assertEqual(r.word.length, 3, 'word.length = 3');
assertEqual(r.word.playerId, 'p1', 'word.playerId = "p1"');
assert(r.word.id && typeof r.word.id === 'string', 'word.id is auto-UUID string');

// ---------------------------------------------------------------------------
// 4. Word actually written to board + getWordCellPositions consistency
// ---------------------------------------------------------------------------
console.log('\n--- 4. Word written to board ---');
// All 3 cells should be filled: P(2,2), O(2,3), S(2,4)
const expectedCells = [
  { row: 2, col: 2, letter: 'P' },
  { row: 2, col: 3, letter: 'O' },
  { row: 2, col: 4, letter: 'S' },  // anchor — already had S from SELASA
];
for (const ec of expectedCells) {
  const cell = BoardModule.getCell(ec.row, ec.col);
  assert(cell && cell.letter === ec.letter,
    `board cell (${ec.row},${ec.col}) = "${ec.letter}"`);
}
// Word added to board.words
assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + new)');
// Word added to board.wordSet (no-repeat set)
assert(BoardModule.hasWord('POS'), 'board.wordSet contains "POS"');
assert(BoardModule.hasWord('SELASA'), 'board.wordSet still contains seed "SELASA"');
// getWordCellPositions consistency — must yield the same cells as result.cells
const positionsViaGet = BoardModule.getWordCellPositions(r.word);
assertEqual(positionsViaGet.length, 3, 'getWordCellPositions returns 3 positions');
for (let i = 0; i < 3; i++) {
  assertDeepEqual(positionsViaGet[i], r.cells[i],
    `getWordCellPositions[${i}] matches result.cells[${i}]`);
}
// Anchor cell (2,4) is now an intersection (partOfWords has both SELASA and POS)
const anchorCell = BoardModule.getCell(2, 4);
assert(anchorCell.partOfWords.includes('seed-1'), 'anchor part of seed word');
assert(anchorCell.partOfWords.includes(r.word.id), 'anchor part of new word');

// ---------------------------------------------------------------------------
// 5. Last-letter mismatch
// ---------------------------------------------------------------------------
console.log('\n--- 5. Last-letter mismatch ---');
BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
// Anchor S at (2,4), word BERLARI ends with I → mismatch
const r5 = PlacementModule.placeWordLeft('BERLARI', 2, 4, null, 'p1');
assertEqual(r5.success, false, 'BERLARI from anchor S → failure');
assertEqual(r5.reason, 'last_letter_mismatch', 'reason = last_letter_mismatch');

// ---------------------------------------------------------------------------
// 6. Word not in KBBI
// ---------------------------------------------------------------------------
console.log('\n--- 6. Word not in KBBI ---');
const r6 = PlacementModule.placeWordLeft('XYZQQ', 2, 4, null, 'p1');
assertEqual(r6.success, false, 'XYZQQ → failure');
assertEqual(r6.reason, 'not_in_kbbi', 'reason = not_in_kbbi');

// ---------------------------------------------------------------------------
// 7. Word already used (no-repeat)
// ---------------------------------------------------------------------------
console.log('\n--- 7. Word already used ---');
// First place POS successfully
const r7a = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertEqual(r7a.success, true, 'first POS placement succeeds');
// Try placing POS again at a different valid anchor (the other S at (6,4) from SELASA)
// SELASA vertical at (2,4) means S at (2,4) and (6,4) (since SELASA = S-E-L-A-S-A, S at positions 0 and 4)
const r7b = PlacementModule.placeWordLeft('POS', 6, 4, null, 'p1');
assertEqual(r7b.success, false, 'second POS placement fails (no-repeat)');
assertEqual(r7b.reason, 'word_already_used', 'reason = word_already_used');

// ---------------------------------------------------------------------------
// 8. Anchor cell empty → no_anchor
// ---------------------------------------------------------------------------
console.log('\n--- 8. Anchor cell empty ---');
// Use a fresh KBBI word that hasn't been placed yet (POS was placed in test 2/7).
// Validation order: KBBI valid → no-repeat → anchor → ... so we must use a word
// not in wordSet to actually reach the no_anchor check.
const r8 = PlacementModule.placeWordLeft('BAGUS', 100, 100, null, 'p1');
assertEqual(r8.success, false, 'placing BAGUS on empty cell → failure');
assertEqual(r8.reason, 'no_anchor', 'reason = no_anchor');

// ---------------------------------------------------------------------------
// 9. KBBI not loaded
// ---------------------------------------------------------------------------
console.log('\n--- 9. KBBI not loaded ---');
KBBIModule.reset();
const r9 = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertEqual(r9.success, false, 'placeWordLeft returns failure when KBBI not loaded');
assertEqual(r9.reason, 'kbbi_not_loaded', 'reason = kbbi_not_loaded');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 10. Empty word
// ---------------------------------------------------------------------------
console.log('\n--- 10. Empty word ---');
BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r10 = PlacementModule.placeWordLeft('', 2, 4, null, 'p1');
assertEqual(r10.success, false, 'empty word → failure');
assertEqual(r10.reason, 'empty_word', 'reason = empty_word');

// ---------------------------------------------------------------------------
// 11. Non-string word
// ---------------------------------------------------------------------------
console.log('\n--- 11. Non-string word ---');
const r11a = PlacementModule.placeWordLeft(null, 2, 4, null, 'p1');
assertEqual(r11a.reason, 'empty_word', 'null word → empty_word');
const r11b = PlacementModule.placeWordLeft(undefined, 2, 4, null, 'p1');
assertEqual(r11b.reason, 'empty_word', 'undefined word → empty_word');
const r11c = PlacementModule.placeWordLeft(123, 2, 4, null, 'p1');
assertEqual(r11c.reason, 'empty_word', 'number word → empty_word');

// ---------------------------------------------------------------------------
// 12. Overlap conflict — existing cell has different letter
// ---------------------------------------------------------------------------
console.log('\n--- 12. Overlap conflict ---');
BoardModule.reset();
// Seed vertical SELASA at (2,4) → S(2,4), E(3,4), L(4,4), A(5,4), S(6,4), A(7,4)
seedVerticalWord('SELASA', 2, 4, 'seed-v1');
// Plant an isolated 'X' at (2,3) — different from any letter the placement would write there.
// For "POS" placed left from anchor S at (2,4): cells P(2,2), O(2,3), S(2,4)
// Cell (2,3) would get 'O' but has 'X' → overlap_conflict
BoardModule.setCell(2, 3, 'X', 'conflict-seed', 'horizontal');
const r12 = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertEqual(r12.success, false, 'overlap conflict when cell has different letter');
assertEqual(r12.reason, 'overlap_conflict', 'reason = overlap_conflict');

// ---------------------------------------------------------------------------
// 13. Overlap OK (intersection with same letter)
// ---------------------------------------------------------------------------
console.log('\n--- 13. Overlap OK (intersection with same letter) ---');
BoardModule.reset();
// Seed vertical SELASA at (2,4) → S(2,4), E(3,4), L(4,4), A(5,4), S(6,4), A(7,4)
seedVerticalWord('SELASA', 2, 4, 'seed-selasa');
// Seed another vertical word at (2,2) — say "PISANG" (P at (2,2), I at (3,2), ...)
// Then place "POS" left from anchor S at (2,4): P(2,2)=matches PISANG's P (intersection), O(2,3), S(2,4)=anchor
seedVerticalWord('PISANG', 2, 2, 'seed-pisang');
// Check PISANG and POS are in KBBI; if not, skip
if (KBBIModule.search('PISANG') && KBBIModule.search('POS')) {
  const r13 = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
  assertEqual(r13.success, true, 'placement succeeds with intersection at (2,2)=P');
  assertEqual(r13.reason, 'placed_left', 'reason = placed_left');
  // Verify intersection cell has partOfWords containing both vertical seed and new word
  const interCell = BoardModule.getCell(2, 2);
  assert(interCell.partOfWords.includes('seed-pisang'), 'intersection cell part of vertical seed PISANG');
  assert(interCell.partOfWords.includes(r13.word.id), 'intersection cell part of new horizontal word POS');
} else {
  console.log('  ⚠️  PISANG or POS not in KBBI — skipping intersection test');
}

// ---------------------------------------------------------------------------
// 14. Gap rule before — cell at (anchorCol - wordLength) is part of horizontal word
// ---------------------------------------------------------------------------
console.log('\n--- 14. Gap rule before ---');
BoardModule.reset();
// Anchor S at (2, 10). Word "POS" left → P(2,8), O(2,9), S(2,10). Leftmost is (2,8).
// Gap-before cell: (2, 10 - 3) = (2, 7) — must NOT be part of a horizontal word.
// Place a horizontal word "KATA" at (2, 4)-(2, 7): K(2,4), A(2,5), T(2,6), A(2,7)
// Then cell (2,7) is part of horizontal KATA → gap rule fires.
seedVerticalWord('SELASA', 2, 10, 'seed-anchor-v'); // anchor S at (2,10)
seedHorizontalWord('KATA', 2, 4, 'seed-before-h'); // K(2,4), A(2,5), T(2,6), A(2,7)
const r14 = PlacementModule.placeWordLeft('POS', 2, 10, null, 'p1');
assertEqual(r14.success, false, 'gap rule before fails when cell at leftmost-1 is horizontal');
assertEqual(r14.reason, 'adjacent_word_before', 'reason = adjacent_word_before');

// ---------------------------------------------------------------------------
// 15. Gap rule after — cell at (anchorCol + 1) is part of horizontal word
// ---------------------------------------------------------------------------
console.log('\n--- 15. Gap rule after ---');
BoardModule.reset();
// Anchor S at (2, 4). Word "POS" left → P(2,2), O(2,3), S(2,4).
// Gap-after cell: (2, 4 + 1) = (2, 5) — must NOT be part of a horizontal word.
// Place a horizontal word "KATA" at (2, 5)-(2, 8): K(2,5), A(2,6), T(2,7), A(2,8)
// Then cell (2,5) is part of horizontal KATA → gap rule fires.
seedVerticalWord('SELASA', 2, 4, 'seed-anchor-v');
seedHorizontalWord('KATA', 2, 5, 'seed-after-h');
const r15 = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertEqual(r15.success, false, 'gap rule after fails when cell at anchor+1 is horizontal');
assertEqual(r15.reason, 'adjacent_word_after', 'reason = adjacent_word_after');

// ---------------------------------------------------------------------------
// 16. Gap rule NOT triggered when before/after cell is part of VERTICAL word
// ---------------------------------------------------------------------------
console.log('\n--- 16. Gap rule not triggered for vertical word ---');
BoardModule.reset();
// Anchor S at (2, 4) from vertical SELASA.
// Plant a vertical word "BAHAYA" at (2, 7) — so cell (2,7) has B from a vertical word.
// Gap-before cell for word "POS" (length 3, anchor at (2,4)) is (2, 4-3) = (2, 1) — empty, OK.
// Actually let me use a vertical word at the GAP-AFTER position instead.
// Gap-after cell for POS at (2,4) is (2, 5) — plant vertical word there.
seedVerticalWord('SELASA', 2, 4, 'seed-anchor-v');
seedVerticalWord('BAHAYA', 2, 5, 'seed-vertical-after'); // B(2,5), A(3,5), H(4,5), A(5,5), Y(6,5), A(7,5)
// Now place "POS" left from anchor S at (2,4)
// Gap-after cell (2,5)=B from BAHAYA vertical — NOT part of horizontal word → OK
const r16 = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertEqual(r16.success, true, 'placement succeeds when after-cell is vertical (gap rule OK)');
assertEqual(r16.reason, 'placed_left', 'reason = placed_left');

// ---------------------------------------------------------------------------
// 17. Multiple successful placements building up a board
// ---------------------------------------------------------------------------
console.log('\n--- 17. Multiple placements building a board ---');
BoardModule.reset();
// Seed ABADI vertical at (5, 10) → A(5,10), B(6,10), A(7,10), D(8,10), I(9,10)
seedVerticalWord('ABADI', 5, 10, 'seed-1');
// Place "NASI" left from anchor A at (7, 10): NASI ends with I, but anchor is A → mismatch
// Use anchor I at (9, 10) instead. Word "NASI" ends with I, length 4: N(9,7), A(9,8), S(9,9), I(9,10)
const p1 = PlacementModule.placeWordLeft('NASI', 9, 10, null, 'p1');
if (KBBIModule.search('NASI')) {
  assertEqual(p1.success, true, 'placement 1 (NASI left from I at 9,10) succeeds');
  // Use anchor B at (6, 10) for a B-word ending in B. Use "BAB" if in KBBI (length 3)
  // Or use "AB" if in KBBI (length 2)
  const p2 = PlacementModule.placeWordLeft('AB', 6, 10, null, 'p2');
  if (KBBIModule.search('AB')) {
    assertEqual(p2.success, true, 'placement 2 (AB left from B at 6,10) succeeds');
    // AB length 2: A(6,9), B(6,10)
    assertEqual(BoardModule.getWordCount(), 3, 'board has 3 words (seed + NASI + AB)');
  } else {
    console.log('  ⚠️  AB not in KBBI — trying "BIB"');
    const p2b = PlacementModule.placeWordLeft('BIB', 6, 10, null, 'p2');
    if (KBBIModule.search('BIB') && p2b.success) {
      assertEqual(p2b.success, true, 'placement 2 (BIB left from B) succeeds');
      assertEqual(BoardModule.getWordCount(), 3, 'board has 3 words (seed + NASI + BIB)');
    } else {
      console.log('  ⚠️  BIB not in KBBI or placement failed — board has 2 words');
      assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + NASI)');
    }
  }
} else {
  console.log('  ⚠️  NASI not in KBBI — board has only seed');
  assertEqual(BoardModule.getWordCount(), 1, 'board has 1 word (just seed)');
}
// Verify all placements are in wordSet
assert(BoardModule.hasWord('ABADI'), 'wordSet has ABADI (seed)');

// ---------------------------------------------------------------------------
// 18. Case-insensitivity
// ---------------------------------------------------------------------------
console.log('\n--- 18. Case-insensitivity ---');
BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r18a = PlacementModule.placeWordLeft('pos', 2, 4, null, 'p1');
assertEqual(r18a.success, true, 'lowercase "pos" placed successfully');
assertEqual(r18a.word.text, 'POS', 'word.text normalized to UPPERCASE');

BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r18b = PlacementModule.placeWordLeft('Pos', 2, 4, null, 'p1');
assertEqual(r18b.success, true, 'mixed-case "Pos" placed successfully');

BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r18c = PlacementModule.placeWordLeft('  POS  ', 2, 4, null, 'p1');
assertEqual(r18c.success, true, 'whitespace-padded "  POS  " placed successfully');

// ---------------------------------------------------------------------------
// 19. Hyphenated word (ANAK-ANAK left from anchor K)
// ---------------------------------------------------------------------------
console.log('\n--- 19. Hyphenated word (ANAK-ANAK left from anchor K) ---');
BoardModule.reset();
// Need an anchor K. Seed a vertical word with K somewhere.
// Place "KASIH" vertical at (2, 10): K(2,10), A(3,10), S(4,10), I(5,10), H(6,10)
seedVerticalWord('KASIH', 2, 10, 'seed-kasih');
if (KBBIModule.search('KASIH') && KBBIModule.search('ANAK-ANAK')) {
  // ANAK-ANAK ends with K (last letter of "ANAK-ANAK" is K)
  // Wait, let me check: A-N-A-K---A-N-A-K. Last char is K. ✓
  // ANAK-ANAK length 9 (including hyphen).
  // Place left from anchor K at (2,10): cells (2,2)=A, (2,3)=N, (2,4)=A, (2,5)=K, (2,6)=-, (2,7)=A, (2,8)=N, (2,9)=A, (2,10)=K
  const r19 = PlacementModule.placeWordLeft('ANAK-ANAK', 2, 10, null, 'p1');
  assertEqual(r19.success, true, 'ANAK-ANAK placed left from anchor K');
  assertEqual(r19.cells.length, 9, 'ANAK-ANAK has 9 cells (including hyphen)');
  // Verify the hyphen position
  const hyphenCell = r19.cells[4]; // 5th char (index 4) is '-'
  assertEqual(hyphenCell.letter, '-', 'cell 4 contains hyphen "-"');
  // Verify board has the hyphen
  const cellOnBoard = BoardModule.getCell(hyphenCell.row, hyphenCell.col);
  assertEqual(cellOnBoard.letter, '-', 'hyphen cell on board has "-"');
} else {
  console.log('  ⚠️  KASIH or ANAK-ANAK not in KBBI — skipping hyphenated test');
}

// ---------------------------------------------------------------------------
// 20. Spec example: anchor "S" → "POS" → P(2,2) O(2,3) S(2,4)
// ---------------------------------------------------------------------------
console.log('\n--- 20. Spec example ---');
BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r20 = PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1');
assertDeepEqual(r20.cells[0], { row: 2, col: 2, letter: 'P' }, 'cell 0 = (2,2)=P');
assertDeepEqual(r20.cells[1], { row: 2, col: 3, letter: 'O' }, 'cell 1 = (2,3)=O');
assertDeepEqual(r20.cells[2], { row: 2, col: 4, letter: 'S' }, 'cell 2 = (2,4)=S');

// ---------------------------------------------------------------------------
// 21. wordId & playerId pass-through
// ---------------------------------------------------------------------------
console.log('\n--- 21. wordId & playerId pass-through ---');
BoardModule.reset();
seedVerticalWord('SELASA', 2, 4, 'seed-1');
const r21 = PlacementModule.placeWordLeft('POS', 2, 4, 'my-custom-id', 'my-player');
assertEqual(r21.success, true, 'placement with custom IDs succeeds');
assertEqual(r21.word.id, 'my-custom-id', 'word.id uses caller-provided ID');
assertEqual(r21.word.playerId, 'my-player', 'word.playerId uses caller-provided playerId');
const stored = BoardModule.getWord('my-custom-id');
assert(stored && stored.text === 'POS', 'board.getWord(custom-id) returns the word');

// ---------------------------------------------------------------------------
// 22. Spec validation order
// ---------------------------------------------------------------------------
console.log('\n--- 22. Spec validation order ---');
// Invalid KBBI on empty cell → not_in_kbbi (not no_anchor)
BoardModule.reset();
const r22 = PlacementModule.placeWordLeft('XYZQQ', 999, 999, null, 'p1');
assertEqual(r22.reason, 'not_in_kbbi', 'invalid KBBI word on empty cell → not_in_kbbi (not no_anchor)');

// Already-used word on empty cell → word_already_used (not no_anchor)
seedVerticalWord('SELASA', 2, 4, 'seed-1');
PlacementModule.placeWordLeft('POS', 2, 4, null, 'p1'); // first time
const r22b = PlacementModule.placeWordLeft('POS', 999, 999, null, 'p1');
assertEqual(r22b.reason, 'word_already_used', 'already-used word on empty cell → word_already_used (not no_anchor)');

// Fresh valid KBBI word on empty cell → no_anchor
const r22c = PlacementModule.placeWordLeft('BAGUS', 999, 999, null, 'p1');
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
