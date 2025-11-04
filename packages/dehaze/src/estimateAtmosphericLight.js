/**
 * 估计大气光 (CPU版本，支持分别估计RGB通道)
 * @param {ImageData} imageData - 输入图像数据
 * @param {Uint8ClampedArray} darkChannel - 暗通道图像
 * @param {number} topRatio - 取前topRatio%的像素，默认为0.1
 * @param {string} channel - 指定通道，'r', 'g', 'b', 'luminance' 或 'all'，默认为'luminance'
 * @returns {number|Object} 估计的大气光值，channel为'all'时返回RGB对象
 */
export const estimateAtmosphericLight = (imageData, darkChannel, topRatio = 0.1, channel = 'luminance') => {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    const topCount = Math.floor(totalPixels * topRatio);
    
    // 创建索引数组并排序
    const indices = new Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      indices[i] = i;
    }
    
    // 按暗通道值降序排序
    indices.sort((a, b) => darkChannel[b] - darkChannel[a]);
    
    if (channel === 'all') {
      // 分别估计RGB通道的大气光
      let maxIntensityR = 0, maxIntensityG = 0, maxIntensityB = 0;
      
      // 在前topRatio%的像素中寻找最亮的像素
      for (let i = 0; i < topCount; i++) {
        const idx = indices[i];
        const pixelIdx = idx * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        
        if (r > maxIntensityR) maxIntensityR = r;
        if (g > maxIntensityG) maxIntensityG = g;
        if (b > maxIntensityB) maxIntensityB = b;
      }
      
      return {
        r: maxIntensityR / 255,
        g: maxIntensityG / 255,
        b: maxIntensityB / 255,
        luminance: (maxIntensityR * 0.299 + maxIntensityG * 0.587 + maxIntensityB * 0.114) / 255
      };
    } else {
      let maxIntensity = 0;
      
      // 在前topRatio%的像素中寻找最亮的像素
      for (let i = 0; i < topCount; i++) {
        const idx = indices[i];
        const pixelIdx = idx * 4;
        let intensity;
        
        switch (channel) {
          case 'r':
            intensity = data[pixelIdx];
            break;
          case 'g':
            intensity = data[pixelIdx + 1];
            break;
          case 'b':
            intensity = data[pixelIdx + 2];
            break;
          case 'luminance':
          default:
            // 使用人眼亮度权重
            intensity = data[pixelIdx] * 0.299 + data[pixelIdx + 1] * 0.587 + data[pixelIdx + 2] * 0.114;
            break;
        }
        
        if (intensity > maxIntensity) {
          maxIntensity = intensity;
        }
      }
      
      return maxIntensity / 255; // 归一化到0-1范围
    }
  };
  