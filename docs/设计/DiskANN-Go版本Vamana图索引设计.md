# DiskANN Go版本 Vamana图索引设计

> 设计日期: 2026-02-05  
> 参考实现: `toread/DiskANN/diskann/src/graph/index.rs` (Rust)  
> 前置文档: `docs/设计/DiskANN-Go版本磁盘存储设计方案.md`

---

## 1. 数据结构设计

### 1.1 VamanaIndex 主结构体

```go
package vamana

// VamanaIndex Vamana图索引主结构
type VamanaIndex struct {
    // 配置参数
    config Config
    
    // 数据提供者 (磁盘或内存)
    dataProvider DataProvider
    
    // 搜索临时空间池 (复用以减少GC)
    scratchPool *ScratchPool
}

// Config 索引配置
type Config struct {
    // 构建参数
    R         int     // 最大出度 (默认64)
    L         int     // 构建时搜索列表大小 (默认100)
    Alpha     float32 // 剪枝阈值 (默认1.2)
    
    // 高级参数
    MaxOcclusionSize   int     // 最大遮挡计算大小 (默认750)
    GraphSlackFactor   float32 // 图松弛因子 (默认1.3)
    SaturateAfterPrune bool    // 剪枝后饱和填充 (默认true)
    MaxBackedges       int     // 单次插入最大反向边数 (默认R)
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
    return Config{
        R:                  64,
        L:                  100,
        Alpha:              1.2,
        MaxOcclusionSize:   750,
        GraphSlackFactor:   1.3,
        SaturateAfterPrune: true,
        MaxBackedges:       64,
    }
}
```

### 1.2 节点表示

#### 内存中的节点

```go
// Neighbor 邻居节点 (带距离)
type Neighbor struct {
    ID       uint32
    Distance float32
}

// 实现排序接口 (按距离升序)
func (n Neighbor) Less(other Neighbor) bool {
    return n.Distance < other.Distance
}

// AdjacencyList 邻接表 (定长数组，避免slice开销)
type AdjacencyList struct {
    neighbors [MaxDegree]uint32 // 预分配最大度数
    length    int
}

func (a *AdjacencyList) Len() int           { return a.length }
func (a *AdjacencyList) Get(i int) uint32   { return a.neighbors[i] }
func (a *AdjacencyList) Contains(id uint32) bool { /* ... */ }
func (a *AdjacencyList) Push(id uint32) bool     { /* 去重添加 */ }
func (a *AdjacencyList) Clear()                  { a.length = 0 }
```

#### 磁盘上的节点布局

参照 [`DiskANN-Go版本磁盘存储设计方案.md`](DiskANN-Go版本磁盘存储设计方案.md) 第1.2节：

```
Node (定长 node_len 字节):
┌─────────────────────────────────────────────────────────────┐
│ Vector: float32[dims]                    (dims * 4 bytes)   │
├─────────────────────────────────────────────────────────────┤
│ NumNeighbors: u32                        (4 bytes)          │
├─────────────────────────────────────────────────────────────┤
│ NeighborIDs: u32[max_degree]             (max_degree * 4)   │
├─────────────────────────────────────────────────────────────┤
│ AssociatedData: byte[assoc_len]          (assoc_len bytes)  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 搜索临时空间

```go
// SearchScratch 搜索临时空间 (可复用)
type SearchScratch struct {
    // 已访问节点集合 (Epoch-based优化)
    visited *EpochSet
    
    // 最佳候选优先队列
    best *NeighborPriorityQueue
    
    // 当前迭代的beam节点
    beamNodes []uint32
    
    // 统计信息
    cmps uint32 // 距离计算次数
    hops uint32 // 跳数
}

// EpochSet 基于Epoch的访问标记 (避免频繁清空)
type EpochSet struct {
    epoch  uint32
    marks  []uint32 // marks[i] == epoch 表示已访问
}

func (e *EpochSet) Reset() {
    e.epoch++ // 仅增加epoch，无需清空数组
    if e.epoch == 0 {
        // 溢出时才真正清空
        for i := range e.marks {
            e.marks[i] = 0
        }
        e.epoch = 1
    }
}

