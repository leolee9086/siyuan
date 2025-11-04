/**
 * 简化版WebGPU图像去雾算法实现
 * 基于暗通道先验(Dark Channel Prior)的高性能去雾算法
 * 使用WebGPU进行GPU加速计算
 * @author 织
 */

/**
 * 获取WebGPU适配器
 * @returns {Promise<GPUAdapter>} GPU适配器
 */
export const getWebGPUAdapter = async () => {
  if (!navigator.gpu) {
    throw new Error('WebGPU不可用');
  }
  
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  });
  
  if (!adapter) {
    throw new Error('无法获取WebGPU适配器');
  }
  
  return adapter;
};

/**
 * 初始化WebGPU设备
 * @param {GPUAdapter} adapter - GPU适配器
 * @returns {Promise<GPUDevice>} WebGPU设备
 */
export const initializeWebGPUDevice = async (adapter) => {
  if (!adapter) {
    throw new Error('WebGPU适配器不可用');
  }
  
  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {
      maxStorageBufferBindingSize: 1024 * 1024 * 1024, // 1GB
      maxBufferSize: 1024 * 1024 * 1024, // 1GB
    }
  });
  
  return device;
};

/**
 * 创建计算暗通道的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createDarkChannelShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        windowSize: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var<storage, read_write> outputBuffer: array<f32>;
      
      @compute @workgroup_size(8, 8)
      fn computeDarkChannel(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (f32(x) >= uniforms.width || f32(y) >= uniforms.height) {
          return;
        }
        
        let halfWindow = u32(uniforms.windowSize / 2.0);
        var minValue: f32 = 1.0;
        
        for (var wy = max(0u, y - halfWindow); wy <= min(u32(uniforms.height - 1.0), y + halfWindow); wy++) {
          for (var wx = max(0u, x - halfWindow); wx <= min(u32(uniforms.width - 1.0), x + halfWindow); wx++) {
            // 移除Y坐标翻转，直接使用原始坐标
            let pixel = textureLoad(inputTexture, vec2<i32>(i32(wx), i32(wy)), 0);
            // rgba8unorm格式已经返回0-1范围的f32值
            let minChannel = min(min(pixel.r, pixel.g), pixel.b);
            minValue = min(minValue, minChannel);
          }
        }
        
        let outputIndex = u32(f32(y) * uniforms.width + f32(x));
        outputBuffer[outputIndex] = minValue;
      }
    `
  });
};

/**
 * 创建估计透射率的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createTransmissionShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        atmosphericLight: f32,
        omega: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> darkChannelBuffer: array<f32>;
      @group(0) @binding(2) var<storage, read_write> transmissionBuffer: array<f32>;
      
      @compute @workgroup_size(256)
      fn estimateTransmission(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let pixelIndex = globalId.x;
        let totalPixels = u32(uniforms.width * uniforms.height);
        
        if (pixelIndex >= totalPixels) {
          return;
        }
        
        let darkValue = darkChannelBuffer[pixelIndex];
        let transmission = 1.0 - uniforms.omega * (darkValue / uniforms.atmosphericLight);
        transmissionBuffer[pixelIndex] = transmission;
      }
    `
  });
};

/**
 * 创建恢复图像的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createRecoverImageShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: f32,
        height: f32,
        atmosphericLight: f32,
        t0: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var<storage, read> transmissionBuffer: array<f32>;
      @group(0) @binding(3) var<storage, read_write> outputBuffer: array<f32>;
      
      @compute @workgroup_size(8, 8)
      fn recoverImage(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (f32(x) >= uniforms.width || f32(y) >= uniforms.height) {
          return;
        }
        
        // 移除Y坐标翻转，直接使用原始坐标
        let pos = vec2<i32>(i32(x), i32(y));
        let pixel = textureLoad(inputTexture, pos, 0);
        
        // rgba8unorm格式已经返回0-1范围的f32值
        let r = pixel.r;
        let g = pixel.g;
        let b = pixel.b;
        let a = pixel.a;
        
        let transmission = max(transmissionBuffer[u32(f32(y) * uniforms.width + f32(x))], uniforms.t0);
        
        let recoveredR = (r - uniforms.atmosphericLight) / transmission + uniforms.atmosphericLight;
        let recoveredG = (g - uniforms.atmosphericLight) / transmission + uniforms.atmosphericLight;
        let recoveredB = (b - uniforms.atmosphericLight) / transmission + uniforms.atmosphericLight;
        
        let outputIndex = u32(f32(y) * uniforms.width + f32(x)) * 4u;
        // 直接写入f32值，不转换为u32
        outputBuffer[outputIndex] = clamp(recoveredR, 0.0, 1.0);
        outputBuffer[outputIndex + 1u] = clamp(recoveredG, 0.0, 1.0);
        outputBuffer[outputIndex + 2u] = clamp(recoveredB, 0.0, 1.0);
        outputBuffer[outputIndex + 3u] = a;
      }
    `
  });
};

/**
 * 创建纹理
 * @param {GPUDevice} device - WebGPU设备
 * @param {number} width - 纹理宽度
 * @param {number} height - 纹理高度
 * @param {string} format - 纹理格式
 * @param {string} usage - 使用方式
 * @returns {GPUTexture} 纹理对象
 */
