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
