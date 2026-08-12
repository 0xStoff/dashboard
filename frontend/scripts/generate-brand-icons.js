const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const publicDirectory = path.resolve(__dirname, "../public");

const mix = (from, to, amount) => Math.round(from + (to - from) * amount);
const insideRoundedRect = (x, y, size, radius) => {
  const nearestX = Math.max(radius, Math.min(size - radius, x));
  const nearestY = Math.max(radius, Math.min(size - radius, y));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
};
const insideCapsule = (x, y, left, top, right, bottom) => {
  const radius = Math.min((right - left) / 2, (bottom - top) / 2);
  const nearestX = Math.max(left + radius, Math.min(right - radius, x));
  const nearestY = Math.max(top + radius, Math.min(bottom - radius, y));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
};

const render = (size) => {
  const scale = 4;
  const canvasSize = size * scale;
  const samples = new Uint8Array(canvasSize * canvasSize * 4);
  const radius = canvasSize * 0.28;
  const violet = [139, 124, 255];
  const mint = [93, 228, 199];

  for (let y = 0; y < canvasSize; y += 1) {
    for (let x = 0; x < canvasSize; x += 1) {
      const offset = (y * canvasSize + x) * 4;
      if (!insideRoundedRect(x + 0.5, y + 0.5, canvasSize, radius)) continue;
      const gradient = Math.max(0, Math.min(1, (x + y) / (canvasSize * 2)));
      samples[offset] = mix(violet[0], mint[0], gradient);
      samples[offset + 1] = mix(violet[1], mint[1], gradient);
      samples[offset + 2] = mix(violet[2], mint[2], gradient);
      samples[offset + 3] = 255;

      const bar = insideCapsule(x, y, canvasSize * 0.25, canvasSize * 0.29, canvasSize * 0.75, canvasSize * 0.41);
      const leftStem = insideCapsule(x, y, canvasSize * 0.31, canvasSize * 0.35, canvasSize * 0.44, canvasSize * 0.73);
      const rightStem = insideCapsule(x, y, canvasSize * 0.57, canvasSize * 0.35, canvasSize * 0.70, canvasSize * 0.73);
      if (bar || leftStem || rightStem) {
        samples[offset] = 9;
        samples[offset + 1] = 11;
        samples[offset + 2] = 18;
      }
    }
  }

  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        for (let sampleY = 0; sampleY < scale; sampleY += 1) {
          for (let sampleX = 0; sampleX < scale; sampleX += 1) {
            sum += samples[(((y * scale + sampleY) * canvasSize + x * scale + sampleX) * 4) + channel];
          }
        }
        png.data[target + channel] = Math.round(sum / (scale * scale));
      }
    }
  }
  return PNG.sync.write(png);
};

for (const [filename, size] of [["favicon.png", 64], ["logo192.png", 192], ["logo512.png", 512]]) {
  fs.writeFileSync(path.join(publicDirectory, filename), render(size));
}
