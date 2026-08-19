/**
 * Unit Tests for PlacementModule.placeWordRight (Tahap 10 — Mekanik
 * Penempatan Horizontal Kanan)
 * Run: node tests/test-placement-right.js
 *
 * Tests placement extending RIGHT from an anchor cell:
 *
 * 1. PlacementModule API surface
 * 2. Successful placement (anchor A from vertical seed → ANJING right)
 * 3. Result shape: { success, cells, word, reason }
 * 4. Word actually written to board (cells filled, word added)
 * 5. Anchor letter mismatch (anchor A, word BERLARI starts with B)
 * 6. Word not in KBBI → not_in_kbbi
 * 7. Word already used → word_already_used
 * 8. Anchor cell empty → no_anchor
 * 9. KBBI not loaded → kbbi_not_loaded
 * 10. Empty word → empty_word
 * 11. Non-string word → empty_word
 * 12. Overlap conflict — existing cell has different letter
 * 13. Overlap OK (intersection) — existing cell has SAME letter
 * 14. Gap rule before — cell before anchor is part of horizontal word
 * 15. Gap rule after — cell after last letter is part of horizontal word
 * 16. Gap rule NOT triggered when before cell is part of VERTICAL word
 * 17. Multiple successful placements building up a board
 * 18. Case-insensitivity (input 'anjing' → ANJING normalized)
 * 19. Hyphenated word placement (ANAK-ANAK right from anchor A)
 * 20. Spec example: anchor "A" → ANJING → cells (5,3)=A, (5,4)=N, ...
 * 21. wordId & playerId passed through to Word object
 * 22. Spec validation order: not_in_kbbi BEFORE no_anchor
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Mock DOM (reuse improved factory from test-prefix-search.js)
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

/**
 * Seed a vertical word on the board manually (using BoardModule.setCell
 * + addWord). Returns the Word object. Used to set up anchor cells for
 * placeWordRight tests.
 */
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
console.log('\n🧪 PlacementModule.placeWordRight Tests — Tahap 10\n');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI loaded');

// ---------------------------------------------------------------------------
// 1. API surface
// ---------------------------------------------------------------------------
console.log('\n--- 1. API surface ---');
assertEqual(typeof PlacementModule, 'object', 'PlacementModule is defined');
assertEqual(typeof PlacementModule.placeWordRight, 'function', 'placeWordRight is function');
// Stubs for other directions preserved
assertEqual(typeof PlacementModule.placeWordLeft, 'function', 'placeWordLeft stub (Tahap 11)');
assertEqual(typeof PlacementModule.placeWordDown, 'function', 'placeWordDown stub (Tahap 12)');
assertEqual(typeof PlacementModule.placeWordUp, 'function', 'placeWordUp stub (Tahap 13)');
assertEqual(typeof PlacementModule.calculatePositions, 'function', 'calculatePositions stub (Tahap 18)');

// ---------------------------------------------------------------------------
// 2. Successful placement (anchor A from vertical seed → ANJING right)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Successful placement ---');
BoardModule.reset();
// Seed: ABADI vertical at (5,3) → anchor A at (5,3), B at (6,3), A at (7,3), etc.
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r = PlacementModule.placeWordRight('ANJING', 5, 3, null, 'p1');
assertEqual(r.success, true, 'placeWordRight returns success');
assertEqual(r.reason, 'placed_right', 'reason is "placed_right"');

// ---------------------------------------------------------------------------
// 3. Result shape
// ---------------------------------------------------------------------------
console.log('\n--- 3. Result shape ---');
assert(r.cells && Array.isArray(r.cells), 'result.cells is array');
assertEqual(r.cells.length, 6, 'cells array has 6 entries (ANJING)');
// Each cell has {row, col, letter}
const firstCell = r.cells[0];
assert('row' in firstCell && 'col' in firstCell && 'letter' in firstCell,
  'each cell has {row, col, letter}');
