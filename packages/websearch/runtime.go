package websearch

import (
	"sort"
	"strings"
	"time"
)

// EngineRuntimeConfig contains user-owned runtime settings for one engine.
type EngineRuntimeConfig struct {
	Enabled    bool
	APIKey     string
	BaseURL    string
	TimeoutMs  int
	MaxResults int
	Weight     float64
	Priority   int
	Headers    map[string]string
}

// RuntimeConfig is the configuration boundary between kernel and websearch.
type RuntimeConfig struct {
	Enabled        bool
	Provider       WebSearchProvider
	ExaAPIKey      string
	ParallelAPIKey string
	Proxy          ProxyConfig
	DefaultOptions SearchOptions
	Engines        map[string]EngineRuntimeConfig
}

// SearchResponse is the structured result consumed by native Agent and MAGI.
type SearchResponse struct {
	Query       string             `json:"query"`
	Provider    WebSearchProvider  `json:"provider"`
	Results     []AggregatedResult `json:"results,omitempty"`
	Text        string             `json:"text,omitempty"`
	UsedEngines []string           `json:"usedEngines,omitempty"`
	Errors      []EngineError      `json:"errors,omitempty"`
	Diagnostics []EngineDiagnostic `json:"diagnostics,omitempty"`
	NoResults   bool               `json:"noResults,omitempty"`
}

// EngineDiagnostic is safe to expose to an agent; it never contains secrets.
type EngineDiagnostic struct {
	Name               string  `json:"name"`
	Category           string  `json:"category,omitempty"`
	Enabled            bool    `json:"enabled"`
	RequiresKey        bool    `json:"requiresCredentials"`
	CredentialsReady   bool    `json:"credentialsReady"`
	Status             string  `json:"status"`
	LastError          string  `json:"lastError,omitempty"`
	TotalRequests      int     `json:"totalRequests"`
	SuccessfulRequests int     `json:"successfulRequests"`
	AvgLatencyMs       float64 `json:"avgLatencyMs"`
	ProbeResults       int     `json:"probeResults,omitempty"`
	ProbeDurationMs    int64   `json:"probeDurationMs,omitempty"`
}

// Service owns a snapshot of runtime configuration and is safe to create per
// request. Engine health remains in the package-level executor state.
type Service struct {
	config RuntimeConfig
}

func NewService(config RuntimeConfig) *Service {
	if config.Provider == "" {
		config.Provider = ProviderAuto
	}
	if config.DefaultOptions.NumResults <= 0 {
		config.DefaultOptions = DefaultSearchOptions()
	}
	if config.DefaultOptions.Provider == "" {
		config.DefaultOptions.Provider = config.Provider
	}
	if config.Engines == nil {
		config.Engines = map[string]EngineRuntimeConfig{}
	}
	return &Service{config: config}
}

func (s *Service) Search(query string, opts SearchOptions, onProgress ProgressCallback) (SearchResponse, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return SearchResponse{}, &ProtocolError{Engine: "websearch", Message: "query is empty"}
	}
	opts = mergeSearchOptions(s.config.DefaultOptions, opts)
	provider := opts.Provider
	if provider == "" {
		provider = s.config.Provider
	}
	if provider == "" {
		provider = ProviderAuto
	}
	if provider == ProviderAuto {
		switch {
		case strings.TrimSpace(s.config.ParallelAPIKey) != "":
			provider = ProviderParallel
		case strings.TrimSpace(s.config.ExaAPIKey) != "":
			provider = ProviderExa
		default:
			provider = ProviderMeta
		}
	}
	if !s.config.Enabled {
		return SearchResponse{Query: query, Provider: provider, Diagnostics: []EngineDiagnostic{{Name: "websearch", Status: "disabled"}}, NoResults: true}, nil
	}

	if provider == ProviderExa && strings.TrimSpace(s.config.ExaAPIKey) != "" {
		text, err := CallExa(query, opts.SearchType, opts.NumResults, livecrawlValue(opts.Livecrawl), nil, s.config.ExaAPIKey)
		return SearchResponse{Query: query, Provider: ProviderExa, Text: text}, err
	}
	if provider == ProviderParallel && strings.TrimSpace(s.config.ParallelAPIKey) != "" {
		text, err := CallParallel(query, "", "", s.config.ParallelAPIKey)
		return SearchResponse{Query: query, Provider: ProviderParallel, Text: text}, err
	}
	if provider == ProviderExa || provider == ProviderParallel {
		return SearchResponse{Query: query, Provider: provider, Diagnostics: []EngineDiagnostic{{Name: string(provider), Status: "requires_credentials"}}}, nil
	}

	engines, diagnostics := s.selectEngines(opts)
	if len(engines) == 0 {
		return SearchResponse{Query: query, Provider: ProviderMeta, Diagnostics: diagnostics, NoResults: true}, nil
	}
	result := ExecuteAll(engines, query, opts, GlobalExecutorState, onProgress)
	response := SearchResponse{Query: query, Provider: ProviderMeta, Diagnostics: diagnostics}
	response.Errors = result.Errors
	weights := make(map[string]float64, len(engines))
	for _, engine := range engines {
		response.UsedEngines = append(response.UsedEngines, engine.Name())
		weights[engine.Name()] = engine.Config().Weight
	}
	if len(result.Results) == 0 {
		response.NoResults = true
		return response, nil
	}
	response.Results = Aggregate(result.Results, &AggregateContext{Weights: weights, MaxResults: opts.NumResults}, query)
	response.Text = FormatResults(response.Results, query, "")
	return response, nil
}

