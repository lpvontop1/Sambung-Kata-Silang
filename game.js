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

      // Direction semantics (Tahap 11+):
      //   'right'/'down' — start position is the LEFTMOST/TOPMOST cell (anchor at
      //     position 0, first letter); cells extend in INCREASING col/row.
      //   'left'/'up'   — start position is the LEFTMOST/TOPMOST cell (anchor at
      //     position N-1, LAST letter); cells also extend in INCREASING col/row.
      //     (Player chose left/up placement, but cells still read left-to-right
      //     or top-to-bottom with FORWARD text — only the anchor position differs.)
      switch (word.direction) {
        case 'right': col += i; break;                  // anchor at position 0
        case 'left':  col += i; break;                  // anchor at position N-1 (Tahap 11)
        case 'down':  row += i; break;                  // anchor at position 0
        case 'up':    row += i; break;                  // anchor at position N-1 (Tahap 13)
        default: break;
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

/**
 * KBBITrie — Prefix tree (Trie) untuk lookup kata cepat.
 *
 * Tahap 06 spec:
 *   - root: TrieNode { children: {}, isEndOfWord: false }
 *   - insert(word)              — tambah kata (juga ke reverse trie)
 *   - search(word)              — boolean exact lookup
 *   - startsWith(prefix)        — boolean, ada kata berawalan prefix?
 *   - getWordsByPrefix(prefix, limit=20) — autocomplete, DFS dari node prefix
 *   - getWordsBySuffix(suffix, limit=20) — pake reverse trie, lalu un-reverse
 *   - loadFromJSON(jsonData)    — batch insert dari {words:[...]}
 *   - reverseRoot              — root trie terbalik untuk lookup akhiran
 *
 * Performance: insert 100.000 kata < 2 detik (object-based children,
 * no Map overhead). Memory: gunakan plain object untuk children.
 */
class KBBITrie {
  constructor() {
    // Forward trie — root untuk pencarian awalan & exact match
    this.root = this._newNode();
    // Reverse trie — root untuk pencarian akhiran (kata disimpan terbalik)
    this.reverseRoot = this._newNode();
    // Hitung kata unik yang sudah di-insert (untuk statistik & test)
    this._size = 0;
  }

  /** Factory node — pakai object biasa, bukan Map, untuk efisiensi memory. */
  _newNode() {
    return { children: {}, isEndOfWord: false };
  }

  /** Normalize input ke UPPERCASE. */
  _normalize(word) {
    return (typeof word === 'string') ? word.toUpperCase() : '';
  }

  /**
   * Insert kata ke forward trie dan reverse trie.
   * Idempotent — kata yang sama di-insert dua kali tidak menambah _size.
   */
  insert(word) {
    const w = this._normalize(word);
    if (!w) return;
    // Forward
    let node = this.root;
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      if (!node.children[ch]) node.children[ch] = this._newNode();
      node = node.children[ch];
    }
    const wasNew = !node.isEndOfWord;
    node.isEndOfWord = true;

    // Reverse (kata dibalik)
    let rnode = this.reverseRoot;
    for (let i = w.length - 1; i >= 0; i--) {
      const ch = w[i];
      if (!rnode.children[ch]) rnode.children[ch] = this._newNode();
      rnode = rnode.children[ch];
    }
    rnode.isEndOfWord = true;

    if (wasNew) this._size++;
  }

  /** Exact match lookup. Case-insensitive (input di-UPPERCASE-kan). */
  search(word) {
    const w = this._normalize(word);
    if (!w) return false;
    let node = this.root;
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return node.isEndOfWord;
  }

  /** Boolean — apakah ada minimal satu kata berawalan `prefix`? */
  startsWith(prefix) {
    const p = this._normalize(prefix);
    if (!p) return false;
    let node = this.root;
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return true;
  }

  /** Cari node di forward trie yang berakhir di prefix. */
  _descend(root, str) {
    let node = root;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (!node.children[ch]) return null;
      node = node.children[ch];
    }
    return node;
  }

  /**
   * DFS preorder untuk kumpulkan kata.
   * @private
   * @param {TrieNode} node — node saat ini
   * @param {string}   current — string yang sudah terbentuk
   * @param {number}   limit  — batas hasil
   * @param {string[]} out — accumulator
   */
  _collect(node, current, limit, out) {
    if (out.length >= limit) return;
    if (node.isEndOfWord) {
      out.push(current);
      if (out.length >= limit) return;
    }
    // Sort keys supaya hasil deterministik (alfabetis)
    const keys = Object.keys(node.children).sort();
    for (const ch of keys) {
      this._collect(node.children[ch], current + ch, limit, out);
      if (out.length >= limit) return;
    }
  }

  /**
   * Return daftar kata yang berawalan `prefix`, dibatasi `limit`
   * (default 20, untuk autocomplete). Hasil sorted alfabetis.
   */
  getWordsByPrefix(prefix, limit = 20) {
    const p = this._normalize(prefix);
    if (!p) return [];
    const node = this._descend(this.root, p);
    if (!node) return [];
    const out = [];
    this._collect(node, p, limit, out);
    return out;
  }

  /**
   * Return daftar kata yang berakhiran `suffix`, dibatasi `limit`.
   * Memakai reverse trie: traverse suffix secara terbalik, lalu
   * kumpulkan kata (yang juga tersimpan terbalik), lalu un-reverse.
   */
  getWordsBySuffix(suffix, limit = 20) {
    const s = this._normalize(suffix);
    if (!s) return [];
    // Traverse reverse trie dengan suffix yang dibalik
    const reversedSuffix = s.split('').reverse().join('');
    const node = this._descend(this.reverseRoot, reversedSuffix);
    if (!node) return [];
    const reversedOut = [];
    // current dalam collect = reversedSuffix (karena di reverse trie,
    // kita traverse dari suffix-yang-dibalik lalu menambah huruf di belakang).
    // Hasilnya adalah kata-kata yang TERSIMPAN terbalik, jadi perlu un-reverse.
    this._collect(node, reversedSuffix, limit, reversedOut);
    return reversedOut.map((w) => w.split('').reverse().join(''));
  }

  /** Batch insert dari objek { version, source, wordCount, words[] }. */
  loadFromJSON(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('KBBITrie.loadFromJSON: jsonData must be an object');
    }
    if (!Array.isArray(jsonData.words)) {
      throw new Error('KBBITrie.loadFromJSON: jsonData.words must be an array');
    }
    for (let i = 0; i < jsonData.words.length; i++) {
      this.insert(jsonData.words[i]);
    }
  }

  /** Reset trie ke kondisi kosong (untuk test / reload). */
  clear() {
    this.root = this._newNode();
    this.reverseRoot = this._newNode();
    this._size = 0;
  }

  /** Jumlah kata unik yang sudah di-insert. */
  size() {
    return this._size;
  }

  /** Statistik ringan untuk debug. */
  getStats() {
    let nodeCount = 0;
    const walk = (n) => {
      nodeCount++;
      for (const k of Object.keys(n.children)) walk(n.children[k]);
    };
    walk(this.root);
    let reverseNodeCount = 0;
    const walkR = (n) => {
      reverseNodeCount++;
      for (const k of Object.keys(n.children)) walkR(n.children[k]);
    };
    walkR(this.reverseRoot);
    return {
      wordCount: this._size,
      forwardNodeCount: nodeCount,
      reverseNodeCount: reverseNodeCount,
      totalNodeCount: nodeCount + reverseNodeCount,
    };
  }
}


