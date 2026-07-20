package config

// ── 外部渠道工具 ──

const (
	SendChannelMessageToolName  = "send_channel_message"
	ListMagiChannelsToolName    = "list_magi_channels"
	ListMagiContactsToolName    = "list_magi_contacts"
	FetchChannelMessagesToolName = "fetch_channel_messages"
)

// BuildSendChannelMessageToolDef 构建主动发送渠道消息工具定义。
func BuildSendChannelMessageToolDef() ToolDef {
	return AddMotivationParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SendChannelMessageToolName,
			Description: "主动向可主动渠道（微信等）上特定用户发送消息。先使用 list_magi_contacts 查找收件人的 channelId、accountId 和 userId。调用时必须先明确填写本次行动动机，系统会把动机、消息内容和目标用户交给专家团队结合完整上下文复核；若连续两次未获批准，当前轮次将改由其他处理路径继续。消息内容应简洁、人性化，适合在即时通讯平台上阅读。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
				"channelId": map[string]interface{}{
					"type":        "string",
					"description": "目标渠道 ID，由 list_magi_channels 返回的 id 字段，如 wechat-abc123",
				},
				"accountId": map[string]interface{}{
					"type":        "string",
					"description": "目标账号 ID，对应渠道中的登录账户",
				},
				"userId": map[string]interface{}{
					"type":        "string",
					"description": "目标用户 ID，要发送给的具体用户",
				},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "要发送的消息正文内容。保持简洁自然，适合在即时通讯平台阅读。",
					},
				},
				"required": []string{"channelId", "accountId", "userId", "content"},
			},
		},
		Meta: ToolMeta{
			SendsExternalMessage: true,
			RemindPolicy: &ToolRemindPolicy{
				AfterRounds: 10,
				Templates: map[uint64]string{
					10: "⚠️ 你已经连续 {elapsed} 轮没有主动联系外部联系人了，长时间未联系可能会被认为失联。上一次联系时间：{lastTime}，理由：{motivation}。请考虑是否应该联系。",
					20: "🔴 你已经连续 {elapsed} 轮没有主动联系外部联系人了。上一次联系已是 {lastTime}，理由：{motivation}。强烈建议尽快联系。",
				},
				ContextKeys: []string{"motivation"},
			},
		},
	})
}

// BuildListMagiChannelsToolDef 构建列出所有已注册外部渠道的工具定义。
func BuildListMagiChannelsToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ListMagiChannelsToolName,
			Description: "列出所有已注册的外部消息渠道（如微信等即时通讯平台）及其运行状态，包括渠道 ID、连接状态、账号 ID、用户数、能力（receive/proactive_send）等。可通过返回的渠道 ID 配合 list_magi_contacts 查找联系人，或作为 send_channel_message 的 channelId 参数。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	})
}

// BuildFetchChannelMessagesToolDef 构建查看指定渠道最近消息的工具定义。
func BuildFetchChannelMessagesToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        FetchChannelMessagesToolName,
			Description: "查看指定渠道的最近消息记录。先使用 list_magi_channels 确认可用的 channelId 和 accountId。返回按时间倒序排列的消息列表，支持按用户、方向筛选和游标分页。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
				"channelId": map[string]interface{}{
					"type":        "string",
					"description": "目标渠道 ID，由 list_magi_channels 返回的 id 字段，如 wechat-abc123",
				},
				"accountId": map[string]interface{}{
					"type":        "string",
					"description": "目标账号 ID，对应渠道中的登录账户",
				},
					"userId": map[string]interface{}{
						"type":        "string",
						"description": "可选，按用户 ID 筛选消息",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "返回条数，默认 20，最大 100",
						"minimum":     1,
						"maximum":     100,
					},
					"before": map[string]interface{}{
						"type":        "integer",
						"description": "游标，获取此 Unix 毫秒时间戳之前的消息（用于分页向前翻）",
					},
					"direction": map[string]interface{}{
						"type":        "string",
						"description": "可选，筛选消息方向：inbound（收到的消息）或 outbound（发送的消息）",
						"enum":        []string{"inbound", "outbound"},
					},
				},
				"required": []string{"channelId", "accountId"},
			},
		},
	})
}

// BuildListMagiContactsToolDef 构建列出所有已知外部联系人的工具定义。
func BuildListMagiContactsToolDef() ToolDef {
	return AddPurposeParam(ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        ListMagiContactsToolName,
			Description: "列出所有已知的外部联系人（通过外部消息渠道交互过或绑定了身份的用户），包括所属渠道、账号 ID、用户 ID、昵称、身份标签、显示名、信任等级、风险等级等。发送消息前应先调用此工具查找收件人的 userId、channelId 和 accountId，再传给 send_channel_message。可选参数 channelId 用于筛选特定渠道的联系人。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"channelId": map[string]interface{}{
						"type":        "string",
						"description": "可选，要筛选的渠道 ID，如 wechat。不传则返回所有渠道的联系人。",
					},
				},
			},
		},
	})
}
