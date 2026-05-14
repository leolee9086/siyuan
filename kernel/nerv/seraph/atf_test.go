package seraph

import (
	"math"
	"testing"
)

func TestComputeStyleMetrics(t *testing.T) {
	text := "这是一个测试文本。它包含多个句子！用于测试文体指纹计算？"
	metrics, err := ComputeStyleMetrics(text)
	if err != nil {
		t.Fatalf("ComputeStyleMetrics 返回错误: %v", err)
	}

	if metrics.TypeTokenRatio <= 0 || metrics.TypeTokenRatio > 1 {
		t.Errorf("TypeTokenRatio超出范围: %f", metrics.TypeTokenRatio)
	}
	if metrics.AvgSentenceLength <= 0 {
		t.Errorf("AvgSentenceLength应该大于0: %f", metrics.AvgSentenceLength)
	}
}

func TestComputeStyleSimilarity(t *testing.T) {
	s1 := StyleMetrics{
		TypeTokenRatio:     0.8,
		AvgSentenceLength:  20.0,
		SentenceLengthStd:  5.0,
		PunctuationEntropy: 2.0,
	}
	s2 := StyleMetrics{
		TypeTokenRatio:     0.8,
		AvgSentenceLength:  20.0,
		SentenceLengthStd:  5.0,
		PunctuationEntropy: 2.0,
	}

	sim := ComputeStyleSimilarity(s1, s2)
	if math.Abs(sim-1.0) > 0.1 {
		t.Errorf("相同指纹的相似度应该接近1.0，实际: %f", sim)
	}
}

func TestComputeBigFiveSimilarity(t *testing.T) {
	p1 := &PersonaBase{
		Traits: map[string]float64{"O": 0.5, "C": 0.6, "E": 0.7, "A": 0.8, "N": 0.4},
		Facets: map[string]float64{
			"O1_Imagination":  0.5,
			"C1_SelfEfficacy": 0.6,
		},
	}
	p2 := &PersonaBase{
		Traits: map[string]float64{"O": 0.5, "C": 0.6, "E": 0.7, "A": 0.8, "N": 0.4},
		Facets: map[string]float64{
			"O1_Imagination":  0.5,
			"C1_SelfEfficacy": 0.6,
		},
	}

	sim := ComputeBigFiveSimilarity(p1, p2, nil)
	if math.Abs(sim-1.0) > 0.01 {
		t.Errorf("相同PersonaBase的相似度应该接近1.0，实际: %f", sim)
	}
}

func TestComputeSyncRateFromParts(t *testing.T) {
	tests := []struct {
		name         string
		cInt, cExt   float64
		expRho       float64
		expZone      string
	}{
		{"健康稳态 C_int=0.8 C_ext=0.618", 0.8, 0.618, 1.0, "resonance"},
		{"内部分裂 C_int→0（无方向背离，不转负）", 0, 1, 0, "dispersion"},
		{"C_int=0.8 C_ext=0 → ρ≈0.815", 0.8, 0, 0.815, "resonance"},
		{"内部全一致+外部全一致", 0.9999, 1, 3499.15, "dissolution"},
		{"C_int=0.8 C_ext=1 → ρ≈1.115", 0.8, 1.0, 1.115, "resonance"},
		{"C_int=0.5 C_ext=0.5（无方向背离，ρ>0）", 0.5, 0.5, 0.325, "dispersion"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sr := ComputeSyncRateFromParts(tt.cInt, tt.cExt)
			t.Logf("C_int=%.4f C_ext=%.4f ρ=%.6f zone=%s", tt.cInt, tt.cExt, sr.Value, sr.Zone)
			if math.Abs(sr.Value-tt.expRho) > 0.01 {
				t.Errorf("ρ: 期望%.4f, 实际%.4f", tt.expRho, sr.Value)
			}
			if sr.Zone != tt.expZone {
				t.Errorf("分区: 期望%s, 实际%s", tt.expZone, sr.Zone)
			}
		})
	}
}

func TestComputeATFStrength(t *testing.T) {
	// 测试最优稳态: ρ=1.0, dρ/dt=0
	strength := ComputeATFStrength(1.0, 0.0, 2.0)
	if math.Abs(strength.Static-1.0) > 0.01 {
		t.Errorf("最优位置F_s应该为1.0，实际: %f", strength.Static)
	}
	if math.Abs(strength.Dynamic-1.0) > 0.01 {
		t.Errorf("无趋势F_d应该为1.0，实际: %f", strength.Dynamic)
	}
	if math.Abs(strength.Total-1.0) > 0.01 {
		t.Errorf("最优稳态F应该为1.0，实际: %f", strength.Total)
	}

	// 测试回归趋势: ρ=0.85, dρ/dt=+0.05
	strength = ComputeATFStrength(0.85, 0.05, 2.0)
	if strength.Total <= 1.0 {
		t.Errorf("回归趋势F应该>1.0，实际: %f", strength.Total)
	}

	// 测试恶化趋势: ρ=0.85, dρ/dt=-0.05
	strength = ComputeATFStrength(0.85, -0.05, 2.0)
	if strength.Total >= 1.0 {
		t.Errorf("恶化趋势F应该<1.0，实际: %f", strength.Total)
	}
}
