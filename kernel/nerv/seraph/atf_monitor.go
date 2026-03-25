package seraph

import (
	"context"
	"fmt"
	"math"

	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

var monitoredEntities = []ATFEntity{
	EntityIntegrated,
	EntityMelchior,
	EntityBalthazar,
	EntityCasper,
	EntityAvatar,
}

// ThreeBlindMonitor 三盲测试 + 多轮 ATF 监测执行器。
type ThreeBlindMonitor struct {
	sampler  *QuestionSampler
	answerer ThreeBlindAnswerer
	opts     MonitorOptions
}

// NewThreeBlindMonitor 创建监测执行器。
func NewThreeBlindMonitor(answerer ThreeBlindAnswerer, opts *MonitorOptions) *ThreeBlindMonitor {
	finalOpts := DefaultMonitorOptions()
	if opts != nil {
		finalOpts = *opts
	}
	return &ThreeBlindMonitor{
		sampler:  NewQuestionSampler(),
		answerer: answerer,
		opts:     finalOpts,
	}
}

// RunRounds 执行指定轮数监测。
func (m *ThreeBlindMonitor) RunRounds(ctx context.Context, subject MonitorSubject, rounds int) (*SubjectTelemetry, error) {
	if m.answerer == nil {
		return nil, fmt.Errorf("answerer is required")
	}
	if rounds <= 0 {
		return &SubjectTelemetry{SubjectID: subject.ID}, nil
	}
	if subject.InitialBase == nil {
		return nil, fmt.Errorf("subject initial persona base is required")
	}

	personaByEntity := make(map[ATFEntity]*PersonaBase)
	for _, entity := range monitoredEntities {
		personaByEntity[entity] = clonePersonaBase(subject.InitialBase)
	}

	telemetry := &SubjectTelemetry{
		SubjectID: subject.ID,
		Rounds:    make([]RoundTelemetry, 0, rounds),
	}

	prevRho := 1.0
	prevFilteredDerivative := 0.0

	for round := 1; round <= rounds; round++ {
		alpha := m.opts.Similarity.StyleWeight
		if round <= m.opts.Similarity.ColdStartRounds {
			alpha += m.opts.Similarity.ColdStartBoost
			if alpha > 0.95 {
				alpha = 0.95
			}
		}
		bigFiveWeight := 1 - alpha
		if bigFiveWeight < 0 {
			bigFiveWeight = 0
		}

		answers, err := m.collectRoundAnswers(ctx, subject)
		if err != nil {
			return nil, fmt.Errorf("round %d collect answers failed: %w", round, err)
		}

		styles := make(map[ATFEntity]StyleMetrics)
		for _, entity := range monitoredEntities {
			result := answers[entity]
			styleMetrics, err := ComputeStyleMetrics(result.Reflection)
			if err != nil {
				return nil, fmt.Errorf("round %d entity %s style metrics failed: %w", round, entity, err)
			}
			styles[entity] = styleMetrics

			partialBase, err := buildPartialPersonaBase(result.Answers, result.Questions)
			if err != nil {
				return nil, fmt.Errorf("round %d entity %s partial score failed: %w", round, entity, err)
			}
			lambda := computeSalienceLambda(result.Answers, m.opts.EMA.MaxLambda)
			personaByEntity[entity] = applyEMAUpdate(personaByEntity[entity], partialBase, lambda)
		}

		pairs := make(map[string]float64)
		internalPairs := map[string]float64{
			"I_m": 0,
			"I_b": 0,
			"I_c": 0,
			"m_b": 0,
			"m_c": 0,
			"b_c": 0,
		}
		internalPairs["I_m"] = toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityIntegrated, EntityMelchior, alpha, bigFiveWeight))
		internalPairs["I_b"] = toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityIntegrated, EntityBalthazar, alpha, bigFiveWeight))
		internalPairs["I_c"] = toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityIntegrated, EntityCasper, alpha, bigFiveWeight))
		internalPairs["m_b"] = toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityMelchior, EntityBalthazar, alpha, bigFiveWeight))
		internalPairs["m_c"] = toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityMelchior, EntityCasper, alpha, bigFiveWeight))
		internalPairs["b_c"] = toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityBalthazar, EntityCasper, alpha, bigFiveWeight))
		for k, v := range internalPairs {
			pairs[k] = v
		}

		integratedAvatarSim := toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityIntegrated, EntityAvatar, alpha, bigFiveWeight))
		pairs["I_avatar"] = integratedAvatarSim

		cInt := ComputeInternalCoherence(internalPairs)
		cExt := ComputeExternalCoherence(integratedAvatarSim)
		raw := ComputeRawCoherence(cInt, cExt, m.opts.Coherence.InternalWeight)
		syncRate := ComputeSyncRate(raw)

		rawDerivative := 0.0
		if round > 1 {
			rawDerivative = syncRate.Value - prevRho
		}
		filteredDerivative := m.opts.DerivativeLPAlpha*rawDerivative + (1-m.opts.DerivativeLPAlpha)*prevFilteredDerivative
		strength := ComputeATFStrength(syncRate.Value, filteredDerivative, m.opts.Gamma)

		telemetry.Rounds = append(telemetry.Rounds, RoundTelemetry{
			Round:          round,
			AlphaUsed:      alpha,
			CInt:           cInt,
			CExt:           cExt,
			RawCoherence:   raw,
			SyncRate:       syncRate,
			RhoDerivative:  filteredDerivative,
			Strength:       strength,
			PairSimilarity: pairs,
		})

		prevRho = syncRate.Value
		prevFilteredDerivative = filteredDerivative
	}

	return telemetry, nil
}

