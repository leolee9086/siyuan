/**
 * 注意,这里需要使用esm.sh编译版本的transformerjs
 * 这样才能够在electron的渲染进程中跑起来
 * 如果你愿意创建一个单独的进程并且不给它node环境的话,也可以不用下面这些操作
 * 如果你使用webworker,也不用下面这些操作
 * 注意如果使用webpack,不要将打包目标设置为高于es2022,否则会出问题
 * 有时间我再说一下怎么在思源里面直接实现类似ollama的模型加载功能,如果做补全可能有用
 * 相关文件见app\stage\protyle\js\transformers.js
 */

// =========== 文本分割 ===========

/**
 * 按语义边界分割成小单元（保留分隔符）
 */
function 按语义边界分割(content: string): string[] {
    const units: string[] = [];

    // 先按段落分割
    const paragraphs = content.split(/\n+/);

    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
            continue;
        }

        // 按句子分割（保留分隔符）
        // 匹配中英文句号、问号、叹号、分号后的位置
        const sentences = paragraph.split(/(?<=[。！？；;.!?])/);

        for (const sentence of sentences) {
            if (!sentence.trim()) {
                continue;
            }
            units.push(sentence);
        }
    }

    return units;
}

/**
 * 贪婪合并：将小单元合并到接近但不超过上限长度的 chunk
 */
function 贪婪合并(units: string[], maxChunkLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const unit of units) {
        // 如果单个单元就超过上限，需要强制截断
        if (unit.length > maxChunkLength) {
            // 先保存当前累积的 chunk
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            // 对超长单元按子句进一步分割
            const subUnits = unit.split(/(?<=[，、,])/);
            for (const sub of subUnits) {
                if (sub.length > maxChunkLength) {
                    // 仍然超长，强制截断
                    for (let i = 0; i < sub.length; i += maxChunkLength) {
                        chunks.push(sub.slice(i, i + maxChunkLength));
                    }
                    continue;
                }
                if ((currentChunk + sub).length <= maxChunkLength) {
                    currentChunk += sub;
                    continue;
                }
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sub;
            }
            continue;
        }

        // 正常情况：尝试合并
        if ((currentChunk + unit).length <= maxChunkLength) {
            currentChunk += unit;
            continue;
        }
        // 放不下了，保存当前 chunk，开始新的
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        currentChunk = unit;
    }

    // 保存最后一个 chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * 文本分割：按语义边界分割后贪婪合并到设定上限长度
 * @param content 原始文本
 * @param maxChunkLength chunk 最大长度（默认 499，适配大多数嵌入模型的 512 token 限制）
 * @returns 分割后的 chunk 数组
 */
export const splitText = (content: string, maxChunkLength = 499): string[] => {
    // 第一步：按语义边界分割成小单元
    const units = 按语义边界分割(content);

    // 第二步：贪婪合并到设定上限
    const chunks = 贪婪合并(units, maxChunkLength);

    return chunks.filter(s => s.trim() !== "");
};

// =========== 向量操作 ===========

export const normalizeVector = (vector: number[] | Float32Array): number[] => {
    const arr = Array.from(vector);
    const sumSq = arr.reduce((acc, cur) => acc + cur * cur, 0);
    const length = Math.sqrt(sumSq);
    // Prevent division by zero
    if (length === 0) {
        return arr;
    }
    return arr.map(value => value / length);
};

export const calculateWeightedAverageVector = (vectors: (number[] | Float32Array)[], weights: number[], normalize: boolean): Float32Array => {
    if (vectors.length === 0) {
        return new Float32Array(0);
    }
    const dimension = vectors[0].length;
    const totalVector = new Float32Array(dimension);

    // Initial check for dimensions mismatch
    // (Skipping strict check for performance, assuming extractor returns consistent dims)

    for (let i = 0; i < dimension; i++) {
        let sum = 0;
        for (let j = 0; j < vectors.length; j++) {
            sum += vectors[j][i] * weights[j];
        }
        totalVector[i] = sum;
    }

    const averagedVector = totalVector.map(value => value / vectors.length);

    if (normalize) {
        const result = normalizeVector(averagedVector);
        return new Float32Array(result);
    }
    return averagedVector;
};

// =========== WebGPU 检测 ===========

