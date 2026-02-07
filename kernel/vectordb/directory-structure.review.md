# vectordb 目录结构问题

## 🔴 HNSW 文件散落在根目录

```
vectordb/
├── bbq/                    # ✅ 独立子目录
├── storage/                # ✅ 独立子目录
├── vamana/                 # ✅ 独立子目录
│
├── hnsw_build.go          # ❌ 应该在 hnsw/ 子目录
├── hnsw_delete.go         # ❌
├── hnsw_query.go          # ❌
├── hnsw_utils.go          # ❌
├── hnsw_*_test.go         # ❌
```

### 建议

创建 `hnsw/` 子目录，统一管理 HNSW 实现。

---

## 🔴 Vamana 常量分散

| 文件 | 常量类型 |
|------|----------|
| config.go | DefaultR/L/Alpha |
| disk_index.go | 文件格式常量 |
| disk_incremental.go | 增量操作参数 |
| disk_build.go | 构建参数 |

### 建议

创建 `constants.go` 统一管理所有常量。

---

## 🟡 VamanaIndex 与 DiskVamanaIndex API 不一致

| 方法 | VamanaIndex | DiskVamanaIndex |
|------|-------------|-----------------|
| NumPointsTotal() | 返回 `int` | 返回 `uint64` |
| Delete() | 只设标记 | 完整边修复 |

### 建议

定义统一的 `Index` 接口，确保 API 签名一致。
