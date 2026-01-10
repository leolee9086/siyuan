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

// 扩展配置列表 用于 JSON 序列化
type 扩展配置列表 struct {
	扩展列表 []*扩展配置 `json:"extensions"`
}

var 存储锁 = sync.Mutex{}

// 获取配置文件路径 获取 extensions.json 的完整路径
func 获取配置文件路径() string {
	return filepath.Join(util.ConfDir, "extensions.json")
}

// 获取编译输出目录 获取编译产物的存储目录
func 获取编译输出目录() string {
	return filepath.Join(util.TempDir, "extensions")
}

// 确保目录存在 确保指定目录存在
func 确保目录存在(目录 string) error {
	if !gulu.File.IsDir(目录) {
		return os.MkdirAll(目录, 0755)
	}
	return nil
}

// 加载扩展配置列表 从文件加载扩展配置
func 加载扩展配置列表() (map[string]*扩展配置, error) {
	存储锁.Lock()
	defer 存储锁.Unlock()

	配置路径 := 获取配置文件路径()
	结果 := make(map[string]*扩展配置)

	// 文件不存在则返回空配置
	if !gulu.File.IsExist(配置路径) {
		return 结果, nil
	}

	// 读取文件
	数据, err := os.ReadFile(配置路径)
	if err != nil {
		logging.LogErrorf("读取扩展配置失败: %s", err)
		return 结果, err
	}

	// 解析 JSON
	var 配置列表 扩展配置列表
	if err := gulu.JSON.UnmarshalJSON(数据, &配置列表); err != nil {
		logging.LogErrorf("解析扩展配置失败: %s", err)
		return 结果, err
	}

	// 转换为 map
	for _, 配置 := range 配置列表.扩展列表 {
		结果[配置.文档ID] = 配置
	}

	return 结果, nil
}

// 保存扩展配置列表 保存扩展配置到文件
func 保存扩展配置列表(配置表 map[string]*扩展配置) error {
	存储锁.Lock()
	defer 存储锁.Unlock()

	// 确保目录存在
	if err := 确保目录存在(util.ConfDir); err != nil {
		return err
	}

	// 转换为列表
	配置列表 := 扩展配置列表{
		扩展列表: make([]*扩展配置, 0, len(配置表)),
	}
	for _, 配置 := range 配置表 {
		配置列表.扩展列表 = append(配置列表.扩展列表, 配置)
	}

	// 序列化
	数据, err := gulu.JSON.MarshalIndentJSON(配置列表, "", "  ")
	if err != nil {
		logging.LogErrorf("序列化扩展配置失败: %s", err)
		return err
	}

	// 写入文件
	配置路径 := 获取配置文件路径()
	if err := os.WriteFile(配置路径, 数据, 0644); err != nil {
		logging.LogErrorf("保存扩展配置失败: %s", err)
		return err
	}

	logging.LogInfof("扩展配置已保存: %s", 配置路径)
	return nil
}

// 保存编译结果 保存编译后的代码到 temp/extensions/
func 保存编译结果(文档ID string, 代码 string) error {
	输出目录 := 获取编译输出目录()
	if err := 确保目录存在(输出目录); err != nil {
		return err
	}

	文件路径 := filepath.Join(输出目录, 文档ID+".go")
	return os.WriteFile(文件路径, []byte(代码), 0644)
}

// 读取编译结果 读取之前编译的代码
func 读取编译结果(文档ID string) (string, error) {
	文件路径 := filepath.Join(获取编译输出目录(), 文档ID+".go")
	数据, err := os.ReadFile(文件路径)
	if err != nil {
		return "", err
	}
	return string(数据), nil
}

// 删除编译结果 删除编译产物
func 删除编译结果(文档ID string) error {
	文件路径 := filepath.Join(获取编译输出目录(), 文档ID+".go")
	if gulu.File.IsExist(文件路径) {
		return os.Remove(文件路径)
	}
	return nil
}

// 任务执行记录 记录任务执行历史
type 任务执行记录 struct {
	文档ID string `json:"docId"`
	执行时间 int64  `json:"executedAt"`
	是否成功 bool   `json:"success"`
	错误信息 string `json:"error,omitempty"`
	耗时毫秒 int64  `json:"durationMs"`
}

// 任务日志存储 用于序列化
type 任务日志存储 struct {
	记录列表 []任务执行记录 `json:"logs"`
}

// 获取日志文件路径 获取任务执行日志的存储路径
func 获取日志文件路径() string {
	return filepath.Join(util.TempDir, "extensions", "execution_logs.json")
}

// 追加执行记录 追加任务执行记录
func 追加执行记录(记录 任务执行记录) error {
	存储锁.Lock()
	defer 存储锁.Unlock()

	// 确保目录存在
	if err := 确保目录存在(获取编译输出目录()); err != nil {
		return err
	}

	// 读取现有记录
	日志路径 := 获取日志文件路径()
	var 日志存储 任务日志存储

	if gulu.File.IsExist(日志路径) {
		数据, err := os.ReadFile(日志路径)
		if err == nil {
			gulu.JSON.UnmarshalJSON(数据, &日志存储)
		}
	}

	// 追加新记录（保留最近 1000 条）
	日志存储.记录列表 = append(日志存储.记录列表, 记录)
	if len(日志存储.记录列表) > 1000 {
		日志存储.记录列表 = 日志存储.记录列表[len(日志存储.记录列表)-1000:]
	}

	// 保存
	数据, err := gulu.JSON.MarshalJSON(日志存储)
	if err != nil {
		return err
	}
	return os.WriteFile(日志路径, 数据, 0644)
}

// 获取执行记录 获取指定任务的执行记录
func 获取执行记录(文档ID string, 数量 int) []任务执行记录 {
	存储锁.Lock()
	defer 存储锁.Unlock()

	日志路径 := 获取日志文件路径()
	var 日志存储 任务日志存储

	if !gulu.File.IsExist(日志路径) {
		return nil
	}

	数据, err := os.ReadFile(日志路径)
	if err != nil {
		return nil
	}
	if err := gulu.JSON.UnmarshalJSON(数据, &日志存储); err != nil {
		return nil
	}

	// 筛选指定任务的记录
	var 结果 []任务执行记录
	for i := len(日志存储.记录列表) - 1; i >= 0 && len(结果) < 数量; i-- {
		if 日志存储.记录列表[i].文档ID == 文档ID {
			结果 = append(结果, 日志存储.记录列表[i])
		}
	}

	return 结果
}
