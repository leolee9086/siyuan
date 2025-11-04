/**
 * GPU工具模块
 * 包含纹理和缓冲区的创建工具函数
 * @author 织
 */

/**
 * 创建纹理
 * @param {GPUDevice} device - WebGPU设备
 * @param {number} width - 纹理宽度
 * @param {number} height - 纹理高度
 * @param {string} format - 纹理格式
 * @param {string} usage - 使用方式
 * @returns {GPUTexture} 纹理对象
 */
export const createTexture = (device, width, height, format = 'rgba8unorm', usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT) => {
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
 * @param {string} label - 缓冲区标签
 * @param {string} usage - 使用方式
 * @returns {GPUBuffer} 缓冲区对象
 */
export const createBuffer = (device, size, label = '', usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC) => {
  return device.createBuffer({
    label,
    size,
    usage
  });
};

/**
 * 根据GPU特性和计算类型选择最优工作组大小
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} computeType - 计算类型: 'memory', 'compute', 'balanced'
 * @param {number} imageWidth - 图像宽度
 * @param {number} imageHeight - 图像高度
 * @returns {Object} 最优工作组大小配置
 */
export const getOptimalWorkgroupSize = async (device, computeType, imageWidth, imageHeight) => {
  // 获取GPU适配器信息
  const adapter = await navigator.gpu.requestAdapter();
  const adapterInfo = await adapter.requestAdapterInfo();
  
  // 根据GPU架构选择工作组大小
  const gpuArchitecture = adapterInfo.architecture || 'unknown';
  
  // 基础工作组大小配置
  const baseConfigs = {
    // 内存密集型 (大量纹理采样)
    memory: {
      'gcn': { x: 16, y: 8, z: 1 },    // AMD GCN架构
      'rdna': { x: 16, y: 8, z: 1 },   // AMD RDNA架构
      'ampere': { x: 16, y: 8, z: 1 }, // NVIDIA Ampere
      'turing': { x: 16, y: 8, z: 1 }, // NVIDIA Turing
      'pascal': { x: 16, y: 8, z: 1 }, // NVIDIA Pascal
      'maxwell': { x: 16, y: 8, z: 1 }, // NVIDIA Maxwell
      'kepler': { x: 16, y: 8, z: 1 }, // NVIDIA Kepler
      'fermi': { x: 16, y: 8, z: 1 },  // NVIDIA Fermi
      'unknown': { x: 16, y: 8, z: 1 } // 默认配置
    },
    
    // 计算密集型 (大量数学运算)
    compute: {
      'gcn': { x: 256, y: 1, z: 1 },
      'rdna': { x: 256, y: 1, z: 1 },
      'ampere': { x: 512, y: 1, z: 1 },
      'turing': { x: 256, y: 1, z: 1 },
      'pascal': { x: 256, y: 1, z: 1 },
      'maxwell': { x: 256, y: 1, z: 1 },
      'kepler': { x: 256, y: 1, z: 1 },
      'fermi': { x: 256, y: 1, z: 1 },
      'unknown': { x: 256, y: 1, z: 1 }
    },
    
    // 平衡型 (计算和内存访问平衡)
    balanced: {
      'gcn': { x: 16, y: 8, z: 1 },
      'rdna': { x: 16, y: 8, z: 1 },
      'ampere': { x: 16, y: 8, z: 1 },
      'turing': { x: 16, y: 8, z: 1 },
      'pascal': { x: 16, y: 8, z: 1 },
      'maxwell': { x: 16, y: 8, z: 1 },
      'kepler': { x: 16, y: 8, z: 1 },
      'fermi': { x: 16, y: 8, z: 1 },
      'unknown': { x: 16, y: 8, z: 1 }
    }
  };
  
  // 获取基础配置
  const baseConfig = baseConfigs[computeType][gpuArchitecture] || baseConfigs[computeType]['unknown'];
  
  // 根据图像尺寸调整
  const imageSize = imageWidth * imageHeight;
  let adjustedConfig = { ...baseConfig };
  
  // 小图像优化
  if (imageSize < 1024 * 1024) { // 小于1MP
    if (computeType === 'memory') {
      adjustedConfig = { x: 8, y: 8, z: 1 }; // 减少工作组大小
    } else if (computeType === 'compute') {
      adjustedConfig = { x: 128, y: 1, z: 1 }; // 减少工作组大小
    }
  }
  
  // 大图像优化
  if (imageSize > 4096 * 4096) { // 大于16MP
    if (computeType === 'memory') {
      adjustedConfig = { x: 32, y: 8, z: 1 }; // 增加工作组大小
    } else if (computeType === 'compute') {
      adjustedConfig = { x: 512, y: 1, z: 1 }; // 增加工作组大小
    }
  }
  
  // 计算调度参数
  const dispatchX = Math.ceil(imageWidth / adjustedConfig.x);
  const dispatchY = Math.ceil(imageHeight / adjustedConfig.y);
  const dispatchZ = adjustedConfig.z;
  
  return {
    workgroupSize: adjustedConfig,
    dispatchSize: { x: dispatchX, y: dispatchY, z: dispatchZ },
    totalThreads: adjustedConfig.x * adjustedConfig.y * adjustedConfig.z,
    gpuArchitecture,
    computeType
  };
};

/**
 * 创建优化的计算管线
 * @param {GPUDevice} device - WebGPU设备
 * @param {string} computeType - 计算类型
 * @param {number} imageWidth - 图像宽度
 * @param {number} imageHeight - 图像高度
 * @param {Function} shaderCreator - 着色器创建函数
 * @returns {Promise<Object>} 优化的管线配置
 */
export const createOptimizedComputePipeline = async (device, computeType, imageWidth, imageHeight, shaderCreator) => {
  const workgroupConfig = await getOptimalWorkgroupSize(device, computeType, imageWidth, imageHeight);
  
  // 创建着色器模块
  const shaderModule = shaderCreator(device, workgroupConfig.workgroupSize);
  
  // 创建计算管线
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shaderModule,
      entryPoint: 'main'
    }
  });
  
  return {
    pipeline,
    workgroupConfig,
    shaderModule
  };
}; 