func (e *EpochSet) Contains(id uint32) bool {
    return e.marks[id] == e.epoch
}

func (e *EpochSet) Insert(id uint32) bool {
    if e.marks[id] == e.epoch {
        return false
    }
    e.marks[id] = e.epoch
    return true
}
```

---

## 2. 图构建算法

### 2.1 初始化流程

```
初始化VamanaIndex:
1. 创建空图或加载已有图
2. 选择入口点 (medoid)
   - 空图: 第一个插入的点
   - 已有图: 计算质心最近点
3. 初始化搜索临时空间池
```

```go
// New 创建新索引
func New(config Config, provider DataProvider) *VamanaIndex {
    poolSize := runtime.NumCPU()
    return &VamanaIndex{
        config:       config,
        dataProvider: provider,
        scratchPool:  NewScratchPool(poolSize, config),
    }
}

// Build 从向量集合构建索引
func (idx *VamanaIndex) Build(vectors [][]float32) error {
    if len(vectors) == 0 {
        return nil
    }
    
    // 1. 计算质心并选择入口点
    medoid := idx.findMedoid(vectors)
    idx.dataProvider.SetMedoid(medoid)
    
    // 2. 随机打乱插入顺序 (提高图质量)
    order := rand.Perm(len(vectors))
    
    // 3. 逐点插入
    for _, i := range order {
        if err := idx.Insert(uint32(i), vectors[i]); err != nil {
            return err
        }
    }
    
    return nil
}
```

### 2.2 单点插入算法

核心流程: **GreedySearch → RobustPrune → 添加反向边**

```
Insert(id, vector):
1. 从入口点开始贪婪搜索，找到最近的L个候选
2. 对候选列表执行RobustPrune，得到最多R个邻居
3. 设置新节点的出边
4. 为每个新邻居添加反向边 (可能触发二次剪枝)
```

```go
func (idx *VamanaIndex) Insert(id uint32, vector []float32) error {
    scratch := idx.scratchPool.Get()
    defer idx.scratchPool.Put(scratch)
    
    // 1. 贪婪搜索找候选
    startIDs := idx.dataProvider.StartingPoints()
    candidates := idx.greedySearch(scratch, startIDs, vector, idx.config.L)
    
    // 2. RobustPrune剪枝
    neighbors := idx.robustPrune(id, candidates, idx.config.R, idx.config.Alpha)
    
    // 3. 设置新节点的邻居
    idx.dataProvider.SetNeighbors(id, neighbors)
    
    // 4. 添加反向边
    maxBackedges := min(len(neighbors), idx.config.MaxBackedges)
    for _, neighborID := range neighbors[:maxBackedges] {
        idx.addEdgeAndPrune(neighborID, id)
    }
    
    return nil
}
```

### 2.3 RobustPrune 剪枝算法

**核心思想**: 选择多样性好的邻居，避免邻居之间过于接近

```
RobustPrune(nodeID, candidates, R, alpha):
输入: 候选列表 (按距离排序)
输出: 最多R个邻居

1. 初始化 occlude_factor[i] = 0 对所有候选
2. current_alpha = 1.0
3. while |result| < R:
   for each candidate c in candidates:
     if occlude_factor[c] > current_alpha:
       continue  // 被遮挡，跳过
     
     // 检查c是否被已选邻居遮挡
     for each selected neighbor n in result:
       dist_cn = distance(c, n)
       if dist_cn < dist(node, c):
         // n遮挡了c
         occlude_factor[c] = max(occlude_factor[c], dist(node,c) / dist_cn)
     
     if occlude_factor[c] <= current_alpha:
       result.add(c)
       occlude_factor[c] = MAX  // 标记已选
   
   if current_alpha == alpha:
     break
   current_alpha = min(current_alpha * 1.2, alpha)

