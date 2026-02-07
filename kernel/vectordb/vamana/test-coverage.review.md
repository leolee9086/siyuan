# 测试覆盖改进建议

基于 DiskANN (Rust) 和 IP-DiskANN (C++) 测试组织的调研，提出以下改进建议。

## 🔴 P0: 流式场景测试

**问题**: 缺少滑动窗口式更新的测试

**参考**: [IP-DiskANN/apps/test_streaming_scenario.cpp](file:///d:/dev/siyuan-note/toread/IP-DiskANN/apps/test_streaming_scenario.cpp#L183-L329)

核心逻辑：
- 维护一个 `active_window` 的点
- 每轮插入 N 个新点，删除 N 个最老的点
- 定期执行 `consolidate_deletes()`

---

## 🔴 P0: 并发操作测试

**问题**: 当前 `disk_incremental_test.go` 都是串行操作

**参考**: [IP-DiskANN/apps/test_insert_deletes_consolidate.cpp#L259-L309](file:///d:/dev/siyuan-note/toread/IP-DiskANN/apps/test_insert_deletes_consolidate.cpp#L259-L309)

关键点：
- 使用 `std::async` 并发执行 insert 和 delete
- 一个线程持续插入，另一个线程执行删除+合并

---

## 🟡 P1: 测试诊断能力

**问题**: Go 的 `t.Errorf` 在大规模向量比较时不够友好

**参考**: [DiskANN/diskann/src/test/cmp.rs](file:///d:/dev/siyuan-note/toread/DiskANN/diskann/src/test/cmp.rs#L26-L105)

`VerboseEq` trait 特点：
- 递归比较嵌套结构
- 用 `.context()` 记录错误路径
- 只报告第一个不匹配点的完整路径

---

## 🟡 P1: Checkpoint 恢复验证

**问题**: 只验证最终结果，不验证中间状态

**参考**: [test_insert_deletes_consolidate.cpp#L336-L361](file:///d:/dev/siyuan-note/toread/IP-DiskANN/apps/test_insert_deletes_consolidate.cpp#L336-L361)

每隔 `checkpoints_per_snapshot` 执行一次 `index->save()`，验证可恢复性。

---

## 🟢 P2: 错误路径测试

**现状**: `disk_index_test.go` 有部分错误路径测试

**建议**: 系统性覆盖：
- 损坏的 Header
- 损坏的 BBQ 文件
- 对已关闭索引的操作
- 维度不匹配
- 删除不存在的节点

---

# 🔴🔴 P0: 测试指标不合理问题

## 问题汇总

对照 [ANN-benchmarks](https://github.com/erikbern/ann-benchmarks) 和行业标准，当前测试存在"为了通过而通过"的问题：

| 测试文件 | 当前指标 | 行业标准 | 差距 |
|----------|----------|----------|------|
| [disk_streaming_test.go:55](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_streaming_test.go#L55) | `streamMinRecall = 0.30` | ≥0.90 | **60%** |
| [disk_incremental_test.go:94](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_incremental_test.go#L94) | `recall ≥ 0.50` | ≥0.90 | **40%** |
| [disk_incremental_test.go:174](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_incremental_test.go#L174) | `recall ≥ 0.40` | ≥0.85 | **45%** |
| [disk_checkpoint_test.go](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_checkpoint_test.go) | recall ≥ 0.35~0.45 | ≥0.85 | **40-50%** |
| [vamana_test.go:173](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/vamana_test.go#L173) | `avgRecall < 0.7` | ≥0.90 | **20%** |

## 数据规模问题

| 测试 | 当前规模 | 推荐规模 | 问题 |
|------|----------|----------|------|
| [disk_streaming_test.go:31-32](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_streaming_test.go#L31-L32) | 1000 base + 1000 window | **10K~100K** | 规模太小无法体现真实负载 |
| [disk_incremental_helpers_test.go:36](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_incremental_helpers_test.go#L36) | `testIncrNumBase = 10000` | **100K~1M** | SIFT1M 是标准 |
| [disk_index_e2e_test.go:40](file:///d:/dev/siyuan-note/kernel/vectordb/vamana/disk_index_e2e_test.go#L40) | 10K (SIFT10K) | **100K~1M** | 10K 太小 |

## 搜索参数问题

| 参数 | 当前值 | 推荐值 | 影响 |
|------|--------|--------|------|
| `efSearch` | 200 | **500~1000** | 过低导致召回不足 |
| `numQueries` | 30~50 | **100~1000** | 样本太少统计不稳定 |

---

## 改进建议

### 1. 调整召回率阈值

```go
// ❌ 当前：为了通过而通过
streamMinRecall = 0.30
assertMinRecall(t, "recall", recall, 0.50)

// ✅ 改进：参考行业标准
const (
    minRecallRegular   = 0.90  // 常规测试
    minRecallIncr      = 0.85  // 增量操作后
    minRecallStreaming = 0.80  // 流式场景(有删除)
)
```

### 2. 提升数据规模

```go
// ❌ 当前
streamBaseSize   = 1000
streamWindowSize = 1000
testIncrNumBase  = 10000

// ✅ 改进：分级测试
const (
    // 快速测试 (CI)
    quickBaseSize = 10000
    
    // 标准测试
    standardBaseSize = 100000
    
    // 完整测试 (Nightly)
    fullBaseSize = 1000000  // SIFT1M
)
```

### 3. 增加 efSearch

```go
// ❌ 当前
streamEfSearch = 200

// ✅ 改进：与召回率目标匹配
const (
    efSearchForRecall90  = 500
    efSearchForRecall95  = 1000
    efSearchForRecall99  = 2000
)
```

### 4. 增加查询样本数

```go
// ❌ 当前
streamNumQueries = 30

// ✅ 改进
const (
    quickQueries    = 100
    standardQueries = 1000  // 使用 SIFT1M 的 10K queries
)
```

---

## 参考: ANN-Benchmarks 标准

| 数据集 | 规模 | 维度 | 常见目标 |
|--------|------|------|----------|
| SIFT1M | 1M | 128 | Recall@10 ≥ 0.90 @ QPS > 1000 |
| GIST1M | 1M | 960 | Recall@10 ≥ 0.90 @ QPS > 100 |
| GloVe-100 | 1.2M | 100 | Recall@10 ≥ 0.90 |

> [!CAUTION]
> 当前 30%~50% 的召回率阈值在生产环境中**完全不可接受**。如果用户搜索相似内容，有50%以上的概率找不到真正相关的结果。

