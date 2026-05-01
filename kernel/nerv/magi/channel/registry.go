package channel

import "sync"

var globalRegistry = &Registry{
	adapters: make(map[string]ChannelAdapter),
}

type Registry struct {
	mu       sync.RWMutex
	adapters map[string]ChannelAdapter
}

func Register(adapter ChannelAdapter) {
	globalRegistry.mu.Lock()
	defer globalRegistry.mu.Unlock()
	id := adapter.ID()
	if _, exists := globalRegistry.adapters[id]; exists {
		panic("channel adapter already registered: " + id)
	}
	globalRegistry.adapters[id] = adapter
}

func Unregister(id string) {
	globalRegistry.mu.Lock()
	defer globalRegistry.mu.Unlock()
	delete(globalRegistry.adapters, id)
}

func Get(id string) (ChannelAdapter, bool) {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()
	a, ok := globalRegistry.adapters[id]
	return a, ok
}

func All() []ChannelAdapter {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()
	result := make([]ChannelAdapter, 0, len(globalRegistry.adapters))
	for _, a := range globalRegistry.adapters {
		result = append(result, a)
	}
	return result
}
