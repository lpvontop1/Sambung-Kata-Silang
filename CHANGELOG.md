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

## [0.8.0] — Tahap 08: Pencarian Kata Berdasarkan Awalan

### Added
- `game.js` — **SearchModule** (new module) implementing all 4 spec
  functions for prefix-based word search:
  - `findWordsByPrefix(prefix, limit=20)` — normalize prefix
    (trim+UPPERCASE) and delegate to `KBBIModule.getWordsByPrefix`.
    Returns sorted-alphabetically KBBI words starting with prefix.
  - `findValidWordsByPrefix(prefix, usedWords, limit=20)` — filters
    out used words; accepts `usedWords` as Set OR Array. To produce
    up to `limit` valid results when some matches are filtered, the
    fetch from the trie is bumped to `limit * 5` (capped).
  - `getRandomWordByPrefix(prefix, usedWords)` — picks a random word
    from `findValidWordsByPrefix(prefix, used, 100)` pool. Uses a
    seeded LCG keyed on `prefix` for reproducibility (same prefix →
    same pick across runs, important for deterministic tests).
  - `getHintByPrefix(prefix, usedWords)` — fetches a 500-word pool,
    sorts by length DESC (ties broken alphabetically), returns the
    longest. Prioritizes longer words per spec ("lebih banyak poin").
  - `_normalize(prefix)` and `_seededRng(seedStr)` private helpers.
- `game.js` — **KBBIModule.getWordsByPrefix** wired: previously a
  Tahap 08 stub, now delegates to `trie.getWordsByPrefix(prefix,
  limit)` and returns `[]` if not loaded.
  - Note: `getWordsBySuffix` remains a stub per the tahap-by-tahap
    structure (will be wired in Tahap 09).
- `game.js` — **UIModule.renderAutocomplete(suggestions, onPick)** +
  **`clearAutocomplete()`** for basic chip-based UI:
  - Renders up to 10 `.suggestion-chip` spans inside
    `#autocomplete-suggestions`.
  - Each chip: click → fills `#word-input` value + invokes `onPick(word)`
    callback (used by GameController to log picks).
  - `clearAutocomplete()` empties the container (used on input blur).
  - The existing `showAutocomplete` stub (labeled Tahap 38) is
    preserved — Tahap 38 will polish with prefix highlighting,
    keyboard navigation, position-aware dropdown.
- `game.js` — **GameController**:
  - `updateAutocomplete(inputValue)` — new private function: fetches
    `SearchModule.findWordsByPrefix(prefix, 10)` and renders via
    `UIModule.renderAutocomplete`.
  - `input` event on `#word-input` (debounced 150ms) → calls
    `updateAutocomplete(value)`.
  - `blur` on `#word-input` → `clearAutocomplete()` after 200ms delay
    (so chip click can fire first).
- `tests/test-prefix-search.js` — **89 unit tests** covering:
  1. SearchModule API surface (4 functions defined)
  2. findWordsByPrefix — basic, normalize (lowercase/mixed/whitespace),
     limit enforcement, sorted output, longer-prefix-fewer-matches
  3. findWordsByPrefix — edge cases (empty, null, undefined, number,
     whitespace, non-existent prefix, KBBI not loaded)
  4. findValidWordsByPrefix — Set & Array inputs, case-insensitive
     used words, exclude-all → [], limit=0 → []
  5. getRandomWordByPrefix — valid string returned, starts with prefix,
     is in KBBI, reproducible (seeded), excludes used words, null on
     no-match / non-existent / empty prefix
  6. getHintByPrefix — longest-first priority verified against the
     actual longest ABAD-prefixed word, excludes used, null on no-match
  7. KBBIModule.getWordsByPrefix wrapper — same output as
     KBBITrie.getWordsByPrefix; returns [] when not loaded
  8. UIModule.renderAutocomplete — 5 chips for 5 suggestions; each chip
     has class 'suggestion-chip' and textContent matches; caps at 10
     chips; [] and null clear container; chip click fills #word-input
     with that word; custom onPick callback called
  9. UIModule.clearAutocomplete — empties container; no-op on empty
  10. GameController integration — `#word-input` has 'input' and
      'keydown' listeners attached after `GameController.init()`
  11. Real prefix queries against 74k-word KBBI dataset — AB/ABADI/
      ABANG/SELASA/INDO/INDONESIA/ANAK/ANAK-ANAK all found
  12. Performance — findWordsByPrefix < 50 ms per query; getHintByPrefix
      < 200 ms (real: 0–1 ms)
  13. Spec sanity — anchor 'S' scenario: returns 10 S-words; bot gets
      random S-word excluding SELASA; hint returns longest S-word
      (real: "SAMBUNG-BERSAMBUNG" 18 chars)

