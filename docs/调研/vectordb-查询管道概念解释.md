# 查询管道（Query Pipeline）概念解释

> 本文解释：什么是向量数据库的查询管道，以及为什么 vectordb 缺少它是"最大差距"。

---

## 1. 当前 vectordb 的搜索入口：单层硬编码

目前 vectordb 的搜索调用链只有两层：

```
用户代码 → CollectionHandle.Search() → 引擎.HNSWIndex.Search() / DiskVamanaIndex.Search()
```

看 [`public.go:586-681`](packages/vectordb/public.go:586) 的 `Search` 实现：

```go
func (h *CollectionHandle) Search(query []float32, opts SearchOptions) ([]SearchResult, error) {
    state.mu.RLock()
    defer state.mu.RUnlock()

    // 1. 验证维度
    if len(query) != h.col.Dimension() { return ... }

    // 2. 决定 topK
    topK := opts.TopK
    if topK <= 0 { topK = 10 }

    // 3. 判断是否需要多样化搜索
    diversified := len(opts.ExcludeIDs) > 0 || opts.GroupBy != ""

    // 4. 执行搜索（硬编码调用）
    results, err := h.col.SearchWithError(query, ...)

    // 5. 后处理（与前一步耦合在同一个函数中）
    if diversified {
        // 排除 IDs / 分组 / 阈值过滤
    }
    return filtered, nil
}
```

**所有步骤——候选生成、排除、分组、阈值过滤——都耦合在单一函数中，不可组合、不可扩展、不可替换。**

---

## 2. 什么是查询管道（Query Pipeline）

查询管道将一个搜索请求分解为多个独立的阶段，每个阶段是一个可配置的算子（operator），算子之间通过明确的接口组合。

### 典型的分层结构

```
                 ┌──────────────────────────────────┐
                 │        Query Request             │
                 │  (query_vec, topK, filters, ...) │
                 └──────────┬───────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Query Plan   │  ← 规划层：分析请求，生成执行计划
                    │  (optimizer)   │     (选择引擎、决定搜索策略)
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   Executor     │  ← 执行层：执行向量搜索
                    │  (vector searcher)│   (ANN/HNSW/Vamana/量化搜索)
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │ Post-Processor │  ← 后处理层：重排序/过滤/聚合
                    │  (reranker)    │     (MMR/GroupBy/ScoreThreshold)
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   Response     │  ← 响应组装：投影/分页/序列化
                    └────────────────┘
```

---

## 3. 在实际产品中看到的效果

### 3.1 Qdrant 的例子

Qdrant 的搜索 API 中有明确的 query plan 概念：

```rust
// Qdrant 的 SearchPoints 内部处理链路（伪代码）
fn search_points(request: SearchPoints) -> SearchResponse {
    // 阶段 1: Plan — 解析请求，决定搜索策略
    let plan = QueryPlanner::plan(
        request.vector,
        request.filter,       // 标量过滤
        request.params,       // hnsw_ef, exact 等
        request.limit,        // topK
    );

    // 阶段 2: Execute — 执行向量搜索
    let raw_results = match plan.strategy {
        SearchStrategy::ANN(ef) => graph_search(plan.vector, ef),
        SearchStrategy::Exact => brute_force_search(plan.vector),
    };

    // 阶段 3: Post-process — 过滤 + 重排序
    let filtered = apply_filter(raw_results, plan.post_filter);
    let reranked = if plan.mmr_enabled {
        mmr_rerank(filtered, plan.mmr_lambda)
    } else {
        filtered
    };

    // 阶段 4: Respond — 投影 + 分页
    let projected = project_fields(reranked, plan.select);
    paginate(projected, plan.offset, plan.limit)
}
```

### 3.2 Milvus 的例子

Milvus 的 `query()` vs `search()` 分工本身就是管道化的体现：

```
search(vector, param, filter, limit)
    → QueryPlan:    { ann_field, topk, metric_type, params(ef), expr(filter), output_fields }
    → Executor:     segment → growing segment → sealed segment (每个有不同的搜索策略)
    → Reduce:       merge + rerank (跨 shard 合并)
    → PostProcess:  filter by expr, project fields, paginate
```

### 3.3 Pinecone 的例子

Pinecone 的 `QueryRequest` protobuf 定义：

```protobuf
message QueryRequest {
    bytes vector = 1;           // 查询向量
    uint32 top_k = 2;
    string namespace = 3;       // 命名空间过滤
    string filter = 4;          // 元数据过滤表达式
    bool include_values = 5;    // 投影控制
    bool include_metadata = 6;  // 投影控制
    string id = 7;             // 可选：按 ID 查询而不是向量
    repeated string sparse_vector = 8;  // 稀疏向量
}
```

`id` 字段的存在意味着 Pinecone 的查询管道 **入口决定执行策略**：

```
if request.id 不为空:
    执行 SearchById(query_id, top_k)  // 图是从该节点出发搜索
else:
    执行 SearchByVector(query_vec, top_k)  // 图从 medoid 出发搜索
```

---

## 4. 为什么缺少管道是最大差距（代码层面的证据）

