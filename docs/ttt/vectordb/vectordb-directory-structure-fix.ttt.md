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

- [ ] 重构后所有单元测试通过
- [ ] 重构后集成测试通过
- [ ] 无循环依赖引入
- [ ] 公共 API 向后兼容（或明确标记为破坏性变更）

---

## 🟢 近期计划 (立即聚焦，撸起袖子干)

### Phase 1: HNSW 文件迁移到子目录 (P0)

- [ ] **HNSW 文件迁移到 `kernel/vectordb/hnsw/` 子目录**
  - **背景**: 8个 hnsw_*.go 文件散落在 `kernel/vectordb/` 根目录，与其他算法（bbq、vamana）的子目录组织方式不一致
  - **行动**:
    1. 创建 `kernel/vectordb/hnsw/` 目录
    2. 移动以下文件到新目录：
       - `hnsw_build.go`
       - `hnsw_delete.go`
       - `hnsw_query.go`
       - `hnsw_utils.go`
       - `hnsw_*_test.go` (相关测试文件)
    3. 更新包名声明为 `package hnsw`
    4. 修复所有 import 路径引用
  - **验收标准**:
    - [ ] 所有 hnsw 文件位于 `hnsw/` 子目录
    - [ ] `go build ./kernel/...` 编译成功
    - [ ] `go test ./kernel/vectordb/hnsw/...` 全部通过
  - **参考文档**: [`kernel/vectordb/directory-structure.review.md`](../../kernel/vectordb/directory-structure.review.md)

### Phase 2: Vamana 常量归集 (P0)

- [ ] **Vamana 常量统一归集到 constants.go**
  - **背景**: 常量分散在 config.go、disk_index.go、disk_incremental.go、disk_build.go 等6个文件中，难以维护和查找
  - **行动**:
    1. 分析各文件中分散的常量定义
    2. 创建 `kernel/vectordb/vamana/constants.go`
    3. 按类别整理常量（构建参数、搜索参数、文件格式等）
    4. 将分散的常量迁移到新文件
    5. 在原文件中保留必要的导出别名（确保向后兼容）
  - **验收标准**:
    - [ ] 所有 vamana 相关常量定义在 `constants.go`
    - [ ] 原文件中的常量引用正确指向新位置
    - [ ] `go test ./kernel/vectordb/vamana/...` 全部通过
  - **参考文档**: [`kernel/vectordb/directory-structure.review.md`](../../kernel/vectordb/directory-structure.review.md)

---

## 🟡 中期计划 (架构演进，步步为营)

### Phase 3: VamanaIndex 与 DiskVamanaIndex API 一致性修复 (P1)

- [ ] **统一 VamanaIndex 与 DiskVamanaIndex 的 API 签名**
  - **背景**: 
    - `NumPointsTotal()` 返回类型不一致（int vs uint64）
    - `Delete()` 行为不一致（只设标记 vs 完整边修复）
  - **行动**:
    1. 定义统一的 `Index` 接口（如适用）
    2. 统一 `NumPointsTotal()` 返回类型为 `uint64`
    3. 评估并统一 `Delete()` 行为
    4. 更新所有调用方代码
  - **验收标准**:
    - [ ] 两个类型的 `NumPointsTotal()` 返回类型一致
    - [ ] `Delete()` 行为一致或有明确的文档说明差异原因
    - [ ] 所有测试通过
  - **参考文档**: [`kernel/vectordb/directory-structure.review.md`](../../kernel/vectordb/directory-structure.review.md)

---

## 🔴 远期计划 (北极星目标，星辰大海)

暂无

---

## 🏁 已归档/已完成

暂无

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
**状态**: 🟡 待开始
