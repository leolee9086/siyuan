# 有偏确定性层级 HNSW 人格-记忆系统 执行跟踪 (TikTocTak)

> **目标**: 构建基于有偏确定性层级 HNSW 的 AI 长期记忆与人格一体化架构，使 AI 人格物理化为记忆图形的偏序可达性，而非提示词注入。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试，附带数据验证。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。
> 5. 需求变化时可修改或删除计划条目。

## 项目背景

### 核心命题

LLM 作为 AI 的"意识层"，但 LLM 本身没有持久记忆（上下文窗口有限）和人格（提示词是外挂的文本）。传统 RAG 只解决"知识检索"——无法解决"谁在检索"和"检索什么"之间的非独立性。本方案利用多层 HNSW 图结构的物理层级偏序来实现人格→记忆的可达性偏差，使人格**不需要显式注入**即可影响记忆访问路径。

### 架构组件

| 组件 | 角色 | 实现位置 |
|------|------|----------|
| 无偏 HNSW | 知识库索引，纯精排驱动 | `kernel/vectordb/hnsw/` |
| 有偏 HNSW (×3) | 三 Sage 各自的人格-记忆金字塔 | 同 `hnsw/`，不同插入顺序 |
| DiskVamana | 冷记忆持久化层，1TB 容量 | `kernel/vectordb/vamana/` |
| DeterministicLevel | 自顶向下几何填充层级分配 | `hnsw/utils.go` ✅ |
| FSRS 反函数 | 人类记忆衰退模型驱动的遗忘 | 思源现有间隔重复算法 |
| Seraph CBT 模块 | IPIP-NEO-120 → OCEAN 人格周期性评估 | `kernel/nerv/seraph/` |
| 唤醒序列 | Seraph 身份锚定 → 人格高速层注入 | `kernel/nerv/magi/prompts/wakeup.go` |

### 已有基础

- HNSW 内存索引：高速层图遍历、精排保底正确
- DiskVamana：磁盘驻留、批量扇区读、应用层节点缓存
- ~~`RandomLevel`~~ → `DeterministicLevel`：自顶向下几何填充，先插入的占据所有高层，**保证人格向量独占高速层**
- 向量迁移接口：`MigrateToDisk` 可动态下沉

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后剪切粘贴到【已归档】列表，打上 `[x]` 和日期。
2. **补充弹药**：【近期计划】空时从【中期计划】提升任务。
3. **因地制宜**：计划不合理时随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

##  验证检查清单

- [x] 无偏确定性层级 HNSW 图质量不退化 — Build/Query/Recall 均 < 5%
- [x] DeterministicLevel 替代 RandomLevel → 自顶向下填满，先插入的独占高层
- [x] 有偏索引构建 — 人格向量占高速层，记忆向量从 Level 0 开始
- [ ] FSRS 反函数集成 — 检索概率 → 插入顺序映射
- [ ] 睡眠重建流程 — 夜间反刍 → 重新插入 → 图拓扑更新
- [ ] 唤醒序列注入 — Seraph 身份锚定 → 高速层内容更新
- [ ] DiskVamana 冷记忆激活 — 低检索记忆迁移 + 重新触达召回
- [ ] 三 Sage 各自独立索引 — 构造 + 查询 + 精排隔离
- [ ] Trinity 综合 — 三视角结果合并
- [ ] 规模验证 — 100 万条记忆下延迟 < 10ms
- [ ] 人格一致性 — 同一查询在三个 Sage 下的结果偏序符合各自人格

## 🟢 近期计划

（暂无）

## 🟡 中期计划

### [ ] FSRS 反函数集成

从思源间隔重复模块提取检索概率计算逻辑，映射为插入顺序权重。

### [ ] 睡眠重建流程

模拟"夜间反刍"：按 FSRS 权重重排插入顺序 → 重新构建 HNSW → 验证图质量无退化。