### Mock DOM improvements (in test-prefix-search.js)
- `_newElement(id)` factory — reusable mock element constructor with
  full classList API, canvas getContext, _handlers stash.
- `document.createElement(tag)` returns a FRESH element each call
  (using random suffix) — fixes bug where chips shared state because
  they were cached as the same object per tag.
- `innerHTML` getter/setter — setting `innerHTML = ''` clears the
  `children` array (mimics real DOM behavior). Fixes renderAutocomplete
  clear tests.

### Cross-check & bug fixes during this tahap
1. **Mock `createElement` returning same cached element** for repeated
   calls with same tag — caused all chips to share `textContent` and
   `children` array grew with duplicate references. Fixed by returning
   a fresh element each call.
2. **Mock `innerHTML` setter was a plain property** — didn't actually
   clear `children` array, so `renderAutocomplete([])` test failed.
   Fixed with a getter/setter that resets `children` and `childNodes`.
3. **Test expectation "5 ABAD words" wrong** — KBBI V has only 4
   ABAD-prefixed entries (ABAD, ABADI, ABADIAH, ABADIAT). Adjusted
   expectation to 4 and downstream assertions (3 remaining after
   excluding ABADI).
4. **Test expectation "SELASA in findWordsByPrefix('SEL', 50)" wrong**
   — there are 200+ SEL-prefixed KBBI words; SELASA is alphabetically
   past the 50th. Replaced with `findWordsByPrefix('SELASA', 10)`
   which includes SELASA itself.
5. **GameController.init() doesn't auto-run in Node vm** — DOMContentLoaded
   never fires, so input event handlers weren't attached. Test now
   explicitly calls `GameController.init()` (in try-catch) before
   checking handler stash.

### Files
- `game.js` — +SearchModule (~120 lines), +renderAutocomplete (~30 lines),
  +updateAutocomplete GameController wiring (~30 lines), KBBIModule
  getWordsByPrefix stub wired (~5 lines)
- `tests/test-prefix-search.js` — +500 lines (89 tests, includes
  improved mock DOM factory reusable for future UI tests)
- `README.md` — Tahap 08 progress checkbox + test inventory
- `CHANGELOG.md` — this entry

## [0.9.0] — Tahap 09: Pencarian Kata Berdasarkan Akhiran

### Added
- `game.js` — **SearchModule suffix functions** (mirrors Tahap 08 prefix):
  - `findWordsBySuffix(suffix, limit=20)` — normalize suffix (trim+
    UPPERCASE) and delegate to `KBBIModule.getWordsBySuffix`, which
    walks the reverse trie (each word stored reversed: KUCING → GNIUK).
    Spec: "Panggil KBBITrie.getWordsBySuffix(suffix, limit)".
  - `findValidWordsBySuffix(suffix, usedWords, limit=20)` — filters
    out used words; accepts Set OR Array; fetches limit*5 from trie.
  - `getRandomWordBySuffix(suffix, usedWords)` — random pick from a
    100-word pool; seeded LCG keyed on `suffix` for reproducibility.
  - `getHintBySuffix(suffix, usedWords)` — fetches 500-word pool,
    sorts by length DESC (ties alphabetical), returns longest.
- `game.js` — **KBBIModule.getWordsBySuffix** wired: previously a
  Tahap 09 stub, now delegates to `trie.getWordsBySuffix(suffix,
  limit)` and returns `[]` if not loaded. Uses the reverse trie that
  was built in Tahap 06 (each insert also reversed).
