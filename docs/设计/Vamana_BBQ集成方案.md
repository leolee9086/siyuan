# Vamana BBQ (Binary Quantized) 集成计划

> 目标：集成 BBQ 二值量化，位运算加速计算，减少内存。

## 1. 核心变更

### 1.1 数据结构 (`VamanaIndex`)

```go
type VamanaIndex struct {
    // ... 原有字段 ...
    
    // BBQ 数据
    bbqCodes         []uint64    // 紧凑存储的二值编码 (所有向量)
    bbqCompensations []float32   // 补偿因子 (欧氏距离使用 ||x||^2)
    quantizer        *BBQQuantizer 
}
```

每个向量 128维 -> 128bit -> 2个uint64。
`bbqCodes` 采用扁平化存储：`[vec1_part1, vec1_part2, vec2_part1, vec2_part2 ...]` 以减少 slice header 开销和 GC。

### 1.2 初始化流程 (`initializeForBuild`)

1.  初始化量化器
2.  计算全局质心 (Centroid)
3.  **并行计算** 所有向量的 BBQ 编码和补偿因子
4.  填充 `bbqCodes` 和 `bbqCompensations`

### 1.3 距离函数

新增接口用于 BBQ 距离计算：

```go
// 计算两个节点间的 BBQ 距离
func (idx *VamanaIndex) computeBBQDistance(id1, id2 uint32) float32

// 计算节点到查询向量的 BBQ 距离
func (idx *VamanaIndex) computeBBQDistanceToQuery(id uint32, queryCode []uint64, queryComp float32) float32
```

## 2. 实施步骤

### P0: 数据结构与工具链集成
1.  解决包依赖（`vectordb` vs `vamana`）
    *   *建议将 BBQ 工具类移动到独立包 `vectordb/quant` 或在此处复用*
2.  修改 `VamanaIndex` 结构体
3.  修改 `New` 方法初始化 BBQ 字段

### P1: 初始化与并行计算
1.  实现 `computeBBQDataParallel`
2.  在 `initializeForBuild` 中调用

### P2: 距离函数实现
1.  实现 Hamming 距离计算 (PopCount)
2.  实现 欧氏距离还原公式

### P3: 验证
1.  单测 `TestBBQIntegration`：验证 BBQ 距离与原始距离的相关性

## 3. 注意事项

*   **内存布局**：`bbqCodes` 使用扁平 `[]uint64` 可能会让寻址稍微复杂一点 `idx * nUint64PerVec`，但对缓存更友好。
*   **并发安全**：构建期间 BBQ 数据是只读的，无需加锁。
