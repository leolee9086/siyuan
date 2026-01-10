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

// 扩展配置 记录在 conf/extensions.json 中的扩展注册信息
type 扩展配置 struct {
	文档ID string `json:"docId"`   // 扩展所在的文档ID
	扩展语言 string `json:"extLang"` // 编译语言，如 "go"
	扩展类型 string `json:"extType"` // 扩展类型，如 "cronjob"
	是否启用 bool   `json:"enabled"` // 是否启用
	创建时间 int64  `json:"created"` // 注册时间戳
	更新时间 int64  `json:"updated"` // 更新时间戳
}

// 任务运行时信息 运行时的任务状态信息
type 任务运行时信息 struct {
	文档ID  string `json:"docId"`
	任务名称  string `json:"name"`
	调度表达式 string `json:"schedule"`
	任务描述  string `json:"description"`
	任务状态  string `json:"status"`
	上次运行  int64  `json:"lastRun"`
	下次运行  int64  `json:"nextRun"`
	上次错误  string `json:"lastError"`
	运行次数  int64  `json:"runCount"`
}

// 定时任务上下文 传递给任务执行函数的上下文信息
type 定时任务上下文 struct {
	文档ID string                 // 任务所属文档ID
	任务名称 string                 // 任务名称
	执行时间 time.Time              // 本次执行开始时间
	配置参数 map[string]interface{} // 额外配置参数
	日志函数 func(string)           // 日志记录函数
}

// 定时任务处理器 由动态代码导出的任务执行函数签名
type 定时任务处理器 func(ctx *定时任务上下文) error

// 任务实例 运行时的任务实例
type 任务实例 struct {
	配置   扩展配置
	运行信息 任务运行时信息
	处理器  定时任务处理器
	停止信号 chan struct{}
	锁    sync.Mutex
}

// 管理器 定时任务管理器
type 管理器 struct {
	任务表   map[string]*任务实例
	扩展配置  map[string]*扩展配置
	脚本执行器 *脚本执行器
	锁     sync.RWMutex
	已初始化  bool
}

var (
	全局管理器 *管理器
	初始化锁  sync.Once
)

// 获取管理器 获取全局单例管理器
func 获取管理器() *管理器 {
	初始化锁.Do(func() {
		全局管理器 = &管理器{
			任务表:  make(map[string]*任务实例),
			扩展配置: make(map[string]*扩展配置),
		}
	})
	return 全局管理器
}

// 初始化 初始化管理器，加载配置并启动已启用的任务
func (m *管理器) 初始化() error {
	m.锁.Lock()
	defer m.锁.Unlock()

	if m.已初始化 {
		return nil
	}

	// 创建脚本执行器
	var err error
	m.脚本执行器, err = 创建脚本执行器()
	if err != nil {
		return err
	}

	// 加载扩展配置
	if err := m.加载扩展配置(); err != nil {
		return err
	}

	// 编译并启动所有已启用的扩展
	for _, 配置 := range m.扩展配置 {
		if 配置.是否启用 && 配置.扩展类型 == 扩展类型_定时任务 {
			if err := m.编译并启动任务(配置.文档ID); err != nil {
				// 记录错误但不中断启动
				继续 := true
				_ = 继续
			}
		}
	}

	m.已初始化 = true
	return nil
}

// 加载扩展配置 从 conf/extensions.json 加载配置
func (m *管理器) 加载扩展配置() error {
	// TODO: 从文件加载配置
	return nil
}

// 保存扩展配置 保存配置到 conf/extensions.json
func (m *管理器) 保存扩展配置() error {
	// TODO: 保存配置到文件
	return nil
}

// 注册扩展 注册一个新的扩展文档
func (m *管理器) 注册扩展(文档ID string, 扩展语言 string, 扩展类型 string) error {
	m.锁.Lock()
	defer m.锁.Unlock()

	当前时间 := time.Now().Unix()
	m.扩展配置[文档ID] = &扩展配置{
		文档ID: 文档ID,
		扩展语言: 扩展语言,
		扩展类型: 扩展类型,
		是否启用: false,
		创建时间: 当前时间,
		更新时间: 当前时间,
	}

	return m.保存扩展配置()
}

// 注销扩展 注销一个扩展文档
func (m *管理器) 注销扩展(文档ID string) error {
	m.锁.Lock()
	defer m.锁.Unlock()

	// 先停止任务
	if 任务, 存在 := m.任务表[文档ID]; 存在 {
		close(任务.停止信号)
		delete(m.任务表, 文档ID)
	}

	delete(m.扩展配置, 文档ID)
	return m.保存扩展配置()
}

