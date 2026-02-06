# IP-DiskANN增量操作实现审阅报告

> 审阅时间: 2026-02-06
> 审阅文件: `kernel/vectordb/vamana/disk_incremental.go` (465行)
> 参考实现: `toread/IP-DiskANN/src/index.cpp` inplace_delete (L3130-3303)

---

## 1. Insert 操作 ✅ 正确实现

### Go实现 (L127-179)
```go
func (idx *DiskVamanaIndex) Insert(vector []float32) (uint64, error)
```

**流程对比**:
| 步骤 | IP-DiskANN | Go实现 | 状态 |
|------|------------|--------|------|
| 1. 验证维度 | ✅ | ✅ L149-152 | ✅ |
| 2. 分配新ID | `reserve_location()` | `totalPoints()` | ✅ 等效 |
| 3. GreedySearch找邻居 | `search_for_point_and_prune()` | `findNeighborsForInsert()` L158 | ✅ |
| 4. RobustPrune | `prune_neighbors()` | `robustPruneForInsert()` L162 | ✅ |
| 5. 存储向量 | `_data_store->set_vector()` | `appendVectors` buffer L167 | ✅ |
| 6. 添加回边 | `inter_insert()` | `addBackEdgesForInsert()` L176 | ✅ |
| 7. BBQ元数据 | N/A (IP用PQ) | `appendBBQForInsert()` L172 | ✅ 增强 |

**结论**: Insert实现完整正确，与IP-DiskANN算法一致。

---

## 2. Delete 操作 ⚠️ 存在差异

### IP-DiskANN `inplace_delete` 算法 (L3130-3303)
```cpp
int inplace_delete(tag, l_d=128, k=50, c=3)
```

**完整算法步骤**:
1. **GreedySearch**: 以被删除点x_p为查询，搜索 `l_d` 跳，获取 `Visited` 和 `Candidates`
2. **找近似入边 N'_in(p)**: `{z ∈ Visited : p ∈ N_out(z)}` —— 即Visited中哪些点的出边指向p
3. **修复入边**: 对每个 `z ∈ N'_in(p)`:
   - 在Candidates中找最近c个点到z的候选集 `C_z`
   - `N_out(z) ← N_out(z) ∪ C_z \ {p}`
4. **修复出边**: 对每个 `w ∈ N_out(p)`:
   - 找最近c个候选点 `C_w`
   - 对每个 `y ∈ C_w`: 添加边 `y → w`
5. **标记删除**: `_delete_set->insert(p)`
6. **修复超出度数**: RobustPrune

### Go实现 `Delete` + `oneHopRepair` (L361-464)

**当前算法步骤**:
1. 验证节点存在且未删除
2. 获取被删除节点的邻居列表 `neighbors`
3. 标记删除 `deleted.MarkDeleted(nodeID)`
4. **OneHop修复**: 对每个邻居N:
   - 从N的邻居列表中移除被删除节点
   - 将被删除节点的**其他邻居**加入N的邻居列表
   - 如超过R度，RobustPrune

### ⚠️ 关键差异分析

| 特性 | IP-DiskANN | Go实现 | 差异影响 |
|------|------------|--------|----------|
| **入边发现** | GreedySearch找Visited集合 | 只处理直接出边邻居 | **中等** |
| **候选集来源** | GreedySearch的全局Candidates | 被删除点的直接邻居 | **中等** |
| **搜索参数** | `l_d=128, k=50, c=3` 可调 | 无额外搜索参数 | 低 |
| **入边修复范围** | 全图近似入边 | 仅直接邻居 | **中等** |

### ❌ 必须修复

当前实现**不符合**IP-DiskANN算法规格，必须完全复现。

---

## 修复规格：完整IP-DiskANN `inplace_delete` 算法

参考: `toread/IP-DiskANN/src/index.cpp` L3130-3303

### 算法参数
```
l_d = 128  // GreedySearch搜索深度
k = 50     // 取最近k个候选点
c = 3      // 每个邻居添加最近c个替代边
```

### 完整算法步骤

