# DiskVamanaIndex 增量操作集成方案

## 1. 现有架构分析

### 1.1 DiskVamanaIndex 关键字段

| 字段 | 类型 | 用途 |
|------|------|------|
| `basePath` | `string` | 索引文件基础路径 |
| `metadata` | `*storage.GraphMetadata` | 图元数据：NumPoints, Dims, Medoid, NodeLen, NodesPerBlock |
| `maxDegree` | `int` | 最大出度，由 NodeLen 和 Dims 计算得出 |
| `reader` | `storage.DiskIndexReader` | mmap 磁盘读取器 |
| `bbqCodes` | `[]byte` | 内存驻留的 BBQ 1-bit 量化码 |
| `bbqCentroid` | `[]float32` | BBQ 质心向量 |
| `bbqLowerBounds` | `[]float32` | 量化区间下界 |
| `bbqUpperBounds` | `[]float32` | 量化区间上界 |
| `bbqCorrections` | `[]float32` | 校正因子 |
| `bbqQuantizedSums` | `[]float32` | 量化分量和 |
| `bbqHasMeta` | `bool` | 是否有 V2 量化元数据 |
| `deleted` | `*storage.DeletedBitmap` | 软删除位图 |
| `closed` | `bool` | 关闭状态 |
| `mu` | `sync.RWMutex` | 并发保护锁 |

### 1.2 关键方法

**生命周期**: `Open()`, `Close()`

**只读访问**: `NumPoints()`, `NumPointsTotal()`, `Dimension()`, `Medoid()`, `MaxDegree()`,
`GetNeighbors()`, `GetBBQCode()`, `ReadVector()`, `IsDeleted()`, `HasBBQ()`, `HasBBQMeta()`

**搜索**: `Search()` → 两阶段流程：
- Phase 1: `greedySearchBBQ()` 或 `greedySearchDisk()` — 图遍历产生候选集
- Phase 2: `rerankCandidates()` — 从磁盘读原始向量精排

**构建**: `BuildFromVectors()` — 全量构建，先内存建图再流式写盘

**持久化**: `SaveToDisk()` — 仅 VamanaIndex 使用，DiskVamanaIndex 无对应方法

### 1.3 incremental.go 参考实现要点

`IncrementalIndex` 作为独立包装类，维护：
- `appendVectors [][]float32` + `appendNeighbors [][]uint32` — 新增向量的内存缓冲
- `modifiedNeighbors map[uint64][]uint32` — 已修改的磁盘节点邻居表
- `appendBBQCodes []byte` — 新增向量的 BBQ 码
- `bbqQuantizer` / `bbqCentroid` — BBQ 量化器

核心算法：Insert 用贪心搜索+鲁棒剪枝连接新节点，Delete 用 OneHop 修复边，Compact 重映射 ID 写新文件。

## 2. 集成方案：新增字段

在 `DiskVamanaIndex` 结构体中新增以下字段：

```
// 增量操作 - Append Buffer
appendVectors     [][]float32          // 新增向量（内存）
appendNeighbors   [][]uint32           // 新增向量的邻居表
appendBBQCodes    []byte               // 新增向量的 BBQ 打包码
appendBBQLower    []float32            // 新增向量的量化下界
appendBBQUpper    []float32            // 新增向量的量化上界
appendBBQCorr     []float32            // 新增向量的校正因子
appendBBQQSum     []float32            // 新增向量的量化分量和

// 增量操作 - 已修改邻居
modifiedNeighbors map[uint64][]uint32  // 磁盘节点的修改后邻居表

// 增量操作 - 配置与状态
incrConfig        IncrementalConfig    // 增量操作配置
compacting        bool                 // 压缩进行中标志
```

**设计要点**：
- `deleted` 字段已存在，直接复用
- BBQ 元数据需要为 append buffer 单独维护，因为磁盘侧的 BBQ 数组是连续内存，不宜追加
- `modifiedNeighbors` 用 map 存储，仅记录被 Insert/Delete 修改过的磁盘节点

## 3. 各方法实现要点

### 3.1 Insert

