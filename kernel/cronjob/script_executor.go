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
	"fmt"
	"reflect"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

// 脚本执行器 使用 yaegi 解释执行 Go 代码
type 脚本执行器 struct {
	解释器 *interp.Interpreter
}

// 创建脚本执行器 创建新的脚本执行器实例
func 创建脚本执行器() (*脚本执行器, error) {
	i := interp.New(interp.Options{})

	// 导入标准库
	if err := i.Use(stdlib.Symbols); err != nil {
		return nil, fmt.Errorf("加载标准库失败: %w", err)
	}

	// 导入思源内部符号（受限的安全子集）
	if err := i.Use(思源符号表); err != nil {
		return nil, fmt.Errorf("加载思源符号表失败: %w", err)
	}

	return &脚本执行器{解释器: i}, nil
}

// 编译文档 将文档编译为可执行的 Go 代码
func (e *脚本执行器) 编译文档(文档ID string) (string, error) {
	// 使用统一的文档编译器，确保行为一致（如忽略前导注释）
	compiler := NewDocumentCompiler()
	return compiler.Compile(文档ID, "go")
}

// 加载代码 加载并执行编译后的代码，返回导出的变量
func (e *脚本执行器) 加载代码(代码 string) (map[string]interface{}, error) {
	// 创建新的解释器实例以隔离执行环境
	i := interp.New(interp.Options{})
	if err := i.Use(stdlib.Symbols); err != nil {
		return nil, err
	}
	if err := i.Use(思源符号表); err != nil {
		return nil, err
	}

	// 执行代码
	_, err := i.Eval(代码)
	if err != nil {
		return nil, fmt.Errorf("执行代码失败: %w", err)
	}

	// 获取导出的变量
	导出变量 := make(map[string]interface{})

	// 尝试获取 Name 变量
	if v, err := i.Eval("main.Name"); err == nil {
		导出变量["Name"] = v.Interface()
	}

	// 尝试获取 Schedule 变量
	if v, err := i.Eval("main.Schedule"); err == nil {
		导出变量["Schedule"] = v.Interface()
	}

	// 尝试获取 Description 变量
	if v, err := i.Eval("main.Description"); err == nil {
		导出变量["Description"] = v.Interface()
	}

	// 尝试获取 Run 函数
	if v, err := i.Eval("main.Run"); err == nil {
		// 将反射值转换为我们的处理器类型
		if v.Kind() == reflect.Func {
			handler := func(ctx *Context) error {
				result := v.Call([]reflect.Value{reflect.ValueOf(ctx)})
				if len(result) > 0 && !result[0].IsNil() {
					return result[0].Interface().(error)
				}
				return nil
			}
			导出变量["Run"] = TaskHandler(handler)
		}
	}

	return 导出变量, nil
}

// 执行代码 直接执行一段代码
func (e *脚本执行器) 执行代码(代码 string) (interface{}, error) {
	v, err := e.解释器.Eval(代码)
	if err != nil {
		return nil, err
	}
	return v.Interface(), nil
}

// 思源符号表 暴露给脚本的思源内部符号
// 这是一个安全的子集，避免暴露危险操作
var 思源符号表 = interp.Exports{
	"siyuan/siyuan": map[string]reflect.Value{
		// 定时任务上下文类型
		"Context": reflect.ValueOf((*Context)(nil)),

		// 安全的工具函数
		"日志信息": reflect.ValueOf(日志信息),
		"日志警告": reflect.ValueOf(日志警告),
		"日志错误": reflect.ValueOf(日志错误),

		// 获取配置
		"获取图片水印配置": reflect.ValueOf(获取图片水印配置),

		// 图片处理
		"添加图片水印": reflect.ValueOf(添加图片水印),
	},
}

// 日志信息 记录信息级别日志
func 日志信息(消息 string) {
	// TODO: 调用思源日志系统
	fmt.Println("[INFO]", 消息)
}

// 日志警告 记录警告级别日志
func 日志警告(消息 string) {
	// TODO: 调用思源日志系统
	fmt.Println("[WARN]", 消息)
}

// 日志错误 记录错误级别日志
func 日志错误(消息 string) {
	// TODO: 调用思源日志系统
	fmt.Println("[ERROR]", 消息)
}

// 图片水印配置 水印配置结构
type 图片水印配置 struct {
	水印文本    string // 水印文本或图片路径
	水印描述    string // 位置、大小、样式等描述
	是否为图片水印 bool   // true: 图片水印, false: 文本水印
}

// 获取图片水印配置 获取当前的图片水印配置
func 获取图片水印配置() *图片水印配置 {
	// TODO: 从 model.Conf.Export 读取配置
	return &图片水印配置{
		水印文本:    "",
		水印描述:    "",
		是否为图片水印: false,
	}
}

// 添加图片水印 为图片添加水印
func 添加图片水印(图片路径 string, 输出路径 string, 配置 *图片水印配置) error {
	// TODO: 实现图片水印功能
	return nil
}
