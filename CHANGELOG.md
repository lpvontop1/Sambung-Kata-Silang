# Sambung Kata Silang — Changelog

## [0.1.0] — Tahap 01: Fondasi Proyek & Struktur File

### Added
- `index.html` — Struktur HTML5 lengkap dengan:
  - Main Menu screen
  - Mode Selection screen (Classic, Blitz, Infinite, Hard, Chaos)
  - Game Board screen dengan HUD, board container, input area
  - Game Over screen
  - Settings screen (volume, tema, bahasa)
  - About screen
  - Toast notification container
- `style.css` — Stylesheet lengkap dengan:
  - CSS Variables untuk tema (dark/light)
  - Layout flexbox/grid responsif
  - Font monospace untuk board cells
  - Animasi (cellPop, toastSlideIn/Out)
  - Zoom controls styling
  - Mobile & tablet responsive breakpoints
  - Custom scrollbar styling
- `game.js` — Skeleton JavaScript dengan:
  - 10 module placeholders (Board, KBBI, Validation, Placement, Scoring, Turn, UI, Multiplayer, Audio, AI)
  - Screen navigation (showScreen)
  - Toast notification system
  - Game controller dengan event binding
  - Zoom controls (basic)
  - Theme toggle (dark/light)
  - Score constants
- `data/kbbi.json` — Skeleton KBBI data (version 2026, wordCount: 0)
- `README.md` — Dokumentasi proyek

## [0.2.0] — Tahap 02: Desain Grid/Board — Model Data

### Added
- `game.js` — BoardModule fully implemented with:
  - **CellData** factory: `{ letter, wordId, direction, partOfWords[] }` — supports intersection tracking via `partOfWords`
  - **Word** factory: `{ id, text, startRow, startCol, direction, length, playerId }` — auto-uppercase, auto-UUID
  - **UUID** utility: `generate()` and `prefixed(prefix)` — uses `crypto.randomUUID()` with fallback
  - Core methods: `getCell()`, `setCell()`, `isCellEmpty()`, `getBounds()`, `clearCell()`
  - Word management: `addWord()`, `getWord()`, `hasWord()`, `removeWord()`, `getWordCellPositions()`
  - Accessors: `getCellCount()`, `getWordCount()`, `getAllCells()`, `getAllWords()`, `getAnchorCells()`, `isIntersection()`
  - Serialization: `serialize()` and `deserialize()` — for multiplayer sync & save/load
  - Debug: `toggleDebug()`, `isDebugMode()`, `toString()` — visual board representation
  - Intersection handling: `setCell()` auto-adds wordId to `partOfWords` for crossing words
  - `clearCell()` supports partial clear (by wordId) preserving intersection cells
  - `removeWord()` preserves cells that belong to other words
  - `getWordCellPositions()` calculates positions for all 4 directions (right, left, down, up)
- `tests/test-board.js` — Comprehensive unit tests (88 tests, all passing):
  - Initial state, getCell, setCell, isCellEmpty, getBounds
  - Intersection detection and partial clearing
  - Word CRUD (create, read, delete)
  - Position calculation for all 4 directions
  - Anchor cell discovery
  - Serialize/deserialize roundtrip
  - UUID uniqueness
  - Debug mode toggle

## [0.3.0] — Tahap 03: Rendering Grid — DOM-based Grid

### Added
- `game.js` — UIModule renderBoard fully implemented with:
  - **Diffing algorithm**: Only updates cells that changed since last render (compares dataset attributes)
  - **CSS Grid layout**: `grid-template-columns` and `grid-template-rows` computed from `BoardModule.getBounds()`
  - **Cell creation**: `createCellElement()` with letter span, data attributes, word color, click handler
  - **Cell update**: `updateCellElement()` efficiently patches existing DOM without full replacement
  - **Cell classes**: Dynamic CSS class management — `cell-filled`, `cell-empty`, `cell-new`, `cell-anchor`, `cell-intersection`, `cell-anchor--selected`
  - **Empty cells**: `ensureEmptyCells()` fills grid gaps for proper CSS Grid structure
  - **Grid positioning**: `positionCellInGrid()` sets `gridRow`/`gridColumn` based on bounds offset
  - **Word colors**: 10-color palette assigned per wordId for visual clarity
  - **Anchor selection**: Click on filled cell selects it as anchor for word placement, updates input area
  - **New cell highlight**: `markNewCells()` highlights recently placed cells with auto-clear after 600ms
  - **Anchor highlights**: `updateAnchorHighlights()` marks all filled cells as clickable anchors
  - **Debug mode**: `toggleDebugRender()` shows/hides `(row,col)` coordinate labels on each cell
  - **State management**: `clearRenderedState()` resets all rendering state for board reset
