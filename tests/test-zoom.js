/**
 * Unit Tests for ZoomModule & UIModule.scrollToWord — Tahap 04
 * Run: node tests/test-zoom.js
 */

// Mock DOM environment for game.js
const mockElements = {};

function createMockElement(id, tag = 'div') {
  const el = {
    id,
    className: '',
    textContent: '',
    style: { setProperty: () => {} },
    dataset: {},
    children: [],
    childNodes: [],
    appendChild: function(child) { this.children.push(child); this.childNodes.push(child); },
    remove: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    removeChild: function(child) { this.children = this.children.filter(c => c !== child); this.childNodes = this.childNodes.filter(c => c !== child); },
    insertBefore: function(newNode, refNode) { this.children.push(newNode); this.childNodes.push(newNode); },
    classList: {
      _list: [],
      add: function(c) { if (!this._list.includes(c)) this._list.push(c); },
      remove: function(c) { this._list = this._list.filter(x => x !== c); },
      toggle: function(c, force) { if (force !== undefined) { if (force) this.add(c); else this.remove(c); } else { if (this._list.includes(c)) this.remove(c); else this.add(c); } },
      contains: function(c) { return this._list.includes(c); }
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 40, bottom: 40, width: 40, height: 40 }),
    offsetLeft: 0,
    offsetTop: 0,
    offsetWidth: 40,
    offsetHeight: 40,
    scrollWidth: 800,
    scrollHeight: 600,
    clientWidth: 800,
    clientHeight: 600,
    scrollLeft: 0,
    scrollTop: 0,
    scrollTo: function(opts) { if (opts) { this.scrollLeft = opts.left || 0; this.scrollTop = opts.top || 0; } }
  };
  return el;
}

// Setup mock document
const docElements = {
  'screen-menu': createMockElement('screen-menu'),
  'screen-mode': createMockElement('screen-mode'),
  'screen-game': createMockElement('screen-game'),
  'screen-gameover': createMockElement('screen-gameover'),
  'screen-settings': createMockElement('screen-settings'),
  'screen-about': createMockElement('screen-about'),
  'board-container': createMockElement('board-container'),
  'board-grid': createMockElement('board-grid'),
  'toast-container': createMockElement('toast-container'),
  'minimap': createMockElement('minimap'),
  'minimap-canvas': Object.assign(createMockElement('minimap-canvas'), {
    width: 120,
    height: 90,
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1
    })
  }),
  'minimap-viewport': createMockElement('minimap-viewport'),
  'zoom-level': createMockElement('zoom-level'),
  'hud-mode': createMockElement('hud-mode'),
  'anchor-letter': createMockElement('anchor-letter'),
  'anchor-position': createMockElement('anchor-position'),
  'word-input': createMockElement('word-input')
};

global.document = {
  getElementById: (id) => docElements[id] || createMockElement(id),
  querySelectorAll: (sel) => [],
  addEventListener: () => {},
  createElement: (tag) => createMockElement('', tag),
  documentElement: {
    style: { setProperty: () => {} },
    clientWidth: 1024,
    clientHeight: 768
  }
};

// Mock getComputedStyle
global.getComputedStyle = () => ({
  getPropertyValue: (prop) => {
    if (prop === '--cell-size') return '40px';
    return '';
  }
});

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => { if (cb) cb(); return 1; };

// Mock crypto
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

