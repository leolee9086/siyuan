package trust

import "encoding/json"

// Config 多通道可信度全局配置文件。
type Config struct {
	Version  int                     `json:"version"`
	Channels map[string]ChannelConfig `json:"channels"`
}

// ChannelConfig 单个通道在可信度配置中的条目。
type ChannelConfig struct {
	Enabled      bool                    `json:"enabled"`
	DefaultTrust string                  `json:"defaultTrust"`
	DefaultRisk  string                  `json:"defaultRisk"`
	PerAccount   map[string]AccountConfig `json:"perAccount,omitempty"`
}

// AccountConfig 通道内某个账号的配置。
type AccountConfig struct {
	DefaultTrust string                   `json:"defaultTrust,omitempty"`
	DefaultRisk  string                   `json:"defaultRisk,omitempty"`
	AllowList    []string                 `json:"allowList,omitempty"`
	BlockList    []string                 `json:"blockList,omitempty"`
	PerUser      map[string]UserOverride  `json:"perUser,omitempty"`
}

// UserOverride 单用户在某个通道账号下的信任覆盖。
type UserOverride struct {
	TrustBase *string `json:"trustBase,omitempty"`
	RiskLevel *string `json:"riskLevel,omitempty"`
	Blocked   bool    `json:"blocked,omitempty"`
	Nickname  string  `json:"nickname,omitempty"`
}

// defaultConfig 返回安全默认配置（所有通道 Trust=low, Risk=high, 禁用）。
func defaultConfig() *Config {
	return &Config{
		Version:  1,
		Channels: map[string]ChannelConfig{},
	}
}

func isValidTrustLevel(s string) bool {
	switch s {
	case "low", "medium", "high":
		return true
	default:
		return false
	}
}

func isValidRiskLevel(s string) bool {
	switch s {
	case "low", "medium", "high":
		return true
	default:
		return false
	}
}

// MarshalJSON 实现 json.Marshaler，确保零值不会输出空 map。
func (c Config) MarshalJSON() ([]byte, error) {
	type alias Config
	raw := alias(c)
	if raw.Channels == nil {
		raw.Channels = map[string]ChannelConfig{}
	}
	return json.Marshal(raw)
}
