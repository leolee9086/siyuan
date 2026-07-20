package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	kernelwebsearch "github.com/siyuan-note/siyuan/kernel/websearch"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

type searchWebToolArgs struct {
	Query      string   `json:"query"`
	NumResults int      `json:"numResults,omitempty"`
	QueryType  string   `json:"queryType,omitempty"`
	TimeRange  string   `json:"timeRange,omitempty"`
	Lang       string   `json:"lang,omitempty"`
	Provider   string   `json:"provider,omitempty"`
	SearchType string   `json:"searchType,omitempty"`
	Livecrawl  bool     `json:"livecrawl,omitempty"`
	Engines    []string `json:"engines,omitempty"`
}

type inspectWebSearchEnginesToolArgs struct {
	Probe   bool     `json:"probe,omitempty"`
	Query   string   `json:"query,omitempty"`
	Engines []string `json:"engines,omitempty"`
}

type webSearchToolResultExecutor struct{}

func newWebSearchToolResultExecutor() *webSearchToolResultExecutor {
	return &webSearchToolResultExecutor{}
}

func (e *webSearchToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	switch strings.TrimSpace(toolCall.Function.Name) {
	case config.SearchWebToolName:
		return e.executeSearch(toolCall)
	case config.InspectWebSearchEnginesToolName:
		return e.executeInspect(toolCall)
	default:
		return "", false, nil
	}
}

func (e *webSearchToolResultExecutor) executeSearch(toolCall types.ToolCall) (string, bool, error) {
	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.SearchWebToolName)
	}
	var args searchWebToolArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.SearchWebToolName, err)
	}
	if _, err := requireExplicitToolPurpose(rawArgs, config.SearchWebToolName); err != nil {
		return "", true, err
	}
	args.Query = strings.TrimSpace(args.Query)
	if args.Query == "" {
		return "", true, fmt.Errorf("%s 的 query 不能为空", config.SearchWebToolName)
	}

	opts := shared.DefaultSearchOptions()
	opts.NumResults = args.NumResults
	opts.QueryType = strings.TrimSpace(args.QueryType)
	opts.TimeRange = strings.TrimSpace(args.TimeRange)
	opts.Lang = strings.TrimSpace(args.Lang)
	opts.Provider = shared.WebSearchProvider(strings.TrimSpace(args.Provider))
	opts.SearchType = strings.TrimSpace(args.SearchType)
	opts.Livecrawl = args.Livecrawl
	opts.Engines = cleanWebSearchEngineNames(args.Engines)

	response, searchErr := kernelwebsearch.NewService().Search(args.Query, opts, nil)
	if searchErr != nil {
		return "", true, searchErr
	}
	// Keep real source targets in the archived/display payload, while giving the
	// model only opaque references that it can quote without inventing URLs.
	shared.ProtectSearchResponse(&response)
	data, marshalErr := json.Marshal(response)
	if marshalErr != nil {
		return "", true, fmt.Errorf("%s 结果序列化失败: %w", config.SearchWebToolName, marshalErr)
	}
	return string(data), true, nil
}

func (e *webSearchToolResultExecutor) executeInspect(toolCall types.ToolCall) (string, bool, error) {
	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if _, err := requireExplicitToolPurpose(rawArgs, config.InspectWebSearchEnginesToolName); err != nil {
		return "", true, err
	}
	var args inspectWebSearchEnginesToolArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.InspectWebSearchEnginesToolName, err)
	}
	status := kernelwebsearch.NewService().Diagnose(
		cleanWebSearchEngineNames(args.Engines),
		args.Probe,
		strings.TrimSpace(args.Query),
	)
	data, marshalErr := json.Marshal(status)
	if marshalErr != nil {
		return "", true, fmt.Errorf("%s 结果序列化失败: %w", config.InspectWebSearchEnginesToolName, marshalErr)
	}
	return string(data), true, nil
}

func cleanWebSearchEngineNames(names []string) []string {
	if len(names) == 0 {
		return nil
	}
	cleaned := make([]string, 0, len(names))
	seen := make(map[string]struct{}, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		cleaned = append(cleaned, name)
	}
	return cleaned
}
