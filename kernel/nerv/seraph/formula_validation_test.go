package seraph

import (
	"fmt"
	"math"
	"testing"
)

func TestNewFormulaNumericalBounds(t *testing.T) {
	cases := []struct {
		name       string
		cInt, cExt float64
		wantLow    float64
		wantHigh   float64
	}{
		{name: "C_int=0 → ρ=0", cInt: 0, cExt: 0.5, wantLow: 0, wantHigh: 0},
		{name: "C_int=0.8 C_ext=0 ρ=0.815", cInt: 0.8, cExt: 0.0, wantLow: 0.81, wantHigh: 0.82},
		{name: "C_int=0.8 C_ext=0.5 ρ=0.965", cInt: 0.8, cExt: 0.5, wantLow: 0.96, wantHigh: 0.97},
		{name: "C_int=0.8 C_ext=0.618 健康稳态 ρ=1.0", cInt: 0.8, cExt: 0.618, wantLow: 0.99, wantHigh: 1.01},
		{name: "C_int=0.8 C_ext=1.0 ρ=1.115", cInt: 0.8, cExt: 1.0, wantLow: 1.11, wantHigh: 1.12},
		{name: "C_int=0.7 低整合", cInt: 0.7, cExt: 0, wantLow: 0.55, wantHigh: 0.56},
		{name: "C_int=0.9 过整合", cInt: 0.9, cExt: 0, wantLow: 2.2, wantHigh: 2.3},
		{name: "C_int=0.5 C_ext=0.5 分裂 → 正值(非背离)", cInt: 0.5, cExt: 0.5, wantLow: 0.32, wantHigh: 0.33},
		{name: "C_int=0.9 C_ext=0.5 高整合+调制", cInt: 0.9, cExt: 0.5, wantLow: 2.45, wantHigh: 2.50},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rho := newFormulaRho(tc.cInt, tc.cExt)
			t.Logf("ρ=%.6f", rho)
			if rho < tc.wantLow || rho > tc.wantHigh {
				t.Errorf("ρ(%f,%f)=%f, want [%f, %f]", tc.cInt, tc.cExt, rho, tc.wantLow, tc.wantHigh)
			}
		})
	}
}

func TestNewFormulaInternalCap(t *testing.T) {
	// C_ext=0 时 ρ 单调递增，C_int→1 时发散
	samples := []float64{0.01, 0.2, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99}
	for _, cInt := range samples {
		rho := newFormulaRho(cInt, 0)
		t.Logf("C_int=%.2f ρ=%.6f", cInt, rho)
	}
	for cInt := 0.001; cInt < 1; cInt += 0.001 {
		rho := newFormulaRho(cInt, 0)
		delta := cInt - 0.80
		base := cInt / (4 * (1 - cInt))
		corr := -0.1854 * math.Exp(-200.0*delta*delta)
		expected := base + corr
		if rho < expected-0.001 || rho > expected+0.001 {
			t.Fatalf("C_ext=0 ρ 应 ≈%.4f, 实际 ρ=%.6f (C_int=%.4f)", expected, rho, cInt)
		}
	}
}

func TestNewFormulaMonotonicity(t *testing.T) {
	// C_int=0.8 时 ρ 随 C_ext 线性递增（修正项贡献，0.925→1.225）
	t.Logf("C_int=0.8, C_ext sweep:")
	prev := math.Inf(-1)
	for cExt := 0.0; cExt <= 1.0; cExt += 0.05 {
		rho := newFormulaRho(0.8, cExt)
		t.Logf("  C_ext=%.2f ρ=%.6f", cExt, rho)
		if rho < prev-1e-9 {
			t.Errorf("C_int=0.8 时 ρ 应随 C_ext 递增: C_ext=%.2f ρ=%f < prev=%f", cExt, rho, prev)
		}
		prev = rho
	}
	// C_ext 固定时 ρ 随 C_int 单调递增
	t.Logf("C_ext=0.5, C_int sweep:")
	prev = math.Inf(-1)
	for cInt := 0.01; cInt <= 0.99; cInt += 0.02 {
		rho := newFormulaRho(cInt, 0.5)
		t.Logf("  C_int=%.2f ρ=%.6f", cInt, rho)
		if rho < prev-1e-9 {
			t.Errorf("ρ 应随 C_int 递增: C_int=%.2f ρ=%f < prev=%f", cInt, rho, prev)
		}
		prev = rho
	}
}

func TestNewFormulaSymmetry(t *testing.T) {
	t.Logf("ρ(0.5,0.5)=%f ρ(0.3,0.7)=%f ρ(0.7,0.3)=%f",
		newFormulaRho(0.5, 0.5), newFormulaRho(0.3, 0.7), newFormulaRho(0.7, 0.3))
}

