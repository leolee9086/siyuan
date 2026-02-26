# 后端性能瓶颈调研：Phase 4 全文搜索机制优化 (FTS5)

## 发现与分析

经过对 `kernel/model/search.go` 及全文本查找模块的源码分析，发现思源目前利用 SQLite FTS5 虚拟引擎实现全局搜索，但由于查询语句的组合方式产生了严重的效率瓶颈，主要集中在以下三个方面：

### 1. 复杂 ORDER BY 导致 FTS5 丧失排序优化，退化为全表内存排序 (Memory Sort)
- **现状**：在默认的全局搜索中，排序子句（`buildOrderBy`）被构造为：
  `ORDER BY CASE WHEN name = ... THEN 10 WHEN name LIKE '%...%' THEN 50 ELSE 65535 END ASC, sort ASC, updated DESC`
- **瓶颈**：由于 SQLite 的 FTS5 虚拟表只有在使用内置的 `rank`（BM25打分）且不含混杂字段排序时，才能利用索引快速返回 Top-N。引入复杂的 `CASE WHEN` 和外部字段（`sort`, `updated`）排序后，SQLite 会被迫执行以下灾难性流程：
  1. 通过 `MATCH` 从倒排索引中匹配出**所有**命中行（可能高达数万条）。
  2. 将这数万条行记录（包括大文本 `content` 和 `markdown`）全部加载进内存临时表。
  3. 逐行计算 `CASE WHEN` 表达式和 `LIKE`，进行内存重排序。
  4. 最后才截取前 N 条（`LIMIT` + `OFFSET`）。
  这对大库搜索构成了毁灭性的延迟和内存浪涌（GC 尖峰）。

### 2. UNINDEXED 字段充当过滤条件
- **现状**：在 FTS 表的创建语句中，`type`, `box`, `path` 被声明为 `UNINDEXED`。但在 `search.go` 构建查询时，却将这些字段拼接在 `MATCH` 的后方：
  `WHERE (blocks_fts MATCH '...') AND type IN (...) AND box = ... AND path LIKE ...`
- **瓶颈**：因为这些字段未被 FTS5 索引化，SQLite 在提取出 MATCH 结果后，必须发生大量的回表或者底层数据块（Block）读取来剥离不符合 `type` 和 `box` 的行。当 MATCH 子句本身的初筛结果集庞大时，二次过滤极其消耗 CPU。

### 3. snippet() 函数与 COUNT(*) 分离计算的开销
- **现状**：不仅 `SELECT` 选取了长达 6 个列的 `snippet(...)` 函数调用，应用还要运行独立的 `fullTextSearchCountByFTS` 进行聚合 `COUNT`。
- **瓶颈**：SQLite 的 `snippet` 函数会在命中结果后再次加载全文本并做实时分词和高亮标记。如果在内存排序前就对全量集求 `snippet`计算开销极大（但通常 SQLite 会在 limit 后计算并推迟此操作，取决于具体的 SQL 优化树执行计划）。而双查（一次搜数据、一次 COUNT）让倒排查找开销直接翻倍。

## 架构级优化方案建议

1. **分离过滤与搜索引擎（双表 JOIN 替代单 FTS 过滤）**
   - 移除 FTS5 表中的 `UNINDEXED` 过滤信息，精简 FTS5 仅用于倒排分词与 `rank` 排序。
   - 过滤条件（如 `type`, `box`, `path`）放到普通 SQLite BTree 索引的表（例如 `blocks` 主表）。改写查询为 JOIN 形式：
     `SELECT ... FROM blocks JOIN blocks_fts ON blocks.id = blocks_fts.id WHERE blocks_fts MATCH '...' AND blocks.type IN (...) ORDER BY blocks_fts.rank`。通过让 SQLite 处理 BTree + FTS 的下推优化，极大缩减回表量。

2. **采用多阶段搜索模型拦截排序（Two-Phase Query）**
   - **第一阶段**：仅使用 `MATCH` 查询匹配条目的 ID 和 `rank`，获取极少的列，带上 LIMIT 200 进行截断。
   - **第二阶段**：拿到这 200 个 ID 后，去主表（`blocks`）拉取完整数据并执行复杂的业务级 `CASE WHEN` 和内存重拍序，再裁剪至 32 条下发给前端。牺牲绝对全局召回排序，换取百倍速度提升，对于全文搜索的商业经验来说是必须的妥协。

3. **分页机制的改良**
   - 将强 `COUNT` 取消（或者缓存某个大致总数），采用游标深度分页或仅显示 "下一页"，能有效砍掉 `fullTextSearchCountByFTS` 这 50% 的多余开销。
