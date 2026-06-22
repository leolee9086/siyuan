package prefix

import "sync"

// globalRegistry 全局前缀指令注册表。
var globalRegistry = &Registry{
	commands: make(map[string]*PrefixCommand),
}

// Registry 管理前缀指令的注册、查询、删除。
type Registry struct {
	mu       sync.RWMutex
	commands map[string]*PrefixCommand
}

// GlobalRegistry 返回全局注册表实例。
func GlobalRegistry() *Registry {
	return globalRegistry
}

// Register 注册一个前缀指令。如果 ID 已存在则覆盖。
func (r *Registry) Register(cmd *PrefixCommand) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.commands[cmd.ID] = cmd
}

// Unregister 删除一个前缀指令。
func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.commands, id)
}

// Get 返回指定 ID 的指令。
func (r *Registry) Get(id string) (*PrefixCommand, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cmd, ok := r.commands[id]
	return cmd, ok
}

// All 返回所有已注册指令的副本。
func (r *Registry) All() []*PrefixCommand {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*PrefixCommand, 0, len(r.commands))
	for _, cmd := range r.commands {
		result = append(result, cmd)
	}
	return result
}

// Clear 清空所有指令。
func (r *Registry) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.commands = make(map[string]*PrefixCommand)
}
