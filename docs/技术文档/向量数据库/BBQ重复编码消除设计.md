# BBQ 重复编码消除设计

> **范围**: `packages/vectordb`（不触碰 `kernel/vectordb`，kernel 为最后迁移部分）
> **目标**: 消除 BBQ 量化与距离计算在内存索引、磁盘索引、根包之间的重复编码与语义偏离，使 BBQ 路径只有一份权威实现
> **硬约束**: 任何改动必须保证 `go test ./...` 无回归；性能不得下降（以现有基准为基线，重构后基准不得退化）

---

## 1. 重复编码完整目录

### A. 死代码重复（直接删除）

| 编号 | 位置 | 问题 |
|---|---|---|
| A1 | [`packages/vectordb/quantization.go`](../../../packages/vectordb/quantization.go:9) | `ComputeQuantizedVectorQuantiles`、`Float32ToBinary`、`HammingDistance` 三个函数无任何调用方，与 `bbq` 包的 `ComputePackedHammingDistance`/`ComputePackedHammingDistance64` 及 `ScalarQuantizer` 功能重叠，是更简陋的早期实现残留 |
| A2 | [`packages/vectordb/vamana/bbq.go:119`](../../../packages/vectordb/vamana/bbq.go:119) | `bbqDistance(id1,id2)` 手写简化距离公式（`scale=(n1+n2)/(2*dim)`），全包无调用方，且与 scorer 路径数值不一致 |

### B. 内存/磁盘并行重复（提取统一实现）

| 编号 | 内存实现 | 磁盘实现 | 重复内容 |
|---|---|---|---|
| B1 | `VamanaIndex.bbqDistanceToQuery1Bit`（bbq.go:210） | `DiskVamanaIndex.bbqCorrectedDistance`（disk_search.go:302） | 取 packed code → `bbq.ComputePackedDotProduct` → 组装 `indexCorr` → `scorer.ComputeQuantizedDistance(...,use4Bit=false)` |
| B2 | `VamanaIndex.bbqDistanceToQuery4Bit`（bbq.go:184） | `DiskVamanaIndex.bbqCorrectedDistance4Bit`（disk_search.go:331） | 取 packed code → `bbq.ComputeTransposedDotProduct` → 组装 `indexCorr` → `scorer.ComputeQuantizedDistance(...,use4Bit=true)` |
| B3 | `VamanaIndex.computeBBQDataParallel`（bbq.go:59） | `diskBuilder.computeBBQChunk`（disk_build.go:399） | 逐向量：`quantizer.Quantize` → `bbq.PackBinary` → copy packed → 存 `LowerBound/UpperBound/Correction/QuantizedSum` 四字段 |
| B4 | `greedySearchBBQWithQuantized`（bbq.go:298） | `greedySearchBBQ1BitWithQuantized`（bbq.go:351） | 两个贪婪搜索循环结构完全相同，仅距离函数不同（4Bit vs 1Bit） |

B1/B2 的差异仅在：code 取法（连续切片 vs `getBBQCodeUnlocked` 可能走 mmap）、校正字段名（`bbqCompensations` vs `bbqCorrections`）、nil 检查、维度来源（`idx.dimension` vs `idx.metadata.Dims`）。

### C. 不一致与语义偏离（统一语义）

| 编号 | 位置 | 问题 |
|---|---|---|
| C1 | [`disk_search.go:361`](../../../packages/vectordb/vamana/disk_search.go:361) `quantizeQueryToBBQ` | 简单 sign 量化（`v>0→1`），无质心、无各向异性优化。**经核查**：该函数仅在磁盘搜索的向后兼容路径 `greedySearchBBQHamming`（`idx.bbqHasMeta==false`，即 v1 旧索引无量化元数据）使用；v2 路径 `greedySearchBBQWithMeta` 已正确使用 `quantizer.Quantize(query, ..., 1, idx.bbqCentroid)`。故 C1 不是同一索引内查询/构建不一致，而是 v1 旧索引遗留回退路径——若 v1 格式不再支持则该路径可整体移除，否则保留但需明确标注为 legacy 并统一命名 |
| C2 | bbq.go:66-70 vs disk_build.go:196-200 | 内存索引字段名 `bbqCompensations`，磁盘索引字段名 `bbqCorrections`，二者都存 `result.Correction`，命名分裂 |
| C3 | [`bbq.go:154`](../../../packages/vectordb/vamana/bbq.go:154) | 注释"与 store.go 中的实现保持一致"，但 `store.go` 已无任何 bbq 实现，引用了不存在的代码 |

