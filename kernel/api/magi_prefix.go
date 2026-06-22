package api

import (
	"fmt"
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prefix"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// prefixConfigMgr 前缀指令配置管理器，在 initPrefixDispatcher 中初始化。
var prefixConfigMgr *prefix.ConfigManager

// prefixList 列出所有已注册的前缀指令。
func prefixList(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	if prefixConfigMgr == nil {
		ret.Code = -1
		ret.Msg = "prefix dispatcher not initialized"
		return
	}
	ret.Data = prefixConfigMgr.GetCommands()
}

// prefixCreate 新增或更新一个前缀指令。
func prefixCreate(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	cmd, err := parsePrefixCommandFromArg(arg)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	if err := prefixConfigMgr.UpsertCommand(cmd); err != nil {
		ret.Code = -1
		ret.Msg = "保存失败: " + err.Error()
		return
	}

	// 热更新 dispatcher 中的指令列表
	if prefixDispatcher != nil {
		prefixDispatcher.SetCommands(prefixConfigMgr.GetCommands())
	}

	ret.Data = cmd
}

// prefixUpdate 更新一个前缀指令（与 create 相同语义，ID 已存在则覆盖）。
func prefixUpdate(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	cmd, err := parsePrefixCommandFromArg(arg)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	if err := prefixConfigMgr.UpsertCommand(cmd); err != nil {
		ret.Code = -1
		ret.Msg = "保存失败: " + err.Error()
		return
	}

	if prefixDispatcher != nil {
		prefixDispatcher.SetCommands(prefixConfigMgr.GetCommands())
	}

	ret.Data = cmd
}

// prefixDelete 删除一个前缀指令。
func prefixDelete(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	id, ok := arg["id"].(string)
	if !ok || id == "" {
		ret.Code = -1
		ret.Msg = "id 不能为空"
		return
	}

	if err := prefixConfigMgr.DeleteCommand(id); err != nil {
		ret.Code = -1
		ret.Msg = "删除失败: " + err.Error()
		return
	}

	if prefixDispatcher != nil {
		prefixDispatcher.SetCommands(prefixConfigMgr.GetCommands())
	}
}

// prefixTest 测试前缀匹配，返回匹配结果但不执行指令。
func prefixTest(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	text, ok := arg["text"].(string)
	if !ok || text == "" {
		ret.Code = -1
		ret.Msg = "text 不能为空"
		return
	}

	if prefixDispatcher == nil {
		ret.Code = -1
		ret.Msg = "prefix dispatcher not initialized"
		return
	}

	match := prefixDispatcher.Match(text)
	if match == nil {
		ret.Data = map[string]any{"matched": false}
		return
	}
	ret.Data = map[string]any{
		"matched":  true,
		"command":  match.Command,
		"prefix":   match.Prefix,
		"args":     match.Args,
	}
}

// parsePrefixCommandFromArg 从请求参数解析 PrefixCommand 结构。
func parsePrefixCommandFromArg(arg map[string]any) (*prefix.PrefixCommand, error) {
	id, _ := arg["id"].(string)
	if id == "" {
		return nil, fmt.Errorf("id 不能为空")
	}

	cmd := &prefix.PrefixCommand{
		ID:      id,
		Enabled: true,
	}

	// prefixes
	if prefixesVal, ok := arg["prefixes"]; ok {
		if arr, ok2 := prefixesVal.([]any); ok2 {
			for _, p := range arr {
				if s, ok3 := p.(string); ok3 {
					cmd.Prefixes = append(cmd.Prefixes, s)
				}
			}
		}
	}
	if len(cmd.Prefixes) == 0 {
		return nil, fmt.Errorf("prefixes 不能为空")
	}

	cmd.Description, _ = arg["description"].(string)
	cmd.Builtin, _ = arg["builtin"].(string)

	// handlerKind
	handlerKind, _ := arg["handlerKind"].(string)
	if handlerKind == "" {
		handlerKind = "go"
	}
	cmd.HandlerKind = prefix.HandlerKind(handlerKind)

	// notifyMagi
	if notifyVal, ok := arg["notifyMagi"]; ok {
		cmd.NotifyMagi, _ = notifyVal.(bool)
	}

	// trustLevel
	trustLevel, _ := arg["trustLevel"].(string)
	if trustLevel == "" {
		trustLevel = "low"
	}
	cmd.TrustLevel = channelTrustLevel(trustLevel)

	// enabled
	if enabledVal, ok := arg["enabled"]; ok {
		cmd.Enabled, _ = enabledVal.(bool)
	}

	// metadata
	if metaVal, ok := arg["metadata"]; ok {
		if m, ok2 := metaVal.(map[string]any); ok2 {
			cmd.Metadata = m
		}
	}

	return cmd, nil
}

// channelTrustLevel 将字符串转换为 channel.TrustLevel。
func channelTrustLevel(s string) channel.TrustLevel {
	switch s {
	case "medium":
		return channel.TrustMedium
	case "high":
		return channel.TrustHigh
	default:
		return channel.TrustLow
	}
}
