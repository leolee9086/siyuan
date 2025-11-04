/**
 * 图像去雾算法实现
 * 基于暗通道先验(Dark Channel Prior)的高性能去雾算法
 * @author 织
 */

/**
 * 计算图像的暗通道
 * @param {ImageData} imageData - 输入图像数据
 * @param {number} windowSize - 窗口大小，默认为15
 * @returns {Uint8ClampedArray} 暗通道图像
 */
export const computeDarkChannel = (imageData, windowSize = 15) => {
  const { data, width, height } = imageData;
  const darkChannel = new Uint8ClampedArray(width * height);
  const halfWindow = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minValue = 255;
      
      // 在窗口内寻找最小值
      for (let wy = Math.max(0, y - halfWindow); wy <= Math.min(height - 1, y + halfWindow); wy++) {
        for (let wx = Math.max(0, x - halfWindow); wx <= Math.min(width - 1, x + halfWindow); wx++) {
          const idx = (wy * width + wx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const min = Math.min(r, g, b);
          minValue = Math.min(minValue, min);
        }
      }
      
      darkChannel[y * width + x] = minValue;
    }
  }
  
  return darkChannel;
};

/**
 * 估计大气光值
 * @param {ImageData} imageData - 输入图像数据
 * @param {Uint8ClampedArray} darkChannel - 暗通道图像
 * @param {number} topRatio - 取前topRatio%的像素，默认为0.1
 * @returns {number} 估计的大气光值
 */
export const estimateAtmosphericLight = (imageData, darkChannel, topRatio = 0.1) => {
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
  
  let maxIntensity = 0;
  let maxIndex = 0;
  
  // 在前topRatio%的像素中寻找最亮的像素
  for (let i = 0; i < topCount; i++) {
    const idx = indices[i];
    const pixelIdx = idx * 4;
    const intensity = Math.max(data[pixelIdx], data[pixelIdx + 1], data[pixelIdx + 2]);
    
    if (intensity > maxIntensity) {
      maxIntensity = intensity;
      maxIndex = idx;
    }
  }
  
  return maxIntensity;
};

/**
 * 估计透射率图
 * @param {Uint8ClampedArray} darkChannel - 暗通道图像
 * @param {number} atmosphericLight - 大气光值
 * @param {number} omega - 去雾强度参数，默认为0.95
 * @returns {Float32Array} 透射率图
 */
export const estimateTransmission = (darkChannel, atmosphericLight, omega = 0.95) => {
  const transmission = new Float32Array(darkChannel.length);
  
  for (let i = 0; i < darkChannel.length; i++) {
    transmission[i] = 1 - omega * (darkChannel[i] / atmosphericLight);
  }
  
  return transmission;
};

/**
 * 引导滤波优化透射率图
 * @param {Float32Array} transmission - 初始透射率图
 * @param {ImageData} guideImage - 引导图像
 * @param {number} radius - 滤波半径，默认为60
 * @param {number} epsilon - 正则化参数，默认为0.0001
 * @returns {Float32Array} 优化后的透射率图
 */
export const guidedFilter = (transmission, guideImage, radius = 60, epsilon = 0.0001) => {
  const { width, height, data } = guideImage;
  const refined = new Float32Array(transmission.length);
  
  // 创建灰度引导图
  const grayGuide = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    grayGuide[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
  }
  
  // 计算均值
  const meanGuide = computeMeanImage(grayGuide, radius, width, height);
  const meanTransmission = computeMeanImage(transmission, radius, width, height);
  const meanGuideTransmission = computeMeanImage(transmission.map((t, i) => t * grayGuide[i]), radius, width, height);
  const meanGuideSquared = computeMeanImage(grayGuide.map(v => v * v), radius, width, height);
  
  // 计算方差和协方差
  const varGuide = meanGuideSquared.map((mean, i) => mean - meanGuide[i] * meanGuide[i]);
  const covGuideTransmission = meanGuideTransmission.map((mean, i) => mean - meanGuide[i] * meanTransmission[i]);
  
  // 计算A和B参数
  const A = covGuideTransmission.map((cov, i) => cov / (varGuide[i] + epsilon));
  const B = meanTransmission.map((mean, i) => mean - A[i] * meanGuide[i]);
  
  // 计算最终结果
  const meanA = computeMeanImage(A, radius, width, height);
  const meanB = computeMeanImage(B, radius, width, height);
  
  for (let i = 0; i < transmission.length; i++) {
    refined[i] = meanA[i] * grayGuide[i] + meanB[i];
  }
  
  return refined;
};

