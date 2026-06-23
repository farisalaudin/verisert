// stego.js — VeriSert
// Fungsi LSB steganography: embedLSB, extractLSB, CapacityError
// WAJIB mengikuti reference implementation TDD §6.2 — jangan ubah algoritma.

// Jumlah bit untuk header yang menyimpan panjang payload (uint32 = 32 bit)
const HEADER_BITS = 32;

/**
 * Error yang dilempar jika kapasitas gambar tidak cukup untuk menampung payload.
 */
class CapacityError extends Error {}

/**
 * Menghitung total kapasitas bit yang tersedia pada gambar.
 * Setiap pixel menyumbang 3 bit (channel R, G, B — Alpha dilewati).
 * @param {number} width  - lebar gambar dalam pixel
 * @param {number} height - tinggi gambar dalam pixel
 * @returns {number} total bit yang bisa dipakai
 */
function calculateCapacityBits(width, height) {
  return width * height * 3;
}

/**
 * Menghitung jumlah bit yang dibutuhkan untuk menyisipkan payload.
 * Terdiri dari 32-bit header (panjang payload) + payload itu sendiri.
 * @param {number} payloadByteLength - panjang payload dalam byte
 * @returns {number} total bit yang dibutuhkan
 */
function calculateRequiredBits(payloadByteLength) {
  return HEADER_BITS + payloadByteLength * 8;
}

/**
 * Stateful bit writer: menulis 1 bit per pixel-channel (R,G,B), skip Alpha.
 * Urutan iterasi: R → G → B per pixel, lalu lanjut ke pixel berikutnya.
 * Index Alpha (setiap posisi ke-4 dalam array pixels) TIDAK PERNAH disentuh.
 *
 * ⚠️ Urutan iterasi createBitWriter HARUS identik dengan createBitReader.
 *    Jika salah satu diubah, round-trip encode/decode akan menghasilkan data sampah
 *    tanpa melempar error (silent corruption).
 *
 * @param {Uint8ClampedArray} pixels - data pixel dari ImageData.data (RGBA flat array)
 * @returns {{ writeBits: function(number[]): void }}
 * @throws {CapacityError} jika mencoba menulis melebihi kapasitas gambar
 */
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

/**
 * Stateful bit reader: cermin dari createBitWriter, urutan baca HARUS identik.
 * Urutan iterasi: R → G → B per pixel, lalu lanjut ke pixel berikutnya.
 * Index Alpha (setiap posisi ke-4 dalam array pixels) TIDAK PERNAH dibaca.
 *
 * ⚠️ Urutan iterasi createBitReader HARUS identik dengan createBitWriter.
 *    Jika salah satu diubah tanpa mengubah pasangannya, hasil ekstraksi akan
 *    menjadi data sampah tanpa ada error (silent corruption).
 *
 * @param {Uint8ClampedArray} pixels - data pixel dari ImageData.data (RGBA flat array)
 * @returns {{ readBits: function(number): number[] }}
 * @throws {Error} jika mencoba membaca melebihi panjang data yang tersedia
 */
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
 * Menyisipkan payloadBytes ke dalam imageData menggunakan metode LSB.
 * Format bit yang ditulis: [32-bit header = panjang payload] + [bit-bit payload]
 * ImageData dimutasi langsung (in-place) dan dikembalikan.
 *
 * Bergantung pada fungsi dari utils.js: uint32ToBits, bytesToBits
 *
 * @param {ImageData} imageData - objek ImageData dari Canvas API, dimutasi langsung
 * @param {Uint8Array} payloadBytes - data yang akan disisipkan
 * @returns {ImageData} imageData yang sudah dimodifikasi
 * @throws {CapacityError} jika kapasitas gambar tidak cukup
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
 * Mengekstrak payloadBytes dari imageData yang disisipkan menggunakan metode LSB.
 * Membaca 32-bit header terlebih dahulu untuk mengetahui panjang payload.
 *
 * @param {ImageData} imageData - objek ImageData dari Canvas API
 * @returns {Uint8Array} payloadBytes yang berhasil diekstrak
 * @throws {Error} jika pembacaan gagal (misal gambar terlalu kecil)
 */
function extractLSB(imageData) {
  const reader = createBitReader(imageData.data);
  const headerBits = reader.readBits(HEADER_BITS);
  const payloadByteLength = bitsToUint32(headerBits);
  const payloadBits = reader.readBits(payloadByteLength * 8);
  return bitsToBytes(payloadBits);
}
