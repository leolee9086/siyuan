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
// 本文件实现安全鉴权机制
package cronjob

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// 鉴权错误类型
var (
	ErrAuthDenied     = errors.New("用户拒绝了任务执行授权")
	ErrAuthTimeout    = errors.New("等待用户授权超时")
	ErrAuthNoFrontend = errors.New("没有可用的前端连接来进行授权交互")
)

// 鉴权管理器
type 鉴权管理器 struct {
	// 已授权的文档ID缓存 (内核生命周期内有效)
	已授权会话 map[string]bool

	// 机器密钥 (用于生成/验证 AuthCode)
	机器密钥 []byte

	// 等待中的鉴权请求
	等待中请求 map[string]chan bool

	lock sync.RWMutex
}

// 全局鉴权管理器实例
var (
	全局鉴权管理器  *鉴权管理器
	鉴权管理器初始化 sync.Once
)

// 获取鉴权管理器 返回全局单例鉴权管理器
func 获取鉴权管理器() *鉴权管理器 {
	鉴权管理器初始化.Do(func() {
		全局鉴权管理器 = &鉴权管理器{
			已授权会话: make(map[string]bool),
			等待中请求: make(map[string]chan bool),
		}
		全局鉴权管理器.加载或生成机器密钥()
	})
	return 全局鉴权管理器
}

// 加载或生成机器密钥
func (m *鉴权管理器) 加载或生成机器密钥() {
	secretPath := filepath.Join(util.ConfDir, "cronjob_secret.json")

	// 尝试加载现有密钥
	if gulu.File.IsExist(secretPath) {
		data, err := os.ReadFile(secretPath)
		if err == nil {
			var secretData struct {
				Secret string `json:"secret"`
			}
			if json.Unmarshal(data, &secretData) == nil && secretData.Secret != "" {
				m.机器密钥, _ = hex.DecodeString(secretData.Secret)
				if len(m.机器密钥) == 32 {
					logging.LogInfof("[CronJob Auth] 已加载机器密钥")
					return
				}
			}
		}
	}

	// 生成新密钥
	m.机器密钥 = make([]byte, 32)
	if _, err := rand.Read(m.机器密钥); err != nil {
		logging.LogErrorf("[CronJob Auth] 生成机器密钥失败: %v", err)
		return
	}

	// 保存密钥
	secretData := struct {
		Secret  string `json:"secret"`
		Created int64  `json:"created"`
	}{
		Secret:  hex.EncodeToString(m.机器密钥),
		Created: time.Now().Unix(),
	}

	data, _ := json.MarshalIndent(secretData, "", "  ")
	if err := os.WriteFile(secretPath, data, 0600); err != nil {
		logging.LogErrorf("[CronJob Auth] 保存机器密钥失败: %v", err)
	} else {
		logging.LogInfof("[CronJob Auth] 已生成并保存新机器密钥")
	}
}

// 生成鉴权码 根据文档ID生成绑定到本机的AuthCode
func (m *鉴权管理器) 生成鉴权码(文档ID string) string {
	if len(m.机器密钥) == 0 {
		return ""
	}

	h := hmac.New(sha256.New, m.机器密钥)
	h.Write([]byte(文档ID))
	return hex.EncodeToString(h.Sum(nil))
}

// 验证鉴权码 检查AuthCode是否有效
func (m *鉴权管理器) 验证鉴权码(文档ID string, 鉴权码 string) bool {
	if 鉴权码 == "" || len(m.机器密钥) == 0 {
		return false
	}

	期望值 := m.生成鉴权码(文档ID)
	return hmac.Equal([]byte(期望值), []byte(鉴权码))
}

// 是否已授权 检查文档ID是否已在当前会话中授权
func (m *鉴权管理器) 是否已授权(文档ID string) bool {
	m.lock.RLock()
	defer m.lock.RUnlock()
	return m.已授权会话[文档ID]
}

// 标记已授权 将文档ID标记为已授权
func (m *鉴权管理器) 标记已授权(文档ID string) {
	m.lock.Lock()
	defer m.lock.Unlock()
	m.已授权会话[文档ID] = true
	logging.LogInfof("[CronJob Auth] 文档 %s 已授权", 文档ID)
}

// 请求鉴权 发起交互式鉴权请求
// 返回：是否授权成功，错误信息
func (m *鉴权管理器) 请求鉴权(文档ID string, 任务名称 string, 原因 string) (bool, error) {
	// 1. 检查是否已授权
	if m.是否已授权(文档ID) {
		return true, nil
	}

	// 2. 生成请求ID
	请求ID := gulu.Rand.String(16)

	// 3. 创建等待通道
	响应通道 := make(chan bool, 1)
	m.lock.Lock()
	m.等待中请求[请求ID] = 响应通道
	m.lock.Unlock()

	defer func() {
		m.lock.Lock()
		delete(m.等待中请求, 请求ID)
		m.lock.Unlock()
	}()

	// 4. 发送鉴权请求到前端
	if err := m.发送鉴权请求到前端(请求ID, 文档ID, 任务名称, 原因); err != nil {
		return false, err
	}

	// 5. 等待响应 (超时30秒)
	select {
	case 允许 := <-响应通道:
		if 允许 {
			m.标记已授权(文档ID)
			return true, nil
		}
		return false, ErrAuthDenied
	case <-time.After(30 * time.Second):
		return false, ErrAuthTimeout
	}
}

