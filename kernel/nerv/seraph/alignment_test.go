package seraph

import (
	"math"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

// TestAlignmentWithMardukReiPreset 验证seraph计分结果与marduk预设数据对齐
func TestAlignmentWithMardukReiPreset(t *testing.T) {
	// 获取marduk的Rei提交载荷和预期结果
	payload := marduk.GetReiSubmissionPayload()
	expected := marduk.GetReiPreset()

	// 使用seraph计分
	computed, err := ScoreFromPayload(payload)
	if err != nil {
		t.Fatalf("ScoreFromPayload失败: %v", err)
	}

	// 验证Traits对齐
	tolerance := 0.01
	for trait, expectedValue := range expected.PersonaBase.Traits {
		computedValue, exists := computed.Traits[trait]
		if !exists {
			t.Errorf("计算结果缺少trait %s", trait)
			continue
		}
		diff := math.Abs(computedValue - expectedValue)
		if diff > tolerance {
			t.Errorf("Trait %s不对齐: 期望%.2f, 实际%.2f, 差异%.3f",
				trait, expectedValue, computedValue, diff)
		}
	}

	// 验证Facets对齐
	for facet, expectedValue := range expected.PersonaBase.Facets {
		computedValue, exists := computed.Facets[facet]
		if !exists {
			t.Errorf("计算结果缺少facet %s", facet)
			continue
		}
		diff := math.Abs(computedValue - expectedValue)
		if diff > tolerance {
			t.Errorf("Facet %s不对齐: 期望%.2f, 实际%.2f, 差异%.3f",
				facet, expectedValue, computedValue, diff)
		}
	}
}
