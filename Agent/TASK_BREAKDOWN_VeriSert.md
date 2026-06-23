# Story/Task Breakdown: VeriSert
### Pecahan task kecil + acceptance criteria — pendamping `PRD_VeriSert.md` & `TDD_VeriSert.md`

> **Cara pakai dokumen ini ke AI Agent IDE:** Kerjakan **satu task per giliran**, jangan minta agent mengerjakan banyak task sekaligus. Setelah satu task selesai, cek semua acceptance criteria-nya dulu — kalau ada yang gagal, perbaiki dulu sebelum lanjut ke task berikutnya. Urutan epic (A→K) = urutan dependency, jangan dilompat.

---

## Daftar Epic

| Epic | Nama | Jumlah Task |
|---|---|---|
| A | Setup Project Scaffold | 2 |
| B | Modul `utils.js` | 4 |
| C | Modul `stego.js` | 6 |
| D | Modul `crypto.js` | 4 |
| E | Canvas Helper Functions | 2 |
| F | UI: Tab Navigation & Layout | 2 |
| G | UI: Generate Certificate Flow | 5 |
| H | UI: Verify Certificate Flow | 3 |
| I | Styling | 1 |
| J | Integration & Manual QA | 7 |
| K | Dokumentasi & Submission Prep | 3 |

**Total: 39 task**

---

## EPIC A — Setup Project Scaffold

### A-1: Buat struktur folder & file kosong
**Acuan:** TDD §9
- [ ] Folder `verisert/` berisi: `index.html`, `style.css`, `js/utils.js`, `js/stego.js`, `js/crypto.js`, `js/app.js`, `assets/`
- [ ] Semua file `.js` kosong tapi valid (tidak ada syntax error saat di-load browser)

