package api

import (
	"crypto/sha256"
	"encoding/base64"
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

type sourceKeyClaimsV1 struct {
	Principal     string   `json:"principal"`
	Channels      []string `json:"channels"`
	Models        []string `json:"models"`
	InterfaceKind string   `json:"interfaceKind"`
	TrustBase     string   `json:"trustBase"`
	RiskLevel     string   `json:"riskLevel"`
	AuthStrength  string   `json:"authStrength"`
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
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = strings.TrimSpace(defaultMagiModelName())
	}
	if modelName == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_model_required",
			Message:    "model is required for source authentication",
		}
	}

	sourceKey := extractMagiSourceKey(c)
	if sourceKey == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_missing",
			Message:    "missing MAGI source key",
		}
	}

	profile, authErr := resolveSourceKeyProfile(sourceKey)
	if authErr != nil {
		return nil, authErr
	}

	if !isModelAllowed(profile, modelName) {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_model_not_allowed",
			Message:    fmt.Sprintf("model [%s] is not allowed by source key policy", modelName),
		}
	}

	channel, authErr := resolveSourceChannel(profile, sourcePayload)
	if authErr != nil {
		return nil, authErr
	}

	identity := parseInterfaceIdentity(identityRaw)
	principalID := firstNonEmpty(
		identity.PrincipalID,
		strings.TrimSpace(c.GetHeader("X-MAGI-Principal-ID")),
		sourcePayload["principalId"],
		sourcePayload["principal_id"],
		profile.PrincipalID,
	)
	if principalID == "" {
		principalID = "unknown-principal"
	}

	interfaceID := firstNonEmpty(
		identity.InterfaceID,
		strings.TrimSpace(c.GetHeader("X-MAGI-Interface-ID")),
		sourcePayload["interfaceId"],
		sourcePayload["interface_id"],
		sourcePayload["sourcePanelId"],
		"default-interface",
	)

	defaultKind := profile.DefaultInterfaceKind
	if defaultKind == "" {
		defaultKind = "sdk-client"
	}
	interfaceKind := firstNonEmpty(
		identity.InterfaceKind,
		strings.TrimSpace(c.GetHeader("X-MAGI-Interface-Kind")),
		sourcePayload["interfaceKind"],
		sourcePayload["interface_kind"],
		deriveInterfaceKindFromSourcePayload(sourcePayload),
		defaultKind,
	)

	conversationID := firstNonEmpty(
		identity.ConversationID,
		strings.TrimSpace(c.GetHeader("X-MAGI-Conversation-ID")),
		sourcePayload["conversationId"],
		sourcePayload["conversation_id"],
	)

	callerID := firstNonEmpty(sourcePayload["callerId"], sourcePayload["caller_id"])
	requestID := firstNonEmpty(
		sourcePayload["requestId"],
		sourcePayload["request_id"],
		strings.TrimSpace(c.GetHeader("X-Request-ID")),
		"req-"+gulu.Rand.String(12),
	)

	trustBase, trustConflict := resolveTrustLevel(profile.TrustBase, sourcePayload, "trustBase", "trust_base")
	riskLevel, riskConflict := resolveTrustLevel(profile.RiskLevel, sourcePayload, "riskLevel", "risk_level")
	sourceSessionKey := buildSourceSessionKey(channel, principalID, interfaceID, conversationID)
	isSourceSimulation := isSourceSimulationPayload(sourcePayload)
	directResponseAllowed := channel == types.SourceChannelGuardian &&
		interfaceKind == "magi-main-ui" &&
		trustBase == types.TrustLevelHigh
	if interfaceKind == "magi-main-ui" && !isSourceSimulation && !directResponseAllowed {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_main_ui_direct_required",
			Message:    "magi-main-ui request must satisfy direct-main policy (guardian + high trust)",
		}
	}

	rawAttributes := map[string]string{
		"model":            modelName,
		"sourceKeyID":      profile.KeyID,
		"clientIP":         c.ClientIP(),
		"userAgent":        strings.TrimSpace(c.GetHeader("User-Agent")),
		"interfaceKindRaw": interfaceKind,
	}
	if callerID != "" {
		rawAttributes["callerId"] = callerID
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

func extractMagiSourceKey(c *gin.Context) string {
	headerCandidates := []string{
		"X-MAGI-Source-Key",
		"X-API-Key",
	}
	for _, header := range headerCandidates {
		if value := strings.TrimSpace(c.GetHeader(header)); value != "" {
			return value
		}
	}

	if authHeader := strings.TrimSpace(c.GetHeader("Authorization")); authHeader != "" {
		if token := extractToken(authHeader); token != "" {
			return token
		}
	}

	if queryValue := strings.TrimSpace(c.Query("magi_source_key")); queryValue != "" {
		return queryValue
	}
	return ""
}

func extractToken(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	for _, prefix := range []string{"Bearer ", "bearer ", "Token ", "token "} {
		if strings.HasPrefix(value, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(value, prefix))
		}
	}
	return value
}

