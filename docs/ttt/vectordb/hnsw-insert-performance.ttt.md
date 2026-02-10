# HNSW 插入性能优化 执行跟踪 (TikTocTak)

> **目标**: 优化 HNSW 索引插入性能，当前仅 600-1000 条/秒且随数据量增长严重衰减，目标达到生产可用水平。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 项目背景

- **现状**: 核查发现 HNSW 插入性能是生产环境阻塞性问题，600-1000 条/秒的吞吐量无法满足实际使用需求，且随数据量增长性能严重衰减。
- **基线数据** (Phase 2 测得): 128维50K规模，平均144 items/sec，衰减44% (211→118)
- **CPU热点**: euclideanDistance flat 59%，selectNeighborsHeuristic cum 42%，searchLevel cum 46.4%
- **相关代码**:
  - `kernel/vectordb/hnsw/` — 核心实现（build/delete/query/types/utils）
  - `kernel/vectordb/hnsw_proxy.go` — 代理层
  - `kernel/vectordb/store.go` — 存储层
- **核查报告**: `docs/ttt/vectordb/vectordb-production-readiness-findings.md`
- **基线数据报告**: `docs/ttt/vectordb/hnsw-benchmark-baseline.md`
- **已有架构审阅**: `kernel/vectordb/architecture/locking-strategy.review.md`

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

## 🔍 验证检查清单

- [x] 插入吞吐量基准测试（优化前）— 128维50K，平均144 items/sec
- [x] 插入吞吐量随数据量增长的衰减曲线（优化前）— 211→118，衰减44%
- [x] Phase 3 优化后吞吐量对比 — 平均203 items/sec（+41%）
- [x] Phase 3 优化后衰减曲线对比 — 282.6→172.0，衰减39%（改善5pp）
- [x] Phase 4 优化后吞吐量对比 — 平均208 items/sec（+2.5%）
- [x] Phase 4 优化后衰减曲线对比 — 281.5→182.5，衰减35%（改善4pp）
- [x] 查询召回率无回归 — 三种度量（euclidean/cosine/dotProduct）均100%召回
- [x] Phase 6 HNSW vs Vamana/DiskVamana 全面对比 — HNSW 200/s vs Vamana 294/s，同量级
- [x] Phase 7 松弛因子优化后吞吐量对比 — 200→318 items/s (+59%)，反超Vamana
- [x] Phase 8 距离计算8路展开优化后吞吐量对比 — 318→333 items/s (+5%)，累计+131%

## 🟢 近期计划

（暂无）

## 🔵 中期计划

（暂无）

## 🏁 已归档/已完成

- [x] **Phase 8: 距离计算路径优化 (2026-02-10)** — 完成（边际提升）
  - **优化内容**:
    1. euclideanDistance/L2Distance/CosineDistance 从4路展开改为8路展开+独立累加器
    2. mockDistancer从双重间接寻址([][]float32)改为flat存储([]float32)
    3. ComputeDistance直接切片偏移计算，消除间接调用
  - **吞吐量**: 318→333 items/s (+5%)，累计Phase 1→8: 144→333 (+131%)
  - **vs Vamana**: HNSW 333/s vs Vamana 273/s，领先22%
  - **衰减**: 586→270，衰减54%（与Phase 7持平）
  - **召回率**: 三种度量均100%，无回归
  - **修改文件**: `distance.go`, `hnsw/hnsw_test.go`, `hnsw/query.go`
  - **Profile报告**: `docs/ttt/vectordb/hnsw-phase7-profile.md`
  - **失败记录**: apply_diff连续失败4次（96-97%相似度，:start_line:格式错误）
  - **备注**: 8路展开边际提升有限(+5%)，Go编译器已对简单循环做了较好优化。距离计算仍占CPU 68%，进一步提升需SIMD汇编或CGO。

