package websearch

import (
	"math/rand/v2"
	"sync"
	"time"
)

// ── 执行器状态 ──────────────────────────────────────────

// ExecutorState 执行器状态（可变，追踪引擎健康）
type ExecutorState struct {
	mu             sync.RWMutex
	EngineStatuses map[string]*EngineStatus
}

// NewExecutorState 创建执行器状态
func NewExecutorState() *ExecutorState {
	return &ExecutorState{
		EngineStatuses: make(map[string]*EngineStatus),
	}
}

// GlobalExecutorState 全局引擎健康状态（跨调用持久化）
// 模块级单例确保引擎健康在多次搜索间持续追踪
var GlobalExecutorState = NewExecutorState()

// ExecuteResult 执行结果
type ExecuteResult struct {
	Results []SearchResult
	Errors  []EngineError
}

// MAX_CONCURRENCY 全局搜索引擎最大并发数
const MAX_CONCURRENCY = 10

// EngineOutcome 单个引擎的执行结果
type EngineOutcome struct {
	Results []SearchResult
	Error   *EngineError
	Success bool
}

// ExecuteAll 并发执行多个搜索引擎
// 带引擎健康检查（熔断器）和进度回调
func ExecuteAll(
	engines []SearchEngine,
	query string,
	opts SearchOptions,
	state *ExecutorState,
	onProgress ProgressCallback,
) ExecuteResult {
	if len(engines) == 0 {
		return ExecuteResult{}
	}

	// 过滤暂停中的引擎
	var active []SearchEngine
	for _, e := range engines {
		state.mu.RLock()
		status, exists := state.EngineStatuses[e.Name()]
		state.mu.RUnlock()

		if !exists || !status.Suspended {
			active = append(active, e)
			continue
		}
		if status.SuspendedUntil > 0 && time.Now().UnixMilli() > status.SuspendedUntil {
			state.mu.Lock()
			status.Suspended = false
			status.ConsecutiveFailures = 0
			state.mu.Unlock()
			active = append(active, e)
		}
	}

	if len(active) == 0 {
		return ExecuteResult{}
	}

	total := len(active)
	done := 0
	var mu sync.Mutex
	var allResults []SearchResult
	var allErrors []EngineError

	var wg sync.WaitGroup
	sem := make(chan struct{}, MAX_CONCURRENCY)

	for _, engine := range active {
		wg.Add(1)
		sem <- struct{}{}

		go func(engine SearchEngine) {
			defer wg.Done()
			defer func() { <-sem }()

			// 发送 start 相位
			mu.Lock()
			if onProgress != nil {
				onProgress(ProgressInfo{
					Done: done, Total: total, Current: engine.Name(),
					Phase: PhaseStart,
				})
			}
			mu.Unlock()

			// 速率限制
			waitMs := GlobalRateLimiter.Check(engine.Name())
			if waitMs > 0 {
				time.Sleep(time.Duration(waitMs) * time.Millisecond)
			}

			// 执行搜索
			results, err := executeEngineSafely(engine, query, opts, state)
			GlobalRateLimiter.MarkCalled(engine.Name())

			mu.Lock()
			done++

			if err == nil && len(results) > 0 {
				allResults = append(allResults, results...)
				if onProgress != nil {
					onProgress(ProgressInfo{
						Done: done, Total: total, Current: engine.Name(),
						Phase: PhaseResult, PartialResults: allResults, NewResults: results,
					})
				}
			} else if err != nil {
				allErrors = append(allErrors, *err)
			}

			if onProgress != nil {
				onProgress(ProgressInfo{
					Done: done, Total: total, Current: engine.Name(),
					Phase: PhaseDone, PartialResults: allResults,
				})
			}
			mu.Unlock()
		}(engine)
	}

	wg.Wait()
	return ExecuteResult{Results: allResults, Errors: allErrors}
}

