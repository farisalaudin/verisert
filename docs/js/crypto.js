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
