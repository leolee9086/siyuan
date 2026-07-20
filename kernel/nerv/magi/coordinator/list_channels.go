package coordinator

import (
	"encoding/json"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type listMagiChannelsResultExecutor struct{}

func newListMagiChannelsResultExecutor() *listMagiChannelsResultExecutor {
	return &listMagiChannelsResultExecutor{}
}

func (e *listMagiChannelsResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.ListMagiChannelsToolName {
		return "", false, nil
	}
	if _, err := requireExplicitToolPurpose(toolCall.Function.Arguments, config.ListMagiChannelsToolName); err != nil {
		return "", true, err
	}

	adapters := channel.All()
	type channelView struct {
		ID            string   `json:"id"`
		Connected     bool     `json:"connected"`
		AccountID     string   `json:"accountId,omitempty"`
		UserCount     int      `json:"userCount"`
		Capabilities []string `json:"capabilities"`
		LastMessageAt string   `json:"lastMessageAt,omitempty"`
		Error         string   `json:"error,omitempty"`
	}
	views := make([]channelView, 0, len(adapters))
	for _, a := range adapters {
		s := a.Status()
		lastMsg := ""
		if !s.LastMessageAt.IsZero() {
			lastMsg = s.LastMessageAt.Format("2006-01-02T15:04:05Z07:00")
		}
		caps := []string{}
		if a.Capabilities().Has(channel.CapReceive) {
			caps = append(caps, "receive")
		}
		if a.Capabilities().Has(channel.CapProactiveSend) {
			caps = append(caps, "proactive_send")
		}
		views = append(views, channelView{
			ID:            s.ID,
			Connected:     s.Connected,
			AccountID:     s.AccountID,
			UserCount:     s.UserCount,
			Capabilities: caps,
			LastMessageAt: lastMsg,
			Error:         s.Error,
		})
	}
	if views == nil {
		views = []channelView{}
	}

	payload := map[string]interface{}{
		"ok":       true,
		"channels": views,
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return `{"ok":false,"error":"failed to marshal channel list"}`, true, nil
	}
	return string(resultBytes), true, nil
}

