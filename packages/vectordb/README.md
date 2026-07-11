# s-forge vectordb

`packages/vectordb`是仓库内独立向量数据库模块。它从SiYuan内核集成层中拆出，用于在任何语义搜索迁移前，先独立验证算法、存储、持久化、并发和基准质量。

## 边界

该模块不得导入：

- `github.com/siyuan-note/siyuan/kernel/*`
- `github.com/siyuan-note/logging`
- `github.com/gin-gonic/gin`
- SiYuan工作空间、Embedding、认证、HTTP或配置包

宿主相关行为应放在该模块之外的适配层中。

## 包结构

| 包 | 职责 |
|---|---|
| `vectordb` | 统一数据库入口、集合句柄、持久化和兼容外观 |
| `bbq` | 二值量化和评分 |
| `hnsw` | 内存HNSW索引 |
| `storage` | 磁盘读取器、mmap、序列化和删除位图 |
| `vamana` | Vamana和DiskVamana索引 |

## 公开入口

根包公开`DB`和`CollectionAPI`接口，`EngineDiskVamana`作为主引擎通过统一集合句柄暴露。

| API | 说明 |
|---|---|
| `Open(path)` | 打开或创建独立向量数据库目录 |
| `CreateCollectionWithOptions(name, opts)` | 通过`CollectionOptions.Engine`创建`EngineDiskVamana`或`EngineHNSW`集合 |
| `OpenCollection(name)` | 通过统一句柄打开集合 |
| `DeleteCollection(name)` | 删除集合及其落盘文件 |
| `ListCollectionStats()` | 返回包含引擎、维度和数量的集合统计 |
| `CollectionHandle.Write(ctx, batch, opts)` | 带上下文、提交序号和 `memory`/`async`/`sync` 持久性选项的批次写入契约 |
| `CollectionHandle.Upsert/Search/Delete/Flush/Stats/Close` | 兼容集合生命周期接口；`Upsert` 和 `Delete` 委托给同步批次写入 |

## 写入与格式契约

同一集合的公开批次写入按提交序号线性化；批次内同一外部 ID 的最后操作生效，搜索、统计和点读取不会观察批次中间状态。验证失败、提交前取消和可恢复的持久化失败不产生部分写入。HNSW 的 `sync` 模式使用带长度互补校验和 CRC32C 的批次 WAL，在文件同步完成后才返回；`Flush` 生成原子快照并清理 WAL。提交序号写入 WAL、HNSW 快照和 Vamana 状态文件，重启后继续递增。

HNSW 快照写入当前格式主版本和次版本。主版本不一致或存在未知必需特性位时拒绝打开；未来次版本可判定为只读并要求迁移，旧的无版本快照继续按兼容格式读取。

## ANN-Benchmarks SIFT 基准

`BenchmarkANNBenchmarksSIFT`采用 ANN-Benchmarks 常用的 SIFT L2、Recall@10 与单查询吞吐协议，在同一进程和数据上报告精确 k-NN 基线以及 HNSW 的 `efSearch=32/64/100/200` 曲线。默认轻量配置使用 SIFT1M 的前 10,000 个 base 向量和前 100 个 query，并重新计算该子集的精确 ground truth；通过环境变量可扩展到更大规模。

```powershell
$env:VECTORDB_ANN_BENCH='1'
$env:VECTORDB_ANN_BASE_COUNT='10000'
$env:VECTORDB_ANN_QUERY_COUNT='100'
go test -run TestANNBenchmarksSIFTReport -count=1 -timeout 30m -v
go test -run '^$' -bench BenchmarkANNBenchmarksSIFT -benchmem -benchtime=3s -count=3 -timeout 30m
```

数据目录为仓库根目录的 `test_data/sift`，需包含 TEXMEX SIFT1M 的 `sift_base.fvecs` 和 `sift_query.fvecs`。报告包含构建时间、构建吞吐、每向量堆内存、QPS、p50/p95/p99、Recall@10 和相对 exact k-NN 加速比。

## 已验证基线

当前验证基线优先保证根包统一API和`EngineDiskVamana`主引擎可用。

```powershell
go test . -count=1 -timeout 180s
go test ./... -short -count=1 -timeout 180s
go test ./... -count=1 -timeout 180s
go test -race . ./vamana -short -count=1 -timeout 240s
$env:VECTORDB_SCALE_TEST='1'; go test ./vamana -run "TestBuildFromVectors_Recall_10K|TestDiskIndex_Insert$|TestDiskIndex_Delete$|TestDiskIndex_ConcurrentInsertAndSearch" -count=1 -timeout 180s -v
rg -n "github.com/siyuan-note/siyuan/kernel|github.com/siyuan-note/logging|github.com/gin-gonic/gin|GlobalDB|InitGlobalDB" packages\vectordb -g "*.go" -S
go list -deps ./...
```

最近一次验证结果：

| 门禁 | 结果 |
|---|---|
| 根包统一接口测试 | 通过，覆盖DiskVamana创建、查询、更新、删除、Flush、Close、重启恢复和集合管理 |
| 默认全包测试 | `go test ./... -count=1 -timeout 180s`通过 |
| 快速全包测试 | `go test ./... -short -count=1 -timeout 180s`通过 |
| 核心race测试 | `go test -race . ./vamana -short -count=1 -timeout 240s`通过，Vamana用时约141s |
| 显式规模门禁 | DiskVamana 10K构建Recall@10为100.00%；Insert后recall为0.9840；Delete后recall为0.9660；并发插查通过 |
| 依赖污染扫描 | 无匹配，未发现SiYuan kernel、SiYuan logging、Gin、GlobalDB耦合 |

规模型和诊断型测试默认跳过，分别通过`VECTORDB_SCALE_TEST=1`和`VECTORDB_DIAGNOSTIC_TEST=1`显式开启。
