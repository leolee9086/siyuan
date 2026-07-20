package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type fetchChannelMessagesArgs struct {
	ChannelID string `json:"channelId"`
	AccountID string `json:"accountId"`
	UserID    string `json:"userId,omitempty"`
	Limit     int    `json:"limit,omitempty"`
	Before    int64  `json:"before,omitempty"`
	Direction string `json:"direction,omitempty"`
}

type fetchChannelMessagesResultExecutor struct{}

func newFetchChannelMessagesResultExecutor() *fetchChannelMessagesResultExecutor {
	return &fetchChannelMessagesResultExecutor{}
}

func (e *fetchChannelMessagesResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.FetchChannelMessagesToolName {
		return "", false, nil
	}
	if _, err := requireExplicitToolPurpose(toolCall.Function.Arguments, config.FetchChannelMessagesToolName); err != nil {
		return "", true, err
	}

	args, err := parseFetchChannelMessagesArgs(toolCall.Function.Arguments)
	if err != nil {
		return marshalFetchChannelMessagesError(err), true, nil
	}
	if strings.TrimSpace(args.ChannelID) == "" {
		return marshalFetchChannelMessagesError(fmt.Errorf("channelId 不能为空")), true, nil
	}
	if strings.TrimSpace(args.AccountID) == "" {
		return marshalFetchChannelMessagesError(fmt.Errorf("accountId 不能为空")), true, nil
	}

	store := channel.GlobalMessageStore()
	if store == nil {
		return marshalFetchChannelMessagesError(fmt.Errorf("message store 未初始化")), true, nil
	}

	var dir channel.MessageDirection
	switch strings.ToLower(strings.TrimSpace(args.Direction)) {
	case "inbound":
		dir = channel.DirInbound
	case "outbound":
		dir = channel.DirOutbound
	}

	queryResult, err := store.Query(context.Background(), channel.QueryOptions{
		ChannelID: strings.TrimSpace(args.ChannelID),
		AccountID: strings.TrimSpace(args.AccountID),
		UserID:    strings.TrimSpace(args.UserID),
		Limit:     args.Limit,
		Before:    args.Before,
		Direction: dir,
	})
	if err != nil {
		return marshalFetchChannelMessagesError(err), true, nil
	}

	payload := map[string]interface{}{
		"ok":        true,
		"messages":  queryResult.Messages,
		"total":     queryResult.Total,
		"hasMore":   queryResult.HasMore,
		"oldestAt":  queryResult.OldestAt,
		"newestAt":  queryResult.NewestAt,
		"channelId": args.ChannelID,
		"accountId": args.AccountID,
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return marshalFetchChannelMessagesError(marshalErr), true, nil
	}
	return string(resultBytes), true, nil
}

func parseFetchChannelMessagesArgs(rawArgs string) (*fetchChannelMessagesArgs, error) {
	rawArgs = strings.TrimSpace(rawArgs)
	if rawArgs == "" {
		return nil, fmt.Errorf("%s 参数不能为空", config.FetchChannelMessagesToolName)
	}

	var args fetchChannelMessagesArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return nil, fmt.Errorf("%s 参数解析失败: %w", config.FetchChannelMessagesToolName, err)
	}

	return &args, nil
}

func marshalFetchChannelMessagesError(err error) string {
	payload := map[string]interface{}{
		"ok":    false,
		"error": err.Error(),
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return `{"ok":false}`
	}
	return string(resultBytes)
}
