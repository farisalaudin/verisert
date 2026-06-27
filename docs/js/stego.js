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
