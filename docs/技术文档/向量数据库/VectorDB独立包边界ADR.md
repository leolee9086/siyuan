# VectorDB独立包边界ADR

> **状态**: 已采纳
> **日期**: 2026-07-06
> **范围**: `packages/vectordb`独立Go模块、现有`kernel/vectordb`兼容期实现、后续宿主适配层

## 背景

`kernel/vectordb`已经包含HNSW、Vamana、DiskVamana、BBQ量化、磁盘存储和持久化能力，但原位置同时承载了SiYuan内核集成职责。为了后续迁移语义搜索，必须先让向量数据库作为独立算法与存储包达到可测试、可复用、可演进的状态。

## 决策

1. 新增仓库内独立模块`packages/vectordb`，模块路径为`s-forge.local/vectordb`。
2. 独立模块优先保证`vamana.DiskVamanaIndex`可用性，再逐步收敛HNSW和根包Collection API。
3. 独立模块不得导入`github.com/siyuan-note/siyuan/kernel/*`、`github.com/siyuan-note/logging`、Gin或任何SiYuan业务包。
4. 独立模块不包含HTTP路由、工作空间路径探测、Embedding保留集合规则和内核全局单例。
5. 现阶段不修改`kernel/vectordb`内部实现，不改变SiYuan内核现有调用链。
6. 后续如需宿主集成，应新增薄适配层，由适配层依赖`packages/vectordb`，而不是让独立包依赖宿主。

## 当前落地状态

已创建`packages/vectordb`，包含以下包：

| 包 | 职责 |
|---|---|
| `s-forge.local/vectordb` | 根集合、数据库、持久化和HNSW/Vamana适配结构 |
| `s-forge.local/vectordb/bbq` | BBQ量化与评分 |
| `s-forge.local/vectordb/hnsw` | HNSW图索引 |
| `s-forge.local/vectordb/storage` | 磁盘读写、mmap和序列化 |
| `s-forge.local/vectordb/vamana` | Vamana与DiskVamana索引 |

根包已新增统一对外入口：

| API | 说明 |
|---|---|
| `Open(path)` | 打开或创建独立向量数据库目录 |
| `CreateCollectionWithOptions(name, opts)` | 通过`CollectionOptions.Engine`创建HNSW或DiskVamana集合 |
| `OpenCollection(name)` | 通过统一句柄打开集合 |
| `DeleteCollection(name)` | 删除集合及其落盘文件 |
| `ListCollectionStats()` | 返回包含引擎、维度和数量的集合统计 |
| `Close()` | 关闭数据库内已打开集合 |
| `CollectionHandle.Upsert/Search/Delete/Flush/Stats/Close` | 统一集合生命周期接口 |

`EngineDiskVamana`已作为根包主引擎暴露，并有接口级生命周期测试覆盖创建、查询、更新、删除、Flush、关闭、重启恢复、重启后查询、集合管理和维度错误。

## 已验证命令

以下命令已在Windows环境执行通过：

```powershell
cd packages\vectordb
go test . -count=1 -timeout 180s
go test ./... -short -count=1 -timeout 180s
go test ./... -count=1 -timeout 180s
go test -race . ./vamana -short -count=1 -timeout 240s
$env:VECTORDB_SCALE_TEST='1'; go test ./vamana -run "TestBuildFromVectors_Recall_10K|TestDiskIndex_Insert$|TestDiskIndex_Delete$|TestDiskIndex_ConcurrentInsertAndSearch" -count=1 -timeout 180s -v
rg -n "github.com/siyuan-note/siyuan/kernel|github.com/siyuan-note/logging|github.com/gin-gonic/gin|GlobalDB|InitGlobalDB" packages\vectordb -g "*.go" -S
go list -deps ./...
```

验证结果：

| 命令 | 结果 |
|---|---|
| `go test . -count=1 -timeout 180s` | 通过，覆盖统一接口DiskVamana生命周期、集合管理和错误类型 |
| `go test ./... -short -count=1 -timeout 180s` | 通过，所有子包快速门禁通过 |
| `go test ./... -count=1 -timeout 180s` | 通过，默认测试不会误触发规模型或诊断型用例 |
| `go test -race . ./vamana -short -count=1 -timeout 240s` | 通过，已修复DiskVamana增量插入邻接表scratch泄漏导致的数据竞争 |
| 显式规模门禁 | 通过；DiskVamana 10K构建Recall@10为100.00%，Insert后recall为0.9840，Delete后recall为0.9660，并发插查通过 |
| `go list -deps ./...` | 依赖图只包含标准库、`github.com/vmihailenco/msgpack/v5`、`golang.org/x/sys/windows`和本模块子包 |
| 依赖污染扫描 | 无匹配，表示未发现内核、SiYuan logging、Gin、GlobalDB依赖 |

## 未完成门禁

1. 根包仍保留过渡期`Collection`结构体和兼容方法，公共API尚未进入冻结期。
2. `IsSSD`仍是根包包级开关，后续应收敛为`Options`或宿主适配层注入参数。
3. DiskVamana崩溃恢复、半写文件、版本升级和跨平台格式兼容测试仍需继续补齐。
4. 100K与1M规模Pareto基准、全量race规模门禁和持续基准报告尚未建立。
5. SOTA召回率与性能基准框架尚未完成归档。

## 后果

该决策让后续工作可以在不触碰`kernel/vectordb`内部实现的前提下推进独立向量数据库质量。语义搜索迁移仍保持冻结，只有当独立包完成测试门禁、API稳定化和宿主适配层后，才能进入设计和灰度阶段。
