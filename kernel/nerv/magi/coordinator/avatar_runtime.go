// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

var ErrAvatarUnavailable = errors.New("avatar unavailable while rebuilding")

// IsAvatarUnavailable 判断错误是否为 Avatar 重写期间不可用（应返回 404）。
func IsAvatarUnavailable(err error) bool {
	return errors.Is(err, ErrAvatarUnavailable)
}

const (
	avatarHeartbeatIntervalRounds = 3
	avatarReportToolName          = "report_to_core"
	avatarBuildToolName           = config.AvatarBuildToolName
	avatarModifyToolName          = config.AvatarModifyToolName
	avatarSynthesizeToolName      = config.AvatarSynthesizeToolName
	avatarRebuildTimeout          = 45 * time.Second
	avatarRebuildDelay            = 200 * time.Millisecond
)

type avatarBindingState string

const (
	avatarBindingStateActive     avatarBindingState = "active"
	avatarBindingStateRebuilding avatarBindingState = "rebuilding"
)

// AvatarRuntime 负责按来源会话绑定并复用 Avatar 执行实例。
type AvatarRuntime struct {
	mu        sync.RWMutex
	sequence  int
	bindings  map[string]*avatarBinding
	votingCfg VotingConfig
}

// SetVotingConfig 设置投票配置
func (r *AvatarRuntime) SetVotingConfig(cfg VotingConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.votingCfg = cfg
}

type avatarBinding struct {
	RoleID                  string
	DisplayName             string
	BindingKey              string
	SystemPrompt            string
	Channel                 types.SourceChannel
	State                   avatarBindingState
	CreatedAt               time.Time
	LastActiveAt            time.Time
	LastSeenAt              time.Time
	LastHeartbeatAt         time.Time
	HeartbeatIntervalRounds int
	RoundsSinceHeartbeat    int
	RebuildReason           string
	RebuildError            string
	RebuildStartedAt        time.Time
	RebuildFinishedAt       time.Time
	RebuildRunning          bool
	Agent                   *sages.Sage
}

// NewAvatarRuntime 创建 Avatar 运行时实例。
func NewAvatarRuntime() *AvatarRuntime {
	return &AvatarRuntime{
		bindings: make(map[string]*avatarBinding),
	}
}

func (r *AvatarRuntime) nextAvatarIdentity() (string, string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sequence++
	roleID := fmt.Sprintf("avatar-role-%d", r.sequence)
	displayName := fmt.Sprintf("Avatar-%02d", r.sequence)
	return roleID, displayName
}

func (r *AvatarRuntime) getBinding(bindingKey string) (*avatarBinding, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	binding, ok := r.bindings[bindingKey]
	return binding, ok
}

func (r *AvatarRuntime) setBinding(bindingKey string, binding *avatarBinding) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.bindings[bindingKey] = binding
}

func (r *AvatarRuntime) markBindingActive(bindingKey string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if binding, ok := r.bindings[bindingKey]; ok {
		binding.LastActiveAt = time.Now()
		binding.LastSeenAt = time.Now()
	}
}

func (r *AvatarRuntime) prepareBindingForDispatch(
	ctx context.Context,
	bindingKey string,
	sourceCtx *types.RequestSourceContext,
	userMessage string,
	melchior, balthazar, casper *sages.Sage,
) (*avatarBinding, error) {
	binding, ok := r.getBinding(bindingKey)
	if !ok {
		created, err := r.createBinding(ctx, bindingKey, sourceCtx, userMessage, melchior, balthazar, casper)
		if err != nil {
			return nil, err
		}
		r.setBinding(bindingKey, created)
		logging.LogInfof("Avatar已创建并绑定: roleID=%s key=%s channel=%s", created.RoleID, bindingKey, created.Channel)
		return created, nil
	}
	if binding.State == avatarBindingStateRebuilding {
		r.ensureRebuildInBackground(bindingKey, sourceCtx, userMessage, melchior, balthazar, casper)
		return nil, r.buildAvatarUnavailableError(bindingKey, binding.RoleID, "avatar-rebuilding-in-progress")
	}
	return binding, nil
}

