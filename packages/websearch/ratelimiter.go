package websearch

import (
	"math/rand/v2"
	"sync"
	"time"
)

// ── User-Agent 轮换池 ──────────────────────────────

var userAgentPool = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
	"Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
	"Mozilla/5.0 (Android 14; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0",
}

// RandomUserAgent 从轮换池中随机选取一个 User-Agent
func RandomUserAgent() string {
	return userAgentPool[rand.IntN(len(userAgentPool))]
}

// ── 速率限制器 ──────────────────────────────────────

// RateLimitEntry 速率限制条目
type RateLimitEntry struct {
	LastCallAt       int64
	ConsecutiveWaits int
}

// RateLimiter 引擎级速率限制器
type RateLimiter struct {
	mu               sync.RWMutex
	entries          map[string]*RateLimitEntry
	defaultInterval  int64 // 毫秒
	engineIntervals  map[string]int64
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(defaultIntervalMs int64) *RateLimiter {
	if defaultIntervalMs == 0 {
		defaultIntervalMs = 800
	}
	rl := &RateLimiter{
		entries:         make(map[string]*RateLimitEntry),
		defaultInterval: defaultIntervalMs,
		engineIntervals: make(map[string]int64),
	}
	// 为易触发反爬的引擎设置更保守的间隔
	rl.SetEngineInterval("google", 2000)
	rl.SetEngineInterval("google-images", 2000)
	rl.SetEngineInterval("google-news", 2000)
	rl.SetEngineInterval("google-scholar", 2000)
	rl.SetEngineInterval("baidu", 1500)
	rl.SetEngineInterval("sogou", 1500)
	rl.SetEngineInterval("naver", 1200)
	rl.SetEngineInterval("yandex", 1200)
	rl.SetEngineInterval("bing", 1000)
	rl.SetEngineInterval("bing-news", 1000)
	rl.SetEngineInterval("duckduckgo", 800)
	rl.SetEngineInterval("brave", 500)
	return rl
}

// SetEngineInterval 设置特定引擎的最小请求间隔
func (rl *RateLimiter) SetEngineInterval(engine string, intervalMs int64) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.engineIntervals[engine] = intervalMs
}

// GetInterval 获取引擎的最小请求间隔
func (rl *RateLimiter) GetInterval(engine string) int64 {
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	if v, ok := rl.engineIntervals[engine]; ok {
		return v
	}
	return rl.defaultInterval
}

// Check 检查引擎是否可以发送请求。返回需要等待的毫秒数（0 表示可以立即发送）
func (rl *RateLimiter) Check(engine string) int64 {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := nowMs()
	entry, ok := rl.entries[engine]
	if !ok {
		rl.entries[engine] = &RateLimitEntry{LastCallAt: now}
		return 0
	}

	interval := rl.defaultInterval
	if v, ok2 := rl.engineIntervals[engine]; ok2 {
		interval = v
	}

	elapsed := now - entry.LastCallAt
	if elapsed >= interval {
		entry.LastCallAt = now
		entry.ConsecutiveWaits = 0
		return 0
	}
	waitMs := interval - elapsed
	entry.ConsecutiveWaits++
	return waitMs
}

// MarkCalled 标记引擎已发送请求
func (rl *RateLimiter) MarkCalled(engine string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := nowMs()
	if entry, ok := rl.entries[engine]; ok {
		entry.LastCallAt = now
	} else {
		rl.entries[engine] = &RateLimitEntry{LastCallAt: now}
	}
}

// RateLimitStatus 速率限制状态
type RateLimitStatus struct {
	LastCallAgo int64 `json:"lastCallAgo"`
	Interval    int64 `json:"interval"`
	Waits       int   `json:"waits"`
}

// GetStatus 获取所有引擎的速率限制状态
func (rl *RateLimiter) GetStatus() map[string]RateLimitStatus {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	now := nowMs()
	status := make(map[string]RateLimitStatus, len(rl.entries))
	for engine, entry := range rl.entries {
		interval := rl.defaultInterval
		if v, ok := rl.engineIntervals[engine]; ok {
			interval = v
		}
		status[engine] = RateLimitStatus{
			LastCallAgo: now - entry.LastCallAt,
			Interval:    interval,
			Waits:       entry.ConsecutiveWaits,
		}
	}
	return status
}

// Reset 重置所有状态
func (rl *RateLimiter) Reset() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.entries = make(map[string]*RateLimitEntry)
}

// GlobalRateLimiter 全局速率限制器单例
var GlobalRateLimiter = NewRateLimiter(800)

func nowMs() int64 {
	return time.Now().UnixMilli()
}
