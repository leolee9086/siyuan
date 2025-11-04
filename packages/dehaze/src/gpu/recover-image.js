/**
 * 图像恢复模块
 * 负责从透射率图和大气光值恢复无雾图像
 * @author 织
 */

import { createRecoverImageShader, createEnhancedRecoverImageShader } from './shaders.js';

// 缓存系统
let cachedPipeline = null;
let cachedBindGroupLayout = null;

// 缓存键生成函数
const generateCacheKey = (width, height, atmosphericLightR, atmosphericLightG, atmosphericLightB, atmosphericLightLuminance, t0, enableEnhancement, saturationEnhancement, contrastEnhancement, brightnessEnhancement) => {
  const enhancementKey = enableEnhancement ? `_e_s${saturationEnhancement.toFixed(2)}_c${contrastEnhancement.toFixed(2)}_b${brightnessEnhancement.toFixed(2)}` : '';
  return `${width}x${height}_${atmosphericLightR.toFixed(3)}_${atmosphericLightG.toFixed(3)}_${atmosphericLightB.toFixed(3)}_${atmosphericLightLuminance.toFixed(3)}_${t0.toFixed(3)}${enhancementKey}`;
};

// 缓存存储
const pipelineCache = new Map();
const uniformBufferCache = new Map();
const outputBufferCache = new Map();
const bindGroupCache = new Map();

// 缓存清理函数
const clearCaches = () => {
  pipelineCache.clear();
  uniformBufferCache.clear();
  outputBufferCache.clear();
  bindGroupCache.clear();
  cachedPipeline = null;
  cachedBindGroupLayout = null;
};

/**
 * 获取或创建缓存的pipeline
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} cacheKey - 缓存键
 * @param {boolean} useEnhancedShader - 是否使用增强着色器
 * @returns {GPUComputePipeline} 计算pipeline
 */
const getOrCreatePipeline = (device, cacheKey, useEnhancedShader = false) => {
  // 强制清理缓存，避免pipeline无效问题
  if (pipelineCache.has(cacheKey)) {
    const cachedPipeline = pipelineCache.get(cacheKey);
    // 检查pipeline是否仍然有效
    try {
      // 尝试获取bindGroupLayout来验证pipeline是否有效
      cachedPipeline.getBindGroupLayout(0);
      return cachedPipeline;
    } catch (error) {
      // 如果pipeline无效，从缓存中移除
      pipelineCache.delete(cacheKey);
      // @织: 调试信息 - 发现无效pipeline，已清理缓存
    }
  }
  
  let shaderModule;
  try {
    shaderModule = useEnhancedShader 
      ? createEnhancedRecoverImageShader(device) 
      : createRecoverImageShader(device);
    // @织: 调试信息 - 着色器模块创建成功，使用增强着色器: ${useEnhancedShader}
  } catch (error) {
    // @织: 错误信息 - 着色器模块创建失败: ${error}
    throw new Error(`着色器模块创建失败: ${error.message}`);
  }
  
  const pipeline = device.createComputePipeline({
    label: useEnhancedShader ? 'EnhancedRecoverImagePipeline' : 'RecoverImagePipeline',
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'recoverImage' }
  });
  
  // @织: 调试信息 - Pipeline创建成功，标签: ${useEnhancedShader ? 'EnhancedRecoverImagePipeline' : 'RecoverImagePipeline'}
  
  pipelineCache.set(cacheKey, pipeline);
  return pipeline;
};

/**
 * 获取或创建缓存的uniformBuffer
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} cacheKey - 缓存键
 * @param {Float32Array} uniformData - uniform数据
 * @param {boolean} useEnhancedShader - 是否使用增强着色器
 * @returns {GPUBuffer} uniform缓冲区
 */