// executeEngineSafely 安全地执行单个引擎搜索，捕获所有错误
func executeEngineSafely(
	engine SearchEngine,
	query string,
	opts SearchOptions,
	state *ExecutorState,
) ([]SearchResult, *EngineError) {
	startTime := time.Now()
	resultCh := make(chan searchResultOrError, 1)

	go func() {
		results, err := engine.Search(query, opts, nil)
		resultCh <- searchResultOrError{results: results, err: err}
	}()

	var results []SearchResult
	var searchErr error

	timeout := time.Duration(engine.Config().Timeout) * time.Millisecond
	select {
	case res := <-resultCh:
		results = res.results
		searchErr = res.err
	case <-time.After(timeout):
		searchErr = &TimeoutError{Engine: engine.Name(), Message: "timed out after " + itoa(engine.Config().Timeout) + "ms"}
	}

	latency := time.Since(startTime).Milliseconds()

	state.mu.Lock()
	status := getOrCreateStatus(state, engine.Name())
	defer state.mu.Unlock()

	if searchErr != nil {
		status.Metrics.TotalRequests++
		handleEngineError(status, engine.Name(), searchErr)
		return nil, &EngineError{Engine: engine.Name(), Message: searchErr.Error(), Retryable: isRetryable(searchErr)}
	}
	if results == nil {
		searchErr = &ProtocolError{Engine: engine.Name(), Message: "search returned nil results without an error"}
	}
	if searchErr != nil {
		status.Metrics.TotalRequests++
		handleEngineError(status, engine.Name(), searchErr)
		return nil, &EngineError{Engine: engine.Name(), Message: searchErr.Error(), Retryable: isRetryable(searchErr)}
	}

	status.ConsecutiveFailures = 0
	status.Metrics.TotalRequests++
	status.Metrics.SuccessfulRequests++
	status.Metrics.TotalLatency += float64(latency)
	status.Metrics.AvgLatency = status.Metrics.TotalLatency / float64(status.Metrics.SuccessfulRequests)
	status.Metrics.LastSuccessAt = time.Now().UnixMilli()
	return results, nil
}

type searchResultOrError struct {
	results []SearchResult
	err     error
}

func getOrCreateStatus(state *ExecutorState, name string) *EngineStatus {
	if s, ok := state.EngineStatuses[name]; ok {
		return s
	}
	s := MakeEngineStatus()
	state.EngineStatuses[name] = &s
	return state.EngineStatuses[name]
}

func handleEngineError(status *EngineStatus, engineName string, err error) {
	switch e := err.(type) {
	case *RateLimitError:
		status.LastError = e.Message
		retryAfter := e.RetryAfter
		if retryAfter <= 0 {
			retryAfter = 60
		}
		status.Suspended = true
		status.SuspendedUntil = time.Now().UnixMilli() + int64(retryAfter)*1000
		status.LastSuspensionReason = "rate-limited, retry-after: " + itoa(retryAfter) + "s"
		status.LastSuspensionDuration = int64(retryAfter) * 1000

	case *CaptchaError, *AccessDeniedError:
		status.LastError = e.Error()
		status.ConsecutiveFailures++
		status.Suspended = true
		status.SuspendedUntil = time.Now().UnixMilli() + 30*60*1000 // 30 分钟
		if _, ok := err.(*CaptchaError); ok {
			status.LastSuspensionReason = "captcha-challenge"
		} else {
			status.LastSuspensionReason = "access-denied"
		}
		status.LastSuspensionDuration = 30 * 60 * 1000

	default:
		status.ConsecutiveFailures++
		applyExponentialBackoff(status, engineName, err.Error())
	}
}

// applyExponentialBackoff 指数退避算法（含随机抖动）
// 连续失败 1 次 → 1 分钟，2 次 → 5 分钟，3+ 次 → 15 分钟
// 上限 60 分钟，含 ±20% 随机抖动
func applyExponentialBackoff(status *EngineStatus, engineName, errorMessage string) {
	status.TotalFailures++
	status.LastError = errorMessage

	var baseMinutes int64
	switch {
	case status.ConsecutiveFailures <= 1:
		baseMinutes = 1
	case status.ConsecutiveFailures <= 2:
		baseMinutes = 5
	default:
		baseMinutes = 15
	}

	// ±20% 随机抖动
	jitter := 0.8 + rand.Float64()*0.4
	backoffMinutes := float64(baseMinutes) * jitter
	clamped := int64(backoffMinutes)
	if clamped > 60 {
		clamped = 60
	}
	durationMs := clamped * 60 * 1000

	status.Suspended = true
	status.SuspendedUntil = time.Now().UnixMilli() + durationMs
	status.LastSuspensionReason = "exponential-backoff@" + itoa(int(baseMinutes)) + "min"
	status.LastSuspensionDuration = durationMs
}

func isRetryable(err error) bool {
	switch err.(type) {
	case *CaptchaError, *AccessDeniedError:
		return false
	default:
		return true
	}
}

// ResetGlobalState 重置全局引擎健康状态（仅测试用）
func ResetGlobalState() {
	GlobalExecutorState.mu.Lock()
	defer GlobalExecutorState.mu.Unlock()
	GlobalExecutorState.EngineStatuses = make(map[string]*EngineStatus)
}