// DispatchForSource 在非绝对可信来源下，按绑定规则走 Avatar 回复。
func (r *AvatarRuntime) DispatchForSource(
	ctx context.Context,
	sessionID, roundID string,
	userMessage string,
	sourceAwareInput string,
	sourceCtx *types.RequestSourceContext,
	collector *ResponseCollector,
	melchior, balthazar, casper *sages.Sage,
) (*types.Message, error) {
	return r.DispatchForSourceWithReplyStream(
		ctx,
		sessionID,
		roundID,
		userMessage,
		sourceAwareInput,
		sourceCtx,
		collector,
		melchior,
		balthazar,
		casper,
		nil,
	)
}

func (r *AvatarRuntime) DispatchForSourceWithReplyStream(
	ctx context.Context,
	sessionID, roundID string,
	userMessage string,
	sourceAwareInput string,
	sourceCtx *types.RequestSourceContext,
	collector *ResponseCollector,
	melchior, balthazar, casper *sages.Sage,
	replyStreamObserver ReplyStreamObserver,
) (*types.Message, error) {
	if collector == nil {
		return nil, fmt.Errorf("avatar collector is nil")
	}

	bindingKey := resolveAvatarBindingKey(sourceCtx)
	binding, err := r.prepareBindingForDispatch(ctx, bindingKey, sourceCtx, userMessage, melchior, balthazar, casper)
	if err != nil {
		return nil, err
	}
	r.markBindingActive(bindingKey)

	boundDocumentID := resolveBoundDocumentID(sourceCtx)
	if boundDocumentID != "" {
		if docContent := model.GetBlockDOM(boundDocumentID); docContent != "" {
			_ = binding.Agent.AddToContextWithSession(sessionID, types.ContextMessage{
				Role:    types.RoleSystem,
				Content: fmt.Sprintf("<bound_document>\n<id>%s</id>\n%s\n</bound_document>", boundDocumentID, docContent),
			})
		}
	}

	if err := websocket.PushSeelReplyStarted(websocket.RuntimeMonitorSessionID, roundID, binding.Agent.GetName(), binding.DisplayName, userMessage, nil); err != nil {
		logging.LogWarnf("推送Avatar开始响应失败: %v", err)
	}

	resp, err := collector.collectSingleSageResponse(ctx, sessionID, roundID, binding.Agent, sourceAwareInput, CollectResponsesOptions{
		ReplyStreamObserver: replyStreamObserver,
	})
	if err != nil {
		return nil, fmt.Errorf("avatar dispatch failed: %w", err)
	}

	reports := extractAvatarRuntimeReports(resp, binding, sourceCtx)
	hasHeartbeat := hasHeartbeatReport(reports)
	logAvatarReports(reports)
	if timedOut := r.markHeartbeatAndCheckTimeout(bindingKey, hasHeartbeat); timedOut {
		reason := fmt.Sprintf("avatar-heartbeat-timeout role=%s key=%s", binding.RoleID, bindingKey)
		logging.LogWarnf("Avatar心跳超时，触发重写: %s", reason)
		r.ensureRebuildInBackground(bindingKey, sourceCtx, userMessage, melchior, balthazar, casper)
		return nil, r.buildAvatarUnavailableError(bindingKey, binding.RoleID, "avatar-heartbeat-timeout")
	}

	content := strings.TrimSpace(resp.Content)
	if content == "" {
		return nil, fmt.Errorf("avatar response is empty")
	}

	meta := map[string]interface{}{
		"mode":                    types.ConsensusModeStandard,
		"source":                  "avatar-delegated",
		"avatarRoleId":            binding.RoleID,
		"avatarDisplayName":       binding.DisplayName,
		"avatarBindingKey":        binding.BindingKey,
		"avatarPromptBound":       binding.SystemPrompt != "",
		"avatarHeartbeatReported": hasHeartbeat,
	}
	if len(reports) > 0 {
		meta["avatarReports"] = reports
	}
	if sourceCtx != nil {
		identityID := strings.TrimSpace(sourceCtx.IdentityID)
		if identityID == "" {
			identityID = strings.TrimSpace(sourceCtx.PrincipalID)
		}
		nickname := strings.TrimSpace(sourceCtx.Nickname)
		if nickname == "" {
			nickname = identityID
		}
		meta["requestSource"] = map[string]interface{}{
			"requestId":             sourceCtx.RequestID,
			"channel":               sourceCtx.Channel,
			"principalId":           sourceCtx.PrincipalID,
			"identityId":            identityID,
			"nickname":              nickname,
			"interfaceId":           sourceCtx.InterfaceID,
			"interfaceKind":         sourceCtx.InterfaceKind,
			"sourceSessionKey":      sourceCtx.SourceSessionKey,
			"directResponseAllowed": sourceCtx.DirectResponseAllowed,
			"trustBase":             sourceCtx.TrustBase,
			"riskLevel":             sourceCtx.RiskLevel,
			"authStrength":          sourceCtx.AuthStrength,
			"modelIntent":           sourceCtx.ModelIntent,
		}
	}

	return &types.Message{
		Type:      types.TypeConsensus,
		Content:   content,
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta:      meta,
	}, nil
}

