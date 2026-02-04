import type { VamanaNode } from "../types";



/**
 * 质心计算函数 
 * 
 * @param nodes - 要计算质心的节点数组
 * @param dim - 向量维度
 * @param nodeCount - 节点数量
 * @returns 质心向量
 */
export const findCentroid = (nodes: VamanaNode[], dim: number, nodeCount: number): Float32Array => {
    const centroid = new Float32Array(dim);
    
    // 更激进的循环展开：每次处理8个元素
    const unrollSize = 8;
    const unrollEnd = Math.floor(dim / unrollSize) * unrollSize;
    
    // 预计算倒数，避免除法
    const invNodeCount = 1 / nodeCount;
    
    // 使用for循环遍历节点
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++) {
        const vector = nodes[nodeIndex].vector;
        
        // 8路循环展开
        for (let i = 0; i < unrollEnd; i += unrollSize) {
            centroid[i] += vector[i];
            centroid[i + 1] += vector[i + 1];
            centroid[i + 2] += vector[i + 2];
            centroid[i + 3] += vector[i + 3];
            centroid[i + 4] += vector[i + 4];
            centroid[i + 5] += vector[i + 5];
            centroid[i + 6] += vector[i + 6];
            centroid[i + 7] += vector[i + 7];
        }
        
        // 处理剩余元素
        for (let i = unrollEnd; i < dim; i++) {
            centroid[i] += vector[i];
        }
    }
    
    // 8路循环展开进行除法运算
    for (let i = 0; i < unrollEnd; i += unrollSize) {
        centroid[i] *= invNodeCount;
        centroid[i + 1] *= invNodeCount;
        centroid[i + 2] *= invNodeCount;
        centroid[i + 3] *= invNodeCount;
        centroid[i + 4] *= invNodeCount;
        centroid[i + 5] *= invNodeCount;
        centroid[i + 6] *= invNodeCount;
        centroid[i + 7] *= invNodeCount;
    }
    
    // 处理剩余元素
    for (let i = unrollEnd; i < dim; i++) {
        centroid[i] *= invNodeCount;
    }
    
    return centroid;
};

/**
 * 增量质心更新函数 - 用于动态添加/删除节点时的高效更新
 * 
 * @param currentCentroid - 当前质心向量
 * @param addedVectors - 新添加的向量数组
 * @param removedVectors - 被删除的向量数组
 * @param currentNodeCount - 当前节点数量
 * @returns 更新后的质心向量
 */
export const updateCentroidIncremental = (
    currentCentroid: Float32Array,
    addedVectors: Float32Array[],
    removedVectors: Float32Array[],
    currentNodeCount: number
): Float32Array => {
    const dim = currentCentroid.length;
    const newCentroid = new Float32Array(currentCentroid);
    const addCount = addedVectors.length;
    const removeCount = removedVectors.length;
    const netChange = addCount - removeCount;
    const newNodeCount = currentNodeCount + netChange;
    if (newNodeCount <= 0) {
        throw new Error('节点数量不能为负数');
    }
    // 计算权重调整因子
    const oldWeight = currentNodeCount / newNodeCount;
    const newWeight = 1 / newNodeCount;
    // 调整现有质心的权重
    for (let i = 0; i < dim; i++) {
        newCentroid[i] *= oldWeight;
    }
    // 移除被删除的向量的贡献
    for (const vector of removedVectors) {
        for (let i = 0; i < dim; i++) {
            newCentroid[i] -= vector[i] * newWeight;
        }
    }
    // 添加新向量的贡献
    for (const vector of addedVectors) {
        for (let i = 0; i < dim; i++) {
            newCentroid[i] += vector[i] * newWeight;
        }
    }
    return newCentroid;
};