// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Package cronjob 提供用户可配置的定时任务功能
// 支持文学编程方式：用户可以在笔记文档中编写扩展代码
package cronjob

import (
	"sync"
	"time"
)

// 任务状态常量
const (
	任务状态_未运行 = "idle"
	任务状态_运行中 = "running"
	任务状态_已暂停 = "paused"
	任务状态_出错  = "error"
)

// 扩展类型常量
const (
	扩展类型_定时任务  = "cronjob"
	扩展类型_动态API = "api-ext"
	扩展类型_事件钩子  = "hook"
)

// 扩展语言常量
const (
	扩展语言_Go = "go"
)

// ExtensionConfig 记录在 conf/extensions.json 中的扩展注册信息
type ExtensionConfig struct {
	ID      string `json:"docId"`   // 扩展所在的文档ID
	ExtLang string `json:"extLang"` // 编译语言，如 "go"
	ExtType string `json:"extType"` // 扩展类型，如 "cronjob"
	Enabled bool   `json:"enabled"` // 是否启用
	Created int64  `json:"created"` // 注册时间戳
	Updated int64  `json:"updated"` // 更新时间戳
}

// TaskRuntimeInfo 运行时的任务状态信息
type TaskRuntimeInfo struct {
	DocID       string `json:"docId"`
	Name        string `json:"name"`
	Schedule    string `json:"schedule"`
	Description string `json:"description"`
	Status      string `json:"status"`
	LastRun     int64  `json:"lastRun"`
	NextRun     int64  `json:"nextRun"`
	LastError   string `json:"lastError"`
	RunCount    int64  `json:"runCount"`
}

// Context 传递给任务执行函数的上下文信息
type Context struct {
	DocID  string                 // 任务所属文档ID
	Name   string                 // 任务名称
	Time   time.Time              // 本次执行开始时间
	Config map[string]interface{} // 额外配置参数
	Log    func(string)           // 日志记录函数
}

// TaskHandler 由动态代码导出的任务执行函数签名
type TaskHandler func(ctx *Context) error

// TaskInstance 运行时的任务实例
type TaskInstance struct {
	Config   ExtensionConfig
	Runtime  TaskRuntimeInfo
	Handler  TaskHandler
	StopChan chan struct{}
	Lock     sync.Mutex
}

// Manager 定时任务管理器
type Manager struct {
	Tasks       map[string]*TaskInstance
	Extensions  map[string]*ExtensionConfig
	Executor    *脚本执行器
	Lock        sync.RWMutex
	Initialized bool
}

var (
	GlobalManager *Manager
	InitOnce      sync.Once
)

// GetManager 获取全局单例管理器
func GetManager() *Manager {
	InitOnce.Do(func() {
		GlobalManager = &Manager{
			Tasks:      make(map[string]*TaskInstance),
			Extensions: make(map[string]*ExtensionConfig),
		}
	})
	return GlobalManager
}

// Initialize 初始化管理器，加载配置并启动已启用的任务
func (m *Manager) Initialize() error {
	m.Lock.Lock()
	defer m.Lock.Unlock()

	if m.Initialized {
		return nil
	}

	// 创建脚本执行器
	var err error
	m.Executor, err = 创建脚本执行器()
	if err != nil {
		return err
	}

	// 加载扩展配置
	if err := m.LoadExtensionConfig(); err != nil {
		return err
	}

	// 编译并启动所有已启用的扩展
	for _, config := range m.Extensions {
		if config.Enabled && config.ExtType == 扩展类型_定时任务 {
			if err := m.CompileAndStartTask(config.ID); err != nil {
				// 记录错误但不中断启动
				continue
			}
		}
	}

	m.Initialized = true
	return nil
}

// LoadExtensionConfig 从 conf/extensions.json 加载配置
func (m *Manager) LoadExtensionConfig() error {
	// TODO: 从文件加载配置
	return nil
}

// SaveExtensionConfig 保存配置到 conf/extensions.json
func (m *Manager) SaveExtensionConfig() error {
	// TODO: 保存配置到文件
	return nil
}

// RegisterExtension 注册一个新的扩展文档
func (m *Manager) RegisterExtension(docID string, extLang string, extType string) error {
	m.Lock.Lock()
	defer m.Lock.Unlock()

	now := time.Now().Unix()
	m.Extensions[docID] = &ExtensionConfig{
		ID:      docID,
		ExtLang: extLang,
		ExtType: extType,
		Enabled: false,
		Created: now,
		Updated: now,
	}

	return m.SaveExtensionConfig()
}

// UnregisterExtension 注销一个扩展文档
func (m *Manager) UnregisterExtension(docID string) error {
	m.Lock.Lock()
	defer m.Lock.Unlock()

	// 先停止任务
	if task, ok := m.Tasks[docID]; ok {
		close(task.StopChan)
		delete(m.Tasks, docID)
	}

	delete(m.Extensions, docID)
	return m.SaveExtensionConfig()
}

