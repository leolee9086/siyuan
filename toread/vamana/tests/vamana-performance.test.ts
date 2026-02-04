import { test, expect, describe, beforeAll, beforeEach } from 'vitest';
import { createVamanaIndex, VamanaIndex, VamanaConfig } from '../src/vamana-index';
import { Vector, SearchResult, NodeData } from '../src/common';
import { greedySearch, VamanaNode, SearchCandidate } from '../src/graph-search';
import { DistanceCache, DistanceConfig } from '../src/distance';
import { robustPruneStandard } from '../src/robust-prune';

// 辅助函数：生成随机向量
function generateRandomVector(dimension: number): Float32Array {
  const vector = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    vector[i] = Math.random();
  }
  return vector;
}

// 辅助函数：生成数据集
function generateDataset(numVectors: number, dimension: number): Float32Array[] {
  const dataset: Float32Array[] = [];
  for (let i = 0; i < numVectors; i++) {
    dataset.push(generateRandomVector(dimension));
  }
  return dataset;
}

/**
 * 暴力搜索实现 - 用于对比召回率
 */
function bruteForceSearch(
  queryVector: Float32Array,
  vectors: Float32Array[],
  k: number,
  distanceFunction: 'euclidean' | 'cosine' | 'inner_product' = 'euclidean'
): Array<{ id: number; distance: number }> {
  const distances: Array<{ id: number; distance: number }> = []
  
  for (let i = 0; i < vectors.length; i++) {
    const distance = computeDistanceLocal(queryVector, vectors[i], distanceFunction)
    distances.push({ id: i, distance })
  }
  
  // 按距离排序
  distances.sort((a, b) => a.distance - b.distance)
  
  return distances.slice(0, k)
}

/**
 * 计算两个向量之间的距离
 */
function computeDistanceLocal(
  vecA: Float32Array,
  vecB: Float32Array,
  distanceFunction: 'euclidean' | 'cosine' | 'inner_product'
): number {
  switch (distanceFunction) {
    case 'euclidean': {
      let sum = 0
      for (let i = 0; i < vecA.length; i++) {
        const diff = vecA[i] - vecB[i]
        sum += diff * diff
      }
      return Math.sqrt(sum)
    }
    case 'cosine': {
      let dotProduct = 0
      let normA = 0
      let normB = 0
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
      }
      const normProduct = Math.sqrt(normA) * Math.sqrt(normB)
      return normProduct === 0 ? 1 : 1 - (dotProduct / normProduct)
    }
    case 'inner_product': {
      let sum = 0
      for (let i = 0; i < vecA.length; i++) {
        sum += vecA[i] * vecB[i]
      }
      return -sum
    }
    default:
      throw new Error(`不支持的距离函数: ${distanceFunction}`)
  }
}

/**
 * 计算召回率
 * @param approximateResults 近似搜索结果
 * @param exactResults 精确搜索结果
 * @returns 召回率 (0-1)
 */
function computeRecall(
  approximateResults: Array<{ id: number; distance: number }>,
  exactResults: Array<{ id: number; distance: number }>
): number {
  if (exactResults.length === 0) return 1.0
  
  const approximateIds = new Set(approximateResults.map(r => r.id))
  const exactIds = new Set(exactResults.map(r => r.id))
  
  let intersection = 0
  for (const id of exactIds) {
    if (approximateIds.has(id)) {
      intersection++
    }
  }
  
  return intersection / exactResults.length
}

