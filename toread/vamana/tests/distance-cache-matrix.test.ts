import { test, expect, describe } from 'vitest';
import { DistanceCache } from '../src/distance';

describe('DistanceCache Matrix Implementation Tests', () => {
  
  // 模拟距离计算函数
  function mockDistanceFunction(id1: number, id2: number): number {
    // 模拟一个简单的距离计算，返回两个ID的差的绝对值
    return Math.abs(id1 - id2);
  }

  test('should use matrix-style caching with reference sharing', () => {
    const cache = new DistanceCache(1000);
    
    // 测试相同距离值的引用共享
    const distance1 = cache.getCachedDistance(1, 2, mockDistanceFunction, 'euclidean');
    const distance2 = cache.getCachedDistance(3, 4, mockDistanceFunction, 'euclidean');
    const distance3 = cache.getCachedDistance(5, 6, mockDistanceFunction, 'euclidean');
    
    // 所有距离都应该是1，因为它们都是相邻的ID
    expect(distance1).toBe(1);
    expect(distance2).toBe(1);
    expect(distance3).toBe(1);
    
    // 验证缓存统计
    const stats = cache.getStats();
    expect(stats.misses).toBe(3); // 前三次应该是miss
    expect(stats.hits).toBe(0); // 前三次没有命中
    
    // 再次访问相同的距离，应该命中缓存
    const distance1Again = cache.getCachedDistance(1, 2, mockDistanceFunction, 'euclidean');
    const distance2Again = cache.getCachedDistance(3, 4, mockDistanceFunction, 'euclidean');
    
    expect(distance1Again).toBe(1);
    expect(distance2Again).toBe(1);
    
    const statsAfter = cache.getStats();
    expect(statsAfter.hits).toBe(2); // 应该有两次命中
  });

  test('should avoid key computation overhead', () => {
    const cache = new DistanceCache(100);
    
    // 测试大量重复访问的性能
    const testCount = 10000;
    const startTime = performance.now();
    
    // 重复访问相同的键对
    for (let i = 0; i < testCount; i++) {
      cache.getCachedDistance(1, 2, mockDistanceFunction, 'euclidean');
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / testCount;
    
    console.log(`Key computation avoidance test: ${avgTime.toFixed(6)}ms per call`);
    
    // 验证缓存命中率应该很高
    const stats = cache.getStats();
    expect(stats.hitRate).toBeGreaterThan(0.99); // 几乎100%命中率
    
    // 验证只有一次miss（第一次），其余都是hit
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(testCount - 1);
  });

  test('should handle symmetric matrix properties', () => {
    const cache = new DistanceCache(100);
    
    // 测试矩阵的对称性
    cache.getCachedDistance(1, 2, mockDistanceFunction, 'euclidean');
    
    // 验证反向键也能找到相同的值
    expect(cache.has(2, 1)).toBe(true);
    
    const forwardValue = cache.getCachedDistance(1, 2, mockDistanceFunction, 'euclidean');
    const reverseValue = cache.getCachedDistance(2, 1, mockDistanceFunction, 'euclidean');
    
    expect(forwardValue).toBe(reverseValue);
    
    // 验证缓存统计 - 第一次访问是miss，第二次和第三次都是hit
    const stats = cache.getStats();
    expect(stats.misses).toBe(1); // 第一次访问是miss
    expect(stats.hits).toBe(2); // 第二次和第三次访问都是hit
  });

  test('should optimize memory usage through reference sharing', () => {
    const cache = new DistanceCache(1000);
    
    // 创建大量相同距离的缓存项
    const pairs = [];
    for (let i = 0; i < 100; i++) {
      pairs.push([i, i + 1]); // 所有距离都是1
    }
    
    // 填充缓存
    for (const [id1, id2] of pairs) {
      cache.getCachedDistance(id1, id2, mockDistanceFunction, 'euclidean');
    }
    
    // 验证所有距离都是1
    for (const [id1, id2] of pairs) {
      const distance = cache.getCachedDistance(id1, id2, mockDistanceFunction, 'euclidean');
      expect(distance).toBe(1);
    }
    
    const stats = cache.getStats();
    console.log(`Memory optimization test - Cache size: ${stats.size}, Memory usage: ${stats.memoryUsage} bytes`);
    
    // 验证缓存大小和内存使用
    expect(stats.size).toBe(100); // 应该有100个不同的键对
    expect(stats.memoryUsage).toBe(800); // 100 * 8 bytes
  });

  test('should handle edge cases in matrix caching', () => {
    const cache = new DistanceCache(100);
    
    // 测试边界情况
    const edgeCases = [
      [0, 0], // 相同ID
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1], // 大数字
      [-1, 1], // 负数
      [0, Number.MAX_SAFE_INTEGER] // 极大范围
    ];
    
    for (const [id1, id2] of edgeCases) {
      const distance = cache.getCachedDistance(id1, id2, mockDistanceFunction, 'euclidean');
      expect(typeof distance).toBe('number');
      expect(distance).toBeGreaterThanOrEqual(0);
      
      // 验证对称性
      const reverseDistance = cache.getCachedDistance(id2, id1, mockDistanceFunction, 'euclidean');
      expect(distance).toBe(reverseDistance);
    }
    
    const stats = cache.getStats();
    expect(stats.misses).toBe(edgeCases.length); // 每个边界情况都应该是一次miss
  });

  test('should maintain cache consistency under concurrent-like access', () => {
    const cache = new DistanceCache(1000);
    
    // 模拟并发访问模式
    const accessPatterns = [
      // 模式1：顺序访问
      () => {
        for (let i = 0; i < 50; i++) {
          cache.getCachedDistance(i, i + 1, mockDistanceFunction, 'euclidean');
        }
      },
      // 模式2：随机访问
      () => {
        for (let i = 0; i < 50; i++) {
          const id1 = Math.floor(Math.random() * 100);
          const id2 = Math.floor(Math.random() * 100);
          if (id1 !== id2) {
            cache.getCachedDistance(id1, id2, mockDistanceFunction, 'euclidean');
          }
        }
      },
      // 模式3：重复访问热点数据
      () => {
        for (let i = 0; i < 100; i++) {
          cache.getCachedDistance(i % 10, (i % 10) + 1, mockDistanceFunction, 'euclidean');
        }
      }
    ];
    
    // 执行所有访问模式
    for (const pattern of accessPatterns) {
      pattern();
    }
    
    const stats = cache.getStats();
    console.log(`Concurrent-like access test - Hit rate: ${(stats.hitRate * 100).toFixed(2)}%, Evictions: ${stats.evictions}`);
    
    // 验证缓存一致性
    expect(stats.size).toBeLessThanOrEqual(1000); // 不应该超过最大大小
    expect(stats.hitRate).toBeGreaterThan(0); // 应该有缓存命中
  });

  test('should demonstrate matrix-style key generation efficiency', () => {
    const cache = new DistanceCache(100);
    
    // 测试不同范围的ID对
    const testRanges = [
      [0, 100], // 小范围
      [1000, 1100], // 中等范围
      [1000000, 1000100] // 大范围
    ];
    
    for (const [start, end] of testRanges) {
      const startTime = performance.now();
      
      // 在范围内创建缓存项
      for (let i = start; i < end; i++) {
        cache.getCachedDistance(i, i + 1, mockDistanceFunction, 'euclidean');
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / (end - start);
      
      console.log(`Key generation efficiency for range [${start}, ${end}]: ${avgTime.toFixed(6)}ms per key`);
      
      // 验证所有距离都是1
      for (let i = start; i < end; i++) {
        const distance = cache.getCachedDistance(i, i + 1, mockDistanceFunction, 'euclidean');
        expect(distance).toBe(1);
      }
    }
    
    const stats = cache.getStats();
    expect(stats.size).toBeLessThanOrEqual(100); // 受缓存大小限制
  });
}); 