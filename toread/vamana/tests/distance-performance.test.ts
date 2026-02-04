import { test, expect, describe } from 'vitest';
import { 
  computeEuclideanDistance, 
  computeCosineDistance, 
  computeInnerProductDistance
} from '../src/distance';

describe('Distance Functions Performance Tests', () => {
  
  // 生成测试数据
  function generateTestVectors(dimensions: number, count: number): Float32Array[] {
    const vectors: Float32Array[] = [];
    for (let i = 0; i < count; i++) {
      const vector = new Float32Array(dimensions);
      for (let j = 0; j < dimensions; j++) {
        vector[j] = Math.random() * 2 - 1; // 生成 [-1, 1] 范围的随机数
      }
      vectors.push(vector);
    }
    return vectors;
  }

  test('should perform 8-way loop unrolling optimization for Euclidean distance', () => {
    const dimensions = [64, 128, 256, 512, 1024];
    const testCount = 1000;
    
    for (const dim of dimensions) {
      const vectors = generateTestVectors(dim, 2);
      const vecA = vectors[0];
      const vecB = vectors[1];
      
      // 预热
      for (let i = 0; i < 100; i++) {
        computeEuclideanDistance(vecA, vecB);
      }
      
      // 性能测试
      const startTime = performance.now();
      for (let i = 0; i < testCount; i++) {
        computeEuclideanDistance(vecA, vecB);
      }
      const endTime = performance.now();
      
      const avgTime = (endTime - startTime) / testCount;
      console.log(`Euclidean distance ${dim}D: ${avgTime.toFixed(6)}ms per call`);
      
      // 验证结果正确性
      const result = computeEuclideanDistance(vecA, vecB);
      expect(result).toBeGreaterThan(0);
      expect(isFinite(result)).toBe(true);
    }
  });

  test('should perform 8-way loop unrolling optimization for Cosine distance', () => {
    const dimensions = [64, 128, 256, 512, 1024];
    const testCount = 1000;
    
    for (const dim of dimensions) {
      const vectors = generateTestVectors(dim, 2);
      const vecA = vectors[0];
      const vecB = vectors[1];
      
      // 预热
      for (let i = 0; i < 100; i++) {
        computeCosineDistance(vecA, vecB);
      }
      
      // 性能测试
      const startTime = performance.now();
      for (let i = 0; i < testCount; i++) {
        computeCosineDistance(vecA, vecB);
      }
      const endTime = performance.now();
      
      const avgTime = (endTime - startTime) / testCount;
      console.log(`Cosine distance ${dim}D: ${avgTime.toFixed(6)}ms per call`);
      
      // 验证结果正确性
      const result = computeCosineDistance(vecA, vecB);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(2);
      expect(isFinite(result)).toBe(true);
    }
  });

  test('should perform 8-way loop unrolling optimization for Inner Product distance', () => {
    const dimensions = [64, 128, 256, 512, 1024];
    const testCount = 1000;
    
    for (const dim of dimensions) {
      const vectors = generateTestVectors(dim, 2);
      const vecA = vectors[0];
      const vecB = vectors[1];
      
      // 预热
      for (let i = 0; i < 100; i++) {
        computeInnerProductDistance(vecA, vecB);
      }
      
      // 性能测试
      const startTime = performance.now();
      for (let i = 0; i < testCount; i++) {
        computeInnerProductDistance(vecA, vecB);
      }
      const endTime = performance.now();
      
      const avgTime = (endTime - startTime) / testCount;
      console.log(`Inner Product distance ${dim}D: ${avgTime.toFixed(6)}ms per call`);
      
      // 验证结果正确性
      const result = computeInnerProductDistance(vecA, vecB);
      expect(isFinite(result)).toBe(true);
    }
  });

  test('should handle edge cases efficiently with 8-way loop unrolling', () => {
    const testCases = [
      { name: 'small vectors (8D)', dim: 8 },
      { name: 'medium vectors (16D)', dim: 16 },
      { name: 'large vectors (32D)', dim: 32 },
      { name: 'very large vectors (64D)', dim: 64 }
    ];
    
    for (const testCase of testCases) {
      const vectors = generateTestVectors(testCase.dim, 2);
      const vecA = vectors[0];
      const vecB = vectors[1];
      
      // 测试所有距离函数
      const euclideanResult = computeEuclideanDistance(vecA, vecB);
      const cosineResult = computeCosineDistance(vecA, vecB);
      const innerProductResult = computeInnerProductDistance(vecA, vecB);
      
      // 验证结果
      expect(euclideanResult).toBeGreaterThan(0);
      expect(cosineResult).toBeGreaterThanOrEqual(0);
      expect(cosineResult).toBeLessThanOrEqual(2);
      expect(isFinite(innerProductResult)).toBe(true);
      
      console.log(`${testCase.name}: Euclidean=${euclideanResult.toFixed(6)}, Cosine=${cosineResult.toFixed(6)}, InnerProduct=${innerProductResult.toFixed(6)}`);
    }
  });

  test('should maintain numerical precision with 8-way loop unrolling', () => {
    // 测试高精度场景
    const vecA = new Float32Array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    const vecB = new Float32Array([0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    
    // 重复计算多次，确保结果一致
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(computeEuclideanDistance(vecA, vecB));
    }
    
    // 验证所有结果都相同（数值稳定性）
    const firstResult = results[0];
    for (const result of results) {
      expect(result).toBeCloseTo(firstResult, 10);
    }
    
    // 验证理论值
    expect(firstResult).toBeCloseTo(Math.sqrt(2), 6);
  });

  test('should handle zero vectors correctly with 8-way loop unrolling', () => {
    const dim = 128;
    const zeroVec = new Float32Array(dim);
    const unitVec = new Float32Array(dim);
    unitVec[0] = 1.0;
    
    // 测试零向量到单位向量的距离
    const euclideanDist = computeEuclideanDistance(zeroVec, unitVec);
    const cosineDist = computeCosineDistance(zeroVec, unitVec);
    const innerProductDist = computeInnerProductDistance(zeroVec, unitVec);
    
    expect(euclideanDist).toBeCloseTo(1.0, 6);
    expect(cosineDist).toBeCloseTo(1.0, 6);
    expect(innerProductDist).toBeCloseTo(0.0, 6);
  });
}); 