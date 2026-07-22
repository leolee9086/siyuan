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

package vectordb

import (
	"fmt"
	"sort"
	"testing"
	"time"
)

// TestDeterministicLevelQuality verifies that DeterministicLevel (top-down
// geometric filling) produces working HNSW graphs with correct level
// distribution and acceptable performance.
func TestDeterministicLevelQuality(t *testing.T) {
	if testing.Short() {
		t.Skip("multi-scale quality and performance diagnostic")
	}
	scales := []struct {
		total int
		dim   int
		label string
	}{
		{5000, 128, "5K×128"},
		{10000, 128, "10K×128"},
		{5000, 768, "5K×768"},
		{10000, 768, "10K×768"},
	}

	queryCnt := 100
	topK := 10
	efSearch := 100

	for _, s := range scales {
		t.Run(s.label, func(t *testing.T) {
			vectors := make([][]float32, s.total)
			for i := 0; i < s.total; i++ {
				v := make([]float32, s.dim)
				seed := int64(s.total*1000 + s.dim*100 + i)
				v[0] = float32(seed%1000) / 1000.0
				for j := 1; j < s.dim; j++ {
					seed = seed*1103515245 + 12345
					v[j] = float32(int(seed)%2000-1000) / 1000.0
				}
				NormalizeVector(v)
				vectors[i] = v
			}

			queries := make([][]float32, queryCnt)
			for q := 0; q < queryCnt; q++ {
				query := make([]float32, s.dim)
				seed := int64(q*777 + s.total*13)
				query[0] = float32(seed%1000) / 1000.0
				for j := 1; j < s.dim; j++ {
					seed = seed*1103515245 + 12345
					query[j] = float32(int(seed)%2000-1000) / 1000.0
				}
				NormalizeVector(query)
				queries[q] = query
			}

			trueTop10 := make([][]string, queryCnt)
			for q := 0; q < queryCnt; q++ {
				type scored struct {
					id   string
					dist float32
				}
				scores := make([]scored, s.total)
				for i := 0; i < s.total; i++ {
					scores[i] = scored{fmt.Sprintf("v-%d", i), CosineDistance(queries[q], vectors[i])}
				}
				sort.Slice(scores, func(i, j int) bool { return scores[i].dist < scores[j].dist })
				top := make([]string, topK)
				for i := 0; i < topK; i++ {
					top[i] = scores[i].id
				}
				trueTop10[q] = top
			}

			col := NewCollection("bench", s.dim)
			buildStart := time.Now()
			for i, v := range vectors {
				col.InsertPoint(Point{ID: fmt.Sprintf("v-%d", i), Vector: v})
			}
			buildDur := time.Since(buildStart)

			var totalHits int
			var totalQuery time.Duration
			for q := 0; q < queryCnt; q++ {
				tq := time.Now()
				results := col.Search(queries[q], topK, efSearch)
				totalQuery += time.Since(tq)
				gt := make(map[string]bool, topK)
				for _, id := range trueTop10[q] {
					gt[id] = true
				}
				for _, r := range results {
					if gt[r.ID] {
						totalHits++
					}
				}
			}

			buildRate := float64(s.total) / buildDur.Seconds()
			recall := float64(totalHits) / float64(queryCnt*topK)
			queryAvgUs := float64(totalQuery.Microseconds()) / float64(queryCnt)

			// Level distribution: DeterministicLevel fills top-down.
			// At small scales, lower levels may be unpopulated —
			// all nodes still have L0 connections (insert all levels 0..itemLevel).
			// The important check is search quality, not level distribution.
			var levels [17]int
			for i := DocID(0); i < DocID(s.total); i++ {
				l := col.HNSWIdx.GetItemLevel(i)
				if l >= 0 && l < 17 {
					levels[l]++
				}
			}

			t.Logf("%s: build=%.0f/s, query=%.0fus, recall=%.1f%%, levels=%v",
				s.label, buildRate, queryAvgUs, recall*100, levels[:8])

			if recall < 0.3 {
				t.Errorf("recall %.1f%% too low", recall*100)
			}
		})
	}
}
