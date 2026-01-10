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
// 本文件实现受限标准库包装，对敏感操作进行鉴权拦截
package cronjob

import (
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/traefik/yaegi/interp"
)

// 当前执行上下文（用于鉴权时获取 DocID）
// 在每次任务执行前设置
var 当前执行上下文 *Context

// 设置当前执行上下文
func 设置当前执行上下文(ctx *Context) {
	当前执行上下文 = ctx
}

// 清除当前执行上下文
func 清除当前执行上下文() {
	当前执行上下文 = nil
}

// 鉴权操作类型
const (
	鉴权类型_文件读取 = "file_read"
	鉴权类型_文件写入 = "file_write"
	鉴权类型_文件删除 = "file_delete"
	鉴权类型_命令执行 = "command_exec"
	鉴权类型_网络请求 = "network_request"
)

// 检查文件操作鉴权
func 检查文件操作鉴权(操作类型 string, 路径 string) error {
	if 当前执行上下文 == nil {
		return ErrAuthDenied
	}

	// 检查是否为安全路径（工作空间内）
	if 是安全路径(路径) {
		return nil // 工作空间内的路径不需要额外鉴权
	}

	// 工作空间外的路径需要用户确认
	return CheckAuthForSensitiveOp(
		当前执行上下文.DocID,
		当前执行上下文.Name,
		操作类型,
		路径,
	)
}

// 检查命令执行鉴权
func 检查命令执行鉴权(命令 string, 参数 []string) error {
	if 当前执行上下文 == nil {
		return ErrAuthDenied
	}

	完整命令 := 命令 + " " + strings.Join(参数, " ")
	return CheckAuthForSensitiveOp(
		当前执行上下文.DocID,
		当前执行上下文.Name,
		鉴权类型_命令执行,
		完整命令,
	)
}

// 检查网络请求鉴权
func 检查网络请求鉴权(url string) error {
	if 当前执行上下文 == nil {
		return ErrAuthDenied
	}

	return CheckAuthForSensitiveOp(
		当前执行上下文.DocID,
		当前执行上下文.Name,
		鉴权类型_网络请求,
		url,
	)
}

// 是安全路径 检查路径是否在工作空间内
func 是安全路径(路径 string) bool {
	绝对路径, err := filepath.Abs(路径)
	if err != nil {
		return false
	}

	// 检查是否在工作空间目录下
	if strings.HasPrefix(绝对路径, util.WorkspaceDir) {
		return true
	}

	// 检查是否在数据目录下
	if strings.HasPrefix(绝对路径, util.DataDir) {
		return true
	}

	// 检查是否在临时目录下
	if strings.HasPrefix(绝对路径, util.TempDir) {
		return true
	}

	return false
}

// ========== 受限文件操作 ==========

// 安全读取文件
func 安全读取文件(路径 string) ([]byte, error) {
	if err := 检查文件操作鉴权(鉴权类型_文件读取, 路径); err != nil {
		logging.LogWarnf("[CronJob] 文件读取被拒绝: %s, 错误: %v", 路径, err)
		return nil, err
	}
	return os.ReadFile(路径)
}

// 安全写入文件
func 安全写入文件(路径 string, 数据 []byte, 权限 fs.FileMode) error {
	if err := 检查文件操作鉴权(鉴权类型_文件写入, 路径); err != nil {
		logging.LogWarnf("[CronJob] 文件写入被拒绝: %s, 错误: %v", 路径, err)
		return err
	}
	return os.WriteFile(路径, 数据, 权限)
}

// 安全删除文件
func 安全删除文件(路径 string) error {
	if err := 检查文件操作鉴权(鉴权类型_文件删除, 路径); err != nil {
		logging.LogWarnf("[CronJob] 文件删除被拒绝: %s, 错误: %v", 路径, err)
		return err
	}
	return os.Remove(路径)
}

// 安全删除目录
func 安全删除目录(路径 string) error {
	if err := 检查文件操作鉴权(鉴权类型_文件删除, 路径); err != nil {
		logging.LogWarnf("[CronJob] 目录删除被拒绝: %s, 错误: %v", 路径, err)
		return err
	}
	return os.RemoveAll(路径)
}

