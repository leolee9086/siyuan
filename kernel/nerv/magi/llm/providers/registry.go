// Package providers 定义 LLM API Provider 注册中心。
// 综合 ST 和 Zoo Code 的 Provider 覆盖范围，按类型分类管理。
package providers

import "sort"

// ProviderKind Provider 协议类型
type ProviderKind string

const (
	KindChatCompletion ProviderKind = "chat"   // Chat Completions API (OpenAI 兼容)
	KindTextCompletion ProviderKind = "text"   // Text Completions API
	KindNative         ProviderKind = "native" // 非 OpenAI 兼容的原生协议
)

// ProviderPreset Provider 预设定义
type ProviderPreset struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Kind           ProviderKind `json:"kind"`
	BaseURL        string       `json:"baseUrl,omitempty"`
	DefaultModel   string       `json:"defaultModel,omitempty"`
	ModelsEndpoint string       `json:"modelsEndpoint,omitempty"` // /models 相对路径，空=不支持
	DocsURL        string       `json:"docsUrl,omitempty"`
	APIKeyLabel    string       `json:"apiKeyLabel"`
	Features       []string     `json:"features,omitempty"` // streaming, tools, vision, reasoning
	Category       string       `json:"category"`           // cloud, local, aggregator, platform
	Note           string       `json:"note,omitempty"`
}

func (p ProviderPreset) ModelListURL() string {
	if p.ModelsEndpoint == "" {
		return ""
	}
	return p.BaseURL + p.ModelsEndpoint
}

// Registry 所有注册的 Provider 预设
var Registry = buildRegistry()

func buildRegistry() []ProviderPreset {
	all := append(chatProviders, nativeProviders...)
	all = append(all, textProviders...)
	sort.Slice(all, func(i, j int) bool { return all[i].ID < all[j].ID })
	return all
}

// ByID 按 ID 查找 Provider
func ByID(id string) *ProviderPreset {
	for i := range Registry {
		if Registry[i].ID == id {
			return &Registry[i]
		}
	}
	return nil
}

// ByKind 按类型过滤
func ByKind(kind ProviderKind) []ProviderPreset {
	var out []ProviderPreset
	for _, p := range Registry {
		if p.Kind == kind {
			out = append(out, p)
		}
	}
	return out
}

// ─── Chat Completion Providers (OpenAI 兼容, 当 Kind=chat 时 baseURL 默认填 /v1) ───

