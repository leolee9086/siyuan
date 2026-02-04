# Vamana索引运行图

## 📊 整体架构图

```mermaid
graph TB
    subgraph "用户接口层"
        A[createVamanaIndex] --> B[VamanaIndex接口]
        B --> C[insertNode]
        B --> D[searchKNN]
        B --> E[buildIndex]
        B --> F[getStats]
    end
    
    subgraph "核心算法层"
        G[greedySearch] --> H[findMedoid]
        I[robustPruneStandard] --> J[距离计算]
        K[DistanceCache] --> J
    end
    
    subgraph "数据存储层"
        L[VamanaNode数组] --> M[邻居列表]
        N[Float32Array向量] --> L
    end
    
    subgraph "配置管理"
        O[VamanaConfig] --> P[距离函数配置]
        O --> Q[算法参数配置]
    end
    
    A --> G
    A --> I
    A --> K
    A --> L
    A --> O
```

## 🔄 主要运行流程

### 1. 索引构建流程 (buildIndex)

```mermaid
flowchart TD
    A[开始构建索引] --> B{节点数量检查}
    B -->|0个节点| C[返回空]
    B -->|>0个节点| D[清空距离缓存]
    D --> E[重新计算medoid]
    E --> F[随机打乱节点顺序]
    F --> G[遍历每个节点]
    G --> H[从medoid开始贪婪搜索]
    H --> I[获取候选邻居]
    I --> J[应用RobustPrune剪枝]
    J --> K{还有节点?}
    K -->|是| G
    K -->|否| L[构建完成]
```

### 2. 节点插入流程 (insertNode)

```mermaid
flowchart TD
    A[插入新节点] --> B[验证输入向量]
    B --> C[创建VamanaNode]
    C --> D{是否第一个节点?}
    D -->|是| E[设为medoid]
    D -->|否| F[从medoid开始贪婪搜索]
    E --> G[返回节点ID]
    F --> H[获取候选邻居]
    H --> I[应用RobustPrune选择邻居]
    I --> J[添加反向连接]
    J --> K[处理邻居度限制]
    K --> G
```

### 3. 搜索流程 (searchKNN)

```mermaid
flowchart TD
    A[开始KNN搜索] --> B{索引是否已构建?}
    B -->|否| C[暴力搜索]
    B -->|是| D[从medoid开始贪婪搜索]
    C --> E[计算所有距离]
    D --> F[探索邻居节点]
    F --> G{候选集大小限制}
    G -->|超过| H[排序并截断]
    G -->|未超过| I{还有未访问节点?}
    H --> I
    I -->|是| F
    I -->|否| J[返回Top-K结果]
    E --> J
```

### 4. RobustPrune剪枝算法

```mermaid
flowchart TD
    A[开始RobustPrune] --> B[初始化候选集]
    B --> C{候选集为空?}
    C -->|是| D[返回空邻居]
    C -->|否| E{邻居数<R?}
    E -->|否| F[返回当前邻居]
    E -->|是| G[找到最近候选点p*]
    G --> H[添加p*到邻居]
    H --> I[从候选集移除p*]
    I --> J[应用剪枝条件]
    J --> K[移除满足条件的候选点]
    K --> C
```

## 🏗️ 核心组件关系

### 距离计算组件

```mermaid
graph LR
    subgraph "距离计算引擎"
        A[computeDistance] --> B[欧几里得距离]
        A --> C[余弦距离]
        A --> D[内积距离]
        A --> E[自定义距离]
    end
    
    subgraph "距离缓存"
        F[DistanceCache] --> G[Map缓存]
        F --> H[命中统计]
    end
    
    subgraph "性能优化"
        I[预计算范数] --> J[循环展开]
        K[SIMD优化] --> L[内存对齐]
    end
    
    A --> F
    F --> I
    F --> K
```

### 图搜索组件

```mermaid
graph TB
    subgraph "搜索算法"
        A[greedySearch] --> B[候选集管理]
        A --> C[访问标记]
        A --> D[距离计算]
    end
    
    subgraph "堆优化"
        E[BinaryHeap] --> F[快速插入/删除]
        G[MidiHeap] --> H[批量操作优化]
    end
    
    subgraph "内存管理"
        I[内存池化] --> J[减少分配]
        K[对象复用] --> L[GC压力降低]
    end
    
    A --> E
    A --> G
    A --> I
    A --> K
```

