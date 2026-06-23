# Technical Design Document (TDD): VeriSert
### Pendamping teknis dari `PRD_VeriSert.md` — fokus pada arsitektur, modul, skema data, dan reference implementation.

> **Catatan untuk AI Agent:** Dokumen ini melengkapi PRD. PRD menjawab "apa & kenapa", dokumen ini menjawab "bagaimana secara teknis". Kode pada §6 adalah **reference implementation** yang sudah dirancang benar secara logika (bit-indexing teruji) — implementasikan persis sesuai pola ini untuk modul `stego.js`, jangan menulis ulang algoritma LSB dari nol dengan pendekatan berbeda.

---

## 1. Tujuan Dokumen

Menjabarkan struktur kode, kontrak fungsi (function signature), skema data, dan keputusan teknis yang tidak dibahas detail di PRD — supaya implementasi oleh AI coding agent konsisten dan tidak ambigu, khususnya di bagian bit-manipulation LSB yang rawan bug off-by-one.

---

## 2. Arsitektur Sistem

Single-page app, 100% client-side, tanpa build step. 5 file inti + 1 dependency CDN.

```
┌─────────────────────────────────────────────────────────┐
│                      index.html                          │
│  (DOM: form generate, form verify, canvas, preview)       │
└───────────────┬─────────────────────────────────┬────────┘
                │                                 │
        ┌───────▼────────┐                ┌───────▼────────┐
        │   app.js        │ orchestrates  │   style.css     │
        │  (UI logic,     │                └─────────────────┘
        │  event handler) │
        └───┬─────────┬───┘
            │         │
    ┌───────▼───┐ ┌───▼────────┐
    │ crypto.js │ │  stego.js   │
    │ (AES)     │ │  (LSB)      │
    └───┬───────┘ └───┬─────────┘
        │             │
    ┌───▼─────────────▼───┐
    │   utils.js            │  (konversi bit/byte, dipakai keduanya)
    └────────────────────────┘
        │
    ┌───▼────────────────┐
    │ CryptoJS (CDN)      │
    └─────────────────────┘
```

**Alur data — Generate:**
```
Form Input → crypto.js:encrypt() → ciphertext
Cover Image → Canvas.getImageData() → stego.js:embedLSB(imageData, ciphertextBytes)
            → Canvas.putImageData() → canvas.toBlob('image/png') → Download
```

**Alur data — Verify:**
```
Uploaded Image → Canvas.getImageData() → stego.js:extractLSB() → ciphertext
               → crypto.js:decrypt() → dataObj → render ke UI
```

---

## 3. Keputusan Desain Teknis Kunci

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Module system | **Classic `<script>` tags**, bukan `type="module"` | ES modules diblokir CORS-nya browser saat dibuka via `file://` langsung (tanpa local server). Classic script tetap bisa double-click `index.html` |
| Sharing fungsi antar file | Function declaration biasa di global scope (tanpa IIFE/namespace kompleks) | Sederhana, cukup untuk skala project ini |
| Bit read/write | **Stateful single-pass reader/writer** (lihat §6.2) | Single pass O(n), hindari bug double-scan / off-by-one |
| Urutan channel | R → G → B per pixel, **skip Alpha** | Alpha biasanya 255 konstan; mengubahnya bisa memicu artefak transparansi di beberapa format |
| Header payload | 32-bit unsigned integer (panjang payload dalam byte), ditulis sebagai bit pertama sebelum payload | Decoder tahu pasti kapan berhenti membaca, tanpa delimiter rawan-konflik |
| Format ciphertext | Base64 string dari `CryptoJS.AES.encrypt().toString()` | Karakter base64 = ASCII murni → aman dikonversi byte 1:1 via `TextEncoder` |

---

## 4. Struktur Modul & Tanggung Jawab

