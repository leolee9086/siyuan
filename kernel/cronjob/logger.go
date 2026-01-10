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
// 本文件实现执行日志记录功能
package cronjob

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
)

// 执行日志记录器
type 执行日志记录器 struct {
	DocID     string    // 任务所属文档ID
	TaskName  string    // 任务名称
	StartTime time.Time // 执行开始时间
	Logs      []执行日志条目
	lock      sync.Mutex
}

// 执行日志条目
type 执行日志条目 struct {
	Time    time.Time `json:"time"`
	Level   string    `json:"level"` // info, warn, error
	Message string    `json:"message"`
}

// 创建执行日志记录器
func 创建执行日志记录器(docID, taskName string) *执行日志记录器 {
	return &执行日志记录器{
		DocID:     docID,
		TaskName:  taskName,
		StartTime: time.Now(),
		Logs:      make([]执行日志条目, 0),
	}
}

// 记录信息
func (l *执行日志记录器) 记录信息(msg string) {
	l.记录(执行日志条目{
		Time:    time.Now(),
		Level:   "info",
		Message: msg,
	})
}

// 记录警告
func (l *执行日志记录器) 记录警告(msg string) {
	l.记录(执行日志条目{
		Time:    time.Now(),
		Level:   "warn",
		Message: msg,
	})
}

// 记录错误
func (l *执行日志记录器) 记录错误(msg string) {
	l.记录(执行日志条目{
		Time:    time.Now(),
		Level:   "error",
		Message: msg,
	})
}

// 记录
func (l *执行日志记录器) 记录(entry 执行日志条目) {
	l.lock.Lock()
	defer l.lock.Unlock()
	l.Logs = append(l.Logs, entry)

	// 同时输出到系统日志
	switch entry.Level {
	case "warn":
		logging.LogWarnf("[CronJob %s] %s", l.TaskName, entry.Message)
	case "error":
		logging.LogErrorf("[CronJob %s] %s", l.TaskName, entry.Message)
	default:
		logging.LogInfof("[CronJob %s] %s", l.TaskName, entry.Message)
	}
}

// 生成Markdown日志
func (l *执行日志记录器) 生成Markdown日志(执行成功 bool, 错误信息 string) string {
	var sb strings.Builder

	// 执行状态
	状态 := "✅ 成功"
	if !执行成功 {
		状态 = "❌ 失败"
	}
	sb.WriteString(fmt.Sprintf("**状态**: %s\n\n", 状态))

	if 错误信息 != "" {
		sb.WriteString(fmt.Sprintf("**错误**: %s\n\n", 错误信息))
	}

	// 执行时长
	耗时 := time.Since(l.StartTime)
	sb.WriteString(fmt.Sprintf("**耗时**: %s\n\n", 耗时.Round(time.Millisecond)))

	// 日志条目
	if len(l.Logs) > 0 {
		sb.WriteString("### 详细日志\n\n")
		for _, entry := range l.Logs {
			时间戳 := entry.Time.Format("15:04:05.000")
			级别图标 := "ℹ️"
			switch entry.Level {
			case "warn":
				级别图标 = "⚠️"
			case "error":
				级别图标 = "❌"
			}
			sb.WriteString(fmt.Sprintf("- `%s` %s %s\n", 时间戳, 级别图标, entry.Message))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// 保存日志到 DailyNote
// 将日志追加到任务定义文档所在笔记本的每日笔记中
func (l *执行日志记录器) 保存日志到子文档(执行成功 bool, 错误信息 string) error {
	if GlobalAPIProvider == nil {
		logging.LogWarnf("[CronJob] 无法保存日志：API Provider 未设置")
		return nil
	}

	// 添加默认的开始和结束日志
	l.lock.Lock()
	// 在开头插入开始日志
	开始日志 := 执行日志条目{
		Time:    l.StartTime,
		Level:   "info",
		Message: "任务开始执行",
	}
	l.Logs = append([]执行日志条目{开始日志}, l.Logs...)
	// 在末尾添加结束日志
	if 执行成功 {
		l.Logs = append(l.Logs, 执行日志条目{
			Time:    time.Now(),
			Level:   "info",
			Message: "任务执行完成",
		})
	}
	l.lock.Unlock()

	// 获取任务文档所在的笔记本
	blockInfo, err := GlobalAPIProvider("/api/block/getBlockInfo", map[string]interface{}{
		"id": l.DocID,
	})
	if err != nil || blockInfo == nil {
		logging.LogWarnf("[CronJob] 无法获取文档信息: %v", err)
		return err
	}

	notebook, _ := blockInfo["box"].(string)
	if notebook == "" {
		logging.LogWarnf("[CronJob] 无法获取笔记本ID")
		return nil
	}

	// 生成 Markdown 日志内容
	markdown := l.生成DailyNote日志(执行成功, 错误信息)

	// 使用 appendDailyNoteBlock API 追加到当天的 DailyNote
	_, err = GlobalAPIProvider("/api/block/appendDailyNoteBlock", map[string]interface{}{
		"notebook": notebook,
		"data":     markdown,
		"dataType": "markdown",
	})

	if err != nil {
		logging.LogWarnf("[CronJob] 保存日志到 DailyNote 失败: %v", err)
		return err
	}

	logging.LogInfof("[CronJob] 日志已保存到 DailyNote: %s", l.TaskName)
	return nil
}

// 生成DailyNote日志 生成适合追加到 DailyNote 的 Markdown 格式日志
func (l *执行日志记录器) 生成DailyNote日志(执行成功 bool, 错误信息 string) string {
	var sb strings.Builder

	// 标题：任务名称 + 时间
	sb.WriteString(fmt.Sprintf("### 🕐 %s - %s\n\n", l.TaskName, l.StartTime.Format("15:04:05")))

	// 执行状态
	状态 := "✅ 成功"
	if !执行成功 {
		状态 = "❌ 失败"
	}

	// 执行时长
	耗时 := time.Since(l.StartTime)
	sb.WriteString(fmt.Sprintf("**状态**: %s · **耗时**: %s\n\n", 状态, 耗时.Round(time.Millisecond)))

	if 错误信息 != "" {
		sb.WriteString(fmt.Sprintf("> ⚠️ **错误**: %s\n\n", 错误信息))
	}

	// 日志条目（使用引用块格式，避免 HTML 兼容性问题）
	if len(l.Logs) > 0 {
		sb.WriteString("**详细日志**:\n\n")
		for _, entry := range l.Logs {
			时间戳 := entry.Time.Format("15:04:05.000")
			级别图标 := "ℹ️"
			switch entry.Level {
			case "warn":
				级别图标 = "⚠️"
			case "error":
				级别图标 = "❌"
			}
			sb.WriteString(fmt.Sprintf("> `%s` %s %s\n", 时间戳, 级别图标, entry.Message))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}
