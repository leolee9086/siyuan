/**
 * 处理参数管理组合式函数
 * @织: 去雾处理参数相关的响应式逻辑
 */

import { reactive } from 'vue'

/**
 * 处理参数状态管理
 */
export const useProcessingParams = () => {
  const params = reactive({
    windowSize: 15, // 暗通道窗口大小
    topRatio: 0.1, // 大气光估计比例
    omega: 0.95,
    t0: 0.1,
    adaptiveMode: false, // 自适应模式
    spatialAdaptiveMode: false, // 空间自适应模式
    adaptiveStrength: 1.0, // 自适应调整强度 (0.5-2.0)
    adaptiveOptions: {
      omegaAdjustRange: 0.2,
      t0AdjustRange: 0.05,
      hazeWeight: 0.6,
      atmosphericWeight: 0.4
    },
    enhancementOptions: {
      enableEnhancement: false,
      saturationEnhancement: 1.0,
      contrastEnhancement: 1.0,
      brightnessEnhancement: 1.0  // 明度增强因子 (0.5-2.0)
    }
  })

  /**
   * 获取自适应强度描述
   * @returns {string} 描述文本
   */
  const getAdaptiveStrengthDescription = () => {
    const strength = params.adaptiveStrength
    if (strength < 0.8) return '保守调整 - 轻微自适应'
    if (strength < 1.2) return '标准调整 - 平衡自适应'
    if (strength < 1.6) return '激进调整 - 强烈自适应'
    return '极强调整 - 最大自适应'
  }

  /**
   * 获取饱和度描述
   * @returns {string} 描述文本
   */
  const getSaturationDescription = () => {
    const saturation = params.enhancementOptions.saturationEnhancement
    if (saturation < 1.0) return '降低饱和度'
    if (saturation > 1.0) return '增强饱和度'
    return '保持原始饱和度'
  }

  /**
   * 获取对比度描述
   * @returns {string} 描述文本
   */
  const getContrastDescription = () => {
    const contrast = params.enhancementOptions.contrastEnhancement
    if (contrast < 1.0) return '降低对比度'
    if (contrast > 1.0) return '增强对比度'
    return '保持原始对比度'
  }

  /**
   * 获取明度描述
   * @returns {string} 描述文本
   */
  const getBrightnessDescription = () => {
    const brightness = params.enhancementOptions.brightnessEnhancement
    if (brightness < 1.0) return '降低明度'
    if (brightness > 1.0) return '增强明度'
    return '保持原始明度'
  }

  /**
   * 获取色彩平衡描述
   * @param {Object} atmosphericLight - 大气光对象
   * @returns {string} 描述文本
   */
  const getColorBalanceDescription = (atmosphericLight) => {
    const { r, g, b } = atmosphericLight
    const maxChannel = Math.max(r, g, b)
    const minChannel = Math.min(r, g, b)
    const range = maxChannel - minChannel
    
    if (range < 0.1) return '平衡 - 各通道差异小'
    if (b > r && b > g) return '偏蓝 - 蓝色通道较强'
    if (r > g && r > b) return '偏红 - 红色通道较强'
    if (g > r && g > b) return '偏绿 - 绿色通道较强'
    return '混合 - 多通道平衡'
  }

  return {
    params,
    getAdaptiveStrengthDescription,
    getSaturationDescription,
    getContrastDescription,
    getBrightnessDescription,
    getColorBalanceDescription
  }
} 