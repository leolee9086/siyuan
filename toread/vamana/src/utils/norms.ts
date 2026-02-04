
/**
 * 计算向量的平方范数（8路循环展开优化版本）
 * @param vec 输入向量
 * @returns 向量的平方范数
 */
export function calculateSqNorm(vec: Float32Array): number {
  let sum = 0;
  const len = vec.length;
  
  // 8路循环展开：处理能被8整除的部分
  const unrolledLen = len - (len % 8);
  let i = 0;
  for (; i < unrolledLen; i += 8) {
    sum += vec[i] * vec[i] + 
           vec[i + 1] * vec[i + 1] + 
           vec[i + 2] * vec[i + 2] + 
           vec[i + 3] * vec[i + 3] + 
           vec[i + 4] * vec[i + 4] + 
           vec[i + 5] * vec[i + 5] + 
           vec[i + 6] * vec[i + 6] + 
           vec[i + 7] * vec[i + 7];
  }
  
  // 处理剩余元素
  for (; i < len; i++) {
    sum += vec[i] * vec[i];
  }
  
  return sum;
}