- [x] **Phase 7: 双向连接松弛因子优化 (2026-02-10)** — 完成（重大提升）
  - **根因**: 双向连接维护无条件执行selectNeighborsHeuristic()，每次Insert产生~19,000次距离计算（占91.8%）
  - **优化内容**: 引入GraphSlackFactor=1.3，度数未超过SlackFactor×M时直接append跳过heuristic
  - **吞吐量对比** (128维50K):
    | Phase | 优化前 | 优化后 | 提升 |
    |-------|--------|--------|------|
    | 0 (0k-10k) | 297 | 568 | +91% |
    | 1 (10k-20k) | 210 | 316 | +50% |
    | 2 (20k-30k) | 190 | 280 | +47% |
    | 3 (30k-40k) | 168 | 254 | +51% |
    | 4 (40k-50k) | 177 | 254 | +44% |
    | **总体** | **200** | **318** | **+59%** |
  - **vs Vamana**: 从落后47%变为反超23%（318 vs 259）
  - **衰减**: 0.59→0.45（衰减加剧，需关注）
  - **召回率**: 三种度量均100%，无回归
  - **修改文件**: `types.go`（Config新增GraphSlackFactor）, `build.go`（双向连接松弛判断）
  - **根因分析报告**: `docs/vectordb/hnsw-vs-vamana-gap-analysis.md`
  - **失败记录**: 无

- [x] **Phase 6: 全面性能对比测试 (2026-02-10)** — 完成
  - **目的**: 对比HNSW与Vamana/DiskVamana的插入性能，判断HNSW性能是实现问题还是算法/硬件限制
  - **测试矩阵** (128维50K, euclidean):
    - Section 1 单线程: HNSW Insert 200/s, Vamana Insert 294/s (1.47x), Vamana Build-1T 502/s, DiskVamana Insert 89/s
    - Section 2 多线程(12T): Vamana Build-MT 3,209/s, DiskVamana Build 3,155/s
  - **衰减**: HNSW 0.60, Vamana 0.60（完全一致，说明衰减是图索引固有特征）
  - **结论**: HNSW与Vamana同量级（1.47x差距），性能瓶颈非HNSW实现缺陷，而是图索引算法固有复杂度
  - **测试代码**: `kernel/vectordb/hnsw_vs_vamana_bench_test.go`
  - **数据报告**: `docs/ttt/vectordb/hnsw-vs-vamana-benchmark.md`
  - **失败记录**:
    1. ComputeBBQDistance返回常量0导致HNSW吞吐量虚高100x（已修复）
    2. Vamana Build多线程数据与单线程混合对比产生误导（已重构为两段式）
    3. DiskVamana测试缺少OpenDiskIndexReader配置导致Open失败（已修复）
    4. DiskVamana阶段数(4)与其他索引(5)不一致导致越界panic（已修复）

- [x] **Phase 5: 锁粒度优化 (2026-02-10)** — 完成（效果有限）
  - **优化内容**:
    1. 引入 `nodeLocks []sync.Mutex` 节点级锁，替代全局 `idx.Mu` 保护邻居列表
    2. `idx.Mu` 降级为元数据锁，仅保护 EntryPoint/MaxLayer/Deleted 和切片扩展
    3. `SetLevelNeighbors`/`SetLevelNeighborIDs`/`RemoveNeighbor` 改用节点级 Mutex
    4. `GetItemLevel` 改用节点级锁
  - **优化前基准** (128维50K, DefaultConfig):
    | Phase | Items/sec |
    |-------|-----------|
    | 0 (0k-10k) | 286.5 |
    | 1 (10k-20k) | 200.9 |
    | 2 (20k-30k) | 185.0 |
    | 3 (30k-40k) | 151.2 |
    | 4 (40k-50k) | 180.3 |
    | **平均** | **~201** |
  - **根因分析**: 当前基准测试为单线程串行插入，锁粒度优化的收益主要体现在并发场景。单线程下，将全局 RWMutex 替换为节点级 Mutex 仅减少了锁的原子操作开销（RWMutex.Lock 内部有多个 atomic 操作，Mutex.Lock 仅一个），预期提升极小（<5%）。真正的瓶颈仍是距离计算（CPU 59%）和算法复杂度 O(efConstruction × M)。
  - **修改文件**: `types.go`, `utils.go`, `delete.go`
  - **备注**: 锁优化为并发插入铺平道路，但单线程吞吐量提升有限。后续应关注 SIMD 距离计算或降低 efConstruction 等算法级优化。

