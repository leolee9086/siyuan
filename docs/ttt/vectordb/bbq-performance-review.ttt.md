# BBQ 性能审阅处理

> **创建时间**: 2026-02-08
> **任务类型**: 子任务|性能优化
> **审阅文件**: `kernel/vectordb/bbq/performance.review.md`
> **涉及文件**: `kernel/vectordb/bbq/bitops.go`, `kernel/vectordb/bbq/quantizer.go`

## 任务目标

处理 BBQ 模块的性能审阅意见，逐条分析并决定接受/拒绝，修改代码并确保测试覆盖。

## 审阅意见摘要

1. **逐字节 POPCNT**: `ComputePackedDotProduct` 使用 8 位逐字节处理，应改为 64 位批量处理
2. **BytesToUint64 内存分配**: 转换时每次都 `make` 新切片，热路径上不可接受
3. **Quantize 中 workVec 分配**: 每次调用都分配 `workVec`，批量插入时 GC 压力大

## 进度

- [x] 阅读源代码和审阅意见
- [ ] 编写现有功能的测试（bbq 包无测试文件）
- [ ] 分析并决定每条意见的接受/拒绝
- [ ] 实现代码修改
- [ ] 回归测试验证
- [ ] 写入审阅结论