### 4.1 `SearchOptions` 的膨胀趋势

当前 `SearchOptions` 已经体现了管道缺失的症状——所有参数被塞进一个结构体：

```go
type SearchOptions struct {
    TopK           int       // 执行参数
    EfSearch       int       // 执行参数
    ScoreThreshold float32   // 后处理参数
    ExcludeIDs     []string  // 后处理参数
    GroupBy        string    // 后处理参数
    MaxPerGroup    int       // 后处理参数
    CandidateMultiplier int  // 执行参数（影响候选池大小）
}
```

**执行参数和后处理参数被混在一起**。如果没有管道抽象，每次新增功能都需要：

1. 在 `SearchOptions` 加字段
2. 在 `CollectionHandle.Search()` 中加 if 分支
3. 手动管理候选放大逻辑（如 `CandidateMultiplier` 和 `GroupBy` 的互作用）

### 4.2 当前代码中已存在的"伪管道"

实际上 `Search` 方法中已经隐含了管道逻辑，但它是**硬编码的顺序分支**：

```go
// Line 604-617: 简单路径（无多样化）
diversified := len(opts.ExcludeIDs) > 0 || opts.GroupBy != ""
if !diversified {
    results, err := h.col.SearchWithError(query, topK, opts.EfSearch)
    if opts.ScoreThreshold > 0 {  // 后处理嵌入此处
        filtered := results[:0]
        for _, result := range results {
            if result.Score >= opts.ScoreThreshold { filtered = append(...) }
        }
        return filtered, nil
    }
    return results, nil
}

// Line 619-681: 多样化路径——需要手动计算更大的候选池
candidateTopK = topK + len(ExcludeIDs)  // 手动补偿
if GroupBy != "" {
    candidateTopK = topK * multiplier     // 手动放大
}
results, err = h.col.SearchWithError(query, candidateTopK, opts.EfSearch)
// 手动过滤 ExcludeIDs
// 手动分组计数
```

**管道缺失的代价：** 每新增一个后处理算子（如未来的 MMR 或 Score 归一化），`Search()` 函数会继续膨胀，`SearchOptions` 的字段组合爆炸会让候选大小计算变得越来越复杂。

### 4.3 无法实现的条件组合

由于缺少管道，以下场景无法高效实现：

| 场景 | 需要的管道 | 当前能否实现 |
|------|-----------|------------|
| 搜索 → 排除 N 个 ID → MMR 去重 → 分页 | Filter → MMR → Paginate | ❌ |
| 搜索 100 个候选 → 重排序（用不同模型）→ Top-10 | Rerank Executor | ❌ |
| 先用 BBQ 快速搜索 → 再用全精度精确重排 | 混合执行器 | ❌ (虽在 DiskVamana 内部实现，但外部不可配置) |
| 同一查询在不同 segment 用不同策略 | 路由执行器 | ❌ |
| 先向量搜索 → 再用标量过滤扣减（post-filter） | Filter Executor | 排除 |

---

## 5. 管道缺失 vs 标量过滤缺失的区别（澄清）

标量过滤和查询管道是两个不同的维度：

```
向量搜索 = 查询管道中的"一个算子"

查询管道可以包含：
├── VectorSearch (向量搜索) ← 当前只有这个
├── ScalarFilter  (标量过滤) ← 已明确排除
├── Rerank        (重排序)
├── GroupBy       (分组聚合) ← 当前硬编码
├── Exclude       (排除)     ← 当前硬编码
├── Paginate      (分页)
├── Project       (投影/字段选择)
└── HybridFusion  (混合搜索融合)
```

没有管道意味着：**即使标量过滤实现了，它也只能以第四个 if 分支的身份嵌在 `Search()` 中，无法独立配置和组合。**

---

## 6. 最小可行的管道改造方案

不一定要像 Milvus/Qdrant 那样重型。一个最小可行的管道设计可以是：

```go
// 算子接口
type SearchOperator interface {
    Name() string
    Execute(ctx context.Context, input []SearchResult) ([]SearchResult, error)
}

// 构建管道
pipeline := SearchPipeline{
    Operators: []SearchOperator{
        &VectorSearchOp{TopK: 100, EfSearch: 200},      // 执行
        &ExcludeOp{IDs: excludeIDs},                      // 过滤
        &GroupByOp{Field: "doc_id", MaxPerGroup: 1},      // 分组
        &ThresholdOp{MinScore: 0.5},                      // 过滤
        &PaginateOp{Offset: 0, Limit: 10},                // 分页
    },
}
results, err := pipeline.Run(ctx, query)
```

这不需要改动引擎层（`HNSWIndex.Search` / `DiskVamanaIndex.Search` 保持不变），只需要在 `CollectionHandle.Search()` 之上增加一层算子编排。那为什么常见数据库要做架构级的分层？因为它们需要在算子间做**代价优化**（比如先 filter 还是先 search 更高效）、**并行执行**（多个 segment 同时搜索）和**分布式 reduce**（跨节点合并结果）。这些优化在当前的单进程嵌入式场景中不是必需的。
