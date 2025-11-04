/**
 * 简化版WebGPU图像去雾算法实现
 * 基于暗通道先验(Dark Channel Prior)的高性能去雾算法
 * 使用WebGPU进行GPU加速计算
 * @author 织
 */

// 导入所有模块
import { getCachedDevice, isDeviceInitialized, preInitializeDevice } from '../gpu/device.js';
import { imageDataToTexture, bufferToImageData } from '../utils/image-utils.js';
import { estimateAtmosphericLightDownsampled } from '../gpu/atmospheric-light.js';
import { 
  estimateTransmissionGPU, 
  estimateSpatialAdaptiveTransmissionGPU
} from '../dehazing-core.js';
import { recoverImageGPU, clearCaches as clearRecoverImageCaches } from '../gpu/recover-image.js';
import { computeDarkChannelGPU, precompileDarkChannelShader } from '../gpu/dark-channel.js';
import { detectHazeAndAdapt } from '../utils/haze-detection.js';

/**
 * 简化版WebGPU主去雾函数
 * @param {ImageData} imageData - 输入图像数据
 * @param {Object} options - 算法参数
 * @param {number} options.windowSize - 暗通道窗口大小，默认为15
 * @param {number} options.topRatio - 大气光估计比例，默认为0.1
 * @param {number} options.omega - 去雾强度，默认为0.95
 * @param {number} options.t0 - 最小透射率阈值，默认为0.1
 * @param {boolean} options.adaptiveMode - 是否启用自适应模式，默认为false
 * @param {boolean} options.spatialAdaptiveMode - 是否启用空间自适应模式，默认为false
 * @param {number} options.adaptiveStrength - 自适应调整强度，默认为1.0
 * @param {Object} options.adaptiveOptions - 自适应参数选项
 * @param {Object} options.enhancementOptions - 增强选项
 * @param {boolean} options.enhancementOptions.enableEnhancement - 是否启用饱和度和对比度增强，默认为false
 * @param {number} options.enhancementOptions.saturationEnhancement - 饱和度增强因子 (0.0-2.0)，默认为1.2
 * @param {number} options.enhancementOptions.contrastEnhancement - 对比度增强因子 (0.5-2.0)，默认为1.1
 * @returns {Promise<Object>} 去雾结果，包含图像数据和自适应信息
 */
