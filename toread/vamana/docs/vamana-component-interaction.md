# Vamana索引组件交互图

## 🔗 组件依赖关系

```mermaid
graph TB
    subgraph "主入口"
        A[vamana-index.ts] --> B[createVamanaIndex]
    end
    
    subgraph "核心算法模块"
        C[graph-search.ts] --> D[greedySearch]
        C --> E[findMedoid]
        F[robust-prune.ts] --> G[robustPruneStandard]
        H[distance.ts] --> I[computeDistance]
        H --> J[DistanceCache]
    end
    
    subgraph "数据结构"
        K[common.ts] --> L[Vector类型]
        K --> M[SearchResult类型]
        K --> N[NodeData类型]
    end
    
    subgraph "性能优化模块"
        O[binary-heap.ts] --> P[BinaryHeap]
        Q[midi-heap.ts] --> R[MidiHeap]
        S[generic.ts] --> T[通用优化工具]
    end
    
    A --> C
    A --> F
    A --> H
    A --> K
    A --> O
    A --> Q
    A --> S
```

## 🔄 详细交互流程

### 1. 索引创建流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant Main as vamana-index.ts
    participant Config as 配置验证
    participant State as 状态管理
    participant Cache as DistanceCache
    
    User->>Main: createVamanaIndex(config)
    Main->>Config: validateVamanaConfig(config)
    Config-->>Main: 验证后的配置
    Main->>State: 初始化VamanaState
    State->>Cache: 创建DistanceCache实例
    Main-->>User: VamanaIndex实例
```

### 2. 节点插入交互

```mermaid
sequenceDiagram
    participant User as 用户
    participant Index as VamanaIndex
    participant Search as greedySearch
    participant Prune as robustPruneStandard
    participant Distance as computeDistance
    participant Cache as DistanceCache
    participant State as VamanaState
    
    User->>Index: insertNode(vector, data)
    Index->>State: 验证向量并创建节点
    State->>State: 添加到节点数组
    
    alt 第一个节点
        State->>State: 设为medoid
    else 后续节点
        State->>Search: 从medoid开始搜索
        Search->>Distance: 计算距离
        Distance->>Cache: 获取缓存距离
        Search-->>State: 返回候选邻居
        State->>Prune: 应用RobustPrune
        Prune->>Distance: 计算剪枝距离
        Prune-->>State: 返回最终邻居
        State->>State: 添加反向连接
    end
    
    Index-->>User: 返回节点ID
```

### 3. 索引构建交互

```mermaid
sequenceDiagram
    participant User as 用户
    participant Index as VamanaIndex
    participant State as VamanaState
    participant Search as greedySearch
    participant Prune as robustPruneStandard
    participant Medoid as findMedoid
    participant Cache as DistanceCache
    
    User->>Index: buildIndex()
    Index->>State: 检查节点数量
    State->>Cache: 清空距离缓存
    State->>Medoid: 重新计算medoid
    Medoid->>Cache: 计算所有节点间距离
    Medoid-->>State: 返回最佳medoid
    
    loop 遍历每个节点
        State->>Search: 从medoid开始搜索
        Search->>Cache: 计算搜索距离
        Search-->>State: 返回候选邻居
        State->>Prune: 应用RobustPrune剪枝
        Prune->>Cache: 计算剪枝距离
        Prune-->>State: 更新邻居列表
    end
    
    Index-->>User: 构建完成
```

### 4. KNN搜索交互

```mermaid
sequenceDiagram
    participant User as 用户
    participant Index as VamanaIndex
    participant State as VamanaState
    participant Search as greedySearch
    participant Distance as computeDistance
    participant Cache as DistanceCache
    participant Heap as BinaryHeap/MidiHeap
    
    User->>Index: searchKNN(query, k)
    Index->>State: 检查索引状态
    
    alt 索引未构建
        State->>Distance: 暴力计算所有距离
        Distance->>Cache: 获取缓存距离
        Distance-->>State: 返回距离数组
        State->>State: 排序并返回Top-K
    else 索引已构建
        State->>Search: 从medoid开始贪婪搜索
        Search->>Heap: 管理候选集
        Search->>Distance: 计算邻居距离
        Distance->>Cache: 获取缓存距离
        Search->>State: 探索邻居节点
        Search-->>State: 返回搜索结果
        State->>State: 提取Top-K结果
    end
    
    Index-->>User: 返回搜索结果
```

## 🏗️ 模块内部结构

### 1. vamana-index.ts 内部结构

```mermaid
graph TB
    subgraph "vamana-index.ts"
        A[createVamanaIndex] --> B[validateVamanaConfig]
        A --> C[validateVector]
        A --> D[insertNodeToState]
        A --> E[buildIndexForState]
        A --> F[searchKNNInState]
        A --> G[getStatsFromState]
        
        subgraph "状态管理"
            H[VamanaState] --> I[nodes数组]
            H --> J[medoidId]
            H --> K[nextNodeId]
            H --> L[distanceCache]
            H --> M[distanceConfig]
            H --> N[config]
        end
    end
    
    A --> H