func (m *ThreeBlindMonitor) collectRoundAnswers(ctx context.Context, subject MonitorSubject) (map[ATFEntity]*EntityAnswerResult, error) {
	melchiorQuestions := m.sampler.SampleForEntity(EntityMelchior, m.opts.QuestionsPerEntity)
	balthazarQuestions := m.sampler.SampleForEntity(EntityBalthazar, m.opts.QuestionsPerEntity)
	casperQuestions := m.sampler.SampleForEntity(EntityCasper, m.opts.QuestionsPerEntity)

	results, err := m.answerer.AnswerAllEntities(
		ctx,
		subject,
		melchiorQuestions,
		balthazarQuestions,
		casperQuestions,
	)
	if err != nil {
		return nil, fmt.Errorf("collect integrated MAGI answers failed: %w", err)
	}
	if results == nil {
		return nil, fmt.Errorf("integrated MAGI answers are nil")
	}

	for _, entity := range []ATFEntity{EntityMelchior, EntityBalthazar, EntityCasper, EntityIntegrated} {
		if results[entity] == nil {
			return nil, fmt.Errorf("entity %s answer is nil", entity)
		}
	}

	// 阶段二：Avatar独立作答（参考基线）
	avatarQuestions := m.sampler.SampleForEntity(EntityAvatar, m.opts.QuestionsPerEntity)
	if len(avatarQuestions) > 0 {
		avatarResult, err := m.answerer.Answer(ctx, subject, EntityAvatar, avatarQuestions)
		if err != nil {
			return nil, fmt.Errorf("avatar answer failed: %w", err)
		}
		if avatarResult == nil {
			return nil, fmt.Errorf("avatar answer is nil")
		}
		results[EntityAvatar] = avatarResult
	}

	return results, nil
}

func computePairSimilarity(
	personaByEntity map[ATFEntity]*PersonaBase,
	styles map[ATFEntity]StyleMetrics,
	left, right ATFEntity,
	styleWeight, bigFiveWeight float64,
) float64 {
	styleSim := ComputeStyleSimilarity(styles[left], styles[right])
	bfSim := ComputeBigFiveSimilarity(personaByEntity[left], personaByEntity[right], nil)
	return styleWeight*styleSim + bigFiveWeight*bfSim
}

func computeSalienceLambda(answers []RawAnswer, maxLambda float64) float64 {
	if maxLambda <= 0 {
		return 0
	}
	if len(answers) == 0 {
		return 0
	}
	sum := 0.0
	for _, answer := range answers {
		sum += math.Abs(float64(answer.Score)-3.0) / 2.0
	}
	salience := sum / float64(len(answers))
	if salience < 0 {
		salience = 0
	}
	if salience > 1 {
		salience = 1
	}
	return salience * maxLambda
}