- `style.css` — New styles for:
  - `.cell__letter` — letter span with pointer-events: none
  - `.cell__coord` — debug coordinate label (absolute positioned, 7px font)
  - `.cell-intersection` — blue inner glow for crossing cells
  - `.cell-anchor--selected` — accent highlight for selected anchor
  - `.cell` position: relative for coord label positioning
- `tests/test-render.js` — Unit tests for rendering (25 tests, all passing):
  - UIModule API verification
  - Empty board render
  - Single word render (HALO)
  - Intersection render (SELASA + LAOS)
  - markNewCells, updateAnchorHighlights, clearRenderedState
  - Debug mode toggle render
  - Diffing: add/remove words and re-render
  - Multiple directions (right, left, down, up)
  - Bounds change detection and grid reconfiguration

## [0.4.0] — Tahap 04: Rendering Grid — Scroll & Zoom

### Added
- `game.js` — **ZoomModule** fully implemented with:
  - **Zoom control**: `setZoom(level)`, `zoomIn()`, `zoomOut()`, `resetZoom()` — range 0.5x to 2.0x, step 0.1x, default 1.0x
  - **CSS transform scale**: Zoom applied via `transform: scale()` on `.board-grid` with `transform-origin: 0 0`
  - **Smooth transition**: `transition: transform 0.2s ease` for animated zoom changes (can be disabled for instant zoom)
  - **Zoom level display**: Percentage indicator (`#zoom-level`) updates in real-time (e.g. "150%", "50%")
  - **Ctrl+scroll wheel zoom**: Mouse wheel with Ctrl/Cmd key triggers zoom in/out
  - **Pinch-to-zoom**: Two-finger pinch gesture on touch devices for mobile zoom
  - **Pan/drag**: Mouse drag (when zoomed > 1x) or touch drag to pan the board — cursor changes to `grab`/`grabbing`
  - **Middle mouse button pan**: Scroll wheel click to pan regardless of zoom
  - **Double-click reset**: Double-click on empty board area resets zoom to 1.0x and centers the board
  - **Center board**: `centerBoard()` smoothly scrolls to center the grid in viewport
  - **Container class management**: `.board-container--zoomed` and `.board-container--panning` CSS classes for cursor states
- `game.js` — **UIModule.scrollToWord()** and **scrollToCell()** implemented:
  - Calculates word center position from `BoardModule.getWordCellPositions()`
  - Converts grid coordinates to pixel positions accounting for cell size and zoom
  - Smooth scroll to center the word in the container viewport
  - `scrollToCell(row, col)` — scroll to specific cell position
- `game.js` — **Minimap** system implemented:
  - Canvas-based minimap (`#minimap-canvas`) draws filled cells with color coding (blue for normal, green for intersection)
  - Viewport indicator (`#minimap-viewport`) shows current scroll position relative to the full board
  - Updates automatically on render, zoom change, and scroll events
  - `toggleMinimap(visible)` — show/hide minimap
  - Semi-transparent by default, becomes opaque on hover
- `index.html` — Updated:
  - Added minimap container with canvas and viewport indicator
  - Rearranged zoom controls: `−` | percentage display | `+` | reset button
  - Added `#zoom-level` span for zoom percentage display
