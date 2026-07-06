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
| `CollectionHandle.Upsert/Search/Delete/Flush/Stats/Close` | 统一集合生命周期接口 |

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