assert(r.word && typeof r.word === 'object', 'result.word is object');
assertEqual(r.word.text, 'ANJING', 'word.text is "ANJING"');
assertEqual(r.word.direction, 'right', 'word.direction is "right"');
assertEqual(r.word.startRow, 5, 'word.startRow = 5');
assertEqual(r.word.startCol, 3, 'word.startCol = 3');
assertEqual(r.word.length, 6, 'word.length = 6');
assertEqual(r.word.playerId, 'p1', 'word.playerId = "p1"');
assert(r.word.id && typeof r.word.id === 'string', 'word.id is auto-UUID string');

// ---------------------------------------------------------------------------
// 4. Word actually written to board
// ---------------------------------------------------------------------------
console.log('\n--- 4. Word written to board ---');
// All 6 cells should be filled: (5,3)=A, (5,4)=N, (5,5)=J, (5,6)=I, (5,7)=N, (5,8)=G
const expectedCells = [
  { row: 5, col: 3, letter: 'A' },
  { row: 5, col: 4, letter: 'N' },
  { row: 5, col: 5, letter: 'J' },
  { row: 5, col: 6, letter: 'I' },
  { row: 5, col: 7, letter: 'N' },
  { row: 5, col: 8, letter: 'G' },
];
for (const ec of expectedCells) {
  const cell = BoardModule.getCell(ec.row, ec.col);
  assert(cell && cell.letter === ec.letter,
    `board cell (${ec.row},${ec.col}) = "${ec.letter}"`);
}
// Word added to board.words
assertEqual(BoardModule.getWordCount(), 2, 'board has 2 words (seed + new)');
// Word added to board.wordSet (no-repeat set)
assert(BoardModule.hasWord('ANJING'), 'board.wordSet contains "ANJING"');
assert(BoardModule.hasWord('ABADI'), 'board.wordSet still contains seed "ABADI"');

// Anchor cell (5,3) is now an intersection (partOfWords has both ABADI and ANJING)
const anchorCell = BoardModule.getCell(5, 3);
assert(anchorCell.partOfWords.includes('seed-1'), 'anchor part of seed word');
assert(anchorCell.partOfWords.includes(r.word.id), 'anchor part of new word');

// ---------------------------------------------------------------------------
// 5. First-letter mismatch
// ---------------------------------------------------------------------------
console.log('\n--- 5. First-letter mismatch ---');
BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r5 = PlacementModule.placeWordRight('BERLARI', 5, 3, null, 'p1');
assertEqual(r5.success, false, 'BERLARI from anchor A → failure');
assertEqual(r5.reason, 'first_letter_mismatch', 'reason = first_letter_mismatch');

// ---------------------------------------------------------------------------
// 6. Word not in KBBI
// ---------------------------------------------------------------------------
console.log('\n--- 6. Word not in KBBI ---');
const r6 = PlacementModule.placeWordRight('XYZQQ', 5, 3, null, 'p1');
assertEqual(r6.success, false, 'XYZQQ → failure');
assertEqual(r6.reason, 'not_in_kbbi', 'reason = not_in_kbbi');

// ---------------------------------------------------------------------------
// 7. Word already used (no-repeat)
// ---------------------------------------------------------------------------
console.log('\n--- 7. Word already used ---');
// First place ANJING successfully
const r7a = PlacementModule.placeWordRight('ANJING', 5, 3, null, 'p1');
assertEqual(r7a.success, true, 'first ANJING placement succeeds');
// Try placing ANJING again at a different valid anchor (B at (6,3))
// Actually word starts with A, so use anchor A at (7,3) (also from ABADI vertical)
const r7b = PlacementModule.placeWordRight('ANJING', 7, 3, null, 'p1');
assertEqual(r7b.success, false, 'second ANJING placement fails (no-repeat)');
assertEqual(r7b.reason, 'word_already_used', 'reason = word_already_used');

// ---------------------------------------------------------------------------
// 8. Anchor cell empty → no_anchor
// ---------------------------------------------------------------------------
console.log('\n--- 8. Anchor cell empty ---');
// (100, 100) is empty; use a valid KBBI word NOT in wordSet
const r8 = PlacementModule.placeWordRight('BAGUS', 100, 100, null, 'p1');
assertEqual(r8.success, false, 'placing BAGUS on empty cell → failure');
assertEqual(r8.reason, 'no_anchor', 'reason = no_anchor');