- `style.css` — New styles for:
  - `.zoom-level` — monospace font, centered text for zoom percentage
  - `.minimap` — absolute positioned, 120×90px, semi-transparent with border
  - `.minimap__canvas` — full-size canvas element
  - `.minimap__viewport` — accent-colored border rectangle for viewport indicator
  - `.board-container--panning` — `cursor: grabbing` during drag
  - `.board-container--zoomed` — `cursor: grab` when zoom level > 1.0
  - `scroll-behavior: smooth` on board container
  - `will-change: transform` on board-grid for GPU acceleration
  - Updated `.zoom-controls` — horizontal layout with background and border
  - Updated `.zoom-btn` — transparent background, compact size
  - Mobile responsive adjustments for zoom controls and minimap
- `tests/test-zoom.js` — Comprehensive unit tests (50 tests, all passing):
  - ZoomModule API existence verification
  - Default zoom level (1.0)
  - setZoom with clamping (0.5 min, 2.0 max)
  - zoomIn/zoomOut with boundary enforcement
  - resetZoom returns to 1.0
  - DOM transform application (`scale(X)`)
  - Zoom level display updates (50%, 100%, 150%)
  - Multiple zoom steps (5 steps = 0.5 change)
  - scrollToWord edge cases (null, undefined)
  - scrollToWord with real word and zoom
  - Minimap toggle
  - Zoom boundary strictness (cannot exceed limits)
  - BoardModule integrity after zoom operations
  - getLevel type safety (number, not NaN, finite)
  - Rapid zoom changes (20+ steps capped at boundaries)
  - Zoom + renderBoard integration
  - Final reset verification

## [0.5.0] — Tahap 05: Sumber Data KBBI — Scraping & Persiapan

### Added
- `scripts/scrape-kbbi.js` — Skrip scraping & persiapan dataset KBBI yang
  dapat dijalankan ulang (rerunnable). Mendukung dua mode:
  - **Bundled (default)** — menggunakan dataset open-source
    `aryakdaniswara/kbbi-dataset-kbbi-v` (112.645 entri ekstraksi KBBI V
    resmi). Cepat (~3 detik) dan deterministik.
  - **Live** — scraping langsung dari `kbbi.kemdikbud.go.id` dengan
    rate-limit 1.1 req/detik, retry 3×, dan cache per-huruf di
    `.cache/kbbi-raw/live-{letter}.json` untuk resumability.
  - **`--validate`** — hanya menjalankan validator terhadap file yang ada.
  - Mengumpulkan kandidat kata dari: top-level key, `nama`, `kata_dasar`,
    `bentuk_tidak_baku`, `varian`, dan `kata_turunan` di setiap entri.
  - Filter ketat sesuai spec: hanya huruf A-Z (plus tanda hubung tunggal
    antar segmen untuk reduplikasi seperti `ANAK-ANAK`, `MATA-MATA`).
    Frasa (mengandung spasi), simbol, angka, dan tanda kurung dibuang.
  - UPPERCASE semua, dedupe, sort alfabetis.
  - Generator sample deterministik (LCG dengan seed) — rerun menghasilkan
    sample yang sama persis.
  - Validator skema-aware (berbeda untuk `kbbi.json` vs chunk vs sample).
- `data/kbbi.json` — Dataset penuh (74.536 kata UPPERCASE, sorted, no
  dupes). Versi `"2026"`, source `"KBBI V"`.
- `data/kbbi-sample.json` — Sample 1.000 kata acak untuk dev/test
  (sesuai spec "fallback data sample 1000 kata untuk development").
- `data/kbbi-meta.json` — Metadata: wordCount, lengthHistogram,
  byLetter, chunkFiles, generatedAt, minTargetMet, dll.
- `data/kbbi-{a..z}.json` — 26 chunk per huruf awal untuk lazy loading
  (schema `{ letter, words[] }`). Total kata di semua chunk = total kata
  di `kbbi.json` (diverifikasi oleh test).