func resolveBoundDocumentID(sourceCtx *types.RequestSourceContext) string {
	if sourceCtx == nil || len(sourceCtx.RawAttributes) == 0 {
		return ""
	}
	return strings.TrimSpace(sourceCtx.RawAttributes["boundDocumentId"])
}

func (r *AvatarRuntime) createBinding(
	ctx context.Context,
	bindingKey string,
	sourceCtx *types.RequestSourceContext,
	userMessage string,
	melchior, balthazar, casper *sages.Sage,
) (*avatarBinding, error) {
	roleID, displayName := r.nextAvatarIdentity()
	prototype, err := requestAvatarPrototypeByMAGI(
		ctx,
		roleID,
		displayName,
		bindingKey,
		sourceCtx,
		userMessage,
		melchior,
		balthazar,
		casper,
		r.votingCfg,
	)
	if err != nil {
		return nil, fmt.Errorf("request avatar prototype failed: %w", err)
	}

	llmClient, err := resolveAvatarLLMClient(melchior, balthazar, casper)
	if err != nil {
		return nil, err
	}

	agentCfg := &config.AgentConfig{
		Name: roleID,
		SEELConfig: config.SEELConfig{
			Name:         displayName,
			Color:        "#00BCD4",
			Icon:         "A",
			ResponseType: "avatar",
			BaseWeight:   1.0,
		},
		SystemPrompt: prototype.SystemPrompt,
		Tools:        []config.ToolDef{buildAvatarReportToolDef()},
	}
	contextStrategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 12,
	}
	agent := sages.NewSage(roleID, agentCfg, llmClient, contextStrategy)

	now := time.Now()
	channel := types.SourceChannelUnknown
	if sourceCtx != nil && sourceCtx.Channel != "" {
		channel = sourceCtx.Channel
	}
	return &avatarBinding{
		RoleID:                  roleID,
		DisplayName:             displayName,
		BindingKey:              bindingKey,
		SystemPrompt:            prototype.SystemPrompt,
		Channel:                 channel,
		State:                   avatarBindingStateActive,
		CreatedAt:               now,
		LastActiveAt:            now,
		LastSeenAt:              now,
		LastHeartbeatAt:         now,
		HeartbeatIntervalRounds: avatarHeartbeatIntervalRounds,
		RoundsSinceHeartbeat:    0,
		Agent:                   agent,
	}, nil
}

func resolveAvatarLLMClient(
	melchior, balthazar, casper *sages.Sage,
) (llm.Client, error) {
	if melchior != nil && melchior.GetLLMClient() != nil {
		return melchior.GetLLMClient(), nil
	}
	if balthazar != nil && balthazar.GetLLMClient() != nil {
		return balthazar.GetLLMClient(), nil
	}
	if casper != nil && casper.GetLLMClient() != nil {
		return casper.GetLLMClient(), nil
	}
	return nil, fmt.Errorf("no llm client available for avatar creation")
}

func resolveAvatarBindingKey(sourceCtx *types.RequestSourceContext) string {
	if sourceCtx == nil {
		return "unknown:anonymous"
	}
	if key := strings.TrimSpace(sourceCtx.SourceSessionKey); key != "" {
		return key
	}
	channel := string(sourceCtx.Channel)
	if channel == "" {
		channel = "unknown"
	}
	principal := strings.TrimSpace(sourceCtx.PrincipalID)
	if principal == "" {
		principal = "unknown-principal"
	}
	iface := strings.TrimSpace(sourceCtx.InterfaceID)
	if iface == "" {
		iface = "unknown-interface"
	}
	return fmt.Sprintf("%s:%s:%s", channel, principal, iface)
}

type avatarCreateDecision string