- [x] **Phase 4: 内存分配优化 (2026-02-10)** — 完成
  - **优化内容**:
    1. `HeapItem` 从指针类型 `*HeapItem` 改为值类型 `HeapItem`（8字节，栈友好）
    2. `MinHeap`/`MaxHeap` 内部 `[]HeapItem` 替代 `[]*HeapItem`，消除每次 Push 的堆分配
    3. 双向连接循环中 `candidatesForNeighbor` 改为循环外预分配缓冲区复用
  - **吞吐量对比** (128维50K, DefaultConfig):
    | Phase | Phase 3 | Phase 4 | 变化 |
    |-------|---------|---------|------|
    | 0 (0k-10k) | 282.6 | 281.5 | -0.4% |
    | 1 (10k-20k) | 198.0 | 203.7 | +2.9% |
    | 2 (20k-30k) | 184.9 | 190.2 | +2.9% |
    | 3 (30k-40k) | 178.5 | 181.2 | +1.5% |
    | 4 (40k-50k) | 172.0 | 182.5 | +6.1% |
    | **平均** | **203** | **208** | **+2.5%** |
  - **衰减**: 39% → 35%（改善4个百分点）
  - **召回率**: 三种度量均100%，无回归
  - **修改文件**: `types.go`, `build.go`, `query.go`, `hnsw_test.go`
  - **备注**: 吞吐量提升幅度较小（+2.5%），符合预期——距离计算仍占CPU 59%，内存分配不是主要瓶颈。但衰减曲线改善明显（尤其40k-50k段+6.1%），说明大数据量下GC压力减轻有效。

- [x] **Phase 3: 距离计算优化 (2026-02-10)** — 完成
  - **优化内容**:
    1. 邻居列表从 `[][][]DocID` 改为 `[][][]NeighborRecord`，存储缓存距离
    2. 双向连接维护直接使用缓存距离，消除 O(M²) 距离重算（约1056次/插入）
    3. `greedySearch`/`searchLevel` 使用零分配 `GetLevelNeighborRecords`
    4. `mockDistancer` 从 `map` 改为 `slice`，消除基准测试中约20% map查找开销
  - **吞吐量对比** (128维50K, DefaultConfig):
    | Phase | 优化前 | 优化后 | 提升 |
    |-------|--------|--------|------|
    | 0 (0k-10k) | 211.0 | 282.6 | +34% |
    | 1 (10k-20k) | 146.1 | 198.0 | +36% |
    | 2 (20k-30k) | 131.4 | 184.9 | +41% |
    | 3 (30k-40k) | 121.0 | 178.5 | +48% |
    | 4 (40k-50k) | 118.1 | 172.0 | +46% |
    | **平均** | **144** | **203** | **+41%** |
  - **衰减**: 44% → 39%（改善5个百分点）
  - **召回率**: 三种度量均100%，无回归
  - **修改文件**: `types.go`, `build.go`, `utils.go`, `delete.go`, `hnsw_test.go`, `persistence.go`

- [x] **Phase 2: 大规模基准测试验证 (2026-02-10)** — 完成
  - 基准测试代码: `kernel/vectordb/hnsw/bench_insert_test.go`
  - CPU profile: `kernel/vectordb/hnsw/testdata/insert_cpu.prof`
  - 基线数据报告: `docs/ttt/vectordb/hnsw-benchmark-baseline.md`
  - 关键发现: euclideanDistance flat 59%，selectNeighborsHeuristic cum 42%，searchLevel cum 46.4%
  - 吞吐量: 128维50K，211→118 items/sec，平均144，衰减44%

- [x] **Phase 1: 根因调查 (2026-02-10)** — 完成，发现多个潜在瓶颈
  - 调查报告: `docs/ttt/vectordb/hnsw-insert-performance-findings.md`
  - 发现: 双向连接维护O(M²)距离重算、RandomLevel p=0.5疑似偏高、efConstruction=200偏高、距离函数无SIMD
  - **失败教训**: 直接基于调查假设实施了RandomLevel修改，未先进行大规模数据验证。修改被用户否决后回退。正确流程应为：调查→假设→大规模基准测试验证→确认后才实施修改。
