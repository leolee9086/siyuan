/**
 * 距离计算函数实现
 */

import { DistanceConfig, CustomDistanceFunction } from './types';

/**
 * 计算向量的平方范数
 * 
 * @param vec 输入向量
 * @returns 向量的平方范数
 */
export function calculateSqNorm(vec: Float32Array): number {
  let sum = 0;
  const len = vec.length;
  let i = 0;

  // 8路循环展开计算平方范数
  for (; i + 7 < len; i += 8) {
    sum += vec[i] * vec[i] + vec[i + 1] * vec[i + 1] +
      vec[i + 2] * vec[i + 2] + vec[i + 3] * vec[i + 3] +
      vec[i + 4] * vec[i + 4] + vec[i + 5] * vec[i + 5] +
      vec[i + 6] * vec[i + 6] + vec[i + 7] * vec[i + 7];
  }

  // 处理剩余元素
  for (; i < len; i++) {
    sum += vec[i] * vec[i];
  }

  return sum;
}

/**
 * 计算欧几里得距离 - 8路循环展开优化版本
 * 支持使用预计算的范数进行优化
 * 
 * @param vecA 第一个向量
 * @param vecB 第二个向量
 * @param sqNormA 可选，第一个向量的平方范数
 * @param sqNormB 可选，第二个向量的平方范数
 * @returns 两个向量的欧几里得距离
 */
