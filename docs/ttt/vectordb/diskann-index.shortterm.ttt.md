# Vamana 磁盘索引接入 Collection 体系执行跟踪 (TikTocTak)

> **目标**: 在不破坏现有 `/api/vector` 与 embedding 使用方式的前提下，支持后端按集合选择 `hnsw` / `vamana_disk` 两种索引类型，实现创建、插入、查询、删除、重建、持久化、重启加载全链路可用。量化指标：1) 现有 HNSW 集合 0 回归；2) Vamana 集合 CRUD+Search E2E 通过率 100%；3) 历史快照兼容率 100%。
>
> **范围说明**: 本文中的 `Vamana` 指 `kernel/vectordb/vamana` 的磁盘索引实现（`DiskVamanaIndex`）。
>
> **父计划**: [`后端向量数据库超大规模数据支持计划.ttt.md`](../后端向量数据库超大规模数据支持计划.ttt.md)
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 项目背景

### 当前阻塞点 (2026-03-17 核查)

1. `Collection` 结构与核心方法固定绑定 `HNSWIdx`，无索引类型抽象。
2. `CreateCollection` 接口无 `index_type` 参数，无法选择 Vamana。
3. 持久化 `SnapshotData` 仅序列化 HNSW 图结构，无 Vamana 分支。
4. `embedding` 模块通过 `Collection.InsertPoint/Search` 间接固定走 HNSW。
5. `vamana.Open()` 依赖 `SetOpenDiskIndexReader`，主流程未做生产初始化接线。

### 第一阶段范围边界

1. 仅支持**新建集合**时选择索引类型，不做已有集合在线迁移。
2. 默认索引保持 HNSW，不改变历史行为。
3. 优先打通 CRUD + Search + Rebuild + Persistence 主链路，性能优化放中期。

---

## 🎯 核心原则

1. **默认兼容**: 未显式指定索引类型时必须与现有行为完全一致（HNSW）。
2. **双引擎并存**: `Collection` 层统一 API，不把上层业务暴露给引擎细节。
3. **向后兼容持久化**: 老快照可读，新快照可区分引擎类型。
4. **可回滚**: Vamana 接线失败可降级到 HNSW 路径，避免系统不可用。
5. **观测先行**: 接线后需具备最小可观测日志与错误定位信息。

### 验证检查清单

- [ ] 新建集合支持 `index_type=vamana_disk`
- [ ] 未指定 `index_type` 时默认 `hnsw`
- [ ] `Collection.InsertPoint/Search/Delete/Rebuild` 在两种引擎下均可用
- [ ] `SaveCollection/LoadCollection` 支持区分并恢复两种引擎
- [ ] 历史 HNSW 快照可无损加载
- [ ] embedding blocks/assets 写入与查询在 Vamana 集合下可用
- [ ] 应用启动时 Vamana 磁盘读取器工厂已完成初始化
- [ ] 回归测试覆盖 HNSW 与 Vamana 双路径
- [ ] `vectorState` 等状态接口可返回索引类型
- [ ] 失败路径（索引文件缺失/损坏/类型不匹配）错误信息可诊断

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

- [ ] **Task 1: Collection 引擎抽象与双实现接线 (P0)**
  - **背景**: 当前 `Collection` 与 `HNSWIdx` 强耦合，Vamana 无法接入统一 API。
  - **行动**:
    1. 抽象 Collection 内部索引能力边界（Insert/Search/Delete/Rebuild/State）。
    2. 为 HNSW 保持现状实现，新增 Vamana 磁盘实现适配。
    3. 确保 `InsertPoint/Search/DeleteItemWithIndex/RebuildIndex` 路由到正确引擎。
  - **验收标准**:
    - 双引擎均可通过集合核心行为测试。
    - 现有 HNSW 用例无行为变化。
  - **参考文档**:
    - `kernel/vectordb/types.go`
    - `kernel/vectordb/hnsw_proxy.go`
    - `kernel/vectordb/vamana/disk_index.go`

- [ ] **Task 2: 持久化协议扩展与启动加载接线 (P0)**
  - **背景**: 目前快照仅包含 HNSW 图，无法保存/恢复 Vamana 集合。
  - **行动**:
    1. 扩展快照元信息，记录索引类型与对应持久化位置。
    2. 增加 Vamana 集合保存/加载分支。
    3. 在初始化阶段完成 `SetOpenDiskIndexReader` 生产接线。
  - **验收标准**:
    - 新旧快照都可加载。
    - Vamana 索引重启后可搜索。
  - **参考文档**:
    - `kernel/vectordb/persistence.go`
    - `kernel/vectordb/storage/io.go`
    - `kernel/vectordb/vamana/disk_index.go`

