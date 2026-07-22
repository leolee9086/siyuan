package hnsw

import (
	"math"
	"math/rand"
	"testing"
	"time"
)

func TestEfSearchNeighborhoodConstraint(t *testing.T) {
	if testing.Short() {
		t.Skip("multi-scale neighborhood quality test")
	}
	const dim = 128
	const M = 16
	const efConstruction = 100
	const maxLevel = 12
	const k = 10
	const queryCount = 50

	efSearchValues := []int{8, 16, 32, 64, 128, 200}

	scales := []struct {
		total int
		label string
	}{{5000, "5K"}, {10000, "10K"}}

	for _, s := range scales {
		t.Run(s.label, func(t *testing.T) {
			rng := rand.New(rand.NewSource(int64(s.total)))

			vectors := make([][]float32, s.total)
			for i := range vectors {
				vectors[i] = make([]float32, dim)
				for j := range vectors[i] {
					vectors[i][j] = float32(rng.Float64()*2 - 1)
				}
			}

			queries := make([][]float32, queryCount)
			for i := range queries {
				queries[i] = make([]float32, dim)
				for j := range queries[i] {
					queries[i][j] = float32(rng.Float64()*2 - 1)
				}
			}

			cfg := Config{
				M: M, EfConstruction: efConstruction, EfSearch: 64,
				MaxLevel: maxLevel, MetricType: "l2",
				LevelML: 1.0 / math.Log(float64(M)),
			}

			dist := newMockDistancer(euclideanDistance)
			idx := NewHNSWIndex(dim, cfg, dist)

			buildStart := time.Now()
			for i := 0; i < s.total; i++ {
				dist.AddVector(DocID(i), vectors[i])
				idx.Insert(DocID(i))
			}
			buildDur := time.Since(buildStart)
			t.Logf("build: %d nodes, %.0f nodes/s", s.total, float64(s.total)/buildDur.Seconds())

			anchors := make(map[DocID]bool)
			for d := DocID(0); d < DocID(s.total); d++ {
				if idx.GetItemLevel(d) > 0 {
					anchors[d] = true
				}
			}
			t.Logf("anchors (L1+): %d / %d (%.1f%%)", len(anchors), s.total, float64(len(anchors))/float64(s.total)*100)

			hasAnchorEdge := make(map[DocID]bool)
			totalWithAnchor := 0
			for d := DocID(0); d < DocID(s.total); d++ {
				if anchors[d] {
					continue
				}
				for _, nb := range idx.GetLevelNeighborRecords(d, 0) {
					if anchors[nb.ID] {
						hasAnchorEdge[d] = true
						totalWithAnchor++
						break
					}
				}
			}
			nonAnchorCount := s.total - len(anchors)
			globalFrac := float64(totalWithAnchor) / float64(nonAnchorCount)
			t.Logf("global: %.1f%% of non-anchor have L0 edge to anchor (%d/%d)",
				globalFrac*100, totalWithAnchor, nonAnchorCount)

			t.Logf("efSearch | constrained_in_topK | bias")
			for _, efSearch := range efSearchValues {
				var constrained, totalInTopK int
				for _, qv := range queries {
					results := idx.Search(qv, k, efSearch)
					for _, r := range results {
						if hasAnchorEdge[r.ID] && !anchors[r.ID] {
							constrained++
						}
						totalInTopK++
					}
				}

				observedFrac := float64(constrained) / float64(totalInTopK)
				bias := (observedFrac - globalFrac) / globalFrac * 100
				t.Logf("  %3d   |  %.1f%%              | %+.1f%%", efSearch, observedFrac*100, bias)

				if efSearch <= 16 && bias <= 0 {
					t.Logf("  efSearch=%d: no positive bias — level assignment random, anchoring weak", efSearch)
				}
				if efSearch >= 128 {
					absBias := bias
					if absBias < 0 {
						absBias = -absBias
					}
					if absBias > 5 {
						t.Logf("  efSearch=%d: residual bias %.1f%% > 5%%", efSearch, bias)
					}
				}
			}
		})
	}
}
