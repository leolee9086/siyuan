/**
 * 雾强度检测模块
 * 基于暗通道统计特征和大气光值计算自适应去雾强度
 * @author 织
 */

/**
 * 计算暗通道统计特征
 * @param {Float32Array} darkChannelArray - 暗通道数据 (0-1范围)
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Object} 统计特征对象
 */
export const computeDarkChannelStats = (darkChannelArray, width, height) => {
  const totalPixels = width * height;
  
  // 计算基本统计量
  let sum = 0;
  let min = 1;
  let max = 0;
  let varianceSum = 0;
  
  for (let i = 0; i < totalPixels; i++) {
    const value = darkChannelArray[i];
    sum += value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  
  const mean = sum / totalPixels;
  
  // 计算方差
  for (let i = 0; i < totalPixels; i++) {
    const diff = darkChannelArray[i] - mean;
    varianceSum += diff * diff;
  }
  const variance = varianceSum / totalPixels;
  const stdDev = Math.sqrt(variance);
  
  // 计算分位数
  const sortedValues = new Float32Array(darkChannelArray);
  sortedValues.sort();
  const q25 = sortedValues[Math.floor(totalPixels * 0.25)];
  const q50 = sortedValues[Math.floor(totalPixels * 0.50)];
  const q75 = sortedValues[Math.floor(totalPixels * 0.75)];
  const q90 = sortedValues[Math.floor(totalPixels * 0.90)];
  
  // 计算雾浓度指标
  const hazeIntensity = (mean + q75) / 2; // 结合均值和75分位数
  const contrastRatio = (max - min) / (max + min + 1e-6); // 对比度比率
  const uniformityIndex = 1 - stdDev / (mean + 1e-6); // 均匀性指标
  
  return {
    mean,
    stdDev,
    min,
    max,
    q25,
    q50,
    q75,
    q90,
    variance,
    hazeIntensity,
    contrastRatio,
    uniformityIndex
  };
};

/**
 * 基于雾强度检测计算自适应omega和t0参数
 * @param {Object} darkStats - 暗通道统计特征
 * @param {number} atmosphericLight - 大气光值 (0-1)
 * @param {number} userOmega - 用户设置的omega值
 * @param {number} userT0 - 用户设置的t0值
 * @param {Object} options - 自适应参数选项
 * @param {number} options.omegaAdjustRange - omega调整范围，默认为0.2
 * @param {number} options.t0AdjustRange - t0调整范围，默认为0.05
 * @param {number} options.hazeWeight - 雾强度权重，默认为0.6
 * @param {number} options.atmosphericWeight - 大气光权重，默认为0.4
 * @param {number} options.adaptiveStrength - 自适应调整强度，默认为1.0
 * @returns {Object} 自适应参数结果
 */
export const computeAdaptiveParameters = (darkStats, atmosphericLight, userOmega, userT0, options = {}) => {
  const {
    omegaAdjustRange = 0.2,
    t0AdjustRange = 0.05,
    hazeWeight = 0.6,
    atmosphericWeight = 0.4,
    adaptiveStrength = 1.0
  } = options;
  
  // 基于雾强度调整omega
  // 雾越浓，omega应该越大（更强的去雾）
  const hazeFactor = Math.min(1.0, darkStats.hazeIntensity * 1.5);
  
  // 基于大气光调整omega
  // 大气光越高，雾越浓，需要更强的去雾
  const atmosphericFactor = Math.min(1.0, atmosphericLight * 1.2);
  
  // 基于对比度调整omega
  // 对比度越低，雾越浓
  const contrastFactor = Math.max(0.5, 1.0 - darkStats.contrastRatio);
  
  // 基于均匀性调整omega
  // 均匀性越高，雾越均匀，需要更强的去雾
  const uniformityFactor = Math.min(1.0, darkStats.uniformityIndex * 1.3);
  
  // 综合计算自适应因子
  const adaptiveFactor = 
    hazeWeight * hazeFactor +
    atmosphericWeight * atmosphericFactor +
    (1 - hazeWeight - atmosphericWeight) * (contrastFactor + uniformityFactor) / 2;
  
  // 基于雾强度分布进行相对调整
  // 使用雾强度作为基准，根据adaptiveStrength进行相对增强或减弱
  let adjustedAdaptiveFactor;
  if (adaptiveStrength < 1.0) {
    // 保守模式：基于雾强度相对减弱自适应效果
    // 雾强度越高，减弱效果越明显
    const reductionFactor = 1.0 - adaptiveStrength;
    adjustedAdaptiveFactor = adaptiveFactor * (1.0 - reductionFactor * adaptiveFactor);
  } else if (adaptiveStrength > 1.0) {
    // 激进模式：基于雾强度相对增强自适应效果
    // 雾强度越高，增强效果越明显
    const enhancementFactor = adaptiveStrength - 1.0;
    const relativeEnhancement = enhancementFactor * adaptiveFactor;
    adjustedAdaptiveFactor = Math.min(1.0, adaptiveFactor + relativeEnhancement);
  } else {
    // 标准模式：保持原始自适应因子
    adjustedAdaptiveFactor = adaptiveFactor;
  }
  
  // 基于用户设置的omega进行自适应调整
  const omegaAdjustment = omegaAdjustRange * adjustedAdaptiveFactor;
  const adaptiveOmega = userOmega + omegaAdjustment;
  const clampedOmega = Math.max(0.1, Math.min(0.99, adaptiveOmega));
  
  // 基于用户设置的t0进行自适应调整
  const t0Adjustment = t0AdjustRange * adjustedAdaptiveFactor;
  const adaptiveT0 = userT0 + t0Adjustment;
  const clampedT0 = Math.max(0.01, Math.min(0.3, adaptiveT0));
  
  // 计算雾强度等级 (0-1)
  const hazeLevel = Math.min(1.0, 
    (darkStats.hazeIntensity * 0.4 + 
     atmosphericLight * 0.4 + 
     (1 - darkStats.contrastRatio) * 0.2)
  );
  
  return {
    omega: clampedOmega,
    t0: clampedT0,
    adaptiveFactor,
    adjustedAdaptiveFactor,
    adaptiveStrength,
    hazeLevel,
    stats: {
      hazeIntensity: darkStats.hazeIntensity,
      atmosphericLight,
      contrastRatio: darkStats.contrastRatio,
      uniformityIndex: darkStats.uniformityIndex
    }
  };
};

/**
 * 检测图像雾强度并计算自适应参数
 * @param {Float32Array} darkChannelArray - 暗通道数据
 * @param {number} atmosphericLight - 大气光值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} userOmega - 用户设置的omega值
 * @param {number} userT0 - 用户设置的t0值
 * @param {Object} options - 自适应参数选项
 * @param {number} options.adaptiveStrength - 自适应调整强度
 * @returns {Object} 检测结果和自适应参数
 */
export const detectHazeAndAdapt = (darkChannelArray, atmosphericLight, width, height, userOmega, userT0, options = {}) => {
  // 计算暗通道统计特征
  const darkStats = computeDarkChannelStats(darkChannelArray, width, height);
  
  // 计算自适应omega和t0
  const adaptiveResult = computeAdaptiveParameters(darkStats, atmosphericLight, userOmega, userT0, options);
  
  // 生成雾强度描述
  const hazeDescription = generateHazeDescription(adaptiveResult.hazeLevel, darkStats);
  
  return {
    ...adaptiveResult,
    darkStats,
    description: hazeDescription
  };
};

/**
 * 生成雾强度描述
 * @param {number} hazeLevel - 雾强度等级 (0-1)
 * @param {Object} darkStats - 暗通道统计特征
 * @returns {string} 雾强度描述
 */
const generateHazeDescription = (hazeLevel, darkStats) => {
  let intensity = '';
  let characteristics = [];
  
  // 雾强度等级描述
  if (hazeLevel < 0.3) {
    intensity = '轻微雾霾';
  } else if (hazeLevel < 0.6) {
    intensity = '中等雾霾';
  } else if (hazeLevel < 0.8) {
    intensity = '重度雾霾';
  } else {
    intensity = '极重雾霾';
  }
  
  // 特征描述
  if (darkStats.contrastRatio < 0.3) {
    characteristics.push('对比度低');
  }
  if (darkStats.uniformityIndex > 0.7) {
    characteristics.push('雾分布均匀');
  }
  if (darkStats.hazeIntensity > 0.6) {
    characteristics.push('雾浓度高');
  }
  
  return `${intensity} (${Math.round(hazeLevel * 100)}%) - ${characteristics.join(', ')}`;
}; 