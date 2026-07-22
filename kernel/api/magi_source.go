package api

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type magiSourceAuthError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *magiSourceAuthError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type sourceKeyProfile struct {
	KeyID                string
	PrincipalID          string
	AllowedChannels      map[types.SourceChannel]struct{}
	DefaultChannel       types.SourceChannel
	AllowedModelPrefixes []string
	DefaultInterfaceKind string
	TrustBase            types.TrustLevel
	RiskLevel            types.TrustLevel
	AuthStrength         types.AuthStrength
}

type interfaceIdentity struct {
	PrincipalID    string
	InterfaceID    string
	InterfaceKind  string
	ConversationID string
}

func writeMagiSourceAuthError(c *gin.Context, authErr *magiSourceAuthError) {
	if authErr == nil {
		return
	}
	statusCode := authErr.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusUnauthorized
	}
	c.JSON(statusCode, gin.H{
		"error": authErr.Message,
		"code":  authErr.Code,
	})
}

func resolveOpenAISourceContext(c *gin.Context, req *openai.ChatCompletionRequest) (*types.RequestSourceContext, *magiSourceAuthError) {
	sourcePayload := extractSourcePayloadFromOpenAIMessages(req.Messages)
	identityRaw := strings.TrimSpace(req.User)
	return buildRequestSourceContext(c, req.Model, identityRaw, sourcePayload)
}

func resolveClaudeSourceContext(c *gin.Context, req *anthropic.MessagesRequest, rawBody []byte) (*types.RequestSourceContext, *magiSourceAuthError) {
	identityRaw := ""
	if req != nil {
		if rawUserID, ok := req.Metadata["user_id"]; ok {
			identityRaw = strings.TrimSpace(fmt.Sprintf("%v", rawUserID))
		}
	}
	sourcePayload := extractClaudeSourcePayload(rawBody)
	modelName := ""
	if req != nil {
		modelName = strings.TrimSpace(string(req.Model))
	}
	return buildRequestSourceContext(c, modelName, identityRaw, sourcePayload)
}