func newFormulaRho(cInt, cExt float64) float64 {
	clamped := cInt
	if clamped >= 0.9999 {
		clamped = 0.9999
	} else if clamped <= -0.9999 {
		clamped = -0.9999
	}
	absCInt := math.Abs(clamped)
	delta := absCInt - 0.80
	oddsNorm := absCInt / (4 * (1 - absCInt))
	mainGain := 1 + 2.0*cExt*math.Abs(delta)
	corrTerm := 0.3 * (cExt - 0.618) * math.Exp(-200.0*delta*delta)
	mag := oddsNorm*mainGain + corrTerm
	if mag < 0 {
		mag = 0
	}
	if clamped > 0 {
		return mag
	} else if clamped < 0 {
		return -mag
	}
	return 0
}

// --- Pipeline tests: actual computePairSimilarity with mock 30D vectors ---

// makeFacetVec 创建 30 维 facet 向量，取值域 [0,1]（无归一化）
func makeFacetVec(vals [30]float64) map[string]float64 {
	v := make(map[string]float64, 30)
	domains := []string{"N", "E", "O", "A", "C"}
	idx := 0
	for _, d := range domains {
		for i := 1; i <= 6; i++ {
			v[d+fmt.Sprintf("%d", i)] = vals[idx]
			idx++
		}
	}
	return v
}

// vec1 全部 30 维 = v
func vec1(v float64) [30]float64 {
	var a [30]float64
	for i := 0; i < 30; i++ {
		a[i] = v
	}
	return a
}



// sageSet3 构造 3 个向量，三向量在 30 维上均匀取值，使两两归一化欧氏距离 ≈ targetND。
// 设 base=0.6, delta=targetND:
//
//	m = all (base)
//	b = all (base + delta)
//	c = all (base - delta)
//
// 则 dist(m,b) = |delta|×√30, normDist = |delta|, bfSim = 1 - 2×|delta|
//
//	dist(b,c) = 2×|delta|×√30, normDist = 2×|delta|, bfSim = 1 - 4×|delta|
func sageSet3(targetND float64) (m, b, c map[string]float64) {
	if targetND <= 0 {
		base := makeFacetVec(vec1(0.6))
		return base, base, base
	}
	base := 0.6
	delta := targetND
	if delta > 0.4 {
		delta = 0.4
	}
	return makeFacetVec(vec1(base)),
		makeFacetVec(vec1(base + delta)),
		makeFacetVec(vec1(base - delta))
}

func mockStyles() map[ATFEntity]StyleMetrics {
	s := StyleMetrics{TypeTokenRatio: 0.5, AvgSentenceLength: 20, SentenceLengthStd: 5, PunctuationEntropy: 3.0}
	return map[ATFEntity]StyleMetrics{
		EntityMelchior: s, EntityBalthazar: s, EntityCasper: s,
		EntityIntegrated: s, EntityAvatar: s,
	}
}

func buildPBE(m, b, c, i, a map[string]float64) map[ATFEntity]*PersonaBase {
	return map[ATFEntity]*PersonaBase{
		EntityMelchior: {Facets: m}, EntityBalthazar: {Facets: b}, EntityCasper: {Facets: c},
		EntityIntegrated: {Facets: i}, EntityAvatar: {Facets: a},
	}
}

const _alpha = 0.35
const _bfW = 1 - _alpha

func compCInt(pbe map[ATFEntity]*PersonaBase, st map[ATFEntity]StyleMetrics) float64 {
	mb := computePairSimilarity(pbe, st, EntityMelchior, EntityBalthazar, _alpha, _bfW)
	mc := computePairSimilarity(pbe, st, EntityMelchior, EntityCasper, _alpha, _bfW)
	bc := computePairSimilarity(pbe, st, EntityBalthazar, EntityCasper, _alpha, _bfW)
	return ComputeCIntFromTriplet(mb, mc, bc)
}

func compCExt(pbe map[ATFEntity]*PersonaBase, st map[ATFEntity]StyleMetrics) float64 {
	return toUnitInterval(computePairSimilarity(pbe, st, EntityIntegrated, EntityAvatar, _alpha, _bfW))
}

func TestPipeline_AllIdentical(t *testing.T) {
	base := makeFacetVec(vec1(0.7))
	pbe := buildPBE(base, base, base, base, base)
	st := mockStyles()
	cInt := compCInt(pbe, st)
	cExt := compCExt(pbe, st)
	rho := newFormulaRho(cInt, cExt)
	t.Logf("C_int=%.6f C_ext=%.6f ρ=%.2f", cInt, cExt, rho)
	if cInt < 0.99 {
		t.Errorf("C_int=%.6f expected ~1.0", cInt)
	}
	if cExt < 0.99 {
		t.Errorf("C_ext=%.6f expected ~1.0", cExt)
	}
	if rho < 100 {
		t.Errorf("ρ=%.2f expected →∞", rho)
	}
}

