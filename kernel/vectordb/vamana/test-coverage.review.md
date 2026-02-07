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