const getOrCreateUniformBuffer = (device, cacheKey, uniformData, useEnhancedShader = false) => {
  const bufferSize = useEnhancedShader ? 48 : 32;
  
  if (uniformBufferCache.has(cacheKey)) {
    const cachedBuffer = uniformBufferCache.get(cacheKey);
    // 检查缓冲区大小是否匹配，如果不匹配则重新创建
    if (cachedBuffer.size === bufferSize) {
      device.queue.writeBuffer(cachedBuffer, 0, uniformData);
      return cachedBuffer;
    }
  }
  
  const uniformBuffer = device.createBuffer({
    size: bufferSize, 
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  uniformBufferCache.set(cacheKey, uniformBuffer);
  return uniformBuffer;
};

/**
 * 获取或创建缓存的outputBuffer
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} cacheKey - 缓存键
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {GPUBuffer} 输出缓冲区
 */
const getOrCreateOutputBuffer = (device, cacheKey, width, height) => {
  if (outputBufferCache.has(cacheKey)) {
    const cachedBuffer = outputBufferCache.get(cacheKey);
    // 检查缓冲区大小是否匹配
    const requiredSize = width * height * 4 * 4;
    if (cachedBuffer.size >= requiredSize) {
      // 重新初始化缓冲区为0
      const initData = new Float32Array(width * height * 4);
      device.queue.writeBuffer(cachedBuffer, 0, initData);
      return cachedBuffer;
    }
  }
  
  const outputBuffer = device.createBuffer({
    size: width * height * 4 * 4, // 每个像素4个f32值，每个f32是4字节
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  
  // 初始化输出缓冲区为0
  const initData = new Float32Array(width * height * 4);
  device.queue.writeBuffer(outputBuffer, 0, initData);
  
  outputBufferCache.set(cacheKey, outputBuffer);
  return outputBuffer;
};

/**
 * 获取或创建缓存的bindGroup
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} cacheKey - 缓存键
 * @param {GPUComputePipeline} pipeline - 计算pipeline
 * @param {GPUBuffer} uniformBuffer - uniform缓冲区
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {GPUBuffer} transmissionBuffer - 透射率缓冲区
 * @param {GPUBuffer} outputBuffer - 输出缓冲区
 * @returns {GPUBindGroup} bindGroup
 */
const getOrCreateBindGroup = (device, cacheKey, pipeline, uniformBuffer, inputTexture, transmissionBuffer, outputBuffer) => {
  if (bindGroupCache.has(cacheKey)) {
    const cachedBindGroup = bindGroupCache.get(cacheKey);
    // 由于纹理和缓冲区可能变化，需要重新创建bindGroup
    // 但我们可以缓存bindGroupLayout
    const bindGroupLayout = cachedBindGroup.layout || pipeline.getBindGroupLayout(0);
    
    const bindGroup = device.createBindGroup({
      label: 'RecoverImageBindGroup',
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: inputTexture.createView() },
        { binding: 2, resource: { buffer: transmissionBuffer } },
        { binding: 3, resource: { buffer: outputBuffer } }
      ]
    });
    
    return bindGroup;
  }
  
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  const bindGroup = device.createBindGroup({
    label: 'RecoverImageBindGroup',
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: inputTexture.createView() },
      { binding: 2, resource: { buffer: transmissionBuffer } },
      { binding: 3, resource: { buffer: outputBuffer } }
    ]
  });
  
  // 缓存bindGroupLayout而不是bindGroup本身
  bindGroupCache.set(cacheKey, { layout: bindGroupLayout });
  return bindGroup;
};

/**
 * 恢复无雾图像 (WebGPU版本，改进版支持分别的RGB大气光，带缓存优化)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {GPUBuffer} transmissionBuffer - 透射率缓冲区
 * @param {Object} atmosphericLight - 大气光值对象，包含r, g, b, luminance
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} t0 - 最小透射率阈值
 * @param {Object} enhancementOptions - 增强选项
 * @param {boolean} enhancementOptions.enableEnhancement - 是否启用增强
 * @param {number} enhancementOptions.saturationEnhancement - 饱和度增强因子 (0.0-2.0)
 * @param {number} enhancementOptions.contrastEnhancement - 对比度增强因子 (0.5-2.0)
 * @returns {Promise<GPUBuffer>} 去雾后的缓冲区
 */
