/**
 * Unit Tests for BoardModule — Tahap 02
 * Run: node tests/test-board.js
 */

// Mock DOM environment for game.js
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ className: '', textContent: '', style: {}, appendChild: () => {}, remove: () => {}, addEventListener: () => {} }),
  documentElement: { style: { setProperty: () => {} } }
};
global.crypto = { randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 8) };

// Load game.js using vm to expose globals
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('game.js', 'utf8');
vm.runInThisContext(code);

// Test helpers
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
}

function assertDeepEqual(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}`);
}

// ============================================================
// TEST SUITE
// ============================================================
console.log('\n🧪 BoardModule Unit Tests — Tahap 02\n');

// --- 1. Board starts empty ---
console.log('--- 1. Initial State ---');
BoardModule.reset();
assertEqual(BoardModule.getCellCount(), 0, 'Empty board has 0 cells');
assertEqual(BoardModule.getWordCount(), 0, 'Empty board has 0 words');
assertEqual(BoardModule.getAllCells().length, 0, 'getAllCells returns empty array');
assert(BoardModule.toString() === '[Empty Board]', 'toString shows [Empty Board]');

// --- 2. getCell on empty board ---
console.log('--- 2. getCell on empty board ---');
assertEqual(BoardModule.getCell(0, 0), null, 'getCell(0,0) returns null on empty board');
assertEqual(BoardModule.getCell(5, 10), null, 'getCell(5,10) returns null on empty board');

// --- 3. isCellEmpty ---
console.log('--- 3. isCellEmpty ---');
assert(BoardModule.isCellEmpty(0, 0), 'isCellEmpty(0,0) is true on empty board');
assert(BoardModule.isCellEmpty(99, 99), 'isCellEmpty(99,99) is true on empty board');

// --- 4. getBounds on empty board ---
console.log('--- 4. getBounds on empty board ---');
const emptyBounds = BoardModule.getBounds();
assertEqual(emptyBounds.minRow, 0, 'Empty bounds minRow = 0');
assertEqual(emptyBounds.maxRow, 0, 'Empty bounds maxRow = 0');

// --- 5. setCell and getCell ---
console.log('--- 5. setCell and getCell ---');
BoardModule.reset();
BoardModule.setCell(2, 3, 'S', 'word1', 'horizontal');
const cell = BoardModule.getCell(2, 3);
assert(cell !== null, 'getCell returns non-null after setCell');
assertEqual(cell.letter, 'S', 'Cell letter is S');
assertEqual(cell.wordId, 'word1', 'Cell wordId is word1');
assertEqual(cell.direction, 'horizontal', 'Cell direction is horizontal');
assertDeepEqual(cell.partOfWords, ['word1'], 'Cell partOfWords is [word1]');
assert(!BoardModule.isCellEmpty(2, 3), 'isCellEmpty is false after setCell');

// --- 6. setCell intersection (same cell, different word) ---
console.log('--- 6. setCell intersection ---');
BoardModule.setCell(2, 3, 'S', 'word2', 'vertical');
const intersectCell = BoardModule.getCell(2, 3);
assertEqual(intersectCell.letter, 'S', 'Intersection cell letter stays S');
assertDeepEqual(intersectCell.partOfWords.sort(), ['word1', 'word2'].sort(), 'Intersection cell partOfWords has both wordIds');
assert(BoardModule.isIntersection(2, 3), 'isIntersection returns true for crossing cell');

// --- 7. getBounds with cells ---
console.log('--- 7. getBounds with cells ---');
BoardModule.reset();
BoardModule.setCell(0, 0, 'A', 'w1', 'horizontal');
BoardModule.setCell(0, 1, 'B', 'w1', 'horizontal');
BoardModule.setCell(0, 2, 'C', 'w1', 'horizontal');
BoardModule.setCell(1, 0, 'D', 'w2', 'vertical');
BoardModule.setCell(2, 0, 'E', 'w2', 'vertical');
const bounds = BoardModule.getBounds();
assertEqual(bounds.minRow, 0, 'Bounds minRow = 0');
assertEqual(bounds.maxRow, 2, 'Bounds maxRow = 2');
assertEqual(bounds.minCol, 0, 'Bounds minCol = 0');
assertEqual(bounds.maxCol, 2, 'Bounds maxCol = 2');

// --- 8. clearCell ---
console.log('--- 8. clearCell ---');
BoardModule.reset();
BoardModule.setCell(3, 3, 'X', 'w1', 'horizontal');
assert(!BoardModule.isCellEmpty(3, 3), 'Cell (3,3) is not empty before clear');
BoardModule.clearCell(3, 3);
assert(BoardModule.isCellEmpty(3, 3), 'Cell (3,3) is empty after clearCell');
assertEqual(BoardModule.getCell(3, 3), null, 'getCell returns null after clearCell');

// --- 9. clearCell with wordId (intersection) ---
console.log('--- 9. clearCell with wordId (intersection) ---');
BoardModule.reset();
BoardModule.setCell(5, 5, 'L', 'wordA', 'horizontal');
BoardModule.setCell(5, 5, 'L', 'wordB', 'vertical');
assert(BoardModule.isIntersection(5, 5), 'Cell is intersection before partial clear');
BoardModule.clearCell(5, 5, 'wordA');
const partialCell = BoardModule.getCell(5, 5);
assert(partialCell !== null, 'Cell still exists after partial clear');
assertDeepEqual(partialCell.partOfWords, ['wordB'], 'Cell partOfWords only has wordB');
assert(!BoardModule.isIntersection(5, 5), 'Cell is no longer intersection after partial clear');

// --- 10. createWord ---
console.log('--- 10. createWord ---');
const word = BoardModule.createWord('SELASA', 0, 0, 'right', 'player1');
assertEqual(word.text, 'SELASA', 'Word text is uppercase SELASA');
assertEqual(word.length, 6, 'Word length is 6');
assertEqual(word.startRow, 0, 'Word startRow is 0');
assertEqual(word.startCol, 0, 'Word startCol is 0');
assertEqual(word.direction, 'right', 'Word direction is right');
assertEqual(word.playerId, 'player1', 'Word playerId is player1');
assert(word.id.startsWith('word_'), 'Word ID starts with word_');

// --- 11. createWord with lowercase input ---
console.log('--- 11. createWord lowercase ---');
const wordLower = BoardModule.createWord('halo', 1, 2, 'down', 'p1');
assertEqual(wordLower.text, 'HALO', 'Word text auto-uppercased');

// --- 12. addWord and hasWord ---
console.log('--- 12. addWord and hasWord ---');
BoardModule.reset();
const w1 = BoardModule.createWord('SELASA', 0, 0, 'right', 'p1');
BoardModule.addWord(w1);
assert(BoardModule.hasWord('SELASA'), 'hasWord SELASA returns true');
assert(BoardModule.hasWord('selasa'), 'hasWord selasa (lowercase) returns true');
assert(!BoardModule.hasWord('ANJING'), 'hasWord ANJING returns false');
assertEqual(BoardModule.getWordCount(), 1, 'Word count is 1');

// --- 13. getWord ---
console.log('--- 13. getWord ---');
const retrieved = BoardModule.getWord(w1.id);
assertEqual(retrieved.text, 'SELASA', 'getWord returns correct word');
assertEqual(BoardModule.getWord('nonexistent'), undefined, 'getWord returns undefined for non-existent ID');

// --- 14. getWordCellPositions ---
console.log('--- 14. getWordCellPositions ---');
const wRight = BoardModule.createWord('ABCD', 2, 3, 'right', 'p1');
const posRight = BoardModule.getWordCellPositions(wRight);
assertEqual(posRight.length, 4, 'Right word has 4 positions');
assertDeepEqual(posRight[0], { row: 2, col: 3, letter: 'A' }, 'First position (right)');
assertDeepEqual(posRight[3], { row: 2, col: 6, letter: 'D' }, 'Last position (right)');

const wDown = BoardModule.createWord('XYZ', 1, 1, 'down', 'p1');
const posDown = BoardModule.getWordCellPositions(wDown);
assertDeepEqual(posDown[0], { row: 1, col: 1, letter: 'X' }, 'First position (down)');
assertDeepEqual(posDown[2], { row: 3, col: 1, letter: 'Z' }, 'Last position (down)');

const wLeft = BoardModule.createWord('POS', 5, 5, 'left', 'p1');
const posLeft = BoardModule.getWordCellPositions(wLeft);
assertDeepEqual(posLeft[0], { row: 5, col: 5, letter: 'P' }, 'First position (left)');
assertDeepEqual(posLeft[2], { row: 5, col: 3, letter: 'S' }, 'Last position (left)');

const wUp = BoardModule.createWord('ENDE', 4, 2, 'up', 'p1');
const posUp = BoardModule.getWordCellPositions(wUp);
assertDeepEqual(posUp[0], { row: 4, col: 2, letter: 'E' }, 'First position (up)');
assertDeepEqual(posUp[3], { row: 1, col: 2, letter: 'E' }, 'Last position (up)');

// --- 15. removeWord ---
console.log('--- 15. removeWord ---');
BoardModule.reset();
const rw1 = BoardModule.createWord('KATA', 0, 0, 'right', 'p1');
BoardModule.addWord(rw1);
for (const p of BoardModule.getWordCellPositions(rw1)) {
  BoardModule.setCell(p.row, p.col, p.letter, rw1.id, 'horizontal');
}
assertEqual(BoardModule.getCellCount(), 4, '4 cells after placing KATA');
BoardModule.removeWord(rw1.id);
assertEqual(BoardModule.getWordCount(), 0, '0 words after removeWord');
assert(!BoardModule.hasWord('KATA'), 'hasWord KATA is false after removeWord');
assertEqual(BoardModule.getCellCount(), 0, '0 cells after removing word');

// --- 16. removeWord preserves intersection cells ---
console.log('--- 16. removeWord preserves intersections ---');
BoardModule.reset();
const iw1 = BoardModule.createWord('SELASA', 0, 0, 'right', 'p1');
const iw2 = BoardModule.createWord('LAOS', 0, 2, 'down', 'p2');
BoardModule.addWord(iw1);
BoardModule.addWord(iw2);
for (const p of BoardModule.getWordCellPositions(iw1)) {
  BoardModule.setCell(p.row, p.col, p.letter, iw1.id, 'horizontal');
}
for (const p of BoardModule.getWordCellPositions(iw2)) {
  BoardModule.setCell(p.row, p.col, p.letter, iw2.id, 'vertical');
}
assert(BoardModule.isIntersection(0, 2), 'Cell (0,2) is intersection before remove');
BoardModule.removeWord(iw2.id);
const surviveCell = BoardModule.getCell(0, 2);
assert(surviveCell !== null, 'Intersection cell survives after removing one word');
assertEqual(surviveCell.letter, 'L', 'Surviving cell still has letter L');

// --- 17. getAnchorCells ---
console.log('--- 17. getAnchorCells ---');
BoardModule.reset();
BoardModule.setCell(1, 1, 'H', 'w1', 'horizontal');
BoardModule.setCell(1, 2, 'A', 'w1', 'horizontal');
BoardModule.setCell(1, 3, 'L', 'w1', 'horizontal');
BoardModule.setCell(1, 4, 'O', 'w1', 'horizontal');
const anchors = BoardModule.getAnchorCells();
assertEqual(anchors.length, 4, '4 anchor cells for HALO');
assertEqual(anchors[0].letter, 'H', 'First anchor is H');
assertEqual(anchors[3].letter, 'O', 'Last anchor is O');

// --- 18. serialize and deserialize ---
console.log('--- 18. serialize and deserialize ---');
BoardModule.reset();
BoardModule.setCell(0, 0, 'A', 'w1', 'horizontal');
BoardModule.setCell(0, 1, 'B', 'w1', 'horizontal');
const sw = BoardModule.createWord('AB', 0, 0, 'right', 'p1');
BoardModule.addWord(sw);
const serialized = BoardModule.serialize();
assert(serialized.cells['0,0'] !== undefined, 'Serialized has cell 0,0');
assert(serialized.words[sw.id] !== undefined, 'Serialized has word');
assert(serialized.wordSet.includes('AB'), 'Serialized wordSet has AB');

BoardModule.reset();
assertEqual(BoardModule.getCellCount(), 0, 'Board empty before deserialize');
BoardModule.deserialize(serialized);
assertEqual(BoardModule.getCellCount(), 2, 'Board has 2 cells after deserialize');
assert(BoardModule.hasWord('AB'), 'hasWord AB after deserialize');
const dCell = BoardModule.getCell(0, 0);
assertEqual(dCell.letter, 'A', 'Deserialized cell (0,0) letter is A');

// --- 19. cellKey utility ---
console.log('--- 19. cellKey utility ---');
assertEqual(BoardModule.cellKey(3, 7), '3,7', 'cellKey(3,7) = "3,7"');
assertEqual(BoardModule.cellKey(-1, 0), '-1,0', 'cellKey(-1,0) = "-1,0"');

// --- 20. createCellData ---
console.log('--- 20. createCellData ---');
const cd = BoardModule.createCellData('Z', 'w1', 'horizontal');
assertEqual(cd.letter, 'Z', 'CellData letter is Z');
assertEqual(cd.wordId, 'w1', 'CellData wordId is w1');
assertEqual(cd.direction, 'horizontal', 'CellData direction is horizontal');
assertDeepEqual(cd.partOfWords, [], 'CellData partOfWords is empty array');

const cdEmpty = BoardModule.createCellData();
assertEqual(cdEmpty.letter, null, 'Empty CellData letter is null');
assertEqual(cdEmpty.wordId, null, 'Empty CellData wordId is null');

// --- 21. toString ---
console.log('--- 21. toString ---');
BoardModule.reset();
BoardModule.setCell(0, 0, 'A', 'w1', 'horizontal');
BoardModule.setCell(0, 1, 'B', 'w1', 'horizontal');
BoardModule.setCell(1, 0, 'C', 'w2', 'vertical');
BoardModule.setCell(1, 1, 'D', 'w2', 'vertical');
const str = BoardModule.toString();
assert(str.includes('A'), 'toString includes A');
assert(str.includes('B'), 'toString includes B');
assert(str.includes('C'), 'toString includes C');
assert(str.includes('D'), 'toString includes D');

// --- 22. UUID generator ---
console.log('--- 22. UUID generator ---');
const id1 = UUID.generate();
const id2 = UUID.generate();
assert(id1 !== id2, 'UUID generates unique IDs');
assert(typeof id1 === 'string', 'UUID returns string');
const pid = UUID.prefixed('player');
assert(pid.startsWith('player_'), 'Prefixed UUID starts with player_');

// --- 23. toggleDebug ---
console.log('--- 23. toggleDebug ---');
BoardModule.reset();
assert(!BoardModule.isDebugMode(), 'Debug mode off by default');
BoardModule.toggleDebug();
assert(BoardModule.isDebugMode(), 'Debug mode on after toggle');
BoardModule.toggleDebug(false);
assert(!BoardModule.isDebugMode(), 'Debug mode off after toggle(false)');

// ============================================================
// RESULTS
// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(50));

if (failed > 0) {
  console.log('\n❌ SOME TESTS FAILED!');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED!');
  process.exit(0);
}