func resolveSourceKeyProfile(sourceKey string) (*sourceKeyProfile, *magiSourceAuthError) {
	sourceKey = strings.TrimSpace(sourceKey)
	if sourceKey == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_missing",
			Message:    "missing MAGI source key",
		}
	}

	apiToken := workspaceAPIToken()
	if apiToken != "" && sourceKey == apiToken {
		return &sourceKeyProfile{
			KeyID:                shortKeyHash(sourceKey),
			PrincipalID:          "workspace-admin",
			AllowedChannels:      sourceChannelsSet(types.SourceChannelGuardian, types.SourceChannelExternalAgent, types.SourceChannelSystemCron, types.SourceChannelUnknown),
			DefaultChannel:       types.SourceChannelGuardian,
			AllowedModelPrefixes: []string{"*"},
			DefaultInterfaceKind: "magi-main-ui",
			TrustBase:            types.TrustLevelHigh,
			RiskLevel:            types.TrustLevelLow,
			AuthStrength:         types.AuthStrengthMedium,
		}, nil
	}

	if strings.HasPrefix(sourceKey, "magi_sk_v1_") {
		return resolveV1SourceKeyProfile(sourceKey)
	}

	if strings.HasPrefix(sourceKey, "magi.") {
		return resolveLegacySourceKeyProfile(sourceKey)
	}

	return nil, &magiSourceAuthError{
		StatusCode: http.StatusUnauthorized,
		Code:       "magi_source_key_invalid",
		Message:    "invalid MAGI source key",
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

func resolveV1SourceKeyProfile(sourceKey string) (*sourceKeyProfile, *magiSourceAuthError) {
	encoded := strings.TrimPrefix(sourceKey, "magi_sk_v1_")
	decoded, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_decode_failed",
			Message:    "failed to decode MAGI source key",
		}
	}

	var claims sourceKeyClaimsV1
	if err = json.Unmarshal(decoded, &claims); err != nil {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_parse_failed",
			Message:    "failed to parse MAGI source key claims",
		}
	}

	allowedChannels := make(map[types.SourceChannel]struct{})
	defaultChannel := types.SourceChannelUnknown
	for _, rawChannel := range claims.Channels {
		if channel, ok := parseSourceChannel(rawChannel); ok {
			allowedChannels[channel] = struct{}{}
			if defaultChannel == types.SourceChannelUnknown {
				defaultChannel = channel
			}
		}
	}
	if len(allowedChannels) == 0 {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_channel_missing",
			Message:    "MAGI source key has no valid channel claims",
		}
	}

	trust := parseTrustLevelWithFallback(claims.TrustBase, types.TrustLevelMedium)
	risk := parseTrustLevelWithFallback(claims.RiskLevel, types.TrustLevelMedium)
	authStrength := parseAuthStrengthWithFallback(claims.AuthStrength, types.AuthStrengthStrong)
	interfaceKind := strings.TrimSpace(claims.InterfaceKind)
	if interfaceKind == "" {
		interfaceKind = "sdk-client"
	}
	principalID := strings.TrimSpace(claims.Principal)
	if principalID == "" {
		principalID = "unknown-principal"
	}

	modelPrefixes := claims.Models
	if len(modelPrefixes) == 0 {
		modelPrefixes = []string{"*"}
	}

	return &sourceKeyProfile{
		KeyID:                shortKeyHash(sourceKey),
		PrincipalID:          principalID,
		AllowedChannels:      allowedChannels,
		DefaultChannel:       defaultChannel,
		AllowedModelPrefixes: modelPrefixes,
		DefaultInterfaceKind: interfaceKind,
		TrustBase:            trust,
		RiskLevel:            risk,
		AuthStrength:         authStrength,
	}, nil
}

