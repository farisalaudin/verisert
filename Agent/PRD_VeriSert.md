# PRD: VeriSert — Verifikasi Keaslian Sertifikat Digital
### Kombinasi AES Encryption + LSB Steganography

> **Catatan untuk AI Agent / Coding Assistant:** Dokumen ini adalah spesifikasi lengkap untuk tugas besar mata kuliah Kriptografi. Bangun aplikasi ini step-by-step (struktur file → modul steganografi → modul kriptografi → UI → integrasi). Tanyakan ke saya jika ada bagian yang ambigu sebelum menulis kode. Jangan menambahkan dependency/build tool di luar yang disebutkan di bagian Tech Stack tanpa konfirmasi.

---

## 1. Ringkasan Proyek

**Nama Aplikasi:** VeriSert
**Tipe:** Web App single-page, 100% client-side (tanpa backend/server)
**Fungsi:** Menyisipkan data sertifikat yang sudah dienkripsi (AES) ke dalam gambar sertifikat menggunakan steganografi LSB, lalu memverifikasi keaslian sertifikat tersebut dengan mengekstrak dan mendekripsi data tersembunyinya.

---

## 2. Latar Belakang & Studi Kasus

Pemalsuan ijazah, sertifikat pelatihan, dan sertifikat kompetensi adalah masalah nyata di Indonesia — mulai dari gelar akademik palsu sampai sertifikat training/sertifikasi profesi abal-abal yang dipakai melamar kerja. Proses verifikasi manual (telepon/email ke penerbit) lambat dan tidak praktis.

**Solusi yang ditawarkan:** Setiap sertifikat resmi disisipi "tanda tangan digital tersembunyi" — yaitu data inti sertifikat (nama, NIM, nomor sertifikat, dst) yang dienkripsi lalu disembunyikan langsung di dalam piksel gambar sertifikat itu sendiri. Pihak ketiga (HRD, instansi tujuan, kampus penerima) bisa mengunggah gambar sertifikat ke aplikasi untuk mengecek keasliannya tanpa harus menghubungi penerbit secara manual.

Ini menggabungkan dua materi kelas:
- **Kriptografi (AES)** → menjaga kerahasiaan & memberi indikasi tamper-detection (ciphertext yang dimodifikasi akan gagal didekripsi)
- **Steganografi (LSB)** → menyembunyikan data tersebut di dalam gambar tanpa mengubah tampilan visual sertifikat

---

## 3. Tujuan & Kriteria Sukses

| Tujuan | Kriteria Sukses |
|---|---|
| Penerbit bisa membuat sertifikat dengan data tersembunyi | Output: gambar PNG yang identik secara visual dengan template, tapi mengandung data terenkripsi |
| Verifikator bisa mengecek keaslian dari gambar saja | Upload gambar → sistem menampilkan status ASLI/TIDAK VALID + data yang diekstrak |
| Mendemonstrasikan AES + LSB sesuai materi kelas | Kedua algoritma diimplementasikan secara eksplisit (bukan library black-box untuk stego) |
| Tamper-evidence sederhana | Jika gambar/ciphertext rusak, dekripsi gagal dengan jelas (bukan crash) |

**Non-goals (di luar scope, sengaja disederhanakan):**
- Tidak ada sistem akun/login sungguhan
- Tidak ada database/server — semua proses di browser (client-side)
- Tidak ada PKI (Public Key Infrastructure) penuh — menggunakan shared passphrase (lihat catatan keterbatasan di §15)

---

## 4. Peran Pengguna (User Roles)

1. **Penerbit (Issuer)** — pihak yang menerbitkan sertifikat (misal kampus/lembaga training). Membuat sertifikat baru dengan data tersembunyi.
2. **Verifikator** — pihak ketiga (HRD, instansi) yang ingin mengecek keaslian sertifikat yang diterima.

Keduanya diakses dari aplikasi yang sama, dibedakan lewat 2 tab/halaman.

---

