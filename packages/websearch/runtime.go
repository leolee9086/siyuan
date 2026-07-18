package websearch

import (
	"fmt"
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
	TimeoutMs      int
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
	LinkMap     map[string]string  `json:"linkMap,omitempty"`
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
		text, err := CallExa(query, opts.SearchType, opts.NumResults, livecrawlValue(opts.Livecrawl), nil, s.config.ExaAPIKey, s.config.Proxy)
		return SearchResponse{Query: query, Provider: ProviderExa, Text: text}, err
	}
	if provider == ProviderParallel && strings.TrimSpace(s.config.ParallelAPIKey) != "" {
		text, err := CallParallel(query, "", "", s.config.ParallelAPIKey, s.config.Proxy)
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

const (
	diagnosticProbeConcurrency = 20
	diagnosticProbeTimeout     = 5 * time.Second
)

type DiagnosticProgress struct {
	Done       int
	Total      int
	Current    string
	Diagnostic EngineDiagnostic
}

type DiagnosticProgressCallback func(progress DiagnosticProgress)

func (s *Service) Diagnose(names []string, probe bool, query string) []EngineDiagnostic {
	return s.DiagnoseWithProgress(names, probe, query, nil)
}

// DiagnoseWithProgress keeps the final result stable while probing engines with
// bounded concurrency. Each probe also has a hard timeout so a broken adapter
// cannot block the entire diagnostic run.
func (s *Service) DiagnoseWithProgress(names []string, probe bool, query string, onProgress DiagnosticProgressCallback) []EngineDiagnostic {
	if len(names) == 0 {
		names = GlobalEngineRegistry.List()
	} else {
		names = append([]string(nil), names...)
	}
	sort.Strings(names)
	query = strings.TrimSpace(query)
	if query == "" {
		query = "test search"
	}

	total := len(names)
	if onProgress != nil {
		onProgress(DiagnosticProgress{Total: total})
	}
	if total == 0 {
		return nil
	}

	result := make([]EngineDiagnostic, total)
	if !probe {
		for index, name := range names {
			diagnostic := s.diagnoseEngine(name, false, query)
			result[index] = diagnostic
			if onProgress != nil {
				onProgress(DiagnosticProgress{Done: index + 1, Total: total, Current: name, Diagnostic: diagnostic})
			}
		}
		return result
	}

	type diagnosticOutcome struct {
		index      int
		diagnostic EngineDiagnostic
	}
	jobs := make(chan int, total)
	outcomes := make(chan diagnosticOutcome, total)
	for index := range names {
		jobs <- index
	}
	close(jobs)

	workerCount := diagnosticProbeConcurrency
	if total < workerCount {
		workerCount = total
	}
	for worker := 0; worker < workerCount; worker++ {
		go func() {
			for index := range jobs {
				outcomes <- diagnosticOutcome{index: index, diagnostic: s.diagnoseEngine(names[index], true, query)}
			}
		}()
	}

	for done := 1; done <= total; done++ {
		outcome := <-outcomes
		result[outcome.index] = outcome.diagnostic
		if onProgress != nil {
			onProgress(DiagnosticProgress{
				Done: done, Total: total, Current: outcome.diagnostic.Name, Diagnostic: outcome.diagnostic,
			})
		}
	}
	return result
}

func (s *Service) diagnoseEngine(name string, probe bool, query string) EngineDiagnostic {
	factory, ok := GlobalEngineRegistry.Get(name)
	if !ok {
		return EngineDiagnostic{Name: name, Status: "not_registered"}
	}
	base := factory(DefaultEngineConfig(name)).Config()
	cfg := s.engineConfig(name, base)
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

	GlobalExecutorState.mu.RLock()
	if status, ok := GlobalExecutorState.EngineStatuses[name]; ok {
		diagnostic.LastError = status.LastError
		diagnostic.TotalRequests = status.Metrics.TotalRequests
		diagnostic.SuccessfulRequests = status.Metrics.SuccessfulRequests
		diagnostic.AvgLatencyMs = status.Metrics.AvgLatency
		if status.Suspended {
			diagnostic.Status = "suspended"
		}
	}
	GlobalExecutorState.mu.RUnlock()

	if !probe || !diagnostic.Enabled || diagnostic.Status == "requires_credentials" {
		return diagnostic
	}
	if cfg.Timeout <= 0 || time.Duration(cfg.Timeout)*time.Millisecond > diagnosticProbeTimeout {
		cfg.Timeout = int(diagnosticProbeTimeout / time.Millisecond)
	}
	engine := factory(cfg)
	started := time.Now()
	resultCh := make(chan searchResultOrError, 1)
	go func() {
		probed, err := engine.Search(query, SearchOptions{NumResults: 1}, nil)
		resultCh <- searchResultOrError{results: probed, err: err}
	}()

	var probed []SearchResult
	var err error
	timer := time.NewTimer(time.Duration(cfg.Timeout) * time.Millisecond)
	select {
	case outcome := <-resultCh:
		timer.Stop()
		probed, err = outcome.results, outcome.err
	case <-timer.C:
		err = &TimeoutError{Engine: name, Message: fmt.Sprintf("diagnostic probe timed out after %dms", cfg.Timeout)}
	}
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
	return diagnostic
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
			name = strings.TrimSpace(name)
			if factory, ok := GlobalEngineRegistry.Get(name); ok {
				selected = append(selected, factory(DefaultEngineConfig(name)))
			} else if name != "" {
				selected = append(selected, diagnosticSearchEngine{name: name})
			}
		}
	}
	engines := make([]SearchEngine, 0, len(selected))
	diagnostics := make([]EngineDiagnostic, 0)
	for _, selectedEngine := range selected {
		name := selectedEngine.Name()
		if _, registered := GlobalEngineRegistry.Get(name); !registered {
			diagnostics = append(diagnostics, EngineDiagnostic{Name: name, Status: "not_registered"})
			continue
		}
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

type diagnosticSearchEngine struct {
	name string
}

func (e diagnosticSearchEngine) Name() string { return e.name }

func (e diagnosticSearchEngine) Config() EngineConfig {
	return DefaultEngineConfig(e.name)
}

func (e diagnosticSearchEngine) Search(string, SearchOptions, map[string]string) ([]SearchResult, error) {
	return nil, fmt.Errorf("engine %s is not registered", e.name)
}

func (s *Service) engineConfig(name string, base EngineConfig) EngineConfig {
	base.Proxy = s.config.Proxy
	if s.config.TimeoutMs > 0 {
		base.Timeout = s.config.TimeoutMs
	}
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