| File | Tanggung Jawab | Tidak boleh berisi |
|---|---|---|
| `js/utils.js` | Konversi bit↔byte, byte↔string (UTF-8), uint32↔bit | Logic AES atau LSB |
| `js/stego.js` | `embedLSB()`, `extractLSB()`, kalkulasi kapasitas, custom error `CapacityError` | Apapun terkait enkripsi |
| `js/crypto.js` | `encryptCertificateData()`, `decryptCertificateData()`, custom error `DecryptionError` | Akses DOM/canvas |
| `js/app.js` | Event handler, validasi form, load file→canvas, orkestrasi panggilan ke 2 modul di atas, render hasil ke DOM | Logic algoritma murni (delegasikan ke modul lain) |

---

## 5. Skema Data

### 5.1 Objek Data Sertifikat (sebelum dienkripsi)
```json
{
  "nama": "string",
  "nim": "string",
  "program": "string",
  "no_sertifikat": "string",
  "tanggal_terbit": "string (format: YYYY-MM-DD)",
  "penerbit": "string"
}
```

### 5.2 Layout Bit yang Disisipkan ke Gambar
```
[bit 0  .. bit 31]   → uint32, MSB-first = panjang ciphertext dalam BYTE
[bit 32 .. bit N]    → ciphertext (UTF-8 bytes dari base64 string CryptoJS), MSB-first per byte
```
Total bit yang dibutuhkan = `32 + (panjang_ciphertext_byte * 8)`
Total kapasitas tersedia = `width * height * 3`

---

## 6. Spesifikasi & Reference Implementation per Modul

### 6.1 `utils.js`

```js
/** Uint8Array -> array bit (0/1), MSB-first per byte */
function bytesToBits(bytes) {
  const bits = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  return bits;
}

/** array bit -> Uint8Array. bits.length harus kelipatan 8 */
function bitsToBytes(bits) {
  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    let value = 0;
    for (let b = 0; b < 8; b++) value = (value << 1) | bits[i * 8 + b];
    bytes[i] = value;
  }
  return bytes;
}

/** number -> 32 bit array, MSB-first */
function uint32ToBits(num) {
  const bits = [];
  for (let b = 31; b >= 0; b--) bits.push((num >>> b) & 1);
  return bits;
}

/** 32 bit array (MSB-first) -> number */
function bitsToUint32(bits) {
  let value = 0;
  for (let i = 0; i < 32; i++) value = (value << 1) | bits[i];
  return value >>> 0;
}

function utf8ToBytes(str) { return new TextEncoder().encode(str); }
function bytesToUtf8(bytes) { return new TextDecoder().decode(bytes); }
```

### 6.2 `stego.js`

```js
const HEADER_BITS = 32;

class CapacityError extends Error {}

function calculateCapacityBits(width, height) { return width * height * 3; }
function calculateRequiredBits(payloadByteLength) { return HEADER_BITS + payloadByteLength * 8; }

/** Stateful bit writer: menulis 1 bit per pixel-channel (R,G,B), skip Alpha */
function createBitWriter(pixels) {
  let pixelOffset = 0, channelOffset = 0;
  function writeBit(bit) {
    if (channelOffset > 2) { channelOffset = 0; pixelOffset += 4; }
    if (pixelOffset >= pixels.length) throw new CapacityError("Kapasitas gambar tidak cukup.");
    const idx = pixelOffset + channelOffset;
    pixels[idx] = (pixels[idx] & 0xfe) | (bit & 1);
    channelOffset++;
  }
  return { writeBits: (arr) => arr.forEach(writeBit) };
}

/** Stateful bit reader: cermin dari writer, urutan baca harus identik */
function createBitReader(pixels) {
  let pixelOffset = 0, channelOffset = 0;
  function nextBit() {
    if (channelOffset > 2) { channelOffset = 0; pixelOffset += 4; }
    if (pixelOffset >= pixels.length) throw new Error("Gambar terlalu kecil / data tidak lengkap.");
    const bit = pixels[pixelOffset + channelOffset] & 1;
    channelOffset++;
    return bit;
  }
  return { readBits: (count) => Array.from({ length: count }, nextBit) };
}

/**
 * @param {ImageData} imageData - dimutasi langsung
 * @param {Uint8Array} payloadBytes
 * @returns {ImageData}
 * @throws {CapacityError}
 */
function embedLSB(imageData, payloadBytes) {
  const capacityBits = calculateCapacityBits(imageData.width, imageData.height);
  const requiredBits = calculateRequiredBits(payloadBytes.length);
  if (requiredBits > capacityBits) {
    throw new CapacityError(`Butuh ${requiredBits} bit, tersedia ${capacityBits} bit.`);
  }
  const writer = createBitWriter(imageData.data);
  writer.writeBits(uint32ToBits(payloadBytes.length));
  writer.writeBits(bytesToBits(payloadBytes));
  return imageData;
}

/**
 * @param {ImageData} imageData
 * @returns {Uint8Array} payloadBytes
 */
function extractLSB(imageData) {
  const reader = createBitReader(imageData.data);
  const headerBits = reader.readBits(HEADER_BITS);
  const payloadByteLength = bitsToUint32(headerBits);
  const payloadBits = reader.readBits(payloadByteLength * 8);
  return bitsToBytes(payloadBits);
}
```

