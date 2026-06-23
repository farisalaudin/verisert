// utils.js — VeriSert
// Fungsi utilitas konversi bit/byte, dipakai oleh stego.js dan crypto.js

/**
 * Mengubah Uint8Array menjadi array bit (0/1), MSB-first per byte.
 * Contoh: bytesToBits(Uint8Array([1])) → [0,0,0,0,0,0,0,1]
 * @param {Uint8Array} bytes
 * @returns {number[]} array bit (0 atau 1)
 */
function bytesToBits(bytes) {
  const bits = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  return bits;
}

/**
 * Mengubah array bit (0/1) menjadi Uint8Array, MSB-first per byte.
 * bits.length harus kelipatan 8; sisa bit yang tidak genap 8 akan diabaikan.
 * @param {number[]} bits - array bit (0 atau 1)
 * @returns {Uint8Array}
 */
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

/**
 * Mengubah bilangan bulat 32-bit (unsigned) menjadi array 32 bit, MSB-first.
 * Menggunakan unsigned right shift (>>>) agar angka besar (>= 2^31) ditangani benar.
 * @param {number} num - bilangan bulat 0 s.d. 4294967295
 * @returns {number[]} array 32 bit (0 atau 1)
 */
function uint32ToBits(num) {
  const bits = [];
  for (let b = 31; b >= 0; b--) bits.push((num >>> b) & 1);
  return bits;
}

/**
 * Mengubah array 32 bit (MSB-first) menjadi bilangan bulat 32-bit unsigned.
 * Menggunakan >>> 0 di akhir agar hasilnya selalu non-negatif (unsigned).
 * @param {number[]} bits - array tepat 32 elemen (0 atau 1)
 * @returns {number} bilangan bulat 0 s.d. 4294967295
 */
function bitsToUint32(bits) {
  let value = 0;
  for (let i = 0; i < 32; i++) value = (value << 1) | bits[i];
  return value >>> 0;
}

/**
 * Mengubah string menjadi Uint8Array menggunakan encoding UTF-8.
 * Mendukung karakter ASCII maupun Unicode (termasuk huruf non-Latin).
 * @param {string} str
 * @returns {Uint8Array}
 */
function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

/**
 * Mengubah Uint8Array menjadi string dengan decoding UTF-8.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}
