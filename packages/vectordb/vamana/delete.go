// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package vamana

import (
	"math"
	"sort"
)

// ============================================================================
// VamanaIndex 删除操作 — 完整的 IP-DiskANN 6步边修复算法
//
// 本文件实现与 DiskVamanaIndex.Delete (disk_incremental.go) 一致的边修复逻辑。
// 由于 VamanaIndex 使用 uint32 ID 并直接访问内存切片，而 DiskVamanaIndex
// 使用 uint64 ID 并通过 getVector/getNeighbors/storeNeighbors 方法间接访问，
// 提取公共泛型函数会引入不必要的间接层和性能开销，因此为 VamanaIndex 单独实现。
// 每个辅助函数的注释中标注了对应的 DiskVamanaIndex 方法名，便于对照维护。
// ============================================================================

// inplaceDelete 执行完整的 IP-DiskANN inplace_delete 边修复算法。
//
// 对应 DiskVamanaIndex.inplaceDelete (disk_incremental.go)
// 调用者必须持有 idx.mu 写锁。
func (idx *VamanaIndex) inplaceDelete(p uint32) {
	pVec := idx.vectors[p]
	R := idx.config.R

	// Step 1: 以被删节点向量为 query 执行贪心搜索，获取 Visited 集合和 top-k Candidates
	visited, candidates := idx.deleteGreedySearch(pVec)

	// Step 2: 从 Visited 中找近似入邻居 N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
	approxIn := idx.findApproxInNeighbors(p, visited)

	// Step 3: 修复入边 — 对每个 z ∈ N'_in(p)，用 candidates 中最近的替代节点替换 p
	idx.repairInEdges(p, approxIn, candidates)

	// Step 4: 修复出边 — 对被删节点的每个出邻居 w，添加替代反向连接
	outNeighbors := make([]uint32, len(idx.neighbors[p]))
	copy(outNeighbors, idx.neighbors[p])
	idx.repairOutEdges(p, outNeighbors, candidates)

	// Step 5: 标记删除 + 清空邻居列表
	idx.deleted.Set(p)
	idx.nDeleted++
	idx.neighbors[p] = idx.neighbors[p][:0]

	// Step 6: 对度数超过 R 的受影响顶点执行 robustPruneSimple
	idx.pruneAffectedVertices(p, approxIn, candidates, R)
}

// deleteGreedySearch 以被删节点向量为 query 执行贪心搜索。
// 返回访问过的节点列表和 top-k 候选节点。
//
// 对应 DiskVamanaIndex.deleteGreedySearch (disk_incremental.go)
// 调用者必须持有 idx.mu 写锁（或至少读锁）。
//
// 注意：此方法不使用 idx.greedySearchFast，因为：
// 1. greedySearchFast 内部会获取读锁，而调用者已持有写锁，会导致死锁
// 2. 需要收集 visited 列表（EpochSet 无枚举方法），必须手动追踪
func (idx *VamanaIndex) deleteGreedySearch(queryVec []float32) ([]uint32, []Neighbor) {
	scratch := idx.getScratch()
	defer idx.putScratch(scratch)

	scratch.Visited.EnsureCapacity(len(idx.vectors))
	scratch.Best.SetCapacity(DefaultDeleteSearchL)
	scratch.Reset()

	// 显式追踪已访问节点（EpochSet 无枚举方法）
	visited := make([]uint32, 0, DefaultDeleteSearchL*2)

	queryNormSq := computeNormSquare(queryVec)

	// 从 medoid 入口点开始
	medoid := idx.medoid
	if medoid != math.MaxUint32 && !idx.deleted.Test(medoid) {
		scratch.Visited.Insert(medoid)
		visited = append(visited, medoid)
		dist := idx.fastDistanceToQuery(medoid, queryVec, queryNormSq)
		scratch.Best.Insert(Neighbor{ID: medoid, Distance: dist})
	}

	// 贪心搜索主循环
	for scratch.Best.HasUnvisited() {
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}
		neighbors := idx.neighbors[closest.ID]
		for _, nid := range neighbors {
			if idx.deleted.Test(nid) {
				continue
			}
			if !scratch.Visited.Insert(nid) {
				continue
			}
			visited = append(visited, nid)
			dist := idx.fastDistanceToQuery(nid, queryVec, queryNormSq)
			scratch.Best.Insert(Neighbor{ID: nid, Distance: dist})
		}
	}

	// 收集 top-k 候选（Best 已按距离排序）
	allCandidates := scratch.Best.All()
	k := DefaultDeleteK
	if k > len(allCandidates) {
		k = len(allCandidates)
	}
	candidates := make([]Neighbor, k)
	copy(candidates, allCandidates[:k])

	return visited, candidates
}

// findApproxInNeighbors 从 visited 集合中找到 p 的近似入邻居。
// N'_in(p) = {z ∈ Visited : p ∈ N_out(z)}
//
// 对应 DiskVamanaIndex.findApproxInNeighbors (disk_incremental.go)
func (idx *VamanaIndex) findApproxInNeighbors(p uint32, visited []uint32) []uint32 {
	result := make([]uint32, 0, 16)
	for _, z := range visited {
		if idx.deleted.Test(z) {
			continue
		}
		if containsID(idx.neighbors[z], p) {
			result = append(result, z)
		}
	}
	return result
}