> ⚠️ **Catatan kritis:** `createBitWriter` dan `createBitReader` HARUS punya urutan iterasi pixel/channel yang identik (R→G→B, skip index+3/Alpha, lanjut ke pixel berikutnya tiap 4 index). Kalau salah satu diubah tanpa mengubah yang lain, encode/decode akan mismatch secara diam-diam (tidak error, tapi data hasil ekstraksi jadi sampah).

### 6.3 `crypto.js`

```js
class DecryptionError extends Error {}

/**
 * @param {Object} dataObj
 * @param {string} passphrase
 * @returns {string} ciphertext (base64)
 */
function encryptCertificateData(dataObj, passphrase) {
  const plaintext = JSON.stringify(dataObj);
  return CryptoJS.AES.encrypt(plaintext, passphrase).toString();
}

/**
 * @param {string} ciphertext
 * @param {string} passphrase
 * @returns {Object} dataObj
 * @throws {DecryptionError}
 */
function decryptCertificateData(ciphertext, passphrase) {
  let plaintext;
  try {
    plaintext = CryptoJS.AES.decrypt(ciphertext, passphrase).toString(CryptoJS.enc.Utf8);
  } catch (e) {
    throw new DecryptionError("Gagal mendekripsi data.");
  }
  if (!plaintext) throw new DecryptionError("Passphrase salah atau data rusak.");
  try {
    return JSON.parse(plaintext);
  } catch (e) {
    throw new DecryptionError("Format data tidak valid setelah dekripsi.");
  }
}
```

### 6.4 `app.js` — Helper Canvas (load file & export)

```js
/** File (dari <input type=file>) -> {canvas, ctx, width, height} */
function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ canvas, ctx, width: img.width, height: img.height });
    };
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
    img.src = url;
  });
}

function canvasToPNGBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
```

---

## 7. Alur Eksekusi Detail

### 7.1 Generate (orkestrasi di `app.js`)
```
1.  validateForm(formData)                         → stop jika invalid, tandai field kosong
2.  { canvas, ctx, width, height } = await loadImageToCanvas(coverImageFile)
3.  imageData = ctx.getImageData(0, 0, width, height)
4.  ciphertext = encryptCertificateData(dataObj, passphrase)
5.  payloadBytes = utf8ToBytes(ciphertext)
6.  requiredBits = calculateRequiredBits(payloadBytes.length)
    capacityBits = calculateCapacityBits(width, height)
    JIKA requiredBits > capacityBits → tampilkan error kapasitas, STOP (jangan lanjut embed)
7.  embedLSB(imageData, payloadBytes)               → throws CapacityError jika gagal (sudah dicek di step 6, tapi tetap try/catch)
8.  ctx.putImageData(imageData, 0, 0)
9.  blob = await canvasToPNGBlob(canvas)
10. renderPreview(originalCanvas, canvas)            → tampilkan before/after
11. buat <a download="sertifikat-stego.png"> dari URL.createObjectURL(blob)
```