const (
	avatarDecisionApproved avatarCreateDecision = "approved"
)

type melchiorBuildAvatar struct {
	Initiate             bool
	Motivation           string
	Reason               string
	SystemPromptProposal string
	Requirements         string
}

type avatarCreationProposal struct {
	SageName             string
	DisplayName          string
	Decision             avatarCreateDecision
	Motivation           string
	Reason               string
	SystemPromptProposal string
	Requirements         string
}

type dominantSynthesizeAvatar struct {
	FinalSystemPrompt string
	Motivation        string
}

type avatarPrototype struct {
	SystemPrompt string
}

func requestAvatarPrototypeByMAGI(
	ctx context.Context,
	roleID string,
	displayName string,
	bindingKey string,
	sourceCtx *types.RequestSourceContext,
	userMessage string,
	melchior, balthazar, casper *sages.Sage,
	votingCfg VotingConfig,
) (*avatarPrototype, error) {
	if melchior == nil {
		return nil, fmt.Errorf("melchior is nil")
	}
	if balthazar == nil {
		return nil, fmt.Errorf("balthazar is nil")
	}
	if casper == nil {
		return nil, fmt.Errorf("casper is nil")
	}

	channel := "unknown"
	interfaceKind := "unknown-interface"
	trust := "medium"
	risk := "medium"
	identityID := "unknown-principal"
	nickname := identityID
	sourceSessionKey := "unknown-session"
	if sourceCtx != nil {
		if sourceCtx.Channel != "" {
			channel = string(sourceCtx.Channel)
		}
		if sourceCtx.InterfaceKind != "" {
			interfaceKind = sourceCtx.InterfaceKind
		}
		if sourceCtx.TrustBase != "" {
			trust = string(sourceCtx.TrustBase)
		}
		if sourceCtx.RiskLevel != "" {
			risk = string(sourceCtx.RiskLevel)
		}
		if sourceCtx.IdentityID != "" {
			identityID = strings.TrimSpace(sourceCtx.IdentityID)
		} else if sourceCtx.PrincipalID != "" {
			identityID = strings.TrimSpace(sourceCtx.PrincipalID)
		}
		if sourceCtx.Nickname != "" {
			nickname = strings.TrimSpace(sourceCtx.Nickname)
		} else {
			nickname = identityID
		}
		if sourceCtx.SourceSessionKey != "" {
			sourceSessionKey = sourceCtx.SourceSessionKey
		}
	}
	if identityID == "" {
		identityID = "unknown-principal"
	}
	if nickname == "" {
		nickname = identityID
	}

	knowledgeBase := prompts.BuildAvatarCreationKnowledgeBase(
		roleID,
		displayName,
		identityID,
		nickname,
		bindingKey,
		sourceSessionKey,
		channel,
		interfaceKind,
		trust,
		risk,
		userMessage,
	)

	melchiorTask := prompts.BuildMelchiorBuildAvatarTask(knowledgeBase)
	melchiorBuild, err := collectMelchiorBuildAvatar(ctx, melchior, melchiorTask)
	if err != nil {
		return nil, err
	}
	if !melchiorBuild.Initiate {
		return nil, fmt.Errorf("melchior rejected avatar creation: %s", melchiorBuild.Reason)
	}

	melchiorProposalRaw, _ := json.Marshal(melchiorBuild)

	avatarSessionID := fmt.Sprintf("avatar-creation-%s", bindingKey)
	avatarRoundID := fmt.Sprintf("avatar-round-%d", time.Now().UnixMilli())
	dominantActionToolGovernance.RegisterRound(
		avatarSessionID, avatarRoundID, userMessage,
		melchior, balthazar, casper,
	)

	pendingToolCall := types.ToolCall{
		ID:   fmt.Sprintf("avatar-build-%d", time.Now().UnixMilli()),
		Type: "function",
		Function: types.ToolCallFunction{
			Name:      avatarBuildToolName,
			Arguments: string(melchiorProposalRaw),
		},
	}
	voteCtx := VoteContext{
		UserMessage:            userMessage,
		ProposerDisplayName:    melchior.GetDisplayName(),
		ProposerConclusion:     melchiorBuild.Reason,
		GovernedActionToolCall: &pendingToolCall,
	}

	voteResult, err := ProcessPeerVoting(
		ctx, avatarSessionID, avatarRoundID,
		melchior.GetName(), melchior.GetDisplayName(),
		balthazar, casper,
		avatarBuildToolName,
		voteCtx,
		melchior.GetName(),
		"申请创建Avatar",
		1,
		votingCfg,
	)
	dominantActionToolGovernance.UnregisterRound(avatarSessionID, avatarRoundID)
	if err != nil {
		return nil, fmt.Errorf("avatar creation governance vote failed: %w", err)
	}
	if !voteResult.Passed {
		return nil, fmt.Errorf("avatar creation rejected by sages")
	}

	proposals := []avatarCreationProposal{
		{
			SageName:             melchior.GetName(),
			DisplayName:          melchior.GetDisplayName(),
			Decision:             avatarDecisionApproved,
			Motivation:           melchiorBuild.Motivation,
			Reason:               melchiorBuild.Reason,
			SystemPromptProposal: melchiorBuild.SystemPromptProposal,
			Requirements:         melchiorBuild.Requirements,
		},
	}
	proposalsPayload := buildSageProposalPayload(proposals)
	dominantSituation := buildAvatarDominantSituation(knowledgeBase, proposalsPayload)
	dominantResult, err := electDominantSage(ctx, bindingKey, melchior, balthazar, casper, dominantSituation)
	if err != nil {
		return nil, fmt.Errorf("avatar dominant election failed: %w", err)
	}
	dominantSage, err := resolveDominantSage(dominantResult, melchior, balthazar, casper)
	if err != nil {
		return nil, err
	}

	dominantTask := prompts.BuildDominantSynthesizeAvatarTask(dominantResult.DominantStance, knowledgeBase, proposalsPayload)
	dominantSynthesis, err := collectDominantSynthesizeAvatar(ctx, dominantSage, dominantTask)
	if err != nil {
		return nil, err
	}
	if err := validateSynthesizedAvatarPrompt(dominantSynthesis.FinalSystemPrompt, roleID, channel); err != nil {
		return nil, err
	}

	return &avatarPrototype{
		SystemPrompt: strings.TrimSpace(dominantSynthesis.FinalSystemPrompt),
	}, nil
}

