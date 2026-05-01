package trust

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
)

const defaultConfigFilename = "channel-trust.json"

// Manager 管理多通道可信度配置的加载、查询、热重载。
type Manager struct {
	mu       sync.RWMutex
	cfg      *Config
	filePath string
	modTime  time.Time
}

// NewManager 创建可信度配置管理器。
// configDir 是配置文件的存放目录（如 util.ConfDir）。
// 如果文件不存在，自动创建默认配置。
func NewManager(configDir string) *Manager {
	m := &Manager{
		filePath: filepath.Join(configDir, defaultConfigFilename),
		cfg:      defaultConfig(),
	}
	if err := m.ensureLoaded(); err != nil {
		logging.LogWarnf("channel trust config: %v, using defaults", err)
	}
	return m
}

// NewManagerWithPath 使用指定的完整路径创建管理器。
// 如果 filePath 为空，则后续首次使用时会通过 EnsureConfigDir 补全路径。
func NewManagerWithPath(filePath string) *Manager {
	m := &Manager{
		filePath: filePath,
		cfg:      defaultConfig(),
	}
	if filePath != "" {
		if err := m.ensureLoaded(); err != nil {
			logging.LogWarnf("channel trust config: %v, using defaults", err)
		}
	}
	return m
}

// EnsureConfigDir 在首次使用时补全配置路径（解决 util.ConfDir 在包 init 时未就绪的问题）。
func (m *Manager) EnsureConfigDir(configDir string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.filePath == "" && configDir != "" {
		m.filePath = filepath.Join(configDir, defaultConfigFilename)
		if err := m.ensureLoadedLocked(); err != nil {
			logging.LogWarnf("channel trust config: %v, using defaults", err)
		}
	}
}

func (m *Manager) ensureLoaded() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ensureLoadedLocked()
}

func (m *Manager) ensureLoadedLocked() error {
	path := m.filePath
	if path == "" {
		return nil
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return m.saveLocked()
		}
		return err
	}

	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.Channels == nil {
		cfg.Channels = map[string]ChannelConfig{}
	}

	info, statErr := os.Stat(path)
	if statErr == nil {
		m.modTime = info.ModTime()
	}

	m.cfg = &cfg
	return nil
}

func (m *Manager) saveDefault() error {
	cfg := defaultConfig()
	raw, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if mkErr := os.MkdirAll(filepath.Dir(m.filePath), 0755); mkErr != nil {
		return mkErr
	}
	if writeErr := os.WriteFile(m.filePath, raw, 0644); writeErr != nil {
		return writeErr
	}
	m.mu.Lock()
	m.cfg = cfg
	m.mu.Unlock()
	return nil
}

func (m *Manager) saveLocked() error {
	if m.filePath == "" {
		return nil
	}
	raw, err := json.MarshalIndent(m.cfg, "", "  ")
	if err != nil {
		return err
	}
	if mkErr := os.MkdirAll(filepath.Dir(m.filePath), 0755); mkErr != nil {
		return mkErr
	}
	return os.WriteFile(m.filePath, raw, 0644)
}

// GetConfig 返回当前配置的副本。
func (m *Manager) GetConfig() *Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return copyConfig(m.cfg)
}

// GetChannelConfig 返回指定通道的配置（无账号级覆盖）。
// 如果通道未配置，返回一个禁用状态的默认配置。
func (m *Manager) GetChannelConfig(channelID string) ChannelConfig {
	m.mu.RLock()
	cfg := m.cfg
	m.mu.RUnlock()

	if cfg == nil || cfg.Channels == nil {
		return ChannelConfig{Enabled: false, DefaultTrust: "low", DefaultRisk: "high"}
	}
	cc, ok := cfg.Channels[channelID]
	if !ok {
		return ChannelConfig{Enabled: false, DefaultTrust: "low", DefaultRisk: "high"}
	}
	if !isValidTrustLevel(cc.DefaultTrust) {
		cc.DefaultTrust = "low"
	}
	if !isValidRiskLevel(cc.DefaultRisk) {
		cc.DefaultRisk = "high"
	}
	return cc
}

// SaveConfig 保存配置并触发热重载。
func (m *Manager) SaveConfig(cfg *Config) error {
	raw, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if mkErr := os.MkdirAll(filepath.Dir(m.filePath), 0755); mkErr != nil {
		return mkErr
	}
	tmpPath := m.filePath + ".tmp"
	if writeErr := os.WriteFile(tmpPath, raw, 0644); writeErr != nil {
		return writeErr
	}
	if renameErr := os.Rename(tmpPath, m.filePath); renameErr != nil {
		return renameErr
	}
	m.mu.Lock()
	m.cfg = cfg
	m.mu.Unlock()
	logging.LogInfof("channel trust config saved and reloaded: %s", m.filePath)
	return nil
}

// Reload 从磁盘重新加载配置。
func (m *Manager) Reload() error {
	return m.ensureLoaded()
}

// TryReload 如果文件修改时间发生变化则重新加载。适合定时轮询调用。
func (m *Manager) TryReload() {
	info, err := os.Stat(m.filePath)
	if err != nil {
		return
	}
	m.mu.RLock()
	oldModTime := m.modTime
	m.mu.RUnlock()
	if info.ModTime().After(oldModTime) {
		if loadErr := m.ensureLoaded(); loadErr != nil {
			logging.LogWarnf("channel trust config reload failed: %v", loadErr)
		}
	}
}

func copyConfig(cfg *Config) *Config {
	if cfg == nil {
		return defaultConfig()
	}
	raw, _ := json.Marshal(cfg)
	var copy Config
	_ = json.Unmarshal(raw, &copy)
	return &copy
}
