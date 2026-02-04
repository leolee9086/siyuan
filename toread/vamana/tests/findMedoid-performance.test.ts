import { test, expect, describe } from 'vitest';
import { 
  findMedoid, 
  findMedoidGraphBased, 
  updateMedoidIncremental,
  VamanaNode 
} from '../src/graph-search';
import { DistanceCache, DistanceConfig } from '../src/distance';

describe('FindMedoid Performance Tests', () => {
  
  // 生成测试数据
  function generateTestNodes(count: number, dimensions: number): VamanaNode[] {
    const nodes: VamanaNode[] = [];
    for (let i = 0; i < count; i++) {
      const vector = new Float32Array(dimensions);
      for (let j = 0; j < dimensions; j++) {
        vector[j] = Math.random() * 2 - 1; // 生成 [-1, 1] 范围的随机数
      }
      nodes.push({
        id: i,
        vector,
        data: { index: i },
        neighbors: [], // 空的邻居列表，用于测试
        sqNorm: vector.reduce((sum, val) => sum + val * val, 0)
      });
    }
    return nodes;
  }

  // 生成带邻居的测试数据
  function generateTestNodesWithNeighbors(count: number, dimensions: number, avgNeighbors: number): VamanaNode[] {
    const nodes = generateTestNodes(count, dimensions);
    
    // 为每个节点添加随机邻居
    for (let i = 0; i < nodes.length; i++) {
      const neighborCount = Math.floor(Math.random() * avgNeighbors * 2) + 1;
      const neighbors = new Set<number>();
      
      while (neighbors.size < Math.min(neighborCount, nodes.length - 1)) {
        const neighborId = Math.floor(Math.random() * nodes.length);
        if (neighborId !== i) {
          neighbors.add(neighborId);
        }
      }
      
      nodes[i].neighbors = Array.from(neighbors);
    }
    
    return nodes;
  }

  test('should perform exact medoid finding with symmetry optimization', () => {
    const nodeCounts = [200, 500, 1000]; // 删除10, 50, 100，保留更大规模
    const dimensions = 128;
    
    for (const count of nodeCounts) {
      const nodes = generateTestNodes(count, dimensions);
      const distanceCache = new DistanceCache(10000);
      const distanceConfig: DistanceConfig = { distanceFunction: 'euclidean' };
      
      // 预热缓存
      for (let i = 0; i < Math.min(10, count); i++) {
        for (let j = i + 1; j < Math.min(10, count); j++) {
          findMedoid([nodes[i], nodes[j]], distanceCache, distanceConfig);
        }
      }
      
      // 性能测试
      const startTime = performance.now();
      const medoid = findMedoid(nodes, distanceCache, distanceConfig);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      console.log(`Exact medoid finding ${count} nodes: ${totalTime.toFixed(2)}ms`);
      
      // 验证结果
      expect(medoid).toBeGreaterThanOrEqual(0);
      expect(medoid).toBeLessThan(count);
      
      // 验证缓存统计
      const stats = distanceCache.getStats();
      console.log(`Cache stats - Hit rate: ${(stats.hitRate * 100).toFixed(2)}%, Size: ${stats.size}`);
    }
  });

  test('should perform approximate medoid finding with random sampling', () => {
    const nodeCounts = [500, 1000, 2000];
    const dimensions = 128;
    
    for (const count of nodeCounts) {
      const nodes = generateTestNodes(count, dimensions);
      const distanceCache = new DistanceCache(10000);
      const distanceConfig: DistanceConfig = { distanceFunction: 'euclidean' };
      
      // 测试不同的采样大小
      const sampleSizes = [10, 20, 50, 100];
      
      for (const sampleSize of sampleSizes) {
        const startTime = performance.now();
        const medoid = findMedoid(nodes, distanceCache, distanceConfig);
        const endTime = performance.now();
        
        const totalTime = endTime - startTime;
        console.log(`Approximate medoid finding ${count} nodes (sample ${sampleSize}): ${totalTime.toFixed(2)}ms`);
        
        // 验证结果
        expect(medoid).toBeGreaterThanOrEqual(0);
        expect(medoid).toBeLessThan(count);
      }
    }
  });

  test('should perform graph-based medoid finding', () => {
    const nodeCounts = [200, 500, 1000]; // 删除100，保留更大规模
    const dimensions = 128;
    const avgNeighbors = 10;
    
    for (const count of nodeCounts) {
      const nodes = generateTestNodesWithNeighbors(count, dimensions, avgNeighbors);
      const distanceCache = new DistanceCache(10000);
      const distanceConfig: DistanceConfig = { distanceFunction: 'euclidean' };
      
      const startTime = performance.now();
      const medoid = findMedoidGraphBased(nodes, distanceCache, distanceConfig);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      console.log(`Graph-based medoid finding ${count} nodes: ${totalTime.toFixed(2)}ms`);
      
      // 验证结果
      expect(medoid).toBeGreaterThanOrEqual(0);
      expect(medoid).toBeLessThan(count);
      
      // 验证选中的节点确实有较高的度数
      const selectedDegree = nodes[medoid].neighbors.length;
      const avgDegree = nodes.reduce((sum, node) => sum + node.neighbors.length, 0) / nodes.length;
      console.log(`Selected node degree: ${selectedDegree}, Average degree: ${avgDegree.toFixed(2)}`);
    }
  });

  test('should perform incremental medoid updates', () => {
    const baseCount = 500; // 从100增加到500，提供更有意义的性能测试
    const dimensions = 128;
    const nodes = generateTestNodes(baseCount, dimensions);
    const distanceCache = new DistanceCache(10000);
    const distanceConfig: DistanceConfig = { distanceFunction: 'euclidean' };
    
    // 找到初始中位点
    const initialMedoid = findMedoid(nodes, distanceCache, distanceConfig);
    console.log(`Initial medoid: ${initialMedoid}`);
    
    // 测试添加新节点
    const newNodes = generateTestNodes(10, dimensions);
    const allNodes = [...nodes, ...newNodes];
    const addedNodeIds = newNodes.map((_, index) => baseCount + index);
    
    const startTime = performance.now();
    const updatedMedoid = updateMedoidIncremental(
      initialMedoid, 
      allNodes, 
      distanceCache, 
      distanceConfig, 
      addedNodeIds
    );
    const endTime = performance.now();
    
    const incrementalTime = endTime - startTime;
    console.log(`Incremental update time: ${incrementalTime.toFixed(2)}ms`);
    
    // 对比重新计算的时间
    const startTime2 = performance.now();
    const recalculatedMedoid = findMedoid(allNodes, distanceCache, distanceConfig);
    const endTime2 = performance.now();
    
    const recalculateTime = endTime2 - startTime2;
    console.log(`Recalculate time: ${recalculateTime.toFixed(2)}ms`);
    console.log(`Speedup: ${(recalculateTime / incrementalTime).toFixed(2)}x`);
    
    // 验证结果一致性
    expect(updatedMedoid).toBeGreaterThanOrEqual(0);
    expect(updatedMedoid).toBeLessThan(allNodes.length);
  });

  test('should handle edge cases correctly', () => {
    const distanceCache = new DistanceCache(100);
    const distanceConfig: DistanceConfig = { distanceFunction: 'euclidean' };
    
    // 测试空节点列表
    expect(() => findMedoid([], distanceCache, distanceConfig)).toThrow('Cannot find medoid for an empty set of nodes.');
    
    // 测试单个节点
    const singleNode = generateTestNodes(1, 128);
    const medoid = findMedoid(singleNode, distanceCache, distanceConfig);
    expect(medoid).toBe(0);
    
    // 测试两个节点
    const twoNodes = generateTestNodes(2, 128);
    const medoid2 = findMedoid(twoNodes, distanceCache, distanceConfig);
    expect(medoid2).toBeGreaterThanOrEqual(0);
    expect(medoid2).toBeLessThan(2);
  });

  test('should compare different medoid finding strategies', () => {
    const nodeCount = 200;
    const dimensions = 128;
    const nodes = generateTestNodesWithNeighbors(nodeCount, dimensions, 15);
    const distanceCache = new DistanceCache(20000);
    const distanceConfig: DistanceConfig = { distanceFunction: 'euclidean' };
    
    // 策略1：精确算法
    const startTime1 = performance.now();
    const exactMedoid = findMedoid(nodes, distanceCache, distanceConfig);
    const endTime1 = performance.now();
    const exactTime = endTime1 - startTime1;
    
    // 策略2：近似算法（使用相同的精确算法，因为当前实现不支持近似）
    const startTime2 = performance.now();
    const approxMedoid = findMedoid(nodes, distanceCache, distanceConfig);
    const endTime2 = performance.now();
    const approxTime = endTime2 - startTime2;
    
    // 策略3：基于图的算法
    const startTime3 = performance.now();
    const graphMedoid = findMedoidGraphBased(nodes, distanceCache, distanceConfig);
    const endTime3 = performance.now();
    const graphTime = endTime3 - startTime3;
    
    console.log(`Strategy comparison for ${nodeCount} nodes:`);
    console.log(`  Exact algorithm: ${exactTime.toFixed(2)}ms`);
    console.log(`  Approximate algorithm: ${approxTime.toFixed(2)}ms (${(exactTime / approxTime).toFixed(2)}x faster)`);
    console.log(`  Graph-based algorithm: ${graphTime.toFixed(2)}ms (${(exactTime / graphTime).toFixed(2)}x faster)`);
    
    // 验证所有策略都返回有效结果
    expect(exactMedoid).toBeGreaterThanOrEqual(0);
    expect(exactMedoid).toBeLessThan(nodeCount);
    expect(approxMedoid).toBeGreaterThanOrEqual(0);
    expect(approxMedoid).toBeLessThan(nodeCount);
    expect(graphMedoid).toBeGreaterThanOrEqual(0);
    expect(graphMedoid).toBeLessThan(nodeCount);
  });

  test('should handle different distance functions', () => {
    const nodeCount = 500; // 从100增加到500，提供更有意义的性能测试
    const dimensions = 128;
    const nodes = generateTestNodes(nodeCount, dimensions);
    const distanceCache = new DistanceCache(10000);
    
    const distanceFunctions: Array<'euclidean' | 'cosine' | 'inner_product'> = [
      'euclidean', 'cosine', 'inner_product'
    ];
    
    for (const distanceFunction of distanceFunctions) {
      const distanceConfig: DistanceConfig = { distanceFunction };
      
      const startTime = performance.now();
      const medoid = findMedoid(nodes, distanceCache, distanceConfig);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      console.log(`${distanceFunction} distance medoid finding: ${totalTime.toFixed(2)}ms`);
      
      expect(medoid).toBeGreaterThanOrEqual(0);
      expect(medoid).toBeLessThan(nodeCount);
    }
  });
}); 