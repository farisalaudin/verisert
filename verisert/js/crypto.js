// crypto.js — VeriSert
// Fungsi AES enkripsi/dekripsi: encryptCertificateData, decryptCertificateData, DecryptionError

/**
 * Error khusus yang dilempar ketika proses dekripsi sertifikat gagal
 * (misal karena passphrase salah atau data hasil modifikasi/corrupted).
 */
class DecryptionError extends Error {}

/**
 * Mengenkripsi objek data sertifikat menggunakan AES.
 * @param {Object} dataObj - Objek data sertifikat
 * @param {string} passphrase - Kata sandi untuk enkripsi
 * @returns {string} ciphertext dalam format base64
 */
function encryptCertificateData(dataObj, passphrase) {
  const plaintext = JSON.stringify(dataObj);
  
  // Catatan: CryptoJS.AES secara otomatis akan meng-generate random salt 
  // untuk setiap operasi enkripsi. Oleh karena itu, mengenkripsi objek 
  // yang sama 2x dengan passphrase yang sama akan selalu menghasilkan 
  // ciphertext yang berbeda (ini adalah expected behavior, bukan bug).
  return CryptoJS.AES.encrypt(plaintext, passphrase).toString();
}

/**
 * Mendekripsi ciphertext (hasil encryptCertificateData) kembali ke objek asli.
 * @param {string} ciphertext - String base64 hasil enkripsi
 * @param {string} passphrase - Kata sandi yang sama saat enkripsi
 * @returns {Object} objek data sertifikat asli
 * @throws {DecryptionError} jika passphrase salah atau ciphertext tidak valid
 */
function decryptCertificateData(ciphertext, passphrase) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
    // toString('') akan menghasilkan string kosong jika passphrase salah
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    if (!plaintext) {
      throw new DecryptionError('Gagal mendekripsi: passphrase salah atau data korup');
    }
    return JSON.parse(plaintext);
  } catch (e) {
    // Jika sudah DecryptionError, lempar ulang tanpa wrapping
    if (e instanceof DecryptionError) throw e;
    // Error lain (JSON.parse gagal, format tidak valid, dll) → bungkus jadi DecryptionError
    throw new DecryptionError('Data tidak valid atau bukan ciphertext yang benar: ' + e.message);
  }
}
