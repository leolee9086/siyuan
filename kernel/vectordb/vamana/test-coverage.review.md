# Vamana 测试覆盖改进建议

> 基于 DiskANN (Rust) 和 IP-DiskANN (C++) 测试组织调研
> 审阅时间: 2026-02-07

---

## 🔴 P0: 测试指标过低

### 召回率阈值问题

| 测试 | 当前值 | 行业标准 |
|------|--------|----------|
| disk_streaming_test.go | 30% | ≥90% |
| disk_incremental_test.go | 40-50% | ≥85% |
| disk_checkpoint_test.go | 35-45% | ≥85% |

### 数据规模问题

| 测试 | 当前规模 | 推荐规模 |
|------|----------|----------|
| streaming | 1000 | 10K-100K |
| incremental | 10K | 100K-1M |

### 改进建议

```go
const (
    minRecallRegular   = 0.90
    minRecallIncr      = 0.85
    minRecallStreaming = 0.80
    efSearchForRecall90 = 500
)
```

---

## 🟡 P1: 并发测试效率

### 问题

每个测试独立构建索引，3个测试 = 3次构建 = 2-3分钟

### 建议

使用 `TestMain` 预构建共享索引，或降低测试规模到 500 点用于快速验证。

---

## 🟢 P2: 待补充的测试场景

| 场景 | 参考 | 状态 |
|------|------|------|
| 流式场景(滑动窗口) | IP-DiskANN test_streaming_scenario.cpp | ✅ 已添加 |
| 并发操作 | IP-DiskANN test_insert_deletes_consolidate.cpp | ✅ 已添加 |
| 错误路径 | - | ✅ 已添加 |
| Checkpoint恢复 | - | ✅ 已添加 |