## ⚡ 性能优化策略

### 1. 距离计算优化

```mermaid
graph LR
    A[距离计算] --> B[缓存机制]
    A --> C[预计算范数]
    A --> D[循环展开]
    A --> E[SIMD指令]
    
    B --> F[减少重复计算]
    C --> G[避免重复开方]
    D --> H[提高CPU利用率]
    E --> I[向量化计算]
```

### 2. 内存管理优化

```mermaid
graph TB
    A[内存优化] --> B[对象池化]
    A --> C[预分配数组]
    A --> D[减少GC压力]
    
    B --> E[VamanaNode复用]
    C --> F[邻居列表预分配]
    D --> G[避免频繁创建]
```

### 3. 算法优化

```mermaid
graph LR
    A[算法优化] --> B[早期终止]
    A --> C[批量处理]
    A --> D[并行计算]
    
    B --> E[减少不必要计算]
    C --> F[提高缓存命中]
    D --> G[利用多核CPU]
```

## 📈 性能指标

### 时间复杂度分析

| 操作 | 平均复杂度 | 最坏复杂度 | 优化策略 |
|------|------------|------------|----------|
| 插入节点 | O(L log L) | O(n²) | 距离缓存 |
| 构建索引 | O(nL log L) | O(n³) | 批量处理 |
| KNN搜索 | O(log n) | O(n) | 图结构优化 |
| 距离计算 | O(d) | O(d) | SIMD优化 |

### 空间复杂度分析

| 组件 | 空间复杂度 | 优化策略 |
|------|------------|----------|
| 节点存储 | O(nd) | 内存池化 |
| 邻居列表 | O(nR) | 预分配 |
| 距离缓存 | O(n²) | LRU淘汰 |
| 搜索状态 | O(L) | 对象复用 |

## 🔧 配置参数影响

### 关键参数说明

```mermaid
graph TB
    A[VamanaConfig] --> B[R: 最大出度]
    A --> C[L: 搜索宽度]
    A --> D[alpha: 剪枝参数]
    A --> E[searchListSize: 搜索列表大小]
    
    B --> F[影响图密度]
    C --> G[影响构建速度]
    D --> H[影响搜索精度]
    E --> I[影响搜索速度]
```

### 参数调优建议

| 场景 | R | L | alpha | searchListSize |
|------|---|---|-------|----------------|
| 高精度 | 64 | 128 | 1.0 | 200 |
| 高速度 | 16 | 32 | 1.5 | 50 |
| 平衡 | 32 | 64 | 1.2 | 100 |
| 内存受限 | 8 | 16 | 1.8 | 25 |

## 🚀 使用示例

### 基本使用流程

```typescript
// 1. 创建索引
const index = createVamanaIndex({
  distanceFunction: 'euclidean',
  R: 32,
  L: 64,
  alpha: 1.2
});

// 2. 插入数据
const vectors = [
  new Float32Array([1, 0, 0]),
  new Float32Array([0, 1, 0]),
  new Float32Array([0, 0, 1])
];

vectors.forEach((vector, i) => {
  index.insertNode(vector, { id: i });
});

// 3. 构建索引
index.buildIndex();

// 4. 搜索
const query = new Float32Array([0.5, 0.5, 0]);
const results = index.searchKNN(query, 5);

// 5. 获取统计信息
const stats = index.getStats();
```

## 📊 监控指标

### 运行时监控

```mermaid
graph LR
    A[性能监控] --> B[距离缓存命中率]
    A --> C[搜索路径长度]
    A --> D[内存使用量]
    A --> E[构建时间]
    
    B --> F[缓存效率]
    C --> G[搜索效率]
    D --> H[内存效率]
    E --> I[构建效率]
```

### 关键指标

- **距离缓存命中率**: 目标 > 80%
- **平均搜索路径长度**: 目标 < log(n)
- **内存使用量**: 监控增长趋势
- **构建时间**: 与数据量线性关系

---

*最后更新时间: 2025-08-02 06:20:52* 