func collectMelchiorBuildAvatar(
	ctx context.Context,
	melchior *sages.Sage,
	task string,
) (*melchiorBuildAvatar, error) {
	rawArgs, err := runSageToolCallWithRuntimeTools(
		ctx,
		melchior,
		task,
		avatarBuildToolName,
		[]openai.Tool{buildRuntimeTool(config.BuildAvatarBuildToolDef())},
		nil,
	)
	if err != nil {
		return nil, err
	}
	return parseMelchiorBuildAvatar(rawArgs)
}

func collectDominantSynthesizeAvatar(
	ctx context.Context,
	dominantSage *sages.Sage,
	task string,
) (*dominantSynthesizeAvatar, error) {
	if dominantSage == nil {
		return nil, fmt.Errorf("dominant sage is nil")
	}

	rawArgs, err := runSageToolCallWithRuntimeTools(
		ctx,
		dominantSage.CloneWithFreshContext(),
		task,
		avatarSynthesizeToolName,
		[]openai.Tool{buildRuntimeTool(config.BuildAvatarSynthesizeToolDef())},
		nil,
	)
	if err != nil {
		return nil, err
	}
	return parseDominantSynthesizeAvatar(rawArgs)
}

func runSageToolCallWithRuntimeTools(
	ctx context.Context,
	sage *sages.Sage,
	userInput string,
	expectedToolName string,
	runtimeTools []openai.Tool,
	runtimeToolChoice any,
) (string, error) {
	if sage == nil {
		return "", fmt.Errorf("sage is nil for tool %s", expectedToolName)
	}
	//@todo avatar同样需要支持sessionId和roundId以便推送事件，目前Trinity调用时没有，后续可以改造为可选参数
	var (
		streamCh <-chan types.StreamChunk
		err      error
	)
	if len(runtimeTools) > 0 || runtimeToolChoice != nil {
		streamCh, err = sage.SendMessageWithRuntimeTools(ctx, "", "", userInput, runtimeTools, runtimeToolChoice)
	} else {
		streamCh, err = sage.SendMessage(ctx, "", "", userInput)
	}
	if err != nil {
		return "", fmt.Errorf("send tool call request failed for %s: %w", sage.GetName(), err)
	}

	processor := utilstream.NewProcessor()
	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case chunk, ok := <-streamCh:
			if !ok {
				result := processor.GetResult(true)
				// 单工具路由：processor 累积的是 magi_tool 形式，解析回真实工具名后按 expectedToolName 查找。
				// 解析失败必须报错（静默跳过会导致参数丢失、按真实工具名找不到参数）。
				if resolveErr := llm.ResolveStreamResultMagiTools(result); resolveErr != nil {
					return "", resolveErr
				}
				argsList := result.ToolArgumentsByName[expectedToolName]
				if len(argsList) == 0 {
					return "", fmt.Errorf("%s did not call tool %s", sage.GetName(), expectedToolName)
				}
				sage.AddToContext(types.ContextMessage{
					Role:    types.RoleAssistant,
					Content: result.Content,
				})
				return strings.TrimSpace(argsList[len(argsList)-1]), nil
			}
			if len(chunk.Choices) == 0 {
				continue
			}
			delta := chunk.Choices[0].Delta
			if delta.Content != "" {
				processor.AccumulateContent(delta.Content)
			}
			if len(delta.ToolCalls) > 0 {
				utilToolCalls := convertToolCallDeltasForAvatar(delta.ToolCalls)
				processor.MergeToolCalls(utilToolCalls)
			}
		}
	}
}

