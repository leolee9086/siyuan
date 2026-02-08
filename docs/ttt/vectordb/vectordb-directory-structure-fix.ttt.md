# VectorDB 目录结构重构执行跟踪 (TikTocTak)

> **目标**: 解决 `kernel/vectordb/` 模块存在的三个结构性问题，提升代码组织性和可维护性
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 核心原则

- **DRY**: 避免重复代码，常量统一管理
- **一致性**: API 签名保持一致
- **可维护性**: 文件按功能模块化组织
- **零回归**: 所有修改必须通过现有测试

### 验证检查清单

- [x] 重构后所有单元测试通过
- [x] 重构后集成测试通过
- [x] 无循环依赖引入
- [x] 公共 API 向后兼容（或明确标记为破坏性变更）

---

## 🟢 近期计划 (立即聚焦，撸起袖子干)

所有计划任务已完成，已归档至下方。

---

## 🟡 中期计划 (架构演进，步步为营)

所有计划任务已完成，已归档至下方。

---

## 🔴 远期计划 (北极星目标，星辰大海)

暂无

---

## 🏁 已归档/已完成

### Phase 1: HNSW 文件迁移到 hnsw/ 子目录 — ✅ 完成 (2026-02-07)

- [x] **HNSW 文件迁移到 `kernel/vectordb/hnsw/` 子目录**
  - 创建了 `kernel/vectordb/hnsw/` 子包（types.go, build.go, query.go, delete.go, utils.go）
  - 独立的 `HNSWIndex` 类型，通过 `Distancer` 接口解耦
  - 27 个单元测试全部通过
  - 在 vectordb 包创建了 `hnsw_proxy.go` 代理层，外部 API 零变更
  - 旧文件 hnsw_build.go, hnsw_delete.go, hnsw_query.go, hnsw_utils.go 已删除
  - 设计文档：[`kernel/vectordb/hnsw-migration-design.md`](../../kernel/vectordb/hnsw-migration-design.md)

### Phase 2: Vamana 常量统一 — ✅ 完成 (2026-02-07)

- [x] **Vamana 常量统一归集到 constants.go**
  - 创建了 [`kernel/vectordb/vamana/constants.go`](../../kernel/vectordb/vamana/constants.go)
  - 从 6 个源文件归集了 20 个常量
  - 按主题分组：Graph Structure、Default Build Parameters、Disk I/O、File Format、Incremental Operation、Search

### Phase 3: API 统一 — ✅ 完成 (2026-02-07)

- [x] **统一 VamanaIndex 与 DiskVamanaIndex 的 API 签名**
  - `VamanaIndex.NumPointsTotal()` 返回类型从 `int` 统一为 `uint64`
  - `Delete()` 行为差异经分析确认两者都已实现完整的边修复算法，无需修改
  - `Index` 和 `MutableIndex` 接口已存在于 types.go 中

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 📎 适用规程

- **主规程**: [`docs/规程/代码质量/Go后端代码重构.procedure.md`](../../规程/代码质量/Go后端代码重构.procedure.md)
- **TTT编写**: [`docs/规程/tiktoctac文档编写规程.procedure.md`](../../规程/tiktoctac文档编写规程.procedure.md)

---

**文档创建**: 2026-02-07
**最后更新**: 2026-02-07
**状态**: 🟢 全部完成
