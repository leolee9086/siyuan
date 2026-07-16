// Command enginecompare runs a selected engine set against s-code and Go.
// It is intentionally opt-in so a single problematic adapter can be iterated
// without waiting for the full registry.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	websearch "github.com/siyuan-note/siyuan/packages/websearch"
)

type engineProbe struct {
	Engine     string `json:"engine"`
	Status     string `json:"status"`
	Results    int    `json:"results"`
	DurationMS int64  `json:"durationMs"`
	Error      string `json:"error,omitempty"`
}

type comparison struct {
	Engine string      `json:"engine"`
	SCode  engineProbe `json:"sCode"`
	Go     engineProbe `json:"go"`
	Match  bool        `json:"match"`
}

type sCodeReport struct {
	Engines []engineProbe `json:"engines"`
}

func main() {
	var (
		engineFlag = flag.String("engines", "", "comma-separated engine names")
		query      = flag.String("query", "test search", "query sent to both implementations")
		proxy      = flag.String("proxy", "", "caller-provided HTTP/HTTPS proxy URL")
		noProxy    = flag.String("no-proxy", "", "comma-separated hosts that bypass the proxy")
		scodeRoot  = flag.String("scode-root", "", "s-code repository root")
		bun        = flag.String("bun", "bun", "Bun executable")
		timeout    = flag.Duration("timeout", 30*time.Second, "per-engine timeout")
		maxResults = flag.Int("num-results", 3, "maximum results per engine")
		keysJSON   = flag.String("keys-json", "{}", "JSON object mapping engine names to API keys")
		failDiff   = flag.Bool("fail-on-difference", false, "exit with status 1 when any engine differs")
	)
	flag.Parse()

	names := splitNames(*engineFlag)
	if len(names) == 0 {
		fatalf("-engines must contain at least one engine name")
	}
	if *timeout <= 0 || *maxResults <= 0 {
		fatalf("-timeout and -num-results must be positive")
	}
	keys := make(map[string]string)
	if err := json.Unmarshal([]byte(*keysJSON), &keys); err != nil {
		fatalf("invalid -keys-json: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(len(names)+1)*(*timeout+30*time.Second))
	defer cancel()

	sCode, err := runSCode(ctx, *bun, *scodeRoot, names, *query, *proxy, *noProxy, *timeout, *maxResults)
	if err != nil {
		fatalf("s-code probe failed: %v", err)
	}

	goResults := make(map[string]engineProbe, len(names))
	for _, name := range names {
		goResults[name] = probeGo(name, *query, *proxy, *noProxy, *timeout, *maxResults, keys[name])
	}

	report := make([]comparison, 0, len(names))
	for _, name := range names {
		sCodeProbe := sCode[name]
		if sCodeProbe.Engine == "" {
			sCodeProbe = engineProbe{Engine: name, Status: "not_selected"}
		}
		goProbe := goResults[name]
		report = append(report, comparison{
			Engine: name,
			SCode:  sCodeProbe,
			Go:     goProbe,
			Match:  sCodeProbe.Status == goProbe.Status,
		})
	}

	output := struct {
		Query       string       `json:"query"`
		Proxy       string       `json:"proxy,omitempty"`
		Engines     []comparison `json:"engines"`
		Differences int          `json:"differences"`
	}{Query: *query, Proxy: *proxy, Engines: report}
	for _, item := range report {
		if !item.Match {
			output.Differences++
		}
	}
	encoded, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		fatalf("encode report: %v", err)
	}
	fmt.Println(string(encoded))
	if *failDiff && output.Differences > 0 {
		os.Exit(1)
	}
}

func splitNames(raw string) []string {
	seen := make(map[string]struct{})
	var names []string
	for _, item := range strings.Split(raw, ",") {
		name := strings.TrimSpace(item)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func probeGo(name, query, proxyURL, noProxy string, timeout time.Duration, maxResults int, apiKey string) engineProbe {
	probe := engineProbe{Engine: name}
	factory, ok := websearch.GlobalEngineRegistry.Get(name)
	if !ok {
		probe.Status = "not_registered"
		probe.Error = "engine is not registered"
		return probe
	}
	config := websearch.DefaultEngineConfig(name)
	config.Timeout = int(timeout / time.Millisecond)
	config.MaxResults = maxResults
	config.APIKey = apiKey
	config.Proxy = websearch.NewExplicitProxy(proxyURL, proxyURL)
	config.Proxy.NoProxy = noProxy
	engine := factory(config)
	if engine.Config().RequiresKey && strings.TrimSpace(engine.Config().APIKey) == "" {
		probe.Status = "requires_credentials"
		probe.Error = "requires_credentials"
		return probe
	}

	started := time.Now()
	resultCh := make(chan struct {
		results []websearch.SearchResult
		err     error
	}, 1)
	go func() {
		results, err := engine.Search(query, websearch.SearchOptions{NumResults: maxResults}, nil)
		resultCh <- struct {
			results []websearch.SearchResult
			err     error
		}{results: results, err: err}
	}()
	select {
	case result := <-resultCh:
		probe.DurationMS = time.Since(started).Milliseconds()
		if result.err != nil {
			probe.Status = "error"
			probe.Error = result.err.Error()
			return probe
		}
		probe.Results = len(result.results)
		if len(result.results) == 0 {
			probe.Status = "zero_results"
		} else {
			probe.Status = "success"
		}
		return probe
	case <-time.After(timeout + 2*time.Second):
		probe.DurationMS = time.Since(started).Milliseconds()
		probe.Status = "error"
		probe.Error = "probe exceeded hard timeout"
		return probe
	}
}

func runSCode(ctx context.Context, bun, root string, names []string, query, proxyURL, noProxy string, timeout time.Duration, maxResults int) (map[string]engineProbe, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("-scode-root is required")
	}
	root, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	opencodeRoot := filepath.Join(root, "packages", "opencode")
	if stat, statErr := os.Stat(opencodeRoot); statErr != nil || !stat.IsDir() {
		return nil, fmt.Errorf("invalid s-code root: %s", root)
	}

	script := `import { Effect } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"
import { Selector } from "./src/search/selector.ts"
import { Proxy } from "./src/search/proxy.ts"

const names = new Set((process.env.WEBSEARCH_COMPARE_ENGINES ?? "").split(",").filter(Boolean))
const selected = Selector.selectEngines().filter((engine) => names.has(engine.name))
const started = Date.now()
const outcome = await Effect.runPromise(
  Effect.gen(function* () {
		 yield* Proxy.configureProxy()
    const http = yield* HttpClient.HttpClient
    const engine = selected[0]
    if (!engine) return { engine: [...names][0], status: "not_selected", results: 0 }
    return yield* engine.search(
      http,
      process.env.WEBSEARCH_COMPARE_QUERY ?? "test search",
      { numResults: Number(process.env.WEBSEARCH_COMPARE_NUM_RESULTS ?? "3") },
    ).pipe(
      Effect.timeout(engine.config.timeout),
      Effect.map((results) => ({ engine: engine.name, status: results.length > 0 ? "success" : "zero_results", results: results.length })),
      Effect.catch((error) => Effect.succeed({ engine: engine.name, status: "error", results: 0, error: String(error) })),
    )
  }).pipe(Effect.provide(FetchHttpClient.layer)),
)
const rows = new Map([...names].map((name) => [name, { engine: name, status: "not_selected", results: 0 }]))
rows.set(outcome.engine, { ...outcome, durationMs: Date.now() - started })
process.stdout.write(JSON.stringify({ engines: [...rows.values()] }))
`

	temp, err := os.CreateTemp(opencodeRoot, "websearch-compare-*.ts")
	if err != nil {
		return nil, err
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if _, err := temp.WriteString(script); err != nil {
		_ = temp.Close()
		return nil, err
	}
	if err := temp.Close(); err != nil {
		return nil, err
	}

	report := make(map[string]engineProbe, len(names))
	for _, name := range names {
		probe := engineProbe{Engine: name, Status: "error"}
		engineCtx, cancel := context.WithTimeout(ctx, timeout+25*time.Second)
		output, runErr := runSCodeProcess(engineCtx, bun, opencodeRoot, tempPath, name, query, proxyURL, noProxy, maxResults)
		cancel()
		if runErr != nil {
			probe.Error = runErr.Error()
			report[name] = probe
			continue
		}
		var decoded sCodeReport
		if decodeErr := json.Unmarshal(output, &decoded); decodeErr != nil {
			probe.Error = fmt.Sprintf("decode s-code output: %v: %s", decodeErr, strings.TrimSpace(string(output)))
			report[name] = probe
			continue
		}
		for _, item := range decoded.Engines {
			if item.Engine == name {
				report[name] = item
			}
		}
		if report[name].Engine == "" {
			probe.Status = "not_selected"
			report[name] = probe
		}
	}
	return report, nil
}

func runSCodeProcess(ctx context.Context, bun, dir, script, name, query, proxyURL, noProxy string, maxResults int) ([]byte, error) {
	command := exec.Command(bun, "run", script)
	command.Dir = dir
	command.Env = append(proxyEnvironment(proxyURL, noProxy),
		"WEBSEARCH_COMPARE_ENGINES="+name,
		"WEBSEARCH_COMPARE_QUERY="+query,
		fmt.Sprintf("WEBSEARCH_COMPARE_NUM_RESULTS=%d", maxResults),
		"HTTP_PROXY="+proxyURL,
		"HTTPS_PROXY="+proxyURL,
		"ALL_PROXY="+proxyURL,
		"NO_PROXY="+noProxy,
	)
	var output bytes.Buffer
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Start(); err != nil {
		return nil, err
	}
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			return nil, fmt.Errorf("%w: %s", err, strings.TrimSpace(output.String()))
		}
		return output.Bytes(), nil
	case <-ctx.Done():
		terminateProcessTree(command.Process)
		<-done
		return nil, fmt.Errorf("scode_runner_timeout: %w", ctx.Err())
	}
}

func proxyEnvironment(proxyURL, noProxy string) []string {
	proxyKeys := map[string]struct{}{
		"HTTP_PROXY": {}, "HTTPS_PROXY": {}, "ALL_PROXY": {}, "NO_PROXY": {},
	}
	clean := make([]string, 0, len(os.Environ())+4)
	for _, item := range os.Environ() {
		key, _, ok := strings.Cut(item, "=")
		if ok {
			if _, isProxyKey := proxyKeys[strings.ToUpper(key)]; isProxyKey {
				continue
			}
		}
		clean = append(clean, item)
	}
	return append(clean,
		"HTTP_PROXY="+proxyURL,
		"HTTPS_PROXY="+proxyURL,
		"ALL_PROXY="+proxyURL,
		"NO_PROXY="+noProxy,
	)
}

func terminateProcessTree(process *os.Process) {
	if process == nil {
		return
	}
	if runtime.GOOS == "windows" {
		_ = exec.Command("taskkill", "/PID", strconv.Itoa(process.Pid), "/T", "/F").Run()
		return
	}
	_ = process.Kill()
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(2)
}