```

### 2. graph-search.ts 内部结构

```mermaid
graph TB
    subgraph "graph-search.ts"
        A[greedySearch] --> B[候选集管理]
        A --> C[访问标记管理]
        A --> D[邻居探索]
        A --> E[距离计算调用]
        
        F[findMedoid] --> G[全距离计算]
        F --> H[最小总距离选择]
        
        subgraph "数据结构"
            I[VamanaNode] --> J[vector]
            I --> K[id]
            I --> L[data]
            I --> M[neighbors]
            
            N[SearchCandidate] --> O[id]
            N --> P[distance]
            
            Q[SearchResult] --> R[candidates]
            Q --> S[visited]
        end
    end
```

### 3. distance.ts 内部结构

```mermaid
graph TB
    subgraph "distance.ts"
        A[computeDistance] --> B[computeEuclideanDistance]
        A --> C[computeCosineDistance]
        A --> D[computeInnerProductDistance]
        A --> E[自定义距离函数]
        
        F[DistanceCache] --> G[Map缓存]
        F --> H[命中统计]
        F --> I[getCachedDistance]
        F --> J[clear]
        F --> K[getStats]
        
        L[computeDistanceFromIds] --> M[ID到向量转换]
        L --> N[缓存查询]
        
        subgraph "配置管理"
            O[DistanceConfig] --> P[distanceFunction]
            O --> Q[customDistanceFunction]
        end
    end
```

### 4. robust-prune.ts 内部结构

```mermaid
graph TB
    subgraph "robust-prune.ts"
        A[robustPruneStandard] --> B[候选集初始化]
        A --> C[贪心选择循环]
        A --> D[剪枝条件检查]
        A --> E[邻居列表构建]
        
        subgraph "算法步骤"
            F[步骤1: 初始化候选集] --> G[步骤2: 重置出边]
            G --> H[步骤3: 贪心选择]
            H --> I[步骤4: 剪枝]
            I --> J[步骤5: 循环直到满足条件]
        end
        
        subgraph "剪枝条件"
            K[α*dist(p*,p') ≤ d(p,p')] --> L[移除满足条件的候选点]
        end
    end
```

## 🔧 性能优化交互

### 1. 距离缓存交互

```mermaid
sequenceDiagram
    participant Caller as 调用者
    participant Cache as DistanceCache
    participant Compute as computeDistance
    participant Map as Map缓存
    
    Caller->>Cache: getCachedDistance(id1, id2, computeFn)
    Cache->>Cache: 生成缓存键
    Cache->>Map: 检查缓存
    
    alt 缓存命中
        Map-->>Cache: 返回缓存值
        Cache-->>Caller: 返回缓存距离
    else 缓存未命中
        Cache->>Compute: 调用computeFn
        Compute-->>Cache: 返回计算距离
        Cache->>Map: 存储到缓存
        Cache-->>Caller: 返回计算距离
    end
```

### 2. 堆优化交互

```mermaid
sequenceDiagram
    participant Search as greedySearch
    participant BinaryHeap as BinaryHeap
    participant MidiHeap as MidiHeap
    participant Candidate as 候选集管理
    
    Search->>Candidate: 初始化候选集
    
    loop 搜索过程
        Search->>BinaryHeap: 插入新候选
        BinaryHeap-->>Search: 返回堆顶
        Search->>MidiHeap: 批量操作优化
        MidiHeap-->>Search: 返回批量结果
        Search->>Candidate: 更新候选集
    end
    
    Search->>Candidate: 返回最终结果
```

## 📊 数据流图

### 1. 向量数据流

```mermaid
graph LR
    A[用户输入向量] --> B[Float32Array转换]
    B --> C[向量验证]
    C --> D[VamanaNode创建]
    D --> E[节点数组存储]
    E --> F[距离计算使用]
    F --> G[搜索结果返回]
```

### 2. 距离计算数据流

```mermaid
graph TB
    A[向量对] --> B[距离函数选择]
    B --> C[具体距离计算]
    C --> D[距离缓存检查]
    D --> E[缓存存储/获取]
    E --> F[距离值返回]
    
    subgraph "距离类型"
        G[欧几里得] --> H[sqrt(sum(diff²))]
        I[余弦] --> J[1 - dot/(normA*normB)]
        K[内积] --> L[-sum(a*b)]
    end
    
    C --> G
    C --> I
    C --> K
```

### 3. 搜索数据流

```mermaid
graph TB
    A[查询向量] --> B[medoid起始]
    B --> C[贪婪搜索]
    C --> D[邻居探索]
    D --> E[候选集管理]
    E --> F[距离计算]
    F --> G[结果排序]
    G --> H[Top-K返回]
    
    subgraph "候选集管理"
        I[插入新候选] --> J[堆操作]
        J --> K[大小限制]
        K --> L[排序截断]
    end
    
    E --> I
```

## 🎯 关键交互点

### 1. 性能瓶颈点

```mermaid
graph TB
    A[性能瓶颈] --> B[距离计算]
    A --> C[内存分配]
    A --> D[排序操作]
    A --> E[图遍历]
    
    B --> F[缓存优化]
    C --> G[对象池化]
    D --> H[堆优化]
    E --> I[早期终止]
```

### 2. 优化策略交互

```mermaid
graph LR
    A[优化策略] --> B[距离缓存]
    A --> C[内存池化]
    A --> D[算法优化]
    A --> E[数据结构优化]
    
    B --> F[减少重复计算]
    C --> G[减少GC压力]
    D --> H[提高算法效率]
    E --> I[提高访问效率]
```

---

*最后更新时间: 2025-08-02 06:20:52* 