// convertToolCallDeltasForAvatar 转换工具调用增量类型（avatar专用）
func convertToolCallDeltasForAvatar(magiCalls []types.ToolCallDelta) []utilstream.ToolCallDelta {
	result := make([]utilstream.ToolCallDelta, len(magiCalls))
	for i, tc := range magiCalls {
		result[i] = utilstream.ToolCallDelta{
			Index: tc.Index,
			ID:    tc.ID,
			Type:  tc.Type,
		}
		if tc.Function != nil {
			result[i].Function = &utilstream.ToolCallFunctionDelta{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			}
		}
	}
	return result
}

func parseMelchiorBuildAvatar(rawArgs string) (*melchiorBuildAvatar, error) {
	payload := map[string]interface{}{}
	if err := json.Unmarshal([]byte(rawArgs), &payload); err != nil {
		return nil, fmt.Errorf("parse melchior buildAvatar args failed: %w", err)
	}
	result := &melchiorBuildAvatar{
		Initiate:             parseBool(payload["initiate"]) || parseBool(payload["createAvatar"]),
		Motivation:           pickString(payload, "motivation"),
		Reason:               strings.TrimSpace(fmt.Sprintf("%v", payload["reason"])),
		SystemPromptProposal: pickString(payload, "systemPromptProposal", "system_prompt_proposal", "prompt"),
		Requirements:         pickString(payload, "requirements", "requirement"),
	}
	if result.Motivation == "" {
		return nil, fmt.Errorf("melchior buildAvatar missing motivation")
	}
	if result.Reason == "" || result.Reason == "<nil>" {
		result.Reason = "no-reason"
	}
	if result.Initiate && strings.TrimSpace(result.SystemPromptProposal) == "" {
		return nil, fmt.Errorf("melchior buildAvatar missing systemPromptProposal")
	}
	return result, nil
}

func parseDominantSynthesizeAvatar(rawArgs string) (*dominantSynthesizeAvatar, error) {
	payload := map[string]interface{}{}
	if err := json.Unmarshal([]byte(rawArgs), &payload); err != nil {
		return nil, fmt.Errorf("parse dominant synthesizeAvatar args failed: %w", err)
	}
	finalSystemPrompt := pickString(payload, "finalSystemPrompt", "systemPrompt", "system_prompt", "prompt", "content")
	motivation := pickString(payload, "motivation")
	if motivation == "" {
		return nil, fmt.Errorf("dominant synthesizeAvatar missing motivation")
	}
	if strings.TrimSpace(finalSystemPrompt) == "" {
		return nil, fmt.Errorf("dominant synthesizeAvatar missing finalSystemPrompt")
	}
	return &dominantSynthesizeAvatar{
		FinalSystemPrompt: strings.TrimSpace(finalSystemPrompt),
		Motivation:        motivation,
	}, nil
}