func buildRequestSourceContext(
	c *gin.Context,
	modelName, identityRaw string,
	sourcePayload map[string]string,
) (*types.RequestSourceContext, *magiSourceAuthError) {
	if sourcePayload == nil {
		sourcePayload = map[string]string{}
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = strings.TrimSpace(defaultMagiModelName())
	}
	if modelName == "" {
		modelName = "magi-default"
	}

	claims, authErr := extractMagiArmorClaimsFromContext(c)
	if authErr != nil {
		return nil, authErr
	}

	identityRecord, authErr := ensureMagiArmorIdentityConsistency(claims)
	if authErr != nil {
		return nil, authErr
	}

	profile := buildArmorSourceProfile(claims, identityRecord)
	channel, authErr := resolveSourceChannel(profile, sourcePayload)
	if authErr != nil {
		return nil, authErr
	}
	expectedChannel := mapRequestChannelToSourceChannel(claims.Chn, claims.Rtc)
	if channel != expectedChannel {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_channel_mismatch",
			Message:    "request channel payload does not match MAGI armor channel",
		}
	}

	if sourcePayloadPrincipal := firstNonEmpty(sourcePayload["principalId"], sourcePayload["principal_id"]); sourcePayloadPrincipal != "" &&
		sourcePayloadPrincipal != claims.Sub {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_identity_mismatch",
			Message:    "request principal does not match MAGI armor identity",
		}
	}

	identity := parseInterfaceIdentity(identityRaw)
	if identity.PrincipalID != "" && identity.PrincipalID != claims.Sub {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_identity_mismatch",
			Message:    "request user principal does not match MAGI armor identity",
		}
	}

	expectedInterfaceKind := defaultInterfaceKindForRequestChannel(claims.Chn)
	interfaceKindMirror := firstNonEmpty(
		identity.InterfaceKind,
		sourcePayload["interfaceKind"],
		sourcePayload["interface_kind"],
	)
	if interfaceKindMirror != "" && expectedInterfaceKind != "" && interfaceKindMirror != expectedInterfaceKind {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_channel_mismatch",
			Message:    "request interface kind does not match MAGI armor channel",
		}
	}

	interfaceKind := firstNonEmpty(
		interfaceKindMirror,
		deriveInterfaceKindFromSourcePayload(sourcePayload),
		expectedInterfaceKind,
		"sdk-client",
	)

	principalID := firstNonEmpty(
		claims.Sub,
		identity.PrincipalID,
	)
	if principalID == "" {
		principalID = "unknown-principal"
	}
	identityID := strings.TrimSpace(claims.Sub)
	if identityID == "" {
		identityID = principalID
	}
	nickname := strings.TrimSpace(claims.Nck)
	if nickname == "" {
		nickname = identityID
	}

	interfaceID := firstNonEmpty(
		identity.InterfaceID,
		sourcePayload["interfaceId"],
		sourcePayload["interface_id"],
		sourcePayload["sourcePanelId"],
		"default-interface",
	)

	conversationID := firstNonEmpty(
		identity.ConversationID,
		sourcePayload["conversationId"],
		sourcePayload["conversation_id"],
	)
	if claims.Chn == magiRequestChannelMainUI {
		// 内置聊天是一个身份级渠道。客户端的面板实例和本地 session 不参与会话归属。
		interfaceKind = magiMainUIChannelID
		interfaceID = magiMainUIChannelID
		conversationID = magiMainUIConversationID(identityID)
	}

	callerID := firstNonEmpty(sourcePayload["callerId"], sourcePayload["caller_id"])
	requestID := firstNonEmpty(
		sourcePayload["requestId"],
		sourcePayload["request_id"],
		strings.TrimSpace(c.GetHeader("X-Request-ID")),
		strings.TrimSpace(c.GetHeader("X-Request-Id")),
		"req-"+gulu.Rand.String(12),
	)

	// trust/risk 只允许在策略画像基线内收敛：
	// 1) 缺失字段 -> 使用画像默认值（默认已是最低可信度）；
	// 2) 提交冲突值 -> 记录冲突并坚持画像默认值，防止请求伪造抬升可信度。
	trustBase, trustConflict := resolveTrustLevel(profile.TrustBase, sourcePayload, "trustBase", "trust_base")
	riskLevel, riskConflict := resolveTrustLevel(profile.RiskLevel, sourcePayload, "riskLevel", "risk_level")
	sourceSessionKey := buildSourceSessionKey(channel, principalID, interfaceID, conversationID)
	directResponseAllowed := channel == types.SourceChannelGuardian &&
		interfaceKind == "magi-main-ui" &&
		trustBase == types.TrustLevelHigh &&
		claims.Chn == magiRequestChannelMainUI

	rawAttributes := map[string]string{
		"model":            modelName,
		"sourceKeyID":      profile.KeyID,
		"clientIP":         c.ClientIP(),
		"userAgent":        strings.TrimSpace(c.GetHeader("User-Agent")),
		"interfaceKindRaw": interfaceKind,
		"requestChannel":   claims.Chn,
		"identityId":       identityID,
		"nickname":         nickname,
		"routeClass":       claims.Rtc,
	}
	if callerID != "" {
		rawAttributes["callerId"] = callerID
	}
	if docID := strings.TrimSpace(claims.Doc); docID != "" {
		rawAttributes["boundDocumentId"] = docID
	}
	if tagName := firstNonEmpty(sourcePayload["__sourceTag"]); tagName != "" {
		rawAttributes["sourceTag"] = tagName
	}
	if trustConflict != "" {
		rawAttributes["trustConflict"] = trustConflict
		logging.LogWarnf("MAGI来源信号冲突（trust）已降级为key绑定值: %s", trustConflict)
	}
	if riskConflict != "" {
		rawAttributes["riskConflict"] = riskConflict
		logging.LogWarnf("MAGI来源信号冲突（risk）已降级为key绑定值: %s", riskConflict)
	}

	return &types.RequestSourceContext{
		RequestID:             requestID,
		Channel:               channel,
		PrincipalID:           principalID,
		IdentityID:            identityID,
		Nickname:              nickname,
		InterfaceID:           interfaceID,
		InterfaceKind:         interfaceKind,
		ConversationID:        conversationID,
		SourceSessionKey:      sourceSessionKey,
		DirectResponseAllowed: directResponseAllowed,
		CallerID:              callerID,
		TrustBase:             trustBase,
		RiskLevel:             riskLevel,
		AuthStrength:          profile.AuthStrength,
		ModelIntent:           resolveModelIntent(modelName),
		RawAttributes:         rawAttributes,
	}, nil
}

