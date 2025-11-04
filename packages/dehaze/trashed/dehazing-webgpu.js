/**
 * WebGPU版本的图像去雾算法实现
 * 基于暗通道先验(Dark Channel Prior)的高性能去雾算法
 * 使用WebGPU进行GPU加速计算
 * @author 织
 */

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
 * 创建计算暗通道的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createDarkChannelShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: u32,
        height: u32,
        windowSize: u32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var outputBuffer: storage, read_write;
      
      @compute @workgroup_size(8, 8)
      fn computeDarkChannel(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= uniforms.width || y >= uniforms.height) {
          return;
        }
        
        let halfWindow = uniforms.windowSize / 2u;
        var minValue: f32 = 1.0;
        
        for (var wy = max(0u, y - halfWindow); wy <= min(uniforms.height - 1u, y + halfWindow); wy++) {
          for (var wx = max(0u, x - halfWindow); wx <= min(uniforms.width - 1u, x + halfWindow); wx++) {
            let pixel = textureLoad(inputTexture, vec2<i32>(i32(wx), i32(wy)));
            let minChannel = min(min(pixel.r, pixel.g), pixel.b);
            minValue = min(minValue, minChannel);
          }
        }
        
        let outputIndex = y * uniforms.width + x;
        outputBuffer[outputIndex] = minValue;
      }
    `
  });
};

/**
 * 创建估计大气光的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createAtmosphericLightShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: u32,
        height: u32,
        topRatio: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var darkChannelBuffer: storage, read;
      @group(0) @binding(2) var inputTexture: texture_2d<f32>;
      @group(0) @binding(3) var atmosphericLightBuffer: storage, read_write;
      
      @compute @workgroup_size(256)
      fn estimateAtmosphericLight(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let pixelIndex = globalId.x;
        let totalPixels = uniforms.width * uniforms.height;
        
        if (pixelIndex >= totalPixels) {
          return;
        }
        
        let darkValue = darkChannelBuffer[pixelIndex];
        let pixel = textureLoad(inputTexture, vec2<i32>(i32(pixelIndex % uniforms.width), i32(pixelIndex / uniforms.width)));
        let intensity = max(max(pixel.r, pixel.g), pixel.b);
        
        // 使用原子操作找到最大值
        atomicMax(&atmosphericLightBuffer[0], bitcast<u32>(intensity));
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
        width: u32,
        height: u32,
        atmosphericLight: f32,
        omega: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var darkChannelBuffer: storage, read;
      @group(0) @binding(2) var transmissionBuffer: storage, read_write;
      
      @compute @workgroup_size(256)
      fn estimateTransmission(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let pixelIndex = globalId.x;
        let totalPixels = uniforms.width * uniforms.height;
        
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
 * 创建引导滤波的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createGuidedFilterShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: u32,
        height: u32,
        radius: u32,
        epsilon: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var transmissionBuffer: storage, read;
      @group(0) @binding(2) var guideTexture: texture_2d<f32>;
      @group(0) @binding(3) var refinedBuffer: storage, read_write;
      
      fn getGrayValue(pos: vec2<i32>) -> f32 {
        let pixel = textureLoad(guideTexture, pos);
        return pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114;
      }
      
      @compute @workgroup_size(8, 8)
      fn guidedFilter(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= uniforms.width || y >= uniforms.height) {
          return;
        }
        
        let pos = vec2<i32>(i32(x), i32(y));
        let transmission = transmissionBuffer[y * uniforms.width + x];
        let guide = getGrayValue(pos);
        
        var sumGuide: f32 = 0.0;
        var sumTransmission: f32 = 0.0;
        var sumGuideTransmission: f32 = 0.0;
        var sumGuideSquared: f32 = 0.0;
        var count: f32 = 0.0;
        
        for (var dy = -i32(uniforms.radius); dy <= i32(uniforms.radius); dy++) {
          for (var dx = -i32(uniforms.radius); dx <= i32(uniforms.radius); dx++) {
            let nx = pos.x + dx;
            let ny = pos.y + dy;
            
            if (nx >= 0 && nx < i32(uniforms.width) && ny >= 0 && ny < i32(uniforms.height)) {
              let nPos = vec2<i32>(nx, ny);
              let nGuide = getGrayValue(nPos);
              let nTransmission = transmissionBuffer[ny * uniforms.width + nx];
              
              sumGuide += nGuide;
              sumTransmission += nTransmission;
              sumGuideTransmission += nGuide * nTransmission;
              sumGuideSquared += nGuide * nGuide;
              count += 1.0;
            }
          }
        }
        
        let meanGuide = sumGuide / count;
        let meanTransmission = sumTransmission / count;
        let meanGuideTransmission = sumGuideTransmission / count;
        let meanGuideSquared = sumGuideSquared / count;
        
        let varGuide = meanGuideSquared - meanGuide * meanGuide;
        let covGuideTransmission = meanGuideTransmission - meanGuide * meanTransmission;
        
        let A = covGuideTransmission / (varGuide + uniforms.epsilon);
        let B = meanTransmission - A * meanGuide;
        
        let refined = A * guide + B;
        refinedBuffer[y * uniforms.width + x] = refined;
      }
    `
  });
};