// 安全打开文件
func 安全打开文件(路径 string) (*os.File, error) {
	if err := 检查文件操作鉴权(鉴权类型_文件读取, 路径); err != nil {
		logging.LogWarnf("[CronJob] 文件打开被拒绝: %s, 错误: %v", 路径, err)
		return nil, err
	}
	return os.Open(路径)
}

// 安全创建文件
func 安全创建文件(路径 string) (*os.File, error) {
	if err := 检查文件操作鉴权(鉴权类型_文件写入, 路径); err != nil {
		logging.LogWarnf("[CronJob] 文件创建被拒绝: %s, 错误: %v", 路径, err)
		return nil, err
	}
	return os.Create(路径)
}

// 安全打开文件_完整 OpenFile 的安全包装
func 安全打开文件_完整(路径 string, 标志 int, 权限 fs.FileMode) (*os.File, error) {
	操作类型 := 鉴权类型_文件读取
	if 标志&(os.O_WRONLY|os.O_RDWR|os.O_CREATE|os.O_APPEND|os.O_TRUNC) != 0 {
		操作类型 = 鉴权类型_文件写入
	}
	if err := 检查文件操作鉴权(操作类型, 路径); err != nil {
		logging.LogWarnf("[CronJob] 文件操作被拒绝: %s, 错误: %v", 路径, err)
		return nil, err
	}
	return os.OpenFile(路径, 标志, 权限)
}

// 安全创建目录
func 安全创建目录(路径 string, 权限 fs.FileMode) error {
	if err := 检查文件操作鉴权(鉴权类型_文件写入, 路径); err != nil {
		logging.LogWarnf("[CronJob] 目录创建被拒绝: %s, 错误: %v", 路径, err)
		return err
	}
	return os.Mkdir(路径, 权限)
}

// 安全创建目录_递归
func 安全创建目录_递归(路径 string, 权限 fs.FileMode) error {
	if err := 检查文件操作鉴权(鉴权类型_文件写入, 路径); err != nil {
		logging.LogWarnf("[CronJob] 目录创建被拒绝: %s, 错误: %v", 路径, err)
		return err
	}
	return os.MkdirAll(路径, 权限)
}

// 安全重命名
func 安全重命名(旧路径, 新路径 string) error {
	if err := 检查文件操作鉴权(鉴权类型_文件写入, 旧路径); err != nil {
		return err
	}
	if err := 检查文件操作鉴权(鉴权类型_文件写入, 新路径); err != nil {
		return err
	}
	return os.Rename(旧路径, 新路径)
}

// ========== 受限命令执行 ==========

// 安全命令 exec.Command 的安全包装
type 安全命令 struct {
	cmd *exec.Cmd
	已鉴权 bool
}

// 创建安全命令
func 创建安全命令(命令 string, 参数 ...string) *安全命令 {
	return &安全命令{
		cmd: exec.Command(命令, 参数...),
		已鉴权: false,
	}
}

func (c *安全命令) 执行鉴权() error {
	if c.已鉴权 {
		return nil
	}
	if err := 检查命令执行鉴权(c.cmd.Path, c.cmd.Args[1:]); err != nil {
		return err
	}
	c.已鉴权 = true
	return nil
}

func (c *安全命令) Run() error {
	if err := c.执行鉴权(); err != nil {
		return err
	}
	return c.cmd.Run()
}

func (c *安全命令) Start() error {
	if err := c.执行鉴权(); err != nil {
		return err
	}
	return c.cmd.Start()
}

func (c *安全命令) Output() ([]byte, error) {
	if err := c.执行鉴权(); err != nil {
		return nil, err
	}
	return c.cmd.Output()
}

func (c *安全命令) CombinedOutput() ([]byte, error) {
	if err := c.执行鉴权(); err != nil {
		return nil, err
	}
	return c.cmd.CombinedOutput()
}

func (c *安全命令) Wait() error {
	return c.cmd.Wait()
}

func (c *安全命令) SetDir(dir string) {
	c.cmd.Dir = dir
}

func (c *安全命令) SetEnv(env []string) {
	c.cmd.Env = env
}

