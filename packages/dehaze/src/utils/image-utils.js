/**
 * 图像工具模块
 * 包含ImageData和纹理之间的转换函数
 * 实现纹理缓存机制以提高性能
 * @author 织
 */

import { createTexture, createBuffer } from '../gpu/utils.js';

// 纹理缓存
const textureCache = new Map();

/**
 * 生成图像数据的哈希值用于缓存键
 * @param {ImageData} imageData - 图像数据
 * @returns {string} 哈希值
 */
const generateImageHash = (imageData) => {
  // 使用图像尺寸和数据的简单哈希
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
 * 清理纹理缓存
 * @param {number} maxCacheSize - 最大缓存数量，默认为10
 */
export const clearTextureCache = (maxCacheSize = 10) => {
  if (textureCache.size > maxCacheSize) {
    // 删除最旧的缓存项
    const entries = Array.from(textureCache.entries());
    const toDelete = entries.slice(0, textureCache.size - maxCacheSize);
    
    for (const [key, texture] of toDelete) {
      texture.destroy();
      textureCache.delete(key);
    }
    
    console.log(`清理了 ${toDelete.length} 个纹理缓存`);
  }
};

/**
 * 将ImageData转换为纹理（带缓存）
 * @param {GPUDevice} device - WebGPU设备
 * @param {ImageData} imageData - 图像数据
 * @param {boolean} useCache - 是否使用缓存，默认为true
 * @returns {Promise<GPUTexture>} 纹理对象
 */
export const imageDataToTexture = async (device, imageData, useCache = true) => {
  // 确保数据不为空
  if (imageData.data.length === 0) {
    throw new Error('输入图像数据为空');
  }
  
  // 生成缓存键
  const cacheKey = useCache ? generateImageHash(imageData) : null;
  
  // 检查缓存
  if (useCache && cacheKey && textureCache.has(cacheKey)) {
    console.log('使用缓存的纹理');
    return textureCache.get(cacheKey);
  }
  
  // 使用rgba8unorm格式，更兼容且性能更好
  const texture = createTexture(device, imageData.width, imageData.height, 'rgba8unorm', 
    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC);
  
  // @织: 调试信息 - 创建纹理: ${imageData.width}x${imageData.height}, 数据长度: ${imageData.data.length}
  // @织: 调试信息 - 输入图像前16个字节: ${imageData.data.slice(0, 16)}
  // @织: 调试信息 - 输入图像第一个像素RGBA: ${imageData.data.slice(0, 4)}
  // @织: 调试信息 - 输入图像第二个像素RGBA: ${imageData.data.slice(4, 8)}
  
  // 计算正确的bytesPerRow，确保256字节对齐
  const bytesPerRow = Math.ceil(imageData.width * 4 / 256) * 256;
  // @织: 调试信息 - bytesPerRow: ${bytesPerRow}, 原始: ${imageData.width * 4}
  
  // 创建对齐的数据缓冲区
  const alignedData = new Uint8Array(bytesPerRow * imageData.height);
  for (let row = 0; row < imageData.height; row++) {
    const srcOffset = row * imageData.width * 4;
    const dstOffset = row * bytesPerRow;
    alignedData.set(imageData.data.slice(srcOffset, srcOffset + imageData.width * 4), dstOffset);
  }
  
  // 使用对齐的数据写入纹理
  device.queue.writeTexture(
    { texture },
    alignedData,
    { bytesPerRow },
    { width: imageData.width, height: imageData.height }
  );
  
  // 等待纹理写入完成
  await device.queue.onSubmittedWorkDone();
  // @织: 调试信息 - 纹理写入完成
  
  // 添加到缓存
  if (useCache && cacheKey) {
    textureCache.set(cacheKey, texture);
    console.log(`纹理已缓存，当前缓存数量: ${textureCache.size}`);
    
    // 清理缓存
    clearTextureCache();
  }
  
  return texture;
};

/**
 * 将纹理转换为ImageData
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} texture - 纹理对象
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Promise<ImageData>} 图像数据
 */
export const textureToImageData = async (device, texture, width, height) => {
  const buffer = device.createBuffer({
    size: width * height * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyTextureToBuffer(
    { texture },
    { buffer },
    { width, height }
  );
  
  device.queue.submit([commandEncoder.finish()]);
  
  await buffer.mapAsync(GPUMapMode.READ);
  const rawData = buffer.getMappedRange();
  const data = new Uint8ClampedArray(rawData);
  buffer.unmap();
  
  // 确保数据不为空
  if (data.length === 0) {
    throw new Error('纹理数据为空');
  }
  
  return new ImageData(data, width, height);
};

/**
 * 将缓冲区转换为ImageData
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUBuffer} buffer - 输出缓冲区
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Promise<ImageData>} 图像数据
 */
export const bufferToImageData = async (device, buffer, width, height) => {
  const expectedSize = width * height * 4 * 4; // 每个像素4个f32值，每个f32是4字节
  // @织: 调试信息 - 开始转换缓冲区: ${width}x${height}, 预期数据大小: ${expectedSize}
  // @织: 调试信息 - 缓冲区实际大小: ${buffer.size}
  
  const readBuffer = device.createBuffer({
    size: expectedSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, expectedSize);
  device.queue.submit([commandEncoder.finish()]);
  
  // @织: 调试信息 - 等待缓冲区映射...
  await readBuffer.mapAsync(GPUMapMode.READ);
  
  // 立即复制数据到新的ArrayBuffer，避免detached问题
  const rawData = readBuffer.getMappedRange();
  const float32Data = new Float32Array(rawData.slice(0)); // 创建副本
  readBuffer.unmap();
  
  // @织: 调试信息 - 读取到数据长度: ${float32Data.length}, 预期长度: ${expectedSize / 4}
  
  // 确保数据不为空
  if (float32Data.length === 0) {
    throw new Error('缓冲区数据为空');
  }
  
  // 检查前几个像素的值
  // @织: 调试信息 - 前16个f32值: ${float32Data.slice(0, 16)}
  // @织: 调试信息 - 第一个像素RGBA: ${float32Data.slice(0, 4)}
  // @织: 调试信息 - 第二个像素RGBA: ${float32Data.slice(4, 8)}
  
  // 将Float32Array转换为Uint8ClampedArray
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height * 4; i++) {
    // 将0-1范围的f32值转换为0-255范围的u8值
    data[i] = Math.max(0, Math.min(255, Math.round(float32Data[i] * 255)));
  }
  
  // @织: 调试信息 - 转换后的前16个u8值: ${data.slice(0, 16)}
  // @织: 调试信息 - 转换后的第一个像素RGBA: ${data.slice(0, 4)}
  // @织: 调试信息 - 转换后的第二个像素RGBA: ${data.slice(4, 8)}
  
  return new ImageData(data, width, height);
}; 