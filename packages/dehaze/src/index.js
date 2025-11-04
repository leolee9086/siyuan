/**
 * WebGPU图像去雾算法主入口文件
 * 提供统一的API接口
 * @author 织
 */

// 导出核心算法
export { dehazeImageWebGPUSimple, batchDehazeWebGPUSimple } from './core/dehazing-webgpu.js';
export { dehazeImage as dehazeImageCPU } from './core/dehazing-cpu.js';
export { dehaze as dehazeImageLegacy } from './core/legacy.js';

// 导出GPU相关功能
export { 
  getCachedDevice, 
  isDeviceInitialized, 
  preInitializeDevice,
  clearDeviceCache 
} from './gpu/device.js';

export { 
  clearAllCaches,
  clearImageCaches,
  getOrCreatePipeline,
  getOrCreateUniformBuffer,
  getOrCreateOutputBuffer,
  getOrCreateBindGroup,
  getOrCreateTexture,
  createFullCacheKey,
  generateImageHash
} from './gpu/cache.js';

// 导出工具函数
export { 
  imageDataToTexture, 
  textureToImageData, 
  bufferToImageData,
  clearTextureCache 
} from './utils/image-utils.js';

export { 
  detectHazeAndAdapt,
  computeDarkChannelStats,
  computeAdaptiveParameters 
} from './utils/haze-detection.js';

// 导出核心计算函数
export { 
  estimateTransmissionGPU,
  estimateSpatialAdaptiveTransmissionGPU 
} from './dehazing-core.js';

// 导出GPU计算模块
export { 
  computeDarkChannelGPU,
  precompileDarkChannelShader,
  clearDarkChannelCache,
  getDarkChannelCacheStats,
  isDarkChannelCached,
  clearPrecompiledShader 
} from './gpu/dark-channel.js';

export { 
  estimateAtmosphericLightDownsampled 
} from './gpu/atmospheric-light.js';

export { 
  recoverImageGPU,
  clearCaches as clearRecoverImageCaches 
} from './gpu/recover-image.js';

// 导出工具函数
export { 
  createTexture, 
  createBuffer 
} from './gpu/utils.js'; 