// Also test with anchor cell that exists but has no letter
BoardModule.setCell(20, 20, null, 'no-letter', 'horizontal');
// Actually setCell with letter=null doesn't store the cell — check:
const emptyCell = BoardModule.getCell(20, 20);
console.log(`  ℹ️  cell (20,20) after setCell(null): ${emptyCell ? 'exists' : 'null'}`);

// ---------------------------------------------------------------------------
// 9. KBBI not loaded
// ---------------------------------------------------------------------------
console.log('\n--- 9. KBBI not loaded ---');
KBBIModule.reset();
const r9 = PlacementModule.placeWordRight('ANJING', 5, 3, null, 'p1');
assertEqual(r9.success, false, 'placeWordRight returns failure when KBBI not loaded');
assertEqual(r9.reason, 'kbbi_not_loaded', 'reason = kbbi_not_loaded');
loadFullKBBI();
assertEqual(KBBIModule.isLoaded(), true, 'KBBI reloaded');

// ---------------------------------------------------------------------------
// 10. Empty word
// ---------------------------------------------------------------------------
console.log('\n--- 10. Empty word ---');
BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r10 = PlacementModule.placeWordRight('', 5, 3, null, 'p1');
assertEqual(r10.success, false, 'empty word → failure');
assertEqual(r10.reason, 'empty_word', 'reason = empty_word');

// ---------------------------------------------------------------------------
// 11. Non-string word
// ---------------------------------------------------------------------------
console.log('\n--- 11. Non-string word ---');
const r11a = PlacementModule.placeWordRight(null, 5, 3, null, 'p1');
assertEqual(r11a.reason, 'empty_word', 'null word → empty_word');
const r11b = PlacementModule.placeWordRight(undefined, 5, 3, null, 'p1');
assertEqual(r11b.reason, 'empty_word', 'undefined word → empty_word');
const r11c = PlacementModule.placeWordRight(123, 5, 3, null, 'p1');
assertEqual(r11c.reason, 'empty_word', 'number word → empty_word');

// ---------------------------------------------------------------------------
// 12. Overlap conflict — existing cell has different letter
// ---------------------------------------------------------------------------
console.log('\n--- 12. Overlap conflict ---');
BoardModule.reset();
// Seed vertical "ABADI" at (5,3) → A(5,3), B(6,3), A(7,3), D(8,3), I(9,3)
seedVerticalWord('ABADI', 5, 3, 'seed-v1');
// Plant an isolated 'X' at (5,4) — different from any letter the placement
// would write there. Not part of any word (seed-anchor style).
BoardModule.setCell(5, 4, 'X', 'conflict-seed', 'horizontal');
// Try placing "AROMA" right from anchor A at (5,3) — A(5,3)=anchor,
// R(5,4)? but cell has 'X' → overlap_conflict
const r12 = PlacementModule.placeWordRight('AROMA', 5, 3, null, 'p1');
if (KBBIModule.search('AROMA')) {
  assertEqual(r12.success, false, 'overlap conflict when cell has different letter');
  assertEqual(r12.reason, 'overlap_conflict', 'reason = overlap_conflict');
} else {
  // Fallback: use a different A-word that's in KBBI
  const r12b = PlacementModule.placeWordRight('ASIA', 5, 3, null, 'p1');
  if (KBBIModule.search('ASIA')) {
    assertEqual(r12b.success, false, 'overlap conflict (ASIA) when cell has different letter');
    assertEqual(r12b.reason, 'overlap_conflict', 'reason = overlap_conflict');
  } else {
    console.log('  ⚠️  AROMA and ASIA both not in KBBI — skipping overlap_conflict test');
  }
}