### 7.2 Verify (orkestrasi di `app.js`)
```
1.  { canvas, ctx, width, height } = await loadImageToCanvas(uploadedFile)
2.  imageData = ctx.getImageData(0, 0, width, height)
3.  try:
        payloadBytes = extractLSB(imageData)
    catch:
        renderVerificationResult('invalid', null, 'Tidak ditemukan tanda tangan digital pada gambar ini.')
        STOP
4.  ciphertext = bytesToUtf8(payloadBytes)
5.  try:
        dataObj = decryptCertificateData(ciphertext, passphrase)
    catch (DecryptionError):
        renderVerificationResult('invalid', null, 'Passphrase salah atau sertifikat telah dimodifikasi.')
        STOP
6.  renderVerificationResult('valid', dataObj)
```

---

## 8. Struktur HTML/DOM (skeleton)

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>VeriSert</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header><!-- judul app --></header>

  <nav class="tabs">
    <button data-tab="generate" class="active">Buat Sertifikat</button>
    <button data-tab="verify">Verifikasi Sertifikat</button>
  </nav>

  <section id="tab-generate">
    <form id="form-generate">
      <!-- input: nama, nim, program, no_sertifikat, tanggal_terbit, penerbit -->
      <!-- input file: cover image -->
      <!-- input password: passphrase -->
      <div id="capacity-info"></div>
      <button type="submit">Generate</button>
    </form>
    <div id="preview-area"></div>
  </section>

  <section id="tab-verify" hidden>
    <form id="form-verify">
      <!-- input file: gambar sertifikat -->
      <!-- input password: passphrase -->
      <button type="submit">Verifikasi</button>
    </form>
    <div id="verify-result"></div>
  </section>

  <!-- Urutan load penting: CryptoJS dulu, baru utils, stego, crypto, app -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/stego.js"></script>
  <script src="js/crypto.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

---

## 9. Error Handling & Custom Error Classes

| Error Class | Dilempar oleh | Ditangkap di | Pesan UI |
|---|---|---|---|
| `CapacityError` | `embedLSB()` | `app.js` (handleGenerateSubmit) | "Gambar terlalu kecil untuk menampung data. Gunakan gambar minimal {X}x{Y} px." |
| `DecryptionError` | `decryptCertificateData()` | `app.js` (handleVerifySubmit) | "Passphrase salah atau sertifikat telah dimodifikasi." |
| `Error` generik (gambar terlalu kecil saat extract) | `createBitReader().nextBit()` | `app.js` (handleVerifySubmit) | "Tidak ditemukan tanda tangan digital pada gambar ini." |

**Prinsip umum:** semua fungsi di `stego.js`/`crypto.js` melempar `Error`/subclass-nya, tidak pernah `alert()` atau manipulasi DOM langsung. Hanya `app.js` yang boleh sentuh DOM/UI.

---

## 10. Pertimbangan Keamanan Teknis

- Render data hasil ekstraksi ke DOM menggunakan `textContent`, **bukan** `innerHTML` — mencegah injection jika payload pernah dimanipulasi.
- Passphrase: input `type="password"`, tidak pernah di-`console.log`, tidak disimpan di `localStorage`/`sessionStorage`.
- `URL.createObjectURL()` harus di-`revokeObjectURL()` setelah tidak terpakai untuk mencegah memory leak.
- Tidak ada request network apapun setelah CryptoJS termuat — pastikan tidak ada `fetch`/`XMLHttpRequest` tersembunyi (selaras F8 di PRD: semua proses client-side).

---

## 11. Pertimbangan Performa