## 5. User Flow

### 5.1 Mode "Buat Sertifikat" (Generate)
1. Penerbit mengisi form data: Nama Penerima, NIM/No. Induk, Nama Program/Sertifikat, Nomor Sertifikat, Tanggal Terbit, Nama Institusi Penerbit
2. Penerbit mengunggah gambar template sertifikat (cover image, **harus PNG**)
3. Penerbit mengisi **passphrase rahasia** (kunci yang nanti dibagikan ke pihak yang boleh memverifikasi)
4. Sistem menampilkan info kapasitas gambar (cukup/tidak cukup untuk menampung data)
5. Klik "Generate" → sistem mengenkripsi data → menyisipkan ke gambar via LSB
6. Sistem menampilkan preview before/after (harus terlihat identik) + tombol "Download Sertifikat (.png)"

### 5.2 Mode "Verifikasi Sertifikat" (Verify)
1. Verifikator mengunggah gambar sertifikat yang ingin dicek
2. Verifikator memasukkan passphrase (didapat dari penerbit)
3. Klik "Verifikasi" → sistem mengekstrak bit LSB → mendekripsi
4. Sistem menampilkan salah satu hasil:
   - ✅ **"Sertifikat Asli — Data Terverifikasi"** + tampilkan semua field data yang berhasil diekstrak
   - ❌ **"Tidak Ditemukan Tanda Tangan Digital / Passphrase Salah / Gambar Telah Dimodifikasi"**

---

## 6. Spesifikasi Algoritma Kriptografi (AES)

- **Library:** CryptoJS (via CDN, no install) — `https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js`
- **Mode:** Gunakan API passphrase-based convenience method dari CryptoJS (`CryptoJS.AES.encrypt(plaintext, passphrase)`), yang secara internal menangani salt + key derivation + IV (format OpenSSL-compatible, base64 output).
- **Data yang dienkripsi:** JSON string dari semua field sertifikat.

```js
// ENKRIPSI (sisi Penerbit)
const dataObj = {
  nama, nim, program, no_sertifikat, tanggal_terbit, penerbit
};
const plaintext = JSON.stringify(dataObj);
const ciphertext = CryptoJS.AES.encrypt(plaintext, passphrase).toString();
// ciphertext = base64 string, siap diubah jadi bytes untuk LSB

// DEKRIPSI (sisi Verifikator)
try {
  const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
  const plaintext = bytes.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error("Decrypt gagal / passphrase salah");
  const dataObj = JSON.parse(plaintext);
  // sukses -> tampilkan dataObj
} catch (e) {
  // gagal -> tampilkan status TIDAK VALID
}
```

> Jelaskan di laporan: kegagalan dekripsi (hasil kosong/JSON invalid) berfungsi sebagai bentuk **tamper-detection sederhana** — jika ciphertext yang disembunyikan rusak (karena gambar dimodifikasi/dikompresi ulang), hasil dekripsi otomatis tidak valid.

---

## 7. Spesifikasi Algoritma Steganografi (LSB)

- **Media:** Canvas API browser (native, tidak perlu library tambahan)
- **Channel yang dipakai:** R, G, B (skip channel Alpha)
- **Skema bit:** 32-bit header di awal menyatakan panjang payload (dalam byte), diikuti bit-bit payload itu sendiri

```text
PROSES EMBED (encode):
1. ciphertextBytes = UTF8(ciphertext)
2. headerBits = uint32ToBits(ciphertextBytes.length)   // 32 bit
3. payloadBits = bytesToBits(ciphertextBytes)
4. allBits = headerBits + payloadBits
5. capacity = width * height * 3   // 3 channel per pixel
6. JIKA allBits.length > capacity -> ERROR "Kapasitas gambar tidak cukup"
7. Loop tiap pixel, untuk channel R,G,B:
     pixel[channel] = (pixel[channel] & 0xFE) | currentBit
     // ganti bit terakhir (LSB) dengan bit data
8. Render hasil ke canvas baru -> export sebagai PNG

PROSES EXTRACT (decode):
1. Baca 32 bit pertama dari R,G,B pixel pertama -> dapat payloadByteLength
2. Baca (payloadByteLength * 8) bit selanjutnya -> payloadBits
3. payloadBytes = bitsToBytes(payloadBits)
4. ciphertext = UTF8decode(payloadBytes)
5. Lanjut ke proses dekripsi AES (§6)
```