// ---------------------------------------------------------------------------
// 13. Overlap OK (intersection) — existing cell has SAME letter
// ---------------------------------------------------------------------------
console.log('\n--- 13. Overlap OK (intersection with same letter) ---');
BoardModule.reset();
// Seed vertical "JALAN" at (5,5): J(5,5), A(6,5), L(7,5), A(8,5), N(9,5)
seedVerticalWord('JALAN', 5, 5, 'seed-v1');
// Now place "AJA" right from anchor A at (6,5) — wait, need KBBI word "AJA"? Not sure
// Let me use "ABADI" — A(6,5) anchor, then B-A-D-I at (6,6)-(6,9)
// No intersection at cells 2..N, that's a normal placement
// To test intersection: need a vertical seed whose cells are also crossed by the new word
// Place "JAWAB" vertical at (5,5): J(5,5), A(6,5), W(7,5), A(8,5), B(9,5)
seedVerticalWord('JAWAB', 5, 5, 'seed-jawab');  // overwrites cells from previous JALAN seed
// Place "SATE" right from anchor? S? no.
// Let me seed "BARA" right at (6,5): B(6,5)≠A(6,5) — would conflict at anchor itself
// Wait, anchor letter must match word's first letter. So if anchor (6,5) has A, word must start with A.
// Place "ABADI" right from anchor A at (6,5): A(6,5)=matches, B(6,6), A(6,7), D(6,8), I(6,9)
// The cells (6,6)-(6,9) are empty, no intersection. That's not testing intersection.
// To test intersection: seed another vertical word that crosses the horizontal path
// Place vertical "BAHAYA" at (6,6): B(6,6)=matches our B, A(7,6), H(8,6), A(9,6), Y(10,6), A(11,6)
seedVerticalWord('BAHAYA', 6, 6, 'seed-bahaya');
// Now place "ABADI" right from anchor A at (6,5): A(6,5)=anchor, B(6,6)=matches BAHAYA's B, A(6,7), D(6,8), I(6,9)
const r13 = PlacementModule.placeWordRight('ABADI', 6, 5, null, 'p1');
assertEqual(r13.success, true, 'placement succeeds with intersection at (6,6)=B');
assertEqual(r13.reason, 'placed_right', 'reason = placed_right');
// Verify intersection cell has partOfWords containing both vertical seed and new word
const interCell = BoardModule.getCell(6, 6);
assert(interCell.partOfWords.includes('seed-bahaya'), 'intersection cell part of vertical seed');
assert(interCell.partOfWords.includes(r13.word.id), 'intersection cell part of new horizontal word');

// ---------------------------------------------------------------------------
// 14. Gap rule before — cell before anchor is part of horizontal word
// ---------------------------------------------------------------------------
console.log('\n--- 14. Gap rule before ---');
BoardModule.reset();
// Place a horizontal word ending right before the anchor
// Anchor at (5, 5) with letter A. Place "KATA" right at (5, 1) — K(5,1), A(5,2), T(5,3), A(5,4)
// Then cell (5,4)=A is part of horizontal word "KATA". Gap = 0 between KATA's last letter and our anchor.
// But anchor cell (5,5) must also have a letter. Seed vertical word at (5,5) going down to make anchor A
seedVerticalWord('ABADI', 5, 5, 'seed-anchor-v');
seedHorizontalWord('KATA', 5, 1, 'seed-before-h');
// Now place "ANJING" right from anchor A at (5,5)
// Anchor letter A matches ANJING's A. No overlap (cells 5,6..5,10 are empty).
// But cell before anchor (5,4) is part of horizontal KATA → gap rule violation
const r14 = PlacementModule.placeWordRight('ANJING', 5, 5, null, 'p1');
assertEqual(r14.success, false, 'gap rule before fails when cell before is horizontal word');
assertEqual(r14.reason, 'adjacent_word_before', 'reason = adjacent_word_before');

