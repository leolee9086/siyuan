# VectorDB独立包化与SOTA实现执行跟踪 (TikTocTak)

> **目标**: 在继续放置于`s-forge`仓库内的前提下，先将`vectordb`从SiYuan内核业务依赖中剥离为独立Go包，并通过性能、正确性、并发安全、持久化可靠性、API质量五类门禁；达到SOTA级别后，才允许启动基于独立向量数据集的语义搜索迁移。
>
> **总体判定**: 🟡进行中：`packages/vectordb`独立模块、统一根包接口、DiskVamana主引擎暴露、默认全包测试、快速门禁、核心race门禁和关键10K规模门禁已验证通过；公共API冻结、100K/1M Pareto基准、崩溃恢复、格式版本化、全量规模race和持续基准门禁仍未完成；因此后续语义搜索迁移仍不得启动。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。

---

## 🎯 核心原则

### 第一性排序

- **先独立包化，再业务迁移**: `vectordb`本身的拆离、SOTA级实现、稳定门禁和可维护API是第一步；`kernel/model/embedding.go`的SQLite语义搜索迁移只能在这些门禁通过后进入近期计划。
- **仓库内独立，不急于外迁**: 独立包暂时仍放在`s-forge`仓库中，但必须具备独立`go test`、独立依赖边界、独立文档、独立基准和可迁出目录结构。
- **算法库不依赖宿主业务**: 独立包不得依赖`kernel/model`、`kernel/sql`、`kernel/util`、Gin路由、SiYuan配置、工作空间路径、业务日志单例或Embedding集合命名规则。
- **宿主适配层反向依赖库**: SiYuan内核只能通过薄适配层调用独立包，适配层负责路径、权限、HTTP、业务元数据、集合命名和旧API兼容。
- **SOTA**: 任何声称完成的阶段必须给出可复现的召回率、延迟、吞吐、内存、磁盘、并发、崩溃恢复和代码质量数据。

### SOTA验收基线

| 维度 | 最低门禁 | 目标门禁 |
|---|---:|---:|
| HNSW内存索引Recall@10 | searchL=topK时≥95% | searchL=2×topK时≥99% |
| DiskVamana/BBQ Recall@10 | searchL=10×topK时≥90% | 同参数下量化损失≤10个百分点 |
| 增量Insert/Delete后Recall@10 | ≥80% | ≥90%，且可通过修复或Compact恢复 |
| 查询延迟 | 100K规模P95有记录且无明显退化 | 100K/1M规模P50/P95/P99形成Pareto曲线 |
| 插入吞吐 | 有稳定基线，不能低于既有实现 | 批量构建和增量插入均有可解释瓶颈模型 |
| 并发安全 | `go test -race`核心包通过 | Search与Insert/Delete并发压力测试无数据竞争、无死锁 |
| 持久化可靠性 | 快照、WAL或磁盘原生格式可恢复 | 崩溃注入、半写文件、版本升级路径均有测试 |
| API质量 | 无宿主耦合、无包级强制单例 | Options、接口、错误类型、兼容层和文档完整 |

### 禁止事项

- **禁止**在独立包门禁完成前，将`/api/search method=4`、CLI语义搜索或MCP语义搜索切到`vectordb`。
- **禁止**为了迁移业务搜索而把SiYuan专用概念写入`vectordb`核心包。
- **禁止**把`GlobalDB`、Gin handler、工作空间路径探测、Embedding保留集合规则继续留在独立包核心层。
- **禁止**通过降低召回率阈值、跳过失败用例、只跑随机小数据集来宣称SOTA达标。
- **禁止**在没有可回滚适配层的情况下删除现有SQLite语义搜索路径。

### 验证检查清单

