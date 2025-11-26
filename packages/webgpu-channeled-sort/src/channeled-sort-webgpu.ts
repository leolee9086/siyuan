import channeledSortWGSL from './channeled-sort.wgsl';
import { 获取WebGPU设备 } from './device';
import type { 像素投影 } from './projectAndSortPixelsTypes';
import { 创建并映射缓冲区 } from './projectAndSortPixelsTypes';

const WORKGROUP_SIZE = 256;
const MAX_WORKGROUPS = 64;

/**
 * 检查是否为2的幂
 * @param n - 要检查的数字
 * @returns 是否为2的幂
 */
const 是否为2的幂 = (n: number): boolean => {
    return (n & (n - 1)) === 0;
};

/**
 * 计算大于等于n的最小2的幂
 * @param n - 输入数字
 * @returns 大于等于n的最小2的幂
 */
const 计算最小2的幂 = (n: number): number => {
    let power = 1;
    while (power < n) {
        power *= 2;
    }
    return power;
};

/**
 * 计算以2为底的对数
 * @param n - 输入数字
 * @returns 以2为底的对数
 */
const 计算以2为底的对数 = (n: number): number => {
    return Math.log2(n);
};

/**
 * 创建排序绑定组
 * @param 设备 - GPUDevice 实例
 * @param pipeline - 计算管线
 * @param buffers - 缓冲区对象
 * @returns 绑定组
 */
const 创建排序绑定组 = (
    设备: GPUDevice,
    pipeline: GPUComputePipeline,
    buffers: {
        data: GPUBuffer;
        params: GPUBuffer;
    }
): GPUBindGroup => {
    const entries = [
        { binding: 0, resource: { buffer: buffers.data } },
        { binding: 1, resource: { buffer: buffers.params } }
    ];
    
    return 设备.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries
    });
};

/**
 * 使用GPU对像素投影数据进行排序
 * @param data - 像素投影数据数组
 * @returns 排序后的像素投影数据数组
 */
export const 使用GPU排序 = async (data: 像素投影[]): Promise<像素投影[]> => {
    const 设备 = await 获取WebGPU设备();
    const originalElementCount = data.length;
    
    // 如果元素数量不是2的幂，填充到下一个2的幂
    let paddedElementCount = originalElementCount;
    let paddedData: 像素投影[] = data;
    let needsPadding = false;
    
    if (!是否为2的幂(originalElementCount)) {
        needsPadding = true;
        paddedElementCount = 计算最小2的幂(originalElementCount);
        
        // 创建填充后的数组
        paddedData = new Array(paddedElementCount);
        for (let i = 0; i < originalElementCount; i++) {
            paddedData[i] = data[i];
        }
        
        // 填充剩余部分
        for (let i = originalElementCount; i < paddedElementCount; i++) {
            paddedData[i] = { value: Infinity, pixelOffset: 0 };
        }
    }

    // 准备数据 - 将像素投影数据转换为Float32Array（value和pixelOffset交错存储）
    const dataBuffer = new Float32Array(paddedElementCount * 2);
    for (let i = 0; i < paddedElementCount; i++) {
        dataBuffer[i * 2] = paddedData[i].value;
        dataBuffer[i * 2 + 1] = paddedData[i].pixelOffset;
    }

    // 创建着色器模块
    const shaderModule = 设备.createShaderModule({
        code: channeledSortWGSL,
        label: "GPU排序着色器模块"
    });

    // 创建计算管线
    const computePipeline = 设备.createComputePipeline({
        layout: 设备.createPipelineLayout({
            bindGroupLayouts: [
                设备.createBindGroupLayout({
                    entries: [
                        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                    ],
                    label: "GPU排序绑定组布局"
                })
            ],
            label: "GPU排序管线布局"
        }),
        compute: {
            module: shaderModule,
            entryPoint: 'sort_channel',
        },
        label: "GPU排序计算管线"
    });

    // 创建数据缓冲区
    const gpuDataBuffer = 设备.createBuffer({
        size: paddedElementCount * 8, // 每个像素投影包含 value(f32) 和 pixelOffset(u32)，共8字节
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        label: 'GPU排序数据缓冲区'
    });

    // 写入初始数据
    const dataUploadBuffer = 创建并映射缓冲区(设备, dataBuffer, GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, "GPU排序数据上传缓冲区");
    
    // 将数据复制到GPU缓冲区
    const commandEncoder = 设备.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(dataUploadBuffer, 0, gpuDataBuffer, 0, paddedElementCount * 8);
    设备.queue.submit([commandEncoder.finish()]);
    await 设备.queue.onSubmittedWorkDone();

    const log2n = 计算以2为底的对数(paddedElementCount);
    
    // 创建单个命令编码器，将所有pass的命令编码到单个命令缓冲区中
    const sortCommandEncoder = 设备.createCommandEncoder();
    
    // 执行双调排序
    for (let stage = 0; stage < log2n; stage++) {
        for (let passOfStage = stage; passOfStage >= 0; passOfStage--) {
            // 为每个pass创建单独的参数缓冲区
            const sortParamsBuffer = 设备.createBuffer({
                size: 16, // 4个u32参数
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                label: `GPU排序参数缓冲区-stage-${stage}-pass-${passOfStage}`
            });
            
            const sortParams = new Uint32Array([
                stage,    // 双调排序阶段
                passOfStage, // 双调排序阶段中的步骤
                paddedElementCount,
                WORKGROUP_SIZE * MAX_WORKGROUPS
            ]);
            
            设备.queue.writeBuffer(sortParamsBuffer, 0, sortParams);

            const sortPassEncoder = sortCommandEncoder.beginComputePass();
            sortPassEncoder.setPipeline(computePipeline);
            sortPassEncoder.setBindGroup(0, 创建排序绑定组(设备, computePipeline, {
                data: gpuDataBuffer,
                params: sortParamsBuffer
            }));
            
            sortPassEncoder.dispatchWorkgroups(MAX_WORKGROUPS);
            sortPassEncoder.end();
        }
    }
    
    // 一次性提交所有命令
    设备.queue.submit([sortCommandEncoder.finish()]);
    
    // 等待所有pass完成
    await 设备.queue.onSubmittedWorkDone();

    // 最终读取结果
    const resultReadBuffer = 设备.createBuffer({
        size: paddedElementCount * 8,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    const finalCommandEncoder = 设备.createCommandEncoder();
    finalCommandEncoder.copyBufferToBuffer(gpuDataBuffer, 0, resultReadBuffer, 0, paddedElementCount * 8);
    设备.queue.submit([finalCommandEncoder.finish()]);

    await resultReadBuffer.mapAsync(GPUMapMode.READ);
    const resultData = new Float32Array(resultReadBuffer.getMappedRange());
    const finalResult = new Float32Array(resultData.slice(0));
    resultReadBuffer.unmap();

    // 将结果转换回像素投影数组
    const sortedPixels: 像素投影[] = [];
    for (let i = 0; i < originalElementCount; i++) {
        sortedPixels.push({
            value: finalResult[i * 2],
            pixelOffset: finalResult[i * 2 + 1]
        });
    }

    // 清理
    gpuDataBuffer.destroy();
    resultReadBuffer.destroy();
    dataUploadBuffer.destroy();

    return sortedPixels;
};