// 性能分析工具函数
function analyzePerformanceBottlenecks(stats: any, searchTimes: number[], buildTime: number) {
  console.log('\n🔍 === 性能瓶颈分析 ===');
  
  // 构建性能分析
  console.log(`📊 构建性能:`);
  console.log(`  - 构建时间: ${buildTime.toFixed(2)} ms`);
  console.log(`  - 节点数量: ${stats.nodeCount}`);
  console.log(`  - 平均构建时间/节点: ${(buildTime / stats.nodeCount).toFixed(4)} ms/节点`);
  
  // 搜索性能分析
  const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
  const minSearchTime = Math.min(...searchTimes);
  const maxSearchTime = Math.max(...searchTimes);
  const searchTimeVariance = searchTimes.reduce((sum, time) => sum + Math.pow(time - avgSearchTime, 2), 0) / searchTimes.length;
  
  console.log(`\n🔍 搜索性能:`);
  console.log(`  - 平均搜索时间: ${avgSearchTime.toFixed(4)} ms`);
  console.log(`  - 最小搜索时间: ${minSearchTime.toFixed(4)} ms`);
  console.log(`  - 最大搜索时间: ${maxSearchTime.toFixed(4)} ms`);
  console.log(`  - 搜索时间方差: ${searchTimeVariance.toFixed(6)} ms²`);
  console.log(`  - 搜索时间标准差: ${Math.sqrt(searchTimeVariance).toFixed(4)} ms`);
  
  // 图结构分析
  console.log(`\n📈 图结构分析:`);
  console.log(`  - 平均出度: ${stats.avgOutDegree.toFixed(2)}`);
  console.log(`  - 最大出度: ${stats.maxOutDegree}`);
  console.log(`  - 图密度: ${stats.graphDensity.toFixed(6)}`);
  console.log(`  - 总边数: ${Math.round(stats.avgOutDegree * stats.nodeCount)}`);
  
  // 距离缓存分析
  const cacheStats = stats.distanceCacheStats;
  if (cacheStats) {
    console.log(`\n💾 距离缓存分析:`);
    console.log(`  - 缓存大小: ${cacheStats.size}`);
    console.log(`  - 命中次数: ${cacheStats.hits}`);
    console.log(`  - 未命中次数: ${cacheStats.misses}`);
    console.log(`  - 命中率: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
    console.log(`  - 总访问次数: ${cacheStats.hits + cacheStats.misses}`);
  }
  
  // 性能瓶颈识别
  console.log(`\n⚠️ 潜在性能瓶颈:`);
  
  if (buildTime / stats.nodeCount > 1.0) {
    console.log(`  - 🚨 构建时间过长: 每节点构建时间 > 1ms`);
  }
  
  if (avgSearchTime > 1.0) {
    console.log(`  - 🚨 搜索时间过长: 平均搜索时间 > 1ms`);
  }
  
  if (searchTimeVariance > 0.1) {
    console.log(`  - ⚠️ 搜索时间不稳定: 方差过大`);
  }
  
  if (stats.avgOutDegree > 50) {
    console.log(`  - ⚠️ 图密度过高: 平均出度 > 50`);
  }
  
  if (cacheStats && cacheStats.hitRate < 0.8) {
    console.log(`  - ⚠️ 缓存命中率低: < 80%`);
  }
  
  if (stats.maxOutDegree > 100) {
    console.log(`  - ⚠️ 最大出度过高: > 100`);
  }
}

describe('Vamana 综合性能测试', () => {
  // 大规模性能测试配置
  const largeScaleConfig = {
    numVectors: 5000,
    dimension: 128,
    k: 10,
    vamanaConfig: {
      distanceFunction: 'euclidean' as const,
      R: 32,
      L: 64,
      alpha: 1.2,
    }
  };

  // 召回率测试配置
  const recallTestConfig = {
    numVectors: 2000,
    dimension: 128,
    k: 10,
    vamanaConfig: {
      distanceFunction: 'euclidean' as const,
      R: 32,
      L: 64,
      alpha: 1.2,
    }
  };

  let largeScaleIndex: VamanaIndex;
  let largeScaleDataset: Float32Array[];
  let largeScaleState: any;
  let buildTime: number;

  let recallTestIndex: VamanaIndex;
  let recallTestVectors: Float32Array[];
  let recallTestQueries: Float32Array[];

  beforeAll(() => {
    // 准备大规模性能测试数据
    largeScaleDataset = generateDataset(largeScaleConfig.numVectors, largeScaleConfig.dimension);
    largeScaleIndex = createVamanaIndex(largeScaleConfig.vamanaConfig);

    console.log(`🔧 开始插入 ${largeScaleConfig.numVectors} 个节点...`);
    const insertStartTime = performance.now();
    
    largeScaleDataset.forEach((vector, i) => {
      largeScaleIndex.insertNode(vector, { id: i });
      if ((i + 1) % 500 === 0) {
        console.log(`  - 已插入 ${i + 1}/${largeScaleConfig.numVectors} 个节点`);
      }
    });
    
    const insertEndTime = performance.now();
    console.log(`✅ 节点插入完成，耗时: ${(insertEndTime - insertStartTime).toFixed(2)} ms`);

    console.log('🔧 开始构建Vamana索引...');
    const buildStartTime = performance.now();
    largeScaleIndex.buildIndex();
    const buildEndTime = performance.now();
    buildTime = buildEndTime - buildStartTime;
    console.log(`✅ 索引构建完成，耗时: ${buildTime.toFixed(2)} ms`);

    // 获取内部状态，用于调试和性能分析
    largeScaleState = largeScaleIndex.getInternalState();
    
    // 获取统计信息
    const stats = largeScaleIndex.getStats();
    console.log(`📊 索引统计: ${stats.nodeCount} 个节点，平均出度 ${stats.avgOutDegree.toFixed(2)}`);
  }, 180000); // 增加超时时间到3分钟

  beforeEach(() => {
    // 准备召回率测试数据
    recallTestVectors = [];
    recallTestQueries = [];
    
    // 生成2000个随机向量作为数据集
    for (let i = 0; i < recallTestConfig.numVectors; i++) {
      const vector = new Float32Array(recallTestConfig.dimension);
      for (let j = 0; j < recallTestConfig.dimension; j++) {
        vector[j] = Math.random() * 2 - 1; // [-1, 1]范围
      }
      recallTestVectors.push(vector);
    }
    
    // 生成20个测试查询
    for (let i = 0; i < 20; i++) {
      const query = new Float32Array(recallTestConfig.dimension);
      for (let j = 0; j < recallTestConfig.dimension; j++) {
        query[j] = Math.random() * 2 - 1;
      }
      recallTestQueries.push(query);
    }
  });

  describe('大规模搜索性能测试', () => {
    test('should perform large-scale performance analysis and identify bottlenecks', () => {
      const searchParams = { searchListSize: 100 };
      const numQueries = 50;
      const searchTimes: number[] = [];
      const detailedResults: any[] = [];

      console.log(`\n🔍 === 大规模性能测试 ===`);
      console.log(`数据集: ${largeScaleConfig.numVectors} 个 ${largeScaleConfig.dimension} 维向量`);
      console.log(`查询数量: ${numQueries}`);
      console.log(`搜索参数: K=${largeScaleConfig.k}, Beam Size=${searchParams.searchListSize}`);

      // 执行多次搜索并收集详细数据
      for (let i = 0; i < numQueries; i++) {
        const queryVector = generateRandomVector(largeScaleConfig.dimension);
        
        // 记录搜索开始前的缓存状态
        const cacheStatsBefore = largeScaleState.distanceCache.getStats();
        
        const searchStartTime = performance.now();
        const results = largeScaleIndex.searchKNN(queryVector, largeScaleConfig.k, searchParams);
        const searchEndTime = performance.now();
        
        const searchTime = searchEndTime - searchStartTime;
        searchTimes.push(searchTime);
        
        // 记录搜索后的缓存状态
        const cacheStatsAfter = largeScaleState.distanceCache.getStats();
        
        detailedResults.push({
          queryId: i,
          searchTime,
          resultsCount: results.length,
          cacheHits: cacheStatsAfter.hits - cacheStatsBefore.hits,
          cacheMisses: cacheStatsAfter.misses - cacheStatsBefore.misses,
          firstResultDistance: results[0]?.distance || 0,
          lastResultDistance: results[results.length - 1]?.distance || 0
        });
        
        if ((i + 1) % 10 === 0) {
          console.log(`  - 完成 ${i + 1}/${numQueries} 次查询`);
        }
      }

      // 获取最终统计信息
      const stats = largeScaleIndex.getStats();
      const finalCacheStats = largeScaleState.distanceCache.getStats();
      
      // 添加缓存统计到stats对象
      const statsWithCache = {
        ...stats,
        distanceCacheStats: finalCacheStats
      };

      // 执行性能瓶颈分析
      analyzePerformanceBottlenecks(statsWithCache, searchTimes, buildTime);

      // 详细结果分析
      console.log(`\n📋 === 详细结果分析 ===`);
      const avgResultsCount = detailedResults.reduce((sum, r) => sum + r.resultsCount, 0) / detailedResults.length;
      const avgCacheHits = detailedResults.reduce((sum, r) => sum + r.cacheHits, 0) / detailedResults.length;
      const avgCacheMisses = detailedResults.reduce((sum, r) => sum + r.cacheMisses, 0) / detailedResults.length;
      
      console.log(`平均结果数量: ${avgResultsCount.toFixed(2)}`);
      console.log(`平均缓存命中: ${avgCacheHits.toFixed(2)} 次/查询`);
      console.log(`平均缓存未命中: ${avgCacheMisses.toFixed(2)} 次/查询`);
      console.log(`平均缓存命中率: ${(avgCacheHits / (avgCacheHits + avgCacheMisses) * 100).toFixed(2)}%`);

      // 验证结果正确性
      expect(searchTimes.length).toBe(numQueries);
      expect(searchTimes.every(time => time > 0)).toBe(true);
      expect(stats.nodeCount).toBe(largeScaleConfig.numVectors);
      
      // 验证搜索结果
      const testQuery = generateRandomVector(largeScaleConfig.dimension);
      const testResults = largeScaleIndex.searchKNN(testQuery, largeScaleConfig.k, searchParams);
      expect(testResults.length).toBe(largeScaleConfig.k);
      
      // 验证距离排序
      for (let i = 1; i < testResults.length; i++) {
        expect(testResults[i].distance).toBeGreaterThanOrEqual(testResults[i - 1].distance);
      }

      console.log(`\n✅ 性能测试完成，所有验证通过`);
    });

    test('should analyze greedySearch performance in detail', () => {
      const queryVector = generateRandomVector(largeScaleConfig.dimension);
      const searchParams = { searchListSize: 100 };

      console.log('\n🔍 === GreedySearch 详细性能分析 ===');

      // 获取内部状态
      const medoidId = largeScaleState.medoidId;
      const distanceCache: DistanceCache = largeScaleState.distanceCache;
      const distanceConfig: DistanceConfig = largeScaleState.distanceConfig;
      const nodes = largeScaleState.nodes;

      // 清空缓存统计，重新开始
      distanceCache.clear();
      const cacheStatsBefore = distanceCache.getStats();

      // 执行 greedySearch 并记录详细性能
      const greedySearchStartTime = performance.now();
      const searchResult = greedySearch(
        queryVector,
        medoidId,
        searchParams.searchListSize!,
        nodes,
        distanceCache,
        distanceConfig
      );
      const greedySearchEndTime = performance.now();
      
      const cacheStatsAfter = distanceCache.getStats();
      const searchTime = greedySearchEndTime - greedySearchStartTime;

      console.log(`🔍 GreedySearch 性能指标:`);
      console.log(`  - 搜索时间: ${searchTime.toFixed(4)} ms`);
      console.log(`  - 访问节点数: ${searchResult.visited.reduce((sum, visited) => sum + visited, 0)}`);
      console.log(`  - 候选节点数: ${searchResult.candidates.length}`);
      console.log(`  - 距离计算次数: ${cacheStatsAfter.hits + cacheStatsAfter.misses}`);
      console.log(`  - 缓存命中次数: ${cacheStatsAfter.hits}`);
      console.log(`  - 缓存未命中次数: ${cacheStatsAfter.misses}`);
      console.log(`  - 缓存命中率: ${(cacheStatsAfter.hitRate * 100).toFixed(2)}%`);

      // 分析访问模式
      const visitedArray = Array.from(searchResult.visited.entries())
        .filter(([_, visited]) => visited === 1)
        .map(([id, _]) => id);
      const visitedDegrees = visitedArray.map(id => nodes[id].neighbors.length);
      const avgVisitedDegree = visitedDegrees.reduce((sum, deg) => sum + deg, 0) / visitedDegrees.length;
      
      console.log(`\n📊 访问模式分析:`);
      console.log(`  - 平均访问节点出度: ${avgVisitedDegree.toFixed(2)}`);
      console.log(`  - 最大访问节点出度: ${Math.max(...visitedDegrees)}`);
      console.log(`  - 最小访问节点出度: ${Math.min(...visitedDegrees)}`);

      // 分析候选节点分布
      const candidateDistances = searchResult.candidates.map(c => c.distance);
      const avgCandidateDistance = candidateDistances.reduce((sum, dist) => sum + dist, 0) / candidateDistances.length;
      
      console.log(`\n📈 候选节点分析:`);
      console.log(`  - 平均候选距离: ${avgCandidateDistance.toFixed(4)}`);
      console.log(`  - 最小候选距离: ${Math.min(...candidateDistances).toFixed(4)}`);
      console.log(`  - 最大候选距离: ${Math.max(...candidateDistances).toFixed(4)}`);
      console.log(`  - 距离标准差: ${Math.sqrt(candidateDistances.reduce((sum, dist) => sum + Math.pow(dist - avgCandidateDistance, 2), 0) / candidateDistances.length).toFixed(4)}`);

      // 性能瓶颈识别
      console.log(`\n⚠️ GreedySearch 潜在瓶颈:`);
      
      if (searchTime > 1.0) {
        console.log(`  - 🚨 搜索时间过长: > 1ms`);
      }
      
      const visitedCount = searchResult.visited.reduce((sum, visited) => sum + visited, 0);
      if (visitedCount > largeScaleConfig.numVectors * 0.5) {
        console.log(`  - ⚠️ 访问节点过多: > 50% 的总节点`);
      }
      
      if (cacheStatsAfter.hitRate < 0.8) {
        console.log(`  - ⚠️ 缓存命中率低: < 80%`);
      }
      
      if (avgVisitedDegree > 50) {
        console.log(`  - ⚠️ 访问节点平均出度过高: > 50`);
      }

      // 验证结果
      expect(searchResult.visited.reduce((sum, visited) => sum + visited, 0)).toBeGreaterThan(0);
      expect(searchResult.candidates.length).toBeGreaterThan(0);
      expect(searchTime).toBeGreaterThan(0);
    });
  });

  describe('召回率测试', () => {
    test('should achieve good recall rate', () => {
      recallTestIndex = createVamanaIndex(recallTestConfig.vamanaConfig);
      recallTestVectors.forEach(vector => recallTestIndex.insertNode(vector));
      recallTestIndex.buildIndex();
      
      let totalRecall = 0;
      const testCount = 5;
      
      // 对每个查询进行测试
      for (let i = 0; i < testCount; i++) {
        const query = recallTestQueries[i];
        
        // 暴力搜索得到精确结果
        const exactResults = bruteForceSearch(query, recallTestVectors, recallTestConfig.k, 'euclidean');
        
        // Vamana搜索得到近似结果
        const approximateResults = recallTestIndex.searchKNN(query, recallTestConfig.k, { searchListSize: 100 });
        
        // 计算召回率
        const recall = computeRecall(approximateResults, exactResults);
        totalRecall += recall;
        
        console.log(`查询${i + 1}: 召回率 ${(recall * 100).toFixed(2)}%`);
        
        // 单个查询的召回率应该至少达到80%
        expect(recall).toBeGreaterThan(0.8);
      }
      
      const avgRecall = totalRecall / testCount;
      console.log(`平均召回率: ${(avgRecall * 100).toFixed(2)}%`);
      
      // 整体召回率应该达到90%以上
      expect(avgRecall).toBeGreaterThan(0.9);
    });

    test('should maintain good recall rate with different k values', () => {
      recallTestIndex = createVamanaIndex(recallTestConfig.vamanaConfig);
      recallTestVectors.forEach(vector => recallTestIndex.insertNode(vector));
      recallTestIndex.buildIndex();
      
      const kValues = [1, 5, 10, 20];
      const query = recallTestQueries[0];
      
      for (const k of kValues) {
        const exactResults = bruteForceSearch(query, recallTestVectors, k, 'euclidean');
        const approximateResults = recallTestIndex.searchKNN(query, k, { searchListSize: 100 });
        const recall = computeRecall(approximateResults, exactResults);
        
        console.log(`k=${k}: 召回率 ${(recall * 100).toFixed(2)}%`);
        
        // 不同k值下都应该有良好的召回率
        expect(recall).toBeGreaterThan(0.8);
      }
    });

    test('should maintain good recall rate with different distance functions', () => {
      const distanceFunctions: Array<'euclidean' | 'cosine' | 'inner_product'> = [
        'euclidean', 'cosine', 'inner_product'
      ];
      
      for (const distanceFunction of distanceFunctions) {
        const config: VamanaConfig = {
          ...recallTestConfig.vamanaConfig,
          distanceFunction
        };
        
        recallTestIndex = createVamanaIndex(config);
        recallTestVectors.forEach(vector => recallTestIndex.insertNode(vector));
        recallTestIndex.buildIndex();
        
        let totalRecall = 0;
        const testCount = 3;
        
        for (let i = 0; i < testCount; i++) {
          const query = recallTestQueries[i];
          const exactResults = bruteForceSearch(query, recallTestVectors, 10, distanceFunction);
          const approximateResults = recallTestIndex.searchKNN(query, 10, { searchListSize: 100 });
          const recall = computeRecall(approximateResults, exactResults);
          totalRecall += recall;
        }
        
        const avgRecall = totalRecall / testCount;
        console.log(`${distanceFunction}: 平均召回率 ${(avgRecall * 100).toFixed(2)}%`);
        
        // 要求良好的召回率
        expect(avgRecall).toBeGreaterThan(0.8);
      }
    });
  });

  describe('性能对比测试', () => {
    test('should be much faster than brute force search', () => {
      const config: VamanaConfig = {
        distanceFunction: 'euclidean',
        R: 64,
        L: 100,
        alpha: 1.2
      };
      
      recallTestIndex = createVamanaIndex(config);
      // 测量构建时间
      const buildStartTime = performance.now();
      recallTestVectors.forEach(vector => recallTestIndex.insertNode(vector));
      recallTestIndex.buildIndex();
      const buildTime = performance.now() - buildStartTime;
      
      console.log(`构建时间: ${buildTime.toFixed(2)}ms`);
      
      // 测量搜索性能
      const query = recallTestQueries[0];
      const k = 10;
      
      // 暴力搜索时间
      const bruteForceStartTime = performance.now();
      const bruteForceResults = bruteForceSearch(query, recallTestVectors, k, 'euclidean');
      const bruteForceTime = performance.now() - bruteForceStartTime;
      
      // Vamana搜索时间
      const vamanaStartTime = performance.now();
      const vamanaResults = recallTestIndex.searchKNN(query, k, { searchListSize: 100 });
      const vamanaTime = performance.now() - vamanaStartTime;
      
      console.log(`暴力搜索时间: ${bruteForceTime.toFixed(2)}ms`);
      console.log(`Vamana搜索时间: ${vamanaTime.toFixed(2)}ms`);
      console.log(`加速比: ${(bruteForceTime / vamanaTime).toFixed(2)}x`);
      
      // 绝对性能要求
      expect(vamanaTime).toBeLessThan(bruteForceTime / 5);
      
      // 验证召回率
      const recall = computeRecall(vamanaResults, bruteForceResults);
      expect(recall).toBeGreaterThan(0.8);
    });

    test('should maintain performance advantage with different dataset sizes', () => {
      const datasetSizes = [1000, 2000];
      const query = recallTestQueries[0];
      const k = 10;
      
      for (const size of datasetSizes) {
        const testVectors = recallTestVectors.slice(0, size);
        
        // 暴力搜索
        const bruteForceStartTime = performance.now();
        const bruteForceResults = bruteForceSearch(query, testVectors, k, 'euclidean');
        const bruteForceTime = performance.now() - bruteForceStartTime;
        
        // Vamana搜索
        const config: VamanaConfig = {
          distanceFunction: 'euclidean',
          R: 32,
          L: 64,
          alpha: 1.2
        };
        
        recallTestIndex = createVamanaIndex(config);
        testVectors.forEach(vector => recallTestIndex.insertNode(vector));
        recallTestIndex.buildIndex();
        
        const vamanaStartTime = performance.now();
        const vamanaResults = recallTestIndex.searchKNN(query, k, { searchListSize: 100 });
        const vamanaTime = performance.now() - vamanaStartTime;
        
        const speedup = bruteForceTime / vamanaTime;
        const recall = computeRecall(vamanaResults, bruteForceResults);
        
        console.log(`数据集大小 ${size}: 加速比 ${speedup.toFixed(2)}x, 召回率 ${(recall * 100).toFixed(2)}%`);
        
        // 随着数据集增大，加速比应该增加
        expect(speedup).toBeGreaterThan(2);
        expect(recall).toBeGreaterThan(0.6);
      }
    });

    test('should test batch query performance', () => {
      const config: VamanaConfig = {
        distanceFunction: 'euclidean',
        R: 32,
        L: 64,
        alpha: 1.2
      };
      
      recallTestIndex = createVamanaIndex(config);
      recallTestVectors.forEach(vector => recallTestIndex.insertNode(vector));
      recallTestIndex.buildIndex();
      
      const batchSize = 10;
      const k = 10;
      
      // 批量暴力搜索
      const bruteForceStartTime = performance.now();
      const bruteForceResults: Array<Array<{ id: number; distance: number }>> = [];
      for (let i = 0; i < batchSize; i++) {
        const results = bruteForceSearch(recallTestQueries[i], recallTestVectors, k, 'euclidean');
        bruteForceResults.push(results);
      }
      const bruteForceTime = performance.now() - bruteForceStartTime;
      
      // 批量Vamana搜索
      const vamanaStartTime = performance.now();
      const vamanaResults: Array<Array<{ id: number; distance: number }>> = [];
      for (let i = 0; i < batchSize; i++) {
        const results = recallTestIndex.searchKNN(recallTestQueries[i], k, { searchListSize: 100 });
        vamanaResults.push(results);
      }
      const vamanaTime = performance.now() - vamanaStartTime;
      
      console.log(`批量暴力搜索时间: ${bruteForceTime.toFixed(2)}ms`);
      console.log(`批量Vamana搜索时间: ${vamanaTime.toFixed(2)}ms`);
      console.log(`批量加速比: ${(bruteForceTime / vamanaTime).toFixed(2)}x`);
      
      // 计算平均召回率
      let totalRecall = 0;
      for (let i = 0; i < batchSize; i++) {
        const recall = computeRecall(vamanaResults[i], bruteForceResults[i]);
        totalRecall += recall;
      }
      const avgRecall = totalRecall / batchSize;
      
      console.log(`批量平均召回率: ${(avgRecall * 100).toFixed(2)}%`);
      
      // 绝对性能要求
      expect(vamanaTime).toBeLessThan(bruteForceTime / 5);
      expect(avgRecall).toBeGreaterThan(0.6);
    });
  });

  describe('算法稳定性测试', () => {
    test('should maintain consistent performance with different random seeds', () => {
      const config: VamanaConfig = {
        distanceFunction: 'euclidean',
        R: 128,
        L: 50,
        alpha: 1.2
      };
      
      const query = recallTestQueries[0];
      const k = 10;
      const testVectors = recallTestVectors.slice(0, 100);
      
      const results: number[] = [];
      
      // 多次运行测试
      for (let run = 0; run < 3; run++) {
        recallTestIndex = createVamanaIndex(config);
        testVectors.forEach(vector => recallTestIndex.insertNode(vector));
        recallTestIndex.buildIndex();
        
        const bruteForceResults = bruteForceSearch(query, testVectors, k, 'euclidean');
        const vamanaResults = recallTestIndex.searchKNN(query, k);
        const recall = computeRecall(vamanaResults, bruteForceResults);
        
        results.push(recall);
      }
      
      // 计算召回率的方差
      const avgRecall = results.reduce((a, b) => a + b, 0) / results.length;
      const variance = results.reduce((sum, recall) => sum + Math.pow(recall - avgRecall, 2), 0) / results.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`平均召回率: ${(avgRecall * 100).toFixed(2)}%`);
      console.log(`召回率标准差: ${(stdDev * 100).toFixed(2)}%`);
      
      // 召回率应该相对稳定
      expect(stdDev).toBeLessThan(0.1); // 标准差小于10%
      expect(avgRecall).toBeGreaterThan(0.8);
    });
  });

  describe('统计信息测试', () => {
    test('should provide correct statistics', () => {
      const config: VamanaConfig = {
        distanceFunction: 'euclidean',
        R: 128,
        L: 50,
        alpha: 1.2
      };
      
      recallTestIndex = createVamanaIndex(config);
      recallTestVectors.forEach(vector => recallTestIndex.insertNode(vector));
      recallTestIndex.buildIndex();
      
      const stats = recallTestIndex.getStats();
      
      console.log(`节点数: ${stats.nodeCount}`);
      console.log(`平均出度: ${stats.avgOutDegree.toFixed(2)}`);
      console.log(`最大出度: ${stats.maxOutDegree}`);
      console.log(`图密度: ${stats.graphDensity.toFixed(4)}`);
      
      // 验证图的基本属性
      expect(stats.nodeCount).toBe(recallTestVectors.length);
      expect(stats.avgOutDegree).toBeGreaterThan(0);
      expect(stats.maxOutDegree).toBeLessThanOrEqual(config.R!);
      expect(stats.graphDensity).toBeGreaterThan(0);
    });
  });
}); 