func resolveLegacySourceKeyProfile(sourceKey string) (*sourceKeyProfile, *magiSourceAuthError) {
	parts := strings.Split(sourceKey, ".")
	if len(parts) < 3 {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_legacy_invalid",
			Message:    "legacy MAGI source key format is invalid",
		}
	}

	channel, ok := parseSourceChannel(parts[1])
	if !ok {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_source_key_channel_invalid",
			Message:    "legacy MAGI source key channel is invalid",
		}
	}
	principal := strings.TrimSpace(parts[2])
	if principal == "" {
		principal = "unknown-principal"
	}

	interfaceKind := defaultInterfaceKindForChannel(channel)
	if len(parts) >= 4 {
		if customKind := strings.TrimSpace(parts[3]); customKind != "" {
			interfaceKind = customKind
		}
	}

	trustBase := types.TrustLevelMedium
	riskLevel := types.TrustLevelMedium
	if channel == types.SourceChannelGuardian {
		trustBase = types.TrustLevelHigh
		riskLevel = types.TrustLevelLow
	}

	return &sourceKeyProfile{
		KeyID:                shortKeyHash(sourceKey),
		PrincipalID:          principal,
		AllowedChannels:      sourceChannelsSet(channel),
		DefaultChannel:       channel,
		AllowedModelPrefixes: []string{"*"},
		DefaultInterfaceKind: interfaceKind,
		TrustBase:            trustBase,
		RiskLevel:            riskLevel,
		AuthStrength:         types.AuthStrengthStrong,
	}, nil
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

func isModelAllowed(profile *sourceKeyProfile, modelName string) bool {
	if profile == nil {
		return false
	}
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if modelName == "" {
		return false
	}
	for _, prefix := range profile.AllowedModelPrefixes {
		prefix = strings.ToLower(strings.TrimSpace(prefix))
		if prefix == "*" {
			return true
		}
		if prefix != "" && strings.HasPrefix(modelName, prefix) {
			return true
		}
	}
	return false
}

func parseSourceChannel(raw string) (types.SourceChannel, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "guardian":
		return types.SourceChannelGuardian, true
	case "external-agent", "external_agent", "external":
		return types.SourceChannelExternalAgent, true
	case "system-cron", "system_cron", "cron":
		return types.SourceChannelSystemCron, true
	case "unknown":
		return types.SourceChannelUnknown, true
	default:
		return "", false
	}
}

func parseTrustLevelWithFallback(raw string, fallback types.TrustLevel) types.TrustLevel {
	if level, ok := parseTrustLevel(raw); ok {
		return level
	}
	return fallback
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

func parseAuthStrengthWithFallback(raw string, fallback types.AuthStrength) types.AuthStrength {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "strong":
		return types.AuthStrengthStrong
	case "medium":
		return types.AuthStrengthMedium
	case "weak":
		return types.AuthStrengthWeak
	default:
		return fallback
	}
}

func resolveTrustLevel(defaultLevel types.TrustLevel, sourcePayload map[string]string, keys ...string) (types.TrustLevel, string) {
	if defaultLevel == "" {
		defaultLevel = types.TrustLevelMedium
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

func isSourceSimulationPayload(sourcePayload map[string]string) bool {
	if sourcePayload == nil {
		return false
	}
	if tag := firstNonEmpty(sourcePayload["__sourceTag"]); tag == "magi_request_source" {
		return true
	}
	if firstNonEmpty(
		sourcePayload["sourcePanelId"],
		sourcePayload["source_panel_id"],
		sourcePayload["profileId"],
		sourcePayload["profile_id"],
	) != "" {
		return true
	}
	return false
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
	case strings.Contains(normalized, "avatar"):
		return "avatar"
	case strings.Contains(normalized, "cron"):
		return "system-cron"
	case strings.Contains(normalized, "magi"), strings.Contains(normalized, "trinity"):
		return "magi-trinity"
	default:
		return "general"
	}
}

func shortKeyHash(sourceKey string) string {
	sum := sha256.Sum256([]byte(sourceKey))
	return fmt.Sprintf("%x", sum[:6])
}

func sourceChannelsSet(channels ...types.SourceChannel) map[types.SourceChannel]struct{} {
	result := make(map[types.SourceChannel]struct{}, len(channels))
	for _, channel := range channels {
		result[channel] = struct{}{}
	}
	return result
}

func defaultInterfaceKindForChannel(channel types.SourceChannel) string {
	switch channel {
	case types.SourceChannelGuardian:
		return "magi-main-ui"
	case types.SourceChannelExternalAgent:
		return "siyuan-note-upstream"
	case types.SourceChannelSystemCron:
		return "system-cron-job"
	default:
		return "sdk-client"
	}
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
