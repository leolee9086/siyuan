# BBQ 4-bit 路径工程优化

状态: 🟡 进行中
创建: 2026-02-08
规程: docs/规程/性能优化/性能优化.procedure.md, docs/规程/性能优化/向量数据库召回率优化.procedure.md

## 背景

前序任务 `bbq-4bit-asymmetric-query.ttt.md` 完成了BBQ 4-bit非对称查询的功能实现，验证了4-bit查询向量能显著提升召回率。但当前4-bit路径的工程实现较为粗糙，存在多处性能和内存效率问题。

本任务目标：优化BBQ 4-bit路径的工程实现质量，并与参考实现（toread/DiskANN Rust版、toread/IP-DiskANN C++版）在其测试和benchmark涉及的用例下进行对比，确保表现持平。

注意：DiskANN Rust版使用的是RabitQ（spherical quantization）算法，IP-DiskANN C++版使用PQ算法，与我们的BBQ是不同的量化算法。对比的是最终效果（recall/latency），不是算法实现细节。

## 已知问题

### E1: 热路径堆分配
- 位置: `kernel/vectordb/vamana/disk_search.go` — `appendBBQCorrectedDistance4Bit()`
- 问题: 每次调用 `make([]byte, dimension)` + 新建 `ScalarQuantizer`，在搜索热路径上产生大量GC压力
- 违反: 性能优化规程 1.1（热路径禁止堆分配）

### E2: 低效的4-bit×1-bit点积
- 位置: `kernel/vectordb/bbq/bitops.go` — `ComputeNaiveDotProduct()`
- 问题: 逐字节乘加，4x循环展开，无SIMD/POPCNT加速
- 参考: DiskANN Rust版使用BitTranspose布局，4-bit×1-bit点积变为4次AND+POPCNT/64维

### E3: 散列内存分配
- 位置: `kernel/vectordb/vamana/disk_index.go` — `unpackBBQCodes()`
- 问题: `[][]byte` 二维切片，每个节点独立分配，GC压力大，缓存不友好
- 改进方向: 连续内存块 + 偏移索引

### E4: benchmark覆盖不足
- 问题: 当前仅有简单的1-bit vs 4-bit对比测试，缺少与参考实现可比的系统化benchmark
- 目标: 建立与DiskANN/IP-DiskANN benchmark配置可比的测试用例

## 任务分解

### S1: 内存分配优化（E1+E3）
- 范围: disk_index.go的unpacked数据改为连续内存块；disk_search.go的append路径消除热路径分配
- 文件: disk_index.go, disk_search.go
- 完成标志: 无热路径堆分配，unpacked数据使用连续[]byte+偏移索引

### S2: BitTranspose布局 + POPCNT加速（E2）
- 范围: bbq包新增BitTranspose布局的4-bit数据表示和基于POPCNT的点积计算
- 文件: kernel/vectordb/bbq/bitops.go（或新文件）
- 完成标志: 新的点积函数通过单元测试，与NaiveDotProduct结果一致
- 依赖: S1（需要新的内存布局配合）

### S3: 搜索路径集成BitTranspose
- 范围: disk_search.go和bbq.go的4-bit路径切换到BitTranspose点积
- 文件: disk_search.go, bbq.go, disk_index.go
- 完成标志: 现有测试全部通过，4-bit路径使用新的点积实现
- 依赖: S1, S2

### S4: Benchmark对齐验证（E4）
- 范围: 创建与参考实现可比的benchmark，对比recall和latency
- 文件: 新建benchmark测试文件
- 完成标志: benchmark结果显示在相同数据集和参数下表现持平
- 依赖: S1, S2, S3

## 参考实现benchmark配置
- DiskANN Rust: siftsmall 256pts, dim=128, squared_l2, search_l=[10..100], recall_k=10
- IP-DiskANN C++: 无量化相关benchmark（仅参数构建测试）

## 失败记录

### F1: 调查子任务错误对比
- 时间: 2026-02-08
- 描述: 深入分析子任务将BBQ和RabitQ混为一谈，错误地认为我们的BBQ是RabitQ的"简化版"，产出了误导性的对比分析
- 教训: BBQ和RabitQ是不同算法，对比应聚焦最终效果而非算法实现细节

## 近期执行计划
- [x] S1: 内存分配优化（2026-02-08 完成）
- [x] S2: BitTranspose布局 + POPCNT加速（2026-02-08 完成）
- [x] S3: 搜索路径集成BitTranspose（2026-02-08 完成）
- [ ] S4: Benchmark对齐验证

## S1 完成记录

### 变更摘要
- **E3 修复**: `bbqUnpacked` 从 `[][]byte`（n 次独立分配）改为扁平 `[]byte`（单次分配 n*dim 字节），通过 `nodeID * dim` 偏移访问。新增 `bbqUnpackedN` 字段记录节点数。
- **E1 修复**: `appendBBQCorrectedDistance4Bit()` 和 `appendBBQCorrectedDistance()` 不再每次调用创建 `ScalarQuantizer` 和 `make([]byte, dimension)`。quantizer 和临时缓冲区在 `greedySearchBBQWithMeta()` 中预分配一次，通过 `fusedBBQDistance4Bit`/`fusedBBQDistance` 传递到 append 路径。