- [x] `vectordb`可以在不导入任何SiYuan业务包的情况下单独编译和测试。
- [x] `go list`依赖图显示独立包只依赖标准库和明确允许的第三方基础库。
- [ ] HNSW、Vamana、DiskVamana、BBQ、storage均有清晰包边界和公共API说明。
- [ ] 召回率测试覆盖内存索引、磁盘索引、量化搜索、增量Insert、增量Delete、Compact、重载恢复。
- [ ] 性能基准覆盖10K、100K、1M三个规模，并记录数据集、维度、参数、硬件和Go版本。
- [ ] 并发测试覆盖多读、读写混合、删除与查询交错、关闭与保存时序。（已验证核心Vamana快速race和10K并发插查，尚未覆盖全量规模race。）
- [ ] 持久化测试覆盖正常保存、异常中断、版本升级、损坏文件降级、跨平台路径。
- [ ] 宿主适配层与独立包之间没有循环依赖。

---

## 🧭 目标架构

### 目录边界目标

短期目标是在仓库内形成独立模块边界，建议目标形态如下：

```text
packages/vectordb/
├── go.mod
├── vectordb/
│   ├── db.go
│   ├── collection.go
│   ├── options.go
│   ├── errors.go
│   └── persistence.go
├── hnsw/
├── vamana/
├── bbq/
├── storage/
├── internal/
└── testdata/
```

内核宿主侧只保留适配层，建议目标形态如下：

```text
kernel/vectorstore/
├── service.go
├── paths.go
├── api_adapter.go
├── embedding_adapter.go
└── migration_adapter.go
```

### 依赖方向

```text
kernel/api、kernel/embedding、kernel/model
    ↓
kernel/vectorstore 适配层
    ↓
packages/vectordb 独立包
    ↓
标准库与基础第三方库
```

### 独立包当前公共API

```go
type DB interface {
    CreateCollectionWithOptions(name string, opts CollectionOptions) (*CollectionHandle, error)
    OpenCollection(name string) (*CollectionHandle, error)
    DeleteCollection(name string) error
    ListCollectionStats() []CollectionStats
    Close() error
}

type CollectionAPI interface {
    Name() string
    Engine() Engine
    Upsert(points []Point) error
    Search(query []float32, opts SearchOptions) ([]SearchResult, error)
    Delete(ids []string) error
    Flush() error
    Stats() CollectionStats
    Close() error
}
```

该接口是Phase 1已验证落地入口，不代表最终冻结接口。Phase 5需要继续评估`context.Context`取消语义、批处理Options、格式版本和破坏性变更策略。

---

## 🟢 近期计划

- [ ] **Phase 2: SOTA基准与召回率门禁框架 (P1)**
  - **背景**: 现有测试很多，但缺少统一的基准入口、固定数据集、阈值门禁和可比较报告，导致“性能好坏”和“SOTA是否达标”容易停留在单次测试印象。
  - **行动**: 建立`bench/`或`testdata/manifest`，统一SIFT、GIST或ANN-Benchmarks数据入口；实现brute-force ground truth；输出Recall@K、P50/P95/P99、QPS、构建耗时、内存峰值、磁盘占用；将HNSW、Vamana、DiskVamana、BBQ放入同一报告表。
  - **验收标准**: 10K和100K规模基准可在普通开发机复现；1M规模有环境变量门控；所有召回率阈值与[`向量数据库召回率优化导则`](../../规程/性能优化/向量数据库召回率优化.procedure.md)一致；报告写入`docs/ttt/vectordb`。
  - **参考文档**: [`docs/调研/向量数据库基准测试数据集.md`](../../调研/向量数据库基准测试数据集.md)、[`docs/ttt/vectordb/召回率优化.ttt.md`](./召回率优化.ttt.md)

- [ ] **Phase 3: 正确性、并发与持久化红线测试 (P1)**
  - **背景**: 独立包用于后续语义搜索前，必须先证明Search、Insert、Delete、Update、Compact、Flush、Reload在并发和异常场景下可依赖。
  - **行动**: 补齐`-race`并发测试、崩溃恢复测试、append buffer一致性测试、公开API一致性测试、损坏文件处理测试、跨平台路径测试和版本兼容测试。
  - **验收标准**: `go test -race ./...`核心包通过；公开API覆盖append buffer；`Save/Open/Compact/Delete/Insert/Search`组合测试通过；所有已知flaky测试要么稳定化，要么以明确原因门控。
  - **参考文档**: [`kernel/vectordb/vamana/api-issues.review.md`](../../../kernel/vectordb/vamana/api-issues.review.md)、[`docs/ttt/vectordb/向量数据库生产就绪核查结果.md`](./向量数据库生产就绪核查结果.md)

