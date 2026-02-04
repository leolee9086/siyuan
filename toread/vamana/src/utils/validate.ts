import type {Vector} from '../types';
/**
 * 验证输入向量
 */
export function validateVector(vector: Vector): Float32Array {
  if (!vector) {
    throw new Error('向量不能为空');
  }

  if (vector instanceof Float32Array && vector.length === 0) {
    throw new Error('向量不能为空数组');
  }

  if (Array.isArray(vector) && vector.length === 0) {
    throw new Error('向量不能为空数组');
  }

  const vectorArray = vector instanceof Float32Array ? vector : new Float32Array(vector);
  
  // 检查NaN和Infinity值
  for (let i = 0; i < vectorArray.length; i++) {
    if (!Number.isFinite(vectorArray[i])) {
      throw new Error('向量包含无效值（NaN或Infinity）');
    }
  }

  return vectorArray;
}