4. 可选: 饱和填充 (如果|result| < R，从剩余候选补充)
```

```go
func (idx *VamanaIndex) robustPrune(
    nodeID uint32,
    candidates []Neighbor,
    maxDegree int,
    alpha float32,
) []uint32 {
    if len(candidates) == 0 {
        return nil
    }
    
    // 按距离排序
    sort.Slice(candidates, func(i, j int) bool {
        return candidates[i].Distance < candidates[j].Distance
    })
    
    // 限制候选数量
    if len(candidates) > idx.config.MaxOcclusionSize {
        candidates = candidates[:idx.config.MaxOcclusionSize]
    }
    
    occludeFactor := make([]float32, len(candidates))
    result := make([]uint32, 0, maxDegree)
    
    currentAlpha := float32(1.0)
    incrementFactor := min(alpha, 1.2)
    
    for len(result) < maxDegree {
        for i, cand := range candidates {
            if len(result) >= maxDegree {
                break
            }
            if occludeFactor[i] > currentAlpha {
                continue
            }
            if cand.ID == nodeID {
                occludeFactor[i] = math.MaxFloat32
                continue
            }
            
            // 检查是否被已选邻居遮挡
            skip := false
            for _, selectedID := range result {
                distCN := idx.distance(cand.ID, selectedID)
                if distCN < cand.Distance {
                    newFactor := cand.Distance / distCN
                    if newFactor > occludeFactor[i] {
                        occludeFactor[i] = newFactor
                    }
                    if occludeFactor[i] > currentAlpha {
                        skip = true
                        break
                    }
                }
            }
            
            if !skip && occludeFactor[i] <= currentAlpha {
                result = append(result, cand.ID)
                occludeFactor[i] = math.MaxFloat32
            }
        }
        
        if currentAlpha >= alpha {
            break
        }
        currentAlpha = min(currentAlpha*incrementFactor, alpha)
    }
    
    // 饱和填充
    if idx.config.SaturateAfterPrune && alpha > 1.0 {
        for _, cand := range candidates {
            if len(result) >= maxDegree {
                break
            }
            if !contains(result, cand.ID) && cand.ID != nodeID {
                result = append(result, cand.ID)
            }
        }
    }
    
    return result
}
```

### 2.4 批量构建优化

```go
// BuildParallel 并行批量构建
func (idx *VamanaIndex) BuildParallel(vectors [][]float32, numWorkers int) error {
    // 1. 先串行插入少量点建立初始图
    bootstrapSize := min(1000, len(vectors))
    for i := 0; i < bootstrapSize; i++ {
        idx.Insert(uint32(i), vectors[i])
    }
    
    // 2. 并行插入剩余点
    var wg sync.WaitGroup
    batchSize := (len(vectors) - bootstrapSize) / numWorkers
    
    for w := 0; w < numWorkers; w++ {
        wg.Add(1)
        go func(workerID int) {
            defer wg.Done()
            start := bootstrapSize + workerID*batchSize
            end := start + batchSize
            if workerID == numWorkers-1 {
                end = len(vectors)
            }
            for i := start; i < end; i++ {
                idx.Insert(uint32(i), vectors[i])
            }
        }(w)
    }
    wg.Wait()
    
    return nil
}
```

---

## 3. 搜索算法

### 3.1 贪婪搜索流程

```
GreedySearch(query, L, K):
输入: 查询向量, 搜索列表大小L, 返回数量K
输出: 最近的K个邻居

1. 初始化:
   - visited = {}
   - best = PriorityQueue(capacity=L)
   - 将入口点加入best和visited

2. while best中有未访问节点:
   - node = best中距离最小的未访问节点
   - 标记node为已访问
   - for each neighbor of node:
     if neighbor not in visited:
       visited.add(neighbor)
       dist = distance(query, neighbor)
       best.insert(Neighbor{neighbor, dist})