- `tests/test-kbbi.js` — 231 unit test untuk dataset KBBI:
  - Skema file utama (version, source, wordCount, words)
  - Skema sample (ukuran persis 1.000, isi ⊆ main set)
  - Skema 26 chunk (letter, words, semua kata berawalan huruf yg benar)
  - Cross-check: chunk total = main wordCount (74536 = 74536)
  - Tidak ada duplikat (di main, di setiap chunk, antar chunk)
  - Semua kata UPPERCASE
  - Sorted alfabetis (di main, di setiap chunk)
  - Format kata valid (regex `^[A-Za-z]+(?:-[A-Za-z]+)*$`)
  - Chunks mutually exclusive
  - Sanity check 23 kata umum (ABADI, BAGUS, CINTA, DUNIA, EMAS, FANA,
    GUNUNG, HATI, INDONESIA, JALAN, KASIH, LARI, MATA, NAMA, ORANG,
    PINTU, RUMAH, SEHAT, TANAH, UMUR, WARNA, YANG, ZAMAN).
- `.gitignore` — tambahkan `.cache/` (122MB raw JSON yang dapat
  diregenerasi, tidak perlu di-commit).
- `README.md` — update progress (Tahap 05 ✓), tambah seksi
  "Regenerasi Dataset KBBI" dan "Menjalankan Tests".

### Changed
- `data/kbbi.json` — isi berubah dari skeleton kosong
  (`wordCount: 0, words: []`) menjadi dataset lengkap 74.536 kata.
- `tests/test-render.js` — fix pre-existing bug: mock DOM tidak
  mengimplementasikan `canvas.getContext('2d')` yang dipanggil oleh
  `updateMinimap` (Tahap 04). Tambahan `getContext` mock di
  `mockGetElementById` dan `createElement`. Test sekarang lulus (25/25).

### Notes
- **Jumlah kata 74.536 vs target spec 100.000+**: KBBI V (sumber
  open-source `aryakdaniswara`) berisi 112.645 entri total, namun
  ~34% di antaranya adalah frasa/peribahasa/idiom (mengandung spasi),
  bentuk terikat (`-an`, `-anda`), atau entri dengan simbol/tanda
  kurung. Setelah menerapkan aturan filter spec Tahap 05 ("Hilangkan
  entri yang bukan kata (simbol, angka, frasa dengan spasi)"), tersisa
  74.536 kata token-tunggal yang valid untuk game. Ini adalah set
  LENGKAP dari semua entri KBBI V yang lolos filter spec — bukan
  subset. Target 100.000+ kemungkinan merupakan estimasi spec-author
  yang tidak memperhitungkan bahwa banyak entri KBBI adalah frasa.
  Metadata `data/kbbi-meta.json` mendokumentasikan hal ini secara
  honest (`minTargetMet: false, minTarget: 100000`).
- **Format dua-arah**: spec menyebut "ATAU format terpisah per huruf
  awal" — proyek ini menyediakan KEDUA format (full `kbbi.json` DAN
  26 chunk per-huruf) untuk fleksibilitas maksimum: Tahap 06 (Trie)
  bisa memilih load full sekaligus atau lazy-load per huruf.

## [0.6.0] — Tahap 06: Struktur Data Trie untuk KBBI

### Added
- `game.js` — **`KBBITrie` class** fully implemented with:
  - `root: TrieNode` — `{ children: {}, isEndOfWord: false }` (plain object,
    not Map, for memory efficiency per spec)
  - `reverseRoot: TrieNode` — reverse trie for suffix search (each word
    also inserted reversed: KUCING → GNIUK)
  - `insert(word)` — inserts into both forward & reverse trie;
    idempotent (duplicate insert does not inflate `_size`)
  - `search(word)` — boolean exact lookup; case-insensitive
    (input normalized to UPPERCASE)
  - `startsWith(prefix)` — boolean, true if any word begins with prefix
  - `getWordsByPrefix(prefix, limit=20)` — autocomplete; DFS preorder
    from prefix node, sorted alphabetically for deterministic output
  - `getWordsBySuffix(suffix, limit=20)` — uses reverse trie:
    descend reversed-suffix, collect reversed words, then un-reverse
  - `loadFromJSON(jsonData)` — batch insert from `{words:[...]}`;
    throws on non-object or missing `words` array
  - `clear()` — resets both tries to empty
  - `size()` — count of unique words inserted
  - `getStats()` — debug helper: word count, forward/reverse node counts
  - `_descend(root, str)` — private helper, walks a trie following `str`
  - `_collect(node, current, limit, out)` — private DFS accumulator
  - Handles hyphenated reduplications (ANAK-ANAK, KUDA-KUDA, MATA-MATA)
    via regex `^[A-Za-z]+(?:-[A-Za-z]+)*$`
  - Garbage-input safe: `insert('')`, `insert(null)`, `insert(123)`
    are all silently ignored
