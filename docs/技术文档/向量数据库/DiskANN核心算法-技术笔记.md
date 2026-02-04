# DiskANN核心算法 - 技术笔记

> 调研日期: 2026-02-05  
> 目标: 理解Vamana图算法原理，为Go语言实现奠定理论基础

---

## 1. DiskANN系统概述

### 核心问题
- **挑战**: 在单机（64GB RAM）上实现十亿级向量的近似最近邻搜索（ANNS）
- **传统方案局限**: 纯内存方案（如HNSW）内存占用随数据规模线性增长

### DiskANN解决方案
- **磁盘优先架构**: Vamana图和全精度向量存储在SSD
- **内存缓存**: 仅缓存压缩向量（如PQ量化后的向量）
- **混合搜索**: RAM用于快速距离估算，SSD用于精确计算

### 性能指标
| 指标 | DiskANN目标值 |
|------|---------------|
| 数据规模 | 十亿级向量 |
| 查询延迟 | <5ms |
| 召回率@10 | ≥95% |

---

## 2. Vamana图算法

### 2.1 与HNSW的核心差异

| 特性 | HNSW | Vamana |
|------|------|--------|
| 层级结构 | 多层分层图 | 单层图 |
| 图直径 | 较大 | **更小**（关键优势） |
| 磁盘I/O | 多层需多次随机读 | 单层减少读次数 |
| 设计目标 | 内存优化 | **磁盘优化** |

> **关键洞察**: Vamana通过更小的图直径，减少搜索时的顺序磁盘读取次数，从而降低延迟。

### 2.2 图构建算法

构建过程包含两个主要阶段：

#### 阶段1: 初始化
```
1. 选择medoid作为起始点s
2. 为每个顶点随机初始化R个出边
```

#### 阶段2: 迭代优化
```
for each point p in random_order(dataset):
    1. 从起始点s执行GreedySearch到p
    2. 获取搜索路径上的访问节点集合V
    3. 调用RobustPrune(p, V)更新p的邻居
    4. 为每个新邻居n添加反向边n→p
    5. 如果n的度数超限，调用RobustPrune(n, neighbors(n))
```

#### RobustPrune算法

RobustPrune是Vamana的核心剪枝算法，确保图的导航性：

```
RobustPrune(p, candidates, R, α):
    neighbors = []
    candidates = sort_by_distance(candidates, p)
    
    while len(neighbors) < R and candidates not empty:
        n = candidates.pop_closest()
        neighbors.append(n)
        
        # 移除被n"遮挡"的候选
        for c in candidates:
            if dist(n, c) < dist(p, c) / α:  # α通常为1.2
                candidates.remove(c)
    
    return neighbors
```

**α参数说明**:
- `α = 1`: 保守剪枝，图更密集
- `α = 1.2`: 推荐值，平衡密度和效率
- 较大α值: 激进剪枝，图更稀疏

### 2.3 贪婪搜索算法

```
GreedySearch(query, s, L, k):
    visited = {}
    candidates = MinHeap(capacity=L)
    candidates.push(s, dist(query, s))
    
    while candidates not empty:
        c = candidates.pop_closest()
        if c in visited:
            continue
        visited.add(c)
        
        for n in neighbors(c):
            if n not in visited:
                d = dist(query, n)
                candidates.push(n, d)
                if len(candidates) > L:
                    candidates.pop_farthest()
    
    return top_k(visited, k)
```

**参数说明**:
- `L`: 搜索列表大小（控制精度/性能权衡）
- `k`: 返回结果数量
- `L >= k` 必须满足

---

## 3. 磁盘存储架构

### 3.1 数据分层

```
┌─────────────────────────────────────────┐
│              RAM (64GB)                 │
│  ┌─────────────────────────────────┐    │
│  │ 压缩向量 (PQ/BBQ量化)            │    │
│  │ 约4-8字节/维度 → 4-8GB/百万向量   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↕ 按需加载
┌─────────────────────────────────────────┐
│              SSD (1TB+)                 │
│  ┌─────────────────────────────────┐    │
│  │ Vamana图结构 + 全精度向量         │    │
│  │ mmap映射，按sector对齐           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 3.2 搜索时的数据流

1. **粗筛阶段**: 使用RAM中的量化向量计算近似距离
2. **精排阶段**: 对候选集从SSD加载全精度向量
3. **批量I/O**: 使用beam search批量预取，减少随机读

---

## 4. 默认参数配置

引用自 `toread/IP-DiskANN/include/defaults.h`:

```cpp
const float ALPHA = 1.2f;                    // 剪枝阈值
const uint32_t MAX_OCCLUSION_SIZE = 750;     // 最大遮挡检查数
const float GRAPH_SLACK_FACTOR = 1.3f;       // 图松弛因子
const uint64_t SECTOR_LEN = 4096;            // 扇区长度
const uint32_t MAX_DEGREE = 64;              // 最大出度
const uint32_t BUILD_LIST_SIZE = 100;        // 构建搜索列表
const uint32_t SEARCH_LIST_SIZE = 100;       // 查询搜索列表
```

---

## 5. 与现有BBQ量化的集成点

### 现有BBQ实现位置
- `kernel/vectordb/bbq_quantizer.go` - 量化器
- `kernel/vectordb/bbq_scorer.go` - 评分器

### 集成方案
1. **内存层**: BBQ量化码驻留内存，用于粗筛
2. **磁盘层**: 全精度向量存储在磁盘，用于精排
3. **评分兼容**: BBQ评分器可直接用于DiskANN的量化距离计算

---

## 6. 参考实现代码索引

### Rust实现 (Microsoft DiskANN)

| 功能 | 文件位置 | 行号 |
|------|----------|------|
| 索引主结构 | `toread/DiskANN/diskann/src/graph/index.rs` | 61-68 |
| 单点插入 | `toread/DiskANN/diskann/src/graph/index.rs` | 346-474 |
| 批量插入 | `toread/DiskANN/diskann/src/graph/index.rs` | 988-1161 |
| RobustPrune | `toread/DiskANN/diskann/src/graph/internal.rs` | prune模块 |
| 删除策略 | `toread/DiskANN/diskann/src/graph/misc.rs` | 31-36 |

### TypeScript实现 (本地开发版)

> 📁 `toread/vamana/` - 可直接运行的TypeScript Vamana实现

| 功能 | 文件位置 | 关键函数 |
|------|----------|----------|
| 索引创建 | `src/vamana-index.ts` | `createVamanaIndex` |
| 图构建 | `src/vamana-index.ts` | `buildIndexForState` |
| K近邻搜索 | `src/vamana-index.ts` | `searchKNNInState` |
| RobustPrune | `src/robust-prune.ts` | 全文件 |
| 贪婪搜索 | `src/graph-search.ts` | `greedySearchMultiStart` |
| 节点删除 | `src/vamana-index.ts` | `deleteNodeFromState` |

**代码审阅文档**:
- `vamana-index.buildIndexForState.review.md` - 图构建算法审阅
- `robust-prune.robustPruneStandard.review.md` - 剪枝算法审阅
- `graph-search.greedySearchMultiStart.review.md` - 搜索算法审阅

---

## 7. 下一步行动

1. [ ] 深入分析`toread/DiskANN/`的磁盘存储模块
2. [ ] 调研Fresh-DiskANN的热更新机制
3. [ ] 设计Go语言实现的模块划分

---

**创建时间**: 2026-02-05  
**最后更新**: 2026-02-05
