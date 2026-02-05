# Vamana BBQ (Binary Quantized) 集成方案

> 目标：集成 BBQ 二值量化，使用位运算加速距离计算，大幅减少内存占用。

## 1. 背景与动机

### 1.1 当前状态

Vamana 索引当前使用全精度 `float32` 向量进行距离计算：
- 每个 128 维向量占用 512 字节
- 100K 向量需要约 50MB 内存（仅向量数据）
- 距离计算使用 `euclideanDistance`，需要 128 次浮点减法和乘法

### 1.2 BBQ 优势

BBQ (Better Binary Quantization) 将向量量化为 1-bit 表示：
- 每个 128 维向量仅需 16 字节（128 bits = 2 × uint64）
- 内存压缩比：32:1
- 距离计算使用 POPCNT 指令，单条指令处理 64 位

### 1.3 性能预期

| 指标 | 当前 | BBQ 后 |
|------|------|--------|
| 向量内存 | 512 B/vec | 16 B/vec |
| 100K 向量内存 | ~50 MB | ~1.6 MB |
| 距离计算 | ~128 FLOPS | 2 POPCNT |
| 召回率 | 100% | ~95-98% |

## 2. 核心设计

### 2.1 数据结构扩展

```go
// VamanaIndex 扩展字段
type VamanaIndex struct {
    // ... 原有字段 ...
    
    // BBQ 量化数据
    bbqEnabled       bool          // 是否启用 BBQ
    bbqCodes         []uint64      // 紧凑存储的二值编码 (所有向量)
    bbqCompensations []float32     // 补偿因子 (欧氏距离用 ||x||²)
    bbqCentroid      []float32     // 全局质心向量
    bbqUint64PerVec  int           // 每个向量占用的 uint64 数量
}
```

**内存布局说明**：

每个 128 维向量量化为 128 bits = 2 个 uint64。
`bbqCodes` 采用扁平化存储以减少 slice header 开销和 GC 压力：

```
bbqCodes = [vec0_u64_0, vec0_u64_1, vec1_u64_0, vec1_u64_1, ...]
           |<-- vec 0 -->|          |<-- vec 1 -->|
```

访问向量 i 的编码：`bbqCodes[i*bbqUint64PerVec : (i+1)*bbqUint64PerVec]`

### 2.2 量化流程

利用现有 `kernel/vectordb` 包中的 BBQ 实现：

```go
import "github.com/siyuan-note/siyuan/kernel/vectordb"

// 量化单个向量
func (idx *VamanaIndex) quantizeVector(vec []float32) ([]uint64, float32) {
    quantizer := vectordb.新建标量量化器(vectordb.欧氏距离)
    
    // 1-bit 量化
    quantized := make([]byte, len(vec))
    result := quantizer.标量量化(vec, quantized, 1, idx.bbqCentroid)
    
    // 打包为 uint64
    packed := vectordb.打包为二进制(quantized)
    codes := vectordb.字节转uint64(packed)
    
    return codes, result.附加校正 // 附加校正 = ||x||² for 欧氏距离
}
```

### 2.3 距离计算

#### 2.3.1 BBQ 距离公式

对于欧氏距离，BBQ 使用以下近似公式：

```
||a - b||² ≈ ||a||² + ||b||² - 2 * BBQ_dot(a, b)
```

其中 `BBQ_dot` 通过汉明距离还原：

```go
// 计算两个节点间的 BBQ 距离
func (idx *VamanaIndex) bbqDistance(id1, id2 uint32) float32 {
    offset1 := int(id1) * idx.bbqUint64PerVec
    offset2 := int(id2) * idx.bbqUint64PerVec
    
    codes1 := idx.bbqCodes[offset1 : offset1+idx.bbqUint64PerVec]
    codes2 := idx.bbqCodes[offset2 : offset2+idx.bbqUint64PerVec]
    
    // 使用 POPCNT 计算点积
    dotProduct := vectordb.计算打包位点积64(codes1, codes2)
    
    // 还原欧氏距离
    normSq1 := idx.bbqCompensations[id1]
    normSq2 := idx.bbqCompensations[id2]
    
    return normSq1 + normSq2 - 2.0*float32(dotProduct)
}
```

#### 2.3.2 查询距离计算

```go
// 计算节点到查询向量的 BBQ 距离
func (idx *VamanaIndex) bbqDistanceToQuery(
    id uint32, 
    queryCode []uint64, 
    queryNormSq float32,
) float32 {
    offset := int(id) * idx.bbqUint64PerVec
    codes := idx.bbqCodes[offset : offset+idx.bbqUint64PerVec]
    
    dotProduct := vectordb.计算打包位点积64(queryCode, codes)
    normSq := idx.bbqCompensations[id]
    
    return queryNormSq + normSq - 2.0*float32(dotProduct)
}
```

### 2.4 两阶段搜索策略

