package hnsw

import (
	"math"
	"math/rand"
	"testing"
)

func TestBiasByEfSearch(t *testing.T) {
	requireDiagnosticTest(t)

	const personaCount = 200
	const memCount = 5000
	const dim = 128
	const M = 16
	const maxLevel = 16
	const k = 10
	const efConstruction = 100
	const queryCount = 50

	seed := int64(42)
	total := personaCount + memCount
	rng := rand.New(rand.NewSource(seed))

	personaVecs := make([][]float32, personaCount)
	for i := range personaVecs {
		personaVecs[i] = make([]float32, dim)
		for j := range personaVecs[i] {
			personaVecs[i][j] = float32(rng.NormFloat64() * 0.5)
		}
		personaVecs[i][0] += 5
	}

	memVecs := make([][]float32, memCount)
	for i := range memVecs {
		memVecs[i] = make([]float32, dim)
		for j := range memVecs[i] {
			memVecs[i][j] = float32(rng.NormFloat64())
		}
	}

	personaCentroid := make([]float32, dim)
	for _, v := range personaVecs {
		for j := range v {
			personaCentroid[j] += v[j]
		}
	}
	for j := range personaCentroid {
		personaCentroid[j] /= float32(personaCount)
	}

	memToPersona := make([]float32, memCount)
	for i, v := range memVecs {
		var dist float32
		for j := range v {
			d := v[j] - personaCentroid[j]
			dist += d * d
		}
		memToPersona[i] = float32(math.Sqrt(float64(dist)))
	}

	var globalDist float64
	for _, d := range memToPersona {
		globalDist += float64(d)
	}
	globalMean := globalDist / float64(memCount)

	queries := make([][]float32, queryCount)
	for i := range queries {
		queries[i] = make([]float32, dim)
		queries[i][0] = float32(-3.0 + rng.NormFloat64()*0.5)
		for j := 1; j < dim; j++ {
			queries[i][j] = float32(rng.NormFloat64())
		}
	}

	cfg := Config{
		M: M, EfConstruction: efConstruction, EfSearch: 64,
		MaxLevel: maxLevel, MetricType: "l2",
	}

	for _, alpha := range []float32{0, 0.001, 0.005, 0.01} {
		cfg.ContaminationAlpha = alpha
		dist := newMockDistancer(euclideanDistance)
		idx := NewHNSWIndex(dim, cfg, dist)
		for i, v := range personaVecs {
			dist.AddVector(DocID(i), v)
		}
		for i, v := range memVecs {
			dist.AddVector(DocID(personaCount+i), v)
		}
		for i := 0; i < total; i++ {
			idx.Insert(DocID(i))
		}

		t.Logf("alpha=%.3f:", alpha)
		t.Logf("  efSearch | dist | bias%% | mem / persona")
		for _, efSearch := range []int{10, 32, 100, 200} {
			var distSum float64
			var distCount int
			var personaHits int
			for _, qv := range queries {
				for _, r := range idx.Search(qv, k, efSearch) {
					if r.ID >= DocID(personaCount) {
						distSum += float64(memToPersona[int(r.ID)-personaCount])
						distCount++
					} else {
						personaHits++
					}
				}
			}
			if distCount == 0 {
				t.Logf("    %3d   | --- | --- | 0 / %d (all persona)", efSearch, personaHits)
				continue
			}
			meanDist := distSum / float64(distCount)
			bias := (meanDist - globalMean) / globalMean * 100
			t.Logf("    %3d   | %.2f | %+.1f | %d / %d", efSearch, meanDist, bias, distCount, personaHits)
		}
	}
}
