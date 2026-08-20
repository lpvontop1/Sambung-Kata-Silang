/**
 * Unit Tests for PlacementModule.placeWordUp (Tahap 13 — Mekanik
 * Penempatan Vertikal Atas)
 * Run: node tests/test-placement-up.js
 *
 * Mirrors test-placement-left.js but for UP direction. Per spec,
 * placing a word UPWARD from an anchor means:
 *   - Word's LAST letter must equal anchor cell's letter (suffix matching,
 *     SAME as placeWordLeft — just vertical instead of horizontal)
 *   - Position formula: huruf ke-i → (anchorRow - (wordLength - 1 - i), anchorCol)
 *   - Spec example: anchor "E" at (2,1) from word "SELASA" (horizontal),
 *     word "ENDE" (ends with E) → E(-1,1), N(0,1), D(1,1), E(2,1)=anchor
 *   - Negative row indices are supported (the cells Map allows any integer keys).
 *
 * Tests:
 * 1. PlacementModule API surface (placeWordUp wired; all 3 previous still work)
 * 2. Successful placement (ENDE up from anchor E; negative row indices)
 * 3. Result shape: { success, cells, word, reason }
 * 4. Word actually written to board + getWordCellPositions consistency
 * 5. Last-letter mismatch (anchor E, word BERLARI ends with I)
 * 6. Word not in KBBI → not_in_kbbi
 * 7. Word already used → word_already_used
 * 8. Anchor cell empty → no_anchor
 * 9. KBBI not loaded → kbbi_not_loaded
 * 10. Empty word → empty_word
 * 11. Non-string word → empty_word
 * 12. Overlap conflict — existing cell has different letter
 * 13. Overlap OK (intersection) — existing cell has SAME letter
 *     (vertical-up word crossing horizontal word)
 * 14. Gap rule before — cell above topmost is part of vertical word
 * 15. Gap rule after — cell below anchor (bottommost) is part of vertical word
 * 16. Gap rule NOT triggered when above/below cell is part of HORIZONTAL word
 * 17. Multiple successful placements building up a board
 * 18. Case-insensitivity (lowercase/mixed/whitespace-padded → UPPERCASE)
 * 19. Hyphenated word placement (ANAK-ANAK up from anchor K)
 * 20. Spec example: anchor "E" → "ENDE" → E(-1,1) N(0,1) D(1,1) E(2,1)
 * 21. wordId & playerId passed through to Word object
 * 22. Spec validation order: not_in_kbbi BEFORE no_anchor; word_already_used BEFORE no_anchor
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (same as previous placement tests)
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

/** Seed a horizontal word so anchor cells are available for vertical-up placement. */
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
console.log('\n🧪 PlacementModule.placeWordUp Tests — Tahap 13\n');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI loaded');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('\n--- 1. API surface ---');
assertEqual(typeof PlacementModule, 'object', 'PlacementModule is defined');
assertEqual(typeof PlacementModule.placeWordUp, 'function', 'placeWordUp is function');
// All 3 previous placement functions still work
assertEqual(typeof PlacementModule.placeWordRight, 'function', 'placeWordRight still defined (Tahap 10)');
assertEqual(typeof PlacementModule.placeWordLeft, 'function', 'placeWordLeft still defined (Tahap 11)');
assertEqual(typeof PlacementModule.placeWordDown, 'function', 'placeWordDown still defined (Tahap 12)');
// Only calculatePositions remains as stub
assertEqual(typeof PlacementModule.calculatePositions, 'function', 'calculatePositions stub (Tahap 18)');

// ---------------------------------------------------------------------------
// 2. Successful placement (ENDE up from anchor E)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Successful placement ---');
BoardModule.reset();
// Seed: SELASA horizontal at (2,0): S(2,0) E(2,1) L(2,2) A(2,3) S(2,4) A(2,5)
// Anchor E at (2,1)
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
// ENDE ends with E. If ENDE is in KBBI, the placement should succeed.
const endeInKBBI = KBBIModule.search('ENDE');
if (endeInKBBI) {
  const r = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  assertEqual(r.success, true, 'placeWordUp returns success');
  assertEqual(r.reason, 'placed_up', 'reason is "placed_up"');
} else {
  console.log('  ⚠️  ENDE not in KBBI — using alternative E-ending word');
  // Try a different E-ending word: "CINTA"? ends with A. "MAAF"? ends with F.
  // Use "PASSE"? Not a word. "MEMBE"? Not standard.
  // "KASIH" ends with H. Let me use anchor "A" from SELASA (A at (2,3) and (2,5))
  // and place an A-ending word like "CINTA" (ends with A)
  const cintaInKBBI = KBBIModule.search('CINTA');
  if (cintaInKBBI) {
    const r = PlacementModule.placeWordUp('CINTA', 2, 3, null, 'p1');
    assertEqual(r.success, true, 'placeWordUp returns success (CINTA from anchor A)');
    assertEqual(r.reason, 'placed_up', 'reason is "placed_up"');
  } else {
    console.log('  ⚠️  CINTA also not in KBBI — skipping success test');
  }
}

