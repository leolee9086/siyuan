// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package conf

import (
	"encoding/hex"
	"encoding/json"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/88250/lute/ast"
	"github.com/google/uuid"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type AI struct {
	OpenAI          *OpenAI          `json:"openAI,omitempty"`
	MCP             *MCP             `json:"mcp"`
	Embedding       *Embedding       `json:"embedding"`
	Rerank          *Rerank          `json:"rerank"`
	Agent           *Agent           `json:"agent"`
	CommandReview   *CommandReview   `json:"commandReview"`
	Editing         *Editing         `json:"editing"`
	Vision          *Vision          `json:"vision"`
	ImageGeneration *ImageGeneration `json:"imageGeneration"`
	Providers       []*Provider      `json:"providers"`
	WebSearch       *WebSearch       `json:"webSearch"`
}

// EffectiveAPIProxy returns the AI-specific proxy override when configured;
// otherwise it inherits the system-wide proxy used by all network clients.
func (ai *AI) EffectiveAPIProxy(system *System) string {
	if ai == nil || ai.OpenAI == nil {
		return EffectiveProxyURL(system)
	}
	return EffectiveProxyURLWithOverride(system, ai.OpenAI.APIProxy)
}

// WebSearch contains runtime settings shared by the native Agent and MAGI.
// Secret fields are encrypted together with the existing AI credentials.
type WebSearch struct {
	Enabled         bool                        `json:"enabled"`
	Provider        string                      `json:"provider"`
	QueryType       string                      `json:"queryType"`
	Lang            string                      `json:"lang"`
	MaxResults      int                         `json:"maxResults"`
	TimeoutMs       int                         `json:"timeoutMs"`
	CacheTTLSeconds int                         `json:"cacheTtlSeconds"`
	Proxy           string                      `json:"proxy"`
	ExaAPIKey       string                      `json:"exaApiKey"`
	ParallelAPIKey  string                      `json:"parallelApiKey"`
	Engines         map[string]*WebSearchEngine `json:"engines"`
}

type WebSearchEngine struct {
	Enabled    bool              `json:"enabled"`
	APIKey     string            `json:"apiKey"`
	BaseURL    string            `json:"baseUrl"`
	TimeoutMs  int               `json:"timeoutMs"`
	MaxResults int               `json:"maxResults"`
	Weight     float64           `json:"weight"`
	Priority   int               `json:"priority"`
	Headers    map[string]string `json:"headers"`
}

type OpenAI struct {
	APIKey         string  `json:"apiKey"`
	APITimeout     int     `json:"apiTimeout"`
	APIProxy       string  `json:"apiProxy"`
	APIModel       string  `json:"apiModel"`
	APIMaxTokens   int     `json:"apiMaxTokens"`
	APITemperature float64 `json:"apiTemperature"`
	APIMaxContexts int     `json:"apiMaxContexts"`
	APIBaseURL     string  `json:"apiBaseURL"`
	APIUserAgent   string  `json:"apiUserAgent"`
	APIProvider    string  `json:"apiProvider"` // OpenAI, Azure
	APIVersion     string  `json:"apiVersion"`  // Azure API version

	MAGISleepStartHour int `json:"magiSleepStartHour"`
	MAGISleepEndHour   int `json:"magiSleepEndHour"`
}

type Agent struct {
	ModelID             string            `json:"modelId"`
	SessionTimeout      int               `json:"sessionTimeout"`
	StreamIdleTimeout   int               `json:"streamIdleTimeout"`
	ConfirmTimeout      int               `json:"confirmTimeout"`
	MaxRetries          int               `json:"maxRetries"`
	Temperature         float64           `json:"temperature"`
	MaxCompletionTokens int               `json:"maxCompletionTokens"`
	MaxToolCallRounds   int               `json:"maxToolCallRounds"`
	CapabilityPolicy    *CapabilityPolicy `json:"capabilityPolicy"`
	ApprovalPolicy      *ApprovalPolicy   `json:"approvalPolicy"`
	Skills              *AgentSkills      `json:"skills"`
}

// CommandReview holds the independently selected model used to review shell
// commands before the user confirmation and command execution stages.
type CommandReview struct {
	ModelID string `json:"modelId"`
	Timeout int    `json:"timeout"`
}

type Vision struct {
	ModelID        string `json:"modelId"`
	RequestTimeout int    `json:"requestTimeout"`
	MaxImageBytes  int    `json:"maxImageBytes"`
	MaxPixels      int    `json:"maxPixels"`
	MaxEdge        int    `json:"maxEdge"`
}

type AgentSkills struct {
	UserEnabled []string `json:"userEnabled"`
}

type CapabilityPolicy struct {
	Default   string            `json:"default"`
	Overrides map[string]string `json:"overrides"`
}

type ApprovalPolicy struct {
	Default   string                         `json:"default"`
	Overrides map[string]*CapabilityApproval `json:"overrides"`
}

type CapabilityApproval struct {
	Default string            `json:"default"`
	Actions map[string]string `json:"actions"`
}

const (
	ApprovalDecisionRisk    = "risk"
	ApprovalDecisionConfirm = "confirm"
	ApprovalDecisionAllow   = "allow"
)
// Editing holds behavior parameters used by the in-editor chat scenario. They
// are kept here (instead of on Model) to mirror Agent and to decouple scenario
// behavior from the model registry. See https://github.com/siyuan-note/siyuan/issues/17797
type Editing struct {
	ModelID             string  `json:"modelId"`
	MaxHistoryMessages  int     `json:"maxHistoryMessages"`  // Max number of prior turns kept as context
	Temperature         float64 `json:"temperature"`         // Alignment with Agent.Temperature
	MaxCompletionTokens int     `json:"maxCompletionTokens"` // Alignment with Agent.MaxCompletionTokens
}

// ImageGeneration 配置图片生成场景的模型和默认输出参数。
type ImageGeneration struct {
	ModelID        string `json:"modelId"`
	RequestTimeout int    `json:"requestTimeout"`
	Size           string `json:"size"`
	Quality        string `json:"quality"`
	OutputFormat   string `json:"outputFormat"`
}

type Embedding struct {
	ID         string `json:"id"`
	Enabled    bool   `json:"enabled"`
	APIKey     string `json:"apiKey"`
	BaseURL    string `json:"baseURL"`
	Name       string `json:"name"`
	Timeout    int    `json:"timeout"`
	Dimensions int    `json:"dimensions"` // 输出向量维度，仅 text-embedding-3 及以上模型支持；0 表示用模型默认值（不传该参数）
}

// Rerank 配置语义搜索结果的重排模型。重排在向量召回后对 query 与候选文档逐对精排，
// 采用主流重排服务的 /rerank 协议（OpenAI 官方暂无 rerank API）。
// 各服务商端点路径不一（Jina /v1/rerank、阿里云 /v1/reranks 等），故 Endpoint 为完整端点地址。
type Rerank struct {
	ID             string                   `json:"id"`
	Enabled        bool                     `json:"enabled"`
	APIKey         string                   `json:"apiKey"`
	Endpoint       string                   `json:"endpoint"` // 完整重排端点 URL，按目标模型文档填写
	Name           string                   `json:"name"`
	RequestFormat  util.RerankRequestFormat `json:"requestFormat"`
	Timeout        int                      `json:"timeout"`
	CandidateCount int                      `json:"candidateCount"` // 向量召回后送入重排的候选文档数，默认 30；越大越准但越慢
}

type Provider struct {
	ID             string   `json:"id"`
	DisplayName    string   `json:"displayName,omitempty"`
	Enabled        bool     `json:"enabled"`
	APIKey         string   `json:"apiKey"`
	BaseURL        string   `json:"baseURL"`
	Protocol       string   `json:"protocol,omitempty"`
	RequestTimeout int      `json:"requestTimeout"`
	Models         []*Model `json:"models"`
	// CachedModels 保存最近一次成功从 Provider /v1/models 拉取的模型 ID 列表。
	CachedModels []string `json:"cachedModels,omitempty"`
	// CachedModelsAt 保存模型列表缓存的 Unix 时间戳（毫秒）。
	CachedModelsAt int64 `json:"cachedModelsAt,omitempty"`
}

// Model is the provider-scoped model registry entry. MaxTokens/Temperature/
// MaxContexts remain the persisted UI-facing config (the settings page still
// reads/writes them). Editing holds the runtime view derived from them.
type Model struct {
	ID            string `json:"id"`
	DisplayName   string `json:"displayName,omitempty"`
	Enabled       bool   `json:"enabled"`
	Name          string `json:"name"`
	ContextLength int    `json:"contextLength,omitempty"`
}

type MCP struct {
	Servers        []MCPServer       `json:"servers"`
	ExposurePolicy *CapabilityPolicy `json:"exposurePolicy"`
}

type MCPServer struct {
	ID                   string            `json:"id"`
	Name                 string            `json:"name"`
	Enabled              bool              `json:"enabled"`
	Type                 string            `json:"type"`
	Command              string            `json:"command"`
	Args                 []string          `json:"args"`
	InheritEnv           []string          `json:"inheritEnv"`
	Env                  map[string]string `json:"env"`
	URL                  string            `json:"url"`
	Headers              map[string]string `json:"headers"`
	Timeout              int               `json:"timeout"`
	TrustToolAnnotations bool              `json:"trustToolAnnotations"`
}

func defaultEmbedding() *Embedding {
	return &Embedding{Timeout: 30}
}

func defaultOpenAI() *OpenAI {
	return &OpenAI{
		APITemperature:     1.0,
		APIMaxContexts:     7,
		APITimeout:         120,
		APIModel:           openai.GPT3Dot5Turbo,
		APIBaseURL:         "https://api.openai.com/v1",
		APIUserAgent:       util.UserAgent,
		APIProvider:        "OpenAI",
		MAGISleepStartHour: 0,
		MAGISleepEndHour:   8,
	}
}

func defaultRerank() *Rerank {
	return &Rerank{
		RequestFormat:  util.RerankRequestFormatCohere,
		Timeout:        30,
		CandidateCount: 30,
	}
}

func defaultAgent() *Agent {
	return &Agent{
		SessionTimeout:      600,
		StreamIdleTimeout:   120,
		ConfirmTimeout:      120,
		MaxRetries:          3,
		Temperature:         1.0,
		MaxCompletionTokens: 0,
		MaxToolCallRounds:   64,
		CapabilityPolicy:    defaultCapabilityPolicy(),
		ApprovalPolicy:      defaultApprovalPolicy(),
		Skills:              &AgentSkills{UserEnabled: []string{}},
	}
}

func defaultApprovalPolicy() *ApprovalPolicy {
	return &ApprovalPolicy{
		Default:   ApprovalDecisionRisk,
		Overrides: map[string]*CapabilityApproval{},
	}
}

func defaultCapabilityPolicy() *CapabilityPolicy {
	return &CapabilityPolicy{
		Default:   "allow",
		Overrides: map[string]string{},
	}
}

func normalizeCapabilityPolicy(policy *CapabilityPolicy) *CapabilityPolicy {
	if policy == nil {
		return defaultCapabilityPolicy()
	}
	if policy.Default != "deny" {
		policy.Default = "allow"
	}
	if policy.Overrides == nil {
		policy.Overrides = map[string]string{}
	}
	for id, decision := range policy.Overrides {
		if id == "" || decision != "allow" && decision != "deny" {
			delete(policy.Overrides, id)
		}
	}
	return policy
}

func (policy *CapabilityPolicy) Allows(id string) bool {
	if policy == nil {
		return true
	}
	if decision := policy.Overrides[id]; decision != "" {
		return decision == "allow"
	}
	return policy.Default != "deny"
}

func (policy *ApprovalPolicy) Decision(id, action string) string {
	if policy == nil {
		return ApprovalDecisionRisk
	}
	if override := policy.Overrides[id]; override != nil {
		if decision := override.Actions[action]; decision != "" {
			return decision
		}
		if override.Default != "" {
			return override.Default
		}
	}
	if policy.Default == "" {
		return ApprovalDecisionRisk
	}
	return policy.Default
}

func defaultEditing() *Editing {
	return &Editing{
		MaxHistoryMessages:  7,
		Temperature:         1.0,
		MaxCompletionTokens: 0,
	}
}

func defaultCommandReview() *CommandReview {
	return &CommandReview{Timeout: 30}
}

func defaultWebSearch() *WebSearch {
	return &WebSearch{
		Enabled:         true,
		Provider:        "auto",
		QueryType:       "general",
		MaxResults:      8,
		TimeoutMs:       15000,
		CacheTTLSeconds: 60,
		Engines:         map[string]*WebSearchEngine{},
	}
}

func defaultVision() *Vision {
	return &Vision{RequestTimeout: 300, MaxImageBytes: 20 * 1024 * 1024, MaxPixels: 40 * 1000 * 1000, MaxEdge: 2048}
}

func defaultImageGeneration() *ImageGeneration {
	return &ImageGeneration{RequestTimeout: 300, Size: "1024x1024", Quality: "auto", OutputFormat: "png"}
}

func NewAI() *AI {
	ai := &AI{
		OpenAI:          defaultOpenAI(),
		Providers:       []*Provider{},
		MCP:             &MCP{Servers: []MCPServer{}, ExposurePolicy: defaultCapabilityPolicy()},
		Embedding:       defaultEmbedding(),
		Rerank:          defaultRerank(),
		Agent:           defaultAgent(),
		CommandReview:   defaultCommandReview(),
		Editing:         defaultEditing(),
		ImageGeneration: defaultImageGeneration(),
		WebSearch:       defaultWebSearch(),
	}

	apiKey := os.Getenv("SIYUAN_OPENAI_API_KEY")
	apiModel := os.Getenv("SIYUAN_OPENAI_API_MODEL")
	apiBaseURL := os.Getenv("SIYUAN_OPENAI_API_BASE_URL")

	ai.OpenAI.APIKey = apiKey
	if apiModel != "" {
		ai.OpenAI.APIModel = apiModel
	}
	if apiBaseURL != "" {
		ai.OpenAI.APIBaseURL = apiBaseURL
	}

	if timeout := os.Getenv("SIYUAN_OPENAI_API_TIMEOUT"); "" != timeout {
		if v, err := strconv.Atoi(timeout); err == nil {
			ai.OpenAI.APITimeout = v
		}
	}
	if proxy := os.Getenv("SIYUAN_OPENAI_API_PROXY"); "" != proxy {
		ai.OpenAI.APIProxy = proxy
	}
	if maxTokens := os.Getenv("SIYUAN_OPENAI_API_MAX_TOKENS"); "" != maxTokens {
		if v, err := strconv.Atoi(maxTokens); err == nil {
			ai.OpenAI.APIMaxTokens = v
		}
	}
	if temperature := os.Getenv("SIYUAN_OPENAI_API_TEMPERATURE"); "" != temperature {
		if v, err := strconv.ParseFloat(temperature, 64); err == nil {
			ai.OpenAI.APITemperature = v
		}
	}
	if maxContexts := os.Getenv("SIYUAN_OPENAI_API_MAX_CONTEXTS"); "" != maxContexts {
		if v, err := strconv.Atoi(maxContexts); err == nil {
			ai.OpenAI.APIMaxContexts = v
		}
	}
	if userAgent := os.Getenv("SIYUAN_OPENAI_API_USER_AGENT"); "" != userAgent {
		ai.OpenAI.APIUserAgent = userAgent
	}

	if apiModel != "" && apiBaseURL != "" {
		provider := &Provider{
			BaseURL:        apiBaseURL,
			RequestTimeout: 120,
			Enabled:        true,
			APIKey:         apiKey,
		}
		if timeout := os.Getenv("SIYUAN_OPENAI_API_TIMEOUT"); "" != timeout {
			if v, err := strconv.Atoi(timeout); err == nil {
				provider.RequestTimeout = v
			}
		}

		model := &Model{
			Name:    apiModel,
			Enabled: true,
		}
		if maxTokens := os.Getenv("SIYUAN_OPENAI_API_MAX_TOKENS"); "" != maxTokens {
			if v, err := strconv.Atoi(maxTokens); err == nil {
				ai.Editing.MaxCompletionTokens = v
			}
		}
		if temperature := os.Getenv("SIYUAN_OPENAI_API_TEMPERATURE"); "" != temperature {
			if v, err := strconv.ParseFloat(temperature, 64); err == nil {
				ai.Editing.Temperature = v
			}
		}
		if maxContexts := os.Getenv("SIYUAN_OPENAI_API_MAX_CONTEXTS"); "" != maxContexts {
			if v, err := strconv.Atoi(maxContexts); err == nil {
				ai.Editing.MaxHistoryMessages = v
			}
		}

		provider.Models = append(provider.Models, model)
		ai.Providers = append(ai.Providers, provider)
	}

	if agentTimeout := os.Getenv("SIYUAN_OPENAI_AGENT_TIMEOUT"); "" != agentTimeout {
		if v, err := strconv.Atoi(agentTimeout); err == nil {
			ai.Agent.SessionTimeout = v
		}
	}
	if agentStreamIdleTimeout := os.Getenv("SIYUAN_OPENAI_AGENT_STREAM_IDLE_TIMEOUT"); "" != agentStreamIdleTimeout {
		if v, err := strconv.Atoi(agentStreamIdleTimeout); err == nil {
			ai.Agent.StreamIdleTimeout = v
		}
	}
	if agentConfirmTimeout := os.Getenv("SIYUAN_OPENAI_AGENT_CONFIRM_TIMEOUT"); "" != agentConfirmTimeout {
		if v, err := strconv.Atoi(agentConfirmTimeout); err == nil {
			ai.Agent.ConfirmTimeout = v
		}
	}
	if agentMaxRetries := os.Getenv("SIYUAN_OPENAI_AGENT_MAX_RETRIES"); "" != agentMaxRetries {
		if v, err := strconv.Atoi(agentMaxRetries); err == nil {
			ai.Agent.MaxRetries = v
		}
	}
	if agentTemperature := os.Getenv("SIYUAN_OPENAI_AGENT_TEMPERATURE"); "" != agentTemperature {
		if v, err := strconv.ParseFloat(agentTemperature, 64); err == nil {
			ai.Agent.Temperature = v
		}
	}
	if agentMaxCompletionTokens := os.Getenv("SIYUAN_OPENAI_AGENT_MAX_COMPLETION_TOKENS"); "" != agentMaxCompletionTokens {
		if v, err := strconv.Atoi(agentMaxCompletionTokens); err == nil {
			ai.Agent.MaxCompletionTokens = v
		}
	}
	if agentMaxToolCallRounds := os.Getenv("SIYUAN_OPENAI_AGENT_MAX_TOOL_CALL_ROUNDS"); "" != agentMaxToolCallRounds {
		if v, err := strconv.Atoi(agentMaxToolCallRounds); err == nil {
			ai.Agent.MaxToolCallRounds = v
		}
	}

	embeddingKey := os.Getenv("SIYUAN_OPENAI_EMBEDDING_API_KEY")
	embeddingBaseURL := os.Getenv("SIYUAN_OPENAI_EMBEDDING_BASE_URL")
	embeddingModel := os.Getenv("SIYUAN_OPENAI_EMBEDDING_MODEL")
	if "" != embeddingKey && "" != embeddingBaseURL && "" != embeddingModel {
		ai.Embedding = &Embedding{
			APIKey:  embeddingKey,
			BaseURL: embeddingBaseURL,
			Name:    embeddingModel,
			Timeout: 30,
		}
	}

	return ai
}

func (ai *AI) HasAnyProvider() bool {
	for _, p := range ai.Providers {
		if p != nil && p.Enabled {
			for _, m := range p.Models {
				if m != nil && m.Name != "" && m.Enabled {
					return true
				}
			}
		}
	}
	return false
}

func (ai *AI) GetModel(id string) (*Provider, *Model) {
	if id == "" {
		return nil, nil
	}

	// Agent 面板在不同 Provider 存在同名模型时使用 providerID:modelID 作为唯一值。
	// 先解析这个复合 ID，避免按普通模型 ID 回退到第一个同名模型。
	if separator := strings.IndexByte(id, ':'); separator > 0 {
		providerID, modelID := id[:separator], id[separator+1:]
		for _, p := range ai.Providers {
			if p == nil || p.ID != providerID || !p.Enabled {
				continue
			}
			for _, m := range p.Models {
				if m != nil && m.ID == modelID && m.Enabled {
					return p, m
				}
			}
		}
	}

	for _, p := range ai.Providers {
		if p == nil || !p.Enabled {
			continue
		}
		for _, m := range p.Models {
			if m != nil && m.ID == id && m.Enabled {
				return p, m
			}
		}
	}

	for _, p := range ai.Providers {
		if p == nil || !p.Enabled {
			continue
		}
		for _, m := range p.Models {
			if m != nil && m.DisplayName == id && m.Enabled {
				return p, m
			}
		}
	}

	for _, p := range ai.Providers {
		if p == nil || !p.Enabled {
			continue
		}
		for _, m := range p.Models {
			if m != nil && m.Name == id && m.Enabled {
				return p, m
			}
		}
	}

	return nil, nil
}

func (ai *AI) GetEditingModel() (*Provider, *Model) {
	if ai.Editing == nil || ai.Editing.ModelID == "" {
		return nil, nil
	}
	return ai.GetModel(ai.Editing.ModelID)
}

func (ai *AI) GetAgentModel() (*Provider, *Model) {
	if ai.Agent == nil || ai.Agent.ModelID == "" {
		return nil, nil
	}
	return ai.GetModel(ai.Agent.ModelID)
}

func (ai *AI) GetCommandReviewModel() (*Provider, *Model) {
	if ai.CommandReview == nil || ai.CommandReview.ModelID == "" {
		return nil, nil
	}
	return ai.GetModel(ai.CommandReview.ModelID)
}

func (ai *AI) GetVisionModel() (*Provider, *Model) {
	if ai.Vision == nil || ai.Vision.ModelID == "" {
		return nil, nil
	}
	return ai.GetModel(ai.Vision.ModelID)
}

func (ai *AI) GetImageGenerationModel() (*Provider, *Model) {
	if ai.ImageGeneration == nil || ai.ImageGeneration.ModelID == "" {
		return nil, nil
	}
	return ai.GetModel(ai.ImageGeneration.ModelID)
}

// ReconcileModelIDs 校正各使用场景引用的模型，并将旧版名称引用转换为模型 ID。
// 编辑器和智能体始终回退到首个可用模型，可选的图片生成场景仅清理失效引用。
func (ai *AI) ReconcileModelIDs() {
	firstModelID := ""
	for _, p := range ai.Providers {
		if p == nil || !p.Enabled {
			continue
		}
		for _, m := range p.Models {
			if m != nil && m.Enabled && m.Name != "" {
				firstModelID = m.ID
				break
			}
		}
		if firstModelID != "" {
			break
		}
	}

	if ai.Editing == nil {
		ai.Editing = defaultEditing()
	}
	if _, m := ai.GetModel(ai.Editing.ModelID); m == nil {
		ai.Editing.ModelID = firstModelID
	} else {
		ai.Editing.ModelID = m.ID
	}
	if ai.Agent == nil {
		ai.Agent = defaultAgent()
	}
	if _, m := ai.GetModel(ai.Agent.ModelID); m == nil {
		ai.Agent.ModelID = firstModelID
	} else {
		ai.Agent.ModelID = m.ID
	}
	if ai.ImageGeneration != nil {
		if _, m := ai.GetModel(ai.ImageGeneration.ModelID); ai.ImageGeneration.ModelID != "" {
			if m == nil {
				ai.ImageGeneration.ModelID = ""
			} else {
				ai.ImageGeneration.ModelID = m.ID
			}
		}
	}
}

func (ai *AI) Normalize() {
	if ai.OpenAI == nil {
		ai.OpenAI = defaultOpenAI()
	} else {
		normalizeOpenAI(ai.OpenAI)
	}
	if ai.Providers == nil {
		ai.Providers = []*Provider{}
	}
	if ai.MCP == nil {
		ai.MCP = &MCP{Servers: []MCPServer{}, ExposurePolicy: defaultCapabilityPolicy()}
	} else if ai.MCP.Servers == nil {
		ai.MCP.Servers = []MCPServer{}
	}
	ai.MCP.ExposurePolicy = normalizeCapabilityPolicy(ai.MCP.ExposurePolicy)
	serverIDs := map[string]bool{}
	for i := range ai.MCP.Servers {
		if ai.MCP.Servers[i].ID == "" || serverIDs[ai.MCP.Servers[i].ID] {
			ai.MCP.Servers[i].ID = uuid.New().String()
		}
		serverIDs[ai.MCP.Servers[i].ID] = true
	}
	if ai.Agent == nil {
		ai.Agent = defaultAgent()
	} else {
		if ai.Agent.Skills == nil {
			ai.Agent.Skills = &AgentSkills{UserEnabled: []string{}}
		} else {
			seen := map[string]struct{}{}
			normalized := []string{}
			for _, id := range ai.Agent.Skills.UserEnabled {
				id = strings.TrimSpace(id)
				key := strings.ToLower(id)
				if id == "" || id == "." || id == ".." || strings.ContainsAny(id, `/\`) {
					continue
				}
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				normalized = append(normalized, id)
			}
			ai.Agent.Skills.UserEnabled = normalized
		}
		ai.Agent.CapabilityPolicy = normalizeCapabilityPolicy(ai.Agent.CapabilityPolicy)
		if ai.Agent.ApprovalPolicy == nil {
			ai.Agent.ApprovalPolicy = defaultApprovalPolicy()
		} else {
			normalizeApprovalPolicy(ai.Agent.ApprovalPolicy)
		}
		if ai.Agent.SessionTimeout < 0 {
			ai.Agent.SessionTimeout = 0
		} else if ai.Agent.SessionTimeout > 3600 {
			ai.Agent.SessionTimeout = 3600
		}
		if ai.Agent.StreamIdleTimeout < 1 {
			ai.Agent.StreamIdleTimeout = 120
		} else if ai.Agent.StreamIdleTimeout > 600 {
			ai.Agent.StreamIdleTimeout = 600
		}
		if ai.Agent.MaxRetries < 0 {
			ai.Agent.MaxRetries = 0
		} else if ai.Agent.MaxRetries > 10 {
			ai.Agent.MaxRetries = 10
		}
	}
	if ai.CommandReview == nil {
		ai.CommandReview = defaultCommandReview()
	}
	if ai.CommandReview.Timeout < 1 {
		ai.CommandReview.Timeout = 30
	} else if ai.CommandReview.Timeout > 120 {
		ai.CommandReview.Timeout = 120
	}
	if ai.CommandReview.ModelID == "" && ai.Agent != nil {
		ai.CommandReview.ModelID = ai.Agent.ModelID
	}
	ai.pruneOrphanedMCPCapabilityPolicies()
	if ai.Editing == nil {
		ai.Editing = defaultEditing()
	} else {
		if 0 > ai.Editing.MaxCompletionTokens {
			ai.Editing.MaxCompletionTokens = 0
		}
		if 0 > ai.Editing.Temperature {
			ai.Editing.Temperature = 0
		} else if 2 < ai.Editing.Temperature {
			ai.Editing.Temperature = 2
		}
		if 1 > ai.Editing.MaxHistoryMessages {
			ai.Editing.MaxHistoryMessages = 1
		} else if 64 < ai.Editing.MaxHistoryMessages {
			ai.Editing.MaxHistoryMessages = 64
		}
	}
	if ai.WebSearch == nil {
		ai.WebSearch = defaultWebSearch()
	} else {
		normalizeWebSearch(ai.WebSearch)
	}
	if ai.Vision == nil {
		ai.Vision = defaultVision()
	}
	if ai.Vision.RequestTimeout < 1 {
		ai.Vision.RequestTimeout = 300
	} else if ai.Vision.RequestTimeout > 600 {
		ai.Vision.RequestTimeout = 600
	}
	if ai.Vision.MaxImageBytes < 1024*1024 {
		ai.Vision.MaxImageBytes = 20 * 1024 * 1024
	} else if ai.Vision.MaxImageBytes > 100*1024*1024 {
		ai.Vision.MaxImageBytes = 100 * 1024 * 1024
	}
	if ai.Vision.MaxPixels < 1000*1000 {
		ai.Vision.MaxPixels = 40 * 1000 * 1000
	} else if ai.Vision.MaxPixels > 100*1000*1000 {
		ai.Vision.MaxPixels = 100 * 1000 * 1000
	}
	if ai.Vision.MaxEdge < 512 {
		ai.Vision.MaxEdge = 2048
	} else if ai.Vision.MaxEdge > 4096 {
		ai.Vision.MaxEdge = 4096
	}
	if ai.ImageGeneration == nil {
		ai.ImageGeneration = defaultImageGeneration()
	}
	if ai.ImageGeneration.RequestTimeout < 1 {
		ai.ImageGeneration.RequestTimeout = 300
	} else if ai.ImageGeneration.RequestTimeout > 600 {
		ai.ImageGeneration.RequestTimeout = 600
	}
	ai.ImageGeneration.Size = strings.TrimSpace(ai.ImageGeneration.Size)
	if ai.ImageGeneration.Size == "" {
		ai.ImageGeneration.Size = "1024x1024"
	}
	ai.ImageGeneration.Quality = strings.TrimSpace(ai.ImageGeneration.Quality)
	if ai.ImageGeneration.Quality == "" {
		ai.ImageGeneration.Quality = "auto"
	}
	ai.ImageGeneration.OutputFormat = strings.ToLower(strings.TrimSpace(ai.ImageGeneration.OutputFormat))
	if ai.ImageGeneration.OutputFormat != "jpeg" && ai.ImageGeneration.OutputFormat != "webp" {
		ai.ImageGeneration.OutputFormat = "png"
	}
	providers := make([]*Provider, 0, len(ai.Providers))
	for _, p := range ai.Providers {
		if p == nil {
			continue
		}
		p.BaseURL = strings.TrimSpace(p.BaseURL)
		if "" == p.BaseURL {
			p.BaseURL = "https://api.openai.com/v1"
		}
		p.DisplayName = strings.TrimSpace(p.DisplayName)
		p.APIKey = strings.TrimSpace(p.APIKey)
		p.Protocol = strings.ToLower(strings.TrimSpace(p.Protocol))
		if p.Protocol == "" {
			p.Protocol = util.OpenAIProtocolChatCompletions
		}
		if 1 > p.RequestTimeout {
			p.RequestTimeout = 120
		} else if 600 < p.RequestTimeout {
			p.RequestTimeout = 600
		}
		if !ast.IsNodeIDPattern(p.ID) {
			p.ID = ast.NewNodeID()
		}
		models := make([]*Model, 0, len(p.Models))
		for _, m := range p.Models {
			if m == nil {
				continue
			}
			m.Name = strings.TrimSpace(m.Name)
			if "" == m.Name {
				m.Name = "model"
			}
			m.DisplayName = strings.TrimSpace(m.DisplayName)
			if m.ContextLength < 0 || 100000000 < m.ContextLength {
				m.ContextLength = 0
			}
			if !ast.IsNodeIDPattern(m.ID) {
				m.ID = ast.NewNodeID()
			}
			models = append(models, m)
		}
		cachedModels := make([]string, 0, len(p.CachedModels))
		seenCachedModels := make(map[string]struct{}, len(p.CachedModels))
		for _, name := range p.CachedModels {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			if _, exists := seenCachedModels[name]; exists {
				continue
			}
			seenCachedModels[name] = struct{}{}
			cachedModels = append(cachedModels, name)
		}
		p.CachedModels = cachedModels
		if len(cachedModels) == 0 {
			p.CachedModelsAt = 0
		}
		p.Models = models
		providers = append(providers, p)
	}
	ai.Providers = providers
	if ai.Embedding == nil {
		ai.Embedding = defaultEmbedding()
	}
	if ai.Embedding.Timeout < 1 {
		ai.Embedding.Timeout = 30
	}
	if ai.Embedding.Dimensions < 0 {
		ai.Embedding.Dimensions = 0 // 负值非法，归零表示用模型默认维度
	}
	if !ast.IsNodeIDPattern(ai.Embedding.ID) {
		ai.Embedding.ID = ast.NewNodeID()
	}
	if ai.Rerank == nil {
		ai.Rerank = defaultRerank()
	}
	if ai.Rerank.Timeout < 1 {
		ai.Rerank.Timeout = 30
	}
	if util.RerankRequestFormatCohere != ai.Rerank.RequestFormat &&
		util.RerankRequestFormatDashScope != ai.Rerank.RequestFormat {
		ai.Rerank.RequestFormat = util.RerankRequestFormatCohere
	}
	if ai.Rerank.CandidateCount < 5 {
		ai.Rerank.CandidateCount = 5
	} else if ai.Rerank.CandidateCount > 100 {
		ai.Rerank.CandidateCount = 100
	}
	if !ast.IsNodeIDPattern(ai.Rerank.ID) {
		ai.Rerank.ID = ast.NewNodeID()
	}
}

func normalizeOpenAI(openAI *OpenAI) {
	if openAI.APITimeout < 1 {
		openAI.APITimeout = 120
	}
	if openAI.APIMaxContexts < 1 {
		openAI.APIMaxContexts = 7
	}
	if openAI.APIModel == "" {
		openAI.APIModel = openai.GPT3Dot5Turbo
	}
	if openAI.APIBaseURL == "" {
		openAI.APIBaseURL = "https://api.openai.com/v1"
	}
	if openAI.APIUserAgent == "" {
		openAI.APIUserAgent = util.UserAgent
	}
	if openAI.APIProvider == "" {
		openAI.APIProvider = "OpenAI"
	}
	if openAI.MAGISleepStartHour < 0 || openAI.MAGISleepStartHour > 23 {
		openAI.MAGISleepStartHour = 0
	}
	if openAI.MAGISleepEndHour < 1 || openAI.MAGISleepEndHour > 23 {
		openAI.MAGISleepEndHour = 8
	}
}

func normalizeWebSearch(search *WebSearch) {
	if search.Provider == "" {
		search.Provider = "auto"
	}
	if search.MaxResults < 1 {
		search.MaxResults = 8
	} else if search.MaxResults > 50 {
		search.MaxResults = 50
	}
	if search.TimeoutMs < 1000 {
		search.TimeoutMs = 15000
	} else if search.TimeoutMs > 120000 {
		search.TimeoutMs = 120000
	}
	if search.CacheTTLSeconds < 0 {
		search.CacheTTLSeconds = 0
	}
	if search.Engines == nil {
		search.Engines = map[string]*WebSearchEngine{}
	}
	for name, engine := range search.Engines {
		if engine == nil {
			delete(search.Engines, name)
			continue
		}
		if engine.TimeoutMs < 1000 {
			engine.TimeoutMs = search.TimeoutMs
		}
		if engine.MaxResults < 1 {
			engine.MaxResults = search.MaxResults
		}
		if engine.Headers == nil {
			engine.Headers = map[string]string{}
		}
	}
}

func (ai *AI) pruneOrphanedMCPCapabilityPolicies() {
	configuredServerIDs := make(map[string]bool, len(ai.MCP.Servers))
	for _, server := range ai.MCP.Servers {
		configuredServerIDs[url.PathEscape(server.ID)] = true
	}

	isOrphaned := func(id string) bool {
		const prefix = "mcp/backend/"
		if !strings.HasPrefix(id, prefix) {
			return false
		}
		serverID, _, ok := strings.Cut(strings.TrimPrefix(id, prefix), "/")
		return ok && !configuredServerIDs[serverID]
	}
	for id := range ai.Agent.CapabilityPolicy.Overrides {
		if isOrphaned(id) {
			delete(ai.Agent.CapabilityPolicy.Overrides, id)
		}
	}
	for id := range ai.Agent.ApprovalPolicy.Overrides {
		if isOrphaned(id) {
			delete(ai.Agent.ApprovalPolicy.Overrides, id)
		}
	}
}

func normalizeApprovalPolicy(policy *ApprovalPolicy) {
	// 旧版中的 confirm 表示未自动批准，实际仍按操作风险判断，因此迁移为 risk。
	if policy.Default == ApprovalDecisionConfirm ||
		policy.Default != ApprovalDecisionAllow && policy.Default != ApprovalDecisionRisk {
		policy.Default = ApprovalDecisionRisk
	}
	if policy.Overrides == nil {
		policy.Overrides = map[string]*CapabilityApproval{}
	}
	for id, override := range policy.Overrides {
		if id == "" || override == nil {
			delete(policy.Overrides, id)
			continue
		}
		if override.Default != ApprovalDecisionAllow && override.Default != ApprovalDecisionConfirm &&
			override.Default != ApprovalDecisionRisk {
			override.Default = ""
		}
		if override.Actions == nil {
			override.Actions = map[string]string{}
		}
		for action, decision := range override.Actions {
			if decision != ApprovalDecisionAllow && decision != ApprovalDecisionConfirm &&
				decision != ApprovalDecisionRisk {
				delete(override.Actions, action)
			}
		}
		if override.Default == "" && len(override.Actions) == 0 {
			delete(policy.Overrides, id)
		}
	}
}

func (ai *AI) DecryptAPIKeys() {
	if ai.OpenAI != nil && ai.OpenAI.APIKey != "" {
		ai.OpenAI.APIKey = decryptAPIKey(ai.OpenAI.APIKey)
	}
	for _, p := range ai.Providers {
		if p == nil || p.APIKey == "" {
			continue
		}
		p.APIKey = decryptAPIKey(p.APIKey)
	}
	if ai.Embedding != nil && ai.Embedding.APIKey != "" {
		ai.Embedding.APIKey = decryptAPIKey(ai.Embedding.APIKey)
	}
	if ai.Rerank != nil && ai.Rerank.APIKey != "" {
		ai.Rerank.APIKey = decryptAPIKey(ai.Rerank.APIKey)
	}
	if ai.WebSearch != nil {
		ai.WebSearch.ExaAPIKey = decryptAPIKey(ai.WebSearch.ExaAPIKey)
		ai.WebSearch.ParallelAPIKey = decryptAPIKey(ai.WebSearch.ParallelAPIKey)
		for _, engine := range ai.WebSearch.Engines {
			if engine != nil {
				engine.APIKey = decryptAPIKey(engine.APIKey)
			}
		}
	}
}

func (ai *AI) EncryptAPIKeys() {
	if ai.OpenAI != nil && ai.OpenAI.APIKey != "" {
		ai.OpenAI.APIKey = util.AESEncrypt(ai.OpenAI.APIKey)
	}
	for _, p := range ai.Providers {
		if p == nil || p.APIKey == "" {
			continue
		}
		p.APIKey = util.AESEncrypt(p.APIKey)
	}
	if ai.Embedding != nil && ai.Embedding.APIKey != "" {
		ai.Embedding.APIKey = util.AESEncrypt(ai.Embedding.APIKey)
	}
	if ai.Rerank != nil && ai.Rerank.APIKey != "" {
		ai.Rerank.APIKey = util.AESEncrypt(ai.Rerank.APIKey)
	}
	if ai.WebSearch != nil {
		ai.WebSearch.ExaAPIKey = encryptAPIKey(ai.WebSearch.ExaAPIKey)
		ai.WebSearch.ParallelAPIKey = encryptAPIKey(ai.WebSearch.ParallelAPIKey)
		for _, engine := range ai.WebSearch.Engines {
			if engine != nil {
				engine.APIKey = encryptAPIKey(engine.APIKey)
			}
		}
	}
}

func decryptAPIKey(value string) string {
	if value == "" {
		return ""
	}
	dec := util.AESDecrypt(value)
	if dec == nil {
		return value
	}
	plain, err := hex.DecodeString(string(dec))
	if err != nil {
		return value
	}
	return string(plain)
}

func encryptAPIKey(value string) string {
	if value == "" {
		return ""
	}
	return util.AESEncrypt(value)
}

func NeedsAIMigration(data []byte) bool {
	var topRaw map[string]json.RawMessage
	if err := json.Unmarshal(data, &topRaw); err != nil {
		return false
	}
	aiRaw, ok := topRaw["ai"]
	if !ok {
		return false
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(aiRaw, &raw); err != nil {
		return false
	}
	_, hasOpenAI := raw["openAI"]
	_, hasProviders := raw["providers"]
	_, hasAgent := raw["agent"]
	_, hasEditing := raw["editing"]
	_, hasEmbedding := raw["embedding"]
	return hasOpenAI && !hasProviders && !hasAgent && !hasEditing && !hasEmbedding
}

func MigrateAI(data []byte) *AI {
	var topRaw map[string]json.RawMessage
	if err := json.Unmarshal(data, &topRaw); err != nil {
		return NewAI()
	}
	aiRaw, ok := topRaw["ai"]
	if !ok {
		return NewAI()
	}
	var raw map[string]any
	if err := json.Unmarshal(aiRaw, &raw); err != nil {
		return NewAI()
	}

	ai := &AI{}

	if mcp, ok := raw["mcp"].(map[string]any); ok {
		ai.MCP = migrateMCP(mcp)
	}

	if oai, ok := raw["openAI"].(map[string]any); ok {
		ai.OpenAI = migrateOpenAI(oai)
		prov := migrateProvider(oai)
		m := migrateModel(oai)
		prov.Models = append(prov.Models, m)
		ai.Providers = append(ai.Providers, prov)

		ai.Agent = &Agent{
			SessionTimeout:    getInt(oai, "agentTimeout"),
			ConfirmTimeout:    getInt(oai, "agentConfirmTimeout"),
			MaxRetries:        getInt(oai, "agentMaxRetries"),
			MaxToolCallRounds: 64,
		}

		maxContexts := getInt(oai, "apiMaxContexts")
		ai.Editing = &Editing{
			MaxHistoryMessages:  maxContexts,
			Temperature:         getFloat(oai, "apiTemperature"),
			MaxCompletionTokens: getInt(oai, "apiMaxTokens"),
		}
	}

	if provs, ok := raw["providers"].([]any); ok {
		for _, item := range provs {
			p, ok2 := item.(map[string]any)
			if !ok2 {
				continue
			}
			if getString(p, "type") == "embedding" {
				ai.Embedding = migrateEmbedding(p)
			} else {
				m := migrateModel(p)
				oldBaseURL := getString(p, "apiBaseURL")
				if existing := findProviderByBaseURL(ai.Providers, oldBaseURL); existing != nil {
					existing.Models = append(existing.Models, m)
				} else {
					prov := migrateProvider(p)
					prov.Models = append(prov.Models, m)
					ai.Providers = append(ai.Providers, prov)
				}
			}
		}
	}

	ai.Normalize()
	assignDefaultModelIDs(ai)

	return ai
}

func assignDefaultModelIDs(ai *AI) {
	if (ai.Editing != nil && ai.Editing.ModelID != "") || (ai.Agent != nil && ai.Agent.ModelID != "") ||
		(ai.CommandReview != nil && ai.CommandReview.ModelID != "") {
		return
	}
	var m *Model
	for _, p := range ai.Providers {
		if p == nil || !p.Enabled {
			continue
		}
		for _, model := range p.Models {
			if model != nil && model.Name != "" && model.Enabled {
				m = model
				break
			}
		}
		if m != nil {
			break
		}
	}
	if m == nil && len(ai.Providers) > 0 && ai.Providers[0] != nil && len(ai.Providers[0].Models) > 0 {
		m = ai.Providers[0].Models[0]
	}
	if m == nil || m.ID == "" {
		return
	}
	if ai.Editing == nil {
		ai.Editing = &Editing{}
	}
	if ai.Editing.ModelID == "" {
		ai.Editing.ModelID = m.ID
	}
	if ai.Agent == nil {
		ai.Agent = &Agent{MaxToolCallRounds: 64}
	}
	if ai.Agent.ModelID == "" {
		ai.Agent.ModelID = m.ID
	}
	if ai.CommandReview == nil {
		ai.CommandReview = defaultCommandReview()
	}
	if ai.CommandReview.ModelID == "" {
		ai.CommandReview.ModelID = m.ID
	}
}

func findProviderByBaseURL(providers []*Provider, baseURL string) *Provider {
	for _, p := range providers {
		if p != nil && p.BaseURL == baseURL && baseURL != "" {
			return p
		}
	}
	return nil
}

func migrateMCP(raw map[string]any) *MCP {
	mcp := &MCP{}
	servers, ok := raw["servers"].([]any)
	if !ok {
		return mcp
	}
	for _, s := range servers {
		sm, ok2 := s.(map[string]any)
		if !ok2 {
			continue
		}
		mcp.Servers = append(mcp.Servers, MCPServer{
			ID:                   getString(sm, "id"),
			Name:                 getString(sm, "name"),
			Enabled:              getBool(sm, "enabled"),
			Type:                 getString(sm, "type"),
			Command:              getString(sm, "command"),
			Args:                 getStringSlice(sm, "args"),
			InheritEnv:           getStringSlice(sm, "inheritEnv"),
			Env:                  getStringMap(sm, "env"),
			URL:                  getString(sm, "url"),
			Headers:              getStringMap(sm, "headers"),
			Timeout:              getInt(sm, "timeout"),
			TrustToolAnnotations: getBool(sm, "trustToolAnnotations"),
		})
	}
	return mcp
}

func migrateProvider(raw map[string]any) *Provider {
	return &Provider{
		ID:             getString(raw, "id"),
		Enabled:        true,
		APIKey:         getString(raw, "apiKey"),
		BaseURL:        getString(raw, "apiBaseURL"),
		RequestTimeout: getInt(raw, "apiTimeout"),
	}
}

func migrateOpenAI(raw map[string]any) *OpenAI {
	openAI := defaultOpenAI()
	if v := getString(raw, "apiKey"); v != "" {
		openAI.APIKey = v
	}
	if v := getInt(raw, "apiTimeout"); v > 0 {
		openAI.APITimeout = v
	}
	if v := getString(raw, "apiProxy"); v != "" {
		openAI.APIProxy = v
	}
	if v := getString(raw, "apiModel"); v != "" {
		openAI.APIModel = v
	}
	if _, ok := raw["apiMaxTokens"]; ok {
		openAI.APIMaxTokens = getInt(raw, "apiMaxTokens")
	}
	if _, ok := raw["apiTemperature"]; ok {
		openAI.APITemperature = getFloat(raw, "apiTemperature")
	}
	if v := getInt(raw, "apiMaxContexts"); v > 0 {
		openAI.APIMaxContexts = v
	}
	if v := getString(raw, "apiBaseURL"); v != "" {
		openAI.APIBaseURL = v
	}
	if v := getString(raw, "apiUserAgent"); v != "" {
		openAI.APIUserAgent = v
	}
	if v := getString(raw, "apiProvider"); v != "" {
		openAI.APIProvider = v
	}
	if v := getString(raw, "apiVersion"); v != "" {
		openAI.APIVersion = v
	}
	if v := getInt(raw, "magiSleepStartHour"); v >= 0 && v <= 23 {
		openAI.MAGISleepStartHour = v
	}
	if v := getInt(raw, "magiSleepEndHour"); v > 0 && v <= 23 {
		openAI.MAGISleepEndHour = v
	}
	return openAI
}

func migrateModel(raw map[string]any) *Model {
	enabled := true
	if v, ok := raw["enabled"]; ok {
		if b, ok2 := v.(bool); ok2 && !b {
			enabled = false
		}
	}
	return &Model{
		ID:          getString(raw, "id"),
		DisplayName: getString(raw, "name"),
		Enabled:     enabled,
		Name:        getString(raw, "apiModel"),
	}
}

func migrateEmbedding(raw map[string]any) *Embedding {
	return &Embedding{
		ID:      getString(raw, "id"),
		Enabled: getBool(raw, "enabled"),
		APIKey:  getString(raw, "apiKey"),
		BaseURL: getString(raw, "apiBaseURL"),
		Name:    getString(raw, "apiModel"),
		Timeout: getInt(raw, "apiTimeout"),
	}
}

func getString(m map[string]any, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getInt(m map[string]any, key string) int {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return 0
}

func getFloat(m map[string]any, key string) float64 {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

func getBool(m map[string]any, key string) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

func getStringSlice(m map[string]any, key string) []string {
	if v, ok := m[key]; ok {
		if arr, ok := v.([]any); ok {
			ret := make([]string, 0, len(arr))
			for _, item := range arr {
				if s, ok := item.(string); ok {
					ret = append(ret, s)
				}
			}
			return ret
		}
	}
	return nil
}

func getStringMap(m map[string]any, key string) map[string]string {
	if v, ok := m[key]; ok {
		if sm, ok := v.(map[string]any); ok {
			ret := make(map[string]string)
			for k, val := range sm {
				if s, ok := val.(string); ok {
					ret[k] = s
				}
			}
			return ret
		}
	}
	return nil
}