- `game.js` — **KBBIModule** wired to use singleton KBBITrie:
  - `loadFromJSON(jsonData)` — delegates to `trie.loadFromJSON`,
    sets `loaded=true`, marks all letters A–Z as loaded
  - `isLoaded()` — true after any successful `loadFromJSON` or `loadChunk`
  - `getWordCount()` — current trie size
  - `getLoadedLetters()` — array of letters lazy-loaded via `loadChunk`
    (for debug; empty when full `loadFromJSON` was used)
  - `getTrie()` — exposes the singleton trie (for tests / inspection)
  - `reset()` — clears trie, sets `loaded=false`, resets counters
  - `search(word)` & `startsWith(prefix)` — delegate to trie; return
    `false` if not loaded yet (safe no-op)
  - `loadChunk(letter)` — async; lazy-loads `data/kbbi-{letter}.json`,
    inserts all words into trie, returns # of newly-inserted words;
    idempotent (re-loading same letter returns 0)
  - `_readChunkFile(letterLower)` — private; reads chunk file via
    `fs.readFileSync` (Node) or `fetch` (browser), resolved relative
    to `process.cwd()` (Node) or HTML document (browser)
  - `getWordsByPrefix` & `getWordsBySuffix` remain Tahap 08/09 stubs
    (the underlying `KBBITrie` methods ARE implemented; the KBBIModule
    wrappers will be wired in their respective tahaps)
- `tests/test-trie.js` — **146 unit tests** covering:
  1. Class structure & API surface (all methods exist)
  2. TrieNode structure (`{children:{}, isEndOfWord:false}`, plain object
     not Map)
  3. insert + search basics
  4. Case-insensitivity (uppercase normalization)
  5. Hyphenated reduplications (ANAK-ANAK, KUDA-KUDA, MATA-MATA)
  6. startsWith prefix boolean check (positive, negative, edge cases)
  7. getWordsByPrefix with limit (autocomplete, default=20, sorted)
  8. getWordsBySuffix with limit (reverse trie, un-reversed output)
  9. loadFromJSON batch insert + input validation (throws on garbage)
  10. Idempotent inserts (size stays same on duplicate insert)
  11. clear() & size()
  12. **Performance test**: load 74,536-word dataset in < 2 sec
      (actual: ~210 ms — 10× under target)
  13. KBBIModule singleton integration (loadFromJSON, isLoaded,
      getWordCount, search, startsWith, getTrie returns same instance)
  14. KBBIModule.loadChunk lazy loading per letter (A, B, C) — Promise
      return, idempotency, error rejection on invalid letter, case-
      insensitive letter input
  15. KBBIModule.reset
  16. Edge cases: empty string, null, undefined, non-string, single-
      letter word
  17. Real KBBI words sanity check (ABADI, BAGUS, CINTA, DUNIA, EMAS,
      FANA, GUNUNG, HATI, INDONESIA, JALAN, KASIH, LARI, MATA, NAMA,
      ORANG, PINTU, RUMAH, SEHAT, TANAH, UMUR, WARNA, YANG, ZAMAN,
      HALO, SELASA) + invalid (XYZQQ, QQQQQ, ASDFGHJKL)

### Performance
- Loading **74,536 unique Indonesian words** into the trie:
  ~**210 ms** (well under the 2-second spec target — 10× margin)
- Per-call search latency: sub-millisecond (Trie prefix walk is O(L)
  where L is word length)
- Memory: plain JS objects for `children` (no Map overhead);
  forward + reverse trie share the same word count