export const recoverImageGPU = async (device, inputTexture, transmissionBuffer, atmosphericLight, width, height, t0 = 0.1, enhancementOptions = {}) => {
  // @织: 调试信息 - 开始图像恢复: ${width}x${height}, 大气光: ${JSON.stringify(atmosphericLight)}, t0: ${t0}
  
  const {
    enableEnhancement = false,
    saturationEnhancement = 1.2,
    contrastEnhancement = 1.1,
    brightnessEnhancement = 1.0
  } = enhancementOptions;
  
  // 处理大气光值，支持兼容旧版本
  let atmosphericLightR, atmosphericLightG, atmosphericLightB, atmosphericLightLuminance;
  
  if (typeof atmosphericLight === 'object' && atmosphericLight.r !== undefined) {
    // 新版本：分别的RGB大气光
    atmosphericLightR = atmosphericLight.r;
    atmosphericLightG = atmosphericLight.g;
    atmosphericLightB = atmosphericLight.b;
    atmosphericLightLuminance = atmosphericLight.luminance;
  } else {
    // 兼容旧版本：使用单一大气光值
    const singleAtmosphericLight = atmosphericLight;
    atmosphericLightR = singleAtmosphericLight;
    atmosphericLightG = singleAtmosphericLight;
    atmosphericLightB = singleAtmosphericLight;
    atmosphericLightLuminance = singleAtmosphericLight;
  }
  
  // 生成缓存键
  const cacheKey = generateCacheKey(width, height, atmosphericLightR, atmosphericLightG, atmosphericLightB, atmosphericLightLuminance, t0, enableEnhancement, saturationEnhancement, contrastEnhancement, brightnessEnhancement);
  
  // 获取或创建缓存的pipeline
  const pipeline = getOrCreatePipeline(device, cacheKey, enableEnhancement);
  
  // @织: 调试信息 - Pipeline创建成功，使用增强着色器: ${enableEnhancement}
  
  // 准备uniform数据
  let uniformData;
  if (enableEnhancement) {
    uniformData = new Float32Array([
      width, height, atmosphericLightR, atmosphericLightG, 
      atmosphericLightB, atmosphericLightLuminance, t0,
      saturationEnhancement, contrastEnhancement, brightnessEnhancement, enableEnhancement ? 1.0 : 0.0,
      0.0 // 填充
    ]);
  } else {
    uniformData = new Float32Array([
      width, height, atmosphericLightR, atmosphericLightG, 
      atmosphericLightB, atmosphericLightLuminance, t0
    ]);
  }
  
  // 获取或创建缓存的uniformBuffer
  const uniformBuffer = getOrCreateUniformBuffer(device, cacheKey, uniformData, enableEnhancement);
  
  // 获取或创建缓存的outputBuffer
  const outputBuffer = getOrCreateOutputBuffer(device, cacheKey, width, height);
  
  // 获取或创建缓存的bindGroup
  let bindGroup;
  try {
    bindGroup = getOrCreateBindGroup(device, cacheKey, pipeline, uniformBuffer, inputTexture, transmissionBuffer, outputBuffer);
    // @织: 调试信息 - BindGroup创建成功
  } catch (error) {
    // @织: 错误信息 - BindGroup创建失败: ${error}
    throw new Error(`BindGroup创建失败: ${error.message}`);
  }
  
  // @织: 调试信息 - Uniform数据: ${uniformData}
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  
  const workgroupX = Math.ceil(width / 16);
  const workgroupY = Math.ceil(height / 8);
  // @织: 调试信息 - 调度工作组: ${workgroupX}x${workgroupY}
  
  computePass.dispatchWorkgroups(workgroupX, workgroupY);
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  // @织: 调试信息 - GPU计算完成，检查输出缓冲区...
  
  return outputBuffer;
};

// 导出缓存清理函数
export { clearCaches }; 