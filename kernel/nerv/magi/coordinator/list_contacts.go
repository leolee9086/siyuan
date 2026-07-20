package coordinator

import (
	"encoding/json"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/trust"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type listMagiContactsArgs struct {
	ChannelID string `json:"channelId,omitempty"`
}

type listMagiContactsResultExecutor struct{}

func newListMagiContactsResultExecutor() *listMagiContactsResultExecutor {
	return &listMagiContactsResultExecutor{}
}

func (e *listMagiContactsResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.ListMagiContactsToolName {
		return "", false, nil
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if _, err := requireExplicitToolPurpose(rawArgs, config.ListMagiContactsToolName); err != nil {
		return "", true, err
	}
	var args listMagiContactsArgs
	if rawArgs != "" {
		_ = json.Unmarshal([]byte(rawArgs), &args)
	}
	args.ChannelID = strings.TrimSpace(args.ChannelID)

	provider := trust.DefaultConfigProvider
	if provider == nil {
		return `{"ok":false,"contacts":[],"error":"trust config provider not initialized"}`, true, nil
	}

	cfg := provider()
	if cfg == nil || cfg.Channels == nil {
		return `{"ok":true,"contacts":[]}`, true, nil
	}

	type contactView struct {
		ChannelID          string `json:"channelId"`
		AccountID          string `json:"accountId"`
		UserID             string `json:"userId"`
		Nickname           string `json:"nickname,omitempty"`
		TrustBase          string `json:"trustBase,omitempty"`
		RiskLevel          string `json:"riskLevel,omitempty"`
		Blocked            bool   `json:"blocked"`
		IdentityLabel      string `json:"identityLabel,omitempty"`
		IdentityDisplayName string `json:"identityDisplayName,omitempty"`
	}
	contacts := []contactView{}
	seen := map[string]bool{}

	addContact := func(channelID, accountID, userID, nickname, trustBase, riskLevel string, blocked bool) {
		key := channelID + "|" + accountID + "|" + userID
		if seen[key] {
			return
		}
		seen[key] = true
		cv := contactView{
			ChannelID: channelID,
			AccountID: accountID,
			UserID:    userID,
			Nickname:  nickname,
			TrustBase: trustBase,
			RiskLevel: riskLevel,
			Blocked:   blocked,
		}
		if resolver := trust.DefaultChannelIdentityResolver; resolver != nil {
			label, disp := resolver(channelID, accountID, userID)
			cv.IdentityLabel = label
			cv.IdentityDisplayName = disp
		}
		contacts = append(contacts, cv)
	}

	// 1. 从信任配置 PerUser 覆盖条目收集
	for channelID, chanCfg := range cfg.Channels {
		if args.ChannelID != "" && !strings.EqualFold(channelID, args.ChannelID) {
			continue
		}
		if !chanCfg.Enabled {
			continue
		}
		for accountID, acctCfg := range chanCfg.PerAccount {
			for userID, override := range acctCfg.PerUser {
				addContact(channelID, accountID, userID,
					override.Nickname,
					safeDerefStr(override.TrustBase),
					safeDerefStr(override.RiskLevel),
					override.Blocked)
			}
		}
	}

	// 2. 从身份存储 channelBindings 收集（trust 配置中没有覆盖但绑定了身份的用户）
	if enumerator := trust.DefaultChannelBindingEnumerator; enumerator != nil {
		for _, bi := range enumerator() {
			if args.ChannelID != "" && !strings.EqualFold(bi.ChannelID, args.ChannelID) {
				continue
			}
			addContact(bi.ChannelID, bi.AccountID, bi.UserID,
				bi.DisplayName, "", "", false)
		}
	}

	if contacts == nil {
		contacts = []contactView{}
	}

	payload := map[string]interface{}{
		"ok":       true,
		"contacts": contacts,
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return `{"ok":false,"error":"failed to marshal contact list"}`, true, nil
	}
	return string(resultBytes), true, nil
}

func safeDerefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