const KBBIModule = (() => {
  // Singleton: satu instance KBBITrie global, di-share selama game berjalan.
  let trie = null;
  let loaded = false;        // true setelah loadFromJSON atau loadChunk berhasil
  let wordCount = 0;
  let loadedLetters = new Set();   // huruf yang sudah lazy-load (untuk loadChunk)

  function ensureTrie() {
    if (!trie) trie = new KBBITrie();
    return trie;
  }

  // Helper — resolve path chunk file relatif ke dokumen/game.js.
  // Deteksi environment: kalau `require` + `process.cwd` tersedia → Node
  // (test/CLI), pakai fs synchronously. Kalau tidak, pakai fetch (browser;
  // relative path bekerja karena halaman HTML di-root).
  // NB: `__dirname` di vm.runInThisContext bernilai '.', jadi tidak bisa
  // dipakai untuk resolve path file. `process.cwd()` dipakai sebagai gantinya
  // (test runner selalu menjalankan dari root project).
  function _readChunkFile(letterLower) {
    const relPath = `data/kbbi-${letterLower}.json`;
    return new Promise((resolve, reject) => {
      if (typeof require === 'function' &&
          typeof process !== 'undefined' && process && typeof process.cwd === 'function') {
        // Node environment (tests, CLI)
        try {
          const fs = require('fs');
          const path = require('path');
          const file = path.resolve(process.cwd(), relPath);
          const json = JSON.parse(fs.readFileSync(file, 'utf8'));
          resolve(json);
        } catch (e) {
          reject(e);
        }
      } else if (typeof fetch === 'function') {
        // Browser environment
        fetch(relPath)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${relPath}`);
            return res.json();
          })
          .then(resolve, reject);
      } else {
        reject(new Error('Tidak ada fetch atau fs — loadChunk tidak bisa baca file'));
      }
    });
  }

  return {
    /**
     * Load seluruh dictionary dari objek JSON {words:[...]}.
     * Setelah ini, search() dan startsWith() dapat digunakan.
     */
    loadFromJSON: (jsonData) => {
      const t = ensureTrie();
      t.loadFromJSON(jsonData);
      loaded = true;
      wordCount = t.size();
      loadedLetters.clear();
      // Tandai semua huruf A-Z sudah loaded
      for (let i = 65; i <= 90; i++) loadedLetters.add(String.fromCharCode(i));
    },

    /** Trie sudah berisi data? */
    isLoaded: () => loaded,

    /** Jumlah kata di trie saat ini. */
    getWordCount: () => wordCount,

    /** Set huruf yang sudah lazy-loaded via loadChunk (untuk debug). */
    getLoadedLetters: () => Array.from(loadedLetters).sort(),

    /** Reset state module (utk test). */
    reset: () => {
      if (trie) trie.clear();
      trie = null;
      loaded = false;
      wordCount = 0;
      loadedLetters.clear();
    },

    /** Expose trie instance untuk test/inspeksi (jangan dipakai di game). */
    getTrie: () => trie,

    /** Exact lookup. Case-insensitive. */
    search: (word) => {
      if (!loaded || !trie) return false;
      return trie.search(word);
    },

    /** Boolean — ada kata berawalan `prefix`? */
    startsWith: (prefix) => {
      if (!loaded || !trie) return false;
      return trie.startsWith(prefix);
    },

    /**
     * Lazy load chunk per huruf awal.
     * Membaca data/kbbi-{letter}.json, insert semua kata ke trie.
     * Idempotent — loadChunk('A') dua kali tidak menambah duplikat.
     * @param {string} letter — single char A-Z (case-insensitive)
     * @returns {Promise<number>} jumlah kata baru yang di-insert
     */
    loadChunk: async (letter) => {
      if (typeof letter !== 'string' || letter.length !== 1 ||
          !/^[A-Za-z]$/.test(letter)) {
        throw new Error(`loadChunk: letter harus A-Z (got: ${JSON.stringify(letter)})`);
      }
      const L = letter.toUpperCase();
      const before = trie ? trie.size() : 0;
      const t = ensureTrie();
      if (loadedLetters.has(L)) {
        // sudah pernah di-load, tidak ada penambahan
        return 0;
      }
      const json = await _readChunkFile(L.toLowerCase());
      if (!json || !Array.isArray(json.words)) {
        throw new Error(`loadChunk: file chunk ${L} tidak valid`);
      }
      const beforeSize = t.size();
      for (let i = 0; i < json.words.length; i++) {
        t.insert(json.words[i]);
      }
      loadedLetters.add(L);
      wordCount = t.size();
      // Tandai loaded=true setelah chunk pertama berhasil, supaya
      // search/startsWith dapat dipanggil (walau hanya untuk huruf ini).
      loaded = true;
      return t.size() - beforeSize;
    },

    // Tahap 08 — wired: delegate to KBBITrie.getWordsByPrefix
    getWordsByPrefix: (prefix, limit) => {
      if (!loaded || !trie) return [];
      return trie.getWordsByPrefix(prefix, limit);
    },
    // Tahap 09 — wired: delegate to KBBITrie.getWordsBySuffix (uses reverse trie)
    getWordsBySuffix: (suffix, limit) => {
      if (!loaded || !trie) return [];
      return trie.getWordsBySuffix(suffix, limit);
    },
  };
})();


// ============================================================
// --- VALIDATION MODULE ---
// Validates words against KBBI, checks placement constraints.
// ============================================================
const ValidationModule = (() => {
  /**
   * Normalize input word: trim whitespace + uppercase.
   * Non-string inputs return ''.
   * @private
   */
  function _normalize(word) {
    if (typeof word !== 'string') return '';
    return word.trim().toUpperCase();
  }

  /**
   * isValidWord(word) — boolean.
   *
   * Flow (per Tahap 07 spec):
   *   1. Normalize: trim whitespace + UPPERCASE
   *   2. Empty → false
   *   3. Length-1 words: valid only if they exist in KBBI
   *   4. Length ≥ 2: lookup KBBITrie.search(normalized)
   *
   * @param {string} word
   * @returns {boolean}
   */
  function isValidWord(word) {
    return validateWordWithDetail(word).valid;
  }

  /**
   * validateWordWithDetail(word) — returns detailed validation result.
   *
   * @param {string} word
   * @returns {{ valid: boolean, reason: string, normalized: string }}
   *   reason values:
   *     "valid"        — word is in KBBI
   *     "empty"        — input is empty / whitespace-only / non-string
   *     "too_short"    — length 1 and not in KBBI (single-char that isn't a KBBI lemma)
   *     "not_in_kbbi"  — length ≥ 2 but not found in KBBI
   */
  function validateWordWithDetail(word) {
    const normalized = _normalize(word);
    if (!normalized) {
      return { valid: false, reason: 'empty', normalized: '' };
    }
    if (!KBBIModule.isLoaded()) {
      // KBBI hasn't been loaded yet — can't validate against the dictionary.
      // Treat as not_in_kbbi (safer than valid). UI should warn user to load KBBI first.
      return { valid: false, reason: 'not_in_kbbi', normalized };
    }
    // Length-1 words are valid ONLY if they exist in KBBI
    if (normalized.length < 2) {
      if (KBBIModule.search(normalized)) {
        return { valid: true, reason: 'valid', normalized };
      }
      return { valid: false, reason: 'too_short', normalized };
    }
    // Length >= 2: lookup KBBI
    if (KBBIModule.search(normalized)) {
      return { valid: true, reason: 'valid', normalized };
    }
    return { valid: false, reason: 'not_in_kbbi', normalized };
  }

  /**
   * isTypo(word, maxDistance=1) — boolean (advanced, per Tahap 07 spec).
   *
   * Checks if `word` is "close" to any KBBI word (edit distance ≤ maxDistance).
   * Returns true if there's a KBBI word within the distance (indicating a
   * likely typo rather than a random string).
   *
   * Algorithm: BFS over edit-distance-1 variants (deletions + insertions +
   * substitutions of A-Z). For each variant, do a fast KBBITrie.search lookup.
   * Default maxDistance=1 for speed; maxDistance=2 supported but slower.
   *
   * @param {string} word
   * @param {number} [maxDistance=1] — 1 or 2 (capped at 2 for performance)
   * @returns {boolean} true if a nearby KBBI word exists (excluding exact match)
   */
  function isTypo(word, maxDistance = 1) {
    const normalized = _normalize(word);
    if (!normalized) return false;
    if (!KBBIModule.isLoaded()) return false;
    // Exact match → not a typo
    if (KBBIModule.search(normalized)) return false;
    if (maxDistance < 1) return false;
    if (maxDistance > 2) maxDistance = 2;

    // BFS over edit-distance-1 variants
    const seen = new Set([normalized]);
    let frontier = [normalized];
    const VARIANT_LIMIT = 60000; // safety valve for distance 2 on long words
    let explored = 0;

    for (let d = 0; d < maxDistance; d++) {
      const next = [];
      for (const w of frontier) {
        for (const v of _editDistance1Variants(w)) {
          if (seen.has(v)) continue;
          seen.add(v);
          explored++;
          if (KBBIModule.search(v)) return true;
          next.push(v);
          if (explored > VARIANT_LIMIT) return false;
        }
      }
      frontier = next;
    }
    return false;
  }

  /**
   * Generator: all edit-distance-1 variants of `word`.
   * - Deletions:        L variants
   * - Insertions (A-Z): (L+1) * 26 variants
   * - Substitutions:    L * 25 variants (skip same char)
   * Total: ~52L + 26 variants per word.
   * @private
   */
  function* _editDistance1Variants(word) {
    const L = word.length;
    // Deletions
    for (let i = 0; i < L; i++) {
      yield word.slice(0, i) + word.slice(i + 1);
    }
    // Insertions
    for (let i = 0; i <= L; i++) {
      for (let c = 65; c <= 90; c++) {
        const ch = String.fromCharCode(c);
        yield word.slice(0, i) + ch + word.slice(i);
      }
    }
    // Substitutions
    for (let i = 0; i < L; i++) {
      for (let c = 65; c <= 90; c++) {
        const ch = String.fromCharCode(c);
        if (ch !== word[i]) {
          yield word.slice(0, i) + ch + word.slice(i + 1);
        }
      }
    }
  }

  /**
   * Levenshtein distance between two strings.
   * Classic DP: O(m*n) time, O(m*n) space.
   * Exposed for tests and external use.
   *
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return (b || '').length;
    if (!b) return (a || '').length;
    if (typeof a !== 'string') a = String(a);
    if (typeof b !== 'string') b = String(b);
    const m = a.length, n = b.length;
    // 1D DP for memory efficiency
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,        // deletion
          curr[j - 1] + 1,    // insertion
          prev[j - 1] + cost // substitution
        );
      }
      [prev, curr] = [curr, prev]; // swap rows
    }
    return prev[n];
  }

  // Public API
  return {
    isValidWord,
    validateWordWithDetail,
    isTypo,
    levenshtein,
    // Internal helpers exposed for testing
    _normalize,
    _editDistance1Variants,
    // Stubs preserved for later tahaps
    validatePlacement:           (cells, board) => { /* Tahap 16 */ },
    validateNoAdjacentConflict:  (cells, board, direction) => { /* Tahap 16 */ },
    validateAccidentalWords:     (cells, board, direction) => { /* Tahap 16 */ },
    isWordUsed:                  (word) => { /* Tahap 17 */ },
  };
})();


// ============================================================
// --- SEARCH MODULE (Tahap 08) ---
// Higher-level prefix search helpers (autocomplete, valid candidates,
// random picks, hints). Delegates to KBBIModule.getWordsByPrefix,
// which in turn calls KBBITrie.getWordsByPrefix.
// ============================================================
const SearchModule = (() => {
  /**
   * Normalize prefix: trim + UPPERCASE.
   * @private
   */
  function _normalize(prefix) {
    if (typeof prefix !== 'string') return '';
    return prefix.trim().toUpperCase();
  }

  /**
   * Seeded LCG (deterministic) so getRandomWordByPrefix returns
   * reproducible picks in tests.
   * @private
   */
  function _seededRng(seedStr) {
    let seed = 0x811c9dc5;
    for (let i = 0; i < seedStr.length; i++) {
      seed ^= seedStr.charCodeAt(i);
      seed = Math.imul(seed, 0x01000193) >>> 0;
    }
    return () => {
      seed ^= seed << 13; seed >>>= 0;
      seed ^= seed >> 17;
      seed ^= seed << 5;  seed >>>= 0;
      return seed / 0x100000000;
    };
  }

  /**
   * findWordsByPrefix(prefix, limit=20) — string[]
   * Returns up to `limit` KBBI words starting with `prefix`.
   * Spec: "Panggil KBBITrie.getWordsByPrefix(prefix, limit)".
   *
   * @param {string} prefix
   * @param {number} [limit=20]
   * @returns {string[]} — sorted alphabetically (per Trie DFS order)
   */
  function findWordsByPrefix(prefix, limit = 20) {
    const p = _normalize(prefix);
    if (!p) return [];
    if (!KBBIModule.isLoaded()) return [];
    return KBBIModule.getWordsByPrefix(p, limit);
  }

  /**
   * findValidWordsByPrefix(prefix, usedWords, limit=20) — string[]
   * Like findWordsByPrefix but excludes any word already in `usedWords`.
   *
   * @param {string} prefix
   * @param {Set<string>|string[]} usedWords — words already played (UPPERCASE)
   * @param {number} [limit=20]
   * @returns {string[]} — valid (not-yet-used) candidate words
   */
  function findValidWordsByPrefix(prefix, usedWords, limit = 20) {
    // To produce up to `limit` valid results, we may need to fetch more
    // from the trie if some matches are filtered out. Cap the fetch to
    // limit * 5 to bound work; if we can't fill `limit`, return what we have.
    const fetchLimit = limit * 5;
    const raw = findWordsByPrefix(prefix, fetchLimit);
    if (!raw.length) return [];
    // Normalize usedWords to a Set of UPPERCASE strings
    const usedSet = new Set();
    if (usedWords) {
      const iter = usedWords[Symbol.iterator] ? usedWords : Object.values(usedWords);
      for (const w of iter) {
        if (typeof w === 'string') usedSet.add(w.toUpperCase());
      }
    }
    const valid = raw.filter((w) => !usedSet.has(w));
    return valid.slice(0, limit);
  }

  /**
   * getRandomWordByPrefix(prefix, usedWords) — string | null
   * Picks a random valid word starting with `prefix`.
   * Uses a seeded RNG keyed on `prefix` for reproducibility in tests.
   *
   * @param {string} prefix
   * @param {Set<string>|string[]} usedWords
   * @returns {string|null}
   */
  function getRandomWordByPrefix(prefix, usedWords) {
    // Fetch a decent pool so the random pick is actually "random" and
    // not just the first word every time. Cap at 100 for performance.
    const pool = findValidWordsByPrefix(prefix, usedWords, 100);
    if (!pool.length) return null;
    const rng = _seededRng(_normalize(prefix));
    const idx = Math.floor(rng() * pool.length);
    return pool[idx];
  }

  /**
   * getHintByPrefix(prefix, usedWords) — string | null
   * Returns ONE suggested word starting with `prefix`, prioritizing
   * LONGER words (more points per spec Tahap 23).
   *
   * @param {string} prefix
   * @param {Set<string>|string[]} usedWords
   * @returns {string|null}
   */
  function getHintByPrefix(prefix, usedWords) {
    // Fetch a larger pool so the "longest" pick is meaningful.
    // Cap at 500 to bound work.
    const pool = findValidWordsByPrefix(prefix, usedWords, 500);
    if (!pool.length) return null;
    // Sort by length DESC; ties broken alphabetically for determinism
    pool.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    return pool[0];
  }

  // ----------------------------------------------------------------
  // Suffix search (Tahap 09) — mirror of prefix search above.
  // Uses the reverse trie via KBBIModule.getWordsBySuffix.
  // Spec: used when player picks arah KIRI or ATAS so that the new
  // word's LAST letter matches the anchor cell's letter.
  // ----------------------------------------------------------------

  /**
   * findWordsBySuffix(suffix, limit=20) — string[]
   * Returns up to `limit` KBBI words ending with `suffix`.
   * Spec: "Panggil KBBITrie.getWordsBySuffix(suffix, limit)".
   *
   * @param {string} suffix
   * @param {number} [limit=20]
   * @returns {string[]} — KBBI words ending with `suffix`
   */
  function findWordsBySuffix(suffix, limit = 20) {
    const s = _normalize(suffix);
    if (!s) return [];
    if (!KBBIModule.isLoaded()) return [];
    return KBBIModule.getWordsBySuffix(s, limit);
  }

  /**
   * findValidWordsBySuffix(suffix, usedWords, limit=20) — string[]
   * Like findWordsBySuffix but excludes any word already in `usedWords`.
   *
   * @param {string} suffix
   * @param {Set<string>|string[]} usedWords — words already played (UPPERCASE)
   * @param {number} [limit=20]
   * @returns {string[]} — valid (not-yet-used) candidate words ending with suffix
   */
  function findValidWordsBySuffix(suffix, usedWords, limit = 20) {
    // To produce up to `limit` valid results, we may need to fetch more
    // from the trie if some matches are filtered out. Cap the fetch to
    // limit * 5 to bound work; if we can't fill `limit`, return what we have.
    const fetchLimit = limit * 5;
    const raw = findWordsBySuffix(suffix, fetchLimit);
    if (!raw.length) return [];
    const usedSet = new Set();
    if (usedWords) {
      const iter = usedWords[Symbol.iterator] ? usedWords : Object.values(usedWords);
      for (const w of iter) {
        if (typeof w === 'string') usedSet.add(w.toUpperCase());
      }
    }
    const valid = raw.filter((w) => !usedSet.has(w));
    return valid.slice(0, limit);
  }

  /**
   * getRandomWordBySuffix(suffix, usedWords) — string | null
   * Picks a random valid word ending with `suffix`.
   * Uses a seeded RNG keyed on `suffix` for reproducibility in tests.
   *
   * @param {string} suffix
   * @param {Set<string>|string[]} usedWords
   * @returns {string|null}
   */
  function getRandomWordBySuffix(suffix, usedWords) {
    const pool = findValidWordsBySuffix(suffix, usedWords, 100);
    if (!pool.length) return null;
    const rng = _seededRng(_normalize(suffix));
    const idx = Math.floor(rng() * pool.length);
    return pool[idx];
  }

  /**
   * getHintBySuffix(suffix, usedWords) — string | null
   * Returns ONE suggested word ending with `suffix`, prioritizing
   * LONGER words (more points per spec Tahap 23).
   *
   * @param {string} suffix
   * @param {Set<string>|string[]} usedWords
   * @returns {string|null}
   */
  function getHintBySuffix(suffix, usedWords) {
    const pool = findValidWordsBySuffix(suffix, usedWords, 500);
    if (!pool.length) return null;
    pool.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    return pool[0];
  }

  return {
    findWordsByPrefix,
    findValidWordsByPrefix,
    getRandomWordByPrefix,
    getHintByPrefix,
    // Tahap 09 — suffix-side mirrors
    findWordsBySuffix,
    findValidWordsBySuffix,
    getRandomWordBySuffix,
    getHintBySuffix,
  };
})();


// ============================================================
// --- PLACEMENT MODULE ---
// Handles word placement in all 4 directions.
// ============================================================
const PlacementModule = (() => {
  /**
   * Normalize word: trim whitespace + UPPERCASE.
   * Non-string inputs return ''.
   * @private
   */
  function _normalize(word) {
    if (typeof word !== 'string') return '';
    return word.trim().toUpperCase();
  }

  /**
   * Build a failure PlacementResult.
   * @private
   * @param {string} reason — error code (e.g. 'not_in_kbbi')
   * @returns {{ success: false, cells: [], word: null, reason: string }}
   */
  function _fail(reason) {
    return { success: false, cells: [], word: null, reason };
  }

  /**
   * Build a success PlacementResult.
   * @private
   * @param {Array<{row,col,letter}>} cells
   * @param {object} word — Word object
   * @param {string} reason — success code (e.g. 'placed_right')
   */
  function _ok(cells, word, reason) {
    return { success: true, cells, word, reason };
  }

  /**
   * Compute cell positions for a word in a given direction, starting at
   * (anchorRow, anchorCol). Internal helper used by placeWordRight now
   * (Tahap 10). The public `calculatePositions` API is reserved for
   * Tahap 18 (handles all 4 directions in one place).
   * @private
   */
  function _positionsForDirection(word, anchorRow, anchorCol, direction) {
    const W = _normalize(word);
    const cells = [];
    const N = W.length;
    for (let i = 0; i < N; i++) {
      let row = anchorRow, col = anchorCol;
      switch (direction) {
        case 'right': col += i; break;                       // anchor at position 0 (first letter)
        case 'left':  col -= (N - 1 - i); break;             // anchor at position N-1 (LAST letter) — spec Tahap 11
        case 'down':  row += i; break;                       // anchor at position 0 (first letter) — Tahap 12
        case 'up':    row -= (N - 1 - i); break;             // anchor at position N-1 (LAST letter) — Tahap 13
        default: return null;
      }
      cells.push({ row, col, letter: W[i] });
    }
    return cells;
  }

  /**
   * Check if a cell at (row, col) is part of any horizontal word
   * (direction 'right' or 'left'). Used by the gap rule: the cells
   * immediately before/after the new word's extent must NOT be part of
   * a horizontal word, or we'd merge two horizontal words (gap = 0).
   *
   * First checks `cell.partOfWords` (more accurate — survives cell
   * direction being overwritten by later setters at intersections).
   * Falls back to `cell.direction === 'horizontal'` if no wordId in
   * partOfWords resolves (covers seed-anchor cases in tests where the
   * cell was setCell'd without addWord).
   * @private
   */
  function _isPartOfHorizontalWord(row, col) {
    const cell = BoardModule.getCell(row, col);
    if (!cell || !cell.letter) return false;
    if (Array.isArray(cell.partOfWords) && cell.partOfWords.length > 0) {
      for (const wid of cell.partOfWords) {
        const w = BoardModule.getWord(wid);
        if (w && (w.direction === 'right' || w.direction === 'left')) {
          return true;
        }
      }
    }
    // Fallback for seed-anchor cells (no addWord called) — last-setter
    // direction. Only treat as horizontal if cell was setCell'd with
    // direction='horizontal' AND no partOfWords resolve to a vertical
    // word (to avoid false positives at intersections where the latest
    // setter was a horizontal word but the cell is also part of a vertical).
    if (cell.direction === 'horizontal' && cell.partOfWords.length === 0) {
      return true;
    }
    return false;
  }

  /**
   * Check if a cell at (row, col) is part of any vertical word
   * (direction 'down' or 'up'). Symmetric to _isPartOfHorizontalWord.
   * Used by the vertical gap rule for placeWordDown (Tahap 12) and
   * placeWordUp (Tahap 13): cells immediately above & below the new
   * word's extent must NOT be part of a vertical word, or we'd merge
   * two vertical words (gap = 0).
   * @private
   */
  function _isPartOfVerticalWord(row, col) {
    const cell = BoardModule.getCell(row, col);
    if (!cell || !cell.letter) return false;
    if (Array.isArray(cell.partOfWords) && cell.partOfWords.length > 0) {
      for (const wid of cell.partOfWords) {
        const w = BoardModule.getWord(wid);
        if (w && (w.direction === 'down' || w.direction === 'up')) {
          return true;
        }
      }
    }
    // Fallback for seed-anchor cells (no addWord called) — only treat
    // as vertical if cell was setCell'd with direction='vertical' AND
    // no partOfWords resolve to a horizontal word (to avoid false
    // positives at intersections).
    if (cell.direction === 'vertical' && cell.partOfWords.length === 0) {
      return true;
    }
    return false;
  }

  /**
   * placeWordRight(word, anchorRow, anchorCol, wordId, playerId) — Tahap 10
   *
   * Place `word` extending to the RIGHT of the anchor cell at
   * (anchorRow, anchorCol). The anchor cell must already be filled
   * with a letter, and the word's FIRST letter must equal that letter.
   * Only letters 2..N go into new cells; the anchor cell retains its
   * letter (becomes an intersection point).
   *
   * Validations (per Tahap 10 spec):
   *   1. Word is a valid KBBI word
   *   2. Word hasn't been played before (no repeat)
   *   3. First letter of word === anchor cell's letter
   *   4. No overlap conflict (each filled cell in path must have same letter)
   *   5. Gap rule: no adjacent horizontal word touching (cells immediately
   *      before & after the new word's extent must NOT be part of a
   *      horizontal word — except at intersection cells which are allowed)
   *
   * @param {string} word
   * @param {number} anchorRow
   * @param {number} anchorCol
   * @param {string|null} [wordId] — caller-provided ID (else auto-UUID)
   * @param {string} [playerId]
   * @returns {{ success: boolean, cells: Array<{row,col,letter}>, word: object|null, reason: string }}
   *   On failure: { success: false, cells: [], word: null, reason }
   *   On success: { success: true, cells: [...all N positions...], word: Word, reason: 'placed_right' }
   */
  function placeWordRight(word, anchorRow, anchorCol, wordId, playerId) {
    // 1. Normalize & non-empty
    const W = _normalize(word);
    if (!W) return _fail('empty_word');

    // 2. KBBI must be loaded
    if (!KBBIModule.isLoaded()) return _fail('kbbi_not_loaded');

    // 3. Valid KBBI word
    if (!KBBIModule.search(W)) return _fail('not_in_kbbi');

    // 4. No-repeat (spec: "Kata belum pernah dimainkan")
    if (BoardModule.hasWord(W)) return _fail('word_already_used');

    // 5. Anchor cell must exist with a letter
    const anchor = BoardModule.getCell(anchorRow, anchorCol);
    if (!anchor || !anchor.letter) return _fail('no_anchor');

    // 6. First letter must equal anchor letter
    if (W[0] !== anchor.letter) return _fail('first_letter_mismatch');

    // 7. Compute positions for 'right' direction
    const cells = _positionsForDirection(W, anchorRow, anchorCol, 'right');
    if (!cells) return _fail('invalid_direction'); // shouldn't happen for 'right'

    // 8. Overlap conflict — each filled cell in path must have same letter
    for (const c of cells) {
      const existing = BoardModule.getCell(c.row, c.col);
      if (existing && existing.letter && existing.letter !== c.letter) {
        return _fail('overlap_conflict');
      }
    }

    // 9. Gap rule — cell immediately before the start and immediately
    //    after the end must NOT be part of a horizontal word (else
    //    our new word would merge with an adjacent horizontal word,
    //    creating an invalid concatenated word).
    const beforeCell = BoardModule.getCell(anchorRow, anchorCol - 1);
    if (beforeCell && beforeCell.letter &&
        _isPartOfHorizontalWord(anchorRow, anchorCol - 1)) {
      return _fail('adjacent_word_before');
    }
    const afterCol = anchorCol + W.length;
    const afterCell = BoardModule.getCell(anchorRow, afterCol);
    if (afterCell && afterCell.letter &&
        _isPartOfHorizontalWord(anchorRow, afterCol)) {
      return _fail('adjacent_word_after');
    }

    // 10. All validations passed — create the Word object and place cells
    const wordObj = BoardModule.createWord(W, anchorRow, anchorCol, 'right',
                                            playerId, wordId);
    for (const c of cells) {
      BoardModule.setCell(c.row, c.col, c.letter, wordObj.id, 'horizontal');
    }
    BoardModule.addWord(wordObj);

    return _ok(cells, wordObj, 'placed_right');
  }

  /**
   * placeWordLeft(word, anchorRow, anchorCol, wordId, playerId) — Tahap 11
   *
   * Place `word` extending to the LEFT of the anchor cell at
   * (anchorRow, anchorCol). The anchor cell must already be filled
   * with a letter, and the word's LAST letter must equal that letter
   * (per spec: "Huruf TERAKHIR kata harus = huruf di anchor cell").
   *
   * Spec example: anchor "S" at (2,4) from word "SELASA", word "POS"
   * (ends with S) → P(2,2), O(2,3), S(2,4) — S of POS attaches to S
   * of SELASA. Position formula per spec:
   *   huruf ke-i → (anchorRow, anchorCol - (wordLength - 1 - i))
   *
   * Validations (per Tahap 11 spec):
   *   1. Word is a valid KBBI word
   *   2. Word hasn't been played before (no repeat)
   *   3. LAST letter of word === anchor cell's letter
   *   4. No overlap conflict (each filled cell in path must have same letter)
   *   5. Gap rule: cells immediately before (leftmost) & after (rightmost=anchor)
   *      the new word's extent must NOT be part of a horizontal word
   *
   * @param {string} word
   * @param {number} anchorRow
   * @param {number} anchorCol
   * @param {string|null} [wordId]
   * @param {string} [playerId]
   * @returns {{ success: boolean, cells: Array<{row,col,letter}>, word: object|null, reason: string }}
   *   On failure: { success: false, cells: [], word: null, reason }
   *   On success: { success: true, cells: [...all N positions...], word: Word, reason: 'placed_left' }
   */
  function placeWordLeft(word, anchorRow, anchorCol, wordId, playerId) {
    // 1. Normalize & non-empty
    const W = _normalize(word);
    if (!W) return _fail('empty_word');

    // 2. KBBI must be loaded
    if (!KBBIModule.isLoaded()) return _fail('kbbi_not_loaded');

    // 3. Valid KBBI word
    if (!KBBIModule.search(W)) return _fail('not_in_kbbi');

    // 4. No-repeat (spec: "Kata belum pernah dimainkan")
    if (BoardModule.hasWord(W)) return _fail('word_already_used');

    // 5. Anchor cell must exist with a letter
    const anchor = BoardModule.getCell(anchorRow, anchorCol);
    if (!anchor || !anchor.letter) return _fail('no_anchor');

    // 6. LAST letter must equal anchor letter (per spec — symmetric to RIGHT's first-letter rule)
    if (W[W.length - 1] !== anchor.letter) return _fail('last_letter_mismatch');

    // 7. Compute positions for 'left' direction (anchor at position N-1, last letter at anchor)
    const cells = _positionsForDirection(W, anchorRow, anchorCol, 'left');
    if (!cells) return _fail('invalid_direction');

    // 8. Overlap conflict — each filled cell in path must have same letter
    for (const c of cells) {
      const existing = BoardModule.getCell(c.row, c.col);
      if (existing && existing.letter && existing.letter !== c.letter) {
        return _fail('overlap_conflict');
      }
    }

    // 9. Gap rule — cells immediately BEFORE the leftmost position and AFTER
    //    the anchor (rightmost) must NOT be part of a horizontal word.
    //    - "Before" cell: (anchorRow, anchorCol - W.length) — left of leftmost
    //    - "After" cell: (anchorRow, anchorCol + 1) — right of anchor (rightmost)
    const beforeCol = anchorCol - W.length;
    const beforeCell = BoardModule.getCell(anchorRow, beforeCol);
    if (beforeCell && beforeCell.letter &&
        _isPartOfHorizontalWord(anchorRow, beforeCol)) {
      return _fail('adjacent_word_before');
    }
    const afterCol = anchorCol + 1;
    const afterCell = BoardModule.getCell(anchorRow, afterCol);
    if (afterCell && afterCell.letter &&
        _isPartOfHorizontalWord(anchorRow, afterCol)) {
      return _fail('adjacent_word_after');
    }

    // 10. All validations passed — create the Word object and place cells.
    //     The Word's start position is the LEFTMOST cell (where the first
    //     letter goes), with direction='left' so getWordCellPositions knows
    //     how to walk it. (BoardModule.getWordCellPositions uses the
    //     same formula: col -= i for 'left', which yields anchor at position N-1
    //     IF start position is the leftmost cell. So set startCol = leftmost col.)
    const startCol = anchorCol - (W.length - 1);
    const wordObj = BoardModule.createWord(W, anchorRow, startCol, 'left',
                                            playerId, wordId);
    for (const c of cells) {
      BoardModule.setCell(c.row, c.col, c.letter, wordObj.id, 'horizontal');
    }
    BoardModule.addWord(wordObj);

    return _ok(cells, wordObj, 'placed_left');
  }

  /**
   * placeWordDown(word, anchorRow, anchorCol, wordId, playerId) — Tahap 12
   *
   * Place `word` extending DOWNWARD from the anchor cell at
   * (anchorRow, anchorCol). The anchor cell must already be filled
   * with a letter, and the word's FIRST letter must equal that letter
   * (per spec: "Huruf PERTAMA kata harus = huruf di anchor cell" —
   * SAME as placeWordRight, just vertical instead of horizontal).
   *
   * Spec example: anchor "L" at (2,2) from word "SELASA" (horizontal),
   * word "LAOS" (starts with L) → L(2,2)=anchor, A(3,2), O(4,2), S(5,2).
   * Position formula: huruf ke-i → (anchorRow + i, anchorCol)
   *
   * Validations (per Tahap 12 spec):
   *   1. Word is a valid KBBI word
   *   2. Word hasn't been played before (no repeat)
   *   3. FIRST letter of word === anchor cell's letter
   *   4. No overlap conflict (each filled cell in path must have same letter;
   *      intersection with same letter is OK)
   *   5. Vertical gap rule: cells immediately above (anchor) & below (last
   *      letter) the new word's extent must NOT be part of a vertical word
   *   6. (Subsumed by #4) Vertical word must not "crash into" horizontal
   *      word — cells passed through but not intersections must have
   *      matching letter; if different letter, overlap_conflict fires.
   *
   * @param {string} word
   * @param {number} anchorRow
   * @param {number} anchorCol
   * @param {string|null} [wordId]
   * @param {string} [playerId]
   * @returns {{ success: boolean, cells: Array<{row,col,letter}>, word: object|null, reason: string }}
   *   On success: { success: true, cells: [...N positions...], word: Word, reason: 'placed_down' }
   */
  function placeWordDown(word, anchorRow, anchorCol, wordId, playerId) {
    // 1. Normalize & non-empty
    const W = _normalize(word);
    if (!W) return _fail('empty_word');

    // 2. KBBI must be loaded
    if (!KBBIModule.isLoaded()) return _fail('kbbi_not_loaded');

    // 3. Valid KBBI word
    if (!KBBIModule.search(W)) return _fail('not_in_kbbi');

    // 4. No-repeat
    if (BoardModule.hasWord(W)) return _fail('word_already_used');

    // 5. Anchor cell must exist with a letter
    const anchor = BoardModule.getCell(anchorRow, anchorCol);
    if (!anchor || !anchor.letter) return _fail('no_anchor');

    // 6. FIRST letter must equal anchor letter (per spec — same as placeWordRight)
    if (W[0] !== anchor.letter) return _fail('first_letter_mismatch');

    // 7. Compute positions for 'down' direction
    //    (anchor at position 0, first letter at anchor; cells extend downward)
    const cells = _positionsForDirection(W, anchorRow, anchorCol, 'down');
    if (!cells) return _fail('invalid_direction'); // shouldn't happen for 'down'

    // 8. Overlap conflict — each filled cell in path must have same letter
    //    (also covers spec point 6: vertical word must not crash into
    //    horizontal word — if letters differ at a crossing, this fires)
    for (const c of cells) {
      const existing = BoardModule.getCell(c.row, c.col);
      if (existing && existing.letter && existing.letter !== c.letter) {
        return _fail('overlap_conflict');
      }
    }

    // 9. Vertical gap rule — cells immediately ABOVE the anchor (topmost)
    //    and BELOW the last letter (bottommost) must NOT be part of a
    //    vertical word (else our new word would merge with an adjacent
    //    vertical word, gap = 0).
    const aboveRow = anchorRow - 1;
    const aboveCell = BoardModule.getCell(aboveRow, anchorCol);
    if (aboveCell && aboveCell.letter &&
        _isPartOfVerticalWord(aboveRow, anchorCol)) {
      return _fail('adjacent_word_before');
    }
    const belowRow = anchorRow + W.length;
    const belowCell = BoardModule.getCell(belowRow, anchorCol);
    if (belowCell && belowCell.letter &&
        _isPartOfVerticalWord(belowRow, anchorCol)) {
      return _fail('adjacent_word_after');
    }

    // 10. All validations passed — create the Word object and place cells.
    //     Word's start position is the anchor (topmost cell), direction='down'.
    const wordObj = BoardModule.createWord(W, anchorRow, anchorCol, 'down',
                                            playerId, wordId);
    for (const c of cells) {
      BoardModule.setCell(c.row, c.col, c.letter, wordObj.id, 'vertical');
    }
    BoardModule.addWord(wordObj);

    return _ok(cells, wordObj, 'placed_down');
  }

  /**
   * placeWordUp(word, anchorRow, anchorCol, wordId, playerId) — Tahap 13
   *
   * Place `word` extending UPWARD from the anchor cell at
   * (anchorRow, anchorCol). The anchor cell must already be filled
   * with a letter, and the word's LAST letter must equal that letter
   * (per spec: "Huruf TERAKHIR kata harus = huruf di anchor cell" —
   * SAME as placeWordLeft, just vertical instead of horizontal).
   *
   * Spec example: anchor "E" at (2,1) from word "SELASA" (horizontal),
   * word "ENDE" (ends with E) → E(-1,1), N(0,1), D(1,1), E(2,1)=anchor.
   * Position formula: huruf ke-i → (anchorRow - (wordLength - 1 - i), anchorCol)
   * (Negative row indices are supported — the cells Map allows any integer keys.)
   *
   * Validations (per Tahap 13 spec):
   *   1. Word is a valid KBBI word
   *   2. Word hasn't been played before (no repeat)
   *   3. LAST letter of word === anchor cell's letter
   *   4. No overlap conflict (each filled cell in path must have same letter;
   *      intersection with same letter is OK; also covers spec point 6:
   *      "vertical word must not crash into horizontal word")
   *   5. Vertical gap rule: cells immediately above (topmost) & below
   *      (bottommost=anchor) the new word's extent must NOT be part of
   *      a vertical word (except at intersections)
   *
   * @param {string} word
   * @param {number} anchorRow
   * @param {number} anchorCol
   * @param {string|null} [wordId]
   * @param {string} [playerId]
   * @returns {{ success: boolean, cells: Array<{row,col,letter}>, word: object|null, reason: string }}
   *   On success: { success: true, cells: [...N positions...], word: Word, reason: 'placed_up' }
   */
  function placeWordUp(word, anchorRow, anchorCol, wordId, playerId) {
    // 1. Normalize & non-empty
    const W = _normalize(word);
    if (!W) return _fail('empty_word');

    // 2. KBBI must be loaded
    if (!KBBIModule.isLoaded()) return _fail('kbbi_not_loaded');

    // 3. Valid KBBI word
    if (!KBBIModule.search(W)) return _fail('not_in_kbbi');

    // 4. No-repeat
    if (BoardModule.hasWord(W)) return _fail('word_already_used');

    // 5. Anchor cell must exist with a letter
    const anchor = BoardModule.getCell(anchorRow, anchorCol);
    if (!anchor || !anchor.letter) return _fail('no_anchor');

    // 6. LAST letter must equal anchor letter (per spec — symmetric to
    //    placeWordLeft's last-letter rule; DIFFERENT from RIGHT/DOWN
    //    which check FIRST letter)
    if (W[W.length - 1] !== anchor.letter) return _fail('last_letter_mismatch');

    // 7. Compute positions for 'up' direction.
    //    Per spec: huruf ke-i → (anchorRow - (wordLength - 1 - i), anchorCol)
    //    So: i=0 (first letter) → anchorRow - (N-1) = topmost
    //        i=N-1 (last letter) → anchorRow = bottommost = anchor
    //    _positionsForDirection's 'up' formula `row -= (N - 1 - i)` matches.
    const cells = _positionsForDirection(W, anchorRow, anchorCol, 'up');
    if (!cells) return _fail('invalid_direction');

    // 8. Overlap conflict — each filled cell in path must have same letter
    //    (also covers spec point 6: vertical word must not crash into
    //    horizontal word — if letters differ at a crossing, this fires)
    for (const c of cells) {
      const existing = BoardModule.getCell(c.row, c.col);
      if (existing && existing.letter && existing.letter !== c.letter) {
        return _fail('overlap_conflict');
      }
    }

    // 9. Vertical gap rule — cells immediately ABOVE the topmost position
    //    and BELOW the anchor (bottommost) must NOT be part of a vertical
    //    word (else our new word would merge with an adjacent vertical
    //    word, gap = 0).
    //    - "Before" cell (above topmost): (anchorRow - wordLength, anchorCol)
    //    - "After" cell (below anchor): (anchorRow + 1, anchorCol)
    const beforeRow = anchorRow - W.length;
    const beforeCell = BoardModule.getCell(beforeRow, anchorCol);
    if (beforeCell && beforeCell.letter &&
        _isPartOfVerticalWord(beforeRow, anchorCol)) {
      return _fail('adjacent_word_before');
    }
    const afterRow = anchorRow + 1;
    const afterCell = BoardModule.getCell(afterRow, anchorCol);
    if (afterCell && afterCell.letter &&
        _isPartOfVerticalWord(afterRow, anchorCol)) {
      return _fail('adjacent_word_after');
    }

    // 10. All validations passed — create the Word object and place cells.
    //     Word's start position is the TOPMOST cell (where the first letter
    //     goes), with direction='up' so getWordCellPositions walks it
    //     correctly (using the updated Tahap 11 formula: row += i for 'up').
    const startRow = anchorRow - (W.length - 1);
    const wordObj = BoardModule.createWord(W, startRow, anchorCol, 'up',
                                            playerId, wordId);
    for (const c of cells) {
      BoardModule.setCell(c.row, c.col, c.letter, wordObj.id, 'vertical');
    }
    BoardModule.addWord(wordObj);

    return _ok(cells, wordObj, 'placed_up');
  }

  // Public API
  return {
    placeWordRight,
    placeWordLeft,
    placeWordDown,
    placeWordUp,
    // Stubs preserved for later tahaps
    calculatePositions: (word, anchorRow, anchorCol, direction) => { /* Tahap 18 */ },
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
  // Autocomplete (Tahap 08)
  // --------------------------------------------------------
  /**
   * renderAutocomplete(suggestions, onPick) — renders suggestion chips
   * inside #autocomplete-suggestions. Each chip is clickable; clicking
   * it fills the word input and calls onPick.
   *
   * Tahap 38 will polish this (highlight matching prefix, keyboard nav,
   * position-aware dropdown). For Tahap 08, we render a basic chip list.
   *
   * @param {string[]} suggestions — array of UPPERCASE words
   * @param {Function} [onPick] — callback when a chip is clicked; receives the word
   */
  function renderAutocomplete(suggestions, onPick) {
    const container = document.getElementById('autocomplete-suggestions');
    if (!container) return;
    container.innerHTML = '';
    if (!suggestions || !suggestions.length) return;
    suggestions.slice(0, 10).forEach((word) => {
      const chip = document.createElement('span');
      chip.className = 'suggestion-chip';
      chip.textContent = word;
      chip.title = `Pilih "${word}"`;
      chip.addEventListener('click', () => {
        if (typeof onPick === 'function') onPick(word);
        const input = document.getElementById('word-input');
        if (input) input.value = word;
      });
      container.appendChild(chip);
    });
  }

  /** clearAutocomplete() — empties the suggestions container. */
  function clearAutocomplete() {
    const container = document.getElementById('autocomplete-suggestions');
    if (container) container.innerHTML = '';
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
    renderAutocomplete,
    clearAutocomplete,
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

    // Tahap 08 — autocomplete on input typing (debounced ~150ms)
    let autocompleteTimer = null;
    document.getElementById('word-input')?.addEventListener('input', (e) => {
      if (autocompleteTimer) clearTimeout(autocompleteTimer);
      autocompleteTimer = setTimeout(() => {
        updateAutocomplete(e.target.value);
      }, 150);
    });
    // Clear suggestions when input loses focus
    document.getElementById('word-input')?.addEventListener('blur', () => {
      // Small delay so chip click can fire first
      setTimeout(() => UIModule.clearAutocomplete(), 200);
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
    const rawWord = input.value;
    const result = ValidationModule.validateWordWithDetail(rawWord);
    input.value = '';

    if (result.valid) {
      // Spec Tahap 07: "Jika valid → lanjut ke penempatan"
      // Penempatan (arah/anchor) akan diimplementasi di Tahap 10–18.
      UIModule.showToast(`Kata "${result.normalized}" valid ✓ — pilih posisi penempatan (Tahap 10+)`, 'success', 2500);
      console.log(`[Game] Word "${result.normalized}" valid (reason: ${result.reason})`);
      // TODO (Tahap 10+): pass `result.normalized` to PlacementModule
      return;
    }

    // Spec Tahap 07: "Jika tidak valid → tampilkan pesan error, nyawa berkurang, skor -10"
    // Nyawa & skor modul diimplementasi di Tahap 19+ & 23+; untuk sekarang
    // tampilkan toast + log placeholder untuk integrasi nanti.
    const map = {
      empty:       { msg: 'Masukkan kata terlebih dahulu',                          type: 'info',    },
      too_short:   { msg: `Kata "${result.normalized}" terlalu pendek (min. 2 huruf, kecuali kata 1 huruf yang terdaftar di KBBI)`, type: 'warning' },
      not_in_kbbi: { msg: `Kata "${result.normalized}" tidak ditemukan di KBBI`,      type: 'error',  },
    };
    const info = map[result.reason] || map.not_in_kbbi;

    // Cek apakah kata mirip dengan kata KBBI (typo) — sarankan jika ya
    let hint = '';
    if (result.reason === 'not_in_kbbi' && ValidationModule.isTypo(result.normalized, 1)) {
      hint = ' (mungkin typo? periksa ejaan)';
    }

    UIModule.showToast(info.msg + hint, info.type, 3000);
    console.log(`[Game] Word "${result.normalized}" rejected — reason: ${result.reason}${hint}`);

    // TODO (Tahap 19+ & 23+): kurangi nyawa pemain & skor -10
    // Untuk saat ini, hanya log agar alur lengkap saat modul siap.
    if (result.reason === 'too_short' || result.reason === 'not_in_kbbi') {
      console.log('[Game] (placeholder) nyawa -1, skor -10 — akan diwiring di Tahap 19/23');
    }
  }

  /**
   * updateAutocomplete(inputValue) — Tahap 08
   * Fetches prefix suggestions via SearchModule and renders them.
   * The full anchor-letter integration comes in Tahap 37 (arah selection);
   * for now we use the raw input text as the prefix.
   */
  function updateAutocomplete(inputValue) {
    if (!KBBIModule.isLoaded()) return;
    const prefix = (inputValue || '').trim().toUpperCase();
    if (prefix.length < 1) {
      UIModule.clearAutocomplete();
      return;
    }
    const suggestions = SearchModule.findWordsByPrefix(prefix, 10);
    UIModule.renderAutocomplete(suggestions, (word) => {
      console.log(`[Game] Autocomplete picked: "${word}"`);
    });
  }

  /**
   * showAnchorSuggestions(anchorLetter, direction, usedWords) — Tahap 09
   * Direction-aware autocomplete:
   *   - 'right' / 'down' → prefix search (new word's FIRST letter = anchor)
   *   - 'left' / 'up'   → suffix search (new word's LAST letter = anchor)
   *
   * Used when the player has selected an anchor cell + direction. Per spec:
   *   KIRI: "kata baru harus berakhiran huruf anchor (suffix matching)"
   *   ATAS: same (suffix matching)
   *   KANAN / BAWAH: new word's first letter must equal anchor (prefix matching)
   *
   * The full anchor-cell UI integration is Tahap 37; for Tahap 09 we
   * expose this helper so callers (tests, future UI, bot AI) can use
   * suffix search when direction demands it.
   *
   * @param {string} anchorLetter — single letter (the anchor cell's letter)
   * @param {string} direction — 'right' | 'left' | 'down' | 'up'
   * @param {Set<string>|string[]} [usedWords] — words already played
   * @param {number} [limit=10] — max suggestions to show
   */
  function showAnchorSuggestions(anchorLetter, direction, usedWords, limit = 10) {
    if (!KBBIModule.isLoaded()) return;
    const letter = (anchorLetter || '').trim().toUpperCase();
    if (letter.length !== 1 || !/^[A-Z]$/.test(letter)) {
      UIModule.clearAutocomplete();
      return;
    }
    const dir = (direction || '').toLowerCase();
    let suggestions;
    if (dir === 'left' || dir === 'up') {
      // Suffix matching: new word's LAST letter = anchor
      suggestions = SearchModule.findValidWordsBySuffix(letter, usedWords || new Set(), limit);
    } else if (dir === 'right' || dir === 'down') {
      // Prefix matching: new word's FIRST letter = anchor
      suggestions = SearchModule.findValidWordsByPrefix(letter, usedWords || new Set(), limit);
    } else {
      UIModule.clearAutocomplete();
      return;
    }
    UIModule.renderAutocomplete(suggestions, (word) => {
      console.log(`[Game] Anchor suggestion picked (dir=${dir}): "${word}"`);
    });
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
    submitWord,
    showAnchorSuggestions,
  };
})();


// ============================================================
// --- INITIALIZATION ---
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  GameController.init();
});
