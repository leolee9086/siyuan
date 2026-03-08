package seraph

import "fmt"

// assertQuestionBankShape 校验题库是否满足IPIP-NEO-120的120题/5×24/5×6×4结构约束
func assertQuestionBankShape(items []IpipNeo120Item) error {
	if len(items) != TotalQuestions {
		return fmt.Errorf("IPIP-NEO-120题库长度非法，期望120，实际%d", len(items))
	}

	for _, domain := range domainOrder {
		domainCount := 0
		for _, facet := range facetOrder {
			facetCount := 0
			for _, item := range items {
				if item.Domain == domain && item.Facet == facet {
					facetCount++
					domainCount++
				}
			}
			if facetCount != FacetItemCount {
				return fmt.Errorf("Facet %s%d题量非法，期望4，实际%d", domain, facet, facetCount)
			}
		}
		if domainCount != DomainItemCount {
			return fmt.Errorf("Domain %s题量非法，期望24，实际%d", domain, domainCount)
		}
	}
	return nil
}

// buildItemIndex 构建题号到题目元数据的索引映射
func buildItemIndex(items []IpipNeo120Item) (map[int]IpipNeo120Item, error) {
	index := make(map[int]IpipNeo120Item)
	for _, item := range items {
		if _, exists := index[item.Q]; exists {
			return nil, fmt.Errorf("题库题号重复 q=%d", item.Q)
		}
		index[item.Q] = item
	}
	return index, nil
}

// assertAnswersCoverage 断言答案集合与题库一一对应
func assertAnswersCoverage(answers []RawAnswer, itemsByQuestion map[int]IpipNeo120Item) error {
	if len(answers) != len(itemsByQuestion) {
		return fmt.Errorf("答案长度非法，期望%d，实际%d", len(itemsByQuestion), len(answers))
	}

	seen := make(map[int]bool)
	for _, answer := range answers {
		if _, exists := itemsByQuestion[answer.Q]; !exists {
			return fmt.Errorf("答案包含未知题号 q=%d", answer.Q)
		}
		if seen[answer.Q] {
			return fmt.Errorf("答案包含重复题号 q=%d", answer.Q)
		}
		seen[answer.Q] = true
	}
	return nil
}
