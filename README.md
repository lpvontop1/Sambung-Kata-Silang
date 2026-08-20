# Sambung Kata Silang

> Game hybrid **Sambung Kata + Domino + Teka-teki Silang** berbasis web

## 🎮 Konsep Game

Pemain menempatkan kata pada grid yang saling terhubung melalui huruf awalan/akhiran/tengah. Setiap kata baru harus berhubungan dengan kata yang sudah ada di board. Pemain bebas memilih arah penempatan (kanan, kiri, atas, bawah) — layaknya domino + crossword.

## 🕹️ Game Modes

| Mode     | Nyawa | Timer        | Keterangan                        |
|----------|-------|--------------|-----------------------------------|
| Classic  | 3     | -            | Mode standar                      |
| Blitz    | Waktu | 15 detik     | Nyawa = sisa waktu                |
| Infinite | ∞     | -            | Hanya skor, tanpa batas           |
| Hard     | 1     | -            | Satu kali salah = eliminasi       |
| Chaos    | 1     | 10 detik     | Arah dikunci secara acak          |

## 📊 Scoring

| Aksi                  | Poin |
|-----------------------|------|
| Kata valid            | +10  |
| Persilangan           | +15  |
| 2 Persilangan         | +30  |
| Cabang baru           | +10  |
| Kata panjang (>5)     | +bonus per huruf tambahan |
| Salah kata            | -10  |

## 📁 Struktur Proyek

```
├── index.html          # Halaman utama (HTML5)
├── style.css           # Stylesheet (CSS variables, responsif)
├── game.js             # Logika game (modul-modul)
├── data/
│   ├── kbbi.json           # Data KBBI lengkap (74.536 kata, KBBI V / 2026)
│   ├── kbbi-sample.json    # Sample 1.000 kata untuk dev/test
│   ├── kbbi-meta.json     # Metadata & statistik dataset
│   └── kbbi-{a..z}.json   # Chunk per-huruf untuk lazy loading
├── tests/
│   ├── test-board.js          # Unit test BoardModule (88 tests)
│   ├── test-render.js         # Unit test renderBoard (25 tests)
│   ├── test-zoom.js           # Unit test ZoomModule (50 tests)
│   ├── test-kbbi.js           # Unit test dataset KBBI (231 tests)
│   ├── test-trie.js           # Unit test KBBITrie & KBBIModule (146 tests)
│   ├── test-validation.js     # Unit test ValidationModule (207 tests)
│   ├── test-prefix-search.js  # Unit test SearchModule prefix (89 tests)
│   ├── test-suffix-search.js  # Unit test SearchModule suffix (81 tests)
│   ├── test-placement-right.js # Unit test PlacementModule.placeWordRight (91 tests)
│   └── test-placement-left.js  # Unit test PlacementModule.placeWordLeft (83 tests)
├── scripts/
│   └── scrape-kbbi.js      # Skrip scraping & persiapan KBBI (rerunnable)
├── CHANGELOG.md            # Riwayat perubahan
└── README.md               # Dokumentasi proyek
```

## 🏗️ Progress Tahapan

### Fase 1: Fondasi & Infrastruktur
- [x] **Tahap 01** — Fondasi Proyek & Struktur File
- [x] **Tahap 02** — Desain Grid/Board — Model Data
- [x] **Tahap 03** — Rendering Grid — DOM-based Grid
- [x] **Tahap 04** — Rendering Grid — Scroll & Zoom

### Fase 2: KBBI & Validasi Kata
- [x] **Tahap 05** — Sumber Data KBBI — Scraping & Persiapan
- [x] **Tahap 06** — Struktur Data Trie
- [x] **Tahap 07** — Validasi Kata
- [x] **Tahap 08** — Pencarian Kata Berdasarkan Awalan
- [x] **Tahap 09** — Pencarian Kata Berdasarkan Akhiran

### Fase 3: Mekanik Penempatan Kata
- [x] **Tahap 10** — Mekanik Penempatan — Horizontal Kanan
- [x] **Tahap 11** — Mekanik Penempatan — Horizontal Kiri
- [ ] **Tahap 12** — Mekanik Penempatan — Vertikal Bawah
- [ ] **Tahap 13** — Mekanik Penempatan — Vertikal Atas
- [ ] **Tahap 14** — Deteksi & Validasi Persilangan (Intersection)
- [ ] **Tahap 15** — Deteksi & Validasi Cabang Baru (Branch)
- [ ] **Tahap 16** — Validasi Overlap & Konflik Penempatan
- [ ] **Tahap 17** — Sistem Daftar Kata Sudah Dipakai (No Repeat)
- [ ] **Tahap 18** — Kalkulasi Posisi & Anchoring

## 🛠️ Teknologi

- **HTML5** — Struktur halaman
- **CSS3** — Styling dengan CSS Variables, Flexbox, Grid, Responsif
- **Vanilla JavaScript** — Logika game (tanpa framework)
- **KBBI 2026** — Kamus Bahasa Indonesia

## 🚀 Cara Menjalankan

1. Clone repositori ini
2. Buka `index.html` di browser (atau gunakan live server)
3. Tidak memerlukan build step atau dependensi tambahan

### 📚 Regenerasi Dataset KBBI

Dataset KBBI sudah disertakan di `data/`. Jika perlu meregenerasi (mis. untuk
memperbarui ke versi KBBI lebih baru):

```bash
# Mode default — pakai dataset open-source (cepat, deterministik)
node scripts/scrape-kbbi.js

# Mode live — scrape langsung dari kbbi.kemdikbud.go.id (lambat, ~1 req/detik)
node scripts/scrape-kbbi.js --mode=live

# Hanya validasi file yang sudah ada
node scripts/scrape-kbbi.js --validate
```

### 🧪 Menjalankan Tests

```bash
node tests/test-board.js         # 88 tests — BoardModule (Tahap 02)
node tests/test-render.js        # 25 tests — renderBoard (Tahap 03)
node tests/test-zoom.js          # 50 tests — ZoomModule (Tahap 04)
node tests/test-kbbi.js         # 231 tests — Dataset KBBI (Tahap 05)
node tests/test-trie.js          # 146 tests — KBBITrie & KBBIModule (Tahap 06)
node tests/test-validation.js   # 207 tests — ValidationModule (Tahap 07)
node tests/test-prefix-search.js # 89 tests — SearchModule prefix search (Tahap 08)
node tests/test-suffix-search.js  # 81 tests — SearchModule suffix search (Tahap 09)
node tests/test-placement-right.js # 91 tests — PlacementModule.placeWordRight (Tahap 10)
node tests/test-placement-left.js  # 83 tests — PlacementModule.placeWordLeft (Tahap 11)
```

## 📜 Lisensi

Proyek ini dikembangkan untuk tujuan edukasi dan hiburan.