const logWebGPUInfo = async () => {
    console.log("[WebGPU Debug] 开始检查WebGPU环境...");

    if (!navigator.gpu) {
        console.error("[WebGPU Debug] ❌ navigator.gpu 不存在，WebGPU不可用");
        return null;
    }
    console.log("[WebGPU Debug] ✓ navigator.gpu 存在");

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error("[WebGPU Debug] ❌ 无法获取WebGPU adapter");
            return null;
        }

        // 兼容新旧WebGPU API - 新版是属性，旧版是方法
        let adapterInfo;
        if (typeof adapter.requestAdapterInfo === "function") {
            adapterInfo = await adapter.requestAdapterInfo();
        } else {
            adapterInfo = adapter.info;
        }
        console.log("[WebGPU Debug] ✓ Adapter信息:", adapterInfo);

        // 检查adapter的限制
        console.log("[WebGPU Debug] Adapter限制:", {
            maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
            maxComputeWorkgroupSizeY: adapter.limits.maxComputeWorkgroupSizeY,
            maxComputeWorkgroupSizeZ: adapter.limits.maxComputeWorkgroupSizeZ,
            maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxBufferSize: adapter.limits.maxBufferSize,
        });

        // 检查支持的特性
        console.log("[WebGPU Debug] 支持的特性:", [...adapter.features]);

        return adapter;
    } catch (e) {
        console.error("[WebGPU Debug] ❌ 检查WebGPU时出错:", e);
        return null;
    }
};

// =========== Transformer 环境初始化 ===========

const initTransformerEnv = async () => {
    console.log("[Transformer] ========== 开始初始化Transformer环境 ==========");

    // 先检查WebGPU环境
    await logWebGPUInfo();

    console.log("[Transformer] 正在加载transformers.js...");
    //@ts-ignore
    const transformers = await import(/* webpackIgnore: true */ "/stage/protyle/js/transformers.js");
    console.log("[Transformer] ✓ transformers.js 加载完成");

    console.log("[Transformer] 配置ONNX环境...");
    transformers.env.backends.onnx.wasm.wasmPaths = "/stage/protyle/js/@huggingface/transformers@3.8.0/";
    transformers.env.allowRemoteModels = true;
    transformers.env.localModelPath = "/public/onnxModels/";
    // 设置ONNX日志级别为error，隐藏性能警告（如节点未分配到首选执行提供程序的警告）
    transformers.env.backends.onnx.logLevel = "error";
    console.log("[Transformer] ✓ ONNX环境配置完成:", {
        wasmPaths: transformers.env.backends.onnx.wasm.wasmPaths,
        allowRemoteModels: transformers.env.allowRemoteModels,
        localModelPath: transformers.env.localModelPath,
    });

    let node_version: string | undefined;
    if (window.process) {
        node_version = window.process.versions.node;
        console.log("[Transformer] 检测到Node环境, 版本:", node_version);
        try {
            const descriptor = Object.getOwnPropertyDescriptor(window.process.versions, "node");
            if (!descriptor || descriptor.configurable) {
                Object.defineProperty(window.process.versions, "node", {
                    value: undefined,
                    writable: true,
                    configurable: true,
                    enumerable: true
                });
                console.log("[Transformer] ✓ 临时移除node版本标识");
            } else if (descriptor.writable) {
                window.process.versions.node = undefined;
                console.log("[Transformer] ✓ 临时移除node版本标识 (writable)");
            } else {
                console.warn("[Transformer] ⚠ Cannot hack window.process.versions.node: property is non-configurable and non-writable");
            }
        } catch (e) {
            console.warn("[Transformer] ⚠ Failed to hack window.process.versions.node", e);
        }
    }

    console.log("[Transformer] 正在创建feature-extraction pipeline...");
    console.log("[Transformer] 参数: device=webgpu, model=leolee9086/text2vec-base-chinese, model_file=model_quantized");

    //@ts-ignore
    const { pipeline } = await import(/* webpackIgnore: true */ "/stage/protyle/js/transformers.js");

    let extractor;
    try {
        console.log("[Transformer] 开始加载模型... (这可能需要一些时间)");
        const startTime = performance.now();

        // 注意：已修复onnxruntime-web的WGSL代码生成bug (变量名空格问题)
        // 修复位置: stage/protyle/js/onnxruntime-web@1.22.0-dev.../es2022/onnxruntime-web.mjs 第7918-7923行
        extractor = await pipeline(
            "feature-extraction",
            "leolee9086/text2vec-base-chinese",
            {
                device: "webgpu",
                model_file_name: "model_quantized",
            },
        );

        const loadTime = performance.now() - startTime;
        console.log(`[Transformer] ✓ Pipeline创建成功, 耗时: ${loadTime.toFixed(2)}ms`);
    } catch (pipelineError) {
        console.error("[Transformer] ❌ Pipeline创建失败:", pipelineError);
        console.error("[Transformer] 错误堆栈:", (pipelineError as Error).stack);
        throw pipelineError;
    }

    if (window.process && node_version !== undefined) {
        try {
            const descriptor = Object.getOwnPropertyDescriptor(window.process.versions, "node");
            if (!descriptor || descriptor.configurable) {
                Object.defineProperty(window.process.versions, "node", {
                    value: node_version,
                    writable: false,
                    configurable: false,
                    enumerable: true
                });
                console.log("[Transformer] ✓ 恢复node版本标识:", node_version);
            } else if (descriptor.writable) {
                window.process.versions.node = node_version;
                console.log("[Transformer] ✓ 恢复node版本标识 (writable):", node_version);
            }
        } catch (e) {
            console.warn("[Transformer] ⚠ Failed to restore window.process.versions.node", e);
        }
    }

    console.log("[Transformer] ========== Transformer环境初始化完成 ==========");
    return extractor;
};

