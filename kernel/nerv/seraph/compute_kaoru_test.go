package seraph

import (
	"fmt"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

// TestComputeKaoruActualPersonaBase 计算薰答案的实际PersonaBase
func TestComputeKaoruActualPersonaBase(t *testing.T) {
	payload := marduk.GetKaoruSubmissionPayload()
	computed, err := ScoreFromPayload(payload)
	if err != nil {
		t.Fatalf("计分失败: %v", err)
	}

	fmt.Println("薰的实际PersonaBase（从答案计算）：")
	fmt.Println("\nTraits:")
	for _, trait := range []string{"O", "C", "E", "A", "N"} {
		fmt.Printf("  %s: %.2f\n", trait, computed.Traits[trait])
	}

	fmt.Println("\nFacets:")
	domains := []string{"N", "E", "O", "A", "C"}
	for _, domain := range domains {
		fmt.Printf("\n  %s维度:\n", domain)
		for facet := 1; facet <= 6; facet++ {
			key := fmt.Sprintf("%s%d_", domain, facet)
			for k, v := range computed.Facets {
				if len(k) >= len(key) && k[:len(key)] == key {
					fmt.Printf("    %s: %.2f\n", k, v)
					break
				}
			}
		}
	}
}