// repairInEdges 实现 Step 3：修复入边。
// 对每个 z ∈ N'_in(p)，找到 candidates 中距离 z 最近的 c 个替代节点，
// 然后从 z 的邻居列表中移除 p 并添加这些替代节点。
//
// 对应 DiskVamanaIndex.repairInEdges (disk_incremental.go)
func (idx *VamanaIndex) repairInEdges(
	p uint32,
	approxIn []uint32, candidates []Neighbor,
) {
	c := DefaultDeleteC

	for _, z := range approxIn {
		if idx.deleted.Test(z) {
			continue
		}
		zVec := idx.vectors[z]

		// 找到 candidates 中距离 x_z 最近的 c 个节点（排除 p 和 z 自身）
		cz := idx.closestCFromCandidates(zVec, z, p, candidates, c)

		// 更新 z 的邻居列表：移除 p，添加 C_z
		current := idx.neighbors[z]
		updated := make([]uint32, 0, len(current)+c)
		for _, n := range current {
			if n != p {
				updated = append(updated, n)
			}
		}
		for _, cand := range cz {
			if !containsID(updated, cand) {
				updated = append(updated, cand)
			}
		}
		idx.neighbors[z] = updated
	}
}

// repairOutEdges 实现 Step 4：修复出边。
// 对被删节点的每个出邻居 w，找到 candidates 中距离 w 最近的 c 个节点 C_w，
// 然后对每个 y ∈ C_w 添加边 y → w。
//
// 对应 DiskVamanaIndex.repairOutEdges (disk_incremental.go)
func (idx *VamanaIndex) repairOutEdges(
	p uint32,
	outNeighbors []uint32, candidates []Neighbor,
) {
	c := DefaultDeleteC

	for _, w := range outNeighbors {
		if idx.deleted.Test(w) {
			continue
		}
		wVec := idx.vectors[w]

		// 找到 candidates 中距离 x_w 最近的 c 个节点
		cw := idx.closestCFromCandidates(wVec, w, p, candidates, c)

		// 对每个 y ∈ C_w：添加边 y → w
		for _, y := range cw {
			yNeighbors := idx.neighbors[y]
			if !containsID(yNeighbors, w) {
				idx.neighbors[y] = append(yNeighbors, w)
			}
		}
	}
}

// closestCFromCandidates 从候选集中返回距离 refVec 最近的 c 个节点 ID，
// 排除 excludeP（被删节点）和 selfID（参考节点自身）。
//
// 对应 DiskVamanaIndex.closestCFromCandidates (disk_incremental.go)
func (idx *VamanaIndex) closestCFromCandidates(
	refVec []float32, selfID uint32, excludeP uint32,
	candidates []Neighbor, c int,
) []uint32 {
	type scored struct {
		id   uint32
		dist float32
	}
	scored_ := make([]scored, 0, len(candidates))

	for _, cand := range candidates {
		if cand.ID == excludeP || cand.ID == selfID {
			continue
		}
		if idx.deleted.Test(cand.ID) {
			continue
		}
		candVec := idx.vectors[cand.ID]
		d := euclideanDistance(refVec, candVec)
		scored_ = append(scored_, scored{id: cand.ID, dist: d})
	}

	sort.Slice(scored_, func(i, j int) bool {
		return scored_[i].dist < scored_[j].dist
	})

	if c > len(scored_) {
		c = len(scored_)
	}
	result := make([]uint32, c)
	for i := 0; i < c; i++ {
		result[i] = scored_[i].id
	}
	return result
}

// pruneAffectedVertices 实现 Step 6：对度数超过 R 的受影响顶点执行 robustPruneSimple。
//
// 对应 DiskVamanaIndex.pruneAffectedVertices (disk_incremental.go)
func (idx *VamanaIndex) pruneAffectedVertices(
	p uint32,
	approxIn []uint32, candidates []Neighbor, R int,
) {
	// 收集去重的受影响顶点
	seen := make(map[uint32]struct{})
	for _, z := range approxIn {
		seen[z] = struct{}{}
	}
	for _, cand := range candidates {
		if cand.ID != p && !idx.deleted.Test(cand.ID) {
			seen[cand.ID] = struct{}{}
		}
	}

	// getVec 回调，供 robustPruneSimple 使用
	getVec := func(id uint64) []float32 {
		uid := uint32(id)
		if int(uid) >= len(idx.vectors) {
			return nil
		}
		return idx.vectors[uid]
	}

	for v := range seen {
		neighbors := idx.neighbors[v]
		if len(neighbors) <= R {
			continue
		}
		vVec := idx.vectors[v]

		// 构建候选列表（排除已删除节点）
		nCands := make([]Neighbor, 0, len(neighbors))
		for _, nid := range neighbors {
			if idx.deleted.Test(nid) {
				continue
			}
			d := euclideanDistance(vVec, idx.vectors[nid])
			nCands = append(nCands, Neighbor{ID: nid, Distance: d})
		}
		pruned := robustPruneSimple(nCands, R, DefaultInsertAlpha, getVec, nil)
		idx.neighbors[v] = pruned
	}
}