const createTexture = (device, width, height, format = 'rgba8unorm', usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT) => {
  return device.createTexture({
    size: { width, height },
    format,
    usage
  });
};

/**
 * 创建缓冲区
 * @param {GPUDevice} device - WebGPU设备
 * @param {number} size - 缓冲区大小
 * @param {string} usage - 使用方式
 * @returns {GPUBuffer} 缓冲区对象
 */
const createBuffer = (device, size, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC) => {
  return device.createBuffer({
    size,
    usage
  });
};

/**
 * 将ImageData转换为纹理
 * @param {GPUDevice} device - WebGPU设备
 * @param {ImageData} imageData - 图像数据
 * @returns {GPUTexture} 纹理对象
 */
const imageDataToTexture = async (device, imageData) => {
  // 使用rgba8unorm格式，更兼容且性能更好
  const texture = createTexture(device, imageData.width, imageData.height, 'rgba8unorm', 
    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC);
  
  // 确保数据不为空
  if (imageData.data.length === 0) {
    throw new Error('输入图像数据为空');
  }
  
  console.log(`创建纹理: ${imageData.width}x${imageData.height}, 数据长度: ${imageData.data.length}`);
  console.log('输入图像前16个字节:', imageData.data.slice(0, 16));
  console.log('输入图像第一个像素RGBA:', imageData.data.slice(0, 4));
  console.log('输入图像第二个像素RGBA:', imageData.data.slice(4, 8));
  
  // 计算正确的bytesPerRow，确保256字节对齐
  const bytesPerRow = Math.ceil(imageData.width * 4 / 256) * 256;
  console.log(`bytesPerRow: ${bytesPerRow}, 原始: ${imageData.width * 4}`);
  
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
  console.log('纹理写入完成');
  
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
const textureToImageData = async (device, texture, width, height) => {
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
const bufferToImageData = async (device, buffer, width, height) => {
  const expectedSize = width * height * 4 * 4; // 每个像素4个f32值，每个f32是4字节
  console.log(`开始转换缓冲区: ${width}x${height}, 预期数据大小: ${expectedSize}`);
  console.log(`缓冲区实际大小: ${buffer.size}`);
  
  const readBuffer = device.createBuffer({
    size: expectedSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, expectedSize);
  device.queue.submit([commandEncoder.finish()]);
  
  console.log('等待缓冲区映射...');
  await readBuffer.mapAsync(GPUMapMode.READ);
  
  // 立即复制数据到新的ArrayBuffer，避免detached问题
  const rawData = readBuffer.getMappedRange();
  const float32Data = new Float32Array(rawData.slice(0)); // 创建副本
  readBuffer.unmap();
  
  console.log(`读取到数据长度: ${float32Data.length}, 预期长度: ${expectedSize / 4}`);
  
  // 确保数据不为空
  if (float32Data.length === 0) {
    throw new Error('缓冲区数据为空');
  }
  
  // 检查前几个像素的值
  console.log('前16个f32值:', float32Data.slice(0, 16));
  console.log('第一个像素RGBA:', float32Data.slice(0, 4));
  console.log('第二个像素RGBA:', float32Data.slice(4, 8));
  
  // 将Float32Array转换为Uint8ClampedArray
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height * 4; i++) {
    // 将0-1范围的f32值转换为0-255范围的u8值
    data[i] = Math.max(0, Math.min(255, Math.round(float32Data[i] * 255)));
  }
  
  console.log('转换后的前16个u8值:', data.slice(0, 16));
  console.log('转换后的第一个像素RGBA:', data.slice(0, 4));
  console.log('转换后的第二个像素RGBA:', data.slice(4, 8));
  
  return new ImageData(data, width, height);
};

/**
 * 计算暗通道 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} windowSize - 窗口大小
 * @returns {Promise<GPUBuffer>} 暗通道缓冲区
 */
const computeDarkChannelGPU = async (device, inputTexture, width, height, windowSize = 15) => {
  const shader = createDarkChannelShader(device);
  // 暗通道每个像素只需要一个f32值
  const outputBuffer = createBuffer(device, width * height * 4); // 4 bytes per f32
  
  const uniformBuffer = device.createBuffer({
    size: 12, // 3 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([width, height, windowSize]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'computeDarkChannel' }
  });
  
  // 使用pipeline的getBindGroupLayout来创建兼容的BindGroup
  const bindGroup = device.createBindGroup({
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
  computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  return outputBuffer;
};

/**
 * 估计大气光 (CPU版本，用于简化)
 * @param {ImageData} imageData - 输入图像数据
 * @param {Uint8ClampedArray} darkChannel - 暗通道图像
 * @param {number} topRatio - 取前topRatio%的像素，默认为0.1
 * @returns {number} 估计的大气光值
 */
const estimateAtmosphericLight = (imageData, darkChannel, topRatio = 0.1) => {
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
  
  // 在前topRatio%的像素中寻找最亮的像素
  for (let i = 0; i < topCount; i++) {
    const idx = indices[i];
    const pixelIdx = idx * 4;
    const intensity = Math.max(data[pixelIdx], data[pixelIdx + 1], data[pixelIdx + 2]);
    
    if (intensity > maxIntensity) {
      maxIntensity = intensity;
    }
  }
  
  return maxIntensity / 255; // 归一化到0-1范围
};

/**
 * 估计透射率图 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUBuffer} darkChannelBuffer - 暗通道缓冲区
 * @param {number} atmosphericLight - 大气光值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} omega - 去雾强度参数
 * @returns {Promise<GPUBuffer>} 透射率缓冲区
 */
const estimateTransmissionGPU = async (device, darkChannelBuffer, atmosphericLight, width, height, omega = 0.95) => {
  const shader = createTransmissionShader(device);
  // 透射率每个像素只需要一个f32值
  const transmissionBuffer = createBuffer(device, width * height * 4); // 4 bytes per f32
  
  const uniformBuffer = device.createBuffer({
    size: 16, // 4 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  // 修复uniform数据格式：全部使用f32
  const uniformData = new Float32Array([width, height, atmosphericLight, omega]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'estimateTransmission' }
  });
  
  // 使用pipeline的getBindGroupLayout来创建兼容的BindGroup
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: darkChannelBuffer } },
      { binding: 2, resource: { buffer: transmissionBuffer } }
    ]
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width * height / 256));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  return transmissionBuffer;
};