- [ ] **Phase 4: 算法实现质量提升与SOTA优化 (P1)**
  - **背景**: 当前实现已有HNSW、Vamana、DiskVamana和BBQ路径，但距离计算、内存布局、量化路径、缓存局部性、SIMD、批量构建和增量图修复仍需以SOTA标准统一优化。
  - **行动**: 评估并实现SIMD距离计算、批量构建路径、连续内存布局、量化粗筛与全精度重排、图修复策略、Compact策略和参数自动调优。
  - **验收标准**: 每个优化都有前后对比；召回率不得退化超过2个百分点；性能提升要在10K、100K、1M至少两个规模上成立。
  - **参考文档**: [`docs/分析/vamana实现审阅.review.md`](../../分析/vamana实现审阅.review.md)、[`docs/ttt/vectordb/磁盘插入性能优化.ttt.md`](./磁盘插入性能优化.ttt.md)、[`docs/ttt/vectordb/BBQ-4bit工程优化.ttt.md`](./BBQ-4bit工程优化.ttt.md)

## 🟡 中期计划

- [ ] **Phase 5: API稳定化与版本化策略 (P1)**
  - **背景**: 后续语义搜索迁移会长期依赖公共API，必须先冻结稳定接口和版本策略，避免业务迁移时跟随底层算法反复改动。
  - **行动**: 定义`Options`、`SearchOptions`、`CollectionStats`、错误类型、上下文取消语义、Flush语义、Close语义、兼容性承诺和格式版本升级策略。
  - **验收标准**: 公共API文档完整；破坏性变更有迁移说明；序列化格式带版本；旧格式加载测试覆盖至少一个历史版本。

- [ ] **Phase 6: 宿主适配层回接 (P1)**
  - **背景**: 独立包完成后，SiYuan内核仍需要通过适配层使用向量数据库，但适配层不能把业务概念回灌到独立包。
  - **行动**: 在`kernel/vectorstore`或等价位置实现路径管理、日志桥接、HTTP API桥接、只读权限、集合命名、Embedding保留集合规则和旧`kernel/api/vector.go`兼容。
  - **验收标准**: `kernel/api/vector.go`不直接依赖底层算法包；适配层测试覆盖集合创建、插入、删除、查询、保存、重启加载；旧API行为保持兼容。

- [ ] **Phase 7: 生产门禁流水线 (P1)**
  - **背景**: SOTA质量不能靠一次人工测试维持，必须变成持续门禁。
  - **行动**: 建立快速CI、夜间大规模基准、召回率回归、性能回归、race测试、磁盘格式兼容测试和报告归档机制。
  - **验收标准**: 快速门禁在开发机可运行；大规模门禁有环境变量和超时保护；每次算法改动必须更新或引用基准报告。

## 🔴 远期计划

- [ ] **Phase 8: SQLite语义搜索迁移设计 (P2，门禁后)**
  - **愿景**: 在独立包SOTA门禁通过后，再设计`kernel/model/embedding.go`官方语义搜索从SQLite BLOB暴力扫描迁移到独立向量数据集。
  - **前置条件**: Phase 0至Phase 7核心门禁完成；独立包稳定API冻结；宿主适配层回接完成；召回率、延迟和持久化报告齐全。
  - **禁止提前事项**: 不得提前替换`SemanticSearchBlock()`的读路径，不得删除`block_embeddings`状态表，不得让业务迁移倒逼独立包API污染。

- [ ] **Phase 9: 官方语义搜索双写与灰度切换 (P2，门禁后)**
  - **愿景**: 通过SQLite状态表+独立向量集合双写，完成可回滚迁移，再逐步把`/api/search method=4`、CLI和MCP切到新路径。
  - **前置条件**: Phase 8设计完成并评审；迁移脚本、回滚策略、统计口径和过滤语义明确。