export function computeEuclideanDistance(
  vecA: Float32Array,
  vecB: Float32Array,
  sqNormA?: number,
  sqNormB?: number
): number {
  let sum = 0;
  const len = vecA.length;
  let i = 0;

  // 8路循环展开处理主要部分
  for (; i + 7 < len; i += 8) {
    const diff0 = vecA[i] - vecB[i];
    const diff1 = vecA[i + 1] - vecB[i + 1];
    const diff2 = vecA[i + 2] - vecB[i + 2];
    const diff3 = vecA[i + 3] - vecB[i + 3];
    const diff4 = vecA[i + 4] - vecB[i + 4];
    const diff5 = vecA[i + 5] - vecB[i + 5];
    const diff6 = vecA[i + 6] - vecB[i + 6];
    const diff7 = vecA[i + 7] - vecB[i + 7];

    sum += diff0 * diff0 + diff1 * diff1 + diff2 * diff2 + diff3 * diff3 +
      diff4 * diff4 + diff5 * diff5 + diff6 * diff6 + diff7 * diff7;
  }

  // 处理剩余元素
  for (; i < len; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 计算余弦距离 - 8路循环展开优化版本
 * 支持使用预计算的范数进行优化
 * 
 * @param vecA 第一个向量
 * @param vecB 第二个向量
 * @param sqNormA 可选，第一个向量的平方范数
 * @param sqNormB 可选，第二个向量的平方范数
 * @returns 两个向量的余弦距离（1-余弦相似度）
 */
export function computeCosineDistance(
  vecA: Float32Array,
  vecB: Float32Array,
  sqNormA?: number,
  sqNormB?: number
): number {
  let dotProduct = 0;

  // 如果提供了预计算的范数，使用它们；否则计算
  const normA = sqNormA !== undefined ? Math.sqrt(sqNormA) : (() => {
    return Math.sqrt(calculateSqNorm(vecA));
  })();

  const normB = sqNormB !== undefined ? Math.sqrt(sqNormB) : (() => {
    return Math.sqrt(calculateSqNorm(vecB));
  })();

  // 8路循环展开计算点积
  const len = vecA.length;
  let i = 0;
  for (; i + 7 < len; i += 8) {
    dotProduct += vecA[i] * vecB[i] + vecA[i + 1] * vecB[i + 1] +
      vecA[i + 2] * vecB[i + 2] + vecA[i + 3] * vecB[i + 3] +
      vecA[i + 4] * vecB[i + 4] + vecA[i + 5] * vecB[i + 5] +
      vecA[i + 6] * vecB[i + 6] + vecA[i + 7] * vecB[i + 7];
  }

  // 处理剩余元素
  for (; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
  }

  const normProduct = normA * normB;
  return normProduct === 0 ? 1 : 1 - (dotProduct / normProduct);
}

/**
 * 计算内积距离（返回负值，因为我们要找最小距离）- 8路循环展开优化版本
 * 支持预处理优化，包括向量归一化和填充维度处理
 * 
 * @param vecA 第一个向量
 * @param vecB 第二个向量
 * @param config 可选，距离计算配置
 * @returns 两个向量的内积距离（负内积）
 */
export function computeInnerProductDistance(
  vecA: Float32Array,
  vecB: Float32Array,
  config?: DistanceConfig
): number {
  let sum = 0;

  // 如果启用了内积预处理
  if (config?.ipPrepared && config.paddingId !== undefined) {
    const paddingId = config.paddingId;
    const len = vecA.length;
    let i = 0;

    // 8路循环展开处理填充维度
    for (; i + 7 < len; i += 8) {
      // 检查每个位置是否为填充维度
      sum += (i === paddingId ? vecA[i] * vecB[i] : vecA[i] * vecB[i]) +
        (i + 1 === paddingId ? vecA[i + 1] * vecB[i + 1] : vecA[i + 1] * vecB[i + 1]) +
        (i + 2 === paddingId ? vecA[i + 2] * vecB[i + 2] : vecA[i + 2] * vecB[i + 2]) +
        (i + 3 === paddingId ? vecA[i + 3] * vecB[i + 3] : vecA[i + 3] * vecB[i + 3]) +
        (i + 4 === paddingId ? vecA[i + 4] * vecB[i + 4] : vecA[i + 4] * vecB[i + 4]) +
        (i + 5 === paddingId ? vecA[i + 5] * vecB[i + 5] : vecA[i + 5] * vecB[i + 5]) +
        (i + 6 === paddingId ? vecA[i + 6] * vecB[i + 6] : vecA[i + 6] * vecB[i + 6]) +
        (i + 7 === paddingId ? vecA[i + 7] * vecB[i + 7] : vecA[i + 7] * vecB[i + 7]);
    }

    // 处理剩余元素
    for (; i < len; i++) {
      sum += vecA[i] * vecB[i];
    }
  } else {
    // 8路循环展开标准内积计算
    const len = vecA.length;
    let i = 0;
    for (; i + 7 < len; i += 8) {
      sum += vecA[i] * vecB[i] + vecA[i + 1] * vecB[i + 1] +
        vecA[i + 2] * vecB[i + 2] + vecA[i + 3] * vecB[i + 3] +
        vecA[i + 4] * vecB[i + 4] + vecA[i + 5] * vecB[i + 5] +
        vecA[i + 6] * vecB[i + 6] + vecA[i + 7] * vecB[i + 7];
    }

    // 处理剩余元素
    for (; i < len; i++) {
      sum += vecA[i] * vecB[i];
    }
  }

  return -sum; // 返回负值，因为我们要找最小距离
}

/**
 * 根据配置计算距离
 * 
 * @param vecA 第一个向量
 * @param vecB 第二个向量
 * @param config 距离计算配置
 * @param sqNormA 可选，第一个向量的平方范数
 * @param sqNormB 可选，第二个向量的平方范数
 * @returns 根据配置计算的距离
 */
export function computeDistance(
  vecA: Float32Array,
  vecB: Float32Array,
  config: DistanceConfig,
  sqNormA?: number,
  sqNormB?: number
): number {
  if (config.distanceFunction === 'custom' && config.customDistanceFunction) {
    return config.customDistanceFunction(
      { vector: vecA },
      { vector: vecB }
    );
  }

  switch (config.distanceFunction) {
    case 'euclidean':
      return computeEuclideanDistance(vecA, vecB, sqNormA, sqNormB);
    case 'cosine':
      return computeCosineDistance(vecA, vecB, sqNormA, sqNormB);
    case 'inner_product':
      return computeInnerProductDistance(vecA, vecB, config);
    default:
      throw new Error(`不支持的距离函数: ${config.distanceFunction}`);
  }
}