- `game.js` — **GameController.showAnchorSuggestions(anchorLetter,
  direction, usedWords, limit=10)** — direction-aware autocomplete:
  - `'left'` or `'up'` → **suffix search** (new word's LAST letter
    must equal the anchor letter — per spec: "kata baru harus
    berakhiran huruf anchor")
  - `'right'` or `'down'` → **prefix search** (new word's FIRST
    letter must equal the anchor letter)
  - Invalid direction or multi-char/non-letter anchor → clears
    suggestions container (graceful no-op)
  - Excludes usedWords from results
  - Full anchor-cell UI integration is Tahap 37; for Tahap 09 we
    expose this helper so future UI, tests, and bot AI can use
    direction-aware search
- `tests/test-suffix-search.js` — **81 unit tests** mirroring
  test-prefix-search.js coverage:
  1. SearchModule suffix API surface (4 functions defined; prefix
     functions still present from Tahap 08)
  2. findWordsBySuffix — basic, normalize (lowercase/mixed/whitespace),
     limit enforcement, longer-suffix-fewer-matches
  3. findWordsBySuffix — edge cases (empty/null/undefined/number/
     whitespace/non-existent/KBBI not loaded)
  4. findValidWordsBySuffix — Set & Array inputs, case-insensitive
     used words, exclude-all → [], limit=0 → []
  5. getRandomWordBySuffix — valid string, ends with suffix, in KBBI,
     reproducible (seeded), excludes used, null on no-match
  6. getHintBySuffix — longest-first priority verified against actual
     longest "SA"-suffixed word in pool; excludes used; null on no-match
  7. KBBIModule.getWordsBySuffix wrapper — same output as
     KBBITrie.getWordsBySuffix; returns [] when not loaded
  8. Symmetry with prefix search — INDONESIA & ABADI found via both
     findWordsByPrefix(X) and findWordsBySuffix(X)
  9. Direction-aware GameController.showAnchorSuggestions — LEFT/UP
     use suffix (all chips end with anchor), RIGHT/DOWN use prefix
     (all chips start with anchor); invalid direction/anchor → no chips
  10. Spec anchor-letter scenario — POS to left of "S" from SELASA:
      suffix search for "S" returns words ending in "S"; POS verified
      findable via findWordsBySuffix('POS') (POS not in first 50 S-words
      due to reverse-trie DFS yielding many short S-ending words first)
  11. Real suffix queries — SA/NG/I/INDONESIA/BASA suffixes return
      words ending in those strings
  12. Performance — findWordsBySuffix < 50 ms; getHintBySuffix < 200 ms
      (real: 0 ms)
  13. Hyphenated reduplications — KUDA-KUDA via suffix "KUDA",
      ANAK-ANAK via suffix "ANAK", MATA-MATA via suffix "MATA"

### Direction-aware behavior (key spec requirement)
Per Tahap 09 spec:
- **Arah KIRI** (LEFT): new word placed to the left of anchor; new
  word's LAST letter must equal anchor letter → suffix matching.
  Spec example: POS [P][O][S] placed left of "S" from SELASA — the
  "S" of POS attaches to "S" of SELASA.
- **Arah ATAS** (UP): new word placed above anchor; new word's LAST
  letter must equal anchor letter → suffix matching.
- **Arah KANAN** (RIGHT) / **BAWAH** (DOWN): new word's FIRST letter
  must equal anchor letter → prefix matching (already implemented in
  Tahap 08).

`GameController.showAnchorSuggestions(letter, dir, used, limit)` is
the direction-aware dispatcher: LEFT/UP → `SearchModule.findValidWords
BySuffix`; RIGHT/DOWN → `findValidWordsByPrefix`. Returns nothing
(clears the container) for invalid direction or anchor.

### Cross-check & bugs found and fixed during this tahap
1. **Test bug: "POS included in findWordsBySuffix('S', 50)"** — POS
   isn't in the first 50 S-ending words because the reverse trie DFS
   yields many short S-ending words alphabetically (by reversed prefix)
   before reaching POS's reverse-prefix "SOP". Fixed test to verify POS
   via the more specific suffix "POS" itself, which is guaranteed to
   include POS.

### Performance
- Suffix search is symmetrically fast as prefix search (~0 ms per
  query for typical 2-3 char suffixes), thanks to the reverse trie
  built in Tahap 06.
- getHintBySuffix fetches a 500-word pool then sorts by length: still
  sub-millisecond in practice.

### Files
- `game.js` — +SearchModule suffix functions (~95 lines),
  +GameController.showAnchorSuggestions (~45 lines), KBBIModule
  getWordsBySuffix stub wired (~5 lines)
- `tests/test-suffix-search.js` — +480 lines (81 tests)
- `README.md` — Tahap 09 progress checkbox + test inventory
- `CHANGELOG.md` — this entry

### Fase 2 complete
With Tahap 09, Fase 2 (KBBI & Validasi Kata) is complete:
- Tahap 05: KBBI data scraped/prepared
- Tahap 06: KBBITrie data structure (with reverse trie for suffix)
- Tahap 07: Word validation (isValidWord, validateWordWithDetail, isTypo)
- Tahap 08: Prefix search (findWordsByPrefix + 3 helpers + autocomplete UI)
- Tahap 09: Suffix search (findWordsBySuffix + 3 helpers + direction-aware UI)
Next up: Fase 3 — Mekanik Penempatan Kata (Tahap 10–18).

## [1.0.0] — Tahap 10: Mekanik Penempatan — Horizontal Kanan

### Added
- `game.js` — **PlacementModule.placeWordRight** fully implemented:
  - Signature: `placeWordRight(word, anchorRow, anchorCol, wordId, playerId)`
  - Returns `PlacementResult`: `{ success, cells, word, reason }`
    - On success: `{ success: true, cells: [...N positions...], word: Word,
      reason: 'placed_right' }`
    - On failure: `{ success: false, cells: [], word: null, reason: '<code>' }`
  - Spec example verified: anchor "A" at (5,3), word "ANJING" →
    cells (5,3)=A, (5,4)=N, (5,5)=J, (5,6)=I, (5,7)=N, (5,8)=G

  Validations (per Tahap 10 spec, in order):
  1. `empty_word` — non-empty normalized word (after trim+UPPERCASE)
  2. `kbbi_not_loaded` — KBBIModule.isLoaded() check
  3. `not_in_kbbi` — KBBIModule.search(W) fails
  4. `word_already_used` — BoardModule.hasWord(W) (no-repeat check via
     wordSet, per Tahap 17 spec but implemented now using BoardModule
     wordSet directly)
  5. `no_anchor` — anchor cell at (anchorRow, anchorCol) doesn't exist
     or has no letter
  6. `first_letter_mismatch` — W[0] !== anchor.letter
  7. `overlap_conflict` — any filled cell in path has different letter
     (intersection with same letter is OK)
  8. `adjacent_word_before` — cell before anchor is part of a horizontal
     word (gap rule; would extend/merge with existing horizontal word)
  9. `adjacent_word_after` — cell after last letter is part of a
     horizontal word (same gap rule)
  10. All passed → create Word via BoardModule.createWord + setCell for
      each position + BoardModule.addWord → return success result

- `game.js` — **Private helpers in PlacementModule**:
  - `_normalize(word)` — trim+UPPERCASE; non-string → ''
  - `_fail(reason)` — build failure result `{success:false, cells:[],
    word:null, reason}`
  - `_ok(cells, word, reason)` — build success result
  - `_positionsForDirection(word, anchorRow, anchorCol, direction)` —
    compute cell positions for any direction ('right'|'left'|'down'|'up').
    Internal helper used by placeWordRight now; will be exposed publicly
    as `calculatePositions` in Tahap 18 (handles all 4 directions).
  - `_isPartOfHorizontalWord(row, col)` — checks if a cell is part of
    any horizontal word ('right' or 'left'). First checks `partOfWords`
    for accurate intersection-aware lookup; falls back to
    `cell.direction === 'horizontal'` for seed-anchor cells (no
    addWord called). Used by gap rule (cells before/after the new word's
    extent must NOT be part of a horizontal word, except intersections).

- `tests/test-placement-right.js` — **91 unit tests** covering:
  1. PlacementModule API surface (placeWordRight + 3 direction stubs +
     calculatePositions stub)
  2. Successful placement (anchor A from vertical seed → ANJING right)
  3. Result shape: { success, cells, word, reason } — all fields verified
  4. Word actually written to board (cells filled via BoardModule.setCell,
     word added via BoardModule.addWord, intersection cell has partOfWords
     containing both vertical seed wordId and new word id)
  5. First-letter mismatch (anchor A, word BERLARI starts with B → fails)
  6. Word not in KBBI (XYZQQ → not_in_kbbi)
  7. Word already used (place ANJING twice → word_already_used)
  8. Anchor cell empty (place at (100,100) → no_anchor for fresh KBBI word)
  9. KBBI not loaded (after KBBIModule.reset → kbbi_not_loaded)
  10. Empty word ('' → empty_word)
  11. Non-string word (null/undefined/number → empty_word)
  12. Overlap conflict (plant 'X' at (5,4) → AROMA placement fails with
      overlap_conflict; ASIA fallback if AROMA not in KBBI)
  13. Overlap OK (intersection with same letter — vertical "BAHAYA" at
      (6,6) crosses horizontal "ABADI" at (6,6)=B; intersection cell's
      partOfWords contains both seed-bahaya and the new word id)
  14. Gap rule before (horizontal "KATA" at (5,1-5,4) ends right before
      anchor at (5,5); place ANJING right → adjacent_word_before)
  15. Gap rule after (horizontal "KATA" starts right after where AJAIB
      would end → adjacent_word_after)
  16. Gap rule NOT triggered when before cell is part of VERTICAL word
      only (vertical "BAHAYA" at (5,4); place ANJING right from (5,5)
      succeeds because (5,4)=B is vertical, not horizontal)
  17. Multiple successful placements building up a board (seed ABADI
      vertical + ANJING right from (10,10)=A + BAGUS right from (11,10)=B
      + IKAN right from (14,10)=I → 4 words on board). Also verifies
      that placing from the END of a horizontal word fails correctly
      (gap rule fires — GUNUNG from (10,15)=G fails because (10,14)=N
      is part of horizontal ANJING).
  18. Case-insensitivity (lowercase/mixed/whitespace-padded input all
      normalize to UPPERCASE)
  19. Hyphenated word placement (ANAK-ANAK right from anchor A — 9 cells
      including hyphen at position 4)
  20. Spec example (anchor A → ANJING → cells (5,3)=A, (5,4)=N, etc.)
  21. wordId & playerId pass-through (caller-provided IDs reach Word
      object; BoardModule.getWord(customId) returns the word)
  22. Spec validation order (invalid KBBI on empty cell → not_in_kbbi,
      NOT no_anchor; already-used on empty cell → word_already_used,
      NOT no_anchor; fresh KBBI on empty cell → no_anchor)

### Spec interpretation notes
- **Anchor letter vs first-letter check**: spec example shows anchor
  "A" + word "ANJING" → A(5,3) is the anchor (existing cell from any
  word) and word's first letter must match anchor's letter. So anchor
  is any filled cell, and the new word's first letter hooks into it.
- **Anchor at end of horizontal word**: if the anchor cell IS the last
  letter of an existing horizontal word (e.g. G from ANJING at (10,15)),
  placing a new horizontal word right from there would extend that
  horizontal word — gap rule rejects this (cells before anchor (10,14)=N
  is part of horizontal ANJING → adjacent_word_before). Correct behavior.
- **Intersection (same letter overlap) is allowed**: spec point 4 says
  "Tidak ada konflik overlap (cell yang sudah terisi harus punya huruf
  yang sama)". So overlap with SAME letter is OK (intersection); only
  DIFFERENT letter is conflict.