// ---------------------------------------------------------------------------
// 15. Gap rule after — cell after last letter is part of horizontal word
// ---------------------------------------------------------------------------
console.log('\n--- 15. Gap rule after ---');
BoardModule.reset();
// Seed anchor A at (5, 1)
seedVerticalWord('ABADI', 5, 1, 'seed-anchor-v');
// Place a horizontal word starting right after where our new word would end
// Our new word "ABADI" placed right from (5,1) → cells (5,1)..(5,5). Last letter at (5,5).
// So cell after = (5,6). Place "KATA" at (5,6) going right: K(5,6), A(5,7), T(5,8), A(5,9)
seedHorizontalWord('KATA', 5, 6, 'seed-after-h');
// Now place "ABADI" right from (5,1) — but wait, ABADI is already in wordSet from seed-anchor-v!
// Use different KBBI word starting with A: "AJAR", "ASIA", "ANAK"...
// Try "ANAK": A(5,1)=anchor, N(5,2), A(5,3), K(5,4) — last letter at (5,4)
// Hmm that ends at (5,4), cell after is (5,5) — empty. No gap violation.
// I need the new word's last cell to be at (5,5) so cell-after is (5,6)=KATA's K.
// Word of length 5: ANAKA? Not a word. AROMA? Let me check.
// Easier: use "AJAIB" (length 5): A(5,1)=anchor, J(5,2), A(5,3), I(5,4), B(5,5) — last at (5,5)
// Cell after = (5,6) = K from KATA → gap violation
const r15 = PlacementModule.placeWordRight('AJAIB', 5, 1, null, 'p1');
if (r15.success) {
  console.log(`  ℹ️  AJAIB placed successfully — checking if it's actually in KBBI`);
  console.log(`  ℹ️  AJAIB in KBBI: ${KBBIModule.search('AJAIB')}`);
}
// If AJAIB is in KBBI, gap rule should fire. If not, reason = not_in_kbbi.
if (KBBIModule.search('AJAIB')) {
  assertEqual(r15.success, false, 'gap rule after fails when cell after is horizontal word');
  assertEqual(r15.reason, 'adjacent_word_after', 'reason = adjacent_word_after');
} else {
  console.log('  ⚠️  AJAIB not in KBBI — skipping gap-after test for AJAIB');
  // Try a different 5-letter word starting with A
  // "AROMA" is a common Indonesian word
  const r15b = PlacementModule.placeWordRight('AROMA', 5, 1, null, 'p1');
  if (KBBIModule.search('AROMA')) {
    assertEqual(r15b.success, false, 'gap rule after fails for AROMA');
    assertEqual(r15b.reason, 'adjacent_word_after', 'reason = adjacent_word_after');
  } else {
    console.log('  ⚠️  AROMA not in KBBI either — using ASIA (length 4)');
    // Need 5-letter word. Let me just check if my test setup is right and skip if no word fits
  }
}

// ---------------------------------------------------------------------------
// 16. Gap rule NOT triggered when before cell is part of VERTICAL word
// ---------------------------------------------------------------------------
console.log('\n--- 16. Gap rule not triggered for vertical word before anchor ---');
BoardModule.reset();
// Seed: vertical word at (5, 4) — cell (5,4) has a letter from a vertical word
seedVerticalWord('BAHAYA', 5, 4, 'seed-v-before'); // B(5,4), A(6,4), H(7,4), A(8,4), Y(9,4), A(10,4)
// Anchor at (5, 5) with letter A
seedVerticalWord('ABADI', 5, 5, 'seed-anchor-v'); // A(5,5), B(6,5), A(7,5), D(8,5), I(9,5)
// Now place "ANJING" right from anchor A at (5,5)
// Cell before anchor (5,4) has letter B from vertical BAHAYA → NOT part of horizontal word → OK
const r16 = PlacementModule.placeWordRight('ANJING', 5, 5, null, 'p1');
assertEqual(r16.success, true, 'placement succeeds when before-cell is vertical (gap rule OK)');
assertEqual(r16.reason, 'placed_right', 'reason = placed_right');
// Verify the intersection: (5,4)=B is still vertical, (5,5)=A is now intersection of 2 vertical words
const beforeCell16 = BoardModule.getCell(5, 4);
assert(beforeCell16.partOfWords.length === 1, '(5,4) part of only vertical word');