### 修改文件
- `kernel/vectordb/vamana/disk_index.go`: `bbqUnpacked` 类型变更、`unpackBBQCodes()` 连续内存分配、`getBBQUnpackedUnlocked()` 偏移切片访问
- `kernel/vectordb/vamana/disk_search.go`: `greedySearchBBQWithMeta()` 预分配 appendScratch；`fusedBBQDistance()`/`fusedBBQDistance4Bit()` 增加 quantizer+scratchBuf 参数；`appendBBQCorrectedDistance()`/`appendBBQCorrectedDistance4Bit()` 复用传入的 quantizer 和 scratchBuf

### 测试验证
- `go test ./kernel/vectordb/vamana/... -run TestBBQ` 全部通过（10 个测试用例）
- 4-bit 召回率保持不变（98.20% @OSF=5.0）

### 失败记录
- 无

## S2 完成记录

### 变更摘要
- **PackBitTranspose4**: 将逐字节4-bit量化数据（每维1字节，值0-15）转换为BitTranspose布局。每64维为一个块，包含4个uint64位平面（bit-0到bit-3），小端序存储。维度向上对齐到64的倍数，填充位为0。
- **ComputeTransposedDotProduct**: 计算BitTranspose格式4-bit查询 × packed 1-bit索引的点积。每个64维块仅需4次AND+POPCNT操作，利用 `math/bits.OnesCount64` 编译为硬件POPCNT指令。

### 修改文件
- `kernel/vectordb/bbq/bitops.go`: 新增 `PackBitTranspose4()`、`ComputeTransposedDotProduct()`、常量 `bitTransposeBlockDims`/`bitTransposeBlockBytes`
- `kernel/vectordb/bbq/bitops_test.go`: 新增8个单元测试（KnownValues、AllZero、AllMax、RoundTrip、VsNaive、AllZeroQuery、AllZeroIndex、VsComputeNaiveDotProduct）+ 6个Benchmark

### Benchmark 结果（i5-10400F）
| 维度 | Naive (ns/op) | Transposed (ns/op) | 加速比 |
|------|--------------|-------------------|--------|
| 128  | ~54          | ~15               | 3.6x   |
| 256  | ~106         | ~27               | 3.9x   |
| 512  | ~222         | ~52               | 4.3x   |

### 测试验证
- bbq 包全部测试通过（含新增8个测试 + 原有全部测试），无回归
- 多维度（1,7,63,64,65,100,128,200,256,512）随机数据验证 Transposed 与 Naive 结果一致

### 失败记录
- 无

## S3 完成记录

### 变更摘要
- **搜索路径切换**: 磁盘索引和内存索引的4-bit搜索路径全部从 `ComputeNaiveDotProduct`（逐字节乘加）切换到 `ComputeTransposedDotProduct`（BitTranspose + POPCNT）
- **查询转换一次性**: 查询向量量化为4-bit后，在搜索开始时调用 `PackBitTranspose4` 转换一次，后续所有点积计算复用 transposed 数据
- **bbqUnpacked 移除**: 4-bit路径不再需要 unpacked 1-bit 数据，直接使用 packed `bbqCodes`。从 `DiskVamanaIndex` 和 `VamanaIndex` 中移除了 `bbqUnpacked`/`bbqUnpackedN` 字段及相关函数
- **PackBitTranspose4 位序修正**: 原实现使用小端位序（bit 0 = LSB），与 `PackBinary` 的大端位序（bit 0 = MSB）不匹配。修正为大端位序以确保 `ComputeTransposedDotProduct` 与 packed bbqCodes 兼容

### 修改文件
- `kernel/vectordb/bbq/bitops.go`: `PackBitTranspose4` 位序修正（大端位序匹配 `PackBinary`）
- `kernel/vectordb/vamana/disk_search.go`: `greedySearchBBQWithMeta()` 查询转换为 BitTranspose；`bbqCorrectedDistance4Bit()` 使用 `ComputeTransposedDotProduct`+packed bbqCodes；`fusedBBQDistance4Bit()` 传递 transposed 查询；`appendBBQCorrectedDistance4Bit()` 使用 packed 格式
- `kernel/vectordb/vamana/bbq.go`: `greedySearchBBQ()` 4-bit路径使用 BitTranspose；`bbqDistanceToQuery4Bit()` 使用 `ComputeTransposedDotProduct`+packed bbqCodes；移除 `bbqUnpacked` 分配
- `kernel/vectordb/vamana/disk_index.go`: 移除 `bbqUnpacked`/`bbqUnpackedN` 字段、`unpackBBQCodes()` 函数、`getBBQUnpackedUnlocked()` 函数
- `kernel/vectordb/vamana/index.go`: 移除 `bbqUnpacked` 字段

### 内存节省
- 移除 `bbqUnpacked`：每节点节省 dim 字节（128维 = 128字节/节点）
- 10K节点 × 128维 = 1.22 MB 内存节省
- 100K节点 × 128维 = 12.2 MB 内存节省

### 测试验证
- `go test ./vectordb/bbq/...` 全部通过（含 BitTranspose 单元测试）
- `go test ./vectordb/vamana/... -run TestBBQ` 全部通过
  - 4-bit Recall@10: **98.20%** @OSF=5.0（与优化前一致）
  - 4-bit Recall@10: 96.10% @OSF=3.0
  - 4-bit Recall@10: 92.40% @OSF=2.0
- `go test ./vectordb/vamana/... -run TestDisk` 全部通过（含 checkpoint、concurrent、streaming 等）

### 失败记录
- 无