### A-2: Setup `index.html` skeleton + CDN CryptoJS
**Depends on:** A-1 | **Acuan:** TDD §8
- [ ] Skeleton HTML sesuai TDD §8 (header, nav tabs, 2 section, urutan script tag benar)
- [ ] Dibuka langsung via double-click (file://), console browser tidak ada error `CryptoJS is not defined`
- [ ] Urutan load script: CryptoJS CDN → `utils.js` → `stego.js` → `crypto.js` → `app.js`

---

## EPIC B — Modul `utils.js`

### B-1: Implement `bytesToBits` & `bitsToBytes`
**Depends on:** A-2 | **Acuan:** TDD §6.1
- [ ] `bytesToBits(new Uint8Array([0]))` → 8 elemen, semua `0`
- [ ] `bytesToBits(new Uint8Array([255]))` → 8 elemen, semua `1`
- [ ] `bitsToBytes(bytesToBits(x))` identik dengan `x` untuk `x = [0, 255, 128, 1, 42]`
- [ ] Ada JSDoc comment di kedua fungsi

### B-2: Implement `uint32ToBits` & `bitsToUint32`
**Depends on:** B-1
- [ ] `bitsToUint32(uint32ToBits(N)) === N` untuk N = 0, 1, 255, 65536, 4294967295
- [ ] `uint32ToBits(0)` → 32 elemen semua `0`; `uint32ToBits(4294967295)` → 32 elemen semua `1`

### B-3: Implement `utf8ToBytes` & `bytesToUtf8`
**Depends on:** B-1
- [ ] `bytesToUtf8(utf8ToBytes("test123")) === "test123"`
- [ ] String kosong `""` tidak menyebabkan error

### B-4: Buat `test.html` dasar + jalankan test Epic B
**Depends on:** B-1, B-2, B-3 | **Acuan:** TDD §13
- [ ] `test.html` me-load `utils.js`, menjalankan semua assertion B-1/B-2/B-3, menampilkan PASS/FAIL ke halaman
- [ ] Semua assertion **PASS** saat dibuka di browser

---

## EPIC C — Modul `stego.js`

### C-1: Implement `CapacityError` + fungsi kalkulasi kapasitas
**Depends on:** B-4 | **Acuan:** TDD §6.2
- [ ] `class CapacityError extends Error` dibuat
- [ ] `calculateCapacityBits(10, 10) === 300`
- [ ] `calculateRequiredBits(5) === 72` (32 header + 5×8 payload)

### C-2: Implement `createBitWriter`
**Depends on:** C-1
- [ ] Pada fake pixel array `[200,200,200,255, 200,200,200,255]`, `writeBits([1,0,1,1])` hanya mengubah bit terakhir R,G,B pixel-1 dan R pixel-2
- [ ] Index Alpha (posisi ke-4 tiap pixel) **tidak pernah** berubah
- [ ] Menulis lebih banyak bit daripada slot tersedia → melempar `CapacityError`

### C-3: Implement `createBitReader`
**Depends on:** C-2
- [ ] `readBits(n)` pada array pixel yang sama menghasilkan urutan bit **identik** dengan yang ditulis writer
- [ ] Minta baca lebih banyak bit daripada tersedia → melempar `Error`, tidak infinite loop

### C-4: Implement `embedLSB`
**Depends on:** C-3
- [ ] Embed payload 5 byte ke `ImageData` 10×10 → sukses tanpa error
- [ ] Embed payload besar ke `ImageData` 2×2 → melempar `CapacityError`
- [ ] Setelah embed, nilai pixel berubah **maksimal ±1** dari nilai asli (hanya bit terakhir yang berubah)

### C-5: Implement `extractLSB`
**Depends on:** C-4
- [ ] `extractLSB(embedLSB(imageData, payload))` identik byte-by-byte dengan `payload` asli — uji dengan payload `"Hello"` dan payload string JSON contoh sertifikat
- [ ] Dipanggil pada `ImageData` random (belum pernah di-embed) → tidak crash, tidak hang (boleh hasilkan data sampah)

### C-6: Unit test round-trip `stego.js`
**Depends on:** C-5 | **Acuan:** TDD §13
- [ ] `test.html` ditambah assertion embed+extract round-trip dari TDD §13
- [ ] Semua **PASS**

---

## EPIC D — Modul `crypto.js`

### D-1: Implement `DecryptionError` class
**Depends on:** B-4 | **Acuan:** TDD §6.3
- [ ] `class DecryptionError extends Error` dibuat

### D-2: Implement `encryptCertificateData`
**Depends on:** D-1
- [ ] Output cocok pola base64: `/^[A-Za-z0-9+/=]+$/`
- [ ] Enkripsi data yang sama 2x dengan passphrase sama → ciphertext **berbeda** setiap kali (salt random — ini expected behavior, bukan bug, tambahkan komentar di kode menjelaskan ini)

### D-3: Implement `decryptCertificateData`
**Depends on:** D-2
- [ ] `decrypt(encrypt(data, "pass123"), "pass123")` menghasilkan objek identik dengan `data` asli
- [ ] `decrypt(ciphertext, "passphrase_salah")` → melempar `DecryptionError`, bukan error JS mentah
- [ ] `decrypt("string_random_bukan_ciphertext", "apapun")` → melempar `DecryptionError` dengan baik (tidak crash)

### D-4: Unit test round-trip `crypto.js`
**Depends on:** D-3 | **Acuan:** TDD §13
- [ ] `test.html` ditambah assertion crypto round-trip + wrong-passphrase dari TDD §13
- [ ] Semua **PASS**

---

## EPIC E — Canvas Helper Functions

### E-1: Implement `loadImageToCanvas`
**Depends on:** A-2 | **Acuan:** TDD §6.4
- [ ] Upload file PNG via `<input type="file">` → resolve `{canvas, ctx, width, height}` sesuai dimensi asli
- [ ] Upload file corrupt/bukan gambar → reject dengan `Error`, tidak hang

### E-2: Implement `canvasToPNGBlob`
**Depends on:** E-1
- [ ] Menghasilkan `Blob` dengan `type === 'image/png'`
- [ ] Blob bisa dijadikan object URL dan ditampilkan di `<img>` tanpa error

---

## EPIC F — UI: Tab Navigation & Layout

### F-1: Implement tab switching
**Depends on:** A-2
- [ ] Klik tab "Buat Sertifikat" → tampilkan section generate, sembunyikan section verify
- [ ] Klik tab "Verifikasi Sertifikat" → sebaliknya
- [ ] Tab aktif punya indikator visual jelas (misal class `active`)

### F-2: Build form markup tab Generate
**Depends on:** F-1 | **Acuan:** PRD §5.1
- [ ] Field: nama, nim, program, no_sertifikat, tanggal_terbit (date input), penerbit, upload cover image, passphrase (password input)
- [ ] Semua field wajib (`required`), validasi native browser aktif

---

## EPIC G — UI: Generate Certificate Flow

### G-1: Implement validasi form sebelum submit
**Depends on:** F-2 | **Acuan:** PRD §12
- [ ] Submit dengan field kosong → tidak lanjut proses, field kosong di-highlight
- [ ] Upload file bukan PNG → tampilkan error spesifik "Harus format PNG", proses dihentikan

### G-2: Implement capacity check & live indicator
**Depends on:** G-1, C-1, E-1 | **Acuan:** PRD §F2
- [ ] Setelah upload gambar, tampilkan "Kapasitas tersedia: X bit"
- [ ] Setelah semua field terisi, hitung & tampilkan "Dibutuhkan: Y bit" + badge hijau/merah cukup/tidak cukup
- [ ] Tombol Generate **disabled** jika kapasitas tidak cukup

### G-3: Implement `handleGenerateSubmit` (orkestrasi penuh)
**Depends on:** G-2, C-4, D-2, E-2 | **Acuan:** TDD §7.1
- [ ] Mengikuti urutan langkah TDD §7.1 poin 1–9 tanpa ada yang di-skip
- [ ] Error di tahap manapun (capacity, decrypt, dll) ditangkap & ditampilkan ke user — browser tidak freeze/blank

### G-4: Implement preview before/after
**Depends on:** G-3
- [ ] Setelah generate sukses, tampilkan 2 gambar berdampingan: original vs hasil stego
- [ ] Kedua gambar terlihat identik secara visual ke mata manusia

### G-5: Implement tombol download
**Depends on:** G-4
- [ ] Klik download → file `.png` valid, bisa dibuka di image viewer manapun
- [ ] Nama file otomatis, misal `sertifikat-{nama}-{no_sertifikat}.png`

---

## EPIC H — UI: Verify Certificate Flow

### H-1: Build form markup tab Verify
**Depends on:** F-1
- [ ] Field: upload file gambar, passphrase (password input), tombol "Verifikasi"

### H-2: Implement `handleVerifySubmit` (orkestrasi penuh)
**Depends on:** H-1, C-5, D-3, E-1 | **Acuan:** TDD §7.2
- [ ] Mengikuti urutan TDD §7.2 poin 1–6
- [ ] Tidak ada uncaught exception untuk semua skenario di TDD §9 (Tabel Error Handling)

### H-3: Implement `renderVerificationResult`
**Depends on:** H-2
- [ ] Status valid → badge hijau "Sertifikat Asli — Data Terverifikasi" + semua field data ditampilkan via `textContent` (**bukan** `innerHTML`)
- [ ] Status invalid → badge merah + pesan error sesuai TDD §9
- [ ] Submit form yang sama 2× tidak menumpuk hasil lama (hasil sebelumnya di-clear)

---

## EPIC I — Styling

### I-1: Styling dasar (`style.css`)
**Depends on:** F-2, H-1
- [ ] Tema bersih, kontras teks cukup, tidak ada elemen overlap di resolusi ≥1366×768
- [ ] Badge status verifikasi (hijau/merah) jelas dengan warna + ikon, bukan teks polos

---

## EPIC J — Integration & Manual QA
*(mapping langsung ke PRD §13)*

### J-1 (TC1): Generate → Download → Re-upload → Verify (happy path)
**Depends on:** G-5, H-3
- [ ] Semua field hasil ekstraksi identik dengan input awal saat generate

### J-2 (TC2): Verify dengan passphrase salah
**Depends on:** J-1
- [ ] Tampil pesan error jelas, tidak crash

### J-3 (TC3): Verify gambar acak (bukan hasil sistem)
**Depends on:** J-1
- [ ] Tampil status "tidak valid" dengan baik

### J-4 (TC4): Convert hasil ke JPG lalu verify
**Depends on:** J-1
- [ ] Ekstraksi gagal terdeteksi dengan baik (bukti keterbatasan LSB untuk laporan)

### J-5 (TC5): Generate dengan gambar resolusi sangat kecil
**Depends on:** G-2
- [ ] Sistem menolak sebelum proses embed, pesan kapasitas jelas

### J-6 (TC6): Cek preview before/after
**Depends on:** G-4
- [ ] Dikonfirmasi identik secara visual oleh penguji manusia

### J-7: Cross-browser check
**Depends on:** J-1 s.d. J-6
- [ ] Seluruh flow (generate + verify) dicoba minimal di 2 browser berbeda (misal Chrome & Firefox), hasil konsisten

---

## EPIC K — Dokumentasi & Submission Prep

### K-1: Tulis `README.md` cara menjalankan app
**Depends on:** J-7
- [x] Instruksi: cukup buka `index.html`, tidak perlu install apapun
- [x] Mencantumkan passphrase contoh untuk demo + catatan "bukan untuk production"

### K-2: Ambil screenshot untuk laporan
**Depends on:** J-7
- [ ] Screenshot tab Generate (form terisi + preview before/after)
- [ ] Screenshot tab Verify hasil **valid** (badge hijau)
- [ ] Screenshot tab Verify hasil **invalid** (badge merah, skenario tamper/JPG dari J-4)

### K-3: Final packaging
**Depends on:** K-1, K-2
- [ ] Semua file (`index.html`, `style.css`, `js/`, `assets/`) dalam satu folder siap di-zip
- [ ] Dicoba dibuka di komputer/browser lain (bukan environment development) untuk pastikan tidak ada dependency yang ketinggalan

---

## Progress Tracker

```
A: [x]A-1 [x]A-2
B: [x]B-1 [x]B-2 [x]B-3 [x]B-4
C: [x]C-1 [x]C-2 [x]C-3 [x]C-4 [x]C-5 [x]C-6
D: [x]D-1 [x]D-2 [x]D-3 [x]D-4
E: [x]E-1 [x]E-2
F: [x]F-1 [x]F-2
G: [x]G-1 [x]G-2 [x]G-3 [x]G-4 [x]G-5
H: [x]H-1 [x]H-2 [x]H-3
I: [x]I-1
J: [x]J-1 [x]J-2 [x]J-3 [x]J-4 [x]J-5 [ ]J-6 [ ]J-7
K: [x]K-1 [ ]K-2 [ ]K-3
```

*Dokumen ini melengkapi `PRD_VeriSert.md` dan `TDD_VeriSert.md`. Berikan ketiganya bersamaan ke AI Agent IDE, lalu minta kerjakan satu task per giliran sesuai urutan epic.*
