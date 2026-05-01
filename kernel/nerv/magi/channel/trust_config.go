package channel

// TrustConfig 单个通道的信任配置基线。
// 通道适配器通过 ChannelAdapter.TrustConfig() 返回此结构，
// MAGI 在构建 RequestSourceContext 时按此决定 trust/risk。
type TrustConfig struct {
	DefaultTrust TrustLevel `json:"defaultTrust"`
	DefaultRisk  RiskLevel  `json:"defaultRisk"`
}

type TrustLevel string

const (
	TrustLow    TrustLevel = "low"
	TrustMedium TrustLevel = "medium"
	TrustHigh   TrustLevel = "high"
)

type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
)