---

## 1.5 Rust 参考实现对照（正确性验证）

对照 [`toread/rust-bbq/`](../../../toread/rust-bbq/) 参考实现验证 Go BBQ 核心算法正确性：

| Go 实现 | Rust 参考 | 对照结论 |
|---|---|---|
| `bbq.ScalarQuantizer.Quantize`（quantizer.go:95） | `OptimizedScalarQuantizer::scalar_quantize`（optimized_scalar_quantizer.rs:52） | **一致**。质心点积（非欧氏）、质心中心化、min/max/sum/sqSum、`MinMSEGrid` 初始区间、坐标下降 `OptimizeInterval`、1-bit 阈值 `(lower+upper)/2` 二值化、`Correction=normSq`(欧氏)/`centroidDot`(其他) 均逐项匹配 |
| `bbq.QuantizedScorer.ComputeScore1Bit`（scorer.go:41） | `compute_one_bit_similarity_score`（binary_quantized_scorer.rs:136） | **一致**。`ax*ay*dim + ay*lx*x1 + ax*ly*y1 + lx*ly*dot` 还原公式与 Euclidean/Cosine/MIP 三分支匹配 |
| `bbq.QuantizedScorer.ComputeScore4Bit`（scorer.go:78） | `compute_four_bit_similarity_score`（binary_quantized_scorer.rs:179） | **一致**。4-bit 路径 `ly *= FOUR_BIT_SCALE` 缩放与三分支匹配 |
| `bbq.QuantizedScorer.ComputeQuantizedDistance`（scorer.go:120） | `compute_one_bit_similarity_score` 返回 `1/(1+score)` | **有意偏离**。Go 欧氏路径经 `computeEuclideanDistanceEstimate` 返回原始 `‖q‖²+‖x‖²-2·dotEst`（距离，越小越近），而非参考的 `1/(1+d²)`（相似度，越大越近）。原因：Vamana 图搜索需距离语义，饱和变换会丧失区分度。Cosine/MIP 路径用 `1-score` 转距离，与参考相似度定义一致。偏离已在源码注释说明，非 bug |

**结论**：Go BBQ 量化器与评分器核心算法与 Rust 参考一致；`quantizeQueryToBBQ`（C1）是与参考不符的简化路径，但仅用于 v1 旧索引遗留回退，不在 v2 主路径上。

## 2. 去重设计

### 2.1 统一 BBQ 数据访问接口

在 `packages/vectordb/vamana` 包内新增 `bbq_store.go`，定义内存/磁盘索引共同满足的只读接口，把"取码 + 取元数据 + 维度 + 评分器"抽象为单一契约：

```go
// bbqStore 提供 BBQ 量化码与元数据的统一只读访问。
// VamanaIndex 与 DiskVamanaIndex 均实现该接口，消除距离计算的内存/磁盘并行重复。
type bbqStore interface {
    // bbqCode 返回 id 的 packed 1-bit 量化码；不存在时返回 nil。
    bbqCode(id uint32) []byte
    // bbqMeta 返回 id 的量化元数据（LowerBound/UpperBound/Correction/QuantizedSum）。
    bbqMeta(id uint32) bbq.QuantizationResult
    // bbqDimension 返回向量维度。
    bbqDimension() int
    // bbqScorer 返回预创建的评分器（与构建时距离度量一致）。
    bbqScorer() *bbq.QuantizedScorer
}
```

`VamanaIndex` 的实现：`bbqCode` 直接切片 `idx.bbqPacked[offset:offset+packedSize]`；`bbqMeta` 从 `idx.bbqLowerBounds/UpperBounds/Compensations/QuantizedSums` 组装。

`DiskVamanaIndex` 的实现：`bbqCode` 调 `getBBQCodeUnlocked`；`bbqMeta` 从 `idx.bbqLowerBounds/UpperBounds/Corrections/QuantizedSums` 组装。