func buildPartialPersonaBase(answers []RawAnswer, questions []IpipNeo120Item) (*PersonaBase, error) {
	qIndex := make(map[int]IpipNeo120Item, len(questions))
	for _, q := range questions {
		qIndex[q.Q] = q
	}

	facetSum := make(map[string]float64)
	facetCount := make(map[string]float64)
	domainSum := make(map[Domain]float64)
	domainCount := make(map[Domain]float64)

	for _, answer := range answers {
		item, ok := qIndex[answer.Q]
		if !ok {
			return nil, fmt.Errorf("unknown sampled question q=%d", answer.Q)
		}
		directional := float64(answer.Score)
		if item.Keyed == KeyedMinus {
			directional = 6 - directional
		}

		facetKey := buildFacetKey(item.Domain, item.Facet)
		facetSum[facetKey] += directional
		facetCount[facetKey]++
		domainSum[item.Domain] += directional
		domainCount[item.Domain]++
	}

	facets := make(map[string]float64)
	for k, sum := range facetSum {
		count := facetCount[k]
		if count <= 0 {
			continue
		}
		facets[k] = toNormalizedScore(sum / count)
	}

	traits := make(map[string]float64)
	for d, sum := range domainSum {
		count := domainCount[d]
		if count <= 0 {
			continue
		}
		traits[string(d)] = toNormalizedScore(sum / count)
	}

	return &PersonaBase{
		Traits: traits,
		Facets: facets,
	}, nil
}

func applyEMAUpdate(current *PersonaBase, observed *PersonaBase, lambda float64) *PersonaBase {
	if current == nil {
		return clonePersonaBase(observed)
	}
	if observed == nil {
		return clonePersonaBase(current)
	}
	if lambda < 0 {
		lambda = 0
	}
	if lambda > 1 {
		lambda = 1
	}

	next := clonePersonaBase(current)
	if next.Facets == nil {
		next.Facets = make(map[string]float64)
	}
	for facetKey, observedVal := range observed.Facets {
		curVal, ok := next.Facets[facetKey]
		if !ok {
			next.Facets[facetKey] = observedVal
			continue
		}
		next.Facets[facetKey] = (1-lambda)*curVal + lambda*observedVal
	}

	recomputeTraits(next)
	return next
}

func recomputeTraits(base *PersonaBase) {
	if base == nil {
		return
	}
	if base.Traits == nil {
		base.Traits = make(map[string]float64)
	}
	for _, domain := range domainOrder {
		sum := 0.0
		count := 0.0
		for _, facet := range facetOrder {
			key := buildFacetKey(domain, facet)
			if v, ok := base.Facets[key]; ok {
				sum += v
				count++
			}
		}
		if count > 0 {
			base.Traits[string(domain)] = sum / count
		}
	}
}

func clonePersonaBase(base *PersonaBase) *PersonaBase {
	if base == nil {
		return &PersonaBase{
			Traits: make(map[string]float64),
			Facets: make(map[string]float64),
		}
	}
	out := &PersonaBase{
		Traits: make(map[string]float64, len(base.Traits)),
		Facets: make(map[string]float64, len(base.Facets)),
	}
	for k, v := range base.Traits {
		out.Traits[k] = v
	}
	for k, v := range base.Facets {
		out.Facets[k] = v
	}
	return out
}

func toUnitInterval(similarity float64) float64 {
	// 相似度预期在 [-1,1]，统一映射到 [0,1] 供一致性公式使用。
	value := (similarity + 1) / 2
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

// BuildReiSubject 丽人格文档 + 初始人格矩阵。
func BuildReiSubject() MonitorSubject {
	payload := marduk.GetReiSubmissionPayload()
	preset := marduk.GetReiPreset()
	return MonitorSubject{
		ID:           payload.Subject.ID,
		Name:         payload.Subject.Name,
		Descriptions: payload.Descriptions,
		InitialBase:  clonePersonaBase(&preset.PersonaBase),
	}
}

// BuildKaoruSubject 薰人格文档 + 初始人格矩阵。
func BuildKaoruSubject() MonitorSubject {
	payload := marduk.GetKaoruSubmissionPayload()
	preset := marduk.GetKaoruPreset()
	return MonitorSubject{
		ID:           payload.Subject.ID,
		Name:         payload.Subject.Name,
		Descriptions: payload.Descriptions,
		InitialBase:  clonePersonaBase(&preset.PersonaBase),
	}
}