func TestPipeline_AvatarOpposite(t *testing.T) {
	base := makeFacetVec(vec1(1))  // 全部 30 维 = 1
	opp := makeFacetVec(vec1(0))   // 全部 30 维 = 0，欧氏距离最大
	pbe := buildPBE(base, base, base, base, opp)
	st := mockStyles()
	cExt := compCExt(pbe, st)
	cInt := compCInt(pbe, st)
	rho := newFormulaRho(cInt, cExt)
	t.Logf("C_int=%.6f C_ext=%.6f ρ=%.6f", cInt, cExt, rho)
	if cExt > 0.36 || cExt < 0.34 {
		t.Errorf("C_ext=%.6f expected ~0.35", cExt)
	}
}

func TestPipeline_Expression(t *testing.T) {
	base := makeFacetVec(vec1(1))
	pbe := buildPBE(base, base, base, base, base)
	cInt := compCInt(pbe, mockStyles())
	for _, ce := range []float64{0, 0.25, 0.5, 1.0} {
		t.Logf("  C_int=%.4f C_ext=%.2f ρ=%.4f", cInt, ce, newFormulaRho(cInt, ce))
	}
	if newFormulaRho(cInt, 0) < 2400 {
		t.Errorf("C_int→1 C_ext=0 → ρ应→∞, 实际ρ=%f", newFormulaRho(cInt, 0))
	}
}

func TestPipeline_SamePairwise(t *testing.T) {
	m, b, c := sageSet3(0.187)
	pbe := buildPBE(m, b, c, m, m)
	cInt := compCInt(pbe, mockStyles())
	rho := newFormulaRho(cInt, cInt)
	t.Logf("[normDist=0.187] C_int=%.6f ρ=%.6f (expect C_int≈0.676)", cInt, rho)
	if cInt > 0.68 || cInt < 0.67 {
		t.Errorf("C_int=%.6f expected ~0.676", cInt)
	}
}

func TestPipeline_HealthyBaseline(t *testing.T) {
	m, b, c := sageSet3(0.231)
	a := makeFacetVec(vec1(0.0))
	pbe := buildPBE(m, b, c, m, a)
	// 三贤人统一样式；Avatar 样式相反，使 styleSim(I,A) ≈ -1
	st := map[ATFEntity]StyleMetrics{
		EntityMelchior:   {TypeTokenRatio: 1, AvgSentenceLength: 100, SentenceLengthStd: 100, PunctuationEntropy: 10},
		EntityBalthazar:  {TypeTokenRatio: 1, AvgSentenceLength: 100, SentenceLengthStd: 100, PunctuationEntropy: 10},
		EntityCasper:     {TypeTokenRatio: 1, AvgSentenceLength: 100, SentenceLengthStd: 100, PunctuationEntropy: 10},
		EntityIntegrated: {TypeTokenRatio: 1, AvgSentenceLength: 100, SentenceLengthStd: 100, PunctuationEntropy: 10},
		EntityAvatar:     {TypeTokenRatio: 0, AvgSentenceLength: 0, SentenceLengthStd: 0, PunctuationEntropy: 0},
	}
	cInt := compCInt(pbe, st)
	cExt := compCExt(pbe, st)
	rho := newFormulaRho(cInt, cExt)
	t.Logf("[internal diff] C_int=%.6f C_ext=%.6f ρ=%.6f", cInt, cExt, rho)
	if cInt > 0.61 || cInt < 0.59 {
		t.Errorf("C_int=%.6f expected ~0.600", cInt)
	}
}

func TestPipeline_AvatarSweep(t *testing.T) {
	m, b, c := sageSet3(0.15)
	st := mockStyles()
	for _, av := range []struct {
		label string
		vec   map[string]float64
	}{
		{"allOne", makeFacetVec(vec1(1.0))},
		{"all0.8", makeFacetVec(vec1(0.8))},
		{"same(m)", makeFacetVec(vec1(0.6))},
		{"all0.4", makeFacetVec(vec1(0.4))},
		{"all0.0", makeFacetVec(vec1(0.0))},
	} {
		pbe := buildPBE(m, b, c, m, av.vec)
		cInt := compCInt(pbe, st)
		cExt := compCExt(pbe, st)
		rho := newFormulaRho(cInt, cExt)
		t.Logf("  %s: C_int=%.4f C_ext=%.4f ρ=%.4f", av.label, cInt, cExt, rho)
	}
}

func TestPipeline_ExtremeSplit(t *testing.T) {
	m := makeFacetVec(vec1(1.0))
	b := makeFacetVec(vec1(0.5))
	c := makeFacetVec(vec1(0.0))
	pbe := buildPBE(m, b, c, m, m)
	cInt := compCInt(pbe, mockStyles())
	rho := newFormulaRho(cInt, cInt)
	t.Logf("[extreme split] C_int=%.6f ρ=%.6f (expect C_int≈-0.333)", cInt, rho)
	if cInt > -0.32 || cInt < -0.34 {
		t.Errorf("C_int=%.6f expected ~-0.333", cInt)
	}
}
