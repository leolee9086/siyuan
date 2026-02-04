import { test, expect, describe } from 'vitest';
import { 
  computeEuclideanDistance, 
  computeCosineDistance, 
  computeInnerProductDistance,
  computeDistance,
  DistanceCache
} from '../src/distance';

describe('Distance Algorithm Correctness Tests', () => {
  
  test('should compute correct Euclidean distance', () => {
    // 测试用例1: 单位向量
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([0, 1, 0]);
    const distance = computeEuclideanDistance(vec1, vec2);
    expect(distance).toBeCloseTo(Math.sqrt(2), 6); // √(1² + 1² + 0²) = √2
    
    // 测试用例2: 相同向量
    const vec3 = new Float32Array([1, 2, 3]);
    const vec4 = new Float32Array([1, 2, 3]);
    const distance2 = computeEuclideanDistance(vec3, vec4);
    expect(distance2).toBeCloseTo(0, 6);
    
    // 测试用例3: 相反向量
    const vec5 = new Float32Array([1, 1, 1]);
    const vec6 = new Float32Array([-1, -1, -1]);
    const distance3 = computeEuclideanDistance(vec5, vec6);
    expect(distance3).toBeCloseTo(Math.sqrt(12), 6); // √(2² + 2² + 2²) = √12
  });
  
  test('should compute correct Cosine distance', () => {
    // 测试用例1: 正交向量 (90度角)
    const vec1 = new Float32Array([1, 0]);
    const vec2 = new Float32Array([0, 1]);
    const distance = computeCosineDistance(vec1, vec2);
    expect(distance).toBeCloseTo(1, 6); // cos(90°) = 0, distance = 1 - 0 = 1
    
    // 测试用例2: 相同向量 (0度角)
    const vec3 = new Float32Array([1, 1]);
    const vec4 = new Float32Array([1, 1]);
    const distance2 = computeCosineDistance(vec3, vec4);
    expect(distance2).toBeCloseTo(0, 6); // cos(0°) = 1, distance = 1 - 1 = 0
    
    // 测试用例3: 相反向量 (180度角)
    const vec5 = new Float32Array([1, 0]);
    const vec6 = new Float32Array([-1, 0]);
    const distance3 = computeCosineDistance(vec5, vec6);
    expect(distance3).toBeCloseTo(2, 6); // cos(180°) = -1, distance = 1 - (-1) = 2
    
    // 测试用例4: 45度角
    const vec7 = new Float32Array([1, 0]);
    const vec8 = new Float32Array([1, 1]);
    const distance4 = computeCosineDistance(vec7, vec8);
    const expectedCos = 1 / Math.sqrt(2); // cos(45°) = 1/√2
    expect(distance4).toBeCloseTo(1 - expectedCos, 6);
    
    // 测试用例5: 零向量
    const zeroVec = new Float32Array([0, 0]);
    const unitVec = new Float32Array([1, 0]);
    const distance5 = computeCosineDistance(zeroVec, unitVec);
    expect(distance5).toBeCloseTo(1, 6); // 零向量应该返回最大距离
    
    // 测试用例6: 两个零向量
    const zeroVec2 = new Float32Array([0, 0]);
    const distance6 = computeCosineDistance(zeroVec, zeroVec2);
    expect(distance6).toBeCloseTo(1, 6); // 两个零向量应该返回最大距离
    
    // 测试用例7: 验证余弦距离的范围 [0, 2]
    const vec9 = new Float32Array([1, 0]);
    const vec10 = new Float32Array([0.5, 0.5]);
    const distance7 = computeCosineDistance(vec9, vec10);
    expect(distance7).toBeGreaterThanOrEqual(0);
    expect(distance7).toBeLessThanOrEqual(2);
    
    // 测试用例8: 验证余弦距离的对称性
    const distance8a = computeCosineDistance(vec9, vec10);
    const distance8b = computeCosineDistance(vec10, vec9);
    expect(distance8a).toBeCloseTo(distance8b, 6);
  });
  
  test('should compute correct Inner Product distance', () => {
    // 测试用例1: 正交向量
    const vec1 = new Float32Array([1, 0]);
    const vec2 = new Float32Array([0, 1]);
    const distance = computeInnerProductDistance(vec1, vec2);
    expect(distance).toBeCloseTo(0, 6); // 内积 = 0, 距离 = -0 = 0
    
    // 测试用例2: 相同向量
    const vec3 = new Float32Array([1, 2]);
    const vec4 = new Float32Array([1, 2]);
    const distance2 = computeInnerProductDistance(vec3, vec4);
    expect(distance2).toBeCloseTo(-5, 6); // 内积 = 1² + 2² = 5, 距离 = -5
    
    // 测试用例3: 相反向量
    const vec5 = new Float32Array([1, 1]);
    const vec6 = new Float32Array([-1, -1]);
    const distance3 = computeInnerProductDistance(vec5, vec6);
    expect(distance3).toBeCloseTo(2, 6); // 内积 = -2, 距离 = -(-2) = 2
  });
  
  test('should handle edge cases correctly', () => {
    // 零向量测试
    const zeroVec = new Float32Array([0, 0, 0]);
    const unitVec = new Float32Array([1, 0, 0]);
    
    // 欧几里得距离: 零向量到单位向量的距离应该是1
    const euclideanDist = computeEuclideanDistance(zeroVec, unitVec);
    expect(euclideanDist).toBeCloseTo(1, 6);
    
    // 余弦距离: 零向量应该返回1（最大距离）
    const cosineDist = computeCosineDistance(zeroVec, unitVec);
    expect(cosineDist).toBeCloseTo(1, 6);
    
    // 内积距离: 零向量的内积应该是0
    const innerProductDist = computeInnerProductDistance(zeroVec, unitVec);
    expect(innerProductDist).toBeCloseTo(0, 6);
  });
  
  test('should work with computeDistance function', () => {
    const vec1 = new Float32Array([1, 0]);
    const vec2 = new Float32Array([0, 1]);
    
    // 测试欧几里得距离
    const euclideanDist = computeDistance(vec1, vec2, { distanceFunction: 'euclidean' });
    expect(euclideanDist).toBeCloseTo(Math.sqrt(2), 6);
    
    // 测试余弦距离
    const cosineDist = computeDistance(vec1, vec2, { distanceFunction: 'cosine' });
    expect(cosineDist).toBeCloseTo(1, 6);
    
    // 测试内积距离
    const innerProductDist = computeDistance(vec1, vec2, { distanceFunction: 'inner_product' });
    expect(innerProductDist).toBeCloseTo(0, 6);
  });
  
  test('should handle DistanceCache correctly', () => {
    const cache = new DistanceCache();
    const nodes = [
      { vector: new Float32Array([1, 0]) },
      { vector: new Float32Array([0, 1]) },
      { vector: new Float32Array([1, 1]) }
    ];
    
    // 第一次计算应该缓存
    const dist1 = cache.getCachedDistance(0, 1, (id1, id2) => {
      return computeEuclideanDistance(nodes[id1].vector, nodes[id2].vector);
    });
    expect(dist1).toBeCloseTo(Math.sqrt(2), 6);
    
    // 第二次计算应该从缓存获取
    const dist2 = cache.getCachedDistance(0, 1, (id1, id2) => {
      return computeEuclideanDistance(nodes[id1].vector, nodes[id2].vector);
    });
    expect(dist2).toBeCloseTo(Math.sqrt(2), 6);
    
    // 检查缓存统计
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5, 6);
  });
  
  test('should handle symmetric caching correctly', () => {
    const cache = new DistanceCache();
    const nodes = [
      { vector: new Float32Array([1, 0]) },
      { vector: new Float32Array([0, 1]) }
    ];
    
    // 计算 (0,1) 的距离
    const dist1 = cache.getCachedDistance(0, 1, (id1, id2) => {
      return computeEuclideanDistance(nodes[id1].vector, nodes[id2].vector);
    });
    
    // 计算 (1,0) 的距离应该从缓存获取
    const dist2 = cache.getCachedDistance(1, 0, (id1, id2) => {
      return computeEuclideanDistance(nodes[id1].vector, nodes[id2].vector);
    });
    
    expect(dist1).toBeCloseTo(dist2, 6);
    
    const stats = cache.getStats();
    expect(stats.hits).toBe(1); // (1,0) 应该命中缓存
    expect(stats.misses).toBe(1); // (0,1) 应该未命中
  });
}); 