- [ ] **Phase 10: 外部发布形态评估 (P2)**
  - **愿景**: 在仓库内独立包长期稳定后，再评估是否拆为独立仓库或作为单独模块发布；该步骤不阻塞SiYuan内部迁移。

## 🏁 已归档/已完成

- [x] **Phase 1: 独立模块统一接口与DiskVamana主引擎完整暴露 (P0)** [已完成 2026-07-06]
  - **背景**: “包暂时继续放在`s-forge`仓库中”不等于继续耦合在SiYuan内核模块内；必须先获得独立`go.mod`、独立测试和独立依赖图。
  - **完成情况**: 已创建`packages/vectordb`独立模块，未触碰`kernel/vectordb`内部实现；根包新增`DB`与`CollectionAPI`公开接口；`EngineDiskVamana`作为主引擎通过统一集合句柄暴露；支持创建、查询、更新、删除、Flush、Close、重启恢复、集合统计和集合删除；诊断型与规模型测试已显式门控；独立包未导入`kernel/*`、Gin、SiYuan logging或`GlobalDB`。
  - **修复内容**: 修复`TestNodeCacheConcurrent`共享`math/rand.Rand`导致的并发panic；修复DiskVamana增量插入路径把`robustPruneSimpleWithNorm` scratch切片写入邻接表导致的race与潜在邻接表污染。
  - **测试验证**: `go test . -count=1 -timeout 180s`通过；`go test ./... -short -count=1 -timeout 180s`通过；`go test ./... -count=1 -timeout 180s`通过；`go test -race . ./vamana -short -count=1 -timeout 240s`通过，其中Vamana用时约141s；`$env:VECTORDB_SCALE_TEST='1'; go test ./vamana -run "TestBuildFromVectors_Recall_10K|TestDiskIndex_Insert$|TestDiskIndex_Delete$|TestDiskIndex_ConcurrentInsertAndSearch" -count=1 -timeout 180s -v`通过，DiskVamana 10K构建Recall@10为100.00%，Insert后recall为0.9840，Delete后recall为0.9660，并发插查通过；依赖污染扫描无匹配；`go list -deps ./...`只包含标准库、`github.com/vmihailenco/msgpack/v5`、`golang.org/x/sys/windows`和本模块子包。
  - **复核验证**: 独立复核确认归档结论仍成立；公共API门面完整可用。
  - **成果文件**: [`packages/vectordb`](../../../packages/vectordb)、[`packages/vectordb/README.md`](../../../packages/vectordb/README.md)、[`docs/技术文档/向量数据库/VectorDB独立包边界ADR.md`](../../技术文档/向量数据库/VectorDB独立包边界ADR.md)。

- [x] **代码异味消除：BBQ重复编码统一** [已完成 2026-07-06]
  - **完成内容**: (1) 删除死代码`quantization.go`、`bbqDistance(id1,id2)`；(2) 新增`bbqStore`接口，内存/磁盘/append节点距离计算统一委托`bbqQueryDistance`/`bbqScoreWithCode`；(3) 构建时量化循环提取为`bbq.QuantizeRange`，内存`computeBBQDataParallel`与磁盘`computeBBQChunk`共用；(4) 字段名统一：`bbqCompensations`→`bbqCorrections`；(5) 移除v1 Hamming遗留路径（`greedySearchBBQHamming`/`bbqHammingDistance`/`quantizeQueryToBBQ`/`fusedHammingDistance`/`loadBBQCodesV1`）；(6) BBQ文件版本常量统一为单一版本。
  - **涉及文件**: `bbq/quantizer.go`、`vamana/bbq.go`、`vamana/disk_search.go`、`vamana/disk_index.go`、`vamana/disk_build.go`、`vamana/bbq_store.go`、`vamana/constants.go`、`vamana/save.go`、`vamana/disk_incremental.go`、`vamana/bbq_test.go`、`vamana/disk_build_test.go`、`vamana/disk_index_test.go`。
  - **测试验证**: `go test ./... -count=1`通过（vectordb 0.9s / bbq 0.5s / hnsw 0.6s / storage 0.8s / vamana 11.9s）；`go test -race . ./bbq ./storage`通过。