- **Gap rule excludes intersections**: spec point 5 says "kecuali
  persilangan". So a cell at the start/end of our new word that's part
  of a vertical word is OK (it's just a crossing point). Only horizontal
  words trigger the gap rule.
- **No-repeat check (point 2)**: spec defers `isWordUsed` to Tahap 17,
  but BoardModule.wordSet is already maintained. The check is done
  inline using `BoardModule.hasWord(W)` — when Tahap 17 lands,
  ValidationModule.isWordUsed will likely wrap this same call.

### Cross-check & bugs found and fixed during this tahap
1. **Test bug**: `assertEqual` on cell objects fails because `===`
   compares object references, not content. Cells are different
   object instances even with identical content. Fixed by using
   `assertDeepEqual` (JSON.stringify comparison) for cell assertions
   in section 20.
2. **Test bug**: Test 12 used 'CINTA' as both seed AND placement word,
   triggering word_already_used before overlap_conflict. Fixed by
   using different words: seed vertical 'ABADI', plant isolated 'X'
   at (5,4), place 'AROMA' (or 'ASIA' fallback) — anchor A from
   ABADI, position 2 would be R or S, but cell has 'X' → overlap_conflict.
3. **Test bug**: Test 17 expected GUNUNG placement from (10,15)=G to
   succeed, but (10,15) is the last letter of horizontal ANJING, so
   cell (10,14)=N is part of horizontal ANJING → gap rule correctly
   fires. Rewrote test to use different anchor cells from the vertical
   seed (B at (11,10), I at (14,10)) so placements succeed without
   gap-rule conflicts. Added explicit assertion that GUNUNG from
   (10,15) FAILS with adjacent_word_before (correct behavior).

### Files
- `game.js` — +PlacementModule full impl (~190 lines added; was 10-line
  stub), within the existing module structure
- `tests/test-placement-right.js` — +575 lines (91 tests, comprehensive
  coverage including all 9 failure reason codes + 13 positive scenarios)
- `README.md` — Tahap 10 progress checkbox + new "Fase 3" section header
  + test inventory entry
- `CHANGELOG.md` — this entry

### Fase 3 begins
Tahap 10 is the first of 9 tahaps (10-18) in Fase 3 — Mekanik Penempatan
Kata. Next up: Tahap 11 (placeWordLeft — symmetric to right but going
LEFT; uses suffix matching since new word's LAST letter must equal
anchor letter).
