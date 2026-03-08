package seraph

// ATFEntity 代表MAGI系统中的一个实体（Trinity或贤人）
type ATFEntity string

const (
	EntityTrinity   ATFEntity = "trinity"
	EntityMelchior  ATFEntity = "melchior"
	EntityBalthazar ATFEntity = "balthazar"
	EntityCasper    ATFEntity = "casper"
)

// StyleMetrics 文体风格指纹的统计特征
type StyleMetrics struct {
	TypeTokenRatio    float64 // 词汇丰度 (Type-Token Ratio)
	AvgSentenceLength float64 // 平均句长
	SentenceLengthStd float64 // 句长标准差
	PunctuationEntropy float64 // 标点熵
}

// CoherenceScore 一致性分数
type CoherenceScore struct {
	Internal float64 // C_int: 内部一致性 [0,1]
	External float64 // C_ext: 外部一致性 [0,1]
	Raw      float64 // C: 原始一致性分数 [0,1]
}

// SyncRate 同步率
type SyncRate struct {
	Value float64 // ρ: 同步率 [0,+∞)
	Zone  string  // 区间: "dispersion", "resonance", "dissolution"
}

// ATFStrength ATF强度
type ATFStrength struct {
	Static  float64 // F_s: 静态分量（位置）
	Dynamic float64 // F_d: 动态分量（趋势）
	Total   float64 // F: 综合ATF强度
}

// ATFState ATF系统完整状态
type ATFState struct {
	Coherence CoherenceScore
	SyncRate  SyncRate
	Strength  ATFStrength
}