func (s *Service) Diagnose(names []string, probe bool, query string) []EngineDiagnostic {
	if len(names) == 0 {
		names = GlobalEngineRegistry.List()
	}
	sort.Strings(names)
	if query == "" {
		query = "test search"
	}
	result := make([]EngineDiagnostic, 0, len(names))
	for _, name := range names {
		factory, ok := GlobalEngineRegistry.Get(name)
		if !ok {
			result = append(result, EngineDiagnostic{Name: name, Status: "not_registered"})
			continue
		}
		cfg := s.engineConfig(name, DefaultEngineConfig(name))
		engine := factory(cfg)
		diagnostic := EngineDiagnostic{
			Name: name, Category: cfg.Category, Enabled: true,
			RequiresKey: cfg.RequiresKey, CredentialsReady: !cfg.RequiresKey || strings.TrimSpace(cfg.APIKey) != "",
			Status: "ready",
		}
		if runtime, configured := s.config.Engines[name]; configured && !runtime.Enabled {
			diagnostic.Enabled = false
			diagnostic.Status = "disabled"
		}
		if diagnostic.RequiresKey && !diagnostic.CredentialsReady {
			diagnostic.Status = "requires_credentials"
		}
		if status, ok := GlobalExecutorState.EngineStatuses[name]; ok {
			diagnostic.LastError = status.LastError
			diagnostic.TotalRequests = status.Metrics.TotalRequests
			diagnostic.SuccessfulRequests = status.Metrics.SuccessfulRequests
			diagnostic.AvgLatencyMs = status.Metrics.AvgLatency
			if status.Suspended {
				diagnostic.Status = "suspended"
			}
		}
		if probe && diagnostic.Enabled && diagnostic.Status != "requires_credentials" {
			started := time.Now()
			probed, err := engine.Search(query, SearchOptions{NumResults: 1}, nil)
			diagnostic.ProbeDurationMs = time.Since(started).Milliseconds()
			diagnostic.ProbeResults = len(probed)
			if err != nil {
				diagnostic.Status = "probe_failed"
				diagnostic.LastError = err.Error()
			} else if len(probed) == 0 {
				diagnostic.Status = "empty_results"
			} else {
				diagnostic.Status = "ready"
			}
		}
		result = append(result, diagnostic)
	}
	return result
}

func (s *Service) selectEngines(opts SearchOptions) ([]SearchEngine, []EngineDiagnostic) {
	flags := &SelectFlags{QueryType: opts.QueryType, TimeRange: opts.TimeRange, Lang: opts.Lang}
	if len(opts.Engines) > 0 {
		flags = nil
	}
	selected := SelectEngines(flags)
	if len(opts.Engines) > 0 {
		selected = selected[:0]
		for _, name := range opts.Engines {
			if factory, ok := GlobalEngineRegistry.Get(strings.TrimSpace(name)); ok {
				selected = append(selected, factory(DefaultEngineConfig(strings.TrimSpace(name))))
			}
		}
	}
	engines := make([]SearchEngine, 0, len(selected))
	diagnostics := make([]EngineDiagnostic, 0)
	for _, selectedEngine := range selected {
		name := selectedEngine.Name()
		runtime, configured := s.config.Engines[name]
		if configured && !runtime.Enabled {
			diagnostics = append(diagnostics, EngineDiagnostic{Name: name, Status: "disabled", Enabled: false})
			continue
		}
		factory, ok := GlobalEngineRegistry.Get(name)
		if !ok {
			continue
		}
		cfg := s.engineConfig(name, selectedEngine.Config())
		if cfg.RequiresKey && strings.TrimSpace(cfg.APIKey) == "" {
			diagnostics = append(diagnostics, EngineDiagnostic{Name: name, Category: cfg.Category, RequiresKey: true, Status: "requires_credentials"})
			continue
		}
		engines = append(engines, factory(cfg))
	}
	return engines, diagnostics
}

func (s *Service) engineConfig(name string, base EngineConfig) EngineConfig {
	runtime, ok := s.config.Engines[name]
	if !ok {
		return base
	}
	if runtime.TimeoutMs > 0 {
		base.Timeout = runtime.TimeoutMs
	}
	if runtime.MaxResults > 0 {
		base.MaxResults = runtime.MaxResults
	}
	if runtime.Weight != 0 {
		base.Weight = runtime.Weight
	}
	if runtime.Priority != 0 {
		base.Priority = runtime.Priority
	}
	base.APIKey = runtime.APIKey
	base.BaseURL = runtime.BaseURL
	base.Headers = runtime.Headers
	base.Proxy = s.config.Proxy
	return base
}

func mergeSearchOptions(defaults, opts SearchOptions) SearchOptions {
	if opts.NumResults <= 0 {
		opts.NumResults = defaults.NumResults
	}
	if opts.NumResults <= 0 {
		opts.NumResults = 8
	}
	if opts.SafeSearch == 0 {
		opts.SafeSearch = defaults.SafeSearch
	}
	if opts.Lang == "" {
		opts.Lang = defaults.Lang
	}
	if opts.Provider == "" {
		opts.Provider = defaults.Provider
	}
	if opts.SearchType == "" {
		opts.SearchType = defaults.SearchType
	}
	return opts
}

func livecrawlValue(enabled bool) string {
	if enabled {
		return "preferred"
	}
	return "fallback"
}