// buildArmorSourceProfile 将 MAGI armor 声明映射为来源策略画像。
// 安全基线：当无法获得更高等级鉴权信号时，默认落到最低可信度（Trust=low, Risk=high）。
func buildArmorSourceProfile(claims *magiArmorClaimsV1, identityRecord *magiIdentityRecord) *sourceKeyProfile {
	defaultTrust := types.TrustLevelLow
	defaultRisk := types.TrustLevelHigh
	if identityRecord != nil && identityRecord.RouteClass == magiRouteClassGuardian {
		defaultTrust = types.TrustLevelHigh
		defaultRisk = types.TrustLevelLow
	}

	defaultChannel := mapRequestChannelToSourceChannel(claims.Chn, claims.Rtc)
	allowedChannels := map[types.SourceChannel]struct{}{
		types.SourceChannelExternalAgent: {},
	}
	if defaultChannel == types.SourceChannelSystemCron {
		allowedChannels = map[types.SourceChannel]struct{}{
			types.SourceChannelSystemCron: {},
		}
	}
	if claims.Rtc == magiRouteClassGuardian {
		allowedChannels[types.SourceChannelGuardian] = struct{}{}
	}
	allowedChannels[types.SourceChannelUnknown] = struct{}{}

	return &sourceKeyProfile{
		KeyID:                shortKeyHash(claims.Jti + ":" + claims.Sub),
		PrincipalID:          claims.Sub,
		AllowedChannels:      allowedChannels,
		DefaultChannel:       defaultChannel,
		AllowedModelPrefixes: []string{"*"},
		DefaultInterfaceKind: defaultInterfaceKindForRequestChannel(claims.Chn),
		TrustBase:            defaultTrust,
		RiskLevel:            defaultRisk,
		AuthStrength:         types.AuthStrengthStrong,
	}
}

func workspaceAPIToken() string {
	if model.Conf == nil || model.Conf.Api == nil {
		return ""
	}
	return strings.TrimSpace(model.Conf.Api.Token)
}

func defaultMagiModelName() string {
	if model.Conf == nil || model.Conf.AI == nil || model.Conf.AI.OpenAI == nil {
		return ""
	}
	return strings.TrimSpace(model.Conf.AI.OpenAI.APIModel)
}

func resolveSourceChannel(profile *sourceKeyProfile, sourcePayload map[string]string) (types.SourceChannel, *magiSourceAuthError) {
	if profile == nil {
		return types.SourceChannelUnknown, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_profile_missing",
			Message:    "source key profile missing",
		}
	}

	rawCandidates := []string{
		sourcePayload["channel"],
		sourcePayload["sourceChannel"],
		sourcePayload["source_channel"],
		sourcePayload["source"],
	}

	for _, raw := range rawCandidates {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		channel, ok := parseSourceChannel(raw)
		if !ok {
			continue
		}
		if !isAllowedChannel(profile, channel) {
			return types.SourceChannelUnknown, &magiSourceAuthError{
				StatusCode: http.StatusForbidden,
				Code:       "magi_source_channel_forbidden",
				Message:    fmt.Sprintf("channel [%s] is not allowed by source key policy", channel),
			}
		}
		return channel, nil
	}

	defaultChannel := profile.DefaultChannel
	if defaultChannel == "" {
		defaultChannel = types.SourceChannelUnknown
	}
	if isAllowedChannel(profile, defaultChannel) {
		return defaultChannel, nil
	}

	for channel := range profile.AllowedChannels {
		return channel, nil
	}
	return types.SourceChannelUnknown, &magiSourceAuthError{
		StatusCode: http.StatusForbidden,
		Code:       "magi_source_channel_empty",
		Message:    "source key does not allow any channel",
	}
}

func isAllowedChannel(profile *sourceKeyProfile, channel types.SourceChannel) bool {
	if profile == nil {
		return false
	}
	_, ok := profile.AllowedChannels[channel]
	return ok
}

func parseSourceChannel(raw string) (types.SourceChannel, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "guardian":
		return types.SourceChannelGuardian, true
	case "external-agent", "external_agent", "external",
		"wechat", "discord", "telegram", "slack", "whatsapp":
		return types.SourceChannelExternalAgent, true
	case "system-cron", "system_cron", "cron":
		return types.SourceChannelSystemCron, true
	case "unknown":
		return types.SourceChannelUnknown, true
	default:
		return "", false
	}
}

func parseTrustLevel(raw string) (types.TrustLevel, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "high":
		return types.TrustLevelHigh, true
	case "medium":
		return types.TrustLevelMedium, true
	case "low":
		return types.TrustLevelLow, true
	default:
		return "", false
	}
}

