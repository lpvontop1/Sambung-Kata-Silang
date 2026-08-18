/**
 * Unit Tests for UIModule.renderBoard — Tahap 03
 * Run: node tests/test-render.js
 *
 * Tests the rendering logic using a minimal DOM simulation.
 */

// Minimal DOM simulation
const domElements = {};

function mockGetElementById(id) {
  if (!domElements[id]) {
    const el = {
      id,
      className: '',
      classList: {
        _classes: new Set(),
        add: function(...c) { c.forEach(x => this._classes.add(x)); },
        remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
        toggle: function(c, force) { if (force !== undefined) { force ? this._classes.add(c) : this._classes.delete(c); } else { this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c); } return this._classes.has(c); },
        contains: function(c) { return this._classes.has(c); }
      },
      dataset: {},
      style: {},
      children: [],
      childNodes: [],
      textContent: '',
      innerHTML: '',
      appendChild: function(child) { this.children.push(child); child._parent = this; return child; },
      remove: function() { if (this._parent) { const idx = this._parent.children.indexOf(this); if (idx >= 0) this._parent.children.splice(idx, 1); } },
      querySelector: function(sel) { return null; },
      querySelectorAll: function(sel) { return []; },
      addEventListener: function() {},
      removeEventListener: function() {}
    };
    domElements[id] = el;
  }
  return domElements[id];
}

global.document = {
  getElementById: mockGetElementById,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      classList: {
        _classes: new Set(),
        add: function(...c) { c.forEach(x => this._classes.add(x)); },
        remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
        toggle: function(c, force) { if (force !== undefined) { force ? this._classes.add(c) : this._classes.delete(c); } else { this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c); } return this._classes.has(c); },
        contains: function(c) { return this._classes.has(c); }
      },
      dataset: {},
      style: { setProperty: function() {} },
      children: [],
      textContent: '',
      appendChild: function(child) { this.children.push(child); child._parent = this; return child; },
      remove: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      addEventListener: function() {}
    };
    return el;
  },
  documentElement: { style: { setProperty: () => {} } }
};
global.crypto = { randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 8) };

// Load game.js
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

// ============================================================
// TEST SUITE
// ============================================================
console.log('\n🧪 UIModule.renderBoard Tests — Tahap 03\n');

// --- 1. UIModule has renderBoard ---
console.log('--- 1. UIModule API ---');
assert(typeof UIModule.renderBoard === 'function', 'UIModule.renderBoard is a function');
assert(typeof UIModule.markNewCells === 'function', 'UIModule.markNewCells is a function');
assert(typeof UIModule.updateAnchorHighlights === 'function', 'UIModule.updateAnchorHighlights is a function');
assert(typeof UIModule.clearRenderedState === 'function', 'UIModule.clearRenderedState is a function');
assert(typeof UIModule.toggleDebugRender === 'function', 'UIModule.toggleDebugRender is a function');
assert(typeof UIModule.getSelectedAnchor === 'function', 'UIModule.getSelectedAnchor is a function');

// --- 2. renderBoard on empty board ---
console.log('--- 2. renderBoard on empty board ---');
BoardModule.reset();
UIModule.clearRenderedState();
// Ensure board-grid element exists
mockGetElementById('board-grid');
UIModule.renderBoard(); // Should not throw
assert(true, 'renderBoard on empty board does not throw');

// --- 3. renderBoard with cells ---
console.log('--- 3. renderBoard with cells ---');
BoardModule.reset();
UIModule.clearRenderedState();

// Place a word "HALO" horizontally
const word1 = BoardModule.createWord('HALO', 0, 0, 'right', 'p1');
BoardModule.addWord(word1);
for (const p of BoardModule.getWordCellPositions(word1)) {
  BoardModule.setCell(p.row, p.col, p.letter, word1.id, 'horizontal');
}
assertEqual(BoardModule.getCellCount(), 4, '4 cells after placing HALO');

// Render
UIModule.renderBoard();
assert(true, 'renderBoard with HALO does not throw');

// --- 4. renderBoard with intersection ---
console.log('--- 4. renderBoard with intersection ---');
BoardModule.reset();
UIModule.clearRenderedState();

const w1 = BoardModule.createWord('SELASA', 0, 0, 'right', 'p1');
BoardModule.addWord(w1);
for (const p of BoardModule.getWordCellPositions(w1)) {
  BoardModule.setCell(p.row, p.col, p.letter, w1.id, 'horizontal');
}

const w2 = BoardModule.createWord('LAOS', 0, 2, 'down', 'p2');
BoardModule.addWord(w2);
for (const p of BoardModule.getWordCellPositions(w2)) {
  BoardModule.setCell(p.row, p.col, p.letter, w2.id, 'vertical');
}

assert(BoardModule.isIntersection(0, 2), 'Cell (0,2) is intersection');
UIModule.renderBoard();
assert(true, 'renderBoard with intersection does not throw');

