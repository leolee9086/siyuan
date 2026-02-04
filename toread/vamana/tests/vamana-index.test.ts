import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createVamanaIndex, VamanaConfig, VamanaIndex } from '../src/vamana-index'

describe('VamanaIndex', () => {
  let index: VamanaIndex
  let config: VamanaConfig

  beforeEach(() => {
    config = {
      distanceFunction: 'euclidean',
      R: 16,
      L: 32,
      alpha: 1.2
    }
    index = createVamanaIndex(config)
  })

  afterEach(() => {
    // 清理
  })

  describe('基本功能测试', () => {
    it('应该正确创建索引实例', () => {
      expect(index).toBeDefined()
      expect(typeof index.insertNode).toBe('function')
      expect(typeof index.searchKNN).toBe('function')
      expect(typeof index.buildIndex).toBe('function')
      expect(typeof index.getStats).toBe('function')
      expect(typeof index.optimize).toBe('function')
    })

    it('应该正确插入单个节点', () => {
      const vector = new Float32Array([1, 0, 0])
      const id = index.insertNode(vector, { label: 'test' })
      
      expect(id).toBe(0)
      const stats = index.getStats()
      expect(stats.nodeCount).toBe(1)
    })

    it('应该正确插入多个节点', () => {
      const vectors = [
        new Float32Array([1, 0, 0]),
        new Float32Array([0, 1, 0]),
        new Float32Array([0, 0, 1])
      ]
      
      const ids = vectors.map((vector, i) => 
        index.insertNode(vector, { label: `point${i}` })
      )
      
      expect(ids).toEqual([0, 1, 2])
      const stats = index.getStats()
      expect(stats.nodeCount).toBe(3)
    })

    it('应该正确处理空索引的搜索', () => {
      const queryVector = new Float32Array([1, 0, 0])
      const results = index.searchKNN(queryVector, 5)
      
      expect(results).toEqual([])
    })

    it('应该正确处理单个节点的搜索', () => {
      const vector = new Float32Array([1, 0, 0])
      const id = index.insertNode(vector, { label: 'single' })
      
      const results = index.searchKNN(vector, 5)
      
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(id)
      expect(results[0].distance).toBe(0) // 相同向量距离应该为0
      expect(results[0].data?.label).toBe('single')
    })
  })

  describe('距离函数测试', () => {
    it('应该正确计算欧几里得距离', () => {
      const index = createVamanaIndex({ distanceFunction: 'euclidean' })
      
      const vector1 = new Float32Array([1, 0, 0])
      const vector2 = new Float32Array([0, 1, 0])
      
      index.insertNode(vector1)
      index.insertNode(vector2)
      
      const results = index.searchKNN(vector1, 2)
      
      expect(results).toHaveLength(2)
      expect(results[0].distance).toBe(0) // 自己到自己的距离
      expect(results[1].distance).toBeCloseTo(Math.sqrt(2), 5) // 到另一个向量的距离
    })

    it('应该正确计算余弦距离', () => {
      const index = createVamanaIndex({ distanceFunction: 'cosine' })
      
      const vector1 = new Float32Array([1, 0, 0])
      const vector2 = new Float32Array([0, 1, 0])
      const vector3 = new Float32Array([1, 1, 0])
      
      index.insertNode(vector1)
      index.insertNode(vector2)
      index.insertNode(vector3)
      
      // 构建索引以确保搜索算法能正确工作
      index.buildIndex()
      
      const results = index.searchKNN(vector1, 3)
      
      // 调试输出
      console.log('搜索结果:', results.map(r => ({ id: r.id, distance: r.distance })))
      
      expect(results).toHaveLength(3)
      expect(results[0].distance).toBe(0) // 自己到自己的余弦距离
      expect(results[2].distance).toBeCloseTo(1, 5) // 垂直向量的余弦距离
    })

    it('应该正确计算内积距离', () => {
      const index = createVamanaIndex({ distanceFunction: 'inner_product' })
      
      const vector1 = new Float32Array([1, 0, 0])
      const vector2 = new Float32Array([2, 0, 0])
      
      index.insertNode(vector1)
      index.insertNode(vector2)
      
      // 构建索引以确保搜索算法能正确工作
      index.buildIndex()
      
      const results = index.searchKNN(vector1, 2)
      
      // 调试输出
      console.log('内积搜索结果:', results.map(r => ({ id: r.id, distance: r.distance })))
      
      expect(results).toHaveLength(2)
      expect(results[1].distance).toBe(-1) // 自己到自己的内积
      expect(results[0].distance).toBe(-2) // 到另一个向量的内积
    })

    it('应该支持自定义距离函数', () => {
      const customDistance = (a: any, b: any) => {
        const vecA = a.vector
        const vecB = b.vector
        return Math.abs(vecA[0] - vecB[0]) + Math.abs(vecA[1] - vecB[1])
      }
      
      const index = createVamanaIndex({ 
        distanceFunction: 'custom',
        customDistanceFunction: customDistance
      })
      
      const vector1 = new Float32Array([1, 2])
      const vector2 = new Float32Array([3, 4])
      
      index.insertNode(vector1)
      index.insertNode(vector2)
      
      // 构建索引以确保搜索算法能正确工作
      index.buildIndex()
      
      const results = index.searchKNN(vector1, 2)
      
      expect(results).toHaveLength(2)
      expect(results[0].distance).toBe(0) // 自己到自己的曼哈顿距离
      expect(results[1].distance).toBe(4) // 到另一个向量的曼哈顿距离
    })
  })

  describe('搜索算法测试', () => {
    it('应该找到正确的最近邻', () => {
      // 创建一组2D点，形成一个简单的几何模式
      const vectors = [
        new Float32Array([0, 0]), // 原点
        new Float32Array([1, 0]), // 右
        new Float32Array([0, 1]), // 上
        new Float32Array([1, 1]), // 右上
        new Float32Array([2, 0]), // 更右
        new Float32Array([0, 2])  // 更上
      ]
      
      vectors.forEach((vector, i) => {
        index.insertNode(vector, { label: `point${i}` })
      })
      
      // 搜索最接近 [0.5, 0.5] 的点
      const queryVector = new Float32Array([0.5, 0.5])
      const results = index.searchKNN(queryVector, 3)
      
      expect(results).toHaveLength(3)
      
      // 验证距离排序
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i-1].distance)
      }
      
      // 验证最近的点应该是 [0, 0] 或 [1, 1]
      const nearestDistance = results[0].distance
      expect(nearestDistance).toBeLessThan(1) // 应该小于1
    })

    it('应该正确处理beam search参数', () => {
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 1])
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      
      const queryVector = new Float32Array([0.5, 0.5])
      
      // 使用不同的beam size
      const results1 = index.searchKNN(queryVector, 2, { searchListSize: 10 })
      const results2 = index.searchKNN(queryVector, 2, { searchListSize: 100 })
      
      expect(results1).toHaveLength(2)
      expect(results2).toHaveLength(2)
      
      // 结果应该一致（对于小数据集）
      expect(results1[0].id).toBe(results2[0].id)
    })

    it('应该正确处理k值大于节点数的情况', () => {
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0])
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      
      const queryVector = new Float32Array([0.5, 0])
      const results = index.searchKNN(queryVector, 10) // k > 节点数
      
      expect(results).toHaveLength(2) // 应该只返回存在的节点数
    })
  })

  describe('RobustPrune算法测试', () => {
    it('应该正确应用RobustPrune剪枝', () => {
      const indexWithPrune = createVamanaIndex({
        distanceFunction: 'euclidean',
        R: 4, // 限制最大出度
        alpha: 1.2
      })
      
      const indexWithoutPrune = createVamanaIndex({
        distanceFunction: 'euclidean',
        R: 4
      })
      
      // 插入相同的向量
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 1]),
        new Float32Array([0.5, 0.5])
      ]
      
      vectors.forEach(vector => {
        indexWithPrune.insertNode(vector)
        indexWithoutPrune.insertNode(vector)
      })
      
      const statsWithPrune = indexWithPrune.getStats()
      const statsWithoutPrune = indexWithoutPrune.getStats()
      
      // RobustPrune应该产生更少的连接
      expect(statsWithPrune.avgOutDegree).toBeLessThanOrEqual(statsWithoutPrune.avgOutDegree)
    })

    it('应该正确处理alpha参数', () => {
      const index1 = createVamanaIndex({ alpha: 1.0, R: 4 })
      const index2 = createVamanaIndex({ alpha: 2.0, R: 4 })
      
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 1])
      ]
      
      vectors.forEach(vector => {
        index1.insertNode(vector)
        index2.insertNode(vector)
      })
      
      // 构建图结构
      index1.buildIndex()
      index2.buildIndex()
      
      const stats1 = index1.getStats()
      const stats2 = index2.getStats()
      
      // 不同的alpha值应该产生不同的图结构
      expect(stats1.avgOutDegree).not.toBe(stats2.avgOutDegree)
    })
  })

  describe('图构建和优化测试', () => {
    it('应该正确构建索引', () => {
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 1])
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      
      // 构建前的统计
      const statsBefore = index.getStats()
      
      // 构建索引
      index.buildIndex()
      
      // 构建后的统计
      const statsAfter = index.getStats()
      
      expect(statsAfter.nodeCount).toBe(statsBefore.nodeCount)
      expect(statsAfter.avgOutDegree).toBeGreaterThan(0)
    })

    it('应该正确处理空图的构建', () => {
      expect(() => index.buildIndex()).not.toThrow()
      
      const stats = index.getStats()
      expect(stats.nodeCount).toBe(0)
    })

    it('应该正确优化索引', () => {
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 1])
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      
      expect(() => index.optimize()).not.toThrow()
      
      const stats = index.getStats()
      expect(stats.nodeCount).toBe(4)
    })
  })

  describe('统计信息测试', () => {
    it('应该提供正确的统计信息', () => {
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1])
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      
      // 构建图结构
      index.buildIndex()
      
      const stats = index.getStats()
      
      expect(stats.nodeCount).toBe(3)
      expect(stats.avgOutDegree).toBeGreaterThan(0)
      expect(stats.maxOutDegree).toBeGreaterThan(0)
      expect(stats.graphDensity).toBeGreaterThan(0)
      expect(stats.parameters.distanceFunction).toBe('euclidean')
      expect(stats.parameters.R).toBe(16)
      expect(stats.parameters.L).toBe(32)
      expect(stats.parameters.alpha).toBe(1.2)
    })

    it('应该正确处理空图的统计', () => {
      const stats = index.getStats()
      
      expect(stats.nodeCount).toBe(0)
      expect(stats.avgOutDegree).toBe(0)
      expect(stats.maxOutDegree).toBe(0)
      expect(stats.graphDensity).toBe(0)
    })
  })

  describe('边界情况测试', () => {
    it('应该正确处理零向量', () => {
      const zeroVector = new Float32Array([0, 0, 0])
      const id = index.insertNode(zeroVector)
      
      expect(id).toBe(0)
      
      const results = index.searchKNN(zeroVector, 1)
      expect(results).toHaveLength(1)
      expect(results[0].distance).toBe(0)
    })

    it('应该正确处理重复向量', () => {
      const vector = new Float32Array([1, 0, 0])
      
      const id1 = index.insertNode(vector, { label: 'first' })
      const id2 = index.insertNode(vector, { label: 'second' })
      
      expect(id1).toBe(0)
      expect(id2).toBe(1)
      
      const results = index.searchKNN(vector, 2)
      expect(results).toHaveLength(2)
      expect(results[0].distance).toBe(0)
      expect(results[1].distance).toBe(0)
    })

    it('应该正确处理高维向量', () => {
      const highDimVector = new Float32Array(100)
      for (let i = 0; i < 100; i++) {
        highDimVector[i] = Math.random()
      }
      
      const id = index.insertNode(highDimVector)
      expect(id).toBe(0)
      
      const results = index.searchKNN(highDimVector, 1)
      expect(results).toHaveLength(1)
      expect(results[0].distance).toBe(0)
    })

    it('应该正确处理NaN和Infinity值', () => {
      const invalidVector = new Float32Array([NaN, Infinity, -Infinity])
      
      expect(() => index.insertNode(invalidVector)).toThrow()
    })
  })

  describe('性能测试', () => {
    it('应该能够处理大量节点', () => {
      const nodeCount = 500 // 从100增加到500，提供更有意义的性能测试
      const vectors: Float32Array[] = []
      
      for (let i = 0; i < nodeCount; i++) {
        const vector = new Float32Array([
          Math.random(),
          Math.random(),
          Math.random()
        ])
        vectors.push(vector)
      }
      
      const startTime = performance.now()
      
      vectors.forEach(vector => {
        index.insertNode(vector)
      })
      
      const insertTime = performance.now() - startTime
      
      // 构建索引
      const buildStartTime = performance.now()
      index.buildIndex()
      const buildTime = performance.now() - buildStartTime
      
      // 搜索测试
      const searchStartTime = performance.now()
      const queryVector = new Float32Array([0.5, 0.5, 0.5])
      const results = index.searchKNN(queryVector, 10)
      const searchTime = performance.now() - searchStartTime
      
      expect(results).toHaveLength(10)
      expect(insertTime).toBeLessThan(5000) // 调整时间阈值以适应更大规模
      expect(buildTime).toBeLessThan(5000) // 调整时间阈值以适应更大规模
      expect(searchTime).toBeLessThan(500) // 调整时间阈值以适应更大规模
      
      const stats = index.getStats()
      expect(stats.nodeCount).toBe(nodeCount)
    })

    it('应该在不同配置下保持性能', () => {
      const configs = [
        { R: 8, L: 16, alpha: 1.0 },
        { R: 16, L: 32, alpha: 1.2 },
        { R: 32, L: 64, alpha: 1.5 }
      ]
      
      const vectors: Float32Array[] = []
      for (let i = 0; i < 1000; i++) { // 从50增加到200，提供更有意义的性能测试
        vectors.push(new Float32Array([Math.random(), Math.random()]))
      }
      
      configs.forEach(config => {
        const testIndex = createVamanaIndex(config)
        
        const startTime = performance.now()
        vectors.forEach(vector => testIndex.insertNode(vector))
        testIndex.buildIndex()
        const totalTime = performance.now() - startTime
        
        expect(totalTime).toBeLessThan(3000) // 调整时间阈值以适应更大规模
        
        const queryVector = new Float32Array([0.5, 0.5])
        const results = testIndex.searchKNN(queryVector, 5)
        expect(results).toHaveLength(5)
      })
    })
  })

  describe('算法正确性验证', () => {
    it('应该找到真正的最近邻（小数据集验证）', () => {
      // 创建一个简单的2D数据集，我们可以手动计算距离
      const vectors = [
        new Float32Array([0, 0]), // 距离查询点 0.5
        new Float32Array([1, 0]), // 距离查询点 0.5
        new Float32Array([0, 1]), // 距离查询点 0.707
        new Float32Array([1, 1]), // 距离查询点 0.707
        new Float32Array([2, 0])  // 距离查询点 1.5
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      
      const queryVector = new Float32Array([0.5, 0])
      const results = index.searchKNN(queryVector, 3)
      
      expect(results).toHaveLength(3)
      
      // 验证距离排序
      expect(results[0].distance).toBeLessThanOrEqual(results[1].distance)
      expect(results[1].distance).toBeLessThanOrEqual(results[2].distance)
      
      // 验证最近的两个点应该是 [0, 0] 和 [1, 0]
      const nearestIds = results.slice(0, 2).map(r => r.id).sort()
      expect(nearestIds).toContain(0)
      expect(nearestIds).toContain(1)
    })

    it('应该保持图的连通性', () => {
      const vectors = [
        new Float32Array([0, 0]),
        new Float32Array([1, 0]),
        new Float32Array([0, 1]),
        new Float32Array([1, 1])
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      index.buildIndex()
      
      const stats = index.getStats()
      
      // 每个节点都应该有至少一个邻居（除了可能的孤立点）
      expect(stats.avgOutDegree).toBeGreaterThan(0)
      
      // 验证从任何节点开始搜索都能找到结果
      vectors.forEach(vector => {
        const results = index.searchKNN(vector, 2)
        expect(results.length).toBeGreaterThan(0)
      })
    })

    it('应该正确处理medoid选择', () => {
      // 创建一个有明显中心的点集
      const vectors = [
        new Float32Array([0, 0]),   // 中心点
        new Float32Array([10, 0]),  // 远离中心
        new Float32Array([0, 10]),  // 远离中心
        new Float32Array([10, 10])  // 远离中心
      ]
      
      vectors.forEach(vector => index.insertNode(vector))
      index.buildIndex()
      
      // 从中心点搜索应该能找到所有点
      const centerQuery = new Float32Array([0, 0])
      const results = index.searchKNN(centerQuery, 4)
      
      expect(results).toHaveLength(4)
      
      // 从远离中心的点搜索也应该能找到所有点
      const farQuery = new Float32Array([10, 10])
      const farResults = index.searchKNN(farQuery, 4)
      
      expect(farResults).toHaveLength(4)
    })
  })

  describe('错误处理测试', () => {
    it('应该正确处理无效的距离函数', () => {
      expect(() => {
        createVamanaIndex({ distanceFunction: 'invalid' as any })
      }).toThrow('不支持的距离函数')
    })

    it('应该正确处理无效的向量输入', () => {
      expect(() => {
        index.insertNode(null as any)
      }).toThrow()
      
      expect(() => {
        index.insertNode(undefined as any)
      }).toThrow()
    })

    it('应该正确处理空的向量', () => {
      expect(() => {
        index.insertNode(new Float32Array(0))
      }).toThrow()
    })
  })
}) 