// resolveTrustLevel 解析来源信号中的 trust/risk 字段。
// 当字段缺失或无效时，必须回退到调用方给定默认值；若默认值为空，降级为 low（最低可信度）。
func resolveTrustLevel(defaultLevel types.TrustLevel, sourcePayload map[string]string, keys ...string) (types.TrustLevel, string) {
	if defaultLevel == "" {
		defaultLevel = types.TrustLevelLow
	}
	for _, key := range keys {
		value := strings.TrimSpace(sourcePayload[key])
		if value == "" {
			continue
		}
		if parsed, ok := parseTrustLevel(value); ok {
			if parsed != defaultLevel {
				return defaultLevel, fmt.Sprintf("payload(%s=%s)->profile(%s)", key, parsed, defaultLevel)
			}
			return defaultLevel, ""
		}
	}
	return defaultLevel, ""
}

func parseInterfaceIdentity(raw string) interfaceIdentity {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return interfaceIdentity{}
	}

	if strings.HasPrefix(raw, "{") {
		parsed := map[string]interface{}{}
		if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
			return interfaceIdentity{
				PrincipalID: firstNonEmpty(
					normalizeToString(parsed["principal"]),
					normalizeToString(parsed["principalId"]),
					normalizeToString(parsed["principal_id"]),
				),
				InterfaceID: firstNonEmpty(
					normalizeToString(parsed["interface"]),
					normalizeToString(parsed["interfaceId"]),
					normalizeToString(parsed["interface_id"]),
				),
				InterfaceKind: firstNonEmpty(
					normalizeToString(parsed["kind"]),
					normalizeToString(parsed["interfaceKind"]),
					normalizeToString(parsed["interface_kind"]),
				),
				ConversationID: firstNonEmpty(
					normalizeToString(parsed["conversation"]),
					normalizeToString(parsed["conversationId"]),
					normalizeToString(parsed["conversation_id"]),
				),
			}
		}
	}

	segments := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ';' || r == ','
	})
	if len(segments) == 0 {
		return interfaceIdentity{PrincipalID: raw}
	}

	result := interfaceIdentity{}
	for _, segment := range segments {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}
		key, value, ok := splitKeyValue(segment)
		if !ok {
			continue
		}
		switch normalizeFieldKey(key) {
		case "principal", "principalid":
			result.PrincipalID = firstNonEmpty(result.PrincipalID, value)
		case "interface", "interfaceid":
			result.InterfaceID = firstNonEmpty(result.InterfaceID, value)
		case "kind", "interfacekind":
			result.InterfaceKind = firstNonEmpty(result.InterfaceKind, value)
		case "conversation", "conversationid":
			result.ConversationID = firstNonEmpty(result.ConversationID, value)
		}
	}

	if result.PrincipalID == "" && !strings.Contains(raw, ":") && !strings.Contains(raw, "=") {
		result.PrincipalID = raw
	}
	return result
}

func normalizeFieldKey(key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.ReplaceAll(key, "_", "")
	key = strings.ReplaceAll(key, "-", "")
	return key
}

func splitKeyValue(segment string) (string, string, bool) {
	if strings.Contains(segment, ":") {
		parts := strings.SplitN(segment, ":", 2)
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), true
	}
	if strings.Contains(segment, "=") {
		parts := strings.SplitN(segment, "=", 2)
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), true
	}
	return "", "", false
}

func normalizeToString(value interface{}) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", value))
}

func extractSourcePayloadFromOpenAIMessages(messages []openai.ChatCompletionMessage) map[string]string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role != openai.ChatMessageRoleSystem {
			continue
		}
		if payload, ok := extractSourcePayloadFromText(messages[i].Content); ok {
			return payload
		}
	}
	return map[string]string{}
}

func extractClaudeSystemBlocks(rawBody []byte) []string {
	if len(rawBody) == 0 {
		return nil
	}

	var envelope map[string]interface{}
	if err := json.Unmarshal(rawBody, &envelope); err != nil {
		return nil
	}

	system, ok := envelope["system"]
	if !ok || system == nil {
		return nil
	}

	var blocks []string
	switch value := system.(type) {
	case string:
		if text := strings.TrimSpace(value); text != "" {
			blocks = append(blocks, text)
		}
	case []interface{}:
		for _, item := range value {
			switch node := item.(type) {
			case string:
				if text := strings.TrimSpace(node); text != "" {
					blocks = append(blocks, text)
				}
			case map[string]interface{}:
				if textValue, ok := node["text"]; ok {
					if text := strings.TrimSpace(fmt.Sprintf("%v", textValue)); text != "" {
						blocks = append(blocks, text)
					}
				}
			}
		}
	}
	return blocks
}

