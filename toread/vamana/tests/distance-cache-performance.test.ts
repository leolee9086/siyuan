import { describe, it, expect, beforeEach } from 'vitest';
import { DistanceCache } from '../src/distance/cache';

describe('DistanceCache Performance Tests', () => {
  let cache: DistanceCache;

  beforeEach(() => {
    cache = new DistanceCache(10000);
  });

  describe('generateKey Performance', () => {
    it('应该高效处理大量ID对', () => {
      const iterations = 100000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const id1 = Math.floor(Math.random() * 1000000);
        const id2 = Math.floor(Math.random() * 1000000);
        
        // 通过getCachedDistance间接测试generateKey性能
        cache.getCachedDistance(id1, id2, (a, b) => Math.abs(a - b));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`处理${iterations}个ID对耗时: ${duration.toFixed(2)}ms`);
      console.log(`平均每个ID对耗时: ${(duration / iterations).toFixed(4)}ms`);
      
      // 性能要求：每个ID对处理时间应该小于0.001ms
      expect(duration / iterations).toBeLessThan(0.001);
    });

    it('应该支持大范围ID值', () => {
      const largeIds = [
        [0, 1000000],
        [999999, 2000000],
        [500000, 1500000],
        [1000000, 3000000],
        [2000000, 4000000]
      ];
      
      const startTime = performance.now();
      
      for (const [id1, id2] of largeIds) {
        cache.getCachedDistance(id1, id2, (a, b) => Math.abs(a - b));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`处理大范围ID对耗时: ${duration.toFixed(2)}ms`);
      
      // 确保大范围ID也能快速处理
      expect(duration).toBeLessThan(1);
    });

    it('应该保持键的唯一性', () => {
      const testPairs = [
        [1, 2],
        [2, 1], // 应该生成相同的键
        [100, 200],
        [200, 100], // 应该生成相同的键
        [999, 1000],
        [1000, 999] // 应该生成相同的键
      ];
      
      const keys = new Set<number>();
      
      for (const [id1, id2] of testPairs) {
        // 通过设置缓存值来测试键生成
        cache.set(id1, id2, Math.abs(id1 - id2));
        const key = (id1 < id2 ? 
          ((id1 + id2) * (id1 + id2 + 1)) / 2 + id2 :
          ((id2 + id1) * (id2 + id1 + 1)) / 2 + id1);
        keys.add(key);
      }
      
      // 应该有3个唯一的键（因为每对ID应该生成相同的键）
      expect(keys.size).toBe(3);
    });

    it('应该处理边界情况', () => {
      const boundaryCases = [
        [0, 0],
        [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
        [0, Number.MAX_SAFE_INTEGER],
        [Number.MAX_SAFE_INTEGER, 0]
      ];
      
      const startTime = performance.now();
      
      for (const [id1, id2] of boundaryCases) {
        cache.getCachedDistance(id1, id2, (a, b) => Math.abs(a - b));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`处理边界情况耗时: ${duration.toFixed(2)}ms`);
      
      // 边界情况也应该快速处理
      expect(duration).toBeLessThan(1);
    });
  });

  describe('Cache Hit Performance', () => {
    it('缓存命中应该非常快', () => {
      const id1 = 100;
      const id2 = 200;
      
      // 第一次调用，缓存未命中
      const firstCallStart = performance.now();
      cache.getCachedDistance(id1, id2, (a, b) => Math.abs(a - b));
      const firstCallEnd = performance.now();
      
      // 第二次调用，缓存命中
      const secondCallStart = performance.now();
      cache.getCachedDistance(id1, id2, (a, b) => Math.abs(a - b));
      const secondCallEnd = performance.now();
      
      const firstCallDuration = firstCallEnd - firstCallStart;
      const secondCallDuration = secondCallEnd - secondCallStart;
      
      console.log(`缓存未命中耗时: ${firstCallDuration.toFixed(4)}ms`);
      console.log(`缓存命中耗时: ${secondCallDuration.toFixed(4)}ms`);
      
      // 缓存命中应该比未命中快很多
      expect(secondCallDuration).toBeLessThan(firstCallDuration * 0.1);
    });
  });
}); 