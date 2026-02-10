package conf

import (
	"os"
	"strconv"
)

// AgentConfig holds configuration for the AI Agent (Ghost).
type AgentConfig struct {
	Enabled       bool   `json:"enabled"`
	SoulDocID     string `json:"soulDocID"`     // The Siyuan Document ID defining the Persona
	ModelProvider string `json:"modelProvider"` // e.g. "openai", "anthropic"
	ModelName     string `json:"modelName"`     // e.g. "gpt-4-turbo"
	APIKey        string `json:"apiKey"`
	BaseURL       string `json:"baseURL"`
	MaxTokens     int    `json:"maxTokens"`
}

func NewAgentConfig() *AgentConfig {
	cfg := &AgentConfig{
		Enabled:       false,
		SoulDocID:     "", // ID must be set by user or env
		ModelProvider: "openai",
		ModelName:     "gpt-3.5-turbo",
		BaseURL:       "https://api.openai.com/v1",
		MaxTokens:     2048,
	}

	if enabled := os.Getenv("SIYUAN_AGENT_ENABLED"); enabled == "true" {
		cfg.Enabled = true
	}

	if soulID := os.Getenv("SIYUAN_AGENT_SOUL_ID"); soulID != "" {
		cfg.SoulDocID = soulID
	}

	if apiKey := os.Getenv("SIYUAN_AGENT_API_KEY"); apiKey != "" {
		cfg.APIKey = apiKey
	}

	if baseURL := os.Getenv("SIYUAN_AGENT_BASE_URL"); baseURL != "" {
		cfg.BaseURL = baseURL
	}

	if model := os.Getenv("SIYUAN_AGENT_MODEL"); model != "" {
		cfg.ModelName = model
	}

	if maxTokens := os.Getenv("SIYUAN_AGENT_MAX_TOKENS"); maxTokens != "" {
		if val, err := strconv.Atoi(maxTokens); err == nil {
			cfg.MaxTokens = val
		}
	}

	return cfg
}
