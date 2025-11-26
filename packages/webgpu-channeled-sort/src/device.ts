// WebGPU 设备和适配器全局缓存
const WEBGPU缓存键 = Symbol.for('webgpu_cache');

/**
 * 初始化 WebGPU 并返回一个 GPUDevice 实例。
 * 该函数采用单例模式，确保只初始化一次设备。
 * @returns {Promise<GPUDevice>} GPUDevice 实例
 * @throws {Error} 如果 WebGPU 不受支持或无法获取适配器/设备
 */
export const 获取WebGPU设备 = async (): Promise<GPUDevice> => {
  // 初始化全局缓存
  const 全局缓存 = window as unknown as Record<symbol, { 设备: GPUDevice | null; 适配器: GPUAdapter | null }>;
  
  if (!全局缓存[WEBGPU缓存键]) {
    全局缓存[WEBGPU缓存键] = {
      设备: null,
      适配器: null
    };
  }

  const 缓存 = 全局缓存[WEBGPU缓存键];
  
  if (缓存.设备) {
    return 缓存.设备;
  }

  if (!navigator.gpu) {
    throw new Error('WebGPU 不受支持');
  }

  缓存.适配器 = await navigator.gpu.requestAdapter();
  if (!缓存.适配器) {
    throw new Error('无法获取 WebGPU 适配器');
  }

  缓存.设备 = await 缓存.适配器.requestDevice();
  if (!缓存.设备) {
    throw new Error('无法获取 WebGPU 设备');
  }

  return 缓存.设备;
};

// 导出英文接口兼容
export const getWebGPUDevice = 获取WebGPU设备;