**Step 1: GreedySearch获取候选集**
```
输入: 被删除点 p, 搜索参数 l_d, k
操作: 以 x_p 为查询向量执行GreedySearch(l_d)
输出: 
  - Visited: 搜索过程中访问的所有节点集合
  - Candidates: 搜索结果中最近的k个点
```

**Step 2: 找近似入边 N'_in(p)**
```
N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
解释: Visited集合中，哪些点的出边指向p
```

**Step 3: 修复入边 (对每个 z ∈ N'_in(p))**
```
for z in N'_in(p):
    if z is deleted: continue
    
    # 在Candidates中找距离z最近的c个点
    C_z = closest_c_points(x_z, Candidates, exclude={p, z})
    
    # 更新z的邻居: 移除p，添加C_z
    N_out(z) = (N_out(z) \ {p}) ∪ C_z
```

**Step 4: 修复出边 (对每个 w ∈ N_out(p))**
```
for w in N_out(p):
    if w is deleted: continue
    
    # 在Candidates中找距离w最近的c个点
    C_w = closest_c_points(x_w, Candidates, exclude={p, w})
    
    # 添加反向边: 每个y ∈ C_w都添加指向w的边
    for y in C_w:
        N_out(y) = N_out(y) ∪ {w}
```

**Step 5: 标记删除**
```
deleted.MarkDeleted(p)
清空 N_out(p)
```

**Step 6: 修复超出度数**
```
affected_vertices = N'_in(p) ∪ Candidates
for v in affected_vertices:
    if len(N_out(v)) > R:
        N_out(v) = RobustPrune(v, N_out(v), R, α)
```

### 关键差异对比

| 步骤 | IP-DiskANN | 当前Go实现 | 修复要求 |
|------|------------|------------|----------|
| 入边发现 | GreedySearch(l_d=128)找Visited | ❌ 无 | **必须添加** |
| 候选集 | 全局k=50最近候选 | ❌ 仅直接邻居 | **必须修改** |
| 入边修复 | 遍历N'_in(p) | ❌ 无 | **必须添加** |
| 出边修复 | 添加反向边y→w | ⚠️ 仅直接邻居互连 | **必须修改** |
| 度数修复 | 全局affected_vertices | ✅ 只修复直接邻居 | 扩展范围 |

### 函数签名变更

```go
// 当前签名 (需保持兼容)
func (idx *DiskVamanaIndex) Delete(nodeID uint64) error

// 使用默认参数调用完整算法
// l_d=128, k=50, c=3
```

### 需要修改的函数

1. **findNeighborsForInsert** → 需要额外返回Visited集合
2. **Delete** → 完全重写，实现完整6步算法
3. **删除oneHopRepair** → 不再使用简化版

---

## 3. Compact 操作 ✅ 正确实现

`incremental.go` L711-807 实现了完整的压缩合并:
- 收集非删除节点
- 重映射ID
- 写入新索引文件

---

## 4. 缺失功能清单

| 功能 | IP-DiskANN | Go实现 | 优先级 |
|------|------------|--------|--------|
| Tag双向映射 | `tag_to_location` + `location_to_tag` | ❌ 无 | P1 |
| 批量删除 | `inplace_delete(vector<TagT>)` | ❌ 无 | P2 |
| 并发读写锁 | `_update_lock`, `_tag_lock`, `_delete_lock` | ✅ 单一`mu`锁 | P2 |
| 动态扩容 | `resize()` | ❌ 无 | P2 |
| 冻结点(Frozen Points) | `_num_frozen_pts` | ❌ 无 | P3 |

---

## 5. 总体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| **算法正确性** | 8/10 | Insert完全正确，Delete使用简化版OneHop |
| **代码质量** | 9/10 | 结构清晰，注释完善，Go风格良好 |
| **功能完整度** | 7/10 | 核心增量操作完成，Tag映射待添加 |
| **性能考量** | 8/10 | BBQ集成，append buffer优化 |

**结论**: 实现质量良好，核心算法正确。Delete算法为简化版OneHop，在大多数场景下可用，如需更高召回率可考虑增强为完整IP-DiskANN算法。