func extractClaudeSourcePayload(rawBody []byte) map[string]string {
	blocks := extractClaudeSystemBlocks(rawBody)
	for i := len(blocks) - 1; i >= 0; i-- {
		if payload, ok := extractSourcePayloadFromText(blocks[i]); ok {
			return payload
		}
	}
	return map[string]string{}
}

func extractSourcePayloadFromText(text string) (map[string]string, bool) {
	type taggedPayload struct {
		Start int
		Tag   string
		Body  string
	}

	tags := []string{"request_source", "magi_request_source"}
	var latest *taggedPayload
	for _, tag := range tags {
		openTag := "<" + tag + ">"
		closeTag := "</" + tag + ">"
		start := strings.LastIndex(text, openTag)
		if start < 0 {
			continue
		}
		contentStart := start + len(openTag)
		endOffset := strings.Index(text[contentStart:], closeTag)
		if endOffset < 0 {
			continue
		}
		body := strings.TrimSpace(text[contentStart : contentStart+endOffset])
		if body == "" {
			continue
		}
		if latest == nil || start > latest.Start {
			latest = &taggedPayload{
				Start: start,
				Tag:   tag,
				Body:  body,
			}
		}
	}

	if latest == nil {
		return nil, false
	}

	payload := parseSourcePayloadJSON(latest.Body)
	if len(payload) == 0 {
		return nil, false
	}
	payload["__sourceTag"] = latest.Tag
	return payload, true
}

func parseSourcePayloadJSON(raw string) map[string]string {
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return map[string]string{}
	}

	result := map[string]string{}
	for key, value := range payload {
		if value == nil {
			continue
		}
		switch typed := value.(type) {
		case string:
			if text := strings.TrimSpace(typed); text != "" {
				result[key] = text
			}
		default:
			asText := strings.TrimSpace(fmt.Sprintf("%v", typed))
			if asText != "" {
				result[key] = asText
			}
		}
	}
	return result
}

func deriveInterfaceKindFromSourcePayload(sourcePayload map[string]string) string {
	if sourcePayload["sourcePanelId"] != "" || sourcePayload["source_panel_id"] != "" {
		return "magi-source-panel"
	}
	if sourcePayload["profileId"] != "" || sourcePayload["profile_id"] != "" {
		return "magi-source-panel"
	}
	if sourcePayload["source"] == "external-agent" {
		return "siyuan-note-upstream"
	}
	return ""
}

func mapRequestChannelToSourceChannel(requestChannel, routeClass string) types.SourceChannel {
	switch requestChannel {
	case magiRequestChannelSystemCron:
		return types.SourceChannelSystemCron
	case magiRequestChannelMainUI:
		if routeClass == magiRouteClassGuardian {
			return types.SourceChannelGuardian
		}
		return types.SourceChannelExternalAgent
	default:
		return types.SourceChannelExternalAgent
	}
}

func defaultInterfaceKindForRequestChannel(requestChannel string) string {
	switch requestChannel {
	case magiRequestChannelMainUI:
		return "magi-main-ui"
	case magiRequestChannelToolClaude:
		return "tool-claude-code"
	case magiRequestChannelToolOpenAI:
		return "tool-openai-sdk"
	case magiRequestChannelToolAnthropic:
		return "tool-claude-sdk"
	case magiRequestChannelSystemCron:
		return "system-cron-job"
	case magiRequestChannelToolCustom:
		return "tool-custom"
	default:
		return "sdk-client"
	}
}

func buildSourceSessionKey(channel types.SourceChannel, principalID, interfaceID, conversationID string) string {
	builder := strings.Builder{}
	builder.WriteString(string(channel))
	builder.WriteString(":")
	builder.WriteString(principalID)
	builder.WriteString(":")
	builder.WriteString(interfaceID)
	if conversationID != "" {
		builder.WriteString(":")
		builder.WriteString(conversationID)
	}
	return builder.String()
}

func resolveModelIntent(modelName string) string {
	normalized := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case strings.Contains(normalized, "magi-coding"):
		return "coding"
	case strings.Contains(normalized, "magi-review"):
		return "review"
	case strings.Contains(normalized, "avatar"):
		return "avatar"
	case strings.Contains(normalized, "cron"):
		return "system-cron"
	case strings.Contains(normalized, "magi"), strings.Contains(normalized, "trinity"), normalized == "":
		return "magi-trinity"
	default:
		return "general"
	}
}

func shortKeyHash(sourceKey string) string {
	sum := sha256.Sum256([]byte(sourceKey))
	return fmt.Sprintf("%x", sum[:6])
}

func firstNonEmpty(candidates ...string) string {
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" {
			return candidate
		}
	}
	return ""
}
