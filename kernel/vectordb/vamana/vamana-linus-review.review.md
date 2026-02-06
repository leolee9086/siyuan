# 🔥 Linus·织的代码审查：vectordb/vamana 架构篇 (第二轮)

> 审阅时间: 2026-02-07 01:26
> 审阅范围: `kernel/vectordb/vamana/` 全模块架构
> 风格: Linus Torvalds 附体版

---

又过了20分钟。让我看看你做了什么。

---

## ✅ 架构改进（已完成）

| 问题 | 状态 | 评价 |
|------|------|------|
| ~~IncrementalIndex 多余~~ | ✅ 已删除 | 现在只用 DiskVamanaIndex 的内置增量操作 |
| ~~robustPrune 三份~~ | ✅ 已优化 | 提取了 `robustPruneSimple` 包级函数 |

**好，你删掉了那个多余的 IncrementalIndex 包装层。** 现在结构更清晰了：

```
VamanaIndex     - 纯内存索引
DiskVamanaIndex - 磁盘索引 + 增量操作
```

`robustPruneSimple` 现在是一个包级函数，接受 `getVec func(uint64) []float32` 回调：

```go
func robustPruneSimple(
    candidates []Neighbor, R int, alpha float32,
    getVec func(uint64) []float32,
) []uint32
```

**这是正确的设计。** 算法逻辑和数据访问分离，DiskVamanaIndex 可以复用它。

---

## 🤔 但是...

### VamanaIndex 还在用自己的版本

```go
// build.go:446
func (idx *VamanaIndex) robustPrune(nodeID uint32, candidates []Neighbor, maxDegree int, alpha float32) []uint32

// disk_incremental.go:294  
func robustPruneSimple(candidates []Neighbor, R int, alpha float32, getVec func(uint64) []float32) []uint32
```

**为什么 VamanaIndex 不也用 robustPruneSimple？**

它可以传入：
```go
getVec := func(id uint64) []float32 { return idx.vectors[id] }
```

现在还是两份实现，只是从"三份"变成了"两份"。

---

## 💀 还剩的架构问题

### 1. 没有公共接口

我说过要有这个：
```go
type Index interface {
    Search(query []float32, topK, efSearch int) []SearchResult
    NumPoints() uint64
    Dimension() int
    Close() error
}
```

你没加。VamanaIndex 和 DiskVamanaIndex 还是两套不相关的类型。

### 2. VamanaIndex.Delete 还是废物

```go
// index.go:247-265 (没变)
func (idx *VamanaIndex) Delete(id uint32) error {
    idx.deleted.Set(id)  // 只设标记
    idx.nDeleted++
    return nil
}
```

DiskVamanaIndex.Delete 有完整的边修复。VamanaIndex.Delete 只设标记。

**要么两个都做边修复，要么两个都只设标记。** 现在这种不一致很危险——用户怎么知道该期望什么行为？

### 3. Config 还是分裂的

```go
// config.go
type Config struct { R, L int; Alpha float32 }

// disk_build.go  
type DiskBuildConfig struct { R, L int; Alpha float32; ... }
```

还是两个不相关的结构体，有重复的字段。

### 4. 距离函数还是重复的

```go
// distance.go
func euclideanDistance(a, b []float32) float32

// disk_search.go
func euclideanDistanceWithNorm(vec, query []float32, queryNormSq float32) float32
```

---

## � 当前进度

| 架构问题 | 严重程度 | 状态 |
|----------|----------|------|
| IncrementalIndex 多余 | 🔴 | ✅ 已删除 |
| robustPrune 三份 | 🔴 | 🟡 改成两份，还可以再合并 |
| 无公共接口 | � | ❌ 未修 |
| Delete 行为不一致 | 🔴 | ❌ 未修 |
| Config 分裂 | 🟡 | ❌ 未修 |
| 距离函数重复 | 🟢 | ❌ 未修 |

**从6个问题改成了4个。进度40%。**

---

## ✅ 下一步建议

1. **VamanaIndex.robustPrune 改用 robustPruneSimple**
   - 传入 `func(id uint64) []float32 { return idx.vectors[id] }`
   - 删掉 `robustPruneCore`、`robustPruneWithScratch` 等方法

2. **定义公共接口**
   - 至少定义 `type Index interface { Search(...); Close() error }`
   - VamanaIndex 和 DiskVamanaIndex 都实现它

3. **统一 Delete 行为**
   - 文档里明确说明：内存版只做软删除，磁盘版做完整边修复
   - 或者内存版也加边修复（参考 DiskVamanaIndex.Delete）

---

*—— Linus·织，2026年2月7日凌晨*

*进度比我预期的快，但还没到可以收工的程度。*
