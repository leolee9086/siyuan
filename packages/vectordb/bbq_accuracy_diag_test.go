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

// 本文件由 kernel/vectordb/bbq_accuracy_diag_test.go 移植，
// 导入路径已适配 packages/vectordb 的独立模块结构。

package vectordb

import (
	"math"
	"math/rand"
	"sort"
	"testing"
	"time"

	"s-forge.local/vectordb/bbq"
)

// TestBBQ_RebuildStrategy 对比 Eager（每次重新量化全部）和 Rebuild（间隔重量化）两种策略
// 在增量数据集上的召回率和性能差异。
func TestBBQ_RebuildStrategy(t *testing.T) {
	const dim = 128
	const N = 5000
	const K = 10
	const nq = 15

	rng := rand.New(rand.NewSource(42))
	vectors := make([][]float32, N)
	for i := 0; i < N; i++ {
		vectors[i] = make([]float32, dim)
		for j := 0; j < dim; j++ {
			vectors[i][j] = float32(rng.NormFloat64()*50 + 128)
		}
	}
	queries := make([][]float32, nq)
	for i := 0; i < nq; i++ {
		queries[i] = make([]float32, dim)
		for j := 0; j < dim; j++ {
			queries[i][j] = float32(rng.NormFloat64()*50 + 128)
		}
	}

	qzer := bbq.NewScalarQuantizer(bbq.EuclideanDistance)
	scorer := bbq.NewQuantizedScorer(bbq.EuclideanDistance)

	exactD := make([][]float32, nq)
	for qi, q := range queries {
		exactD[qi] = make([]float32, N)
		for i := 0; i < N; i++ {
			exactD[qi][i] = l2Sq(vectors[i], q)
		}
	}

	checkpoints := []int{10, 50, 100, 500, 1000, 2500, N}

	// ---- Eager ----
	type result struct {
		recall  float64
		quantNs int64
	}
	eagerRes := make([]result, len(checkpoints))
	{
		cent := make([]float32, dim)
		sum := make([]float64, dim)
		codes := make([]bbqCoded, N)
		cp := 0
		for i := 0; i < N; i++ {
			for j := 0; j < dim; j++ {
				sum[j] += float64(vectors[i][j])
			}
			inv := 1.0 / float64(i+1)
			for j := 0; j < dim; j++ {
				cent[j] = float32(sum[j] * inv)
			}
			t0 := time.Now()
			codes[i] = quantizeOne(qzer, vectors[i], cent, dim)
			eagerRes[cp].quantNs += time.Since(t0).Nanoseconds()

			if cp < len(checkpoints) && i+1 == checkpoints[cp] {
				n := i + 1
				var r float64
				for qi, q := range queries {
					qc := quantizeOne(qzer, q, cent, dim)
					r += bbqTopK(scorer, qc, codes[:n], exactD[qi][:n], dim, K)
				}
				eagerRes[cp].recall = r / float64(len(queries))
				cp++
			}
		}
	}

	// ---- Rebuild (golden ratio 0.618) ----
	rebuildRes := make([]result, len(checkpoints))
	{
		cent := make([]float32, dim)
		sum := make([]float64, dim)
		codes := make([]bbqCoded, N)
		var lastRebuild int
		var rebuildCount int
		cp := 0
		for i := 0; i < N; i++ {
			for j := 0; j < dim; j++ {
				sum[j] += float64(vectors[i][j])
			}
			inv := 1.0 / float64(i+1)
			for j := 0; j < dim; j++ {
				cent[j] = float32(sum[j] * inv)
			}

			shouldRebuild := lastRebuild == 0 || float64(i+1) >= float64(lastRebuild)*1.618
			t0 := time.Now()
			if shouldRebuild {
				for k := 0; k <= i; k++ {
					codes[k] = quantizeOne(qzer, vectors[k], cent, dim)
				}
				lastRebuild = i + 1
				rebuildCount++
			} else {
				codes[i] = quantizeOne(qzer, vectors[i], cent, dim)
			}
			rebuildRes[cp].quantNs += time.Since(t0).Nanoseconds()

			if cp < len(checkpoints) && i+1 == checkpoints[cp] {
				n := i + 1
				var r float64
				for qi, q := range queries {
					qc := quantizeOne(qzer, q, cent, dim)
					r += bbqTopK(scorer, qc, codes[:n], exactD[qi][:n], dim, K)
				}
				rebuildRes[cp].recall = r / float64(len(queries))
				cp++
			}
		}
		t.Logf("Total rebuilds: %d", rebuildCount)
	}

	t.Logf("%-6s %-8s %-10s %-8s %-10s %-6s", "N", "eager%", "eager_ns", "rb%", "rb_ns", "slowdn")
	for i := range checkpoints {
		er := eagerRes[i].recall * 100
		rr := rebuildRes[i].recall * 100
		slowdown := float64(rebuildRes[i].quantNs) / float64(maxInt64(eagerRes[i].quantNs, 1))
		t.Logf("%-6d %-8.1f %-10d %-8.1f %-10d %-6.1fx",
			checkpoints[i], er, eagerRes[i].quantNs, rr, rebuildRes[i].quantNs, slowdown)
	}
}

var _ = math.Log
var _ = rand.New

type bbqCoded struct {
	packed []byte
	corr   bbq.QuantizationResult
}

func quantizeOne(q *bbq.ScalarQuantizer, vec, centroid []float32, dim int) bbqCoded {
	raw := make([]byte, dim)
	corr := q.Quantize(vec, raw, 1, centroid)
	return bbqCoded{bbq.PackBinary(raw), corr}
}

func bbqTopK(scorer *bbq.QuantizedScorer, query bbqCoded, codes []bbqCoded, exact []float32, dim int, K int) float64 {
	n := len(codes)
	pred := make([]pair, n)
	for i := 0; i < n; i++ {
		dp := bbq.ComputePackedDotProduct(query.packed, codes[i].packed)
		pred[i] = pair{i, scorer.ComputeQuantizedDistance(dp, query.corr, codes[i].corr, dim, 0, false)}
	}
	sort.Slice(pred, func(i, j int) bool { return pred[i].dist < pred[j].dist })
	return recallTopK(pred, exact, K)
}

func recallTopK(pred []pair, exact []float32, K int) float64 {
	n := len(exact)
	es := make([]pair, n)
	for i := range exact {
		es[i] = pair{i, exact[i]}
	}
	sort.Slice(es, func(i, j int) bool { return es[i].dist < es[j].dist })
	gt := make(map[int]bool, K)
	for k := 0; k < K; k++ {
		gt[es[k].idx] = true
	}
	hits := 0
	for k := 0; k < K && k < len(pred); k++ {
		if gt[pred[k].idx] {
			hits++
		}
	}
	return float64(hits) / float64(K)
}

func l2Sq(a, b []float32) float32 {
	var s float32
	for i := range a {
		d := a[i] - b[i]
		s += d * d
	}
	return s
}

type pair = struct {
	idx  int
	dist float32
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