// --- 5. markNewCells ---
console.log('--- 5. markNewCells ---');
UIModule.markNewCells([{ row: 0, col: 2 }, { row: 1, col: 2 }]);
assert(true, 'markNewCells does not throw');

// --- 6. updateAnchorHighlights ---
console.log('--- 6. updateAnchorHighlights ---');
UIModule.updateAnchorHighlights();
assert(true, 'updateAnchorHighlights does not throw');

// --- 7. clearRenderedState ---
console.log('--- 7. clearRenderedState ---');
UIModule.clearRenderedState();
assertEqual(UIModule.getSelectedAnchor(), null, 'Selected anchor cleared');

// --- 8. Debug mode toggle ---
console.log('--- 8. Debug mode toggle ---');
BoardModule.toggleDebug(true);
assert(BoardModule.isDebugMode(), 'Debug mode enabled');
UIModule.renderBoard(); // Re-render with debug coords
assert(true, 'renderBoard with debug mode does not throw');
BoardModule.toggleDebug(false);

// --- 9. Re-render after adding more cells (diffing) ---
console.log('--- 9. Re-render with diffing ---');
BoardModule.reset();
UIModule.clearRenderedState();

// First render
const wa = BoardModule.createWord('KATA', 5, 5, 'right', 'p1');
BoardModule.addWord(wa);
for (const p of BoardModule.getWordCellPositions(wa)) {
  BoardModule.setCell(p.row, p.col, p.letter, wa.id, 'horizontal');
}
UIModule.renderBoard();
assertEqual(BoardModule.getCellCount(), 4, '4 cells for KATA');

// Add another word and re-render
const wb = BoardModule.createWord('ANJING', 5, 5, 'down', 'p2');
BoardModule.addWord(wb);
for (const p of BoardModule.getWordCellPositions(wb)) {
  BoardModule.setCell(p.row, p.col, p.letter, wb.id, 'vertical');
}
UIModule.renderBoard();
assert(BoardModule.isIntersection(5, 5), 'Cell (5,5) is intersection after ANJING');
assert(true, 'Re-render after adding word does not throw');

// --- 10. Render after removing a word ---
console.log('--- 10. Render after removing word ---');
BoardModule.removeWord(wb.id);
UIModule.renderBoard();
assert(!BoardModule.hasWord('ANJING'), 'ANJING removed from board');
assert(true, 'Re-render after removing word does not throw');

// --- 11. Multiple words with different directions ---
console.log('--- 11. Multiple directions ---');
BoardModule.reset();
UIModule.clearRenderedState();

const wRight = BoardModule.createWord('ABCD', 2, 2, 'right', 'p1');
BoardModule.addWord(wRight);
for (const p of BoardModule.getWordCellPositions(wRight)) {
  BoardModule.setCell(p.row, p.col, p.letter, wRight.id, 'horizontal');
}

const wDown = BoardModule.createWord('AXYZ', 2, 2, 'down', 'p2');
BoardModule.addWord(wDown);
for (const p of BoardModule.getWordCellPositions(wDown)) {
  BoardModule.setCell(p.row, p.col, p.letter, wDown.id, 'vertical');
}

const wLeft = BoardModule.createWord('DBA', 2, 5, 'left', 'p3');
BoardModule.addWord(wLeft);
for (const p of BoardModule.getWordCellPositions(wLeft)) {
  BoardModule.setCell(p.row, p.col, p.letter, wLeft.id, 'horizontal');
}

const wUp = BoardModule.createWord('YXA', 4, 2, 'up', 'p4');
BoardModule.addWord(wUp);
for (const p of BoardModule.getWordCellPositions(wUp)) {
  BoardModule.setCell(p.row, p.col, p.letter, wUp.id, 'vertical');
}

UIModule.renderBoard();
assertEqual(BoardModule.getWordCount(), 4, '4 words placed');
assert(true, 'Render with 4 directions does not throw');

// --- 12. getBounds changes trigger grid reconfiguration ---
console.log('--- 12. Bounds change detection ---');
BoardModule.reset();
UIModule.clearRenderedState();

const wBounds1 = BoardModule.createWord('TEST', 0, 0, 'right', 'p1');
BoardModule.addWord(wBounds1);
for (const p of BoardModule.getWordCellPositions(wBounds1)) {
  BoardModule.setCell(p.row, p.col, p.letter, wBounds1.id, 'horizontal');
}
UIModule.renderBoard();
const bounds1 = BoardModule.getBounds();

// Add word far away to expand bounds
const wBounds2 = BoardModule.createWord('FAR', 10, 10, 'right', 'p2');
BoardModule.addWord(wBounds2);
for (const p of BoardModule.getWordCellPositions(wBounds2)) {
  BoardModule.setCell(p.row, p.col, p.letter, wBounds2.id, 'horizontal');
}
UIModule.renderBoard();
const bounds2 = BoardModule.getBounds();

assertEqual(bounds2.maxRow, 10, 'Bounds expanded to row 10');
assertEqual(bounds2.maxCol, 12, 'Bounds expanded to col 12');

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