func buildSageProposalPayload(proposals []avatarCreationProposal) string {
	payload := make([]map[string]interface{}, 0, len(proposals))
	for index, proposal := range proposals {
		payload = append(payload, map[string]interface{}{
			"proposalId":           index + 1,
			"sageName":             proposal.SageName,
			"displayName":          proposal.DisplayName,
			"decision":             proposal.Decision,
			"motivation":           proposal.Motivation,
			"reason":               proposal.Reason,
			"systemPromptProposal": proposal.SystemPromptProposal,
			"requirements":         proposal.Requirements,
		})
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func buildAvatarDominantSituation(knowledgeBase, proposalsPayload string) string {
	return strings.TrimSpace(fmt.Sprintf(`当前需要为一个新的 Avatar 绑定来源并输出最终 system prompt。

%s

候选提案：
%s`, knowledgeBase, proposalsPayload))
}

func validateSynthesizedAvatarPrompt(prompt, roleID, channel string) error {
	trimmed := strings.TrimSpace(prompt)
	if trimmed == "" {
		return fmt.Errorf("synthesized avatar prompt is empty")
	}
	if !strings.Contains(trimmed, roleID) {
		return fmt.Errorf("synthesized avatar prompt missing role id %s", roleID)
	}
	if !strings.Contains(trimmed, "report_to_core") {
		return fmt.Errorf("synthesized avatar prompt missing report_to_core constraint")
	}
	if !strings.Contains(trimmed, channel) {
		return fmt.Errorf("synthesized avatar prompt missing channel %s", channel)
	}
	return nil
}

func pickString(payload map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok {
			continue
		}
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text != "" && text != "<nil>" {
			return text
		}
	}
	return ""
}

func parseBool(raw interface{}) bool {
	switch value := raw.(type) {
	case bool:
		return value
	case string:
		normalized := strings.ToLower(strings.TrimSpace(value))
		return normalized == "true" || normalized == "yes" || normalized == "approved" || normalized == "create"
	default:
		return false
	}
}

func buildAvatarReportToolDef() config.ToolDef {
	return config.ToolDef{
		Type: "function",
		Function: config.ToolFunctionDef{
			Name:        avatarReportToolName,
			Description: "简洁汇报当前工作环境与经验教训（运行时会自动补充avatar_role_id和source_session_key）",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"type": map[string]interface{}{
						"type":        "string",
						"description": "报告类型: heartbeat|progress|risk|summary",
					},
					"environment": map[string]interface{}{
						"type":        "string",
						"description": "当前工作的环境/上下文（简洁）",
					},
					"lessons": map[string]interface{}{
						"type":        "string",
						"description": "本轮经验和教训（简洁）",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "可选补充说明",
					},
					"urgency": map[string]interface{}{
						"type":        "string",
						"description": "紧急程度: low|medium|high",
					},
				},
				"required": []string{"type", "environment", "lessons"},
			},
		},
	}
}

func hasHeartbeatReport(reports []map[string]interface{}) bool {
	for _, report := range reports {
		reportType, _ := report["type"].(string)
		if strings.EqualFold(strings.TrimSpace(reportType), "heartbeat") {
			return true
		}
	}
	return false
}

func extractAvatarRuntimeReports(
	resp *types.SageResponse,
	binding *avatarBinding,
	sourceCtx *types.RequestSourceContext,
) []map[string]interface{} {
	if resp == nil || binding == nil || len(resp.ToolArgumentsByName) == 0 {
		return nil
	}
	rawArgs := resp.ToolArgumentsByName[avatarReportToolName]
	if len(rawArgs) == 0 {
		return nil
	}

	sourceSessionKey := binding.BindingKey
	if sourceCtx != nil && strings.TrimSpace(sourceCtx.SourceSessionKey) != "" {
		sourceSessionKey = strings.TrimSpace(sourceCtx.SourceSessionKey)
	}

	var reports []map[string]interface{}
	for _, raw := range rawArgs {
		payload := map[string]interface{}{}
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			continue
		}
		reportType := sanitizeReportField(payload["type"])
		if reportType == "" {
			reportType = "summary"
		}
		environment := sanitizeReportField(payload["environment"])
		if environment == "" {
			environment = sanitizeReportField(payload["context"])
		}
		lessons := sanitizeReportField(payload["lessons"])
		if lessons == "" {
			lessons = sanitizeReportField(payload["experience"])
		}
		content := sanitizeReportField(payload["content"])
		urgency := sanitizeReportField(payload["urgency"])
		if urgency == "" {
			urgency = "low"
		}
		reports = append(reports, map[string]interface{}{
			"type":               reportType,
			"environment":        environment,
			"lessons":            lessons,
			"content":            content,
			"urgency":            urgency,
			"avatarRoleId":       binding.RoleID,
			"sourceSessionKey":   sourceSessionKey,
			"avatarBindingKey":   binding.BindingKey,
			"runtimeCollectedAt": time.Now().UnixMilli(),
		})
	}
	return reports
}