**Aturan wajib:**
- Cover image **harus format PNG** (lossless). Tolak/peringatkan jika user upload JPG — kompresi JPEG akan merusak bit LSB.
- Selalu export hasil sebagai PNG, jangan biarkan browser otomatis convert ke JPG saat download.

---

## 8. Tech Stack

| Komponen | Pilihan | Alasan |
|---|---|---|
| Struktur | HTML + CSS + Vanilla JS | Tanpa build step, langsung jalan di browser |
| Kriptografi | CryptoJS (CDN) | Gratis, tidak perlu install, AES sudah teruji |
| Steganografi | Canvas API (native) | Built-in browser, kontrol penuh ke level pixel |
| Hosting | Buka langsung `index.html`, atau deploy gratis ke GitHub Pages / Netlify / Vercel | Zero cost |

**Tidak boleh dipakai** (di luar scope agar tetap simple & gratis): framework JS (React/Vue), backend server, database, package manager/build tool (Webpack/Vite) — kecuali nanti diputuskan lain.

---

## 9. Struktur File yang Disarankan

```
verisert/
├── index.html          # 2 tab: Buat Sertifikat & Verifikasi
├── style.css
├── js/
│   ├── crypto.js        # fungsi encrypt/decrypt AES
│   ├── stego.js          # fungsi embedLSB/extractLSB
│   └── app.js            # logic UI, event handlers
└── assets/
    └── contoh-template-sertifikat.png
```

---

## 10. Functional Requirements

| ID | Requirement |
|---|---|
| F1 | Form generate harus validasi semua field wajib tidak boleh kosong |
| F2 | Sistem menghitung & menampilkan kapasitas gambar sebelum embed |
| F3 | Sistem menolak upload non-PNG di kedua mode dengan pesan jelas |
| F4 | Hasil gambar stego harus bisa didownload dengan nama file custom |
| F5 | Preview before/after ditampilkan berdampingan setelah generate |
| F6 | Mode verifikasi menampilkan seluruh field data hasil ekstraksi jika valid |
| F7 | Status verifikasi ditampilkan dengan indikator visual jelas (warna hijau/merah) |
| F8 | Semua proses (encrypt, embed, extract, decrypt) berjalan di sisi client, tidak ada data terkirim ke server manapun |
| F9 | Passphrase di-input dengan `type="password"` dan tidak pernah disimpan/di-log |

---

## 11. UI/UX Requirements

- 2 tab utama: **"Buat Sertifikat"** dan **"Verifikasi Sertifikat"**
- Tema visual sederhana, bersih, kesan akademik/formal (boleh biru-putih)
- Komponen di tab Generate: form input, file upload preview, indikator kapasitas, tombol generate, area preview before/after, tombol download
- Komponen di tab Verify: file upload, input passphrase, tombol verifikasi, hasil ekstraksi dalam card, badge status (✅/❌)
- Responsive untuk layar laptop standar (tidak perlu optimasi mobile mendalam)

---

## 12. Validasi & Error Handling

| Kondisi | Perilaku yang diharapkan |
|---|---|
| Gambar terlalu kecil untuk kapasitas data | Tampilkan pesan + saran resolusi minimum, tombol generate disabled |
| Upload file bukan gambar/bukan PNG | Tolak dengan pesan error, jangan crash |
| Passphrase salah saat verifikasi | Tampilkan "Tidak ditemukan tanda tangan digital valid", bukan error teknis mentah |
| Upload gambar acak (bukan hasil sistem) | Sama seperti di atas — gagal dekripsi dengan baik |
| Field form kosong saat submit | Highlight field yang kosong, jangan submit |

