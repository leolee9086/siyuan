package seraph

import (
	"math"
	"testing"
)

func TestEMAUpdater_ComputeSalience(t *testing.T) {
	updater := NewEMAUpdater(0.1)

	tests := []struct {
		name      string
		current   float64
		observed  float64
		minLambda float64
		maxLambda float64
	}{
		{"无变化", 0.5, 0.5, 0.0, 0.01},
		{"小幅变化", 0.5, 0.6, 0.0, 0.05},
		{"大幅变化到极端", 0.5, 0.9, 0.05, 0.1},
		{"极端值变化", 0.1, 0.9, 0.05, 0.1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lambda := updater.ComputeSalience(tt.current, tt.observed)
			if lambda < tt.minLambda || lambda > tt.maxLambda {
				t.Errorf("λ = %.4f, 期望范围 [%.4f, %.4f]", lambda, tt.minLambda, tt.maxLambda)
			}
		})
	}
}

func TestEMAUpdater_UpdateFacet(t *testing.T) {
	updater := NewEMAUpdater(0.1)

	current := 0.5
	observed := 0.8
	lambda := 0.1

	updated := updater.UpdateFacet(current, observed, lambda)
	expected := 0.9*0.5 + 0.1*0.8 // = 0.53

	if math.Abs(updated-expected) > 0.01 {
		t.Errorf("更新后值 = %.4f, 期望 %.4f", updated, expected)
	}
}

func TestEMAUpdater_UpdatePersonaBase(t *testing.T) {
	updater := NewEMAUpdater(0.1)

	current := PersonaBase{
		Traits: map[string]float64{
			"O": 0.5,
			"C": 0.6,
		},
		Facets: map[string]float64{
			"O1": 0.5,
			"C1": 0.6,
		},
	}

	observed := PersonaBase{
		Traits: map[string]float64{
			"O": 0.7,
			"C": 0.8,
		},
		Facets: map[string]float64{
			"O1": 0.7,
			"C1": 0.8,
		},
	}

	updated := updater.UpdatePersonaBase(current, observed, false)

	// 验证Traits更新
	if updated.Traits["O"] <= current.Traits["O"] || updated.Traits["O"] >= observed.Traits["O"] {
		t.Errorf("Trait O 更新异常: %.4f", updated.Traits["O"])
	}

	// 验证Facets更新
	if updated.Facets["O1"] <= current.Facets["O1"] || updated.Facets["O1"] >= observed.Facets["O1"] {
		t.Errorf("Facet O1 更新异常: %.4f", updated.Facets["O1"])
	}
}