func sanitizeReportField(raw interface{}) string {
	if raw == nil {
		return ""
	}
	text := strings.TrimSpace(fmt.Sprintf("%v", raw))
	if text == "<nil>" {
		return ""
	}
	return text
}

func logAvatarReports(reports []map[string]interface{}) {
	for _, report := range reports {
		roleID, _ := report["avatarRoleId"].(string)
		sourceSessionKey, _ := report["sourceSessionKey"].(string)
		reportType, _ := report["type"].(string)
		environment, _ := report["environment"].(string)
		lessons, _ := report["lessons"].(string)
		urgency, _ := report["urgency"].(string)
		content, _ := report["content"].(string)
		logging.LogInfof(
			"Avatar报告 role=%s source_session_key=%s type=%s urgency=%s env=%s lessons=%s content=%s",
			roleID,
			sourceSessionKey,
			reportType,
			urgency,
			environment,
			lessons,
			content,
		)
	}
}

func (r *AvatarRuntime) markHeartbeatAndCheckTimeout(bindingKey string, hasHeartbeat bool) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	binding, ok := r.bindings[bindingKey]
	if !ok || binding.State != avatarBindingStateActive {
		return false
	}
	binding.LastSeenAt = time.Now()
	binding.RoundsSinceHeartbeat++
	if hasHeartbeat {
		binding.LastHeartbeatAt = time.Now()
		binding.RoundsSinceHeartbeat = 0
		return false
	}
	if binding.RoundsSinceHeartbeat >= binding.HeartbeatIntervalRounds {
		binding.State = avatarBindingStateRebuilding
		binding.RebuildReason = "heartbeat-timeout"
		binding.RebuildError = ""
		binding.RebuildStartedAt = time.Now()
		binding.RebuildFinishedAt = time.Time{}
		return true
	}
	return false
}

func (r *AvatarRuntime) ensureRebuildInBackground(
	bindingKey string,
	sourceCtx *types.RequestSourceContext,
	userMessage string,
	melchior, balthazar, casper *sages.Sage,
) {
	r.mu.Lock()
	binding, ok := r.bindings[bindingKey]
	if !ok {
		r.mu.Unlock()
		return
	}
	if binding.State != avatarBindingStateRebuilding {
		r.mu.Unlock()
		return
	}
	if binding.RebuildRunning {
		r.mu.Unlock()
		return
	}
	binding.RebuildRunning = true
	binding.RebuildStartedAt = time.Now()
	binding.RebuildFinishedAt = time.Time{}
	r.mu.Unlock()

	go func() {
		time.Sleep(avatarRebuildDelay)
		ctx, cancel := context.WithTimeout(context.Background(), avatarRebuildTimeout)
		defer cancel()

		created, err := r.createBinding(ctx, bindingKey, sourceCtx, userMessage, melchior, balthazar, casper)

		r.mu.Lock()
		defer r.mu.Unlock()
		current, exists := r.bindings[bindingKey]
		if !exists {
			return
		}
		if err != nil {
			current.RebuildRunning = false
			current.RebuildError = err.Error()
			current.RebuildFinishedAt = time.Now()
			logging.LogWarnf("Avatar重写失败，维持404态: key=%s err=%v", bindingKey, err)
			return
		}
		created.RebuildRunning = false
		created.RebuildReason = ""
		created.RebuildError = ""
		created.RebuildFinishedAt = time.Now()
		r.bindings[bindingKey] = created
		logging.LogInfof("Avatar重写完成并接管: key=%s newRoleID=%s", bindingKey, created.RoleID)
	}()
}

func (r *AvatarRuntime) buildAvatarUnavailableError(bindingKey, roleID, reason string) error {
	return fmt.Errorf("%w: binding=%s avatar=%s reason=%s", ErrAvatarUnavailable, bindingKey, roleID, reason)
}
