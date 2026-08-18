/* ============================================================
   SAMBUNG KATA SILANG — Game Logic
   Tahap 01: Fondasi Proyek & Struktur File
   ============================================================ */

'use strict';

// ============================================================
// --- BOARD MODULE ---
// Manages the 2D grid, cells, word placement, and board state.
// ============================================================
const BoardModule = (() => {
  // Private state
  let cells = new Map();   // key: "row,col" → CellData
  let words = new Map();   // key: wordId → Word
  let wordSet = new Set(); // Set of uppercase words already placed

  // CellData: { letter, wordId, direction, partOfWords }
  // Word: { id, text, startRow, startCol, direction, length, playerId }

  // Public API (to be implemented in later tahaps)
  return {
    getCell:       (row, col) => { /* Tahap 02 */ },
    setCell:       (row, col, letter, wordId, direction) => { /* Tahap 02 */ },
    isCellEmpty:   (row, col) => { /* Tahap 02 */ },
    getBounds:     () => { /* Tahap 02 */ },
    clearCell:     (row, col) => { /* Tahap 02 */ },
    getWords:      () => words,
    getWordSet:    () => wordSet,
    reset:         () => { cells.clear(); words.clear(); wordSet.clear(); }
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

    console.log('[Sambung Kata Silang] Initialized — Tahap 01');
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
