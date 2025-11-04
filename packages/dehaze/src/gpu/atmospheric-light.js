/**
 * 64像素CPU降采样大气光估计模块
 * 使用GPU计算暗通道，然后降采样到64x64像素在CPU上计算大气光
 * 使用最小堆优化，避免全排序
 * @author 织
 */


/**
 * 64像素CPU降采样版本大气光估计
 * 将图像降采样到64x64像素，然后在CPU上计算大气光
 * @param {GPUDevice} device - WebGPU设备
 * @param {GPUBuffer} darkChannelBuffer - 暗通道缓冲区
 * @param {ImageData} imageData - 图像数据
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {number} topRatio - 取前topRatio%的像素，默认为0.1
 * @param {string} channel - 指定通道，'r', 'g', 'b', 'luminance' 或 'all'，默认为'all'
 * @returns {Promise<Object>} 估计的大气光值对象
 */
export const estimateAtmosphericLightDownsampled = async (device, darkChannelBuffer, imageData, width, height, topRatio = 0.1) => {
    // 读取暗通道数据到CPU
    const readBuffer = device.createBuffer({
        size: width * height * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(darkChannelBuffer, 0, readBuffer, 0, width * height * 4);
    device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const rawData = readBuffer.getMappedRange();
    const darkChannelArray = new Float32Array(rawData.slice(0));
    readBuffer.unmap();

    // 降采样到64x64
    const downsampleSize = 64;
    const downsampleStepX = Math.max(1, Math.floor(width / downsampleSize));
    const downsampleStepY = Math.max(1, Math.floor(height / downsampleSize));

    const downsampledDarkChannel = [];
    const downsampledImageData = [];

    for (let y = 0; y < downsampleSize; y++) {
        for (let x = 0; x < downsampleSize; x++) {
            const srcX = Math.floor(x * downsampleStepX);
            const srcY = Math.floor(y * downsampleStepY);
            const srcIndex = srcY * width + srcX;

            if (srcIndex < darkChannelArray.length) {
                downsampledDarkChannel.push(darkChannelArray[srcIndex]);

                const pixelIndex = srcIndex * 4;
                if (pixelIndex < imageData.data.length - 3) {
                    downsampledImageData.push({
                        r: imageData.data[pixelIndex] / 255,
                        g: imageData.data[pixelIndex + 1] / 255,
                        b: imageData.data[pixelIndex + 2] / 255,
                        luminance: (imageData.data[pixelIndex] * 0.299 +
                            imageData.data[pixelIndex + 1] * 0.587 +
                            imageData.data[pixelIndex + 2] * 0.114) / 255
                    });
                }
            }
        }
    }

    // 在降采样数据上计算大气光
    const totalPixels = downsampledDarkChannel.length;
    const topCount = Math.floor(totalPixels * topRatio);

    // 使用最小堆找到top像素，避免全排序
    class MinHeap {
        constructor() {
            this.heap = [];
        }

        // 插入元素
        insert(item) {
            this.heap.push(item);
            this.bubbleUp();
        }

        // 移除最小元素
        removeMin() {
            if (this.heap.length === 0) return null;
            if (this.heap.length === 1) return this.heap.pop();

            const min = this.heap[0];
            this.heap[0] = this.heap.pop();
            this.bubbleDown();
            return min;
        }

        // 获取最小元素
        peek() {
            return this.heap[0];
        }

        // 获取堆大小
        size() {
            return this.heap.length;
        }

        // 向上冒泡
        bubbleUp() {
            let index = this.heap.length - 1;
            while (index > 0) {
                const parentIndex = Math.floor((index - 1) / 2);
                if (this.heap[index].darkChannel >= this.heap[parentIndex].darkChannel) {
                    break;
                }
                [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
                index = parentIndex;
            }
        }

        // 向下冒泡
        bubbleDown() {
            let index = 0;
            while (true) {
                let smallest = index;
                const leftChild = 2 * index + 1;
                const rightChild = 2 * index + 2;

                if (leftChild < this.heap.length &&
                    this.heap[leftChild].darkChannel < this.heap[smallest].darkChannel) {
                    smallest = leftChild;
                }

                if (rightChild < this.heap.length &&
                    this.heap[rightChild].darkChannel < this.heap[smallest].darkChannel) {
                    smallest = rightChild;
                }

                if (smallest === index) break;

                [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
                index = smallest;
            }
        }
    }

    // 使用最小堆找到top像素
    const minHeap = new MinHeap();

    // 首先填充堆到topCount大小
    for (let i = 0; i < totalPixels; i++) {
        const item = {
            index: i,
            darkChannel: downsampledDarkChannel[i],
            pixel: downsampledImageData[i]
        };

        if (minHeap.size() < topCount) {
            minHeap.insert(item);
        } else if (item.darkChannel > minHeap.peek().darkChannel) {
            minHeap.removeMin();
            minHeap.insert(item);
        }
    }

    // 从堆中提取top像素
    const topPixels = [];
    while (minHeap.size() > 0) {
        topPixels.push(minHeap.removeMin());
    }
    // 按暗通道值降序排列
    topPixels.sort((a, b) => b.darkChannel - a.darkChannel);

        let maxIntensityR = 0, maxIntensityG = 0, maxIntensityB = 0;
        let maxLuminance = 0;
        let threshold = 0;

        // 在前topRatio%的像素中寻找最亮的像素
        for (let i = 0; i < topPixels.length; i++) {
            const item = topPixels[i];
            const pixel = item.pixel;

            if (pixel.r > maxIntensityR) maxIntensityR = pixel.r;
            if (pixel.g > maxIntensityG) maxIntensityG = pixel.g;
            if (pixel.b > maxIntensityB) maxIntensityB = pixel.b;
            if (pixel.luminance > maxLuminance) {
                maxLuminance = pixel.luminance;
                threshold = item.darkChannel;
            }
        }

        return {
            r: maxIntensityR,
            g: maxIntensityG,
            b: maxIntensityB,
            luminance: maxLuminance,
            maxDarkChannel: threshold,
            pixelCount: topCount
        };
};
