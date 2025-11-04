/**
 * 去雾算法核心模块
 * 包含所有去雾相关的计算函数
 * @author 织
 */

import { createTransmissionShader, createSpatialAdaptiveTransmissionShader } from './gpu/shaders.js';
import { createBuffer } from './gpu/utils.js';


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
export const estimateTransmissionGPU = async (device, darkChannelBuffer, atmosphericLight, width, height, omega = 0.95) => {
  const shader = createTransmissionShader(device);
  // 透射率每个像素只需要一个f32值
  const transmissionBuffer = createBuffer(device, width * height * 4, 'TransmissionBuffer'); // 4 bytes per f32
  
  const uniformBuffer = device.createBuffer({
    size: 16, // 4 * f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  // 修复uniform数据格式：全部使用f32
  const uniformData = new Float32Array([width, height, atmosphericLight, omega]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const pipeline = device.createComputePipeline({
    label: 'TransmissionPipeline',
    layout: 'auto',
    compute: { module: shader, entryPoint: 'estimateTransmission' }
  });
  
  // 使用pipeline的getBindGroupLayout来创建兼容的BindGroup
  const bindGroup = device.createBindGroup({
    label: 'TransmissionBindGroup',
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
  computePass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  return transmissionBuffer;
};

/**
 * 空间自适应透射率估计 (WebGPU版本)
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUBuffer} darkChannelBuffer - 暗通道缓冲区
 * @param {number} atmosphericLight - 大气光值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {Object} adaptiveOptions - 自适应参数选项
 * @returns {Promise<GPUBuffer>} 透射率缓冲区
 */
export const estimateSpatialAdaptiveTransmissionGPU = async (device, darkChannelBuffer, atmosphericLight, width, height, userOmega, userT0, adaptiveOptions = {}) => {
  const {
    omegaAdjustRange = 0.2,
    t0AdjustRange = 0.05,
    hazeWeight = 0.6,
    atmosphericWeight = 0.4,
    adaptiveStrength = 1.0
  } = adaptiveOptions;
  
  const shader = createSpatialAdaptiveTransmissionShader(device);
  // 透射率每个像素只需要一个f32值
  const transmissionBuffer = createBuffer(device, width * height * 4, 'SpatialAdaptiveTransmissionBuffer'); // 4 bytes per f32
  
  const uniformBuffer = device.createBuffer({
    label: 'SpatialAdaptiveTransmissionUniformBuffer',
    size: 44, // 11 * f32 (10个值 + 1个填充，确保16字节对齐)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  const uniformData = new Float32Array([
    width, height, atmosphericLight, userOmega, 
    userT0, omegaAdjustRange, t0AdjustRange, hazeWeight, atmosphericWeight, adaptiveStrength, 0.0 // 填充值
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  
  const pipeline = device.createComputePipeline({
    label: 'SpatialAdaptiveTransmissionPipeline',
    layout: 'auto',
    compute: { module: shader, entryPoint: 'estimateSpatialAdaptiveTransmission' }
  });
  
  const bindGroup = device.createBindGroup({
    label: 'SpatialAdaptiveTransmissionBindGroup',
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
  computePass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 8));
  computePass.end();
  
  device.queue.submit([commandEncoder.finish()]);
  
  // 确保计算完成
  await device.queue.onSubmittedWorkDone();
  
  return transmissionBuffer;
};



 