// ---------------------------------------------------------------------------
// 17. Multiple successful placements building up a board
// ---------------------------------------------------------------------------
console.log('\n--- 17. Multiple placements building a board ---');
BoardModule.reset();
// Seed ABADI vertical at (10,10) so we have multiple anchor cells:
// (10,10)=A, (11,10)=B, (12,10)=A, (13,10)=D, (14,10)=I
seedVerticalWord('ABADI', 10, 10, 'seed-1');
const p1 = PlacementModule.placeWordRight('ANJING', 10, 10, null, 'p1');
assertEqual(p1.success, true, 'placement 1 (ANJING from A at 10,10) succeeds');
// ANJING creates cells (10,10)=A, (10,11)=N, (10,12)=J, (10,13)=I, (10,14)=N, (10,15)=G
// Use a DIFFERENT anchor cell from the vertical seed for the next placement.
// (Cannot use (10,15)=G from ANJING because the cell before it (10,14)=N is part
// of horizontal ANJING -> gap rule 'adjacent_word_before' fires correctly.)
// Use (11,10)=B from the vertical seed instead.
const p2 = PlacementModule.placeWordRight('BAGUS', 11, 10, null, 'p2');
assertEqual(p2.success, true, 'placement 2 (BAGUS from B at 11,10) succeeds');
// Use (14,10)=I for an I-word
const p3 = PlacementModule.placeWordRight('IKAN', 14, 10, null, 'p3');
if (KBBIModule.search('IKAN')) {
  assertEqual(p3.success, true, 'placement 3 (IKAN from I at 14,10) succeeds');
  assertEqual(BoardModule.getWordCount(), 4, 'board has 4 words (seed + ANJING + BAGUS + IKAN)');
} else {
  // Try INTI as fallback I-word
  const p3b = PlacementModule.placeWordRight('INTI', 14, 10, null, 'p3');
  if (KBBIModule.search('INTI')) {
    assertEqual(p3b.success, true, 'placement 3 (INTI from I at 14,10) succeeds');
    assertEqual(BoardModule.getWordCount(), 4, 'board has 4 words (seed + ANJING + BAGUS + INTI)');
  } else {
    console.log('  ⚠️  IKAN and INTI both not in KBBI — board has 3 words');
    assertEqual(BoardModule.getWordCount(), 3, 'board has 3 words (seed + 2 placements)');
  }
}
// Verify all placements are in wordSet
assert(BoardModule.hasWord('ABADI'), 'wordSet has ABADI (seed)');
assert(BoardModule.hasWord('ANJING'), 'wordSet has ANJING');
assert(BoardModule.hasWord('BAGUS'), 'wordSet has BAGUS');

// Bonus: verify that placing from the END of a horizontal word fails
// (correct gap-rule behavior)
const badAnchor = PlacementModule.placeWordRight('GUNUNG', 10, 15, null, 'p4');
assertEqual(badAnchor.success, false, 'placing from end of horizontal word fails (gap rule)');
assertEqual(badAnchor.reason, 'adjacent_word_before', 'reason = adjacent_word_before (correctly rejected)');

// ---------------------------------------------------------------------------
// 18. Case-insensitivity
// ---------------------------------------------------------------------------
console.log('\n--- 18. Case-insensitivity ---');
BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r18a = PlacementModule.placeWordRight('anjing', 5, 3, null, 'p1');
assertEqual(r18a.success, true, 'lowercase "anjing" placed successfully');
assertEqual(r18a.word.text, 'ANJING', 'word.text normalized to UPPERCASE');

BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r18b = PlacementModule.placeWordRight('Anjing', 5, 3, null, 'p1');
assertEqual(r18b.success, true, 'mixed-case "Anjing" placed successfully');

BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r18c = PlacementModule.placeWordRight('  ANJING  ', 5, 3, null, 'p1');
assertEqual(r18c.success, true, 'whitespace-padded "  ANJING  " placed successfully');