为保证召回率，采用两阶段搜索：

1. **粗筛阶段**：使用 BBQ 距离快速筛选候选集（扩大 L 参数）
2. **精排阶段**：对候选集使用全精度距离重排序

```go
func (idx *VamanaIndex) SearchWithBBQ(query []float32, k int) []SearchResult {
    // 阶段1: BBQ 粗筛 (L 扩大 2-3 倍)
    bbqL := idx.config.L * 3
    candidates := idx.greedySearchBBQ(query, bbqL)
    
    // 阶段2: 全精度重排序
    for i := range candidates {
        candidates[i].Distance = idx.distanceToQuery(candidates[i].ID, query)
    }
    sort.Slice(candidates, func(i, j int) bool {
        return candidates[i].Distance < candidates[j].Distance
    })
    
    if len(candidates) > k {
        candidates = candidates[:k]
    }
    return candidates
}
```

## 3. 实施步骤

### P0: 基础设施 (预计 2h)

1. **包依赖处理**
   - 在 `vamana` 包中导入 `kernel/vectordb` 的 BBQ 组件
   - 或将 BBQ 核心代码复制到 `vamana/bbq.go`（避免循环依赖）

2. **数据结构扩展**
   - 修改 `VamanaIndex` 结构体，添加 BBQ 字段
   - 修改 `Config` 添加 `EnableBBQ bool` 选项

3. **初始化逻辑**
   - 修改 `New()` 方法初始化 BBQ 字段

### P1: 量化计算 (预计 3h)

1. **质心计算**
   ```go
   func (idx *VamanaIndex) computeCentroid() []float32
   ```

2. **并行量化**
   ```go
   func (idx *VamanaIndex) computeBBQDataParallel(numWorkers int)
   ```

3. **集成到构建流程**
   - 在 `initializeForBuild` 中调用量化计算

### P2: 距离函数 (预计 2h)

1. **实现 BBQ 距离计算**
   ```go
   func (idx *VamanaIndex) bbqDistance(id1, id2 uint32) float32
   func (idx *VamanaIndex) bbqDistanceToQuery(id uint32, queryCode []uint64, queryNormSq float32) float32
   ```

2. **实现 BBQ 搜索**
   ```go
   func (idx *VamanaIndex) greedySearchBBQ(query []float32, L int) []Neighbor
   ```

### P3: 两阶段搜索 (预计 2h)

1. **实现混合搜索**
   ```go
   func (idx *VamanaIndex) SearchWithBBQ(query []float32, k int) []SearchResult
   ```

2. **自动选择策略**
   - 根据 `bbqEnabled` 自动选择搜索路径

### P4: 测试与验证 (预计 2h)

1. **单元测试**
   - `TestBBQQuantization`: 验证量化正确性
   - `TestBBQDistance`: 验证距离计算与全精度的相关性
   - `TestBBQSearch`: 验证搜索召回率

2. **性能基准**
   - 对比 BBQ 与全精度的构建速度
   - 对比 BBQ 与全精度的搜索速度
   - 测量内存占用

## 4. 配置选项

```go
type Config struct {
    // ... 原有字段 ...
    
    // BBQ 配置
    EnableBBQ        bool    // 是否启用 BBQ (默认 false)
    BBQRerankFactor  int     // 重排序扩大因子 (默认 3)
}
```

## 5. 注意事项

### 5.1 内存布局

- `bbqCodes` 使用扁平 `[]uint64` 存储，寻址公式：`idx * bbqUint64PerVec`
- 对缓存更友好，减少 GC 压力

### 5.2 并发安全

- 构建期间 BBQ 数据是只读的，无需加锁
- 增量插入时需要原子扩展 `bbqCodes` 和 `bbqCompensations`

### 5.3 维度限制

- BBQ 对低维向量效果较差
- 建议仅对 dim >= 64 的向量启用 BBQ
- 参考 `vectordb.BBQEnableThreshold = 33`

### 5.4 召回率权衡

- BBQ 是有损压缩，召回率会略有下降
- 通过增大 `BBQRerankFactor` 可提高召回率，但会增加计算量
- 典型配置：`BBQRerankFactor = 3` 可达到 ~98% 召回率

## 6. 后续优化方向

1. **4-bit 查询量化**：查询使用 4-bit 量化，索引使用 1-bit，提高精度
2. **SIMD 优化**：使用 AVX2/AVX-512 加速 POPCNT 批量计算
3. **分层量化**：对不同层使用不同精度的量化
4. **动态质心更新**：增量插入时动态更新质心

## 7. 参考资料

- [Lucene BBQ 实现](https://github.com/apache/lucene/blob/main/lucene/core/src/java/org/apache/lucene/util/quantization/BinaryQuantizer.java)
- [DiskANN Binary Quantization](toread/DiskANN/diskann-quantization/src/binary/)
- 现有实现：`kernel/vectordb/bbq_*.go`
