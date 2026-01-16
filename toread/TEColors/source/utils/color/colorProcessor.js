// 计算两个颜色之间的余弦相似度
export function cosineSimilarity(color1, color2) {
  const rgb1 = normalizeRGB(color1.RGB);
  const rgb2 = normalizeRGB(color2.RGB);
  const dotProduct = rgb1[0] * rgb2[0] + rgb1[1] * rgb2[1] + rgb1[2] * rgb2[2];
  const magnitude1 = Math.sqrt(rgb1[0] ** 2 + rgb1[1] ** 2 + rgb1[2] ** 2);
  const magnitude2 = Math.sqrt(rgb2[0] ** 2 + rgb2[1] ** 2 + rgb2[2] ** 2);
  return dotProduct / (magnitude1 * magnitude2);
}
// 归一化 RGB 值
function normalizeRGB(rgb) {
  return rgb.map(value => value / 255);
}
export function getLuminance(color) {
  // Assuming color is an array [r, g, b]
  const [r, g, b] = color;
  // Standard formula for luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function getHue(color) {
  // Assuming color is an array [r, g, b]
  const [r, g, b] = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;

  if (max === min) {
      hue = 0; // achromatic
  } else {
      const delta = max - min;
      switch (max) {
          case r:
              hue = (g - b) / delta + (g < b ? 6 : 0);
              break;
          case g:
              hue = (b - r) / delta + 2;
              break;
          case b:
              hue = (r - g) / delta + 4;
              break;
      }
      hue *= 60; // converting to degrees
  }

  return hue;
}