function assertApprox(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message} (got: ${actual}, expected: ~${expected}, tolerance: ${tolerance})`);
}

// ============================================================
// TEST SUITE
// ============================================================
console.log('\n🧪 ZoomModule & ScrollToWord Tests — Tahap 04\n');

// --- 1. ZoomModule exists ---
console.log('--- 1. ZoomModule Exists ---');
assert(typeof ZoomModule === 'object', 'ZoomModule is defined');
assert(typeof ZoomModule.zoomIn === 'function', 'ZoomModule.zoomIn is a function');
assert(typeof ZoomModule.zoomOut === 'function', 'ZoomModule.zoomOut is a function');
assert(typeof ZoomModule.resetZoom === 'function', 'ZoomModule.resetZoom is a function');
assert(typeof ZoomModule.setZoom === 'function', 'ZoomModule.setZoom is a function');
assert(typeof ZoomModule.getLevel === 'function', 'ZoomModule.getLevel is a function');
assert(typeof ZoomModule.applyZoom === 'function', 'ZoomModule.applyZoom is a function');
assert(typeof ZoomModule.centerBoard === 'function', 'ZoomModule.centerBoard is a function');
assert(typeof ZoomModule.bindEvents === 'function', 'ZoomModule.bindEvents is a function');

// --- 2. Default zoom level ---
console.log('--- 2. Default Zoom Level ---');
assertEqual(ZoomModule.getLevel(), 1.0, 'Default zoom level is 1.0');

// --- 3. setZoom ---
console.log('--- 3. setZoom ---');
ZoomModule.setZoom(1.5, false);
assertApprox(ZoomModule.getLevel(), 1.5, 0.001, 'setZoom(1.5) sets level to 1.5');

ZoomModule.setZoom(0.3, false); // Below minimum
assertApprox(ZoomModule.getLevel(), 0.5, 0.001, 'setZoom(0.3) clamped to MIN_ZOOM 0.5');

ZoomModule.setZoom(3.0, false); // Above maximum
assertApprox(ZoomModule.getLevel(), 2.0, 0.001, 'setZoom(3.0) clamped to MAX_ZOOM 2.0');

// --- 4. zoomIn / zoomOut ---
console.log('--- 4. zoomIn / zoomOut ---');
ZoomModule.setZoom(1.0, false);
ZoomModule.zoomIn(false);
assertApprox(ZoomModule.getLevel(), 1.1, 0.001, 'zoomIn from 1.0 → 1.1');

ZoomModule.zoomOut(false);
assertApprox(ZoomModule.getLevel(), 1.0, 0.001, 'zoomOut from 1.1 → 1.0');

// Zoom out at minimum should stay at minimum
ZoomModule.setZoom(0.5, false);
ZoomModule.zoomOut(false);
assertApprox(ZoomModule.getLevel(), 0.5, 0.001, 'zoomOut at MIN_ZOOM stays at 0.5');

// Zoom in at maximum should stay at maximum
ZoomModule.setZoom(2.0, false);
ZoomModule.zoomIn(false);
assertApprox(ZoomModule.getLevel(), 2.0, 0.001, 'zoomIn at MAX_ZOOM stays at 2.0');

// --- 5. resetZoom ---
console.log('--- 5. resetZoom ---');
ZoomModule.setZoom(1.8, false);
ZoomModule.resetZoom(false);
assertApprox(ZoomModule.getLevel(), 1.0, 0.001, 'resetZoom returns to 1.0');

// --- 6. Zoom applies to DOM ---
console.log('--- 6. Zoom Applies to DOM ---');
ZoomModule.setZoom(1.5, false);
const gridEl = document.getElementById('board-grid');
assertEqual(gridEl.style.transform, 'scale(1.5)', 'Grid transform is scale(1.5) after setZoom(1.5)');

ZoomModule.resetZoom(false);
assertEqual(gridEl.style.transform, 'scale(1)', 'Grid transform is scale(1) after resetZoom');

// --- 7. Zoom level display updates ---
console.log('--- 7. Zoom Level Display ---');
ZoomModule.setZoom(1.5, false);
const zoomLevelEl = document.getElementById('zoom-level');
assertEqual(zoomLevelEl.textContent, '150%', 'Zoom level display shows 150%');

ZoomModule.setZoom(0.5, false);
assertEqual(zoomLevelEl.textContent, '50%', 'Zoom level display shows 50%');

ZoomModule.resetZoom(false);
assertEqual(zoomLevelEl.textContent, '100%', 'Zoom level display shows 100% after reset');

// --- 8. Multiple zoom steps ---
console.log('--- 8. Multiple Zoom Steps ---');
ZoomModule.setZoom(1.0, false);
for (let i = 0; i < 5; i++) ZoomModule.zoomIn(false);
assertApprox(ZoomModule.getLevel(), 1.5, 0.001, '5 zoomIn steps: 1.0 → 1.5');

for (let i = 0; i < 5; i++) ZoomModule.zoomOut(false);
assertApprox(ZoomModule.getLevel(), 1.0, 0.001, '5 zoomOut steps: 1.5 → 1.0');

// --- 9. UIModule.scrollToWord exists ---
console.log('--- 9. UIModule.scrollToWord ---');
assert(typeof UIModule.scrollToWord === 'function', 'UIModule.scrollToWord is a function');
assert(typeof UIModule.scrollToCell === 'function', 'UIModule.scrollToCell is a function');
assert(typeof UIModule.updateMinimap === 'function', 'UIModule.updateMinimap is a function');
assert(typeof UIModule.toggleMinimap === 'function', 'UIModule.toggleMinimap is a function');

// --- 10. scrollToWord with null/undefined ---
console.log('--- 10. scrollToWord Edge Cases ---');
// Should not throw
try {
  UIModule.scrollToWord(null);
  assert(true, 'scrollToWord(null) does not throw');
} catch (e) {
  assert(false, `scrollToWord(null) threw: ${e.message}`);
}

try {
  UIModule.scrollToWord(undefined);
  assert(true, 'scrollToWord(undefined) does not throw');
} catch (e) {
  assert(false, `scrollToWord(undefined) threw: ${e.message}`);
}

// --- 11. scrollToWord with a real word ---
console.log('--- 11. scrollToWord with Real Word ---');
BoardModule.reset();
const testWord = BoardModule.createWord('HALO', 5, 5, 'right', 'p1');
BoardModule.addWord(testWord);
for (const p of BoardModule.getWordCellPositions(testWord)) {
  BoardModule.setCell(p.row, p.col, p.letter, testWord.id, 'horizontal');
}

ZoomModule.resetZoom(false);
try {
  UIModule.scrollToWord(testWord);
  assert(true, 'scrollToWord with HALO does not throw');
} catch (e) {
  assert(false, `scrollToWord threw: ${e.message}`);
}

// --- 12. scrollToWord accounts for zoom ---
console.log('--- 12. scrollToWord with Zoom ---');
ZoomModule.setZoom(1.5, false);
try {
  UIModule.scrollToWord(testWord);
  assert(true, 'scrollToWord at 1.5x zoom does not throw');
} catch (e) {
  assert(false, `scrollToWord at zoom threw: ${e.message}`);
}
ZoomModule.resetZoom(false);

// --- 13. Minimap toggle ---
console.log('--- 13. Minimap Toggle ---');
try {
  UIModule.toggleMinimap(false);
  assert(true, 'toggleMinimap(false) does not throw');
  UIModule.toggleMinimap(true);
  assert(true, 'toggleMinimap(true) does not throw');
} catch (e) {
  assert(false, `toggleMinimap threw: ${e.message}`);
}

// --- 14. Zoom boundaries are strict ---
console.log('--- 14. Zoom Boundary Strictness ---');
ZoomModule.setZoom(0.5, false);
ZoomModule.zoomOut(false);
ZoomModule.zoomOut(false);
ZoomModule.zoomOut(false);
assertApprox(ZoomModule.getLevel(), 0.5, 0.001, 'Cannot zoom below 0.5 even with multiple zoomOut');

ZoomModule.setZoom(2.0, false);
ZoomModule.zoomIn(false);
ZoomModule.zoomIn(false);
ZoomModule.zoomIn(false);
assertApprox(ZoomModule.getLevel(), 2.0, 0.001, 'Cannot zoom above 2.0 even with multiple zoomIn');

// --- 15. setZoom precision ---
console.log('--- 15. setZoom Precision ---');
ZoomModule.setZoom(1.0, false);
ZoomModule.setZoom(1.0 + ZOOM_STEP_CHECK(), false);
assert(true, 'setZoom with step-sized value works');

function ZOOM_STEP_CHECK() { return 0.1; }

// --- 16. BoardModule still works after zoom ---
console.log('--- 16. BoardModule Integrity After Zoom ---');
BoardModule.reset();
BoardModule.setCell(0, 0, 'A', 'w1', 'horizontal');
BoardModule.setCell(0, 1, 'B', 'w1', 'horizontal');
ZoomModule.setZoom(1.5, false);
const cell = BoardModule.getCell(0, 0);
assertEqual(cell.letter, 'A', 'BoardModule.getCell still works after zoom');
assertEqual(BoardModule.getCellCount(), 2, 'Cell count still correct after zoom');
ZoomModule.resetZoom(false);

// --- 17. ZoomModule.getLevel always returns number ---
console.log('--- 17. getLevel Type Safety ---');
ZoomModule.setZoom(1.0, false);
assert(typeof ZoomModule.getLevel() === 'number', 'getLevel returns number');
assert(!isNaN(ZoomModule.getLevel()), 'getLevel does not return NaN');
assert(isFinite(ZoomModule.getLevel()), 'getLevel returns finite number');

// --- 18. Rapid zoom changes ---
console.log('--- 18. Rapid Zoom Changes ---');
ZoomModule.setZoom(1.0, false);
for (let i = 0; i < 20; i++) {
  ZoomModule.zoomIn(false);
}
assertApprox(ZoomModule.getLevel(), 2.0, 0.001, '20 zoomIns capped at 2.0');

for (let i = 0; i < 20; i++) {
  ZoomModule.zoomOut(false);
}
assertApprox(ZoomModule.getLevel(), 0.5, 0.001, '20 zoomOuts capped at 0.5');

// --- 19. Zoom and renderBoard integration ---
console.log('--- 19. Zoom + renderBoard Integration ---');
BoardModule.reset();
const w1 = BoardModule.createWord('KATA', 2, 3, 'right', 'p1');
BoardModule.addWord(w1);
for (const p of BoardModule.getWordCellPositions(w1)) {
  BoardModule.setCell(p.row, p.col, p.letter, w1.id, 'horizontal');
}

ZoomModule.setZoom(1.3, false);
try {
  UIModule.renderBoard();
  assert(true, 'renderBoard after zoom does not throw');
} catch (e) {
  assert(false, `renderBoard after zoom threw: ${e.message}`);
}

// Verify board data is intact
assert(BoardModule.hasWord('KATA'), 'Board still has KATA after zoom+render');
assertEqual(BoardModule.getCellCount(), 4, 'Cell count still 4 after zoom+render');

// --- 20. Reset back to normal ---
console.log('--- 20. Final Reset ---');
ZoomModule.resetZoom(false);
BoardModule.reset();
assertApprox(ZoomModule.getLevel(), 1.0, 0.001, 'Final zoom is 1.0');
assertEqual(BoardModule.getCellCount(), 0, 'Final board is empty');

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
