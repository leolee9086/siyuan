// Package websearch adapts the shared websearch module to SiYuan runtime
// configuration. Native Agent and MAGI intentionally call this adapter from
// their own tool executors, preserving their separate governance models.
package websearch

import (
	"strings"

	"github.com/siyuan-note/siyuan/kernel/model"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

func NewService() *shared.Service {
	return shared.NewService(RuntimeConfig())
}

func RuntimeConfig() shared.RuntimeConfig {
	config := shared.RuntimeConfig{
		Enabled:        true,
		Provider:       shared.ProviderAuto,
		DefaultOptions: shared.DefaultSearchOptions(),
		Engines:        map[string]shared.EngineRuntimeConfig{},
	}
	if model.Conf == nil || model.Conf.AI == nil {
		return config
	}
	settings := model.Conf.AI.WebSearch
	if settings == nil {
		return config
	}
	config.Enabled = settings.Enabled
	config.Provider = shared.WebSearchProvider(strings.TrimSpace(settings.Provider))
	config.TimeoutMs = settings.TimeoutMs
	config.ExaAPIKey = settings.ExaAPIKey
	config.ParallelAPIKey = settings.ParallelAPIKey
	config.DefaultOptions.NumResults = settings.MaxResults
	config.DefaultOptions.Lang = settings.Lang
	config.DefaultOptions.QueryType = settings.QueryType
	config.DefaultOptions.Provider = config.Provider
	config.Proxy = shared.NewExplicitProxy(settings.Proxy, settings.Proxy)
	for name, engine := range settings.Engines {
		if engine == nil {
			continue
		}
		config.Engines[name] = shared.EngineRuntimeConfig{
			Enabled:    engine.Enabled,
			APIKey:     engine.APIKey,
			BaseURL:    engine.BaseURL,
			TimeoutMs:  engine.TimeoutMs,
			MaxResults: engine.MaxResults,
			Weight:     engine.Weight,
			Priority:   engine.Priority,
			Headers:    cloneHeaders(engine.Headers),
		}
	}
	return config
}

func cloneHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	result := make(map[string]string, len(headers))
	for key, value := range headers {
		result[key] = value
	}
	return result
}
