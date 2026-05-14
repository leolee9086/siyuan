package seraph

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

// TestCalibrateEMThreshold 蒙特卡罗模拟标定 EM 告警阈值。
// 输出：每个 σ 级别下的平均 max_facet_deviation、平均 C_int、平均 ρ。
// 结论阈值：ρ≈1.0 时对应的 max_facet_deviation（即 MaxLambda）。
func TestCalibrateEMThreshold(t *testing.T) {
	baseline := marduk.GetReiPreset().PersonaBase.Facets
	if len(baseline) != 30 {
		t.Fatalf("expected 30 facets, got %d", len(baseline))
	}

	rng := rand.New(rand.NewSource(42))

	const (
		cExt    = 0.25
		alpha   = 0.10
		bfW     = 1 - alpha
		style   = 1.0
		samples = 5000
	)

	fmt.Println("sigma\tmax_dev_avg\tmax_dev_p90\tc_int_avg\trho_avg\tstd_bf_avg")
	for sigma := 0.0; sigma <= 0.30; sigma += 0.005 {
		var sumMaxDev, sumCInt, sumRho, sumStdBF float64
		maxDevP90Idx := int(float64(samples) * 0.90)
		maxDevs := make([]float64, samples)

		for i := 0; i < samples; i++ {
			pbs := make([]*PersonaBase, 3)
			maxDev := 0.0
			for j := 0; j < 3; j++ {
				facets := make(map[string]float64, 30)
				for k, v := range baseline {
					noise := (rng.Float64()*2 - 1) * sigma
					nv := v + noise
					if nv < 0 {
						nv = 0
					}
					if nv > 1 {
						nv = 1
					}
					facets[k] = nv
					dev := math.Abs(nv - v)
					if dev > maxDev {
						maxDev = dev
					}
				}
				pbs[j] = &PersonaBase{Facets: facets, Traits: nil}
			}

			bf01 := ComputeBigFiveSimilarity(pbs[0], pbs[1], nil)
			bf02 := ComputeBigFiveSimilarity(pbs[0], pbs[2], nil)
			bf12 := ComputeBigFiveSimilarity(pbs[1], pbs[2], nil)

			rc01 := alpha*style + bfW*bf01
			rc02 := alpha*style + bfW*bf02
			rc12 := alpha*style + bfW*bf12

			cInt := ComputeCIntFromTriplet(rc01, rc02, rc12)
			rho := ComputeSyncRateFromParts(cInt, cExt)

			bfAvg := (bf01 + bf02 + bf12) / 3.0
			stdBF := math.Sqrt(((bf01-bfAvg)*(bf01-bfAvg) + (bf02-bfAvg)*(bf02-bfAvg) + (bf12-bfAvg)*(bf12-bfAvg)) / 3.0)

			sumMaxDev += maxDev
			sumStdBF += stdBF
			sumCInt += cInt
			sumRho += rho.Value
			maxDevs[i] = maxDev
		}

		avgMaxDev := sumMaxDev / float64(samples)
		avgCInt := sumCInt / float64(samples)
		avgRho := sumRho / float64(samples)
		avgStdBF := sumStdBF / float64(samples)

		sort.Float64s(maxDevs)
		p90 := maxDevs[maxDevP90Idx]

		fmt.Printf("%.3f\t%.6f\t%.6f\t%.6f\t%.6f\t%.6f\n", sigma, avgMaxDev, p90, avgCInt, avgRho, avgStdBF)
	}
}
