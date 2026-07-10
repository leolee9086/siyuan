package websearch

import (
	"strconv"
	"sync"
	"time"
)

type cacheEntry struct {
	results   []SearchResult
	expiresAt int64
}

// ResultCache 内存缓存（LRU + TTL）
type ResultCache struct {
	mu          sync.RWMutex
	cache       map[string]*cacheEntry
	accessOrder []string
	maxSize     int
	ttl         int64
	Hits        int
	Misses      int
}

// NewResultCache 创建缓存实例
func NewResultCache(maxSize int, ttlMs int64) *ResultCache {
	if maxSize <= 0 {
		maxSize = 100
	}
	if ttlMs <= 0 {
		ttlMs = 60000
	}
	return &ResultCache{
		cache:       make(map[string]*cacheEntry, maxSize),
		accessOrder: make([]string, 0, maxSize),
		maxSize:     maxSize,
		ttl:         ttlMs,
	}
}

// MakeCacheKey 生成标准化的缓存键
func MakeCacheKey(query string, opts SearchOptions) string {
	return query + "|" + strconv.Itoa(opts.NumResults) + "|" + opts.TimeRange + "|" + opts.Lang
}

// Get 获取缓存。过期条目自动删除并返回 nil。
func (rc *ResultCache) Get(key string) []SearchResult {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	entry, ok := rc.cache[key]
	if !ok {
		rc.Misses++
		return nil
	}
	if time.Now().UnixMilli() > entry.expiresAt {
		delete(rc.cache, key)
		rc.removeFromOrder(key)
		rc.Misses++
		return nil
	}
	rc.touch(key)
	rc.Hits++
	return entry.results
}

// Set 写入缓存。超过上限时淘汰最久未访问的条目（LRU）。
func (rc *ResultCache) Set(key string, results []SearchResult) {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	if _, ok := rc.cache[key]; ok {
		rc.touch(key)
		rc.cache[key] = &cacheEntry{
			results:   results,
			expiresAt: time.Now().UnixMilli() + rc.ttl,
		}
		return
	}
	if len(rc.cache) >= rc.maxSize && len(rc.accessOrder) > 0 {
		lruKey := rc.accessOrder[0]
		rc.accessOrder = rc.accessOrder[1:]
		delete(rc.cache, lruKey)
	}
	rc.accessOrder = append(rc.accessOrder, key)
	rc.cache[key] = &cacheEntry{
		results:   results,
		expiresAt: time.Now().UnixMilli() + rc.ttl,
	}
}

func (rc *ResultCache) touch(key string) {
	rc.removeFromOrder(key)
	rc.accessOrder = append(rc.accessOrder, key)
}

func (rc *ResultCache) removeFromOrder(key string) {
	for i, k := range rc.accessOrder {
		if k == key {
			rc.accessOrder = append(rc.accessOrder[:i], rc.accessOrder[i+1:]...)
			break
		}
	}
}

// Clear 清空缓存并重置统计
func (rc *ResultCache) Clear() {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	rc.cache = make(map[string]*cacheEntry, rc.maxSize)
	rc.accessOrder = make([]string, 0, rc.maxSize)
	rc.Hits = 0
	rc.Misses = 0
}

// Size 返回当前缓存条目数
func (rc *ResultCache) Size() int {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	return len(rc.cache)
}

// HitRate 返回缓存命中率（0.0 ~ 1.0）
func (rc *ResultCache) HitRate() float64 {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	total := rc.Hits + rc.Misses
	if total == 0 {
		return 0
	}
	return float64(rc.Hits) / float64(total)
}

// GlobalResultCache 全局搜索结果缓存（进程级单例）
var GlobalResultCache = NewResultCache(100, 60000)