/**
 * 恢复无雾图像 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {GPUBuffer} transmissionBuffer - 透射率缓冲区
 * @param {number} atmosphericLight - 大气光值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} t0 - 最小透射率阈值
 * @returns {Promise<GPUBuffer>} 去雾后的缓冲区
 */
const recoverImageGPU = async (device, inputTexture, transmissionBuffer, atmosphericLight, width, height, t0 = 0.1) => {
  console.log(`开始图像恢复: ${width}x${height}, 大气光: ${atmosphericLight}, t0: ${t0}`);
  
  // 验证输入纹理数据
  const testTextureBuffer = device.createBuffer({
    size: 32, // 读取前8个像素
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  // 使用与写入时相同的bytesPerRow对齐
  const testBytesPerRow = Math.ceil(2 * 4 / 256) * 256; // 2个像素，每个像素4字节
  
  const testTextureCommandEncoder = device.createCommandEncoder();
  testTextureCommandEncoder.copyTextureToBuffer(
    { texture: inputTexture },
    { buffer: testTextureBuffer, bytesPerRow: testBytesPerRow },
    { width: 2, height: 1 }
  );
  device.queue.submit([testTextureCommandEncoder.finish()]);
  
  await testTextureBuffer.mapAsync(GPUMapMode.READ);
  const testTextureRawData = testTextureBuffer.getMappedRange();
  const testTextureData = new Uint8Array(testTextureRawData.slice(0));
  testTextureBuffer.unmap();
  
  console.log('输入纹理前8个字节:', testTextureData);
  
  // 验证透射率缓冲区数据
  const testTransmissionBuffer = device.createBuffer({
    size: 32, // 读取前8个f32值
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  const testTransmissionCommandEncoder = device.createCommandEncoder();
  testTransmissionCommandEncoder.copyBufferToBuffer(transmissionBuffer, 0, testTransmissionBuffer, 0, 32);
  device.queue.submit([testTransmissionCommandEncoder.finish()]);
  
  await testTransmissionBuffer.mapAsync(GPUMapMode.READ);
  const testTransmissionRawData = testTransmissionBuffer.getMappedRange();
  const testTransmissionData = new Float32Array(testTransmissionRawData.slice(0));
  testTransmissionBuffer.unmap();
  
  console.log('透射率缓冲区前8个f32值:', testTransmissionData);
  
  const shader = createRecoverImageShader(device);
  const outputBuffer = device.createBuffer({
    size: width * height * 4 * 4, // 每个像素4个f32值，每个f32是4字节
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  
  console.log(`创建输出缓冲区: ${outputBuffer.size} 字节`);
  
  // 初始化输出缓冲区为0
  const initData = new Float32Array(width * height * 4);
  device.queue.writeBuffer(outputBuffer, 0, initData);
  
  const uniformBuffer = device.createBuffer({
    size: 16, // 4 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  // 修复uniform数据格式：全部使用f32
  const uniformData = new Float32Array([width, height, atmosphericLight, t0]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  console.log('Uniform数据:', uniformData);
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'recoverImage' }
  });
  
  // 使用pipeline的getBindGroupLayout来创建兼容的BindGroup
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: inputTexture.createView() },
      { binding: 2, resource: { buffer: transmissionBuffer } },
      { binding: 3, resource: { buffer: outputBuffer } }
    ]
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  
  const workgroupX = Math.ceil(width / 8);
  const workgroupY = Math.ceil(height / 8);
  console.log(`调度工作组: ${workgroupX}x${workgroupY}`);
  
  computePass.dispatchWorkgroups(workgroupX, workgroupY);
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  console.log('GPU计算完成，检查输出缓冲区...');
  
  // 验证输出缓冲区是否被写入
  const testBuffer = device.createBuffer({
    size: 32, // 读取前8个f32值（2个像素）
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  
  const testCommandEncoder = device.createCommandEncoder();
  testCommandEncoder.copyBufferToBuffer(outputBuffer, 0, testBuffer, 0, 32);
  device.queue.submit([testCommandEncoder.finish()]);
  
  await testBuffer.mapAsync(GPUMapMode.READ);
  const testRawData = testBuffer.getMappedRange();
  const testData = new Float32Array(testRawData.slice(0)); // 创建副本避免detached
  testBuffer.unmap();
  
  console.log('前8个f32值:', testData);
  console.log('第一个像素RGBA:', testData.slice(0, 4));
  
  return outputBuffer;
};

/**
 * 简化版WebGPU主去雾函数
 * @param {ImageData} imageData - 输入图像数据
 * @param {Object} options - 算法参数
 * @param {number} options.windowSize - 暗通道窗口大小，默认为15
 * @param {number} options.topRatio - 大气光估计比例，默认为0.1
 * @param {number} options.omega - 去雾强度，默认为0.95
 * @param {number} options.t0 - 最小透射率阈值，默认为0.1
 * @returns {Promise<ImageData>} 去雾后的图像数据
 */
export const dehazeImageWebGPUSimple = async (imageData, options = {}) => {
  const {
    windowSize = 15,
    topRatio = 0.1,
    omega = 0.95,
    t0 = 0.1
  } = options;
  
  // 验证输入数据
  if (!imageData || !imageData.data || imageData.data.length === 0) {
    throw new Error('输入图像数据无效');
  }
  
  const { width, height } = imageData;
  console.log(`处理图像: ${width}x${height}, 数据长度: ${imageData.data.length}`);
  
  // 获取WebGPU设备
  const adapter = await getWebGPUAdapter();
  const device = await initializeWebGPUDevice(adapter);
  
  try {
    // 步骤1: 将ImageData转换为纹理
    const inputTexture = await imageDataToTexture(device, imageData);
    console.log('输入纹理创建成功');
    
    // 步骤2: 计算暗通道
    const darkChannelBuffer = await computeDarkChannelGPU(device, inputTexture, width, height, windowSize);
    console.log('暗通道计算完成');
    
    // 验证暗通道计算结果
    const testDarkBuffer = device.createBuffer({
      size: 32, // 读取前8个f32值
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    const testDarkCommandEncoder = device.createCommandEncoder();
    testDarkCommandEncoder.copyBufferToBuffer(darkChannelBuffer, 0, testDarkBuffer, 0, 32);
    device.queue.submit([testDarkCommandEncoder.finish()]);
    
    await testDarkBuffer.mapAsync(GPUMapMode.READ);
    const testDarkRawData = testDarkBuffer.getMappedRange();
    const testDarkData = new Float32Array(testDarkRawData.slice(0));
    testDarkBuffer.unmap();
    
    console.log('暗通道缓冲区前8个f32值:', testDarkData);
    
    // 步骤3: 估计大气光 (使用CPU版本简化)
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
    
    console.log('暗通道转换后的前8个u8值:', darkChannelUint8.slice(0, 8));
    
    const atmosphericLight = estimateAtmosphericLight(imageData, darkChannelUint8, topRatio);
    console.log(`大气光估计完成: ${atmosphericLight}`);
    
    // 步骤4: 估计透射率图
    const transmissionBuffer = await estimateTransmissionGPU(device, darkChannelBuffer, atmosphericLight, width, height, omega);
    console.log('透射率估计完成');
    
    // 步骤5: 恢复无雾图像
    console.log('开始图像恢复...');
    const outputBuffer = await recoverImageGPU(device, inputTexture, transmissionBuffer, atmosphericLight, width, height, t0);
    console.log('图像恢复完成，输出缓冲区大小:', outputBuffer.size, '预期大小:', width * height * 4 * 4);
    
    // 步骤6: 将缓冲区转换为ImageData
    console.log('开始转换缓冲区到ImageData...');
    const result = await bufferToImageData(device, outputBuffer, width, height);
    console.log('缓冲区转换完成，结果数据长度:', result.data.length);
    
    return result;
  } catch (error) {
    console.error('WebGPU处理过程中出错:', error);
    throw error;
  }
};

/**
 * 批量处理多张图像 (简化版WebGPU版本)
 * @param {ImageData[]} imageDataArray - 图像数据数组
 * @param {Object} options - 算法参数
 * @returns {Promise<ImageData[]>} 去雾后的图像数据数组
 */
export const batchDehazeWebGPUSimple = async (imageDataArray, options = {}) => {
  const results = [];
  for (const imageData of imageDataArray) {
    const result = await dehazeImageWebGPUSimple(imageData, options);
    results.push(result);
  }
  return results;
}; 