---

## 13. Skenario Pengujian (Acceptance Criteria)

- [ ] **TC1:** Generate sertifikat lengkap → download → re-upload di mode verify dengan passphrase benar → semua field hasil ekstraksi identik dengan input awal
- [ ] **TC2:** Verifikasi dengan passphrase salah → gagal dengan pesan jelas, tidak crash
- [ ] **TC3:** Upload gambar yang tidak pernah digenerate sistem → status "tidak valid"
- [ ] **TC4:** Convert gambar stego ke JPG lalu upload kembali → ekstraksi gagal (dipakai sebagai bukti keterbatasan LSB di laporan)
- [ ] **TC5:** Upload gambar dengan resolusi sangat kecil saat generate → sistem menolak sebelum proses embed
- [ ] **TC6:** Preview before/after generate harus terlihat identik secara visual ke mata manusia

---

## 14. Keterbatasan Diketahui (penting untuk bagian "Review Aplikasi" di laporan)

1. **Passphrase shared-secret, bukan PKI sungguhan** — di sistem produksi nyata, kunci sebaiknya dikelola per-institusi di server/HSM, bukan diketik manual. Untuk scope tugas, passphrase dianggap dibagikan secara aman dari penerbit ke verifikator resmi (misal HRD mitra).
2. **LSB rentan kompresi lossy & resize** — gambar harus tetap PNG dan tidak diedit ulang. Ini keterbatasan klasik metode LSB yang sudah dibahas di kelas.
3. **Tamper-detection tidak eksplisit** — keberhasilan/kegagalan dekripsi AES dipakai sebagai sinyal tidak langsung; bukan mekanisme integritas formal seperti HMAC/auth-tag (AES-GCM). Bisa disebut sebagai potential improvement.
4. **Tidak ada autentikasi penerbit** — siapapun yang punya passphrase bisa generate sertifikat "asli" di aplikasi ini; di dunia nyata perlu otorisasi institusi.

---

## 15. Mapping ke Rubrik Tugas Besar

| Requirement Tugas | Dipenuhi oleh |
|---|---|
| Aplikasi/sistem informasi dgn kriptografi + steganografi | VeriSert (AES + LSB) |
| Studi kasus real | Anti-pemalsuan ijazah/sertifikat |
| Metode sesuai materi kelas | AES (DES_AES_Slides.md) + LSB (Steganografi_1.md) |
| Laporan: latar belakang | §2 dokumen ini |
| Laporan: penjelasan metode/algoritma | §6 dan §7 dokumen ini |
| Laporan: review aplikasi | §11–§14 dokumen ini |
| Laporan: daftar pustaka (5 jurnal) | *Belum dikerjakan — lihat catatan di bawah* |

---

## 16. Saran Pengembangan Lanjutan (opsional, jika ada waktu lebih)

- Generate QR code kecil di pojok sertifikat sebagai shortcut visual ke fitur verifikasi
- Histori sertifikat yang dibuat dalam satu sesi (in-memory saja, tanpa localStorage)
- Pilihan beberapa template sertifikat siap pakai

---

## 17. Prompt Pembuka untuk AI Agent IDE

Bisa langsung dipakai sebagai pesan pertama ke agent:

> "Tolong bangun aplikasi web sesuai PRD berikut, step-by-step dimulai dari struktur folder, lalu modul steganografi (stego.js), lalu modul kriptografi (crypto.js), baru terakhir UI dan integrasinya di app.js. Setelah tiap modul selesai, tunjukkan ke saya dulu sebelum lanjut ke modul berikutnya. Tanyakan ke saya kalau ada bagian PRD yang ambigu."

---

*Dokumen ini dibuat untuk Tugas Besar Mata Kuliah Kriptografi — Studi Kasus Verifikasi Keaslian Sertifikat Digital.*