### 2.2 统一查询距离计算

把 B1/B2 的重复序列提取为 `bbq_store.go` 上的单一自由函数，内存与磁盘共用：

```go
// bbqQueryDistance 计算已量化查询向量到索引中 id 向量的近似距离。
// use4Bit=true 时 queryCode 为 BitTranspose 布局，走 ComputeTransposedDotProduct；
// use4Bit=false 时 queryCode 为 packed 1-bit，走 ComputePackedDotProduct。
func bbqQueryDistance(store bbqStore, id uint32, queryCode []byte, queryCorr bbq.QuantizationResult, use4Bit bool) float32 {
    indexCode := store.bbqCode(id)
    if indexCode == nil {
        return LargeInvalidDistance
    }
    var dotProd int
    if use4Bit {
        dotProd = bbq.ComputeTransposedDotProduct(queryCode, indexCode)
    } else {
        dotProd = bbq.ComputePackedDotProduct(queryCode, indexCode)
    }
    indexCorr := store.bbqMeta(id)
    return store.bbqScorer().ComputeQuantizedDistance(dotProd, queryCorr, indexCorr, store.bbqDimension(), 0, use4Bit)
}
```

重构后 `VamanaIndex.bbqDistanceToQuery1Bit/4Bit` 与 `DiskVamanaIndex.bbqCorrectedDistance/4Bit` 全部改为委托 `bbqQueryDistance`，仅保留各自的 `bbqStore` 实现差异。nil 检查统一收敛到 `bbqQueryDistance` 内（内存切片不会为 nil，但统一路径无害且更安全）。

### 2.3 统一构建时量化

把 B3 的逐向量量化循环提取为 `bbq` 包内的批量量化函数，内存与磁盘共用：

```go
// QuantizeBatch 将 vectors 逐向量量化为 packed 1-bit 码并写入 packed/lower/upper/corr/sum。
// quantizer 由调用方按距离度量创建；centroid 为中心化质心（可为 nil 表示不中心化）。
// 每个 worker 应传入独立的 quantized 临时缓冲区以避免并发写冲突。
func QuantizeBatch(quantizer *ScalarQuantizer, vectors [][]float32, centroid []float32,
    packed []byte, packedSize int, lower, upper, corr, sum []float32) {
    quantized := make([]byte, len(vectors[0]))
    for i, vec := range vectors {
        result := quantizer.Quantize(vec, quantized, 1, centroid)
        p := bbq.PackBinary(quantized)
        copy(packed[i*packedSize:(i+1)*packedSize], p)
        lower[i] = result.LowerBound
        upper[i] = result.UpperBound
        corr[i] = result.Correction
        sum[i] = result.QuantizedSum
    }
}
```

内存 `computeBBQDataParallel` 与磁盘 `computeBBQChunk` 改为按 chunk 调用 `bbq.QuantizeBatch`（并行由调用方按现有 worker 切分）。注意：`QuantizeBatch` 内部 `quantized` 缓冲区对单线程安全，并行场景由调用方为每个 worker 调用一次独立 `QuantizeBatch`，保持现有"每 worker 独立缓冲"语义。

### 2.4 统一贪婪搜索循环

把 B4 的两个近乎相同的搜索循环合并为参数化单函数，距离计算通过函数值注入：

```go
// greedySearchBBQQuantized 执行 BBQ 贪婪搜索，distFn 注入距离计算（1-bit 或 4-bit）。
func greedySearchBBQQuantized(idx *VamanaIndex, scratch *SearchScratch, startIDs []uint32,
    distFn func(id uint32) float32, L int) []Neighbor {
    // 现有 greedySearchBBQWithQuantized 的循环体，dist 调用替换为 distFn(id)
}
```

`greedySearchBBQ4Bit`/`greedySearchBBQ1Bit` 各自用闭包注入 `bbqQueryDistance(...,use4Bit=true/false)`。

### 2.5 消除语义偏离