### Notes
- **Node 24 `require` visibility quirk**: `require` is a CommonJS
  function-scope parameter, NOT a property of `globalThis`. Scripts
  executed via `vm.runInThisContext` (as the test files load `game.js`)
  cannot see `require` unless the host explicitly exposes it. The test
  file `tests/test-trie.js` does `globalThis.require = require` before
  loading game.js, so `KBBIModule.loadChunk` can call `require('fs')`
  inside the vm context. In a browser, `require` is undefined and
  `loadChunk` falls back to `fetch(relPath)` — which is the correct
  path for the production environment.
- **KBBIModule API stubs preserved for later tahaps**: per the tahap-
  by-tahap structure, `KBBIModule.getWordsByPrefix` and
  `getWordsBySuffix` are deliberately left as stubs (Tahap 08 and
  Tahap 09 respectively). The underlying `KBBITrie` methods ARE fully
  implemented now (so the data structure is complete), but the
  KBBIModule wrappers that delegate to them are wired in their
  respective tahaps to keep each tahap's scope tight.

### Files
- `game.js` — +430 lines (KBBITrie class + KBBIModule wiring)
- `tests/test-trie.js` — +540 lines (146 tests)
- `README.md` — Tahap 06 progress checkbox + test inventory
- `CHANGELOG.md` — this entry

## [0.7.0] — Tahap 07: Validasi Kata — Lookup KBBI

### Added
- `game.js` — **ValidationModule** fully implemented:
  - `isValidWord(word)` — boolean. Normalizes input (trim + uppercase),
    then delegates to `validateWordWithDetail(word).valid`. Spec examples
    all pass: `SELASA`→true, `HALO`→true, `XYZQQ`→false.
  - `validateWordWithDetail(word)` — returns `{ valid, reason, normalized }`
    with reason ∈ {`"valid"`, `"empty"`, `"too_short"`, `"not_in_kbbi"`}:
    - `empty`: input is empty/whitespace-only/non-string → `normalized=""`
    - `too_short`: length 1 and not in KBBI (single non-letter char)
    - `not_in_kbbi`: length ≥ 2 but not found in KBBI trie, OR KBBI not
      loaded yet (safe-fail behavior)
    - `valid`: word is in KBBI (length 1 only if KBBI has it; length ≥ 2
      standard lookup)
  - `isTypo(word, maxDistance=1)` — advanced typo detection via BFS over
    edit-distance-1 variants. Generates deletions + insertions (A-Z) +
    substitutions (A-Z); each variant checked via fast `KBBITrie.search`.
    - Default maxDistance=1 for speed (sub-millisecond for typical words)
    - maxDistance=2 supported via BFS frontier expansion (capped by
      `VARIANT_LIMIT = 60000` safety valve for very long words)
    - maxDistance capped at 2 (no higher distances allowed)
    - Returns `false` for exact KBBI matches (a typo is not a typo if
      the word IS in KBBI)
    - Returns `false` if KBBI not loaded, or input is empty/non-string
  - `levenshtein(a, b)` — classic DP edit distance. 1D-row space-
    optimized (O(m*n) time, O(n) space). Exposed for tests and external use.
  - `_normalize(word)` — private helper (trim + uppercase; non-string → '')
  - `_editDistance1Variants(word)` — JS generator yielding all single-
    edit variants (deletions + insertions + substitutions)
