
export type 像素投影 = {
  value: number;
  pixelOffset: number;
};
type RGBOffsets = Uint32Array<ArrayBufferLike>

export type 投影结果 = RGBOffsets

/**
 * 创建并映射一个 GPU 缓冲区。
 * @param 设备 - GPUDevice 实例
 * @param data - 用于填充缓冲区的数据
 * @param usage - 缓冲区的用途标志
 * @param label - 缓冲区的标签（可选）
 * @returns 创建的 GPUBuffer
 */
export const 创建并映射缓冲区 = (设备: GPUDevice, data: Float32Array, usage: GPUBufferUsageFlags, label?: string): GPUBuffer => {
  if (!data || data.length === 0) {
    throw new Error('创建缓冲区失败: 输入数据为空或长度为0');
  }
  const buffer = 设备.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
    label,
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
};

/**
 * 创建并映射一个 GPU 缓冲区用于存储像素投影结果。
 * @param 设备 - GPUDevice 实例
 * @param length - 数据长度
 * @param label - 缓冲区的标签（可选）
 * @returns 创建的 GPUBuffer
 */
export const 创建投影结果缓冲区 = (设备: GPUDevice, length: number, label?: string): GPUBuffer => {
  // 每个像素投影包含 value(f32), pixelOffset(u32)，共 8 字节
  const bufferSize = length * 8;
  return 设备.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    label,
  });
};

/**
 * 从 GPU 缓冲区读取像素投影数据。
 * @param 设备 - GPUDevice 实例
 * @param buffer - GPUBuffer 实例
 * @param length - 数据长度
 * @returns 像素投影数组
 */
export const 读取投影数据 = async (设备: GPUDevice, buffer: GPUBuffer, length: number): Promise<像素投影[]> => {
  const bufferSize = length * 8;
  const readBuffer = 设备.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    label: "像素投影数据读取缓冲区"
  });

  const commandEncoder = 设备.createCommandEncoder({
    label: "像素投影数据读取命令编码器"
  });
  commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, bufferSize);
  设备.queue.submit([commandEncoder.finish()]);
  await 设备.queue.onSubmittedWorkDone();

  await readBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = readBuffer.getMappedRange();
  
  // 创建数据副本以避免内存问题
  const dataCopy = new Uint8Array(arrayBuffer.slice(0));
  readBuffer.unmap();

  // 解析数据
  const result: 像素投影[] = [];
  const dataView = new DataView(dataCopy.buffer);
  
  for (let i = 0; i < length; i++) {
    const offset = i * 8;
    const value = dataView.getFloat32(offset, true);
    const pixelOffset = dataView.getUint32(offset + 4, true);
    result.push({ value, pixelOffset });
  }

  return result;
};

/**
 * 直接从GPU缓冲区读取数据并格式化为适合排序函数的输入格式
 * @param 设备 - GPUDevice 实例
 * @param bufferR - R通道投影结果缓冲区
 * @param bufferG - G通道投影结果缓冲区
 * @param bufferB - B通道投影结果缓冲区
 * @param length - 数据长度
 * @returns 格式化后的数据 { Rvalues, Gvalues, Bvalues, pixelOffsets }
 */
export const 直接读取并格式化投影数据 = async (
  设备: GPUDevice,
  bufferR: GPUBuffer,
  bufferG: GPUBuffer,
  bufferB: GPUBuffer,
  length: number
): Promise<{ Rvalues: Float32Array; Gvalues: Float32Array; Bvalues: Float32Array; pixelOffsets: Uint32Array }> => {
  const bufferSize = length * 8;
  const readBufferR = 设备.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    label: "R通道像素投影数据读取缓冲区"
  });
  const readBufferG = 设备.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    label: "G通道像素投影数据读取缓冲区"
  });
  const readBufferB = 设备.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    label: "B通道像素投影数据读取缓冲区"
  });

  const commandEncoder = 设备.createCommandEncoder({
    label: "像素投影数据读取命令编码器"
  });
  commandEncoder.copyBufferToBuffer(bufferR, 0, readBufferR, 0, bufferSize);
  commandEncoder.copyBufferToBuffer(bufferG, 0, readBufferG, 0, bufferSize);
  commandEncoder.copyBufferToBuffer(bufferB, 0, readBufferB, 0, bufferSize);
  设备.queue.submit([commandEncoder.finish()]);
  await 设备.queue.onSubmittedWorkDone();

  await Promise.all([
    readBufferR.mapAsync(GPUMapMode.READ),
    readBufferG.mapAsync(GPUMapMode.READ),
    readBufferB.mapAsync(GPUMapMode.READ)
  ]);

  const arrayBufferR = readBufferR.getMappedRange();
  const arrayBufferG = readBufferG.getMappedRange();
  const arrayBufferB = readBufferB.getMappedRange();

  // 创建数据副本以避免内存问题
  const dataCopyR = new Uint8Array(arrayBufferR.slice(0));
  const dataCopyG = new Uint8Array(arrayBufferG.slice(0));
  const dataCopyB = new Uint8Array(arrayBufferB.slice(0));

  readBufferR.unmap();
  readBufferG.unmap();
  readBufferB.unmap();

  // 解析数据
  const Rvalues = new Float32Array(length);
  const Gvalues = new Float32Array(length);
  const Bvalues = new Float32Array(length);
  const pixelOffsets = new Uint32Array(length);

  const dataViewR = new DataView(dataCopyR.buffer);
  const dataViewG = new DataView(dataCopyG.buffer);
  const dataViewB = new DataView(dataCopyB.buffer);

  for (let i = 0; i < length; i++) {
    const offset = i * 8;
    Rvalues[i] = dataViewR.getFloat32(offset, true);
    Gvalues[i] = dataViewG.getFloat32(offset, true);
    Bvalues[i] = dataViewB.getFloat32(offset, true);
    // 所有通道的像素偏移应该是相同的，这里取R通道的偏移
    pixelOffsets[i] = dataViewR.getUint32(offset + 4, true);
  }

  return { Rvalues, Gvalues, Bvalues, pixelOffsets };
};