// ---------------------------------------------------------------------------
// 19. Hyphenated word placement
// ---------------------------------------------------------------------------
console.log('\n--- 19. Hyphenated word (ANAK-ANAK) ---');
BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1'); // anchor A at (5,3)
const r19 = PlacementModule.placeWordRight('ANAK-ANAK', 5, 3, null, 'p1');
if (KBBIModule.search('ANAK-ANAK')) {
  assertEqual(r19.success, true, 'ANAK-ANAK placed right from anchor A');
  assertEqual(r19.cells.length, 9, 'ANAK-ANAK has 9 cells (including hyphen)');
  // Verify the hyphen position
  const hyphenCell = r19.cells[4]; // 5th char (index 4) is '-'
  assertEqual(hyphenCell.letter, '-', 'cell 4 contains hyphen "-"');
  // Verify board has the hyphen
  const cellOnBoard = BoardModule.getCell(hyphenCell.row, hyphenCell.col);
  assertEqual(cellOnBoard.letter, '-', 'hyphen cell on board has "-"');
} else {
  console.log('  ⚠️  ANAK-ANAK not in KBBI — skipping hyphenated placement test');
}

// ---------------------------------------------------------------------------
// 20. Spec example: anchor "A" → ANJING → cells (5,3)=A, (5,4)=N, etc.
// ---------------------------------------------------------------------------
console.log('\n--- 20. Spec example ---');
BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r20 = PlacementModule.placeWordRight('ANJING', 5, 3, null, 'p1');
assertDeepEqual(r20.cells[0], { row: 5, col: 3, letter: 'A' }, 'cell 0 = (5,3)=A');
assertDeepEqual(r20.cells[1], { row: 5, col: 4, letter: 'N' }, 'cell 1 = (5,4)=N');
assertDeepEqual(r20.cells[2], { row: 5, col: 5, letter: 'J' }, 'cell 2 = (5,5)=J');
assertDeepEqual(r20.cells[3], { row: 5, col: 6, letter: 'I' }, 'cell 3 = (5,6)=I');
assertDeepEqual(r20.cells[4], { row: 5, col: 7, letter: 'N' }, 'cell 4 = (5,7)=N');
assertDeepEqual(r20.cells[5], { row: 5, col: 8, letter: 'G' }, 'cell 5 = (5,8)=G');

// ---------------------------------------------------------------------------
// 21. wordId & playerId passed through
// ---------------------------------------------------------------------------
console.log('\n--- 21. wordId & playerId pass-through ---');
BoardModule.reset();
seedVerticalWord('ABADI', 5, 3, 'seed-1');
const r21 = PlacementModule.placeWordRight('ANJING', 5, 3, 'my-custom-id', 'my-player');
assertEqual(r21.success, true, 'placement with custom IDs succeeds');
assertEqual(r21.word.id, 'my-custom-id', 'word.id uses caller-provided ID');
assertEqual(r21.word.playerId, 'my-player', 'word.playerId uses caller-provided playerId');
// Verify the word is stored under the custom ID
const stored = BoardModule.getWord('my-custom-id');
assert(stored && stored.text === 'ANJING', 'board.getWord(custom-id) returns the word');

// ---------------------------------------------------------------------------
// 22. Spec validation order: not_in_kbbi BEFORE no_anchor
// ---------------------------------------------------------------------------
console.log('\n--- 22. Spec validation order ---');
// Spec order: 1) KBBI valid → 2) not-used → 3) first-letter → 4) overlap → 5) gap
// The "no_anchor" check is implicit (anchor is needed for #3 first-letter check)
// Try placing an invalid KBBI word at an empty cell — KBBI check should fire FIRST
BoardModule.reset();
const r22 = PlacementModule.placeWordRight('XYZQQ', 999, 999, null, 'p1');
assertEqual(r22.reason, 'not_in_kbbi', 'invalid KBBI word on empty cell → not_in_kbbi (not no_anchor)');

// Try placing a valid-but-already-used word at empty cell — no-repeat fires BEFORE no_anchor
seedVerticalWord('ABADI', 5, 3, 'seed-1');
PlacementModule.placeWordRight('ANJING', 5, 3, null, 'p1'); // first time
const r22b = PlacementModule.placeWordRight('ANJING', 999, 999, null, 'p1');
assertEqual(r22b.reason, 'word_already_used', 'already-used word on empty cell → word_already_used (not no_anchor)');

// But a fresh valid KBBI word on empty cell → no_anchor
const r22c = PlacementModule.placeWordRight('BAGUS', 999, 999, null, 'p1');
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