- `game.js` — **GameController.submitWord()** wired to ValidationModule:
  - Calls `ValidationModule.validateWordWithDetail(rawWord)` on every submit
  - On `valid`: success toast `Kata "X" valid ✓ — pilih posisi penempatan
    (Tahap 10+)`, defers actual placement to Tahap 10+
  - On `empty`/`too_short`/`not_in_kbbi`: appropriate toast (`info`/`
    `warning`/`error`)
  - On `not_in_kbbi`: also calls `isTypo(word, 1)` and appends hint
    ` (mungkin typo? periksa ejaan)` if a nearby KBBI word exists
  - Placeholder `console.log` for life `-1` & score `-10` (per spec) —
    actual lives/score wiring deferred to Tahap 19 & 23 when those
    modules exist
- `tests/test-validation.js` — **207 unit tests** covering:
  1. API surface (isValidWord, validateWordWithDetail, isTypo, levenshtein
     all functions; _normalize, _editDistance1Variants exposed for tests;
     stubs for Tahap 16/17 preserved)
  2. isValidWord — spec examples: SELASA true, HALO true, XYZQQ false
  3. validateWordWithDetail — all 4 reason values verified with 4+ cases
     each (valid, empty/whitespace/null/undefined/number, too_short for
     single non-letter char, not_in_kbbi for random strings)
  4. Case-insensitivity & whitespace trimming (lowercase, mixed case,
     leading/trailing whitespace, tab/newline, mixed-case hyphen)
  5. Hyphenated reduplications (ANAK-ANAK, MATA-MATA, KUDA-KUDA, LARI-LARI)
  6. Single-letter words (all 26 letters A-Z verified to be in KBBI;
     plus lowercase single letters)
  7. Edge cases (empty string, whitespace-only, null, undefined, number,
     object, array, boolean, very long string, word with digits)
  8. Behavior when KBBI not loaded (returns `not_in_kbbi` for any input;
     isTypo returns false; after reload, behavior restored)
  9. Levenshtein distance (empty strings, identical, 1-edit each direction,
     full substitution, transposition, case-sensitivity)
  10. `_editDistance1Variants` generator (variant count for length-0/1/2
      words: 26, 78, 130 — formula 52L+26 verified; specific variant
      content checked)
  11. isTypo distance 1: exact match→false, 1-char deletion from KBBI
      word→true (SELAS from SELASA), 1-char insertion→true (HALLO from
      HALO), 1-char substitution→true (ABADO from ABADI)
  12. isTypo distance 2: `XXLASA` (2 substitutions from SELASA) — no KBBI
      word within distance 1, but found at distance 2; `SESA` correctly
      detected at distance 1 (near DESA/LESA/SELA/etc.); maxDistance>2
      capped to 2 without crashing
  13. isTypo — exact KBBI matches all return false (SELASA, HALO, ABADI,
      INDONESIA, ANAK-ANAK, KUCING)
  14. isTypo — random garbage (XYZQQ, QQQQQ, ASDFGHJKL, ZZZZZZZZZZ) all
      return false
  15. Performance: isTypo distance 1 < 1 sec, distance 2 < 5 sec
  16. Spec sanity: SELASA valid, XYZQQ invalid, HALO valid, plus 22
      additional common KBBI words (BAGUS, CINTA, DUNIA, ..., ZAMAN) all
      valid; QQQQQ and ASDFGHJKL invalid

### Behavior decisions
- **`too_short` vs `not_in_kbbi` for length-1 input**: spec says "kata 1
  huruf tidak valid kecuali yang ada di KBBI". Implemented as: length-1
  input → check KBBI; if found, valid; else `too_short`. Since all 26
  single letters (A-Z) ARE in our KBBI V dataset, `too_short` is rare in
  practice — only triggers for non-letter single chars like `"1"`, `"!"`.
- **KBBI not loaded → `not_in_kbbi`**: when `KBBIModule.isLoaded()` is
  false, any non-empty word gets reason `not_in_kbbi` (rather than a
  separate "not_loaded" reason — keeps the reason enum clean per spec).
- **`isTypo` default maxDistance=1**: spec says "edit distance 1-2" but
  distance 2 is much slower (~80k trie lookups per call for typical
  words). Default is 1 for production use; callers who want distance 2
  pass it explicitly. Both work and both are tested.
- **GameController.submitWord UI integration**: spec asks for "nyawa
  berkurang, skor -10" on invalid word. Lives module (Tahap 19+) and
  Scoring module (Tahap 23+) don't exist yet. For Tahap 07, the wiring
  ends at the toast + a `console.log` placeholder; the actual deduction
  will be re-wired in those tahaps.

### Files
- `game.js` — +200 lines ValidationModule + ~30 lines GameController.submitWord
- `tests/test-validation.js` — +440 lines (207 tests)
- `README.md` — Tahap 07 progress checkbox + test inventory
- `CHANGELOG.md` — this entry