- [ ] **Task 3: API 契约扩展与兼容策略 (P1)**
  - **背景**: `/api/vector` 创建集合无索引类型入口，状态接口也无类型反馈。
  - **行动**:
    1. 扩展创建集合参数支持 `index_type`（可选）。
    2. 保持默认值回退到 HNSW。
    3. 在状态查询中返回集合索引类型。
  - **验收标准**:
    - 老请求体无改动即可工作。
    - 新请求体可创建 Vamana 集合。
  - **参考文档**:
    - `kernel/vectordb/api.go`
    - `kernel/api/vector.go`

- [ ] **Task 4: Embedding 链路接入验证 (P1)**
  - **背景**: embedding 走 `Collection` 抽象，需验证在 Vamana 集合下全流程可用。
  - **行动**:
    1. 盘点 blocks/assets 相关路径创建集合时的索引选择策略。
    2. 验证 push/query/delete 的 Vamana 行为一致性。
    3. 明确默认策略（先保持 HNSW 或灰度切换）。
  - **验收标准**:
    - embedding 关键接口在 Vamana 集合下可用且无崩溃。
    - 默认策略有文档说明。
  - **参考文档**:
    - `kernel/embedding/embedding.go`
    - `kernel/api/embedding.go`

- [ ] **Task 5: 双路径测试与错误路径补强 (P1)**
  - **背景**: 接线工作跨模块，缺少系统级回归会导致隐性回退。
  - **行动**:
    1. 增加 HNSW/Vamana 双路径核心集成测试。
    2. 增加快照兼容、文件损坏、读取器未配置等错误路径测试。
    3. 补充关键日志点，便于定位引擎路由错误。
  - **验收标准**:
    - 新增测试稳定通过。
    - 错误路径可定位到具体文件/阶段。
  - **参考文档**:
    - `kernel/vectordb/*_test.go`
    - `kernel/vectordb/vamana/disk_error_path_test.go`

---

## 🟡 中期计划

- [ ] **Task M1: Vamana 路径性能基线与参数收敛 (P1)**
  - **背景**: 功能打通后需验证 `efSearch/R/L` 等参数在真实数据下的效果。
  - **行动**: 建立对比基线（HNSW vs Vamana），输出推荐参数表。

- [ ] **Task M2: 集合级迁移工具设计 (P2)**
  - **背景**: 现阶段不支持在线切换，后续需提供离线迁移能力。
  - **行动**: 设计 HNSW 集合导出 -> Vamana 重建 -> 原子替换流程。

- [ ] **Task M3: 运维可观测性增强 (P2)**
  - **背景**: 生产环境需要快速判断集合当前引擎与索引健康状态。
  - **行动**: 增加索引类型、文件状态、构建版本、最后 compact 时间等信息暴露。

---

## 🔴 远期计划

- [ ] **Task L1: 混合检索策略 (P2)**
  - **愿景**: 根据数据规模与更新频率，自动选择 HNSW 或 Vamana。

- [ ] **Task L2: 多副本/分层缓存探索 (P2)**
  - **愿景**: 进一步降低磁盘随机读抖动，提高大规模场景稳定性。

---

## ⚠️ 风险与回滚

### 关键风险

1. **快照兼容风险**: 协议改造可能影响历史数据加载。
2. **接口回归风险**: Collection 抽象改造会触及 embedding/vector 全链路。
3. **初始化风险**: 平台读取器未正确注册会导致 Vamana 无法打开。

### 回滚策略

1. 默认索引保持 HNSW，不切换已有集合。
2. 新增字段均采用可选 + 默认值策略，保证旧请求兼容。
3. 出现故障时可临时禁用 Vamana 创建入口，回退至 HNSW。

---

## 🏁 已归档/已完成

- [x] **立项: Vamana 磁盘索引接入 TTT 创建** [已完成 2026-03-17]
  - **背景**: 当前 Vamana 磁盘实现已存在，但尚未接入生产 `Collection`/API 主链路。
  - **完成情况**: 完成接入目标、阶段任务、风险与验收标准定义。
  - **成果文件**:
    - `docs/ttt/vectordb/diskann-index.shortterm.ttt.md`

---

## 📚 参考文档

- `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
- `docs/ttt/后端向量数据库超大规模数据支持计划.ttt.md`
- `docs/ttt/vectordb/向量数据库生产就绪核查.ttt.md`
- `kernel/vectordb/types.go`
- `kernel/vectordb/hnsw_proxy.go`
- `kernel/vectordb/persistence.go`
- `kernel/vectordb/vamana/disk_index.go`
- `kernel/vectordb/vamana/disk_build.go`
- `kernel/embedding/embedding.go`