// ---------------------------------------------------------------------------
// 3. Result shape
// ---------------------------------------------------------------------------
console.log('\n--- 3. Result shape ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
if (endeInKBBI) {
  const r = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  assert(r.cells && Array.isArray(r.cells), 'result.cells is array');
  assertEqual(r.cells.length, 4, 'cells array has 4 entries (ENDE)');
  const firstCell = r.cells[0];
  assert('row' in firstCell && 'col' in firstCell && 'letter' in firstCell,
    'each cell has {row, col, letter}');
  assert(r.word && typeof r.word === 'object', 'result.word is object');
  assertEqual(r.word.text, 'ENDE', 'word.text is "ENDE"');
  assertEqual(r.word.direction, 'up', 'word.direction is "up"');
  assertEqual(r.word.startRow, -1, 'word.startRow = -1 (topmost cell; supports negative)');
  assertEqual(r.word.startCol, 1, 'word.startCol = 1 (anchor col)');
  assertEqual(r.word.length, 4, 'word.length = 4');
  assertEqual(r.word.playerId, 'p1', 'word.playerId = "p1"');
  assert(r.word.id && typeof r.word.id === 'string', 'word.id is auto-UUID string');
}

// ---------------------------------------------------------------------------
// 4. Word actually written to board + getWordCellPositions consistency
// ---------------------------------------------------------------------------
console.log('\n--- 4. Word written to board ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
if (endeInKBBI) {
  const r = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  // All 4 cells should be filled: E(-1,1), N(0,1), D(1,1), E(2,1)=anchor
  const expectedCells = [
    { row: -1, col: 1, letter: 'E' },  // topmost (negative row index)
    { row: 0, col: 1, letter: 'N' },
    { row: 1, col: 1, letter: 'D' },
    { row: 2, col: 1, letter: 'E' },  // anchor — already had E from SELASA
  ];
  for (const ec of expectedCells) {
    const cell = BoardModule.getCell(ec.row, ec.col);
    assert(cell && cell.letter === ec.letter,
      `board cell (${ec.row},${ec.col}) = "${ec.letter}"`);
  }
  // Word added to board.words
  assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + new)');
  // Word added to board.wordSet
  assert(BoardModule.hasWord('ENDE'), 'board.wordSet contains "ENDE"');
  assert(BoardModule.hasWord('SELASA'), 'board.wordSet still contains seed "SELASA"');
  // getWordCellPositions consistency — must yield the same cells as result.cells
  const positionsViaGet = BoardModule.getWordCellPositions(r.word);
  assertEqual(positionsViaGet.length, 4, 'getWordCellPositions returns 4 positions');
  for (let i = 0; i < 4; i++) {
    assertDeepEqual(positionsViaGet[i], r.cells[i],
      `getWordCellPositions[${i}] matches result.cells[${i}]`);
  }
  // Anchor cell (2,1) is now an intersection (partOfWords has both SELASA and ENDE)
  const anchorCell = BoardModule.getCell(2, 1);
  assert(anchorCell.partOfWords.includes('seed-1'), 'anchor part of seed word SELASA');
  assert(anchorCell.partOfWords.includes(r.word.id), 'anchor part of new word ENDE');
}

// ---------------------------------------------------------------------------
// 5. Last-letter mismatch
// ---------------------------------------------------------------------------
console.log('\n--- 5. Last-letter mismatch ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
// Anchor E at (2,1), word BERLARI ends with I → mismatch
const r5 = PlacementModule.placeWordUp('BERLARI', 2, 1, null, 'p1');
assertEqual(r5.success, false, 'BERLARI from anchor E → failure');
assertEqual(r5.reason, 'last_letter_mismatch', 'reason = last_letter_mismatch');

// ---------------------------------------------------------------------------
// 6. Word not in KBBI
// ---------------------------------------------------------------------------
console.log('\n--- 6. Word not in KBBI ---');
const r6 = PlacementModule.placeWordUp('XYZQQ', 2, 1, null, 'p1');
assertEqual(r6.success, false, 'XYZQQ → failure');
assertEqual(r6.reason, 'not_in_kbbi', 'reason = not_in_kbbi');

// ---------------------------------------------------------------------------
// 7. Word already used (no-repeat)
// ---------------------------------------------------------------------------
console.log('\n--- 7. Word already used ---');
if (endeInKBBI) {
  // First place ENDE successfully
  const r7a = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  assertEqual(r7a.success, true, 'first ENDE placement succeeds');
  // Try placing ENDE again at a different cell — should fail with word_already_used
  // (because wordSet already contains ENDE; the no-repeat check fires before anchor check)
  const r7b = PlacementModule.placeWordUp('ENDE', 999, 999, null, 'p1');
  assertEqual(r7b.success, false, 'second ENDE placement fails (no-repeat)');
  assertEqual(r7b.reason, 'word_already_used', 'reason = word_already_used');
} else {
  console.log('  ⚠️  ENDE not in KBBI — skipping no-repeat test');
}

// ---------------------------------------------------------------------------
// 8. Anchor cell empty → no_anchor
// ---------------------------------------------------------------------------
console.log('\n--- 8. Anchor cell empty ---');
// Use a fresh KBBI word not in wordSet
const r8 = PlacementModule.placeWordUp('BAGUS', 100, 100, null, 'p1');
assertEqual(r8.success, false, 'placing BAGUS on empty cell → failure');
assertEqual(r8.reason, 'no_anchor', 'reason = no_anchor');

// ---------------------------------------------------------------------------
// 9. KBBI not loaded
// ---------------------------------------------------------------------------
console.log('\n--- 9. KBBI not loaded ---');
KBBIModule.reset();
const r9 = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
assertEqual(r9.success, false, 'placeWordUp returns failure when KBBI not loaded');
assertEqual(r9.reason, 'kbbi_not_loaded', 'reason = kbbi_not_loaded');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 10. Empty word
// ---------------------------------------------------------------------------
console.log('\n--- 10. Empty word ---');
BoardModule.reset();
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
const r10 = PlacementModule.placeWordUp('', 2, 1, null, 'p1');
assertEqual(r10.success, false, 'empty word → failure');
assertEqual(r10.reason, 'empty_word', 'reason = empty_word');

// ---------------------------------------------------------------------------
// 11. Non-string word
// ---------------------------------------------------------------------------
console.log('\n--- 11. Non-string word ---');
const r11a = PlacementModule.placeWordUp(null, 2, 1, null, 'p1');
assertEqual(r11a.reason, 'empty_word', 'null word → empty_word');
const r11b = PlacementModule.placeWordUp(undefined, 2, 1, null, 'p1');
assertEqual(r11b.reason, 'empty_word', 'undefined word → empty_word');
const r11c = PlacementModule.placeWordUp(123, 2, 1, null, 'p1');
assertEqual(r11c.reason, 'empty_word', 'number word → empty_word');

// ---------------------------------------------------------------------------
// 12. Overlap conflict — existing cell has different letter
// ---------------------------------------------------------------------------
console.log('\n--- 12. Overlap conflict ---');
BoardModule.reset();
// Seed horizontal SELASA at (2,0): S(2,0) E(2,1) L(2,2) A(2,3) S(2,4) A(2,5)
seedHorizontalWord('SELASA', 2, 0, 'seed-h1');
// Plant an isolated 'X' at (1, 1) — different from any letter the placement would write there.
// For ENDE placed up from anchor E at (2,1): cells E(-1,1), N(0,1), D(1,1), E(2,1)
// Cell (1,1) would get 'D' but has 'X' → overlap_conflict
BoardModule.setCell(1, 1, 'X', 'conflict-seed', 'vertical');
if (endeInKBBI) {
  const r12 = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  assertEqual(r12.success, false, 'overlap conflict when cell has different letter');
  assertEqual(r12.reason, 'overlap_conflict', 'reason = overlap_conflict');
}

// ---------------------------------------------------------------------------
// 13. Overlap OK (intersection with same letter) — vertical-up crosses horizontal
// ---------------------------------------------------------------------------
console.log('\n--- 13. Overlap OK (intersection with same letter) ---');
BoardModule.reset();
// Seed horizontal SELASA at (2,0)
seedHorizontalWord('SELASA', 2, 0, 'seed-selasa');
// Seed another horizontal word "AXGX" at (0, 0): A(0,0) X(0,1) G(0,2) X(0,3)
// Then place "ENDE" up from anchor E at (2,1): cells E(-1,1), N(0,1), D(1,1), E(2,1)
// At (0,1), the existing cell has X (from AXGX); ENDE would write N → overlap_conflict
// Use a horizontal word that has 'N' at (0,1). Use "MNOP" (not real but seeds cells): M(0,0) N(0,1) O(0,2) P(0,3)
seedHorizontalWord('MNOP', 0, 0, 'seed-mnop');  // M(0,0) N(0,1) O(0,2) P(0,3)
// Now place "ENDE" up from anchor E at (2,1): cells E(-1,1), N(0,1)=matches MNOP's N, D(1,1), E(2,1)
if (endeInKBBI) {
  const r13 = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  assertEqual(r13.success, true, 'placement succeeds with intersection at (0,1)=N');
  assertEqual(r13.reason, 'placed_up', 'reason = placed_up');
  // Verify intersection cell has partOfWords containing both horizontal seed and new word
  const interCell = BoardModule.getCell(0, 1);
  assert(interCell.partOfWords.includes('seed-mnop'), 'intersection cell part of horizontal seed MNOP');
  assert(interCell.partOfWords.includes(r13.word.id), 'intersection cell part of new vertical-up word ENDE');
}

// ---------------------------------------------------------------------------
// 14. Gap rule before — cell above topmost is part of vertical word
// ---------------------------------------------------------------------------
console.log('\n--- 14. Gap rule before ---');
BoardModule.reset();
// Anchor at (10, 5). Word "ENDE" up → E(7,5), N(8,5), D(9,5), E(10,5)=anchor.
// Topmost is (7, 5). Gap-before cell: (7 - 1, 5) = (6, 5) — must NOT be part of vertical word.
// Place a vertical word "KASIH" at (1, 5)-(5, 5) going down: K(1,5) A(2,5) S(3,5) I(4,5) H(5,5)
// Wait, that ends at (5,5), not (6,5). To put a vertical cell at (6,5), we need a vertical word at (6,5)-(10,5) going down — but that would conflict with anchor at (10,5).
// Use a vertical word at (2, 5)-(6, 5) going down: K(2,5) A(3,5) S(4,5) I(5,5) H(6,5)
// Then cell (6,5) is part of vertical KASIH (ends at (6,5)). Cell (7,5) is empty (topmost of ENDE).
// Gap rule: cell (6,5) is BELOW topmost (7,5), so it's NOT the gap-before cell. Gap-before is (6,5).
// Wait let me re-check. For UP placement with anchor at (10,5), word length 4 (ENDE):
//   Topmost = anchor - (N-1) = 10 - 3 = 7
//   Gap-before (above topmost) = topmost - 1 = 6
//   Gap-after (below anchor) = anchor + 1 = 11
// So gap-before is (6, 5). Plant vertical KASIH at (2,5)-(6,5) so (6,5)=H is part of vertical KASIH.
seedVerticalWord('KASIH', 2, 5, 'seed-before-v');  // K(2,5) A(3,5) S(4,5) I(5,5) H(6,5)
// Plant anchor E at (10, 5) via horizontal seed
seedHorizontalWord('EFGH', 10, 5, 'seed-anchor-h');  // E(10,5) F(10,6) G(10,7) H(10,8)
if (endeInKBBI) {
  const r14 = PlacementModule.placeWordUp('ENDE', 10, 5, null, 'p1');
  assertEqual(r14.success, false, 'gap rule before fails when cell above topmost is vertical word');
  assertEqual(r14.reason, 'adjacent_word_before', 'reason = adjacent_word_before');
}

// ---------------------------------------------------------------------------
// 15. Gap rule after — cell below anchor (bottommost) is part of vertical word
// ---------------------------------------------------------------------------
console.log('\n--- 15. Gap rule after ---');
BoardModule.reset();
// Anchor E at (5, 5). Word "ENDE" up → E(2,5), N(3,5), D(4,5), E(5,5)=anchor.
// Gap-after cell: (5 + 1, 5) = (6, 5) — must NOT be part of vertical word.
// Plant vertical KASIH at (6, 5)-(10, 5) going down.
seedVerticalWord('KASIH', 6, 5, 'seed-after-v');  // K(6,5) A(7,5) S(8,5) I(9,5) H(10,5)
// Plant anchor E at (5, 5) via horizontal seed
seedHorizontalWord('EFGH', 5, 5, 'seed-anchor-h');  // E(5,5) F(5,6) G(5,7) H(5,8)
if (endeInKBBI) {
  const r15 = PlacementModule.placeWordUp('ENDE', 5, 5, null, 'p1');
  assertEqual(r15.success, false, 'gap rule after fails when cell below anchor is vertical word');
  assertEqual(r15.reason, 'adjacent_word_after', 'reason = adjacent_word_after');
}

// ---------------------------------------------------------------------------
// 16. Gap rule NOT triggered when above/below cell is part of HORIZONTAL word
// ---------------------------------------------------------------------------
console.log('\n--- 16. Gap rule not triggered for horizontal word above/below ---');
BoardModule.reset();
// Anchor E at (5, 5). Word "ENDE" up → E(2,5), N(3,5), D(4,5), E(5,5).
// Plant a horizontal word at (6, 5) — so cell (6,5) has a letter from a horizontal word.
// Since the gap rule for vertical placement only cares about VERTICAL words, the
// horizontal word at (6,5) should NOT trigger the gap rule.
seedHorizontalWord('EFGH', 5, 5, 'seed-anchor-h');  // E(5,5) F(5,6) G(5,7) H(5,8)
seedHorizontalWord('ABCD', 6, 4, 'seed-below-h');  // A(6,4) B(6,5) C(6,6) D(6,7)
// Cell (6,5) = B from horizontal ABCD. Below-anchor cell is (6,5) = part of horizontal word.
// Gap rule for vertical placement should NOT fire (only checks vertical adjacency).
if (endeInKBBI) {
  const r16 = PlacementModule.placeWordUp('ENDE', 5, 5, null, 'p1');
  assertEqual(r16.success, true, 'placement succeeds when below-cell is horizontal (gap rule OK for vertical)');
  assertEqual(r16.reason, 'placed_up', 'reason = placed_up');
}

// ---------------------------------------------------------------------------
// 17. Multiple successful placements building up a board
// ---------------------------------------------------------------------------
console.log('\n--- 17. Multiple placements building a board ---');
BoardModule.reset();
// Seed SELASA horizontal at (10, 0): S(10,0) E(10,1) L(10,2) A(10,3) S(10,4) A(10,5)
seedHorizontalWord('SELASA', 10, 0, 'seed-1');
// Place ENDE up from anchor E at (10, 1): E(7,1), N(8,1), D(9,1), E(10,1)=anchor
if (endeInKBBI) {
  const p1 = PlacementModule.placeWordUp('ENDE', 10, 1, null, 'p1');
  assertEqual(p1.success, true, 'placement 1 (ENDE up from E at 10,1) succeeds');
  // Use a DIFFERENT anchor cell from the horizontal seed for the next placement.
  // Use A at (10, 3) for an A-ending word going up.
  // "CINTA" ends with A — try it.
  if (KBBIModule.search('CINTA')) {
    const p2 = PlacementModule.placeWordUp('CINTA', 10, 3, null, 'p2');
    assertEqual(p2.success, true, 'placement 2 (CINTA up from A at 10,3) succeeds');
    // CINTA: C(6,3) I(7,3) N(8,3) T(9,3) A(10,3)=anchor
    assertEqual(BoardModule.getWordCount(), 3, 'board has 3 words (seed + ENDE + CINTA)');
  } else {
    console.log('  ⚠️  CINTA not in KBBI — board has 2 words (seed + ENDE)');
    assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + ENDE)');
  }
} else {
  console.log('  ⚠️  ENDE not in KBBI — skipping multiple placement test');
}
// Verify placements are in wordSet
assert(BoardModule.hasWord('SELASA'), 'wordSet has SELASA (seed)');

// ---------------------------------------------------------------------------
// 18. Case-insensitivity
// ---------------------------------------------------------------------------
console.log('\n--- 18. Case-insensitivity ---');
if (endeInKBBI) {
  BoardModule.reset();
  seedHorizontalWord('SELASA', 2, 0, 'seed-1');
  const r18a = PlacementModule.placeWordUp('ende', 2, 1, null, 'p1');
  assertEqual(r18a.success, true, 'lowercase "ende" placed successfully');
  assertEqual(r18a.word.text, 'ENDE', 'word.text normalized to UPPERCASE');

  BoardModule.reset();
  seedHorizontalWord('SELASA', 2, 0, 'seed-1');
  const r18b = PlacementModule.placeWordUp('Ende', 2, 1, null, 'p1');
  assertEqual(r18b.success, true, 'mixed-case "Ende" placed successfully');

  BoardModule.reset();
  seedHorizontalWord('SELASA', 2, 0, 'seed-1');
  const r18c = PlacementModule.placeWordUp('  ENDE  ', 2, 1, null, 'p1');
  assertEqual(r18c.success, true, 'whitespace-padded "  ENDE  " placed successfully');
}

// ---------------------------------------------------------------------------
// 19. Hyphenated word (ANAK-ANAK up from anchor K)
// ---------------------------------------------------------------------------
console.log('\n--- 19. Hyphenated word (ANAK-ANAK up from anchor K) ---');
BoardModule.reset();
// Need an anchor K. Seed a horizontal word with K somewhere.
// KASIH at (10, 0): K(10,0) A(10,1) S(10,2) I(10,3) H(10,4)
seedHorizontalWord('KASIH', 10, 0, 'seed-kasih');
if (KBBIModule.search('KASIH') && KBBIModule.search('ANAK-ANAK')) {
  // ANAK-ANAK ends with K (last char of "ANAK-ANAK" is K)
  // ANAK-ANAK length 9 (including hyphen).
  // Place up from anchor K at (10, 0): cells (2,0)=A, (3,0)=N, (4,0)=A, (5,0)=K, (6,0)=-, (7,0)=A, (8,0)=N, (9,0)=A, (10,0)=K
  const r19 = PlacementModule.placeWordUp('ANAK-ANAK', 10, 0, null, 'p1');
  assertEqual(r19.success, true, 'ANAK-ANAK placed up from anchor K');
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
// 20. Spec example: anchor "E" → "ENDE" → E(-1,1) N(0,1) D(1,1) E(2,1)
// ---------------------------------------------------------------------------
console.log('\n--- 20. Spec example ---');
if (endeInKBBI) {
  BoardModule.reset();
  seedHorizontalWord('SELASA', 2, 0, 'seed-1');
  const r20 = PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1');
  assertDeepEqual(r20.cells[0], { row: -1, col: 1, letter: 'E' }, 'cell 0 = (-1,1)=E (negative row)');
  assertDeepEqual(r20.cells[1], { row: 0, col: 1, letter: 'N' }, 'cell 1 = (0,1)=N');
  assertDeepEqual(r20.cells[2], { row: 1, col: 1, letter: 'D' }, 'cell 2 = (1,1)=D');
  assertDeepEqual(r20.cells[3], { row: 2, col: 1, letter: 'E' }, 'cell 3 = (2,1)=E (anchor)');
}

// ---------------------------------------------------------------------------
// 21. wordId & playerId pass-through
// ---------------------------------------------------------------------------
console.log('\n--- 21. wordId & playerId pass-through ---');
if (endeInKBBI) {
  BoardModule.reset();
  seedHorizontalWord('SELASA', 2, 0, 'seed-1');
  const r21 = PlacementModule.placeWordUp('ENDE', 2, 1, 'my-custom-id', 'my-player');
  assertEqual(r21.success, true, 'placement with custom IDs succeeds');
  assertEqual(r21.word.id, 'my-custom-id', 'word.id uses caller-provided ID');
  assertEqual(r21.word.playerId, 'my-player', 'word.playerId uses caller-provided playerId');
  const stored = BoardModule.getWord('my-custom-id');
  assert(stored && stored.text === 'ENDE', 'board.getWord(custom-id) returns the word');
}

// ---------------------------------------------------------------------------
// 22. Spec validation order
// ---------------------------------------------------------------------------
console.log('\n--- 22. Spec validation order ---');
// Invalid KBBI on empty cell → not_in_kbbi (not no_anchor)
BoardModule.reset();
const r22 = PlacementModule.placeWordUp('XYZQQ', 999, 999, null, 'p1');
assertEqual(r22.reason, 'not_in_kbbi', 'invalid KBBI word on empty cell → not_in_kbbi (not no_anchor)');

// Already-used word on empty cell → word_already_used (not no_anchor)
seedHorizontalWord('SELASA', 2, 0, 'seed-1');
if (endeInKBBI) {
  PlacementModule.placeWordUp('ENDE', 2, 1, null, 'p1'); // first time
  const r22b = PlacementModule.placeWordUp('ENDE', 999, 999, null, 'p1');
  assertEqual(r22b.reason, 'word_already_used', 'already-used word on empty cell → word_already_used (not no_anchor)');
}

// Fresh valid KBBI word on empty cell → no_anchor
const r22c = PlacementModule.placeWordUp('BAGUS', 999, 999, null, 'p1');
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
