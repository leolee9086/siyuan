/**
 * 统一的管线缓存管理系统
 * 解决更换图片后缓存没有及时更新造成伪影的问题
 * @author 织
 */

// 全局缓存存储
const pipelineCache = new Map();
const uniformBufferCache = new Map();
const outputBufferCache = new Map();
const bindGroupCache = new Map();
const textureCache = new Map();

// 缓存键生成器
const generateCacheKey = (params) => {
  const {
    width,
    height,
    atmosphericLightR,
    atmosphericLightG,
    atmosphericLightB,
    atmosphericLightLuminance,
    t0,
    enableEnhancement,
    saturationEnhancement,
    contrastEnhancement,
    brightnessEnhancement,
    imageHash // 新增：图像哈希值
  } = params;
  
  return `${width}x${height}_${atmosphericLightR.toFixed(3)}_${atmosphericLightG.toFixed(3)}_${atmosphericLightB.toFixed(3)}_${atmosphericLightLuminance.toFixed(3)}_${t0.toFixed(3)}_${imageHash}`;
};

/**
 * 生成图像数据的哈希值
 * @param {ImageData} imageData - 图像数据
 * @returns {string} 哈希值
 */
export const generateImageHash = (imageData) => {
  const { width, height, data } = imageData;
  let hash = `${width}x${height}`;
  
  // 对于大数据，只取前几个和后几个字节计算哈希
  if (data.length > 1024) {
    const front = Array.from(data.slice(0, 512));
    const back = Array.from(data.slice(-512));
    hash += `_${front.join(',')}_${back.join(',')}`;
  } else {
    hash += `_${Array.from(data).join(',')}`;
  }
  
  return hash;
};

/**
 * 清理所有缓存
 */
export const clearAllCaches = () => {
  // 清理纹理缓存
  for (const texture of textureCache.values()) {
    texture.destroy();
  }
  textureCache.clear();
  
  // 清理其他缓存
  pipelineCache.clear();
  uniformBufferCache.clear();
  outputBufferCache.clear();
  bindGroupCache.clear();
  
  console.log('所有缓存已清理');
};

/**
 * 清理特定图像的缓存
 * @param {string} imageHash - 图像哈希值
 */
export const clearImageCaches = (imageHash) => {
  // 清理包含该图像哈希的缓存
  const keysToDelete = [];
  
  for (const [key, value] of pipelineCache.entries()) {
    if (key.includes(imageHash)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    pipelineCache.delete(key);
    uniformBufferCache.delete(key);
    outputBufferCache.delete(key);
    bindGroupCache.delete(key);
  }
  
  console.log(`清理了 ${keysToDelete.length} 个图像相关缓存`);
};

/**
 * 获取或创建缓存的pipeline
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} cacheKey - 缓存键
 * @param {boolean} useEnhancedShader - 是否使用增强着色器
 * @returns {GPUComputePipeline} 计算pipeline
 */
export const getOrCreatePipeline = (device, cacheKey, useEnhancedShader = false) => {
  if (pipelineCache.has(cacheKey)) {
    const cachedPipeline = pipelineCache.get(cacheKey);
    // 验证pipeline是否仍然有效
    if (cachedPipeline && !cachedPipeline.destroyed) {
      return cachedPipeline;
    } else {
      // 清理无效的缓存
      pipelineCache.delete(cacheKey);
    }
  }
  
  // 创建新的pipeline
  const shader = useEnhancedShader ? 
    require('./shaders.js').createEnhancedRecoverImageShader(device) :
    require('./shaders.js').createRecoverImageShader(device);
  
  const pipeline = device.createComputePipeline({
    label: 'RecoverImagePipeline',
    layout: 'auto',
    compute: { module: shader, entryPoint: 'recoverImage' }
  });
  
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
export const getOrCreateUniformBuffer = (device, cacheKey, uniformData, useEnhancedShader = false) => {
  if (uniformBufferCache.has(cacheKey)) {
    const cachedBuffer = uniformBufferCache.get(cacheKey);
    const bufferSize = uniformData.byteLength;
    
    if (cachedBuffer.size === bufferSize) {
      device.queue.writeBuffer(cachedBuffer, 0, uniformData);
      return cachedBuffer;
    }
  }
  
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
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
export const getOrCreateOutputBuffer = (device, cacheKey, width, height) => {
  if (outputBufferCache.has(cacheKey)) {
    const cachedBuffer = outputBufferCache.get(cacheKey);
    const requiredSize = width * height * 4 * 4;
    
    if (cachedBuffer.size >= requiredSize) {
      // 重新初始化缓冲区为0
      const initData = new Float32Array(width * height * 4);
      device.queue.writeBuffer(cachedBuffer, 0, initData);
      return cachedBuffer;
    }
  }
  
  const outputBuffer = device.createBuffer({
    size: width * height * 4 * 4,
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
export const getOrCreateBindGroup = (device, cacheKey, pipeline, uniformBuffer, inputTexture, transmissionBuffer, outputBuffer) => {
  if (bindGroupCache.has(cacheKey)) {
    const cachedBindGroup = bindGroupCache.get(cacheKey);
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
 * 获取或创建缓存的纹理
 * @param {GPUDevice} device - WebGPU设备
 * @param {ImageData} imageData - 图像数据
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise<GPUTexture>} 纹理对象
 */
export const getOrCreateTexture = async (device, imageData, useCache = true) => {
  const imageHash = generateImageHash(imageData);
  const cacheKey = useCache ? imageHash : null;
  
  if (useCache && cacheKey && textureCache.has(cacheKey)) {
    console.log('使用缓存的纹理');
    return textureCache.get(cacheKey);
  }
  
  // 创建新纹理
  const { createTexture } = require('./utils.js');
  const texture = createTexture(device, imageData.width, imageData.height, 'rgba8unorm', 
    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC);
  
  // 写入纹理数据
  const bytesPerRow = Math.ceil(imageData.width * 4 / 256) * 256;
  const alignedData = new Uint8Array(bytesPerRow * imageData.height);
  
  for (let row = 0; row < imageData.height; row++) {
    const srcOffset = row * imageData.width * 4;
    const dstOffset = row * bytesPerRow;
    alignedData.set(imageData.data.slice(srcOffset, srcOffset + imageData.width * 4), dstOffset);
  }
  
  device.queue.writeTexture(
    { texture },
    alignedData,
    { bytesPerRow },
    { width: imageData.width, height: imageData.height }
  );
  
  await device.queue.onSubmittedWorkDone();
  
  if (useCache && cacheKey) {
    textureCache.set(cacheKey, texture);
    console.log(`纹理已缓存，当前缓存数量: ${textureCache.size}`);
  }
  
  return texture;
};

/**
 * 创建完整的缓存键
 * @param {Object} params - 参数对象
 * @param {ImageData} imageData - 图像数据
 * @returns {string} 缓存键
 */
export const createFullCacheKey = (params, imageData) => {
  const imageHash = generateImageHash(imageData);
  return generateCacheKey({ ...params, imageHash });
};