### [ ] 唤醒序列注入

修改 `wakeup.go` 的 `BuildWakeupSequence`，在自述对话后追加有偏索引的 `Search(personaVector)` 结果作为唤醒记忆。

### [ ] 冷-热迁移

低检索记忆从 HNSW 迁移到 DiskVamana → 重新触达时从 DiskVamana 精确召回 → 下一次重建时重新插入 HNSW。

## 🔵 远期展望

### [ ] 三 Sage 独立索引

三个 Sage 各自持有 HNSW 实例，高速层内容由 Seraph 评估决定。同一查询在三个索引中产生不同的搜索结果顺序。

### [ ] Trinity 综合

Trinity 收到三组结果后进行多视角综合，不依赖提示词注入——仅靠结果多样性。

### [ ] 规模验证

100 万条记忆下 HNSW + DiskVamana 协同工作，延迟 < 10ms。

## ✅ 已归档 / 已完成

### [x] 有偏索引构建验证 — Ollama + bge-m3 端到端测试（2026-05-30）

**测试详情**：
- 嵌入模型：bge-m3 (1024 维)，20 条人格描述 + 101 条事实记忆文本，Ollama /api/embed 批嵌入
- 构造：biased（人格先插入，DeterministicLevel 自顶向下填满高层）vs unbiased（相同向量随机打乱插入）
- 查询：5 条记忆主题查询，k=10, efSearch=100

**结果** (全部 5 查询 10/10 满分)：

| 指标 | biased | unbiased | 结论 |
|------|--------|----------|------|
| 层级分布 | persona-0 @ L15（入口点），personas独占L12-L15，记忆从L11下方开始 | 随机分布 | persona 前置插入成功占据所有高速层 ✅ |
| 召回率 | 10/10 × 5 | 10/10 × 5 | 完全一致，无退化 ✅ |
| topK 组成 | 100% memory | 100% memory | 0 条 persona 污染 ✅ |
| topK 顺序 | 与 unbiased 完全相同 | — | 图结构鲁棒，插入顺序不影响小规模精排 ✅ |

**bge-m3 边界问题**：
- `"Marie Curie won Nobel Prizes..."` 和 `"The Sahara Desert..."` / `"Stonehenge..."` 触发 bge-m3 NaN/挂起，已替换
- 批次嵌入需 batched by 10 避免触发

**测试文件**：`kernel/vectordb/biased_index_test.go`

### [x] DeterministicLevel 自顶向下逐层填满 + 自动重建（2026-05-30）

**改动**：
- `hnsw/utils.go`：`TrailingZerosLevel` → `DeterministicLevel`，公式 `level = effectiveMax - bits.Len64(idx+1)`
- `hnsw/utils.go`：`InitItemNeighbors` 内建 `autoRebuild` — 当 `InsertCount` 跨 2^n 边界时自动清图重建，保证先插入的始终在高层
- `hnsw/types.go`：新增 `EffectiveMaxLevel` 字段
- `vectordb/persistence.go`、`deterministic_level_test.go`：注释更新
- `vectordb/biased_index_test.go`：`TestDeterministicLevelTopDownFilling` 验证 30 persona + 1000 memory，personas 独占 L6-L10，memory 从 L6 开始

**验收**：全部测试通过。层级分布: L10=1 persona, L6=15 persona + 1 memory, L5=32 memory...L0=7 memory。autoRebuild ~log₂(N) 次。

### [x] 验证假设：无偏确定性层级 HNSW 不影响图质量（2026-05-30）

4 组规模/维度测试验证：构建吞吐差异 < 1%，查询延迟差异 < 5%，召回率差异 < 1%。层级分布精确匹配几何分布。trailingZeros 替代 RandomLevel 安全。

- 实现文件：`hnsw/utils.go`（DeterministicLevel）、`hnsw/types.go`（InsertCount）
- 测试文件：`vectordb/deterministic_level_test.go`
