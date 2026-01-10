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
// 本文件提供英文别名导出，用于跨包访问
package cronjob

// ========== 管理器相关 ==========

// GetManager 获取管理器的英文别名
var GetManager = 获取管理器

// Manager 管理器类型的英文别名
type Manager = 管理器

// TaskRuntimeInfo 任务运行时信息的英文别名
type TaskRuntimeInfo = 任务运行时信息

// GetAllTasks 获取所有任务 - 管理器方法代理
func (m *Manager) GetAllTasks() []TaskRuntimeInfo {
	return m.获取所有任务()
}

// GetTask 获取任务 - 管理器方法代理
func (m *Manager) GetTask(docId string) *TaskRuntimeInfo {
	return m.获取任务(docId)
}

// RegisterExtension 注册扩展 - 管理器方法代理
func (m *Manager) RegisterExtension(docId string, extLang string, extType string) error {
	return m.注册扩展(docId, extLang, extType)
}

// UnregisterExtension 注销扩展 - 管理器方法代理
func (m *Manager) UnregisterExtension(docId string) error {
	return m.注销扩展(docId)
}

// CompileAndStartTask 编译并启动任务 - 管理器方法代理
func (m *Manager) CompileAndStartTask(docId string) error {
	return m.编译并启动任务(docId)
}

// StopTask 停止任务 - 管理器方法代理
func (m *Manager) StopTask(docId string) error {
	return m.停止任务(docId)
}

// RunNow 立即执行 - 管理器方法代理
func (m *Manager) RunNow(docId string) error {
	return m.立即执行(docId)
}

// ========== 编译器相关 ==========

// DocumentCompiler 文档编译器类型别名
type DocumentCompiler = 文档编译器

// NewDocumentCompiler 创建文档编译器的英文别名
var NewDocumentCompiler = 创建文档编译器

// Compile 编译文档 - 编译器方法代理
func (c *DocumentCompiler) Compile(docId string, targetLang string) (string, error) {
	return c.编译文档(docId, targetLang)
}

// ========== 存储相关 ==========

// GetCompileOutputDir 获取编译输出目录的英文别名
var GetCompileOutputDir = 获取编译输出目录

// SaveCompileResult 保存编译结果的英文别名
var SaveCompileResult = 保存编译结果

// GetExecutionLogs 获取执行记录的英文别名
var GetExecutionLogs = 获取执行记录

// ExecutionLog 任务执行记录类型别名
type ExecutionLog = 任务执行记录

// ========== 文件夹监听器相关 ==========

// ImageWatermarkWatcher 图片水印监听器类型别名
type ImageWatermarkWatcher = 图片水印监听器

// NewImageWatermarkWatcher 创建图片水印监听器的英文别名
var NewImageWatermarkWatcher = 创建图片水印监听器

// Start 开始监听 - 监听器方法代理
func (w *ImageWatermarkWatcher) Start() error {
	return w.开始()
}

// Stop 停止监听 - 监听器方法代理
func (w *ImageWatermarkWatcher) Stop() {
	w.停止()
}