describe('反向图结构和删除功能', () => {
  it('应该正确维护反向图结构', () => {
    const index = createVamanaIndex({ R: 4, L: 8, alpha: 1.2 });
    
    // 插入测试节点
    const node1 = index.insertNode([1, 0, 0]);
    const node2 = index.insertNode([0, 1, 0]);
    const node3 = index.insertNode([0, 0, 1]);
    
    index.buildIndex();
    
    const state = index.getInternalState();
    
    // 验证反向图结构已初始化
    expect(state.inGraph).toBeDefined();
    expect(state.inGraph.length).toBe(3);
    
    // 验证每个节点都有反向图记录
    for (let i = 0; i < 3; i++) {
      expect(Array.isArray(state.inGraph[i])).toBe(true);
    }
  });

  it('删除节点应该正确更新反向图', () => {
    const index = createVamanaIndex({ R: 4, L: 8, alpha: 1.2 });
    
    // 插入测试节点
    const node1 = index.insertNode([1, 0, 0]);
    const node2 = index.insertNode([0, 1, 0]);
    const node3 = index.insertNode([0, 0, 1]);
    
    index.buildIndex();
    
    // 记录删除前的状态
    const stateBefore = index.getInternalState();
    const neighborsBefore = stateBefore.nodes[1].neighbors.length;
    
    // 删除节点1
    const deleteResult = index.deleteNode(1);
    expect(deleteResult).toBe(true);
    
    // 验证节点1被标记为已删除
    const stateAfter = index.getInternalState();
    expect(stateAfter.nodes[1].data.deleted).toBe(true);
    
    // 验证其他节点的邻居列表已更新（不再包含节点1）
    for (let i = 0; i < stateAfter.nodes.length; i++) {
      if (i !== 1) {
        const hasNode1AsNeighbor = stateAfter.nodes[i].neighbors.includes(1);
        expect(hasNode1AsNeighbor).toBe(false);
      }
    }
  });

  it('搜索应该跳过已删除的节点', () => {
    const index = createVamanaIndex({ R: 4, L: 8, alpha: 1.2 });
    
    // 插入测试节点
    index.insertNode([1, 0, 0]);
    index.insertNode([0, 1, 0]);
    index.insertNode([0, 0, 1]);
    
    index.buildIndex();
    
    // 删除节点1
    index.deleteNode(1);
    
    // 搜索查询
    const results = index.searchKNN([1, 0, 0], 3);
    
    // 验证结果中不包含已删除的节点
    const hasDeletedNode = results.some(result => result.id === 1);
    expect(hasDeletedNode).toBe(false);
  });

  it('统计信息应该正确反映活跃节点', () => {
    const index = createVamanaIndex({ R: 4, L: 8, alpha: 1.2 });
    
    // 插入测试节点
    index.insertNode([1, 0, 0]);
    index.insertNode([0, 1, 0]);
    index.insertNode([0, 0, 1]);
    
    index.buildIndex();
    
    // 删除前应该有3个节点
    let stats = index.getStats();
    expect(stats.nodeCount).toBe(3);
    
    // 删除一个节点
    index.deleteNode(1);
    
    // 删除后应该有2个活跃节点
    stats = index.getStats();
    expect(stats.nodeCount).toBe(2);
  });
}); 