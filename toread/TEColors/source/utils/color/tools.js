import chroma from '../../../static/chroma-js.js'
function hexToBrightness(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114); // 标准的亮度计算公式
  }
  // 计算两个颜色之间的欧几里得距离
  function colorDistance(color1, color2) {
    return Math.sqrt(
      Math.pow(color1.RGB[0] - color2.RGB[0], 2) +
      Math.pow(color1.RGB[1] - color2.RGB[1], 2) +
      Math.pow(color1.RGB[2] - color2.RGB[2], 2)
    );
  }