func (c *安全命令) SetStdin(r io.Reader) {
	c.cmd.Stdin = r
}

func (c *安全命令) SetStdout(w io.Writer) {
	c.cmd.Stdout = w
}

func (c *安全命令) SetStderr(w io.Writer) {
	c.cmd.Stderr = w
}

// ========== 受限网络请求 ==========

// 安全HTTP客户端
type 安全HTTP客户端 struct{}

func (c *安全HTTP客户端) Get(url string) (*http.Response, error) {
	if err := 检查网络请求鉴权(url); err != nil {
		return nil, err
	}
	return http.Get(url)
}

func (c *安全HTTP客户端) Post(url, contentType string, body io.Reader) (*http.Response, error) {
	if err := 检查网络请求鉴权(url); err != nil {
		return nil, err
	}
	return http.Post(url, contentType, body)
}

func (c *安全HTTP客户端) Do(req *http.Request) (*http.Response, error) {
	if err := 检查网络请求鉴权(req.URL.String()); err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}

// 全局安全HTTP客户端实例
var 安全HTTP = &安全HTTP客户端{}

// ========== 受限符号表 ==========

// 受限标准库符号表
// 替换危险的 os/exec/net 包函数为安全包装版本
var 受限标准库符号表 = interp.Exports{
	// 安全文件操作包
	"safeos/safeos": map[string]reflect.Value{
		// 文件操作 - 使用安全包装
		"ReadFile":  reflect.ValueOf(安全读取文件),
		"WriteFile": reflect.ValueOf(安全写入文件),
		"Remove":    reflect.ValueOf(安全删除文件),
		"RemoveAll": reflect.ValueOf(安全删除目录),
		"Open":      reflect.ValueOf(安全打开文件),
		"Create":    reflect.ValueOf(安全创建文件),
		"OpenFile":  reflect.ValueOf(安全打开文件_完整),
		"Mkdir":     reflect.ValueOf(安全创建目录),
		"MkdirAll":  reflect.ValueOf(安全创建目录_递归),
		"Rename":    reflect.ValueOf(安全重命名),

		// 安全的只读操作 - 直接暴露
		"Stat":         reflect.ValueOf(os.Stat),
		"Lstat":        reflect.ValueOf(os.Lstat),
		"ReadDir":      reflect.ValueOf(os.ReadDir),
		"Getwd":        reflect.ValueOf(os.Getwd),
		"UserHomeDir":  reflect.ValueOf(os.UserHomeDir),
		"TempDir":      reflect.ValueOf(os.TempDir),
		"Getenv":       reflect.ValueOf(os.Getenv),
		"IsNotExist":   reflect.ValueOf(os.IsNotExist),
		"IsExist":      reflect.ValueOf(os.IsExist),
		"IsPermission": reflect.ValueOf(os.IsPermission),

		// 常量
		"O_RDONLY": reflect.ValueOf(os.O_RDONLY),
		"O_WRONLY": reflect.ValueOf(os.O_WRONLY),
		"O_RDWR":   reflect.ValueOf(os.O_RDWR),
		"O_APPEND": reflect.ValueOf(os.O_APPEND),
		"O_CREATE": reflect.ValueOf(os.O_CREATE),
		"O_EXCL":   reflect.ValueOf(os.O_EXCL),
		"O_SYNC":   reflect.ValueOf(os.O_SYNC),
		"O_TRUNC":  reflect.ValueOf(os.O_TRUNC),

		// 类型
		"File":     reflect.ValueOf((*os.File)(nil)),
		"FileInfo": reflect.ValueOf((*os.FileInfo)(nil)),
		"FileMode": reflect.ValueOf(fs.FileMode(0)),
	},

	// 安全命令执行包
	"safeexec/safeexec": map[string]reflect.Value{
		"Command": reflect.ValueOf(创建安全命令),
		// 类型
		"Cmd": reflect.ValueOf((*安全命令)(nil)),
	},

	// 安全网络请求包
	"safehttp/safehttp": map[string]reflect.Value{
		"Get":    reflect.ValueOf(安全HTTP.Get),
		"Post":   reflect.ValueOf(安全HTTP.Post),
		"Client": reflect.ValueOf(安全HTTP),
	},
}
