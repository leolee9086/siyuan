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

package cronjob

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/88250/gulu"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// ExtensionConfigList 用于 JSON 序列化
type ExtensionConfigList struct {
	Extensions []*ExtensionConfig `json:"extensions"`
}

var StorageLock = sync.Mutex{}

// GetConfigFilePath 获取 extensions.json 的完整路径
func GetConfigFilePath() string {
	return filepath.Join(util.ConfDir, "extensions.json")
}

// GetCompileOutputDir 获取编译产物的存储目录
func GetCompileOutputDir() string {
	return filepath.Join(util.TempDir, "extensions")
}

// EnsureDir 确保指定目录存在
func EnsureDir(dir string) error {
	if !gulu.File.IsDir(dir) {
		return os.MkdirAll(dir, 0755)
	}
	return nil
}

// LoadExtensionConfigList 从文件加载扩展配置
func LoadExtensionConfigList() (map[string]*ExtensionConfig, error) {
	StorageLock.Lock()
	defer StorageLock.Unlock()

	configPath := GetConfigFilePath()
	result := make(map[string]*ExtensionConfig)

	// 文件不存在则返回空配置
	if !gulu.File.IsExist(configPath) {
		return result, nil
	}

	// 读取文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		logging.LogErrorf("读取扩展配置失败: %s", err)
		return result, err
	}

	// 解析 JSON
	var configList ExtensionConfigList
	if err := gulu.JSON.UnmarshalJSON(data, &configList); err != nil {
		logging.LogErrorf("解析扩展配置失败: %s", err)
		return result, err
	}

	// 转换为 map
	for _, config := range configList.Extensions {
		result[config.ID] = config
	}

	return result, nil
}

// SaveExtensionConfigList 保存扩展配置到文件
func SaveExtensionConfigList(configMap map[string]*ExtensionConfig) error {
	StorageLock.Lock()
	defer StorageLock.Unlock()

	// 确保目录存在
	if err := EnsureDir(util.ConfDir); err != nil {
		return err
	}

	// 转换为列表
	configList := ExtensionConfigList{
		Extensions: make([]*ExtensionConfig, 0, len(configMap)),
	}
	for _, config := range configMap {
		configList.Extensions = append(configList.Extensions, config)
	}

	// 序列化
	data, err := gulu.JSON.MarshalIndentJSON(configList, "", "  ")
	if err != nil {
		logging.LogErrorf("序列化扩展配置失败: %s", err)
		return err
	}

	// 写入文件
	configPath := GetConfigFilePath()
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		logging.LogErrorf("保存扩展配置失败: %s", err)
		return err
	}

	logging.LogInfof("扩展配置已保存: %s", configPath)
	return nil
}

// SaveCompileResult 保存编译后的代码到 temp/extensions/
func SaveCompileResult(docID string, code string) error {
	outputDir := GetCompileOutputDir()
	if err := EnsureDir(outputDir); err != nil {
		return err
	}

	filePath := filepath.Join(outputDir, docID+".go")
	return os.WriteFile(filePath, []byte(code), 0644)
}

// ReadCompileResult 读取之前编译的代码
func ReadCompileResult(docID string) (string, error) {
	filePath := filepath.Join(GetCompileOutputDir(), docID+".go")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// DeleteCompileResult 删除编译产物
func DeleteCompileResult(docID string) error {
	filePath := filepath.Join(GetCompileOutputDir(), docID+".go")
	if gulu.File.IsExist(filePath) {
		return os.Remove(filePath)
	}
	return nil
}

// ExecutionRecord 记录任务执行历史
type ExecutionRecord struct {
	DocID      string `json:"docId"`
	ExecutedAt int64  `json:"executedAt"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	DurationMs int64  `json:"durationMs"`
}

// ExecutionLogStorage 用于序列化
type ExecutionLogStorage struct {
	Records []ExecutionRecord `json:"logs"`
}

// GetLogFilePath 获取任务执行日志的存储路径
func GetLogFilePath() string {
	return filepath.Join(util.TempDir, "extensions", "execution_logs.json")
}

// AppendExecutionRecord 追加任务执行记录
func AppendExecutionRecord(record ExecutionRecord) error {
	StorageLock.Lock()
	defer StorageLock.Unlock()

	// 确保目录存在
	if err := EnsureDir(GetCompileOutputDir()); err != nil {
		return err
	}

	// 读取现有记录
	logPath := GetLogFilePath()
	var logStorage ExecutionLogStorage

	if gulu.File.IsExist(logPath) {
		data, err := os.ReadFile(logPath)
		if err == nil {
			gulu.JSON.UnmarshalJSON(data, &logStorage)
		}
	}

	// 追加新记录（保留最近 1000 条）
	logStorage.Records = append(logStorage.Records, record)
	if len(logStorage.Records) > 1000 {
		logStorage.Records = logStorage.Records[len(logStorage.Records)-1000:]
	}

	// 保存
	data, err := gulu.JSON.MarshalJSON(logStorage)
	if err != nil {
		return err
	}
	return os.WriteFile(logPath, data, 0644)
}

// GetExecutionRecords 获取指定任务的执行记录
func GetExecutionRecords(docID string, count int) []ExecutionRecord {
	StorageLock.Lock()
	defer StorageLock.Unlock()

	logPath := GetLogFilePath()
	var logStorage ExecutionLogStorage

	if !gulu.File.IsExist(logPath) {
		return nil
	}

	data, err := os.ReadFile(logPath)
	if err != nil {
		return nil
	}
	if err := gulu.JSON.UnmarshalJSON(data, &logStorage); err != nil {
		return nil
	}

	// 筛选指定任务的记录
	var result []ExecutionRecord
	for i := len(logStorage.Records) - 1; i >= 0 && len(result) < count; i-- {
		if logStorage.Records[i].DocID == docID {
			result = append(result, logStorage.Records[i])
		}
	}

	return result
}