// =========== Extractor 单例 ===========

// 缓存已初始化的 extractor，避免每次调用都重新加载模型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let 缓存Extractor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let 初始化Promise: Promise<any> | null = null;

/**
 * 获取或初始化 extractor（单例模式）
 */
const getExtractor = async () => {
    if (缓存Extractor) {
        return 缓存Extractor;
    }

    // 防止并发初始化
    if (初始化Promise) {
        return 初始化Promise;
    }

    初始化Promise = initTransformerEnv();
    try {
        缓存Extractor = await 初始化Promise;
        return 缓存Extractor;
    } finally {
        初始化Promise = null;
    }
};

// =========== Embedding 主函数 ===========

export const embeddingText = async (content: string): Promise<Float32Array> => {
    console.log("[Embedding] ========== 开始embedding文本 ==========");
    console.log(`[Embedding] 输入文本长度: ${content.length} 字符`);
    console.log(`[Embedding] 输入文本预览: "${content.substring(0, 100)}${content.length > 100 ? "..." : ""}"`);

    let extractor;
    try {
        extractor = await getExtractor();
    } catch (initError) {
        console.error("[Embedding] ❌ 初始化失败:", initError);
        throw initError;
    }

    // Split text and embed each chunk
    const chunks = splitText(content);
    console.log(`[Embedding] 文本分割完成, 共 ${chunks.length} 个片段`);

    // Handle empty content or empty split result
    if (chunks.length === 0 || !content.trim()) {
        console.log("[Embedding] ⚠ 内容为空或分割结果为空，直接embedding原始内容");
        try {
            const embeddings = await extractor(content, { pooling: "mean", normalize: true });
            console.log("[Embedding] ✓ 空内容embedding完成");
            if (!embeddings.data) {
                throw new Error("Embedding结果中没有data字段");
            }
            return embeddings.data;
        } catch (emptyContentError) {
            console.error("[Embedding] ❌ 空内容embedding失败:", emptyContentError);
            throw emptyContentError;
        }
    }

    const vectors: Float32Array[] = [];
    const weights: number[] = [];
    const totalStartTime = performance.now();

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[Embedding] 处理片段 ${i + 1}/${chunks.length}:`);
        console.log(`[Embedding]   长度: ${chunk.length} 字符`);
        console.log(`[Embedding]   内容: "${chunk.substring(0, 50)}${chunk.length > 50 ? "..." : ""}"`);

        try {
            const chunkStartTime = performance.now();
            console.log("[Embedding]   调用extractor...");

            const embeddings = await extractor(chunk, { pooling: "mean", normalize: true });

            const chunkTime = performance.now() - chunkStartTime;
            console.log(`[Embedding]   ✓ 完成, 耗时: ${chunkTime.toFixed(2)}ms`);

            if (!embeddings.data) {
                console.error("[Embedding]   ❌ 返回的embeddings没有data字段:", embeddings);
                throw new Error(`Failed to embed chunk: "${chunk.substring(0, 20)}..."`);
            }

            console.log(`[Embedding]   向量维度: ${embeddings.data.length}`);
            vectors.push(embeddings.data);
            weights.push(chunk.length);
        } catch (chunkError) {
            console.error(`[Embedding] ❌ 片段 ${i + 1} embedding失败:`, chunkError);
            if (chunkError instanceof Error) {
                console.error(`[Embedding]   错误类型: ${chunkError.name}`);
                console.error(`[Embedding]   错误信息: ${chunkError.message}`);
                console.error(`[Embedding]   错误堆栈: ${chunkError.stack}`);
            }
            throw chunkError;
        }
    }

    const totalTime = performance.now() - totalStartTime;
    console.log(`[Embedding] 所有片段处理完成, 总耗时: ${totalTime.toFixed(2)}ms`);
    console.log(`[Embedding] 成功生成 ${vectors.length} 个向量`);

    if (vectors.length === 0) {
        throw new Error("Failed to generate embeddings: input text resulted in no vectors");
    }

    if (vectors.length === 1) {
        console.log("[Embedding] 只有一个向量，直接返回");
        console.log("[Embedding] ========== embedding完成 ==========");
        return vectors[0];
    }

    // Aggregate vectors
    console.log("[Embedding] 正在聚合多个向量...");
    const result = calculateWeightedAverageVector(vectors, weights, true);
    console.log(`[Embedding] ✓ 向量聚合完成, 最终维度: ${result.length}`);
    console.log("[Embedding] ========== embedding完成 ==========");
    return result;
};