var chatProviders = []ProviderPreset{
	{
		ID: "openai", Name: "OpenAI", Kind: KindChatCompletion,
		BaseURL: "https://api.openai.com/v1", DefaultModel: "gpt-4o",
		ModelsEndpoint: "/models", DocsURL: "https://platform.openai.com",
		APIKeyLabel: "OpenAI API Key", Category: "cloud",
		Features: []string{"streaming", "tools", "vision", "reasoning"},
	},
	{
		ID: "deepseek", Name: "DeepSeek", Kind: KindChatCompletion,
		BaseURL: "https://api.deepseek.com/v1", DefaultModel: "deepseek-chat",
		ModelsEndpoint: "/models", DocsURL: "https://platform.deepseek.com",
		APIKeyLabel: "DeepSeek API Key", Category: "cloud",
		Features: []string{"streaming", "tools", "reasoning"},
	},
	{
		ID: "mistral", Name: "Mistral AI", Kind: KindChatCompletion,
		BaseURL: "https://api.mistral.ai/v1", DefaultModel: "mistral-large-latest",
		ModelsEndpoint: "/models", DocsURL: "https://docs.mistral.ai",
		APIKeyLabel: "Mistral API Key", Category: "cloud",
		Features: []string{"streaming", "tools", "vision"},
	},
	{
		ID: "gemini", Name: "Google AI Studio (Gemini)", Kind: KindChatCompletion,
		BaseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
		DefaultModel: "gemini-2.5-flash", ModelsEndpoint: "/models",
		DocsURL: "https://aistudio.google.com", APIKeyLabel: "Gemini API Key",
		Category: "cloud", Features: []string{"streaming", "tools", "vision", "reasoning"},
	},
	{
		ID: "groq", Name: "Groq", Kind: KindChatCompletion,
		BaseURL: "https://api.groq.com/openai/v1", DefaultModel: "llama-3.3-70b-versatile",
		ModelsEndpoint: "/models", DocsURL: "https://console.groq.com",
		APIKeyLabel: "Groq API Key", Category: "cloud",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "xai", Name: "xAI (Grok)", Kind: KindChatCompletion,
		BaseURL: "https://api.x.ai/v1", DefaultModel: "grok-beta",
		ModelsEndpoint: "/models", DocsURL: "https://x.ai/api",
		APIKeyLabel: "xAI API Key", Category: "cloud",
		Features: []string{"streaming", "tools", "vision"},
	},
	{
		ID: "cohere", Name: "Cohere", Kind: KindChatCompletion,
		BaseURL: "https://api.cohere.com/v1", DefaultModel: "command-r-plus",
		ModelsEndpoint: "/models", DocsURL: "https://docs.cohere.com",
		APIKeyLabel: "Cohere API Key", Category: "cloud",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "fireworks", Name: "Fireworks AI", Kind: KindChatCompletion,
		BaseURL: "https://api.fireworks.ai/inference/v1", DefaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
		ModelsEndpoint: "/models", DocsURL: "https://fireworks.ai",
		APIKeyLabel: "Fireworks API Key", Category: "cloud",
		Features: []string{"streaming", "tools", "vision"},
	},
	{
		ID: "perplexity", Name: "Perplexity", Kind: KindChatCompletion,
		BaseURL: "https://api.perplexity.ai", DefaultModel: "sonar-pro",
		DocsURL: "https://docs.perplexity.ai", APIKeyLabel: "Perplexity API Key",
		Category: "cloud", Features: []string{"streaming"},
		Note: "Perplexity 会默认开启联网搜索，兼容 OpenAI chat/completions",
	},
	{
		ID: "moonshot", Name: "Moonshot AI", Kind: KindChatCompletion,
		BaseURL: "https://api.moonshot.cn/v1", DefaultModel: "moonshot-v1-auto",
		ModelsEndpoint: "/models", DocsURL: "https://platform.moonshot.cn",
		APIKeyLabel: "Moonshot API Key", Category: "cloud",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "siliconflow", Name: "SiliconFlow", Kind: KindChatCompletion,
		BaseURL: "https://api.siliconflow.cn/v1", DefaultModel: "Qwen/Qwen2.5-72B-Instruct",
		ModelsEndpoint: "/models", DocsURL: "https://siliconflow.cn",
		APIKeyLabel: "SiliconFlow API Key", Category: "cloud",
		Features: []string{"streaming", "tools", "vision"},
	},
	{
		ID: "zai", Name: "Z.AI", Kind: KindChatCompletion,
		BaseURL: "https://api.z.ai/api/v1", DefaultModel: "glm-4-plus",
		DocsURL: "https://open.bigmodel.cn", APIKeyLabel: "Z.AI API Key",
		Category: "cloud", Features: []string{"streaming", "tools", "vision"},
	},
	{
		ID: "minimax", Name: "MiniMax", Kind: KindChatCompletion,
		BaseURL: "https://api.minimax.chat/v1", DefaultModel: "abab6.5s-chat",
		ModelsEndpoint: "/models", DocsURL: "https://platform.minimaxi.com",
		APIKeyLabel: "MiniMax API Key", Category: "cloud",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "workers_ai", Name: "Cloudflare Workers AI", Kind: KindChatCompletion,
		BaseURL: "https://api.cloudflare.com/client/v4/accounts/{account-id}/ai/v1",
		DefaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
		DocsURL: "https://developers.cloudflare.com/workers-ai",
		APIKeyLabel: "Cloudflare API Token", Category: "platform",
		Features: []string{"streaming"},
		Note: "须在 baseURL 中替换 {account-id} 为实际的 Cloudflare Account ID",
	},

	// ─── 聚合器 ───
	{
		ID: "openrouter", Name: "OpenRouter", Kind: KindChatCompletion,
		BaseURL: "https://openrouter.ai/api/v1", DefaultModel: "openai/gpt-4o",
		ModelsEndpoint: "/models", DocsURL: "https://openrouter.ai/docs",
		APIKeyLabel: "OpenRouter API Key", Category: "aggregator",
		Features: []string{"streaming", "tools", "vision", "reasoning"},
	},
	{
		ID: "aimlapi", Name: "AI/ML API", Kind: KindChatCompletion,
		BaseURL: "https://api.aimlapi.com/v1", DefaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo",
		ModelsEndpoint: "/models", DocsURL: "https://aimlapi.com",
		APIKeyLabel: "AI/ML API Key", Category: "aggregator",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "requesty", Name: "Requesty", Kind: KindChatCompletion,
		BaseURL: "https://router.requesty.ai/v1", DefaultModel: "gpt-4o",
		ModelsEndpoint: "/models", DocsURL: "https://requesty.ai",
		APIKeyLabel: "Requesty API Key", Category: "aggregator",
		Features: []string{"streaming", "tools"},
	},

	// ─── 平台/企业 ───
	{
		ID: "azure_openai", Name: "Azure OpenAI", Kind: KindChatCompletion,
		BaseURL: "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
		DefaultModel: "gpt-4o", DocsURL: "https://learn.microsoft.com/azure/ai-services/openai",
		APIKeyLabel: "Azure API Key", Category: "platform",
		Features: []string{"streaming", "tools", "vision"},
		Note: "须替换 {resource} 和 {deployment}；需要额外填写 apiVersion",
	},
	{
		ID: "vertexai", Name: "Google Vertex AI", Kind: KindChatCompletion,
		BaseURL: "https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:streamGenerateContent",
		DocsURL: "https://cloud.google.com/vertex-ai", APIKeyLabel: "Vertex AI Key",
		Category: "platform", Features: []string{"streaming", "tools", "vision"},
		Note: "Vertex AI 使用独立鉴权方式，建议使用 Native 通道",
	},
	{
		ID: "bedrock", Name: "AWS Bedrock", Kind: KindChatCompletion,
		BaseURL: "",
		DefaultModel: "anthropic.claude-sonnet-4-20250514-v1:0",
		DocsURL: "https://aws.amazon.com/bedrock", APIKeyLabel: "AWS Credentials",
		Category: "platform", Features: []string{"streaming", "tools", "vision"},
		Note: "须配置 AWS Access Key + Secret Key + Region",
	},

	// ─── 本地/自托管 ───
	{
		ID: "ollama", Name: "Ollama", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:11434/v1", DefaultModel: "llama3.2",
		ModelsEndpoint: "/models", DocsURL: "https://ollama.com",
		APIKeyLabel: "Ollama API Key (留空，默认无认证)", Category: "local",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "vllm", Name: "vLLM", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:8000/v1", DefaultModel: "",
		ModelsEndpoint: "/models", DocsURL: "https://docs.vllm.ai",
		APIKeyLabel: "vLLM API Key (留空)", Category: "local",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "lmstudio", Name: "LM Studio", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:1234/v1", DefaultModel: "local-model",
		ModelsEndpoint: "/models", DocsURL: "https://lmstudio.ai",
		APIKeyLabel: "LM Studio Key (留空)", Category: "local",
		Features: []string{"streaming"},
	},
	{
		ID: "tabbyapi", Name: "TabbyAPI", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:5000/v1", DefaultModel: "",
		ModelsEndpoint: "/models", DocsURL: "https://github.com/theroyallab/tabbyAPI",
		APIKeyLabel: "Tabby API Key (留空)", Category: "local",
		Features: []string{"streaming"},
	},
	{
		ID: "ooba", Name: "Oobabooga (Text Gen WebUI)", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:5000/v1", DefaultModel: "",
		ModelsEndpoint: "/models", DocsURL: "https://github.com/oobabooga/text-generation-webui",
		APIKeyLabel: "Oobabooga Key (留空)", Category: "local",
		Features: []string{"streaming"},
	},
	{
		ID: "llamacpp", Name: "llama.cpp Server", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:8080/v1", DefaultModel: "",
		ModelsEndpoint: "/models", DocsURL: "https://github.com/ggerganov/llama.cpp",
		APIKeyLabel: "llama.cpp Key (留空)", Category: "local",
		Features: []string{"streaming"},
	},
	{
		ID: "litellm", Name: "LiteLLM Proxy", Kind: KindChatCompletion,
		BaseURL: "http://127.0.0.1:4000/v1", DefaultModel: "",
		ModelsEndpoint: "/models", DocsURL: "https://docs.litellm.ai",
		APIKeyLabel: "LiteLLM Key", Category: "local",
		Features: []string{"streaming", "tools"},
	},
	{
		ID: "generic", Name: "Generic OpenAI Compatible", Kind: KindChatCompletion,
		BaseURL: "", DefaultModel: "",
		DocsURL: "", APIKeyLabel: "API Key",
		Category: "local", Features: []string{"streaming"},
		Note: "通用 OpenAI 兼容端点。填写任何兼容 /v1/chat/completions 的地址即可。",
	},
}

