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
	sampler          *QuestionSampler
	answerer         ThreeBlindAnswerer
	opts             MonitorOptions
	dominantSeelName string // 当前主导者名称，每轮 ATF 采样前由外部设置
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

// RunSamplingRounds 执行指定轮数的 ATF 采样监测。
// dominantSeelName 为当前主导者名称，由外部传入（复用上次心跳/外界响应选举结果）。
func (m *ThreeBlindMonitor) RunSamplingRounds(ctx context.Context, subject MonitorSubject, rounds int, dominantSeelName string) (*SubjectTelemetry, error) {
	if m.answerer == nil {
		return nil, fmt.Errorf("answerer is required")
	}
	if rounds <= 0 {
		return &SubjectTelemetry{SubjectID: subject.ID}, nil
	}
	if subject.InitialBase == nil {
		return nil, fmt.Errorf("subject initial persona base is required")
	}
	if dominantSeelName == "" {
		return nil, fmt.Errorf("dominantSeelName is required")
	}

	m.dominantSeelName = dominantSeelName
	m.answerer.SetDominant(dominantSeelName)

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
			personaByEntity[entity] = partialBase
		}

		pairs := make(map[string]float64)
		internalPairs := map[string]float64{
			"m_b": 0,
			"m_c": 0,
			"b_c": 0,
		}
		// V2 双度量计算所有 pair
		type namedPair struct {
			name         string
			left, right  ATFEntity
		}
		allPairs := []namedPair{
			{"m_b", EntityMelchior, EntityBalthazar},
			{"m_c", EntityMelchior, EntityCasper},
			{"b_c", EntityBalthazar, EntityCasper},
			{"a_m", EntityAvatar, EntityMelchior},
			{"a_b", EntityAvatar, EntityBalthazar},
			{"a_c", EntityAvatar, EntityCasper},
			{"I_m", EntityIntegrated, EntityMelchior},
			{"I_b", EntityIntegrated, EntityBalthazar},
			{"I_c", EntityIntegrated, EntityCasper},
			{"I_avatar", EntityIntegrated, EntityAvatar},
		}
		dualByPair := make(map[string]SimilarityPair)
		for _, p := range allPairs {
			sp := ComputeBigFiveSimilarityDual(personaByEntity[p.left], personaByEntity[p.right], nil)
			dualByPair[p.name] = sp
		}
		internalPairs["m_b"] = dualByPair["m_b"].MagnitudeSim
		internalPairs["m_c"] = dualByPair["m_c"].MagnitudeSim
		internalPairs["b_c"] = dualByPair["b_c"].MagnitudeSim
		for k, v := range internalPairs {
			pairs[k] = v
		}
		pairs["I_m"] = dualByPair["I_m"].MagnitudeSim
		pairs["I_b"] = dualByPair["I_b"].MagnitudeSim
		pairs["I_c"] = dualByPair["I_c"].MagnitudeSim
		pairs["I_avatar"] = dualByPair["I_avatar"].MagnitudeSim

		// 打印各 pair 的文体成分、形状相似度和幅度相似度
		{
			for _, p := range allPairs {
				rawStyle := ComputeStyleSimilarity(styles[p.left], styles[p.right])
				sp := dualByPair[p.name]
				fmt.Printf("[ATF] pair=%s style=%.6f shape=%.6f mag=%.6f\n", p.name, rawStyle, sp.ShapeSim, sp.MagnitudeSim)
			}
		}

		{
			fmt.Printf("[ATF] traits: ")
			for _, e := range monitoredEntities {
				pb := personaByEntity[e]
				if pb != nil {
					fmt.Printf("%s={O=%.3f C=%.3f E=%.3f A=%.3f N=%.3f} ", e,
						pb.Traits["O"], pb.Traits["C"], pb.Traits["E"], pb.Traits["A"], pb.Traits["N"])
				}
			}
			fmt.Println()
		}

		// EM PID monitoring
		pidStates := make(map[ATFEntity]map[string]*emPidFacet)
		for _, e := range monitoredEntities {
			st := make(map[string]*emPidFacet)
			for k := range subject.InitialBase.Facets {
				st[k] = &emPidFacet{}
			}
			pidStates[e] = st
		}
		var microAlerts []string
		for _, e := range monitoredEntities {
			result := answers[e]
			allAns := result.Answers
			st := pidStates[e]
			for batch := 12; batch <= len(allAns); batch += 12 {
				subAns := allAns[:batch]
				partialSub, err := buildPartialPersonaBase(subAns, result.Questions)
				if err != nil {
					continue
				}
				for k, v := range partialSub.Facets {
					initVal, ok := subject.InitialBase.Facets[k]
					if !ok {
						continue
					}
					dev := math.Abs(v - initVal)
					s := st[k]
					s.batch = (batch / 12)

					// P: instantaneous deviation
					pHit := dev > m.opts.EMA.MaxLambda

					// I: sliding window of excess over MinLambda
					excess := math.Max(dev-m.opts.EMA.MinLambda, 0)
					s.ringSum -= s.ringBuf[s.ringPos]
					s.ringBuf[s.ringPos] = excess
					s.ringSum += excess
					s.ringPos = (s.ringPos + 1) % 5
					iHit := s.ringSum > 0.5

					// D: filtered rate of change
					rawDelta := dev - s.prevDev
					s.filtDev = 0.3*rawDelta + 0.7*s.filtDev
					s.prevDev = dev
					dHit := math.Abs(s.filtDev) > 0.10

					s.dev = dev
					if pHit || iHit || dHit {
						label := ""
						if pHit {
							label = "P"
						}
						if iHit {
							label += "I"
						}
						if dHit {
							label += "D"
						}
						microAlerts = append(microAlerts,
							fmt.Sprintf("%s/%s@%d=%s(dev=%.3f)", e, k, s.batch, label, dev))
						if len(microAlerts) > 20 {
							break
						}
					}
				}
			}
		}

		maxDev := 0.0
		for _, e := range monitoredEntities {
			pb := personaByEntity[e]
			if pb == nil || pb.Facets == nil {
				continue
			}
			for k, v := range pb.Facets {
				if initVal, ok := subject.InitialBase.Facets[k]; ok {
					dev := math.Abs(v - initVal)
					if dev > maxDev {
						maxDev = dev
					}
				}
			}
		}
		highAlert := maxDev > m.opts.EMA.MaxLambda
		lowAlert := maxDev < m.opts.EMA.MinLambda

		var emAlert string
		if len(microAlerts) > 0 {
			emAlert = "high"
		} else {
			emAlert = emAlertStatus(highAlert, lowAlert)
		}
		fmt.Printf("[ATF-EM] max_dev=%.4f thresholds=[%.3f, %.3f] alert=%s micro=%d\n",
			maxDev, m.opts.EMA.MinLambda, m.opts.EMA.MaxLambda, emAlert, len(microAlerts))
		if len(microAlerts) > 0 {
			for _, a := range microAlerts {
				fmt.Printf("  [ATF-EM]   %s\n", a)
			}
		}

		// C_int 和 C_ext 均使用 V2 双度量，经由 ComputeCIntFromTripletV2 计算
		cIntPairs := [3]SimilarityPair{dualByPair["m_b"], dualByPair["m_c"], dualByPair["b_c"]}
		cExtPairs := [3]SimilarityPair{dualByPair["a_m"], dualByPair["a_b"], dualByPair["a_c"]}
		cInt := ComputeCIntFromTripletV2(cIntPairs)
		cExt := ComputeCIntFromTripletV2(cExtPairs)
		syncRate := ComputeSyncRateFromParts(cInt, cExt)

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
			RawCoherence:   cInt,
			SyncRate:       syncRate,
			RhoDerivative:  filteredDerivative,
			Strength:       strength,
			PairSimilarity: pairs,
			EMAlert:        emAlert,
		})

		prevRho = syncRate.Value
		prevFilteredDerivative = filteredDerivative
	}

	return telemetry, nil
}