- [x] **功能完整性补充：FetchPoints + ScoreThreshold + 度量类型系统统一** [已完成 2026-07-06]
  - **完成内容**: (1) `CollectionHandle.FetchPoints(ids)` 按外部ID批量取回向量+元数据，HNSW与DiskVamana双引擎；(2) `SearchOptions.ScoreThreshold` 搜索结果按分数截断；(3) `CollectionOptions.DistanceMetric` 公参，`resolveSimilarity` 双返回值+扩展（支持`l2`/`euclidean`/`cosine`/`ip`/`dot`/`innerproduct`），`vamanaDistanceToScore` 度量感知版与 HNSW `distanceToScore` 对齐。
  - **涉及文件**: `public.go`、`public_test.go`、`types.go`、`store.go`、`vamana_collection.go`、`vamana/disk_index.go`。
  - **测试验证**: 新增`TestUnifiedDB_DistanceMetricConsistency`、`TestUnifiedDB_SearchScoreThreshold`；全量回归通过。

- [x] **storage mmap reader 健壮性修复** [已完成 2026-07-06]
  - **完成内容**: (1) `parseHeader` 校验 `NodesPerBlock==0` 与 `NodeLen==0` 时返回 `ErrCorruptedFile`；(2) `ReadNeighbors` 校验 `neighborCount` 不超出节点布局范围。Windows与Unix双平台同步修复。
  - **涉及文件**: `storage/io_mmap_windows.go`、`storage/io_mmap_unix.go`。
  - **测试验证**: `TestWindowsReader_NodesPerBlockZero` 被正确SKIP（parseHeader返回ErrCorruptedFile）；`TestWindowsReader_CorruptedNeighborCount` PASS。

- [x] **前置分析: kernel中存在两套独立向量搜索实现** [已完成 2026-07-06]
  - **背景**: 已确认`kernel/model/embedding.go`使用SQLite BLOB全表扫描做精确语义搜索，`kernel/embedding`和`kernel/vectordb`使用HNSW/Vamana集合做ANN搜索，两者存储隔离、调度隔离、调用链隔离。
  - **完成情况**: 明确迁移不能先替换业务搜索读路径，必须先完成`vectordb`独立包化和SOTA质量门禁。
  - **成果文件**: 本文档。
  - **参考文档**: [`kernel/model/embedding.go`](../../../kernel/model/embedding.go)、[`kernel/embedding/embedding.go`](../../../kernel/embedding/embedding.go)、[`kernel/vectordb/`](../../../kernel/vectordb/)

## 📎 适用规程

- [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)：本文档结构规程。
- [`docs/规程/代码质量/Go后端代码重构.procedure.md`](../../规程/代码质量/Go后端代码重构.procedure.md)：独立包化和接口统一规程。
- [`docs/规程/性能优化/向量数据库召回率优化.procedure.md`](../../规程/性能优化/向量数据库召回率优化.procedure.md)：召回率和算法门禁规程。
- [`docs/规程/性能优化/性能优化.procedure.md`](../../规程/性能优化/性能优化.procedure.md)：性能优化记录和验证规程。
- [`docs/规程/测试与修复/后端Go测试编写.procedure.md`](../../规程/测试与修复/后端Go测试编写.procedure.md)：Go测试补齐规程。

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上`[x]`和日期。
2. **补充弹药**：当【近期计划】少于3个任务时，从【中期计划】里挑选任务挪上来。
3. **因地制宜**：如果发现计划不合理，随时修改或删除，但不得改变“先独立包化与SOTA门禁，后语义搜索迁移”的顺序。
4. **数据驱动**：所有性能、召回率、正确性和并发结论必须有命令、数据集、参数和结果记录。
5. **门禁优先**：任何业务迁移任务进入近期计划前，必须先在本文档中确认独立包核心门禁已归档完成。

---

**创建时间**: 2026-07-06  
**维护范围**: `packages/vectordb`目标独立包、现有`kernel/vectordb`兼容层、后续`kernel/vectorstore`宿主适配层  
**当前阶段**: Phase 2、Phase 3、Phase 4进行中前置准备