export const dehazeImageWebGPUSimple = async (imageData, options = {}) => {
  console.time('总耗时');
  
  const {
    windowSize = 15,
    topRatio = 0.1,
    omega = 0.95,
    t0 = 0.1,
    adaptiveMode = false,
    spatialAdaptiveMode = false,
    adaptiveStrength = 1.0,
    adaptiveOptions = {},
    enhancementOptions = {}
  } = options;
  
  // 验证输入数据
  if (!imageData || !imageData.data || imageData.data.length === 0) {
    throw new Error('输入图像数据无效');
  }
  const { width, height } = imageData;
  // @织: 调试信息 - 处理图像: ${width}x${height}, 数据长度: ${imageData.data.length}
  
  // 步骤1: 获取WebGPU设备
  console.time('WebGPU设备初始化');
  let device;
  if (isDeviceInitialized()) {
    // 如果设备已预初始化，直接使用缓存的设备
    device = getCachedDevice();
    console.timeEnd('WebGPU设备初始化');
  } else {
    // 等待预初始化完成或手动初始化
    try {
      await preInitializeDevice();
      device = getCachedDevice();
    } catch (error) {
      throw new Error(`WebGPU设备初始化失败: ${error.message}`);
    }
    console.timeEnd('WebGPU设备初始化');
  }
  
  // 预编译暗通道着色器
  console.time('暗通道着色器预编译');
  try {
    await precompileDarkChannelShader(device);
    console.timeEnd('暗通道着色器预编译');
  } catch (error) {
    console.warn('暗通道着色器预编译失败，将在首次使用时编译:', error);
    console.timeEnd('暗通道着色器预编译');
  }
  
  try {
    // 步骤2: 将ImageData转换为纹理
    console.time('输入纹理创建');
    const inputTexture = await imageDataToTexture(device, imageData);
    console.timeEnd('输入纹理创建');
    // @织: 调试信息 - 输入纹理创建成功
    
    // 步骤3: 计算暗通道
    console.time('暗通道计算');
    const darkChannelBuffer = await computeDarkChannelGPU(device, inputTexture, width, height, windowSize);
    console.timeEnd('暗通道计算');
    // @织: 调试信息 - 暗通道计算完成
    // @织: 调试缓冲区已移除 - 验证暗通道计算结果
    
    // 步骤4: 准备暗通道数据用于CPU处理
    console.time('暗通道数据准备');
    const readBuffer = device.createBuffer({
      size: width * height * 4, // f32数据，每个像素4字节
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(darkChannelBuffer, 0, readBuffer, 0, width * height * 4);
    device.queue.submit([commandEncoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const rawDarkData = readBuffer.getMappedRange();
    const darkChannelArray = new Float32Array(rawDarkData.slice(0)); // 创建副本避免detached
    readBuffer.unmap();
    // 转换为Uint8ClampedArray用于CPU处理
    const darkChannelUint8 = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      darkChannelUint8[i] = Math.round(darkChannelArray[i] * 255);
    }
    console.timeEnd('暗通道数据准备');
    
    // 步骤5: 估计大气光
    console.time('大气光估计');
    const atmosphericLightRGB = await estimateAtmosphericLightDownsampled(device, darkChannelBuffer, imageData, width, height, topRatio, 'all');
    console.timeEnd('大气光估计');
    
    // 步骤6: 自适应雾强度检测和omega、t0计算
    console.time('自适应参数计算');
    let finalOmega = omega;
    let finalT0 = t0;
    let adaptiveInfo = null;
    if (adaptiveMode) {
      adaptiveInfo = detectHazeAndAdapt(darkChannelArray, atmosphericLightRGB.luminance, width, height, omega, t0, {
        ...adaptiveOptions,
        adaptiveStrength
      });
      finalOmega = adaptiveInfo.omega;
      finalT0 = adaptiveInfo.t0;
    } 
    console.timeEnd('自适应参数计算');
    
    // 步骤7: 估计透射率
    console.time('透射率估计');
    let transmissionBuffer;
    if (spatialAdaptiveMode) {
      transmissionBuffer = await estimateSpatialAdaptiveTransmissionGPU(device, darkChannelBuffer, atmosphericLightRGB.luminance, width, height, finalOmega, t0, {
        ...adaptiveOptions,
        adaptiveStrength
      });
    } else {
      transmissionBuffer = await estimateTransmissionGPU(device, darkChannelBuffer, atmosphericLightRGB.luminance, width, height, finalOmega);
    }
    console.timeEnd('透射率估计');
    
    // 空间自适应模式下，图像恢复也使用空间自适应的t0
    if (spatialAdaptiveMode) {
      // 空间自适应模式下，t0已经在透射率估计阶段被调整了
      // 这里使用一个保守的t0值，因为透射率已经包含了空间自适应调整
      finalT0 = Math.max(t0 * 0.8, 0.05); // 稍微降低t0，因为透射率已经自适应调整了
    }
    
    // 步骤8: 图像恢复（支持增强功能）
    console.time('图像恢复');
    const outputBuffer = await recoverImageGPU(device, inputTexture, transmissionBuffer, atmosphericLightRGB, width, height, finalT0, enhancementOptions);
    console.timeEnd('图像恢复');
    
    // 步骤9: 转换输出结果
    console.time('输出数据转换');
    const result = await bufferToImageData(device, outputBuffer, width, height);
    console.timeEnd('输出数据转换');
    
    console.timeEnd('总耗时');
    
    return {
      imageData: result,
      adaptiveInfo,
      originalOmega: omega,
      finalOmega: finalOmega,
      atmosphericLight: atmosphericLightRGB,
      spatialAdaptiveMode,
      enhancementOptions
    };
  } catch (error) {
    console.timeEnd('总耗时');
    // @织: 错误信息 - WebGPU处理过程中出错: ${error}
    throw error;
  }
};

/**
 * 批量处理多张图像 (简化版WebGPU版本)
 * @param {ImageData[]} imageDataArray - 图像数据数组
 * @param {Object} options - 算法参数
 * @returns {Promise<Object[]>} 去雾后的结果数组，每个元素包含图像数据和自适应信息
 */
export const batchDehazeWebGPUSimple = async (imageDataArray, options = {}) => {
  console.time('批量处理总耗时');
  const results = [];
  for (let i = 0; i < imageDataArray.length; i++) {
    console.time(`图像${i + 1}处理`);
    const result = await dehazeImageWebGPUSimple(imageDataArray[i], options);
    results.push(result);
    console.timeEnd(`图像${i + 1}处理`);
  }
  console.timeEnd('批量处理总耗时');
  return results;
};

/**
 * 清理所有模块的缓存
 * 用于内存管理和性能优化
 */
export const clearAllCaches = () => {
  clearRecoverImageCaches();
  // 可以在这里添加其他模块的缓存清理
  console.log('所有缓存已清理');
}; 