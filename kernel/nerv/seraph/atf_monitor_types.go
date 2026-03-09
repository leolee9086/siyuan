package seraph

import "github.com/siyuan-note/siyuan/kernel/nerv/marduk"

// SimilarityWeights 综合相似度权重配置。
type SimilarityWeights struct {
	StyleWeight    float64 // alpha
	BigFiveWeight  float64 // 1-alpha
	ColdStartBoost float64 // 冷启动阶段 alpha 增量
	ColdStartRounds int    // 冷启动轮数
}

// CoherenceWeights 一致性权重配置。
type CoherenceWeights struct {
	InternalWeight float64 // beta
	ExternalWeight float64 // 1-beta
}

// EMAConfig EMA 更新配置。
type EMAConfig struct {
	MaxLambda float64 // λ_max
}

// MonitorOptions 多轮监测配置。
type MonitorOptions struct {
	QuestionsPerEntity int
	Similarity         SimilarityWeights
	Coherence          CoherenceWeights
	EMA                EMAConfig
	Gamma              float64 // ATF 动态分量敏感度
	DerivativeLPAlpha  float64 // 同步率导数低通滤波系数
}

// MonitorSubject 被测对象（人格文档 + 初始人格矩阵）。
type MonitorSubject struct {
	ID           string
	Name         string
	Descriptions marduk.IpipPersonaSeedDescriptions
	InitialBase  *PersonaBase
}

// EntityAnswerResult 单实体单轮答卷结果。
type EntityAnswerResult struct {
	Entity     ATFEntity
	Questions  []IpipNeo120Item
	Answers    []RawAnswer
	Reflection string
}

// RoundEntityState 单实体每轮状态（含更新后人格）。
type RoundEntityState struct {
	Entity          ATFEntity
	Style           StyleMetrics
	ObservedPartial *PersonaBase
	UpdatedPersona  *PersonaBase
}

// RoundTelemetry 单轮遥测结果。
type RoundTelemetry struct {
	Round          int
	AlphaUsed      float64
	CInt           float64
	CExt           float64
	RawCoherence   float64
	SyncRate       SyncRate
	RhoDerivative  float64
	Strength       ATFStrength
	PairSimilarity map[string]float64
}

// SubjectTelemetry 单个被测对象的多轮监测结果。
type SubjectTelemetry struct {
	SubjectID string
	Rounds    []RoundTelemetry
}

// DefaultMonitorOptions 返回默认监测配置（对齐 ttt 文档建议值）。
func DefaultMonitorOptions() MonitorOptions {
	return MonitorOptions{
		QuestionsPerEntity: 5,
		Similarity: SimilarityWeights{
			StyleWeight:     0.35,
			BigFiveWeight:   0.65,
			ColdStartBoost:  0.25,
			ColdStartRounds: 3,
		},
		Coherence: CoherenceWeights{
			InternalWeight: 0.6,
			ExternalWeight: 0.4,
		},
		EMA: EMAConfig{
			MaxLambda: 0.25,
		},
		Gamma:             2.0,
		DerivativeLPAlpha: 0.5,
	}
}

