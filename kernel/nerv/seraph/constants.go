package seraph

import (
	"fmt"
)

// 常量定义
const (
	TotalQuestions     = 120
	DomainItemCount    = 24
	FacetItemCount     = 4
	ExpectedMinusItems = 55
)

var (
	domainOrder = []Domain{DomainN, DomainE, DomainO, DomainA, DomainC}
	facetOrder  = []Facet{Facet1, Facet2, Facet3, Facet4, Facet5, Facet6}
)

// Facet名称映射
var facetNameMap = map[Domain]map[Facet]string{
	DomainN: {
		Facet1: "Anxiety",
		Facet2: "Anger",
		Facet3: "Depression",
		Facet4: "SelfConsciousness",
		Facet5: "Immoderation",
		Facet6: "Vulnerability",
	},
	DomainE: {
		Facet1: "Friendliness",
		Facet2: "Gregariousness",
		Facet3: "Assertiveness",
		Facet4: "ActivityLevel",
		Facet5: "ExcitementSeeking",
		Facet6: "Cheerfulness",
	},
	DomainO: {
		Facet1: "Imagination",
		Facet2: "ArtisticInterests",
		Facet3: "Emotionality",
		Facet4: "Adventurousness",
		Facet5: "Intellect",
		Facet6: "Liberalism",
	},
	DomainA: {
		Facet1: "Trust",
		Facet2: "Morality",
		Facet3: "Altruism",
		Facet4: "Cooperation",
		Facet5: "Modesty",
		Facet6: "Sympathy",
	},
	DomainC: {
		Facet1: "SelfEfficacy",
		Facet2: "Orderliness",
		Facet3: "Dutifulness",
		Facet4: "AchievementStriving",
		Facet5: "SelfDiscipline",
		Facet6: "Cautiousness",
	},
}

// getFacetName 获取子维度英文名称
func getFacetName(domain Domain, facet Facet) string {
	if domainMap, ok := facetNameMap[domain]; ok {
		if name, ok := domainMap[facet]; ok {
			return name
		}
	}
	return ""
}

// buildFacetKey 构建facet键名 格式: ${domain}${facet}_${EnglishName}
func buildFacetKey(domain Domain, facet Facet) string {
	return fmt.Sprintf("%s%d_%s", domain, facet, getFacetName(domain, facet))
}

// toNormalizedScore 将1-5分归一化到0-1区间
func toNormalizedScore(scoreOnOneToFive float64) float64 {
	return (scoreOnOneToFive - 1) / 4
}