1. 验证维度匹配、索引未关闭
2. 计算新节点 ID = `metadata.NumPoints + len(appendVectors)`
3. 调用统一的 `getVector()`/`getNeighbors()` 执行贪心搜索，找到候选邻居
4. 鲁棒剪枝选出最终邻居，存入 `appendNeighbors`
5. 向量存入 `appendVectors`
6. 若启用 BBQ，用已有 `bbqCentroid` 量化新向量，追加到 `appendBBQ*` 数组
7. 为每个邻居添加反向边（back-edge），超出 R 则剪枝
8. 修改的磁盘节点邻居存入 `modifiedNeighbors`，修改的 append 节点直接更新 `appendNeighbors`

**锁策略**: 写锁保护整个 Insert 操作

### 3.2 Delete

1. 验证节点存在且未删除
2. 获取待删除节点的邻居列表
3. 在 `deleted` 位图中标记删除
4. OneHop 修复：遍历被删节点的每个邻居 N：
   - 从 N 的邻居表中移除被删节点
   - 将被删节点的其他邻居加入 N 的邻居表
   - 超出 R 则鲁棒剪枝
   - 结果存入 `modifiedNeighbors` 或更新 `appendNeighbors`

**锁策略**: 写锁保护整个 Delete 操作

### 3.3 Compact

1. 设置 `compacting = true`，防止并发压缩
2. 构建 oldID → newID 映射，跳过已删除节点
3. 遍历所有活跃节点，收集向量和邻居（通过统一的 `getVector()`/`getNeighbors()`）
4. 重映射所有邻居 ID
5. 重新计算 medoid
6. 写入新的 .index 文件（复用 `writeCompactedIndexFile` 逻辑）
7. 若启用 BBQ，重新量化所有向量写入新 .bbq 文件
8. 返回 `CompactResult` 统计信息

**注意**: Compact 不修改当前索引状态，产出新文件后由调用者决定切换

### 3.4 Search（融合搜索）

Search 需同时搜索磁盘数据和 append buffer，修改点：

**Phase 1 - 图遍历**:
- `getNeighbors()` 统一方法：先查 `modifiedNeighbors`，再查 `appendNeighbors`，最后回退到磁盘读取
- `isDeleted()` 统一方法：直接查 `deleted` 位图
- BBQ 距离计算：磁盘节点用现有 `bbqCodes`/`bbqLowerBounds` 等；append 节点用 `appendBBQ*` 数组
- Visited 集合容量需扩展到 `metadata.NumPoints + len(appendVectors)`

**Phase 2 - 精排**:
- `ReadVector()` 统一方法：append 节点直接从 `appendVectors` 返回，磁盘节点走 mmap 读取

**关键辅助方法**:

```
getVector(nodeID)    → appendVectors 或 reader.ReadVector
getNeighbors(nodeID) → modifiedNeighbors → appendNeighbors → reader.ReadNeighbors
getBBQCode(nodeID)   → appendBBQCodes 或 bbqCodes
isDeleted(nodeID)    → deleted.IsDeleted
```

判断逻辑：`nodeID >= metadata.NumPoints` 则为 append 节点，否则为磁盘节点。

## 4. 文件组织建议

| 文件 | 内容 |
|------|------|
| `disk_index.go` | 结构体定义（新增字段）、Open/Close、访问器方法 |
| `disk_search.go` | Search 方法（改造为融合搜索） |
| `disk_incremental.go` | Insert、Delete、Compact、辅助方法（替代 incremental.go） |
| `disk_build.go` | BuildFromVectors（不变） |
| `save.go` | VamanaIndex 的 SaveToDisk（不变） |

**迁移步骤**:
1. 在 `disk_index.go` 的 `DiskVamanaIndex` 结构体中新增字段
2. 创建 `disk_incremental.go`，将增量操作实现为 `DiskVamanaIndex` 的方法
3. 改造 `disk_search.go` 中的搜索方法，支持 append buffer
4. 验证通过后删除 `incremental.go`

## 5. 与 IncrementalIndex 的关键差异

| 方面 | IncrementalIndex（当前） | 集成方案（目标） |
|------|--------------------------|------------------|
| 结构 | 独立包装类持有 `*DiskVamanaIndex` | 字段直接在 `DiskVamanaIndex` 上 |
| 搜索 | 无自己的 Search，依赖 base | Search 内部统一处理磁盘+append |
| 锁 | 双层锁（自身 mu + base.mu） | 单层锁（自身 mu） |
| BBQ | 仅存打包码，无元数据 | 完整存储 Lower/Upper/Corr/QSum |
| 初始化 | 需显式 NewIncrementalIndex | Open 后即可直接 Insert/Delete |
