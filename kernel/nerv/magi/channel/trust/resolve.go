package trust

import (
	"strings"
)

// ResolveResult 渠道消息的可信度解析结果。
type ResolveResult struct {
	TrustBase     string
	RiskLevel     string
	Blocked       bool
	Nickname      string
	DirectAllowed bool // Trust=high && Risk=low 时允许直接由 MAGI 回答
}

// DefaultIdentityResolver 全局身份解析器，供 coordinator 等包在需要校验渠道用户身份时使用。
// 由 API 层在 MAGI 初始化时注入。
var DefaultIdentityResolver func(channelID, accountID, userID string) ResolveResult

// Resolve 解析指定通道、账号、用户的可信度结果。
// 安全基线：无配置时默认 Trust=low, Risk=high。
// 信任只能收敛不能扩张：用户级覆盖值若超出配置基线强度，会被降级到账号/通道基线。
func (m *Manager) Resolve(channelID, accountID, userID string) ResolveResult {
	m.mu.RLock()
	cfg := m.cfg
	m.mu.RUnlock()

	direct := func(t, r string) bool { return t == "high" && r == "low" }

	if cfg == nil {
		return ResolveResult{TrustBase: "low", RiskLevel: "high", Blocked: false}
	}

	chanCfg, chanOk := cfg.Channels[channelID]
	if !chanOk || !chanCfg.Enabled {
		return ResolveResult{TrustBase: "low", RiskLevel: "high", Blocked: !chanOk || !chanCfg.Enabled}
	}

	channelTrust := normalizeLevel(chanCfg.DefaultTrust, "low", isValidTrustLevel)
	channelRisk := normalizeLevel(chanCfg.DefaultRisk, "high", isValidRiskLevel)

	acctCfg, acctOk := chanCfg.PerAccount[accountID]
	if !acctOk {
		return ResolveResult{
			TrustBase:     channelTrust,
			RiskLevel:     channelRisk,
			Blocked:       false,
			DirectAllowed: direct(channelTrust, channelRisk),
		}
	}

	// 黑名单前置检查
	for _, blockedID := range acctCfg.BlockList {
		if strings.TrimSpace(blockedID) == userID {
			return ResolveResult{TrustBase: "low", RiskLevel: "high", Blocked: true}
		}
	}

	acctTrust := normalizeLevel(acctCfg.DefaultTrust, channelTrust, isValidTrustLevel)
	acctRisk := normalizeLevel(acctCfg.DefaultRisk, channelRisk, isValidRiskLevel)

	// 用户级覆盖
	if override, hasOverride := acctCfg.PerUser[userID]; hasOverride {
		if override.Blocked {
			return ResolveResult{TrustBase: "low", RiskLevel: "high", Blocked: true}
		}
		if override.TrustBase != nil {
			if isValidTrustLevel(*override.TrustBase) {
				if trustLevelWeight(*override.TrustBase) <= trustLevelWeight(acctTrust) {
					acctTrust = *override.TrustBase
				}
			}
		}
		if override.RiskLevel != nil {
			if isValidRiskLevel(*override.RiskLevel) {
				if riskLevelWeight(*override.RiskLevel) >= riskLevelWeight(acctRisk) {
					acctRisk = *override.RiskLevel
				}
			}
		}
		return ResolveResult{
			TrustBase:     acctTrust,
			RiskLevel:     acctRisk,
			Blocked:       false,
			Nickname:      override.Nickname,
			DirectAllowed: direct(acctTrust, acctRisk),
		}
	}

	// 白名单检查：在白名单中时 trust 提升到至少 medium
	for _, allowedID := range acctCfg.AllowList {
		if strings.TrimSpace(allowedID) == userID {
			if trustLevelWeight(acctTrust) < trustLevelWeight("medium") {
				acctTrust = "medium"
			}
			break
		}
	}

	return ResolveResult{
		TrustBase:     acctTrust,
		RiskLevel:     acctRisk,
		Blocked:       false,
		DirectAllowed: direct(acctTrust, acctRisk),
	}
}

func normalizeLevel(value, fallback string, validFn func(string) bool) string {
	if validFn(value) {
		return value
	}
	return fallback
}

func trustLevelWeight(t string) int {
	switch t {
	case "low":
		return 0
	case "medium":
		return 1
	case "high":
		return 2
	default:
		return -1
	}
}

func riskLevelWeight(r string) int {
	switch r {
	case "low":
		return 0
	case "medium":
		return 1
	case "high":
		return 2
	default:
		return -1
	}
}