3. return best中最近的K个
```

```go
func (idx *VamanaIndex) Search(query []float32, k int, efSearch int) []Neighbor {
    scratch := idx.scratchPool.Get()
    defer idx.scratchPool.Put(scratch)
    
    scratch.Reset()
    L := max(efSearch, k)
    
    // 初始化: 从入口点开始
    startIDs := idx.dataProvider.StartingPoints()
    for _, startID := range startIDs {
        scratch.visited.Insert(startID)
        dist := idx.distanceToQuery(startID, query)
        scratch.best.Insert(Neighbor{ID: startID, Distance: dist})
    }
    
    // 贪婪搜索
    for scratch.best.HasUnvisited() {
        // 获取最近的未访问节点
        closest := scratch.best.PopClosestUnvisited()
        
        // 展开邻居
        neighbors := idx.dataProvider.GetNeighbors(closest.ID)
        for _, neighborID := range neighbors {
            if scratch.visited.Insert(neighborID) {
                dist := idx.distanceToQuery(neighborID, query)
                scratch.best.Insert(Neighbor{ID: neighborID, Distance: dist})
                scratch.cmps++
            }
        }
        scratch.hops++
    }
    
    // 返回Top-K
    return scratch.best.TopK(k)
}
```

### 3.2 候选集管理 (NeighborPriorityQueue)

```go
// NeighborPriorityQueue 带访问标记的优先队列
type NeighborPriorityQueue struct {
    data     []Neighbor
    capacity int
    visited  []bool // visited[i] 表示 data[i] 是否已访问
}

func NewNeighborPriorityQueue(capacity int) *NeighborPriorityQueue {
    return &NeighborPriorityQueue{
        data:     make([]Neighbor, 0, capacity),
        capacity: capacity,
        visited:  make([]bool, 0, capacity),
    }
}

func (pq *NeighborPriorityQueue) Insert(n Neighbor) {
    // 如果已满且n比最差的还差，直接丢弃
    if len(pq.data) >= pq.capacity {
        if n.Distance >= pq.data[len(pq.data)-1].Distance {
            return
        }
        // 移除最差的
        pq.data = pq.data[:len(pq.data)-1]
        pq.visited = pq.visited[:len(pq.visited)-1]
    }
    
    // 二分查找插入位置
    pos := sort.Search(len(pq.data), func(i int) bool {
        return pq.data[i].Distance > n.Distance
    })
    
    // 插入
    pq.data = append(pq.data, Neighbor{})
    pq.visited = append(pq.visited, false)
    copy(pq.data[pos+1:], pq.data[pos:])
    copy(pq.visited[pos+1:], pq.visited[pos:])
    pq.data[pos] = n
    pq.visited[pos] = false
}

func (pq *NeighborPriorityQueue) HasUnvisited() bool {
    for i, v := range pq.visited {
        if !v && i < len(pq.data) {
            return true
        }
    }
    return false
}

func (pq *NeighborPriorityQueue) PopClosestUnvisited() Neighbor {
    for i := 0; i < len(pq.data); i++ {
        if !pq.visited[i] {
            pq.visited[i] = true
            return pq.data[i]
        }
    }
    return Neighbor{} // 不应到达
}

func (pq *NeighborPriorityQueue) TopK(k int) []Neighbor {
    if k > len(pq.data) {
        k = len(pq.data)
    }
    result := make([]Neighbor, k)
    copy(result, pq.data[:k])
    return result
}
```

---

## 4. 与磁盘存储层集成

### 4.1 DataProvider 接口

```go
// DataProvider 数据提供者接口 (抽象内存/磁盘)
type DataProvider interface {
    // 获取入口点
    StartingPoints() []uint32
    SetMedoid(id uint32)
    
    // 邻居操作
    GetNeighbors(id uint32) []uint32
    SetNeighbors(id uint32, neighbors []uint32) error
    AppendNeighbor(id uint32, neighborID uint32) error
    
    // 向量操作
    GetVector(id uint32) ([]float32, error)
    
    // 距离计算
    Distance(id1, id2 uint32) float32
    DistanceToQuery(id uint32, query []float32) float32
    
    // 元数据
    NumPoints() uint64
    Dimension() int
}
```

### 4.2 磁盘数据提供者

```go
// DiskDataProvider 磁盘数据提供者
type DiskDataProvider struct {
    reader   磁盘索引读取器  // 来自磁盘存储设计
    bbqCodes []byte         // BBQ量化码 (内存常驻)
    metadata *图元数据
    
    // 缓存
    vectorCache *lru.Cache  // 热点向量缓存
    neighborCache *lru.Cache // 邻居列表缓存
}

