# Vamana API 不一致问题

> 审阅时间: 2026-02-08

---

## 🔴 增量操作未纳入公开 API

`disk_incremental.go` 引入了 `appendVectors` 缓冲区，但公开 API 未更新。

### 问题清单

| 方法 | 问题 |
|------|------|
| `NumPointsTotal()` | 只返回磁盘点数，不含追加缓冲区 |
| `NumPoints()` | 同上 |
| `GetNeighbors()` | 边界检查只覆盖磁盘范围 |
| `ReadVector()` | 不支持追加节点 |
| `GetBBQCode()` | 不支持追加节点 |

### 修复方向

修改 `disk_index.go` 中的公开方法，统一使用 `totalPoints()` 逻辑。

---

## 现有私有/公开方法对照

| 公开方法 | 私有方法 | 差异 |
|----------|----------|------|
| NumPointsTotal() | totalPoints() | 公开版少了 appendVectors |
| ReadVector() | getVector() | 公开版不支持 append 节点 |
| GetNeighbors() | getNeighborsForSearch() | 公开版边界检查不完整 |
