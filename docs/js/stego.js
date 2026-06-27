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
  console.log('[STEGO] embedLSB called, payloadBytes.length =', payloadBytes.length);
  const capacityBits = calculateCapacityBits(imageData.width, imageData.height);
  const requiredBits = calculateRequiredBits(payloadBytes.length);
  console.log('[STEGO] capacityBits =', capacityBits, 'requiredBits =', requiredBits);
  if (requiredBits > capacityBits) {
    throw new CapacityError(`Butuh ${requiredBits} bit, tersedia ${capacityBits} bit.`);
  }
  const writer = createBitWriter(imageData.data);
  const headerBits = uint32ToBits(payloadBytes.length);
  console.log('[STEGO] headerBits:', headerBits.join(''));
  writer.writeBits(headerBits);
  const payloadBits = bytesToBits(payloadBytes);
  console.log('[STEGO] payloadBits length:', payloadBits.length);
  writer.writeBits(payloadBits);
  return imageData;
}

/**
 * @param {ImageData} imageData
 * @returns {Uint8Array} payloadBytes
 */
function extractLSB(imageData) {
  console.log('[STEGO] extractLSB called');
  const reader = createBitReader(imageData.data);
  const headerBits = reader.readBits(HEADER_BITS);
  console.log('[STEGO] headerBits:', headerBits.join(''));
  const payloadByteLength = bitsToUint32(headerBits);
  console.log('[STEGO] payloadByteLength:', payloadByteLength);
  const payloadBits = reader.readBits(payloadByteLength * 8);
  const payloadBytes = bitsToBytes(payloadBits);
  console.log('[STEGO] payloadBytes:', payloadBytes);
  return payloadBytes;
}