/**
 * 计算图像的均值图
 * @param {ImageData|Float32Array|Uint8ClampedArray} image - 输入图像或数组
 * @param {number} radius - 滤波半径
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {boolean} isSquared - 是否计算平方值
 * @returns {Float32Array} 均值图
 */
const computeMeanImage = (image, radius, width, height, isSquared = false) => {
  const isImageData = image instanceof ImageData;
  const w = isImageData ? image.width : width;
  const h = isImageData ? image.height : height;
  const data = isImageData ? image.data : image;
  
  const mean = new Float32Array(w * h);
  const count = new Float32Array(w * h);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const centerIdx = y * w + x;
      let sum = 0;
      let pixelCount = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const idx = ny * w + nx;
            let value;
            
            if (isImageData) {
              value = data[idx * 4] / 255; // 使用红色通道作为引导
            } else {
              value = data[idx];
            }
            
            if (isSquared) {
              value = value * value;
            }
            
            sum += value;
            pixelCount++;
          }
        }
      }
      
      mean[centerIdx] = sum;
      count[centerIdx] = pixelCount;
    }
  }
  
  // 归一化
  for (let i = 0; i < mean.length; i++) {
    mean[i] /= count[i];
  }
  
  return mean;
};

/**
 * 恢复无雾图像
 * @param {ImageData} imageData - 输入图像数据
 * @param {Float32Array} transmission - 透射率图
 * @param {number} atmosphericLight - 大气光值
 * @param {number} t0 - 最小透射率阈值，默认为0.1
 * @returns {ImageData} 去雾后的图像数据
 */
export const recoverImage = (imageData, transmission, atmosphericLight, t0 = 0.1) => {
  const { data, width, height } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIdx = i / 4;
    const t = Math.max(transmission[pixelIdx], t0);
    
    for (let c = 0; c < 3; c++) {
      resultData[i + c] = Math.max(0, Math.min(255, 
        (data[i + c] - atmosphericLight) / t + atmosphericLight
      ));
    }
    resultData[i + 3] = data[i + 3]; // 保持alpha通道
  }
  
  return result;
};

/**
 * 主去雾函数
 * @param {ImageData} imageData - 输入图像数据
 * @param {Object} options - 算法参数
 * @param {number} options.windowSize - 暗通道窗口大小，默认为15
 * @param {number} options.topRatio - 大气光估计比例，默认为0.1
 * @param {number} options.omega - 去雾强度，默认为0.95
 * @param {number} options.guideRadius - 引导滤波半径，默认为60
 * @param {number} options.guideEpsilon - 引导滤波正则化参数，默认为0.0001
 * @param {number} options.t0 - 最小透射率阈值，默认为0.1
 * @returns {ImageData} 去雾后的图像数据
 */
export const dehazeImage = (imageData, options = {}) => {
  const {
    windowSize = 15,
    topRatio = 0.1,
    omega = 0.95,
    guideRadius = 60,
    guideEpsilon = 0.0001,
    t0 = 0.1
  } = options;
  
  // 步骤1: 计算暗通道
  const darkChannel = computeDarkChannel(imageData, windowSize);
  
  // 步骤2: 估计大气光
  const atmosphericLight = estimateAtmosphericLight(imageData, darkChannel, topRatio);
  
  // 步骤3: 估计透射率图
  const transmission = estimateTransmission(darkChannel, atmosphericLight, omega);
  
  // 步骤4: 引导滤波优化透射率图
  const refinedTransmission = guidedFilter(transmission, imageData, guideRadius, guideEpsilon);
  
  // 步骤5: 恢复无雾图像
  const result = recoverImage(imageData, refinedTransmission, atmosphericLight, t0);
  
  return result;
};

/**
 * 批量处理多张图像
 * @param {ImageData[]} imageDataArray - 图像数据数组
 * @param {Object} options - 算法参数
 * @returns {ImageData[]} 去雾后的图像数据数组
 */
export const batchDehaze = (imageDataArray, options = {}) => {
  return imageDataArray.map(imageData => dehazeImage(imageData, options));
}; 