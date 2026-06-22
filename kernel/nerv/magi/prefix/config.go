package prefix

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/siyuan-note/logging"
)

const configFilename = "prefix-commands.json"

// ConfigManager 管理前缀指令配置的持久化加载和保存。
type ConfigManager struct {
	mu       sync.RWMutex
	filePath string
	config   *configFile
}

type configFile struct {
	Commands []*PrefixCommand `json:"commands"`
}

// NewConfigManager 创建配置管理器。configDir 为配置文件存放目录。
func NewConfigManager(configDir string) *ConfigManager {
	cm := &ConfigManager{
		filePath: filepath.Join(configDir, configFilename),
		config:   &configFile{Commands: []*PrefixCommand{}},
	}
	if err := cm.load(); err != nil {
		logging.LogWarnf("prefix command config: %v, using defaults", err)
	}
	return cm
}

// load 从磁盘加载配置。文件不存在时创建默认配置。
func (cm *ConfigManager) load() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	raw, err := os.ReadFile(cm.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// 文件不存在时写入默认内置指令
			cm.config = &configFile{Commands: defaultBuiltinCommands()}
			return cm.saveLocked()
		}
		return err
	}

	var cfg configFile
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.Commands == nil {
		cfg.Commands = []*PrefixCommand{}
	}
	cm.config = &cfg
	return nil
}

func (cm *ConfigManager) saveLocked() error {
	raw, err := json.MarshalIndent(cm.config, "", "  ")
	if err != nil {
		return err
	}
	if mkErr := os.MkdirAll(filepath.Dir(cm.filePath), 0755); mkErr != nil {
		return mkErr
	}
	return os.WriteFile(cm.filePath, raw, 0644)
}

// Save 将当前配置持久化到磁盘。
func (cm *ConfigManager) Save() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	return cm.saveLocked()
}

// GetCommands 返回所有配置中的指令。
func (cm *ConfigManager) GetCommands() []*PrefixCommand {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	result := make([]*PrefixCommand, len(cm.config.Commands))
	copy(result, cm.config.Commands)
	return result
}

// SetCommands 替换全部指令并保存。
func (cm *ConfigManager) SetCommands(cmds []*PrefixCommand) error {
	cm.mu.Lock()
	cm.config.Commands = cmds
	cm.mu.Unlock()
	return cm.Save()
}

// UpsertCommand 新增或更新单个指令并保存。
func (cm *ConfigManager) UpsertCommand(cmd *PrefixCommand) error {
	cm.mu.Lock()
	found := false
	for i, existing := range cm.config.Commands {
		if existing.ID == cmd.ID {
			cm.config.Commands[i] = cmd
			found = true
			break
		}
	}
	if !found {
		cm.config.Commands = append(cm.config.Commands, cmd)
	}
	cm.mu.Unlock()
	return cm.Save()
}

// DeleteCommand 删除指定 ID 的指令并保存。
func (cm *ConfigManager) DeleteCommand(id string) error {
	cm.mu.Lock()
	found := false
	cmds := make([]*PrefixCommand, 0, len(cm.config.Commands))
	for _, existing := range cm.config.Commands {
		if existing.ID == id {
			found = true
			continue
		}
		cmds = append(cmds, existing)
	}
	cm.config.Commands = cmds
	cm.mu.Unlock()
	if !found {
		return nil
	}
	return cm.Save()
}

// defaultBuiltinCommands 返回内置默认指令列表。
// 首次创建配置文件时写入，用户可后续修改或删除。
func defaultBuiltinCommands() []*PrefixCommand {
	return []*PrefixCommand{
		{
			ID:          "inbox",
			Prefixes:    []string{"收集:", "收集：", "inbox:", "收集箱:"},
			Description:  "将消息内容收集到思源笔记，创建本地文档",
			Builtin:     "inbox",
			HandlerKind: HandlerKindGo,
			NotifyMagi:  false,
			TrustLevel:  "low",
			Enabled:     true,
			Metadata: map[string]any{
				"saveMode":     "standalone", // standalone 或 merge
				"pathTemplate": "/{YYYY}/{MM}/{DD}",
			},
		},
		{
			ID:          "todo",
			Prefixes:    []string{"待办:", "todo:", "任务:"},
			Description:  "创建待办事项到指定文档",
			Builtin:     "todo",
			HandlerKind: HandlerKindGo,
			NotifyMagi:  true,
			TrustLevel:  "low",
			Enabled:     true,
			Metadata: map[string]any{
				"checklistDocPath": "/待办清单",
			},
		},
	}
}
