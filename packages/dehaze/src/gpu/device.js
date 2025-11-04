/**
 * WebGPU设备管理模块
 * 负责WebGPU适配器和设备的初始化
 * 实现设备复用机制以提高性能
 * @author 织
 */

// 全局设备缓存
let cachedAdapter = null;
let cachedDevice = null;
let deviceInitializationPromise = null;

/**
 * 预初始化WebGPU设备（在模块加载时调用）
 * @returns {Promise<GPUDevice>} 初始化完成的设备
 */
export const preInitializeDevice = async () => {
  if (deviceInitializationPromise) {
    return deviceInitializationPromise;
  }
  
  deviceInitializationPromise = (async () => {
    try {
      // 直接实现设备初始化逻辑，避免循环调用
      if (!navigator.gpu) {
        throw new Error('WebGPU不可用');
      }
      
      // 获取适配器
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        throw new Error('无法获取WebGPU适配器');
      }
      
      cachedAdapter = adapter;
      
      // 创建设备
      const device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {
          maxStorageBufferBindingSize: 1024 * 1024 * 1024, // 1GB
          maxBufferSize: 1024 * 1024 * 1024, // 1GB
        }
      });
      
      cachedDevice = device;
      console.log('WebGPU设备预初始化完成');
      return device;
    } catch (error) {
      console.warn('WebGPU设备预初始化失败:', error);
      // 清除Promise，允许重试
      deviceInitializationPromise = null;
      throw error;
    }
  })();
  
  return deviceInitializationPromise;
};

/**
 * 获取WebGPU适配器（带缓存）
 * @returns {Promise<GPUAdapter>} GPU适配器
 */
export const getWebGPUAdapter = async () => {
  if (cachedAdapter) {
    return cachedAdapter;
  }
  
  if (!navigator.gpu) {
    throw new Error('WebGPU不可用');
  }
  
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  });
  
  if (!adapter) {
    throw new Error('无法获取WebGPU适配器');
  }
  
  cachedAdapter = adapter;
  return adapter;
};

/**
 * 初始化WebGPU设备（带缓存）
 * @param {GPUAdapter} adapter - GPU适配器
 * @returns {Promise<GPUDevice>} WebGPU设备
 */
export const initializeWebGPUDevice = async (adapter) => {
  // 如果已经有缓存的设备，直接返回
  if (cachedDevice) {
    return cachedDevice;
  }
  
  // 如果正在初始化，等待初始化完成
  if (deviceInitializationPromise) {
    return deviceInitializationPromise;
  }
  
  // 开始初始化
  deviceInitializationPromise = (async () => {
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
    
    cachedDevice = device;
    return device;
  })();
  
  return deviceInitializationPromise;
};

/**
 * 获取缓存的WebGPU设备（如果已初始化）
 * @returns {GPUDevice|null} 缓存的设备，如果未初始化则返回null
 */
export const getCachedDevice = () => {
  return cachedDevice;
};

/**
 * 清除设备缓存（用于调试或重置）
 */
export const clearDeviceCache = () => {
  cachedAdapter = null;
  cachedDevice = null;
  deviceInitializationPromise = null;
};

/**
 * 检查设备是否已初始化
 * @returns {boolean} 设备是否已初始化
 */
export const isDeviceInitialized = () => {
  return cachedDevice !== null;
};

// 模块加载时自动预初始化设备
preInitializeDevice().catch(error => {
  console.warn('WebGPU设备预初始化失败，将在首次使用时重试:', error);
}); 