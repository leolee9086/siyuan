package seraph

import "fmt"

// createDomainAccumulator 创建domain累加器
func createDomainAccumulator() map[Domain]int {
	return map[Domain]int{
		DomainN: 0,
		DomainE: 0,
		DomainO: 0,
		DomainA: 0,
		DomainC: 0,
	}
}

// accumulateRawScores 遍历答案，按domain/facet累加方向性得分
func accumulateRawScores(answers []RawAnswer, itemsByQuestion map[int]IpipNeo120Item) (*ScoringAccumulation, error) {
	domainSum := createDomainAccumulator()
	domainCount := createDomainAccumulator()
	facetSum := make(map[string]int)
	facetCount := make(map[string]int)

	for _, answer := range answers {
		item, exists := itemsByQuestion[answer.Q]
		if !exists {
			return nil, fmt.Errorf("题号q=%d无法在题库中定位", answer.Q)
		}

		// plus正向直接取分，minus反向按6-score转换
		directionalScore := answer.Score
		if item.Keyed == KeyedMinus {
			directionalScore = 6 - answer.Score
		}

		facetKey := buildFacetKey(item.Domain, item.Facet)

		domainSum[item.Domain] += directionalScore
		domainCount[item.Domain]++
		facetSum[facetKey] += directionalScore
		facetCount[facetKey]++
	}

	return &ScoringAccumulation{
		DomainSum:   domainSum,
		DomainCount: domainCount,
		FacetSum:    facetSum,
		FacetCount:  facetCount,
	}, nil
}

// assertAccumulationCounts 校验累加结果中每个domain和facet的答案数量
func assertAccumulationCounts(acc *ScoringAccumulation) error {
	for _, domain := range domainOrder {
		if acc.DomainCount[domain] != DomainItemCount {
			return fmt.Errorf("Domain %s答案数量非法，期望24，实际%d", domain, acc.DomainCount[domain])
		}
	}

	for _, domain := range domainOrder {
		for _, facet := range facetOrder {
			facetKey := buildFacetKey(domain, facet)
			count := acc.FacetCount[facetKey]
			if count != FacetItemCount {
				return fmt.Errorf("Facet %s%d答案数量非法，期望4，实际%d", domain, facet, count)
			}
		}
	}
	return nil
}

// computePersonaBase 将累加结果转换为归一化的PersonaBase
func computePersonaBase(acc *ScoringAccumulation) (*PersonaBase, error) {
	if err := assertAccumulationCounts(acc); err != nil {
		return nil, err
	}

	traits := make(map[string]float64)
	traits["O"] = toNormalizedScore(float64(acc.DomainSum[DomainO]) / float64(DomainItemCount))
	traits["C"] = toNormalizedScore(float64(acc.DomainSum[DomainC]) / float64(DomainItemCount))
	traits["E"] = toNormalizedScore(float64(acc.DomainSum[DomainE]) / float64(DomainItemCount))
	traits["A"] = toNormalizedScore(float64(acc.DomainSum[DomainA]) / float64(DomainItemCount))
	traits["N"] = toNormalizedScore(float64(acc.DomainSum[DomainN]) / float64(DomainItemCount))

	facets := make(map[string]float64)
	for _, domain := range domainOrder {
		for _, facet := range facetOrder {
			facetKey := buildFacetKey(domain, facet)
			facets[facetKey] = toNormalizedScore(float64(acc.FacetSum[facetKey]) / float64(FacetItemCount))
		}
	}

	return &PersonaBase{
		Traits: traits,
		Facets: facets,
	}, nil
}

// ScoreIpipNeo120PersonaBase 将IPIP-NEO-120原始答案转换为标准PersonaBase
func ScoreIpipNeo120PersonaBase(answers []RawAnswer, items []IpipNeo120Item) (*PersonaBase, error) {
	if err := assertQuestionBankShape(items); err != nil {
		return nil, err
	}

	itemsByQuestion, err := buildItemIndex(items)
	if err != nil {
		return nil, err
	}

	if err := assertAnswersCoverage(answers, itemsByQuestion); err != nil {
		return nil, err
	}

	acc, err := accumulateRawScores(answers, itemsByQuestion)
	if err != nil {
		return nil, err
	}

	return computePersonaBase(acc)
}