// ─── Native API Providers (非 OpenAI 协议) ───

var nativeProviders = []ProviderPreset{
	{
		ID: "claude", Name: "Anthropic Claude", Kind: KindNative,
		BaseURL: "https://api.anthropic.com/v1/messages",
		DefaultModel: "claude-sonnet-4-20250514",
		DocsURL: "https://docs.anthropic.com", APIKeyLabel: "Anthropic API Key",
		Category: "cloud",
		Features: []string{"streaming", "tools", "vision", "reasoning"},
		Note: "使用 Anthropic Messages API 原生协议",
	},
	{
		ID: "sambanova", Name: "SambaNova", Kind: KindNative,
		BaseURL: "https://api.sambanova.ai/v1", DefaultModel: "Meta-Llama-3.3-70B-Instruct",
		DocsURL: "https://cloud.sambanova.ai", APIKeyLabel: "SambaNova API Key",
		Category: "cloud", Features: []string{"streaming", "tools"},
	},
}

// ─── Text Completion Providers ───

var textProviders = []ProviderPreset{
	{
		ID: "novelai", Name: "NovelAI", Kind: KindTextCompletion,
		BaseURL: "https://api.novelai.net", DefaultModel: "kayra-v1",
		DocsURL: "https://novelai.net", APIKeyLabel: "NovelAI API Key",
		Category: "cloud", Features: []string{"streaming"},
		Note: "NovelAI 使用独立的文本生成协议",
	},
	{
		ID: "koboldcpp", Name: "KoboldCpp", Kind: KindTextCompletion,
		BaseURL: "http://127.0.0.1:5001/api", DefaultModel: "",
		DocsURL: "https://github.com/LostRuins/koboldcpp", APIKeyLabel: "Kobold Key (留空)",
		Category: "local", Features: []string{"streaming"},
	},
	{
		ID: "aphrodite", Name: "Aphrodite Engine", Kind: KindTextCompletion,
		BaseURL: "http://127.0.0.1:2242/api", DefaultModel: "",
		DocsURL: "https://github.com/PygmalionAI/aphrodite-engine",
		APIKeyLabel: "Aphrodite Key (留空)", Category: "local",
		Features: []string{"streaming"},
	},
	{
		ID: "horde", Name: "AI Horde", Kind: KindTextCompletion,
		BaseURL: "https://horde.koboldai.net/api", DefaultModel: "",
		DocsURL: "https://horde.koboldai.net", APIKeyLabel: "Horde API Key (0000000000=匿名)",
		Category: "aggregator", Features: []string{"streaming"},
	},
}