// CompileAndStartTask 编译文档中的代码并启动任务
func (m *Manager) CompileAndStartTask(docID string) error {
	config, ok := m.Extensions[docID]
	if !ok {
		return nil
	}

	// 编译文档
	result, err := m.Executor.编译文档(docID)
	if err != nil {
		return err
	}

	// 加载并执行编译后的代码，获取导出的变量
	vars, err := m.Executor.加载代码(result)
	if err != nil {
		return err
	}

	// 获取必需的导出变量
	name, _ := vars["Name"].(string)
	schedule, _ := vars["Schedule"].(string)
	description, _ := vars["Description"].(string)
	handler, _ := vars["Run"].(TaskHandler)

	if handler == nil {
		return nil // 没有 Run 函数，跳过
	}

	// 创建任务实例
	task := &TaskInstance{
		Config: *config,
		Runtime: TaskRuntimeInfo{
			DocID:       docID,
			Name:        name,
			Schedule:    schedule,
			Description: description,
			Status:      任务状态_未运行,
		},
		Handler:  handler,
		StopChan: make(chan struct{}),
	}

	m.Tasks[docID] = task

	// 启动任务
	go m.RunTaskLoop(task)

	return nil
}

// RunTaskLoop 定时执行任务
func (m *Manager) RunTaskLoop(task *TaskInstance) {
	// TODO: 解析 cron 表达式，计算下次执行时间
	// 暂时使用简单的间隔执行
	interval := 1 * time.Minute

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-task.StopChan:
			return
		case <-ticker.C:
			m.ExecuteTask(task)
		}
	}
}

// ExecuteTask 执行一次任务
func (m *Manager) ExecuteTask(task *TaskInstance) {
	task.Lock.Lock()
	task.Runtime.Status = 任务状态_运行中
	task.Runtime.LastRun = time.Now().Unix()
	task.Lock.Unlock()

	ctx := &Context{
		DocID: task.Config.ID,
		Name:  task.Runtime.Name,
		Time:  time.Now(),
		Log: func(msg string) {
			// TODO: 记录日志
		},
	}

	err := task.Handler(ctx)

	task.Lock.Lock()
	if err != nil {
		task.Runtime.Status = 任务状态_出错
		task.Runtime.LastError = err.Error()
	} else {
		task.Runtime.Status = 任务状态_未运行
		task.Runtime.LastError = ""
	}
	task.Runtime.RunCount++
	task.Lock.Unlock()
}

// StopTask 停止指定任务
func (m *Manager) StopTask(docID string) error {
	m.Lock.Lock()
	defer m.Lock.Unlock()

	if task, ok := m.Tasks[docID]; ok {
		close(task.StopChan)
		delete(m.Tasks, docID)
	}
	return nil
}

// GetAllTasks 获取所有已注册任务的运行信息
func (m *Manager) GetAllTasks() []TaskRuntimeInfo {
	m.Lock.RLock()
	defer m.Lock.RUnlock()

	result := make([]TaskRuntimeInfo, 0, len(m.Extensions))
	for docID, config := range m.Extensions {
		if config.ExtType != 扩展类型_定时任务 {
			continue
		}

		if task, ok := m.Tasks[docID]; ok {
			result = append(result, task.Runtime)
		} else {
			// 对于未运行的任务，返回基础信息
			result = append(result, TaskRuntimeInfo{
				DocID:       config.ID,
				Name:        "未加载",
				Schedule:    "-",
				Description: "任务未启动",
				Status:      任务状态_未运行,
				LastRun:     0,
				NextRun:     0,
				LastError:   "",
				RunCount:    0,
			})
		}
	}
	return result
}

// GetTask 获取指定任务的运行信息
func (m *Manager) GetTask(docID string) *TaskRuntimeInfo {
	m.Lock.RLock()
	defer m.Lock.RUnlock()

	if task, ok := m.Tasks[docID]; ok {
		copy := task.Runtime
		return &copy
	}

	// 如果任务已注册但未运行，返回基础信息
	if config, ok := m.Extensions[docID]; ok && config.ExtType == 扩展类型_定时任务 {
		return &TaskRuntimeInfo{
			DocID:       config.ID,
			Name:        "未加载",
			Schedule:    "-",
			Description: "任务未启动",
			Status:      任务状态_未运行,
		}
	}

	return nil
}

// RunNow 立即执行指定任务（不等待调度）
func (m *Manager) RunNow(docID string) error {
	m.Lock.RLock()
	task, ok := m.Tasks[docID]
	m.Lock.RUnlock()

	if !ok {
		return nil
	}

	go m.ExecuteTask(task)
	return nil
}
