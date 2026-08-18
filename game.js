/* ============================================================
   SAMBUNG KATA SILANG — Game Logic
   Tahap 04: Rendering Grid — Scroll & Zoom
   ============================================================ */

'use strict';

// ============================================================
// --- UTILITY: UUID Generator ---
// Generates unique IDs for words and entities.
// ============================================================
const UUID = (() => {
  let counter = 0;

  /**
   * Generate a simple UUID v4-like string.
   * Uses crypto.randomUUID() if available, otherwise falls back to a
   * timestamp + counter + random based ID.
   * @returns {string} UUID string
   */
  function generate() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    const timestamp = Date.now().toString(36);
    const count = (counter++).toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${count}-${random}`;
  }

  /**
   * Generate a short word-specific ID with prefix.
   * @param {string} prefix - e.g. 'word', 'player'
   * @returns {string} Prefixed ID
   */
  function prefixed(prefix) {
    return `${prefix}_${generate()}`;
  }

  return { generate, prefixed };
})();


// ============================================================
// --- BOARD MODULE ---
// Manages the 2D grid, cells, word placement, and board state.
// Tahap 02: Model Data — Board, CellData, Word
// ============================================================
const BoardModule = (() => {
  // --------------------------------------------------------
  // Private State
  // --------------------------------------------------------
  let cells = new Map();   // key: "row,col" → CellData
  let words = new Map();   // key: wordId → Word
  let wordSet = new Set(); // Set of uppercase word texts already placed

  // Debug mode flag — toggles coordinate display in rendering (Tahap 03)
  let debugMode = false;

  // --------------------------------------------------------
  // CellData Factory
  // --------------------------------------------------------
  /**
   * Create a CellData object.
   * @param {string|null} letter - The letter occupying this cell
   * @param {string|null} wordId - ID of the primary word occupying this cell
   * @param {'horizontal'|'vertical'|null} direction - Direction of the primary word
   * @returns {CellData}
   */
  function createCellData(letter = null, wordId = null, direction = null) {
    return {
      letter,           // string | null — the letter in this cell
      wordId,           // string | null — primary word ID
      direction,        // 'horizontal' | 'vertical' | null
      partOfWords: []   // string[] — array of wordIds this cell belongs to (for intersection detection)
    };
  }

  // --------------------------------------------------------
  // Word Factory
  // --------------------------------------------------------
  /**
   * Create a Word object.
   * @param {string} text - The word text (uppercase)
   * @param {number} startRow - Starting row position
   * @param {number} startCol - Starting column position
   * @param {'right'|'left'|'down'|'up'} direction - Placement direction
   * @param {string} playerId - ID of the player who placed this word
   * @param {string} [id] - Optional ID (auto-generated if omitted)
   * @returns {Word}
   */
  function createWord(text, startRow, startCol, direction, playerId, id = null) {
    return {
      id: id || UUID.prefixed('word'),
      text: text.toUpperCase(),
      startRow,
      startCol,
      direction,        // 'right' | 'left' | 'down' | 'up'
      length: text.length,
      playerId
    };
  }

  // --------------------------------------------------------
  // Key Helper
  // --------------------------------------------------------
  /**
   * Generate the Map key for a cell position.
   * @param {number} row
   * @param {number} col
   * @returns {string} Key in format "row,col"
   */
  function cellKey(row, col) {
    return `${row},${col}`;
  }

  // --------------------------------------------------------
  // Core Board Methods
  // --------------------------------------------------------

  /**
   * Get cell data at a specific position.
   * @param {number} row
   * @param {number} col
   * @returns {CellData|null} CellData if exists, null otherwise
   */
  function getCell(row, col) {
    return cells.get(cellKey(row, col)) || null;
  }

  /**
   * Set a cell's data. If the cell already exists and has a letter,
   * this is an intersection — add the wordId to partOfWords.
   * @param {number} row
   * @param {number} col
   * @param {string} letter - The letter to place
   * @param {string} wordId - ID of the word placing this cell
   * @param {'horizontal'|'vertical'} direction - Direction of the word
   */
  function setCell(row, col, letter, wordId, direction) {
    const key = cellKey(row, col);
    const existing = cells.get(key);

    if (existing) {
      // Cell already exists — update it
      existing.letter = letter;
      // Add wordId to partOfWords if not already there
      if (!existing.partOfWords.includes(wordId)) {
        existing.partOfWords.push(wordId);
      }
      // Keep the original direction from first word, or update if null
      if (!existing.direction) {
        existing.direction = direction;
      }
      // If this is a crossing word (different direction), keep both directions tracked
      // via partOfWords — the cell is an intersection
    } else {
      // New cell
      const cellData = createCellData(letter, wordId, direction);
      cellData.partOfWords = [wordId];
      cells.set(key, cellData);
    }
  }

  /**
   * Check if a cell is empty (no letter placed).
   * A cell that doesn't exist in the Map is also considered empty.
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  function isCellEmpty(row, col) {
    const cell = cells.get(cellKey(row, col));
    return !cell || cell.letter === null;
  }

  /**
   * Get the bounding box of all filled cells on the board.
   * Used by the renderer to determine grid dimensions.
   * @returns {{ minRow: number, maxRow: number, minCol: number, maxCol: number }}
   */
  function getBounds() {
    if (cells.size === 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    }

    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;

    for (const key of cells.keys()) {
      const [r, c] = key.split(',').map(Number);
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
    }

    return { minRow, maxRow, minCol, maxCol };
  }

  /**
   * Clear a cell — remove its letter and word associations.
   * If the cell belongs to multiple words (intersection), only remove
   * the specified wordId. If only one word, remove the cell entirely.
   * @param {number} row
   * @param {number} col
   * @param {string} [wordId] - Optional: remove only this word's association
   */
  function clearCell(row, col, wordId = null) {
    const key = cellKey(row, col);
    const cell = cells.get(key);
    if (!cell) return;

    if (wordId) {
      // Remove specific word association
      cell.partOfWords = cell.partOfWords.filter(id => id !== wordId);
      if (cell.partOfWords.length === 0) {
        // No more words use this cell — remove it
        cells.delete(key);
      } else {
        // Still part of other words — update letter from remaining word
        // (The letter should be the same for intersections, so no change needed)
        cell.wordId = cell.partOfWords[0]; // Update primary wordId
      }
    } else {
      // Remove the entire cell
      cells.delete(key);
    }
  }

  // --------------------------------------------------------
  // Word Management Methods
  // --------------------------------------------------------

  /**
   * Add a Word object to the board's word map and wordSet.
   * @param {Word} word
   */
  function addWord(word) {
    words.set(word.id, word);
    wordSet.add(word.text.toUpperCase());
  }

  /**
   * Get a Word by its ID.
   * @param {string} wordId
   * @returns {Word|undefined}
   */
  function getWord(wordId) {
    return words.get(wordId);
  }

  /**
   * Check if a word text has already been used on the board.
   * @param {string} text - Word text (will be uppercased)
   * @returns {boolean}
   */
  function hasWord(text) {
    return wordSet.has(text.toUpperCase());
  }

  /**
   * Remove a word and all its cells from the board.
   * Cells that are intersections (belong to other words) are preserved.
   * @param {string} wordId
   * @returns {boolean} True if word was found and removed
   */
  function removeWord(wordId) {
    const word = words.get(wordId);
    if (!word) return false;

    // Calculate all cell positions for this word
    const positions = getWordCellPositions(word);

    // Clear each cell (only this word's association)
    for (const { row, col } of positions) {
      clearCell(row, col, wordId);
    }

    // Remove from maps
    words.delete(wordId);
    wordSet.delete(word.text.toUpperCase());
    return true;
  }

  /**
   * Calculate the cell positions for a word based on its
   * startRow, startCol, direction, and length.
   * @param {Word} word
   * @returns {Array<{row: number, col: number, letter: string}>}
   */
  function getWordCellPositions(word) {
    const positions = [];
    const text = word.text;

    for (let i = 0; i < word.length; i++) {
      let row = word.startRow;
      let col = word.startCol;

      switch (word.direction) {
        case 'right': col += i; break;
        case 'left':  col -= i; break;
        case 'down':  row += i; break;
        case 'up':    row -= i; break;
      }

      positions.push({
        row,
        col,
        letter: text[i]
      });
    }

    return positions;
  }

  /**
   * Get the number of filled cells on the board.
   * @returns {number}
   */
  function getCellCount() {
    return cells.size;
  }

  /**
   * Get the number of words placed on the board.
   * @returns {number}
   */
  function getWordCount() {
    return words.size;
  }

  /**
   * Get all cells as an array of { key, row, col, cellData }.
   * Useful for rendering and debugging.
   * @returns {Array<{key: string, row: number, col: number, cellData: CellData}>}
   */
  function getAllCells() {
    const result = [];
    for (const [key, cellData] of cells) {
      const [row, col] = key.split(',').map(Number);
      result.push({ key, row, col, cellData });
    }
    return result;
  }

  /**
   * Get all words as an array.
   * @returns {Word[]}
   */
  function getAllWords() {
    return Array.from(words.values());
  }

  /**
   * Find all anchor cells — cells that are filled and can be used
   * as starting points for new word placement.
   * @returns {Array<{row: number, col: number, letter: string, partOfWords: string[]}>}
   */
  function getAnchorCells() {
    const anchors = [];
    for (const [key, cellData] of cells) {
      if (cellData.letter !== null) {
        const [row, col] = key.split(',').map(Number);
        anchors.push({
          row,
          col,
          letter: cellData.letter,
          partOfWords: [...cellData.partOfWords]
        });
      }
    }
    return anchors;
  }

  /**
   * Check if a specific cell is an intersection (belongs to 2+ words).
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  function isIntersection(row, col) {
    const cell = cells.get(cellKey(row, col));
    return cell ? cell.partOfWords.length >= 2 : false;
  }

  /**
   * Toggle debug mode for coordinate display.
   * @param {boolean} [enabled] - If omitted, toggle current state
   * @returns {boolean} Current debug mode state
   */
  function toggleDebug(enabled) {
    debugMode = enabled !== undefined ? enabled : !debugMode;
    return debugMode;
  }

  /**
   * Get a serializable snapshot of the board state.
   * Useful for multiplayer sync and save/load.
   * @returns {object}
   */
  function serialize() {
    const cellsObj = {};
    for (const [key, val] of cells) {
      cellsObj[key] = { ...val, partOfWords: [...val.partOfWords] };
    }
    const wordsObj = {};
    for (const [key, val] of words) {
      wordsObj[key] = { ...val };
    }
    return {
      cells: cellsObj,
      words: wordsObj,
      wordSet: Array.from(wordSet)
    };
  }

  /**
   * Restore board state from a serialized snapshot.
   * @param {object} data - Output from serialize()
   */
  function deserialize(data) {
    cells.clear();
    words.clear();
    wordSet.clear();

    if (data.cells) {
      for (const [key, val] of Object.entries(data.cells)) {
        cells.set(key, { ...val, partOfWords: [...(val.partOfWords || [])] });
      }
    }
    if (data.words) {
      for (const [key, val] of Object.entries(data.words)) {
        words.set(key, { ...val });
      }
    }
    if (data.wordSet) {
      for (const w of data.wordSet) {
        wordSet.add(w);
      }
    }
  }

  /**
   * Reset the board completely.
   */
  function reset() {
    cells.clear();
    words.clear();
    wordSet.clear();
    debugMode = false;
  }

  /**
   * Get a string representation of the board for debugging.
   * Shows the grid with letters and dots for empty cells.
   * @returns {string}
   */
  function toString() {
    if (cells.size === 0) return '[Empty Board]';

    const bounds = getBounds();
    let result = '';

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const cell = cells.get(cellKey(r, c));
        result += cell && cell.letter ? cell.letter : '.';
        if (c < bounds.maxCol) result += ' ';
      }
      result += '\n';
    }

    return result.trim();
  }

  // --------------------------------------------------------
  // Public API
  // --------------------------------------------------------
  return {
    // Core cell methods
    getCell,
    setCell,
    isCellEmpty,
    getBounds,
    clearCell,

    // Word management
    addWord,
    getWord,
    hasWord,
    removeWord,
    getWordCellPositions,

    // Accessors
    getWords:      () => words,
    getWordSet:    () => wordSet,
    getCellCount,
    getWordCount,
    getAllCells,
    getAllWords,
    getAnchorCells,
    isIntersection,

    // Utility
    toggleDebug,
    isDebugMode:   () => debugMode,
    serialize,
    deserialize,
    reset,
    toString,

    // Factory helpers (exposed for external use)
    createWord,
    createCellData,
    cellKey
  };
})();


// ============================================================
// --- KBBI MODULE ---
// Loads and queries the KBBI dictionary (Trie-based).
// ============================================================
const KBBIModule = (() => {
  let trie = null;       // KBBITrie instance (Tahap 06)
  let loaded = false;
  let wordCount = 0;

  // Public API (to be implemented in later tahaps)
  return {
    loadFromJSON:  (jsonData) => { /* Tahap 06 */ },
    isLoaded:      () => loaded,
    getWordCount:  () => wordCount,
    search:        (word) => { /* Tahap 06 */ },
    startsWith:    (prefix) => { /* Tahap 06 */ },
    getWordsByPrefix: (prefix, limit) => { /* Tahap 08 */ },
    getWordsBySuffix: (suffix, limit) => { /* Tahap 09 */ },
    loadChunk:     (letter) => { /* Tahap 06 */ }
  };
})();


// ============================================================
// --- VALIDATION MODULE ---
// Validates words against KBBI, checks placement constraints.
// ============================================================
const ValidationModule = (() => {
  // Public API (to be implemented in later tahaps)
  return {
    isValidWord:            (word) => { /* Tahap 07 */ },
    validateWordWithDetail: (word) => { /* Tahap 07 */ },
    validatePlacement:      (cells, board) => { /* Tahap 16 */ },
    validateNoAdjacentConflict: (cells, board, direction) => { /* Tahap 16 */ },
    validateAccidentalWords:    (cells, board, direction) => { /* Tahap 16 */ },
    isWordUsed:             (word) => { /* Tahap 17 */ }
  };
})();


// ============================================================
// --- PLACEMENT MODULE ---
// Handles word placement in all 4 directions.
// ============================================================
const PlacementModule = (() => {
  // Public API (to be implemented in later tahaps)
  return {
    placeWordRight: (word, anchorRow, anchorCol, wordId, playerId) => { /* Tahap 10 */ },
    placeWordLeft:  (word, anchorRow, anchorCol, wordId, playerId) => { /* Tahap 11 */ },
    placeWordDown:  (word, anchorRow, anchorCol, wordId, playerId) => { /* Tahap 12 */ },
    placeWordUp:    (word, anchorRow, anchorCol, wordId, playerId) => { /* Tahap 13 */ },
    calculatePositions: (word, anchorRow, anchorCol, direction) => { /* Tahap 18 */ }
  };
})();


// ============================================================
// --- SCORING MODULE ---
// Calculates scores, detects intersections and branches.
// ============================================================
const ScoringModule = (() => {
  // Score constants
  const SCORES = {
    VALID_WORD:       10,
    INTERSECTION:     15,
    DOUBLE_INTERSECTION: 30,
    NEW_BRANCH:       10,
    WRONG_WORD:       -10,
    LONG_WORD_BONUS:  5  // per letter above 5
  };

  // Public API (to be implemented in later tahaps)
  return {
    SCORES,
    calculateScore:    (placement, board) => { /* Tahap 23 */ },
    detectIntersections: (placement, board) => { /* Tahap 14 */ },
    detectNewBranches:   (placement, board, sourceWordId) => { /* Tahap 15 */ },
    calculateLongWordBonus: (wordLength) => { /* Tahap 24 */ }
  };
})();


// ============================================================
// --- TURN MODULE ---
// Manages players, turns, lives, timer, and game state.
// ============================================================
const TurnModule = (() => {
  // Game state
  let players = [];
  let currentPlayerIndex = 0;
  let gameMode = 'classic';
  let gameActive = false;

  // Public API (to be implemented in later tahaps)
  return {
    initPlayers:     (count, mode) => { /* Tahap 19 */ },
    nextTurn:        () => { /* Tahap 20 */ },
    getCurrentPlayer: () => players[currentPlayerIndex],
    decrementLife:   (playerId) => { /* Tahap 21 */ },
    startTimer:      (seconds) => { /* Tahap 22 */ },
    stopTimer:       () => { /* Tahap 22 */ },
    isGameActive:    () => gameActive,
    getGameMode:     () => gameMode,
    setGameMode:     (mode) => { gameMode = mode; },
    reset:           () => { players = []; currentPlayerIndex = 0; gameActive = false; }
  };
})();


// ============================================================
// --- ZOOM MODULE ---
// Manages board zoom, pan/drag, and scroll-to-word functionality.
// Tahap 04: Scroll & Zoom
// ============================================================
const ZoomModule = (() => {
  // --------------------------------------------------------
  // Zoom State
  // --------------------------------------------------------
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.1;
  const DEFAULT_ZOOM = 1.0;

  let currentZoom = DEFAULT_ZOOM;

  // --------------------------------------------------------
  // Pan/Drag State
  // --------------------------------------------------------
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let scrollStartX = 0;
  let scrollStartY = 0;

  // --------------------------------------------------------
  // Pinch-to-Zoom State (Touch)
  // --------------------------------------------------------
  let lastPinchDistance = 0;

  // --------------------------------------------------------
  // Zoom Methods
  // --------------------------------------------------------

  /**
   * Set zoom level directly.
   * @param {number} level - Zoom level (0.5 to 2.0)
   * @param {boolean} [animate=true] - Use smooth transition
   */
  function setZoom(level, animate = true) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    applyZoom(animate);
  }

  /**
   * Zoom in by one step.
   * @param {boolean} [animate=true]
   */
  function zoomIn(animate = true) {
    setZoom(currentZoom + ZOOM_STEP, animate);
  }

  /**
   * Zoom out by one step.
   * @param {boolean} [animate=true]
   */
  function zoomOut(animate = true) {
    setZoom(currentZoom - ZOOM_STEP, animate);
  }

  /**
   * Reset zoom to default (1.0x).
   * @param {boolean} [animate=true]
   */
  function resetZoom(animate = true) {
    currentZoom = DEFAULT_ZOOM;
    applyZoom(animate);

    // Also center the board
    centerBoard();
  }

  /**
   * Get current zoom level.
   * @returns {number}
   */
  function getLevel() {
    return currentZoom;
  }

  /**
   * Apply the current zoom level to the DOM.
   * @param {boolean} [animate=true]
   */
  function applyZoom(animate = true) {
    const gridEl = document.getElementById('board-grid');
    const container = document.getElementById('board-container');
    if (!gridEl) return;

    // Set transition based on animate flag
    if (animate) {
      gridEl.style.transition = 'transform 0.2s ease';
    } else {
      gridEl.style.transition = 'none';
    }

    gridEl.style.transform = `scale(${currentZoom})`;

    // Update zoom level display
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    // Update container cursor based on zoom
    if (container) {
      if (currentZoom > 1.0) {
        container.classList.add('board-container--zoomed');
      } else {
        container.classList.remove('board-container--zoomed');
      }
    }

    // Update minimap after zoom change
    if (typeof UIModule !== 'undefined') {
      // Use requestAnimationFrame to avoid layout thrashing
      requestAnimationFrame(() => {
        UIModule.updateMinimap();
      });
    }
  }

  /**
   * Center the board in the container viewport.
   */
  function centerBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTo({
        left: (container.scrollWidth - container.clientWidth) / 2,
        top: (container.scrollHeight - container.clientHeight) / 2,
        behavior: 'smooth'
      });
    });
  }

  // --------------------------------------------------------
  // Ctrl+Scroll Wheel Zoom
  // --------------------------------------------------------

  /**
   * Handle wheel event on board container for Ctrl+scroll zoom.
   * @param {WheelEvent} e
   */
  function handleWheelZoom(e) {
    if (!e.ctrlKey && !e.metaKey) return; // Only zoom with Ctrl/Cmd

    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(currentZoom + delta);
  }

  // --------------------------------------------------------
  // Pan / Drag
  // --------------------------------------------------------

  /**
   * Start panning the board (mouse drag or touch drag).
   * @param {number} clientX
   * @param {number} clientY
   */
  function startPan(clientX, clientY) {
    if (currentZoom <= 1.0) return; // Only pan when zoomed

    const container = document.getElementById('board-container');
    if (!container) return;

    isPanning = true;
    panStartX = clientX;
    panStartY = clientY;
    scrollStartX = container.scrollLeft;
    scrollStartY = container.scrollTop;

    container.classList.add('board-container--panning');
  }

  /**
   * Update pan position during drag.
   * @param {number} clientX
   * @param {number} clientY
   */
  function updatePan(clientX, clientY) {
    if (!isPanning) return;

    const container = document.getElementById('board-container');
    if (!container) return;

    const dx = panStartX - clientX;
    const dy = panStartY - clientY;

    container.scrollLeft = scrollStartX + dx;
    container.scrollTop = scrollStartY + dy;
  }

  /**
   * End panning.
   */
  function endPan() {
    if (!isPanning) return;

    isPanning = false;

    const container = document.getElementById('board-container');
    if (container) {
      container.classList.remove('board-container--panning');
    }
  }

  // --------------------------------------------------------
  // Pinch-to-Zoom (Touch)
  // --------------------------------------------------------

  /**
   * Calculate distance between two touch points.
   * @param {Touch} t1
   * @param {Touch} t2
   * @returns {number}
   */
  function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Handle touchstart for pinch-to-zoom detection.
   * @param {TouchEvent} e
   */
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      lastPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
    } else if (e.touches.length === 1 && currentZoom > 1.0) {
      startPan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  /**
   * Handle touchmove for pinch-to-zoom and pan.
   * @param {TouchEvent} e
   */
  function handleTouchMove(e) {
    if (e.touches.length === 2) {
      // Pinch-to-zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (lastPinchDistance > 0) {
        const scale = currentDistance / lastPinchDistance;
        setZoom(currentZoom * scale, false);
      }
      lastPinchDistance = currentDistance;
    } else if (e.touches.length === 1 && isPanning) {
      e.preventDefault();
      updatePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  /**
   * Handle touchend.
   */
  function handleTouchEnd() {
    lastPinchDistance = 0;
    endPan();
  }

  // --------------------------------------------------------
  // Double-click to Reset Zoom
  // --------------------------------------------------------

  let lastClickTime = 0;
  let lastClickX = 0;
  let lastClickY = 0;

  /**
   * Handle double-click/double-tap on board container to reset zoom.
   * @param {MouseEvent} e
   */
  function handleDoubleClick(e) {
    // Don't reset if clicking on a cell (anchor selection)
    if (e.target.closest('.cell-filled')) return;

    resetZoom();
  }

  // --------------------------------------------------------
  // Event Binding
  // --------------------------------------------------------

  /**
   * Bind all zoom/pan event listeners to the board container.
   */
  function bindEvents() {
    const container = document.getElementById('board-container');
    if (!container) return;

    // Ctrl+scroll wheel zoom
    container.addEventListener('wheel', handleWheelZoom, { passive: false });

    // Mouse drag for pan
    container.addEventListener('mousedown', (e) => {
      // Only pan with middle button or left button when zoomed
      if (e.button === 1 || (e.button === 0 && currentZoom > 1.0 && !e.target.closest('.cell-filled'))) {
        e.preventDefault();
        startPan(e.clientX, e.clientY);
      }
    });

    document.addEventListener('mousemove', (e) => {
      updatePan(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', () => {
      endPan();
    });

    // Touch events for pinch-to-zoom and pan
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    // Double-click to reset zoom
    container.addEventListener('dblclick', handleDoubleClick);

    // Scroll event to update minimap viewport
    container.addEventListener('scroll', () => {
      requestAnimationFrame(() => {
        if (typeof UIModule !== 'undefined') {
          UIModule.updateMinimap();
        }
      });
    }, { passive: true });
  }

  // --------------------------------------------------------
  // Public API
  // --------------------------------------------------------
  return {
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    getLevel,
    applyZoom,
    centerBoard,
    bindEvents
  };
})();


// ============================================================
// --- UI MODULE ---
// Manages DOM rendering, screen navigation, and user interaction.
// Tahap 03: renderBoard with diffing, CSS Grid, debug mode
// Tahap 04: scrollToWord, pan/drag, minimap
// ============================================================
const UIModule = (() => {
  // Screen management
  const screens = {
    menu:     document.getElementById('screen-menu'),
    mode:     document.getElementById('screen-mode'),
    game:     document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover'),
    settings: document.getElementById('screen-settings'),
    about:    document.getElementById('screen-about')
  };

  // --------------------------------------------------------
  // Board Rendering State (for diffing)
  // --------------------------------------------------------
  /** @type {Map<string, HTMLDivElement>} Map of "row,col" → cell DOM element */
  let renderedCells = new Map();

  /** @type {{ minRow: number, maxRow: number, minCol: number, maxCol: number }|null} */
  let lastBounds = null;

  /** @type {Set<string>} Set of cell keys that were newly placed (for highlight animation) */
  let newCellKeys = new Set();

  /** @type {Set<string>} Set of cell keys that are anchor cells */
  let anchorCellKeys = new Set();

  /** @type {string|null} Currently selected anchor cell key */
  let selectedAnchorKey = null;

  // Word color palette — assigns different subtle colors per wordId for visual clarity
  const WORD_COLORS = [
    '#e94560', '#4a8fe7', '#45e97b', '#e9a845', '#a845e9',
    '#45e9e9', '#e945a8', '#8fe945', '#4545e9', '#e9e945'
  ];
  const wordColorMap = new Map();
  let wordColorIndex = 0;

  /**
   * Get a color for a wordId. Each word gets a consistent color.
   * @param {string} wordId
   * @returns {string} CSS color string
   */
  function getWordColor(wordId) {
    if (!wordId) return WORD_COLORS[0];
    if (!wordColorMap.has(wordId)) {
      wordColorMap.set(wordId, WORD_COLORS[wordColorIndex % WORD_COLORS.length]);
      wordColorIndex++;
    }
    return wordColorMap.get(wordId);
  }

  /**
   * Clear word color assignments (call on board reset).
   */
  function clearWordColors() {
    wordColorMap.clear();
    wordColorIndex = 0;
  }

  // --------------------------------------------------------
  // Screen Management
  // --------------------------------------------------------

  /**
   * Show a specific screen, hide all others.
   * @param {string} screenName - Key from screens object
   */
  function showScreen(screenName) {
    Object.entries(screens).forEach(([name, el]) => {
      if (el) {
        el.classList.toggle('screen--active', name === screenName);
      }
    });
  }

  // --------------------------------------------------------
  // Toast Notifications
  // --------------------------------------------------------

  /**
   * Show a toast notification.
   * @param {string} message - Toast text
   * @param {string} type - 'success' | 'error' | 'info'
   * @param {number} duration - Duration in ms (default 2500)
   */
  function showToast(message, type = 'info', duration = 2500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  // --------------------------------------------------------
  // Board Rendering
  // --------------------------------------------------------

  /**
   * Render the board to the DOM using efficient diffing.
   * Only updates cells that have changed since the last render.
   *
   * Algorithm:
   * 1. Get current bounds from BoardModule
   * 2. If bounds changed, reconfigure CSS Grid
   * 3. Diff: for each cell in BoardModule.cells
   *    - If cell exists in renderedCells and unchanged → skip
   *    - If cell exists but changed → update DOM
   *    - If cell doesn't exist in DOM → create and insert
   * 4. Remove any rendered cells that no longer exist in board
   * 5. Fill empty cells within bounds (for grid structure)
   */
  function renderBoard() {
    const gridEl = document.getElementById('board-grid');
    if (!gridEl) return;

    const bounds = BoardModule.getBounds();
    const boardCells = BoardModule.getAllCells();
    const boardCellMap = new Map();
    for (const c of boardCells) {
      boardCellMap.set(c.key, c);
    }

    // --- Step 1: Check if bounds changed → reconfigure grid ---
    const boundsChanged = !lastBounds ||
      lastBounds.minRow !== bounds.minRow ||
      lastBounds.maxRow !== bounds.maxRow ||
      lastBounds.minCol !== bounds.minCol ||
      lastBounds.maxCol !== bounds.maxCol;

    if (boundsChanged && boardCells.length > 0) {
      const rows = bounds.maxRow - bounds.minRow + 1;
      const cols = bounds.maxCol - bounds.minCol + 1;
      gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
      gridEl.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
      lastBounds = { ...bounds };
    }

    // Remove placeholder text if board has cells
    if (boardCells.length > 0) {
      const placeholder = gridEl.querySelector('.board-placeholder');
      if (placeholder) placeholder.remove();
    }

    // --- Step 2: Diff and update cells ---
    const currentKeys = new Set();

    // Process filled cells from board
    for (const { key, row, col, cellData } of boardCells) {
      currentKeys.add(key);
      const existingEl = renderedCells.get(key);

      if (existingEl) {
        // Cell exists in DOM — check if update needed
        const needsUpdate = existingEl.dataset.letter !== (cellData.letter || '') ||
          existingEl.dataset.wordId !== (cellData.wordId || '') ||
          existingEl.dataset.direction !== (cellData.direction || '');

        if (needsUpdate) {
          updateCellElement(existingEl, row, col, cellData);
        }

        // Always update CSS class states (new, anchor, intersection)
        updateCellClasses(existingEl, key, cellData);
      } else {
        // New cell — create DOM element
        const cellEl = createCellElement(row, col, cellData);
        positionCellInGrid(cellEl, row, col, bounds);
        gridEl.appendChild(cellEl);
        renderedCells.set(key, cellEl);
        updateCellClasses(cellEl, key, cellData);
      }
    }

    // --- Step 3: Remove cells that no longer exist in board ---
    for (const [key, el] of renderedCells) {
      if (!currentKeys.has(key)) {
        el.remove();
        renderedCells.delete(key);
      }
    }

    // --- Step 4: Ensure empty cells within bounds for grid structure ---
    if (boundsChanged && boardCells.length > 0) {
      ensureEmptyCells(gridEl, bounds, boardCellMap);
    }

    // --- Step 5: Update minimap after render ---
    updateMinimap();
  }

  /**
   * Create a DOM element for a board cell.
   * @param {number} row
   * @param {number} col
   * @param {CellData} cellData
   * @returns {HTMLDivElement}
   */
  function createCellElement(row, col, cellData) {
    const cell = document.createElement('div');
    cell.className = 'cell cell-filled';
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.dataset.letter = cellData.letter || '';
    cell.dataset.wordId = cellData.wordId || '';
    cell.dataset.direction = cellData.direction || '';

    // Letter span
    const span = document.createElement('span');
    span.className = 'cell__letter';
    span.textContent = cellData.letter || '';
    cell.appendChild(span);

    // Intersection indicator
    if (cellData.partOfWords && cellData.partOfWords.length >= 2) {
      cell.dataset.intersection = 'true';
    }

    // Debug coordinate label
    if (BoardModule.isDebugMode()) {
      const coord = document.createElement('span');
      coord.className = 'cell__coord';
      coord.textContent = `${row},${col}`;
      cell.appendChild(coord);
    }

    // Color by wordId (optional visual clarity)
    const color = getWordColor(cellData.wordId);
    cell.style.setProperty('--word-color', color);

    // Click handler for anchor selection
    cell.addEventListener('click', () => onCellClick(row, col, cellData));

    return cell;
  }

  /**
   * Update an existing cell DOM element with new data.
   * @param {HTMLDivElement} el
   * @param {number} row
   * @param {number} col
   * @param {CellData} cellData
   */
  function updateCellElement(el, row, col, cellData) {
    el.dataset.letter = cellData.letter || '';
    el.dataset.wordId = cellData.wordId || '';
    el.dataset.direction = cellData.direction || '';

    // Update letter
    const letterSpan = el.querySelector('.cell__letter');
    if (letterSpan) {
      letterSpan.textContent = cellData.letter || '';
    }

    // Update intersection
    if (cellData.partOfWords && cellData.partOfWords.length >= 2) {
      el.dataset.intersection = 'true';
    } else {
      delete el.dataset.intersection;
    }

    // Update color
    const color = getWordColor(cellData.wordId);
    el.style.setProperty('--word-color', color);

    // Update debug coord
    if (BoardModule.isDebugMode() && !el.querySelector('.cell__coord')) {
      const coord = document.createElement('span');
      coord.className = 'cell__coord';
      coord.textContent = `${row},${col}`;
      el.appendChild(coord);
    }
  }

  /**
   * Update CSS classes on a cell based on its state (new, anchor, intersection).
   * @param {HTMLDivElement} el
   * @param {string} key - Cell key "row,col"
   * @param {CellData} cellData
   */
  function updateCellClasses(el, key, cellData) {
    // Base class
    if (cellData.letter) {
      el.classList.remove('cell-empty');
      el.classList.add('cell-filled');
    } else {
      el.classList.remove('cell-filled');
      el.classList.add('cell-empty');
    }

    // New cell highlight
    if (newCellKeys.has(key)) {
      el.classList.add('cell-new');
    } else {
      el.classList.remove('cell-new');
    }

    // Anchor cell highlight
    if (anchorCellKeys.has(key)) {
      el.classList.add('cell-anchor');
    } else {
      el.classList.remove('cell-anchor');
    }

    // Intersection
    if (cellData.partOfWords && cellData.partOfWords.length >= 2) {
      el.classList.add('cell-intersection');
    } else {
      el.classList.remove('cell-intersection');
    }

    // Selected anchor
    if (key === selectedAnchorKey) {
      el.classList.add('cell-anchor--selected');
    } else {
      el.classList.remove('cell-anchor--selected');
    }
  }

  /**
   * Position a cell element in the CSS Grid using grid-row and grid-column.
   * @param {HTMLDivElement} el
   * @param {number} row
   * @param {number} col
   * @param {object} bounds
   */
  function positionCellInGrid(el, row, col, bounds) {
    const gridRow = row - bounds.minRow + 1;
    const gridCol = col - bounds.minCol + 1;
    el.style.gridRow = gridRow;
    el.style.gridColumn = gridCol;
  }

  /**
   * Ensure empty cells exist within the grid bounds for visual structure.
   * This fills in the gaps between filled cells so the CSS Grid renders properly.
   * @param {HTMLElement} gridEl
   * @param {object} bounds
   * @param {Map<string, object>} boardCellMap
   */
  function ensureEmptyCells(gridEl, bounds, boardCellMap) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const key = BoardModule.cellKey(r, c);
        if (!boardCellMap.has(key) && !renderedCells.has(key)) {
          // Create empty cell for grid structure
          const emptyEl = document.createElement('div');
          emptyEl.className = 'cell cell-empty';
          emptyEl.dataset.row = r;
          emptyEl.dataset.col = c;
          emptyEl.dataset.letter = '';
          positionCellInGrid(emptyEl, r, c, bounds);

          if (BoardModule.isDebugMode()) {
            const coord = document.createElement('span');
            coord.className = 'cell__coord';
            coord.textContent = `${r},${c}`;
            emptyEl.appendChild(coord);
          }

          gridEl.appendChild(emptyEl);
          renderedCells.set(key, emptyEl);
        }
      }
    }
  }

  // --------------------------------------------------------
  // Cell Interaction
  // --------------------------------------------------------

  /**
   * Handle click on a board cell — select as anchor for word placement.
   * @param {number} row
   * @param {number} col
   * @param {CellData} cellData
   */
  function onCellClick(row, col, cellData) {
    if (!cellData.letter) return; // Can't select empty cell as anchor

    const key = BoardModule.cellKey(row, col);

    // Toggle selection
    if (selectedAnchorKey === key) {
      selectedAnchorKey = null;
    } else {
      selectedAnchorKey = key;
    }

    // Update anchor info in input area
    const anchorLetter = document.getElementById('anchor-letter');
    const anchorPos = document.getElementById('anchor-position');
    if (selectedAnchorKey) {
      if (anchorLetter) anchorLetter.textContent = cellData.letter;
      if (anchorPos) anchorPos.textContent = `(${row},${col})`;
    } else {
      if (anchorLetter) anchorLetter.textContent = '-';
      if (anchorPos) anchorPos.textContent = '(-,-)';
    }

    // Re-render to update CSS classes
    renderBoard();
  }

  // --------------------------------------------------------
  // Public helpers for other modules
  // --------------------------------------------------------

  /**
   * Mark cells as newly placed (for highlight animation).
   * @param {Array<{row: number, col: number}>} cells
   */
  function markNewCells(cells) {
    newCellKeys.clear();
    for (const { row, col } of cells) {
      newCellKeys.add(BoardModule.cellKey(row, col));
    }
    // Auto-clear after animation duration
    setTimeout(() => {
      newCellKeys.clear();
      renderBoard();
    }, 600);
  }

  /**
   * Update anchor cell highlights based on current board state.
   */
  function updateAnchorHighlights() {
    anchorCellKeys.clear();
    const anchors = BoardModule.getAnchorCells();
    for (const { row, col } of anchors) {
      anchorCellKeys.add(BoardModule.cellKey(row, col));
    }
  }

  /**
   * Clear all rendered state (call on board reset).
   */
  function clearRenderedState() {
    renderedCells.clear();
    lastBounds = null;
    newCellKeys.clear();
    anchorCellKeys.clear();
    selectedAnchorKey = null;
    clearWordColors();
  }

  /**
   * Toggle debug coordinate display on all cells.
   */
  function toggleDebugRender() {
    const isDebug = BoardModule.isDebugMode();
    for (const [key, el] of renderedCells) {
      const existingCoord = el.querySelector('.cell__coord');
      if (isDebug && !existingCoord) {
        const row = el.dataset.row;
        const col = el.dataset.col;
        const coord = document.createElement('span');
        coord.className = 'cell__coord';
        coord.textContent = `${row},${col}`;
        el.appendChild(coord);
      } else if (!isDebug && existingCoord) {
        existingCoord.remove();
      }
    }
  }

  // --------------------------------------------------------
  // Scroll to Word — Tahap 04
  // --------------------------------------------------------

  /**
   * Scroll the board container so that the specified word is centered
   * in the viewport. Accounts for current zoom level.
   * @param {Word} word - The word object to scroll to
   * @param {boolean} [smooth=true] - Use smooth scrolling
   */
  function scrollToWord(word, smooth = true) {
    const container = document.getElementById('board-container');
    const gridEl = document.getElementById('board-grid');
    if (!container || !gridEl || !word) return;

    const bounds = BoardModule.getBounds();
    if (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol) return;

    // Calculate the center position of the word in grid coordinates
    const positions = BoardModule.getWordCellPositions(word);
    if (positions.length === 0) return;

    // Find center of the word
    let centerRow = 0, centerCol = 0;
    for (const pos of positions) {
      centerRow += pos.row;
      centerCol += pos.col;
    }
    centerRow /= positions.length;
    centerCol /= positions.length;

    // Convert grid coordinates to pixel position
    const cellSize = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--cell-size')) || 40;
    const zoom = ZoomModule.getLevel();

    // Pixel position of the word center relative to grid origin
    const gridPadding = 2; // board-grid padding
    const pixelX = gridPadding + (centerCol - bounds.minCol) * cellSize + cellSize / 2;
    const pixelY = gridPadding + (centerRow - bounds.minRow) * cellSize + cellSize / 2;

    // Account for zoom
    const zoomedX = pixelX * zoom;
    const zoomedY = pixelY * zoom;

    // Scroll to center the word in the container viewport
    const targetScrollLeft = zoomedX - container.clientWidth / 2;
    const targetScrollTop = zoomedY - container.clientHeight / 2;

    if (smooth) {
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft = Math.max(0, targetScrollLeft);
      container.scrollTop = Math.max(0, targetScrollTop);
    }
  }

  /**
   * Scroll to a specific cell position on the board.
   * @param {number} row
   * @param {number} col
   * @param {boolean} [smooth=true]
   */
  function scrollToCell(row, col, smooth = true) {
    const container = document.getElementById('board-container');
    if (!container) return;

    const cellEl = renderedCells.get(BoardModule.cellKey(row, col));
    if (!cellEl) return;

    // Get cell's position relative to the container
    const zoom = ZoomModule.getLevel();
    const cellRect = cellEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate desired scroll position to center the cell
    const offsetLeft = cellEl.offsetLeft * zoom;
    const offsetTop = cellEl.offsetTop * zoom;

    const targetScrollLeft = offsetLeft - container.clientWidth / 2 + cellEl.offsetWidth * zoom / 2;
    const targetScrollTop = offsetTop - container.clientHeight / 2 + cellEl.offsetHeight * zoom / 2;

    if (smooth) {
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft = Math.max(0, targetScrollLeft);
      container.scrollTop = Math.max(0, targetScrollTop);
    }
  }

  // --------------------------------------------------------
  // Minimap — Tahap 04
  // --------------------------------------------------------

  /** @type {boolean} Whether minimap is visible */
  let minimapVisible = true;

  /**
   * Update the minimap to reflect current board state and viewport position.
   */
  function updateMinimap() {
    const minimapEl = document.getElementById('minimap');
    const canvas = document.getElementById('minimap-canvas');
    const viewportEl = document.getElementById('minimap-viewport');
    const container = document.getElementById('board-container');
    const gridEl = document.getElementById('board-grid');

    if (!minimapEl || !canvas || !viewportEl || !container || !gridEl) return;

    const bounds = BoardModule.getBounds();
    const totalRows = bounds.maxRow - bounds.minRow + 1;
    const totalCols = bounds.maxCol - bounds.minCol + 1;

    if (totalRows <= 0 || totalCols <= 0) {
      minimapEl.style.display = 'none';
      return;
    }

    if (!minimapVisible) {
      minimapEl.style.display = 'none';
      return;
    }

    minimapEl.style.display = '';

    // Set canvas size
    const minimapWidth = minimapEl.clientWidth;
    const minimapHeight = minimapEl.clientHeight;
    canvas.width = minimapWidth;
    canvas.height = minimapHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, minimapWidth, minimapHeight);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, minimapWidth, minimapHeight);

    // Calculate cell size in minimap
    const cellW = minimapWidth / totalCols;
    const cellH = minimapHeight / totalRows;

    // Draw filled cells
    const allCells = BoardModule.getAllCells();
    for (const { row, col, cellData } of allCells) {
      if (cellData.letter) {
        const isIntersect = cellData.partOfWords && cellData.partOfWords.length >= 2;
        ctx.fillStyle = isIntersect ? '#2d6a4f' : '#1e3a5f';
        ctx.fillRect(
          (col - bounds.minCol) * cellW,
          (row - bounds.minRow) * cellH,
          cellW,
          cellH
        );
      }
    }

    // Calculate viewport indicator position
    const zoom = ZoomModule.getLevel();
    const gridWidth = gridEl.scrollWidth;
    const gridHeight = gridEl.scrollHeight;

    if (gridWidth > 0 && gridHeight > 0) {
      const vpLeft = (container.scrollLeft / (gridWidth * zoom)) * minimapWidth;
      const vpTop = (container.scrollTop / (gridHeight * zoom)) * minimapHeight;
      const vpWidth = (container.clientWidth / (gridWidth * zoom)) * minimapWidth;
      const vpHeight = (container.clientHeight / (gridHeight * zoom)) * minimapHeight;

      viewportEl.style.left = `${Math.max(0, vpLeft)}px`;
      viewportEl.style.top = `${Math.max(0, vpTop)}px`;
      viewportEl.style.width = `${Math.min(minimapWidth - vpLeft, vpWidth)}px`;
      viewportEl.style.height = `${Math.min(minimapHeight - vpTop, vpHeight)}px`;
    }
  }

  /**
   * Toggle minimap visibility.
   * @param {boolean} [visible] - If omitted, toggle current state
   */
  function toggleMinimap(visible) {
    minimapVisible = visible !== undefined ? visible : !minimapVisible;
    const minimapEl = document.getElementById('minimap');
    if (minimapEl) {
      minimapEl.style.display = minimapVisible ? '' : 'none';
    }
    if (minimapVisible) {
      updateMinimap();
    }
  }

  // --------------------------------------------------------
  // Public API
  // --------------------------------------------------------
  return {
    showScreen,
    showToast,
    renderBoard,
    markNewCells,
    updateAnchorHighlights,
    clearRenderedState,
    toggleDebugRender,
    getSelectedAnchor: () => selectedAnchorKey,
    scrollToWord,
    scrollToCell,
    updateMinimap,
    toggleMinimap,
    updateHUD:       (data) => { /* Tahap 39 */ },
    showAutocomplete:(suggestions) => { /* Tahap 38 */ },
    animatePlacement:(cells) => { /* Tahap 43 */ },
    animateLifeLoss: (playerId) => { /* Tahap 44 */ }
  };
})();


// ============================================================
// --- MULTIPLAYER MODULE ---
// Handles local turn-based and Bluetooth/WebRTC multiplayer.
// ============================================================
const MultiplayerModule = (() => {
  let isHost = false;
  let connection = null;

  // Public API (to be implemented in later tahaps)
  return {
    initLocal:      (playerCount) => { /* Tahap 45 */ },
    connectBluetooth: () => { /* Tahap 46 */ },
    connectWebRTC:   () => { /* Tahap 46 */ },
    syncState:      (gameState) => { /* Tahap 47 */ },
    disconnect:     () => { /* Tahap 48 */ },
    isMultiplayer:  () => !!connection
  };
})();


// ============================================================
// --- AUDIO MODULE ---
// Manages sound effects and background music.
// ============================================================
const AudioModule = (() => {
  let volume = 0.7;
  let bgmPlaying = false;

  // Public API (to be implemented in later tahaps)
  return {
    playSFX:    (name) => { /* Tahap 53 */ },
    playBGM:    () => { /* Tahap 54 */ },
    stopBGM:    () => { /* Tahap 54 */ },
    setVolume:  (v) => { volume = Math.max(0, Math.min(1, v)); },
    getVolume:  () => volume
  };
})();


// ============================================================
// --- AI MODULE ---
// Bot player logic with basic and advanced strategies.
// ============================================================
const AIModule = (() => {
  // Public API (to be implemented in later tahaps)
  return {
    takeTurn:      (board, usedWords) => { /* Tahap 50 */ },
    findBestWord:  (board, usedWords, mode) => { /* Tahap 51 */ },
    adaptToChaos:  (lockedDirections) => { /* Tahap 52 */ }
  };
})();


// ============================================================
// --- GAME CONTROLLER ---
// Main game initialization and event binding.
// Tahap 04: Zoom via ZoomModule, minimap, scroll-to-word
// ============================================================
const GameController = (() => {
  let selectedMode = 'classic';
  let selectedPlayerCount = 1;

  /**
   * Initialize the game: bind events, show main menu.
   */
  function init() {
    bindMenuEvents();
    bindModeEvents();
    bindGameEvents();
    bindSettingsEvents();

    // Bind zoom/pan events
    ZoomModule.bindEvents();

    // Start at main menu
    UIModule.showScreen('menu');

    console.log('[Sambung Kata Silang] Initialized — Tahap 04');
    console.log('[BoardModule] Available:', Object.keys(BoardModule).join(', '));
    console.log('[ZoomModule] Available:', Object.keys(ZoomModule).join(', '));
    console.log('[UIModule] Available:', Object.keys(UIModule).join(', '));
  }

  // --- MENU EVENTS ---
  function bindMenuEvents() {
    document.getElementById('btn-play')?.addEventListener('click', () => {
      UIModule.showScreen('mode');
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      UIModule.showScreen('settings');
    });

    document.getElementById('btn-about')?.addEventListener('click', () => {
      UIModule.showScreen('about');
    });
  }

  // --- MODE SELECTION EVENTS ---
  function bindModeEvents() {
    // Mode card selection
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('mode-card--selected'));
        card.classList.add('mode-card--selected');
        selectedMode = card.dataset.mode;
      });
    });

    // Player count
    document.getElementById('player-count')?.addEventListener('change', (e) => {
      selectedPlayerCount = parseInt(e.target.value, 10);
    });

    // Start game
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      startGame();
    });

    // Back to menu
    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
      UIModule.showScreen('menu');
    });
  }

  // --- GAME EVENTS ---
  function bindGameEvents() {
    // Direction buttons
    document.querySelectorAll('.dir-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('dir-btn--selected'));
        btn.classList.add('dir-btn--selected');
      });
    });

    // Submit word
    document.getElementById('btn-submit-word')?.addEventListener('click', () => {
      submitWord();
    });

    // Enter key on word input
    document.getElementById('word-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitWord();
      }
    });

    // Zoom controls — now using ZoomModule
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      ZoomModule.zoomIn();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      ZoomModule.zoomOut();
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      ZoomModule.resetZoom();
    });

    // Game over buttons
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      startGame();
    });

    document.getElementById('btn-back-menu-gameover')?.addEventListener('click', () => {
      UIModule.showScreen('menu');
    });
  }

  // --- SETTINGS EVENTS ---
  function bindSettingsEvents() {
    document.getElementById('btn-back-settings')?.addEventListener('click', () => {
      UIModule.showScreen('menu');
    });

    document.getElementById('btn-back-about')?.addEventListener('click', () => {
      UIModule.showScreen('menu');
    });

    // Volume
    document.getElementById('setting-volume')?.addEventListener('input', (e) => {
      AudioModule.setVolume(parseInt(e.target.value, 10) / 100);
    });

    // Theme toggle
    document.getElementById('setting-theme')?.addEventListener('change', (e) => {
      toggleTheme(e.target.value);
    });
  }

  // --- GAME LOGIC (stubs for later tahaps) ---

  function startGame() {
    UIModule.showScreen('game');
    TurnModule.setGameMode(selectedMode);

    // Reset board and rendered state
    BoardModule.reset();
    UIModule.clearRenderedState();

    // Reset zoom to default
    ZoomModule.resetZoom(false);

    // Update HUD with selected mode
    const hudMode = document.getElementById('hud-mode');
    if (hudMode) {
      const modeNames = {
        classic: 'Classic',
        blitz: 'Blitz',
        infinite: 'Infinite',
        hard: 'Hard',
        chaos: 'Chaos'
      };
      hudMode.textContent = modeNames[selectedMode] || 'Classic';
    }

    // Render empty board
    UIModule.renderBoard();

    UIModule.showToast(`Game dimulai! Mode: ${selectedMode}`, 'success');
    console.log(`[Game] Starting game — Mode: ${selectedMode}, Players: ${selectedPlayerCount}`);
  }

  function submitWord() {
    const input = document.getElementById('word-input');
    if (!input) return;
    const word = input.value.trim().toUpperCase();
    if (!word) return;

    // Stub: will be implemented in later tahaps
    console.log(`[Game] Word submitted: "${word}"`);
    UIModule.showToast(`Kata "${word}" dikirim (belum divalidasi)`, 'info');
    input.value = '';
  }

  // --- THEME ---
  function toggleTheme(theme) {
    if (theme === 'light') {
      document.documentElement.style.setProperty('--bg-primary', '#f5f5f5');
      document.documentElement.style.setProperty('--bg-secondary', '#e0e0e0');
      document.documentElement.style.setProperty('--bg-tertiary', '#d0d0d0');
      document.documentElement.style.setProperty('--text-primary', '#1a1a2e');
      document.documentElement.style.setProperty('--text-secondary', '#444466');
      document.documentElement.style.setProperty('--text-muted', '#888899');
      document.documentElement.style.setProperty('--cell-border', '#b0b0c0');
    } else {
      document.documentElement.style.setProperty('--bg-primary', '#0f0f1a');
      document.documentElement.style.setProperty('--bg-secondary', '#1a1a2e');
      document.documentElement.style.setProperty('--bg-tertiary', '#16213e');
      document.documentElement.style.setProperty('--text-primary', '#e8e8e8');
      document.documentElement.style.setProperty('--text-secondary', '#a0a0b8');
      document.documentElement.style.setProperty('--text-muted', '#6c6c80');
      document.documentElement.style.setProperty('--cell-border', '#2a2a4a');
    }
    // Re-render minimap with new theme colors
    UIModule.updateMinimap();
  }

  // Public API
  return {
    init,
    startGame,
    submitWord
  };
})();


// ============================================================
// --- INITIALIZATION ---
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  GameController.init();
});
