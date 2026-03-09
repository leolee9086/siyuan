package seraph

import "math"

// EMAUpdater 指数移动平均更新器
type EMAUpdater struct {
	MaxLambda float64 // λ_max: 最大更新步长，默认0.1
}

// NewEMAUpdater 创建EMA更新器
func NewEMAUpdater(maxLambda float64) *EMAUpdater {
	if maxLambda <= 0 || maxLambda > 1 {
		maxLambda = 0.1 // 默认值
	}
	return &EMAUpdater{
		MaxLambda: maxLambda,
	}
}

// ComputeSalience 计算事件显著性 S_obs
// 返回 λ(S_obs) ∈ [0, λ_max]
//
// 事件显著性基于以下因素：
// - 情绪张力：答案的极端程度
// - 认知冲突：与当前人格的偏离程度
func (u *EMAUpdater) ComputeSalience(currentScore, observedScore float64) float64 {
	// 计算偏离程度
	deviation := math.Abs(observedScore - currentScore)

	// 极端程度：越接近边界（0或1）越显著
	extremity := math.Max(math.Abs(observedScore), math.Abs(1.0-observedScore))

	// 综合显著性：偏离程度 × 极端程度
	salience := deviation * extremity

	// 归一化到 [0, λ_max]
	// NOTE(codex-sync): 适度放大显著事件响应，保证“大幅偏移”能触发有效更新步长。
	lambda := salience * 2.0 * u.MaxLambda
	if lambda > u.MaxLambda {
		lambda = u.MaxLambda
	}

	return lambda
}

// UpdateFacet 更新单个Facet的EMA值
// P^(T) = (1-λ) * P^(T-1) + λ * P_obs^(T)
func (u *EMAUpdater) UpdateFacet(current, observed, lambda float64) float64 {
	return (1-lambda)*current + lambda*observed
}

// UpdatePersonaBase 更新完整的PersonaBase矩阵
func (u *EMAUpdater) UpdatePersonaBase(
	current PersonaBase,
	observed PersonaBase,
	useDynamicLambda bool,
) PersonaBase {
	updated := PersonaBase{
		Traits: make(map[string]float64),
		Facets: make(map[string]float64),
	}

	// 更新Traits
	for trait, obsValue := range observed.Traits {
		curValue := current.Traits[trait]
		lambda := u.MaxLambda
		if useDynamicLambda {
			lambda = u.ComputeSalience(curValue, obsValue)
		}
		updated.Traits[trait] = u.UpdateFacet(curValue, obsValue, lambda)
	}

	// 更新Facets
	for facet, obsValue := range observed.Facets {
		curValue := current.Facets[facet]
		lambda := u.MaxLambda
		if useDynamicLambda {
			lambda = u.ComputeSalience(curValue, obsValue)
		}
		updated.Facets[facet] = u.UpdateFacet(curValue, obsValue, lambda)
	}

	return updated
}