/**
 * 创建图像恢复的着色器模块
 * @param {GPUDevice} device - WebGPU设备
 * @returns {GPUShaderModule} 着色器模块
 */
const createRecoverImageShader = (device) => {
  return device.createShaderModule({
    code: `
      struct Uniforms {
        width: u32,
        height: u32,
        atmosphericLight: f32,
        t0: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;
      @group(0) @binding(2) var transmissionBuffer: storage, read;
      @group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;
      
      @compute @workgroup_size(8, 8)
      fn recoverImage(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let x = globalId.x;
        let y = globalId.y;
        
        if (x >= uniforms.width || y >= uniforms.height) {
          return;
        }
        
        let pos = vec2<i32>(i32(x), i32(y));
        let pixel = textureLoad(inputTexture, pos);
        let transmission = max(transmissionBuffer[y * uniforms.width + x], uniforms.t0);
        
        let r = (pixel.r - uniforms.atmosphericLight) / transmission + uniforms.atmosphericLight;
        let g = (pixel.g - uniforms.atmosphericLight) / transmission + uniforms.atmosphericLight;
        let b = (pixel.b - uniforms.atmosphericLight) / transmission + uniforms.atmosphericLight;
        
        let outputPixel = vec4<f32>(
          clamp(r, 0.0, 1.0),
          clamp(g, 0.0, 1.0),
          clamp(b, 0.0, 1.0),
          pixel.a
        );
        
        textureStore(outputTexture, pos, outputPixel);
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
const createBuffer = (device, size, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) => {
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
const imageDataToTexture = (device, imageData) => {
  const texture = createTexture(device, imageData.width, imageData.height);
  device.queue.writeTexture(
    { texture },
    imageData.data,
    { bytesPerRow: imageData.width * 4 },
    { width: imageData.width, height: imageData.height }
  );
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
  const data = new Uint8ClampedArray(buffer.getMappedRange());
  buffer.unmap();
  
  return new ImageData(data, width, height);
};

/**
 * 计算暗通道 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} windowSize - 窗口大小
 * @returns {GPUBuffer} 暗通道缓冲区
 */
const computeDarkChannelGPU = (device, inputTexture, width, height, windowSize = 15) => {
  const shader = createDarkChannelShader(device);
  const outputBuffer = createBuffer(device, width * height * 4);
  
  const uniformBuffer = device.createBuffer({
    size: 12, // 3 * u32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Uint32Array([width, height, windowSize]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const bindGroup = device.createBindGroup({
    layout: device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    }),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: inputTexture.createView() },
      { binding: 2, resource: { buffer: outputBuffer } }
    ]
  });
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'computeDarkChannel' }
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  return outputBuffer;
};

/**
 * 估计大气光 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUTexture} inputTexture - 输入纹理
 * @param {GPUBuffer} darkChannelBuffer - 暗通道缓冲区
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} topRatio - 取前topRatio%的像素
 * @returns {Promise<number>} 估计的大气光值
 */
const estimateAtmosphericLightGPU = async (device, inputTexture, darkChannelBuffer, width, height, topRatio = 0.1) => {
  const shader = createAtmosphericLightShader(device);
  const atmosphericLightBuffer = createBuffer(device, 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
  
  const uniformBuffer = device.createBuffer({
    size: 12, // 2 * u32 + 1 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([width, height, topRatio]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const bindGroup = device.createBindGroup({
    layout: device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    }),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: darkChannelBuffer } },
      { binding: 2, resource: inputTexture.createView() },
      { binding: 3, resource: { buffer: atmosphericLightBuffer } }
    ]
  });
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'estimateAtmosphericLight' }
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width * height / 256));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  await atmosphericLightBuffer.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(atmosphericLightBuffer.getMappedRange());
  atmosphericLightBuffer.unmap();
  
  return data[0];
};

/**
 * 估计透射率图 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUBuffer} darkChannelBuffer - 暗通道缓冲区
 * @param {number} atmosphericLight - 大气光值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} omega - 去雾强度参数
 * @returns {GPUBuffer} 透射率缓冲区
 */
const estimateTransmissionGPU = (device, darkChannelBuffer, atmosphericLight, width, height, omega = 0.95) => {
  const shader = createTransmissionShader(device);
  const transmissionBuffer = createBuffer(device, width * height * 4);
  
  const uniformBuffer = device.createBuffer({
    size: 16, // 2 * u32 + 2 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([width, height, atmosphericLight, omega]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const bindGroup = device.createBindGroup({
    layout: device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    }),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: darkChannelBuffer } },
      { binding: 2, resource: { buffer: transmissionBuffer } }
    ]
  });
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'estimateTransmission' }
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width * height / 256));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  return transmissionBuffer;
};

/**
 * 引导滤波优化透射率图 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUBuffer} transmissionBuffer - 透射率缓冲区
 * @param {GPUTexture} guideTexture - 引导纹理
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} radius - 滤波半径
 * @param {number} epsilon - 正则化参数
 * @returns {GPUBuffer} 优化后的透射率缓冲区
 */
const guidedFilterGPU = (device, transmissionBuffer, guideTexture, width, height, radius = 60, epsilon = 0.0001) => {
  const shader = createGuidedFilterShader(device);
  const refinedBuffer = createBuffer(device, width * height * 4);
  
  const uniformBuffer = device.createBuffer({
    size: 16, // 2 * u32 + 1 * u32 + 1 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([width, height, radius, epsilon]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const bindGroup = device.createBindGroup({
    layout: device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    }),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: transmissionBuffer } },
      { binding: 2, resource: guideTexture.createView() },
      { binding: 3, resource: { buffer: refinedBuffer } }
    ]
  });
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'guidedFilter' }
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  return refinedBuffer;
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
 * @returns {GPUTexture} 去雾后的纹理
 */
const recoverImageGPU = (device, inputTexture, transmissionBuffer, atmosphericLight, width, height, t0 = 0.1) => {
  const shader = createRecoverImageShader(device);
  const outputTexture = createTexture(device, width, height, 'rgba8unorm', GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);
  
  const uniformBuffer = device.createBuffer({
    size: 16, // 2 * u32 + 2 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([width, height, atmosphericLight, t0]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const bindGroup = device.createBindGroup({
    layout: device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } }
      ]
    }),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: inputTexture.createView() },
      { binding: 2, resource: { buffer: transmissionBuffer } },
      { binding: 3, resource: outputTexture.createView() }
    ]
  });
  
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shader, entryPoint: 'recoverImage' }
  });
  
  const commandEncoder = device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  return outputTexture;
};

/**
 * WebGPU主去雾函数
 * @param {ImageData} imageData - 输入图像数据
 * @param {Object} options - 算法参数
 * @param {number} options.windowSize - 暗通道窗口大小，默认为15
 * @param {number} options.topRatio - 大气光估计比例，默认为0.1
 * @param {number} options.omega - 去雾强度，默认为0.95
 * @param {number} options.guideRadius - 引导滤波半径，默认为60
 * @param {number} options.guideEpsilon - 引导滤波正则化参数，默认为0.0001
 * @param {number} options.t0 - 最小透射率阈值，默认为0.1
 * @returns {Promise<ImageData>} 去雾后的图像数据
 */
export const dehazeImageWebGPU = async (imageData, options = {}) => {
  const {
    windowSize = 15,
    topRatio = 0.1,
    omega = 0.95,
    guideRadius = 60,
    guideEpsilon = 0.0001,
    t0 = 0.1
  } = options;
  
  // 获取WebGPU设备
  const adapter = await getWebGPUAdapter();
  const device = await initializeWebGPUDevice(adapter);
  
  const { width, height } = imageData;
  
  // 步骤1: 将ImageData转换为纹理
  const inputTexture = imageDataToTexture(device, imageData);
  
  // 步骤2: 计算暗通道
  const darkChannelBuffer = computeDarkChannelGPU(device, inputTexture, width, height, windowSize);
  
  // 步骤3: 估计大气光
  const atmosphericLight = await estimateAtmosphericLightGPU(device, inputTexture, darkChannelBuffer, width, height, topRatio);
  
  // 步骤4: 估计透射率图
  const transmissionBuffer = estimateTransmissionGPU(device, darkChannelBuffer, atmosphericLight, width, height, omega);
  
  // 步骤5: 引导滤波优化透射率图
  const refinedTransmissionBuffer = guidedFilterGPU(device, transmissionBuffer, inputTexture, width, height, guideRadius, guideEpsilon);
  
  // 步骤6: 恢复无雾图像
  const outputTexture = recoverImageGPU(device, inputTexture, refinedTransmissionBuffer, atmosphericLight, width, height, t0);
  
  // 步骤7: 将纹理转换回ImageData
  const result = await textureToImageData(device, outputTexture, width, height);
  
  return result;
};

/**
 * 批量处理多张图像 (WebGPU版本)
 * @param {ImageData[]} imageDataArray - 图像数据数组
 * @param {Object} options - 算法参数
 * @returns {Promise<ImageData[]>} 去雾后的图像数据数组
 */
export const batchDehazeWebGPU = async (imageDataArray, options = {}) => {
  const results = [];
  for (const imageData of imageDataArray) {
    const result = await dehazeImageWebGPU(imageData, options);
    results.push(result);
  }
  return results;
}; 