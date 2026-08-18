/* ============================================================
   SAMBUNG KATA SILANG — Game Logic
   Tahap 02: Desain Grid/Board — Model Data
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
// --- UI MODULE ---
// Manages DOM rendering, screen navigation, and user interaction.
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

  /**
   * Show a toast notification.
   * @param {string} message - Toast text
   * @param {string} type - 'success' | 'error' | 'info'
   * @param {number} duration - Duration in ms (default 2500)
   */
  function showToast(message, type = 'info', duration = 2500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  // Public API
  return {
    showScreen,
    showToast,
    renderBoard:     (board) => { /* Tahap 03 */ },
    scrollToWord:    (word) => { /* Tahap 04 */ },
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

    // Start at main menu
    UIModule.showScreen('menu');

    console.log('[Sambung Kata Silang] Initialized — Tahap 02');
    console.log('[BoardModule] Available:', Object.keys(BoardModule).join(', '));
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

    // Zoom controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      zoomBoard(0.1);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      zoomBoard(-0.1);
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      resetZoom();
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

  // --- ZOOM (stub for Tahap 04) ---
  let currentZoom = 1.0;

  function zoomBoard(delta) {
    currentZoom = Math.max(0.5, Math.min(2.0, currentZoom + delta));
    const grid = document.getElementById('board-grid');
    if (grid) {
      grid.style.transform = `scale(${currentZoom})`;
    }
  }

  function resetZoom() {
    currentZoom = 1.0;
    const grid = document.getElementById('board-grid');
    if (grid) {
      grid.style.transform = 'scale(1)';
    }
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
  }

  // Public API
  return {
    init,
    startGame,
    submitWord,
    zoomBoard,
    resetZoom
  };
})();


// ============================================================
// --- INITIALIZATION ---
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  GameController.init();
});
