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
	"strings"

	"github.com/88250/lute/ast"
	"github.com/siyuan-note/siyuan/kernel/model"
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
// 将非代码块转换为注释，代码块按顺序连接
func (e *脚本执行器) 编译文档(文档ID string) (string, error) {
	// 获取文档内容
	文档内容, err := 获取文档内容(文档ID)
	if err != nil {
		return "", fmt.Errorf("获取文档内容失败: %w", err)
	}

	// 解析并编译
	编译结果 := 编译文档内容(文档内容)
	return 编译结果, nil
}

// 获取文档内容 从思源获取文档的块内容
func 获取文档内容(文档ID string) ([]文档块, error) {
	// 加载文档树
	树, err := model.LoadTreeByBlockID(文档ID)
	if err != nil {
		return nil, fmt.Errorf("加载文档失败: %w", err)
	}
	if 树 == nil || 树.Root == nil {
		return nil, fmt.Errorf("文档不存在: %s", 文档ID)
	}

	var 块列表 []文档块

	// 遍历文档 Root 的直接子节点（顶级块）
	for 子节点 := 树.Root.FirstChild; 子节点 != nil; 子节点 = 子节点.Next {
		块 := 节点转文档块(子节点)
		if 块 != nil {
			块列表 = append(块列表, *块)
		}
	}

	return 块列表, nil
}

// 节点转文档块 将 AST 节点转换为文档块
func 节点转文档块(节点 *ast.Node) *文档块 {
	if 节点 == nil {
		return nil
	}

	// 代码块特殊处理
	if 节点.Type == ast.NodeCodeBlock {
		语言 := ""
		代码 := ""
		for 子 := 节点.FirstChild; 子 != nil; 子 = 子.Next {
			if 子.Type == ast.NodeCodeBlockFenceInfoMarker {
				语言 = string(子.CodeBlockInfo)
			}
			if 子.Type == ast.NodeCodeBlockCode {
				代码 = string(子.Tokens)
			}
		}
		return &文档块{
			类型:   "code_block",
			内容:   代码,
			代码语言: 语言,
		}
	}

	// 其它所有块类型：提取纯文本
	文本 := 提取节点纯文本(节点)
	if 文本 == "" {
		return nil
	}

	return &文档块{
		类型: 节点.Type.String(), // 使用节点类型的字符串名称
		内容: 文本,
	}
}

// 提取节点纯文本 提取节点下所有文本内容（通用方法）
func 提取节点纯文本(节点 *ast.Node) string {
	var 结果 strings.Builder

	ast.Walk(节点, func(n *ast.Node, entering bool) ast.WalkStatus {
		if !entering {
			return ast.WalkContinue
		}

		// 提取文本 token
		if len(n.Tokens) > 0 {
			switch n.Type {
			case ast.NodeText, ast.NodeCodeSpanContent, ast.NodeCodeBlockCode,
				ast.NodeMathBlockContent, ast.NodeInlineMathContent,
				ast.NodeHTMLBlock, ast.NodeInlineHTML:
				结果.Write(n.Tokens)
			}
		}

		// 处理换行
		if n.Type == ast.NodeBr || n.Type == ast.NodeParagraph {
			if 结果.Len() > 0 {
				结果.WriteString("\n")
			}
		}

		return ast.WalkContinue
	})

	return strings.TrimSpace(结果.String())
}

// 文档块 表示文档中的一个块
type 文档块 struct {
	类型   string // "paragraph", "code_block" 等
	内容   string // 块的文本内容
	代码语言 string // 代码块的语言标识
}

// 编译文档内容 将文档块列表编译为 Go 代码
func 编译文档内容(块列表 []文档块) string {
	var 结果 strings.Builder

	for _, 块 := range 块列表 {
		switch 块.类型 {
		case "code_block":
			// 代码块：检查是否为 Go 代码
			if 块.代码语言 == "go" || 块.代码语言 == "golang" {
				结果.WriteString(块.内容)
				结果.WriteString("\n")
			} else {
				// 其他语言的代码块也转为注释
				转为注释(&结果, 块.内容)
			}
		default:
			// 非代码块：转为注释
			转为注释(&结果, 块.内容)
		}
	}

	return 结果.String()
}

// 转为注释 将文本转换为 Go 注释
func 转为注释(结果 *strings.Builder, 文本 string) {
	行列表 := strings.Split(文本, "\n")
	for _, 行 := range 行列表 {
		结果.WriteString("// ")
		结果.WriteString(行)
		结果.WriteString("\n")
	}
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
			处理器 := func(ctx *定时任务上下文) error {
				结果 := v.Call([]reflect.Value{reflect.ValueOf(ctx)})
				if len(结果) > 0 && !结果[0].IsNil() {
					return 结果[0].Interface().(error)
				}
				return nil
			}
			导出变量["Run"] = 定时任务处理器(处理器)
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
		"定时任务上下文": reflect.ValueOf((*定时任务上下文)(nil)),

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