func (m *ThreeBlindMonitor) collectRoundAnswers(ctx context.Context, subject MonitorSubject) (map[ATFEntity]*EntityAnswerResult, error) {
	// 全量 120 题
	allQuestions := IpipNeo120QuestionBank

	// 设置主导者（复用上次心跳/外界响应结果）
	m.answerer.SetDominant(m.dominantSeelName)

	results, err := m.answerer.AnswerAllEntities(
		ctx,
		subject,
		allQuestions,
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

	// Avatar 独立作答（全量 120 题，裸 LLM 镜像）
	avatarResult, err := m.answerer.Answer(ctx, subject, EntityAvatar, allQuestions)
	if err != nil {
		return nil, fmt.Errorf("avatar answer failed: %w", err)
	}
	if avatarResult == nil {
		return nil, fmt.Errorf("avatar answer is nil")
	}
	results[EntityAvatar] = avatarResult

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
	return salience
}

type emPidFacet struct {
	dev     float64
	prevDev float64
	filtDev float64
	ringSum float64
	ringBuf [5]float64
	ringPos int
	batch   int
}

func emAlertStatus(highAlert, lowAlert bool) string {
	if highAlert && lowAlert {
		return "both"
	}
	if highAlert {
		return "high"
	}
	if lowAlert {
		return "low"
	}
	return "none"
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

// BuildShikinamiSubject 式波人格文档 + 初始人格矩阵。
func BuildShikinamiSubject() MonitorSubject {
	payload := marduk.GetShikinamiSubmissionPayload()
	preset := marduk.GetShikinamiPreset()
	return MonitorSubject{
		ID:           payload.Subject.ID,
		Name:         payload.Subject.Name,
		Descriptions: payload.Descriptions,
		InitialBase:  clonePersonaBase(&preset.PersonaBase),
	}
}