- Kompleksitas `embedLSB`/`extractLSB` adalah O(width × height) — untuk ukuran sertifikat tipikal (≤ 2000×1500 px) berjalan dalam hitungan puluhan milidetik, tidak perlu optimasi lebih jauh.
- Hindari memanggil `getImageData()`/`putImageData()` berulang kali dalam loop — cukup sekali di awal dan sekali di akhir proses embed.

---

## 12. Kompatibilitas Browser

Target: browser evergreen terbaru (Chrome, Firefox, Edge). Semua API yang dipakai (`Canvas`, `TextEncoder`/`TextDecoder`, `Blob`, `URL.createObjectURL`) didukung native, tidak perlu polyfill.

---

## 13. Strategi Pengujian

Tanpa build tool/test framework — gunakan halaman test manual sederhana.

**Buat `test.html`** yang me-load `utils.js`, `stego.js`, `crypto.js`, lalu jalankan assertion sederhana dan tampilkan hasil PASS/FAIL ke halaman:

```js
function assert(name, condition) {
  const result = condition ? '✅ PASS' : '❌ FAIL';
  document.body.innerHTML += `<div>${result} — ${name}</div>`;
}

// Contoh kasus uji wajib:
assert('uint32 round-trip (0)', bitsToUint32(uint32ToBits(0)) === 0);
assert('uint32 round-trip (max)', bitsToUint32(uint32ToBits(4294967295)) === 4294967295);
assert('bytes<->bits round-trip', /* bandingkan array byte asli vs hasil bitsToBytes(bytesToBits(asli)) */ true);

// Simulasi embed+extract pada ImageData sintetis 10x10:
const fakeImageData = { width: 10, height: 10, data: new Uint8ClampedArray(10*10*4).fill(200) };
const payload = utf8ToBytes("test123");
embedLSB(fakeImageData, payload);
const extracted = extractLSB(fakeImageData);
assert('embed+extract round-trip', bytesToUtf8(extracted) === "test123");

// Crypto round-trip:
const ct = encryptCertificateData({nama:"Budi"}, "rahasia123");
const dec = decryptCertificateData(ct, "rahasia123");
assert('crypto round-trip', dec.nama === "Budi");

// Wrong passphrase harus throw DecryptionError:
try {
  decryptCertificateData(ct, "salah");
  assert('wrong passphrase throws', false);
} catch (e) {
  assert('wrong passphrase throws', e instanceof DecryptionError);
}
```

**Cara jalankan:** buka `test.html` langsung di browser, lihat hasil PASS/FAIL di halaman.

---

## 14. Coding Conventions

- `camelCase` untuk function & variable, `PascalCase` untuk custom Error class
- JSDoc comment di setiap fungsi publik (lihat contoh §6)
- Tidak ada magic number tanpa konstanta bernama (`HEADER_BITS`, dst.)
- Bahasa pesan error/UI: **Bahasa Indonesia**. Nama variabel/fungsi: **Bahasa Inggris** (konvensi umum codebase)

---

## 15. Definition of Done (Checklist Implementasi)

- [ ] `utils.js` — 6 fungsi konversi, lolos test round-trip
- [ ] `stego.js` — `embedLSB`, `extractLSB`, `CapacityError`, lolos test embed+extract round-trip
- [ ] `crypto.js` — `encryptCertificateData`, `decryptCertificateData`, `DecryptionError`, lolos test round-trip + wrong-passphrase
- [ ] `app.js` — validasi form, load image, orkestrasi generate & verify, render UI
- [ ] `index.html` + `style.css` — 2 tab berfungsi, preview before/after, badge status verifikasi
- [ ] `test.html` — seluruh assertion di §13 PASS
- [ ] Manual test: generate → download PNG → upload ulang ke tab verify → data cocok (TC1 di PRD §13)
- [ ] Manual test: convert hasil ke JPG → upload ke verify → gagal terdeteksi dengan baik (TC4 di PRD §13)

---

*Dokumen ini melengkapi `PRD_VeriSert.md`. Gunakan keduanya bersamaan saat memberi instruksi ke AI Agent IDE.*