- **C1 `quantizeQueryToBBQ`**：磁盘搜索的简单 sign 量化路径改为复用 `ScalarQuantizer.Quantize(query, buf, 1, centroid)`，与构建端一致。需确认磁盘索引查询时是否持有质心；若磁盘索引未持久化质心，则质心需纳入磁盘元数据持久化（这是正确性修复，不是可选优化）。
- **C2 字段命名**：统一为 `bbqCorrections`（与 `QuantizationResult.Correction` 字段名一致），内存索引 `bbqCompensations` 重命名为 `bbqCorrections`。
- **C3 过期注释**：删除 bbq.go:154 "与 store.go 中的实现保持一致"。

### 2.6 删除死代码

- 删除 `packages/vectordb/quantization.go` 整个文件（A1）。
- 删除 `VamanaIndex.bbqDistance`（A2）。

---

## 3. 重构步骤与验证门禁

每步独立可验证，按顺序执行，任一步回归即停止。

| 步骤 | 内容 | 验证 |
|---|---|---|
| S1 | 删除 `quantization.go`（A1）与 `bbqDistance`（A2） | `go build ./...`、`go test ./... -count=1 -timeout 600s` 通过 |
| S2 | 新增 `bbq_store.go`：定义 `bbqStore` 接口与 `bbqQueryDistance`；为 `VamanaIndex`/`DiskVamanaIndex` 添加接口实现方法 | `go build ./...` 通过 |
| S3 | `VamanaIndex.bbqDistanceToQuery1Bit/4Bit` 改为委托 `bbqQueryDistance`；`DiskVamanaIndex.bbqCorrectedDistance/4Bit` 改为委托 `bbqQueryDistance` | `go test ./...` 通过；BBQ 召回率基准不退化 |
| S4 | 合并 `greedySearchBBQWithQuantized`/`greedySearchBBQ1BitWithQuantized` 为 `greedySearchBBQQuantized`（B4） | `go test ./...` 通过 |
| S5 | 提取 `bbq.QuantizeBatch`；内存/磁盘构建改为调用它（B3） | `go test ./...` 通过；构建基准不退化 |
| S6 | 统一字段名 `bbqCompensations`→`bbqCorrections`（C2）；删除过期注释（C3） | `go build ./...`、`go test ./...` 通过 |
| S7 | 处理 `quantizeQueryToBBQ`（C1）：先确认 v1 旧索引格式是否仍需支持；若不再支持则移除 `greedySearchBBQHamming` 整条遗留路径与 `quantizeQueryToBBQ`/`bbqHammingDistance`/`fusedHammingDistance`；若仍需支持则保留但加 `// legacy v1 fallback` 标注并统一命名，不强行套用 `ScalarQuantizer.Quantize`（v1 无质心元数据） | `go test ./...` 通过；磁盘 BBQ 召回率基准不退化 |
| S8 | 全量回归：`go test -race . ./bbq ./storage`、`go test ./... -count=1 -timeout 600s`、README 三条定向验证命令 | 全部通过 |

### 性能不退化验证

重构前后各跑一次以下命令并对比（需 SIFT 数据集，否则以现有非数据集基准为准）：

```powershell
$env:VECTORDB_SCALE_TEST='1'
go test ./vamana -run "TestBuildFromVectors_Recall_10K|TestDiskIndex_Insert$|TestDiskIndex_Delete$" -count=1 -timeout 180s -v
```

判定：Recall@10 不得低于重构前；单次搜索延迟 P50/P95 不得劣化超过 5%。

---

## 4. 不做的事

- 不触碰 `kernel/vectordb/bbq/`（kernel 为最后迁移部分）。
- 不改变 BBQ 的公开算法语义（各向异性损失、坐标下降、1-bit/4-bit 双路径均保留）。
- 不在本轮引入新的量化精度等级（如 2-bit、8-bit），仅消除重复。
- 不改变磁盘文件格式（除非 C1 修复需要持久化质心，届时格式版本号递增并保留旧格式加载兼容）。

---

## 5. 完成标志

- `packages/vectordb` 内 BBQ 距离计算只有 `bbqQueryDistance` 一份实现
- 构建时量化只有 `bbq.QuantizeBatch` 一份实现
- 贪婪搜索循环只有 `greedySearchBBQQuantized` 一份实现
- `quantization.go` 与 `bbqDistance` 死代码已删除
- 查询端与构建端量化逻辑一致（均走 `ScalarQuantizer.Quantize`）
- `go test ./...`、`go test -race` 全通过，召回率与性能无回归