// 编译并启动任务 编译文档中的代码并启动任务
func (m *管理器) 编译并启动任务(文档ID string) error {
	配置, 存在 := m.扩展配置[文档ID]
	if !存在 {
		return nil
	}

	// 编译文档
	编译结果, err := m.脚本执行器.编译文档(文档ID)
	if err != nil {
		return err
	}

	// 加载并执行编译后的代码，获取导出的变量
	导出变量, err := m.脚本执行器.加载代码(编译结果)
	if err != nil {
		return err
	}

	// 获取必需的导出变量
	任务名称, _ := 导出变量["Name"].(string)
	调度表达式, _ := 导出变量["Schedule"].(string)
	任务描述, _ := 导出变量["Description"].(string)
	处理器, _ := 导出变量["Run"].(定时任务处理器)

	if 处理器 == nil {
		return nil // 没有 Run 函数，跳过
	}

	// 创建任务实例
	任务 := &任务实例{
		配置: *配置,
		运行信息: 任务运行时信息{
			文档ID:  文档ID,
			任务名称:  任务名称,
			调度表达式: 调度表达式,
			任务描述:  任务描述,
			任务状态:  任务状态_未运行,
		},
		处理器:  处理器,
		停止信号: make(chan struct{}),
	}

	m.任务表[文档ID] = 任务

	// 启动任务
	go m.运行任务循环(任务)

	return nil
}

// 运行任务循环 定时执行任务
func (m *管理器) 运行任务循环(任务 *任务实例) {
	// TODO: 解析 cron 表达式，计算下次执行时间
	// 暂时使用简单的间隔执行
	间隔 := 1 * time.Minute

	定时器 := time.NewTicker(间隔)
	defer 定时器.Stop()

	for {
		select {
		case <-任务.停止信号:
			return
		case <-定时器.C:
			m.执行任务(任务)
		}
	}
}

// 执行任务 执行一次任务
func (m *管理器) 执行任务(任务 *任务实例) {
	任务.锁.Lock()
	任务.运行信息.任务状态 = 任务状态_运行中
	任务.运行信息.上次运行 = time.Now().Unix()
	任务.锁.Unlock()

	ctx := &定时任务上下文{
		文档ID: 任务.配置.文档ID,
		任务名称: 任务.运行信息.任务名称,
		执行时间: time.Now(),
		日志函数: func(msg string) {
			// TODO: 记录日志
		},
	}

	err := 任务.处理器(ctx)

	任务.锁.Lock()
	if err != nil {
		任务.运行信息.任务状态 = 任务状态_出错
		任务.运行信息.上次错误 = err.Error()
	} else {
		任务.运行信息.任务状态 = 任务状态_未运行
		任务.运行信息.上次错误 = ""
	}
	任务.运行信息.运行次数++
	任务.锁.Unlock()
}

// 停止任务 停止指定任务
func (m *管理器) 停止任务(文档ID string) error {
	m.锁.Lock()
	defer m.锁.Unlock()

	if 任务, 存在 := m.任务表[文档ID]; 存在 {
		close(任务.停止信号)
		delete(m.任务表, 文档ID)
	}
	return nil
}

// 获取所有任务 获取所有已注册任务的运行信息
func (m *管理器) 获取所有任务() []任务运行时信息 {
	m.锁.RLock()
	defer m.锁.RUnlock()

	结果 := make([]任务运行时信息, 0, len(m.任务表))
	for _, 任务 := range m.任务表 {
		结果 = append(结果, 任务.运行信息)
	}
	return 结果
}

// 获取任务 获取指定任务的运行信息
func (m *管理器) 获取任务(文档ID string) *任务运行时信息 {
	m.锁.RLock()
	defer m.锁.RUnlock()

	if 任务, 存在 := m.任务表[文档ID]; 存在 {
		副本 := 任务.运行信息
		return &副本
	}
	return nil
}

// 立即执行 立即执行指定任务（不等待调度）
func (m *管理器) 立即执行(文档ID string) error {
	m.锁.RLock()
	任务, 存在 := m.任务表[文档ID]
	m.锁.RUnlock()

	if !存在 {
		return nil
	}

	go m.执行任务(任务)
	return nil
}
