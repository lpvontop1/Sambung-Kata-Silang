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
│   └── kbbi.json       # Data KBBI (Kamus Besar Bahasa Indonesia)
├── tests/
│   ├── test-board.js   # Unit test BoardModule (88 tests)
│   ├── test-render.js  # Unit test renderBoard (25 tests)
│   └── test-zoom.js    # Unit test ZoomModule (50 tests)
├── scripts/            # Skrip utilitas (scraping, dll)
├── CHANGELOG.md        # Riwayat perubahan
└── README.md           # Dokumentasi proyek
```

## 🏗️ Progress Tahapan

### Fase 1: Fondasi & Infrastruktur
- [x] **Tahap 01** — Fondasi Proyek & Struktur File
- [x] **Tahap 02** — Desain Grid/Board — Model Data
- [x] **Tahap 03** — Rendering Grid — DOM-based Grid
- [x] **Tahap 04** — Rendering Grid — Scroll & Zoom

### Fase 2: KBBI & Validasi Kata
- [ ] **Tahap 05** — Sumber Data KBBI
- [ ] **Tahap 06** — Struktur Data Trie
- [ ] **Tahap 07** — Validasi Kata
- [ ] **Tahap 08** — Pencarian Kata Berdasarkan Awalan
- [ ] **Tahap 09** — Pencarian Kata Berdasarkan Akhiran

### Fase 3–10: *(待実装 — upcoming tahaps)*

## 🛠️ Teknologi

- **HTML5** — Struktur halaman
- **CSS3** — Styling dengan CSS Variables, Flexbox, Grid, Responsif
- **Vanilla JavaScript** — Logika game (tanpa framework)
- **KBBI 2026** — Kamus Bahasa Indonesia

## 🚀 Cara Menjalankan

1. Clone repositori ini
2. Buka `index.html` di browser (atau gunakan live server)
3. Tidak memerlukan build step atau dependensi tambahan

## 📜 Lisensi

Proyek ini dikembangkan untuk tujuan edukasi dan hiburan.
