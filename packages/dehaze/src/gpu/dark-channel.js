/**
 * 暗通道计算模块
 * 包含暗通道计算的所有相关功能
 * 实现缓存机制和着色器预编译以提高性能
 * @author 织
 */

import { createDarkChannelShader } from './shaders.js';
import { createBuffer } from './utils.js';

// 暗通道计算缓存
const darkChannelCache = new Map();

// 预编译的着色器和管线缓存
let precompiledShader = null;
let precompiledPipeline = null;
let shaderCompilationPromise = null;

/**
 * 预编译暗通道着色器和管线
 * @param {GPUDevice} device - WebGPU设备
 * @returns {Promise<{shader: GPUShaderModule, pipeline: GPUComputePipeline}>} 预编译的着色器和管线
 */
export const precompileDarkChannelShader = async (device) => {
  if (shaderCompilationPromise) {
    return shaderCompilationPromise;
  }
  
  shaderCompilationPromise = (async () => {
    try {
      console.log('开始预编译暗通道着色器...');
      const shader = createDarkChannelShader(device);
      
      const pipeline = device.createComputePipeline({
        label: 'DarkChannelPipeline',
        layout: 'auto',
        compute: { module: shader, entryPoint: 'computeDarkChannel' }
      });
      
      precompiledShader = shader;
      precompiledPipeline = pipeline;
      console.log('暗通道着色器预编译完成');
      
      return { shader, pipeline };
    } catch (error) {
      console.warn('暗通道着色器预编译失败:', error);
      shaderCompilationPromise = null;
      throw error;
    }
  })();
  
  return shaderCompilationPromise;
};

/**
 * 获取预编译的着色器和管线
 * @param {GPUDevice} device - WebGPU设备
 * @returns {Promise<{shader: GPUShaderModule, pipeline: GPUComputePipeline}>} 预编译的着色器和管线
 */
export const getPrecompiledDarkChannelShader = async (device) => {
  if (precompiledShader && precompiledPipeline) {
    return { shader: precompiledShader, pipeline: precompiledPipeline };
  }
  
  return await precompileDarkChannelShader(device);
};

/**
 * 生成暗通道计算的缓存键
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} windowSize - 窗口大小
 * @returns {string} 缓存键
 */
const generateDarkChannelCacheKey = (inputTexture, width, height, windowSize) => {
  // 使用纹理对象引用、尺寸和窗口大小作为缓存键
  return `${inputTexture}_${width}x${height}_${windowSize}`;
};

/**
 * 清理暗通道缓存
 * @param {number} maxCacheSize - 最大缓存数量，默认为5
 */
export const clearDarkChannelCache = (maxCacheSize = 5) => {
  if (darkChannelCache.size > maxCacheSize) {
    // 删除最旧的缓存项
    const entries = Array.from(darkChannelCache.entries());
    const toDelete = entries.slice(0, darkChannelCache.size - maxCacheSize);
    
    for (const [key, buffer] of toDelete) {
      buffer.destroy();
      darkChannelCache.delete(key);
    }
    
    console.log(`清理了 ${toDelete.length} 个暗通道缓存`);
  }
};

/**
 * 计算暗通道 (WebGPU版本，带缓存和预编译着色器)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} windowSize - 窗口大小
 * @param {boolean} useCache - 是否使用缓存，默认为true
 * @returns {Promise<GPUBuffer>} 暗通道缓冲区
 */
export const computeDarkChannelGPU = async (device, inputTexture, width, height, windowSize = 15, useCache = true) => {
  // 生成缓存键
  const cacheKey = useCache ? generateDarkChannelCacheKey(inputTexture, width, height, windowSize) : null;
  
  // 检查缓存
  if (useCache && cacheKey && darkChannelCache.has(cacheKey)) {
    console.log('使用缓存的暗通道计算结果');
    return darkChannelCache.get(cacheKey);
  }
  
  // 获取预编译的着色器和管线
  const { shader, pipeline } = await getPrecompiledDarkChannelShader(device);
  
  // 暗通道每个像素只需要一个f32值
  const outputBuffer = createBuffer(device, width * height * 4, 'DarkChannelOutputBuffer'); // 4 bytes per f32
  
  const uniformBuffer = device.createBuffer({
    label: 'DarkChannelUniformBuffer',
    size: 12, // 3 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([width, height, windowSize]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  // 使用pipeline的getBindGroupLayout来创建兼容的BindGroup
  const bindGroup = device.createBindGroup({
    label: 'DarkChannelBindGroup',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: inputTexture.createView({ format: 'rgba8unorm' }) },
      { binding: 2, resource: { buffer: outputBuffer } }
    ]
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  // 添加到缓存
  if (useCache && cacheKey) {
    darkChannelCache.set(cacheKey, outputBuffer);
    console.log(`暗通道计算结果已缓存，当前缓存数量: ${darkChannelCache.size}`);
    
    // 清理缓存
    clearDarkChannelCache();
  }
  
  return outputBuffer;
};

/**
 * 获取暗通道缓存统计信息
 * @returns {Object} 缓存统计信息
 */
export const getDarkChannelCacheStats = () => {
  return {
    cacheSize: darkChannelCache.size,
    maxCacheSize: 5,
    cacheKeys: Array.from(darkChannelCache.keys()),
    shaderPrecompiled: precompiledShader !== null,
    pipelinePrecompiled: precompiledPipeline !== null
  };
};

/**
 * 检查暗通道缓存是否包含指定键
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} windowSize - 窗口大小
 * @returns {boolean} 是否在缓存中
 */
export const isDarkChannelCached = (inputTexture, width, height, windowSize) => {
  const cacheKey = generateDarkChannelCacheKey(inputTexture, width, height, windowSize);
  return darkChannelCache.has(cacheKey);
};

/**
 * 清理预编译的着色器资源
 */
export const clearPrecompiledShader = () => {
  precompiledShader = null;
  precompiledPipeline = null;
  shaderCompilationPromise = null;
  console.log('已清理预编译的暗通道着色器');
}; 