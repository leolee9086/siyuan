package marduk

import (
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/siyuan-note/logging"
	"golang.org/x/sync/singleflight"
)

type personaSeedDescriptionsCacheEntry struct {
	generation   uint64
	descriptions IpipPersonaSeedDescriptions
}

type personaSeedDescriptionsResolver struct {
	mu          sync.RWMutex
	cache       map[string]personaSeedDescriptionsCacheEntry
	generations map[string]uint64
	watchers    map[string]*fsnotify.Watcher
	loadGroup   singleflight.Group
}

var personaSeedDescriptionsState = &personaSeedDescriptionsResolver{
	cache:       map[string]personaSeedDescriptionsCacheEntry{},
	generations: map[string]uint64{},
	watchers:    map[string]*fsnotify.Watcher{},
}

func resolvePersonaSeedDescriptionsCached(
	dataDir string,
	subjectID string,
	loader func() IpipPersonaSeedDescriptions,
) IpipPersonaSeedDescriptions {
	if loader == nil {
		return IpipPersonaSeedDescriptions{}
	}

	normalizedDataDir := normalizePersonaSeedDescriptionsDataDir(dataDir)
	if normalizedDataDir == "" {
		return loader()
	}

	if !personaSeedDescriptionsState.ensureWatcher(normalizedDataDir) {
		return loader()
	}

	cacheKey := buildPersonaSeedDescriptionsCacheKey(normalizedDataDir, subjectID)
	generation := personaSeedDescriptionsState.currentGeneration(normalizedDataDir)
	if cached, ok := personaSeedDescriptionsState.load(cacheKey, generation); ok {
		return cached
	}

	result, _, _ := personaSeedDescriptionsState.loadGroup.Do(cacheKey, func() (interface{}, error) {
		currentGeneration := personaSeedDescriptionsState.currentGeneration(normalizedDataDir)
		if cached, ok := personaSeedDescriptionsState.load(cacheKey, currentGeneration); ok {
			return cached, nil
		}

		for attempt := 0; attempt < 2; attempt++ {
			generationBefore := personaSeedDescriptionsState.currentGeneration(normalizedDataDir)
			descriptions := loader()
			generationAfter := personaSeedDescriptionsState.currentGeneration(normalizedDataDir)
			if generationBefore != generationAfter && attempt == 0 {
				continue
			}
			if generationBefore == generationAfter {
				personaSeedDescriptionsState.store(cacheKey, generationAfter, descriptions)
			}
			return descriptions, nil
		}

		descriptions := loader()
		return descriptions, nil
	})
	if resolved, ok := result.(IpipPersonaSeedDescriptions); ok {
		return resolved
	}
	return loader()
}

func normalizePersonaSeedDescriptionsDataDir(dataDir string) string {
	trimmed := strings.TrimSpace(dataDir)
	if trimmed == "" {
		return ""
	}
	return filepath.Clean(trimmed)
}

func buildPersonaSeedDescriptionsCacheKey(dataDir string, subjectID string) string {
	return dataDir + "\x00" + strings.ToLower(strings.TrimSpace(subjectID))
}

func (state *personaSeedDescriptionsResolver) ensureWatcher(dataDir string) bool {
	if state == nil {
		return false
	}

	state.mu.RLock()
	if _, ok := state.watchers[dataDir]; ok {
		state.mu.RUnlock()
		return true
	}
	state.mu.RUnlock()

	privateDir := filepath.Join(dataDir, "private")
	info, err := os.Stat(privateDir)
	if err != nil || !info.IsDir() {
		return false
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		logging.LogWarnf("create persona seed watcher failed [%s]: %v", privateDir, err)
		return false
	}
	if err = watcher.Add(privateDir); err != nil {
		_ = watcher.Close()
		logging.LogWarnf("watch persona seed private dir failed [%s]: %v", privateDir, err)
		return false
	}

	state.mu.Lock()
	if existing, ok := state.watchers[dataDir]; ok {
		state.mu.Unlock()
		_ = watcher.Close()
		return existing != nil
	}
	state.watchers[dataDir] = watcher
	if _, ok := state.generations[dataDir]; !ok {
		state.generations[dataDir] = 1
	}
	state.mu.Unlock()

	go state.watch(dataDir, watcher)
	return true
}

func (state *personaSeedDescriptionsResolver) watch(dataDir string, watcher *fsnotify.Watcher) {
	defer func() {
		state.mu.Lock()
		current := state.watchers[dataDir]
		if current == watcher {
			delete(state.watchers, dataDir)
		}
		state.mu.Unlock()
		_ = watcher.Close()
	}()

	for {
		select {
		case _, ok := <-watcher.Events:
			if !ok {
				return
			}
			state.invalidate(dataDir)
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			logging.LogWarnf("persona seed watcher error [%s]: %v", dataDir, err)
			state.invalidate(dataDir)
		}
	}
}

func (state *personaSeedDescriptionsResolver) currentGeneration(dataDir string) uint64 {
	if state == nil {
		return 0
	}

	state.mu.RLock()
	defer state.mu.RUnlock()
	return state.generations[dataDir]
}

func (state *personaSeedDescriptionsResolver) load(cacheKey string, generation uint64) (IpipPersonaSeedDescriptions, bool) {
	if state == nil {
		return IpipPersonaSeedDescriptions{}, false
	}

	state.mu.RLock()
	defer state.mu.RUnlock()

	entry, ok := state.cache[cacheKey]
	if !ok || entry.generation != generation {
		return IpipPersonaSeedDescriptions{}, false
	}
	return entry.descriptions, true
}

func (state *personaSeedDescriptionsResolver) store(cacheKey string, generation uint64, descriptions IpipPersonaSeedDescriptions) {
	if state == nil {
		return
	}

	state.mu.Lock()
	defer state.mu.Unlock()
	state.cache[cacheKey] = personaSeedDescriptionsCacheEntry{
		generation:   generation,
		descriptions: descriptions,
	}
}

func (state *personaSeedDescriptionsResolver) invalidate(dataDir string) {
	if state == nil {
		return
	}

	cachePrefix := dataDir + "\x00"

	state.mu.Lock()
	defer state.mu.Unlock()

	state.generations[dataDir]++
	if state.generations[dataDir] == 0 {
		state.generations[dataDir] = 1
	}
	for key := range state.cache {
		if strings.HasPrefix(key, cachePrefix) {
			delete(state.cache, key)
		}
	}
}

func resetPersonaSeedDescriptionsResolverStateForTests() {
	watchers := make([]*fsnotify.Watcher, 0)

	personaSeedDescriptionsState.mu.Lock()
	for _, watcher := range personaSeedDescriptionsState.watchers {
		if watcher != nil {
			watchers = append(watchers, watcher)
		}
	}
	personaSeedDescriptionsState.cache = map[string]personaSeedDescriptionsCacheEntry{}
	personaSeedDescriptionsState.generations = map[string]uint64{}
	personaSeedDescriptionsState.watchers = map[string]*fsnotify.Watcher{}
	personaSeedDescriptionsState.loadGroup = singleflight.Group{}
	personaSeedDescriptionsState.mu.Unlock()

	for _, watcher := range watchers {
		_ = watcher.Close()
	}
}
