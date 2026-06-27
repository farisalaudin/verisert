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