// 处理鉴权响应 处理来自前端的鉴权响应
func (m *鉴权管理器) 处理鉴权响应(请求ID string, 允许 bool) {
	m.lock.RLock()
	通道, ok := m.等待中请求[请求ID]
	m.lock.RUnlock()

	if ok {
		select {
		case 通道 <- 允许:
		default:
		}
	}
}

// 发送鉴权请求到前端 通过WebSocket发送鉴权请求
func (m *鉴权管理器) 发送鉴权请求到前端(请求ID, 文档ID, 任务名称, 原因 string) error {
	// 使用 util.BroadcastByType 发送消息
	msg := map[string]interface{}{
		"reqId":    请求ID,
		"docId":    文档ID,
		"taskName": 任务名称,
		"reason":   原因,
	}

	util.BroadcastByType("main", "cronjob_auth_request", 0, "", msg)
	logging.LogInfof("[CronJob Auth] 已发送鉴权请求: %s (文档: %s, 任务: %s)", 请求ID, 文档ID, 任务名称)
	return nil
}

// CheckAuthForAPICall 检查API调用的鉴权状态
// 这是供 API Provider 调用的主入口
func CheckAuthForAPICall(文档ID string, 任务名称 string) error {
	mgr := 获取鉴权管理器()

	// 已授权直接放行
	if mgr.是否已授权(文档ID) {
		return nil
	}

	// 发起交互鉴权
	允许, err := mgr.请求鉴权(文档ID, 任务名称, "定时任务请求执行 API 调用")
	if err != nil {
		return err
	}

	if !允许 {
		return ErrAuthDenied
	}

	return nil
}

// CheckAuthWithCode 检查带有AuthCode的鉴权
// 如果提供了有效的AuthCode，自动授权
func CheckAuthWithCode(文档ID string, 鉴权码 string) bool {
	mgr := 获取鉴权管理器()

	// 已授权
	if mgr.是否已授权(文档ID) {
		return true
	}

	// 验证鉴权码
	if mgr.验证鉴权码(文档ID, 鉴权码) {
		mgr.标记已授权(文档ID)
		logging.LogInfof("[CronJob Auth] 文档 %s 通过 AuthCode 验证", 文档ID)
		return true
	}

	return false
}

// GenerateAuthCode 为指定文档生成AuthCode
func GenerateAuthCode(文档ID string) string {
	mgr := 获取鉴权管理器()
	return mgr.生成鉴权码(文档ID)
}

// HandleAuthResponse 处理前端发来的鉴权响应
// 供 WebSocket 命令处理器调用
func HandleAuthResponse(请求ID string, 允许 bool) {
	mgr := 获取鉴权管理器()
	mgr.处理鉴权响应(请求ID, 允许)
}

// CheckAuthForSensitiveOp 检查敏感操作的鉴权状态
// 操作类型: file_read, file_write, file_delete, command_exec, network_request
// 目标: 文件路径、命令、URL 等
func CheckAuthForSensitiveOp(文档ID string, 任务名称 string, 操作类型 string, 目标 string) error {
	mgr := 获取鉴权管理器()

	// 已授权直接放行
	if mgr.是否已授权(文档ID) {
		return nil
	}

	// 构造可读的原因描述
	原因 := 构造敏感操作描述(操作类型, 目标)

	// 发起交互鉴权
	允许, err := mgr.请求鉴权_扩展(文档ID, 任务名称, 原因, 操作类型, 目标)
	if err != nil {
		return err
	}

	if !允许 {
		return ErrAuthDenied
	}

	return nil
}

// 构造敏感操作描述
func 构造敏感操作描述(操作类型 string, 目标 string) string {
	switch 操作类型 {
	case "file_read":
		return "读取文件: " + 目标
	case "file_write":
		return "写入文件: " + 目标
	case "file_delete":
		return "删除文件: " + 目标
	case "command_exec":
		return "执行命令: " + 目标
	case "network_request":
		return "网络请求: " + 目标
	default:
		return "敏感操作: " + 目标
	}
}

// 请求鉴权_扩展 发起包含操作类型的交互式鉴权请求
func (m *鉴权管理器) 请求鉴权_扩展(文档ID string, 任务名称 string, 原因 string, 操作类型 string, 目标 string) (bool, error) {
	// 1. 检查是否已授权
	if m.是否已授权(文档ID) {
		return true, nil
	}

	// 2. 生成请求ID
	请求ID := gulu.Rand.String(16)

	// 3. 创建等待通道
	响应通道 := make(chan bool, 1)
	m.lock.Lock()
	m.等待中请求[请求ID] = 响应通道
	m.lock.Unlock()

	defer func() {
		m.lock.Lock()
		delete(m.等待中请求, 请求ID)
		m.lock.Unlock()
	}()

	// 4. 发送鉴权请求到前端（包含操作类型和目标）
	msg := map[string]interface{}{
		"reqId":    请求ID,
		"docId":    文档ID,
		"taskName": 任务名称,
		"reason":   原因,
		"opType":   操作类型,
		"target":   目标,
	}

	util.BroadcastByType("main", "cronjob_auth_request", 0, "", msg)
	logging.LogInfof("[CronJob Auth] 已发送敏感操作鉴权请求: %s (文档: %s, 任务: %s, 操作: %s)", 请求ID, 文档ID, 任务名称, 操作类型)

	// 5. 等待响应 (超时30秒)
	select {
	case 允许 := <-响应通道:
		if 允许 {
			m.标记已授权(文档ID)
			return true, nil
		}
		return false, ErrAuthDenied
	case <-time.After(30 * time.Second):
		return false, ErrAuthTimeout
	}
}
