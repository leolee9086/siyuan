# Vamana 测试覆盖改进

## 任务概述

基于 `kernel/vectordb/vamana/test-coverage.review.md` 审阅意见，对 vamana 模块进行 5 项测试覆盖改进。

## 任务清单

- [ ] P0: 流式场景测试 — 新建 `disk_streaming_test.go`，测试滑动窗口式插入+删除+compact循环
- [ ] P0: 并发操作测试 — 新建 `disk_concurrent_test.go`，测试并发insert/delete/search
- [ ] P1: 测试诊断能力 — 在 `disk_incremental_helpers_test.go` 中添加VerboseCompare辅助函数
- [ ] P1: Checkpoint恢复验证 — 新建 `disk_checkpoint_test.go`，测试中间状态save/load可恢复性
- [ ] P2: 错误路径测试 — 新建 `disk_error_path_test.go`，系统性覆盖错误路径

## 适用规程

- `docs/规程/测试与修复/后端Go测试编写.procedure.md`

## 参考文档

- `kernel/vectordb/vamana/test-coverage.review.md`
