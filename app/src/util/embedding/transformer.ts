/**
 * 注意,这里需要使用esm.sh编译版本的transformerjs
 * 这样才能够在electron的渲染进程中跑起来
 * 如果你愿意创建一个单独的进程并且不给它node环境的话,也可以不用下面这些操作
 * 如果你使用webworker,也不用下面这些操作
 * 注意如果使用webpack,不要将打包目标设置为高于es2022,否则会出问题
 * 有时间我再说一下怎么在思源里面直接实现类似ollama的模型加载功能,如果做补全可能有用
 * 相关文件见app\stage\protyle\js\transformers.js
 * @param content 
 */
export const splitText = (content: string, maxChunkLength = 499): string[] => {
    const sentenceDelimiters = /[。！？；;]/g;
    const clauseDelimiters = /[，、]/g;
    const paragraphs = content.split('\n');
    const result: string[] = [];

    for (const paragraph of paragraphs) {
        if (paragraph.length > maxChunkLength) {
            const sentences = paragraph.split(sentenceDelimiters);
            for (let sentence of sentences) {
                if (sentence.length > maxChunkLength) {
                    const clauses = sentence.split(clauseDelimiters);
                    for (let clause of clauses) {
                        if (clause.length > maxChunkLength) {
                            clause = clause.substring(0, maxChunkLength);
                        }
                        result.push(clause);
                    }
                } else {
                    result.push(sentence);
                }
            }
        } else {
            result.push(paragraph);
        }
    }
    return result.filter(s => s.trim() !== '');
};

export const normalizeVector = (vector: number[] | Float32Array): number[] => {
    const arr = Array.from(vector);
    const sumSq = arr.reduce((acc, cur) => acc + cur * cur, 0);
    const length = Math.sqrt(sumSq);
    // Prevent division by zero
    if (length === 0) return arr;
    return arr.map(value => value / length);
};

export const calculateWeightedAverageVector = (vectors: (number[] | Float32Array)[], weights: number[], normalize: boolean): Float32Array => {
    if (vectors.length === 0) return new Float32Array(0);
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
    } else {
        return averagedVector;
    }
};

const initTransformerEnv = async () => {
    //@ts-ignore
    const transformers = await import(/* webpackIgnore: true */ "/stage/protyle/js/transformers.js");
    transformers.env.backends.onnx.wasm.wasmPaths = "/stage/protyle/js/@huggingface/transformers@3.8.0/";
    transformers.env.allowRemoteModels = true;
    transformers.env.localModelPath = "/public/onnxModels/";

    let node_version: string | undefined;
    if (window.process) {
        node_version = window.process.versions.node;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(window.process.versions, "node");
            if (!descriptor || descriptor.configurable) {
                Object.defineProperty(window.process.versions, "node", {
                    value: undefined,
                    writable: true,
                    configurable: true,
                    enumerable: true
                });
            } else if (descriptor.writable) {
                window.process.versions.node = undefined;
            } else {
                console.warn("Cannot hack window.process.versions.node: property is non-configurable and non-writable");
            }
        } catch (e) {
            console.warn("Failed to hack window.process.versions.node", e);
        }
    }

    //@ts-ignore
    const { pipeline } = await import(/* webpackIgnore: true */ "/stage/protyle/js/transformers.js");

    const extractor = await pipeline(
        "feature-extraction",
        "leolee9086/text2vec-base-chinese",
        {
            device: "webgpu",
            model_file_name: "model_quantized",
        },
    );

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
            } else if (descriptor.writable) {
                window.process.versions.node = node_version;
            }
        } catch (e) {
            console.warn("Failed to restore window.process.versions.node", e);
        }
    }

    return extractor;
};

export const embeddingText = async (content: string): Promise<Float32Array> => {
    const extractor = await initTransformerEnv();

    // Split text and embed each chunk
    const chunks = splitText(content);

    // Handle empty content or empty split result
    if (chunks.length === 0 || !content.trim()) {
        const embeddings = await extractor(content, { pooling: "mean", normalize: true });
        return embeddings.data as Float32Array;
    }

    const vectors: Float32Array[] = [];
    const weights: number[] = [];

    for (const chunk of chunks) {
        console.log(chunk);
        const embeddings = await extractor(chunk, { pooling: "mean", normalize: true });
        if (!embeddings.data) {
            throw new Error(`Failed to embed chunk: "${chunk.substring(0, 20)}..."`);
        }
        vectors.push(embeddings.data as Float32Array);
        weights.push(chunk.length);
    }

    if (vectors.length === 0) {
        throw new Error("Failed to generate embeddings: input text resulted in no vectors");
    }

    if (vectors.length === 1) {
        return vectors[0];
    }

    // Aggregate vectors
    return calculateWeightedAverageVector(vectors, weights, true);
};
