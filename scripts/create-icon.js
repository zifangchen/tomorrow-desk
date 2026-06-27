const fs = require("node:fs");
const path = require("node:path");

const LOGICAL_SIZE = 64;
const SIZE = 256;
const SCALE = SIZE / LOGICAL_SIZE;
const BLACK = [8, 8, 6, 255];
const PANEL = [17, 16, 12, 255];
const GOLD = [216, 180, 93, 255];
const GOLD_SOFT = [240, 216, 145, 255];

function setPixel(pixels, x, y, rgba) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return;
  }
  const offset = (y * SIZE + x) * 4;
  pixels[offset] = rgba[0];
  pixels[offset + 1] = rgba[1];
  pixels[offset + 2] = rgba[2];
  pixels[offset + 3] = rgba[3];
}

function fillRect(pixels, x, y, width, height, rgba) {
  const scaledX = Math.round(x * SCALE);
  const scaledY = Math.round(y * SCALE);
  const scaledWidth = Math.round(width * SCALE);
  const scaledHeight = Math.round(height * SCALE);

  for (let yy = scaledY; yy < scaledY + scaledHeight; yy += 1) {
    for (let xx = scaledX; xx < scaledX + scaledWidth; xx += 1) {
      setPixel(pixels, xx, yy, rgba);
    }
  }
}

function strokeRect(pixels, x, y, width, height, rgba) {
  fillRect(pixels, x, y, width, 2, rgba);
  fillRect(pixels, x, y + height - 2, width, 2, rgba);
  fillRect(pixels, x, y, 2, height, rgba);
  fillRect(pixels, x + width - 2, y, 2, height, rgba);
}

function drawIconPixels() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);

  fillRect(pixels, 0, 0, SIZE, SIZE, BLACK);
  fillRect(pixels, 5, 5, 54, 54, PANEL);
  strokeRect(pixels, 5, 5, 54, 54, GOLD);
  strokeRect(pixels, 9, 9, 46, 46, [216, 180, 93, 96]);

  fillRect(pixels, 16, 19, 17, 5, GOLD_SOFT);
  fillRect(pixels, 22, 19, 5, 26, GOLD_SOFT);

  fillRect(pixels, 35, 19, 5, 26, GOLD);
  fillRect(pixels, 35, 19, 12, 5, GOLD);
  fillRect(pixels, 35, 40, 12, 5, GOLD);
  fillRect(pixels, 47, 24, 5, 16, GOLD);
  fillRect(pixels, 44, 21, 5, 5, GOLD);
  fillRect(pixels, 44, 38, 5, 5, GOLD);

  return pixels;
}

function createIconBuffer() {
  const pixels = drawIconPixels();
  const xorBitmap = Buffer.alloc(SIZE * SIZE * 4);
  const andMask = Buffer.alloc(SIZE * SIZE * 4);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const source = (y * SIZE + x) * 4;
      const target = ((SIZE - 1 - y) * SIZE + x) * 4;
      xorBitmap[target] = pixels[source + 2];
      xorBitmap[target + 1] = pixels[source + 1];
      xorBitmap[target + 2] = pixels[source];
      xorBitmap[target + 3] = pixels[source + 3];
    }
  }

  const dibSize = 40 + xorBitmap.length + andMask.length;
  const icon = Buffer.alloc(6 + 16 + dibSize);

  icon.writeUInt16LE(0, 0);
  icon.writeUInt16LE(1, 2);
  icon.writeUInt16LE(1, 4);
  icon.writeUInt8(0, 6);
  icon.writeUInt8(0, 7);
  icon.writeUInt8(0, 8);
  icon.writeUInt8(0, 9);
  icon.writeUInt16LE(1, 10);
  icon.writeUInt16LE(32, 12);
  icon.writeUInt32LE(dibSize, 14);
  icon.writeUInt32LE(22, 18);

  const dibOffset = 22;
  icon.writeUInt32LE(40, dibOffset);
  icon.writeInt32LE(SIZE, dibOffset + 4);
  icon.writeInt32LE(SIZE * 2, dibOffset + 8);
  icon.writeUInt16LE(1, dibOffset + 12);
  icon.writeUInt16LE(32, dibOffset + 14);
  icon.writeUInt32LE(0, dibOffset + 16);
  icon.writeUInt32LE(xorBitmap.length + andMask.length, dibOffset + 20);
  icon.writeInt32LE(0, dibOffset + 24);
  icon.writeInt32LE(0, dibOffset + 28);
  icon.writeUInt32LE(0, dibOffset + 32);
  icon.writeUInt32LE(0, dibOffset + 36);

  xorBitmap.copy(icon, dibOffset + 40);
  andMask.copy(icon, dibOffset + 40 + xorBitmap.length);

  return icon;
}

function writeIcon() {
  const iconPath = path.join(__dirname, "..", "build", "icon.ico");
  fs.mkdirSync(path.dirname(iconPath), { recursive: true });
  fs.writeFileSync(iconPath, createIconBuffer());
  return iconPath;
}

if (require.main === module) {
  const iconPath = writeIcon();
  console.log(`Generated ${iconPath}`);
}

module.exports = { createIconBuffer, writeIcon };