func (p *DiskDataProvider) GetNeighbors(id uint32) []uint32 {
    // 1. 检查缓存
    if cached, ok := p.neighborCache.Get(id); ok {
        return cached.([]uint32)
    }
    
    // 2. 从磁盘读取
    neighbors, _ := p.reader.读取邻居(uint64(id))
    
    // 3. 加入缓存
    p.neighborCache.Add(id, neighbors)
    
    return neighbors
}

func (p *DiskDataProvider) DistanceToQuery(id uint32, query []float32) float32 {
    // 优先使用BBQ快速估计
    if p.bbqCodes != nil {
        return p.bbqDistance(id, query)
    }
    
    // 回退到精确计算
    vec, _ := p.GetVector(id)
    return euclideanDistance(vec, query)
}
```

### 4.3 搜索时的数据流

```
BBQ加速搜索流程:
┌─────────────────────────────────────────────────────────────┐
│ 1. 查询向量 → BBQ量化 (内存)                                 │
├─────────────────────────────────────────────────────────────┤
│ 2. 贪婪搜索:                                                │
│    ├─ 读取BBQ码 (内存，O(1))                                │
│    ├─ 计算汉明距离估计 (内存，快)                            │
│    └─ 读取邻居ID (mmap/缓存)                                │
├─────────────────────────────────────────────────────────────┤
│ 3. 候选集确定后 (约 efSearch 个):                           │
│    └─ 读取原始向量 (磁盘，仅Top-K的小倍数)                   │
├─────────────────────────────────────────────────────────────┤
│ 4. 精排返回 Top-K                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Go语言实现考量

### 5.1 内存管理

| 策略 | 说明 |
|------|------|
| **对象池** | `SearchScratch` 使用 `sync.Pool` 复用 |
| **预分配** | `AdjacencyList` 使用定长数组避免slice扩容 |
| **Epoch标记** | `EpochSet` 避免频繁清空visited集合 |
| **mmap区域** | 不含Go指针，避免GC扫描 |

### 5.2 并发安全

```go
// 读操作: 无锁并发
// 写操作: 细粒度锁

type VamanaIndex struct {
    // ...
    nodeLocks []sync.RWMutex // 每个节点一把锁
}

func (idx *VamanaIndex) SetNeighbors(id uint32, neighbors []uint32) {
    idx.nodeLocks[id].Lock()
    defer idx.nodeLocks[id].Unlock()
    idx.dataProvider.SetNeighbors(id, neighbors)
}

func (idx *VamanaIndex) GetNeighbors(id uint32) []uint32 {
    idx.nodeLocks[id].RLock()
    defer idx.nodeLocks[id].RUnlock()
    return idx.dataProvider.GetNeighbors(id)
}
```

### 5.3 性能优化点

| 优化 | 实现方式 |
|------|----------|
| **SIMD距离计算** | 使用 `github.com/viterin/vek` 或手写汇编 |
| **批量预取** | 搜索时预取下一跳邻居的向量 |
| **内存对齐** | 向量按32字节对齐以利用AVX |
| **BBQ量化** | 1位量化减少90%+内存，汉明距离用popcount |

---

## 6. 关键参数说明

| 参数 | 默认值 | 说明 | 调优建议 |
|------|--------|------|----------|
| R | 64 | 最大出度 | 增大提高召回率，但增加内存和搜索时间 |
| L | 100 | 构建时搜索列表 | 应 >= R，增大提高图质量 |
| Alpha | 1.2 | 剪枝阈值 | 1.0=严格剪枝，>1.0=允许更多邻居 |
| efSearch | 64 | 搜索时列表大小 | 增大提高召回率，降低速度 |

---

## 7. 与现有设计的关系

```
依赖关系:
┌─────────────────────────────────────────────────────────────┐
│ 本文档: Vamana图索引设计                                     │
│   - 数据结构: VamanaIndex, Neighbor, AdjacencyList          │
│   - 算法: GreedySearch, RobustPrune, Insert                 │
├─────────────────────────────────────────────────────────────┤
│ 依赖: DiskANN-Go版本磁盘存储设计方案.md                      │
│   - 文件格式: vamana.index, vamana.bbq                      │
│   - I/O抽象: 磁盘索引读取器, mmap实现                        │
└─────────────────────────────────────────────────────────────┘
```

---

**创建时间**: 2026-02-05
