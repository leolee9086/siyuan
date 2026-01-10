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
	"strings"

	"github.com/88250/lute/ast"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
)

// 文档编译器 将思源文档编译为可执行的 Go 代码
type 文档编译器 struct{}

// 创建文档编译器 创建新的文档编译器
func 创建文档编译器() *文档编译器 {
	return &文档编译器{}
}

// 编译文档 根据文档 ID 编译文档
func (c *文档编译器) 编译文档(文档ID string, 目标语言 string) (string, error) {
	// 获取文档树
	树, err := model.LoadTreeByBlockID(文档ID)
	if err != nil {
		return "", err
	}

	if 树 == nil {
		logging.LogWarnf("文档不存在: %s", 文档ID)
		return "", nil
	}

	var 编译结果 strings.Builder

	// 遍历文档节点
	started := false
	ast.Walk(树.Root, func(n *ast.Node, entering bool) ast.WalkStatus {
		if !entering {
			return ast.WalkContinue
		}

		switch n.Type {
		case ast.NodeCodeBlock:
			// 代码块处理
			语言 := 获取代码块语言(n)
			代码内容 := 获取代码块内容(n)

			if 语言匹配(语言, 目标语言) {
				// 标记开始包含内容
				started = true

				// 目标语言的代码块：直接输出
				编译结果.WriteString(代码内容)
				编译结果.WriteString("\n\n")
			} else if started && 代码内容 != "" {
				// 其他语言代码块：仅在开始后转为注释
				编写多行注释(&编译结果, "```"+语言+"\n"+代码内容+"\n```")
			}

		case ast.NodeParagraph:
			if !started {
				return ast.WalkSkipChildren
			}
			// 段落：转为注释
			文本 := 获取节点文本(n)
			if 文本 != "" {
				编写多行注释(&编译结果, 文本)
			}

		case ast.NodeHeading:
			if !started {
				return ast.WalkSkipChildren
			}
			// 标题：转为注释
			文本 := 获取节点文本(n)
			if 文本 != "" {
				级别 := n.HeadingLevel
				前缀 := strings.Repeat("#", int(级别)) + " "
				编写多行注释(&编译结果, 前缀+文本)
			}

		case ast.NodeList:
			if !started {
				return ast.WalkSkipChildren
			}
			// 列表：转为注释
			// 列表内容会在子节点中处理

		case ast.NodeListItem:
			if !started {
				return ast.WalkSkipChildren
			}
			// 列表项：转为注释
			文本 := 获取节点文本(n)
			if 文本 != "" {
				编写多行注释(&编译结果, "- "+文本)
			}
			return ast.WalkSkipChildren // 已处理子节点

		case ast.NodeBlockquote:
			if !started {
				return ast.WalkSkipChildren
			}
			// 引用块：转为注释
			文本 := 获取节点文本(n)
			if 文本 != "" {
				行列表 := strings.Split(文本, "\n")
				for _, 行 := range 行列表 {
					编译结果.WriteString("// > ")
					编译结果.WriteString(行)
					编译结果.WriteString("\n")
				}
			}
			return ast.WalkSkipChildren
		}

		return ast.WalkContinue
	})

	return 编译结果.String(), nil
}

// 获取代码块语言 获取代码块的语言标识
func 获取代码块语言(节点 *ast.Node) string {
	if 节点.Type != ast.NodeCodeBlock {
		return ""
	}

	// 查找语言信息子节点
	for 子节点 := 节点.FirstChild; 子节点 != nil; 子节点 = 子节点.Next {
		if 子节点.Type == ast.NodeCodeBlockFenceInfoMarker {
			return string(子节点.CodeBlockInfo)
		}
	}

	return ""
}

// 获取代码块内容 获取代码块的代码内容
func 获取代码块内容(节点 *ast.Node) string {
	if 节点.Type != ast.NodeCodeBlock {
		return ""
	}

	// 查找代码内容子节点
	for 子节点 := 节点.FirstChild; 子节点 != nil; 子节点 = 子节点.Next {
		if 子节点.Type == ast.NodeCodeBlockCode {
			return string(子节点.Tokens)
		}
	}

	return ""
}

// 获取节点文本 获取节点的纯文本内容
func 获取节点文本(节点 *ast.Node) string {
	var 结果 strings.Builder

	ast.Walk(节点, func(n *ast.Node, entering bool) ast.WalkStatus {
		if !entering {
			return ast.WalkContinue
		}

		switch n.Type {
		case ast.NodeText:
			结果.Write(n.Tokens)
		case ast.NodeCodeSpan:
			// 行内代码
			for 子 := n.FirstChild; 子 != nil; 子 = 子.Next {
				if 子.Type == ast.NodeCodeSpanContent {
					结果.WriteString("`")
					结果.Write(子.Tokens)
					结果.WriteString("`")
				}
			}
			return ast.WalkSkipChildren
		case ast.NodeBr:
			结果.WriteString("\n")
		}

		return ast.WalkContinue
	})

	return 结果.String()
}

// 语言匹配 检查代码块语言是否匹配目标语言
func 语言匹配(代码块语言 string, 目标语言 string) bool {
	代码块语言 = strings.ToLower(strings.TrimSpace(代码块语言))
	目标语言 = strings.ToLower(strings.TrimSpace(目标语言))

	switch 目标语言 {
	case "go", "golang":
		return 代码块语言 == "go" || 代码块语言 == "golang"
	default:
		return 代码块语言 == 目标语言
	}
}

// 编写多行注释 将多行文本转换为注释
func 编写多行注释(结果 *strings.Builder, 文本 string) {
	行列表 := strings.Split(文本, "\n")
	for _, 行 := range 行列表 {
		结果.WriteString("// ")
		结果.WriteString(行)
		结果.WriteString("\n")
	}
	结果.WriteString("\n")
}

// 获取文档扩展属性 获取文档的 ext-lang 和 ext-type 属性
func 获取文档扩展属性(文档ID string) (扩展语言 string, 扩展类型 string, err error) {
	树, err := model.LoadTreeByBlockID(文档ID)
	if err != nil {
		return "", "", err
	}

	if 树 == nil || 树.Root == nil {
		return "", "", nil
	}

	// 从文档属性中读取
	扩展语言 = 树.Root.IALAttr("ext-lang")
	扩展类型 = 树.Root.IALAttr("ext-type")

	return 扩展语言, 扩展类型, nil
}

// 设置文档扩展属性 设置文档的 ext-lang 和 ext-type 属性
func 设置文档扩展属性(文档ID string, 扩展语言 string, 扩展类型 string) error {
	树, err := model.LoadTreeByBlockID(文档ID)
	if err != nil {
		return err
	}

	if 树 == nil || 树.Root == nil {
		return nil
	}

	// 设置属性
	树.Root.SetIALAttr("ext-lang", 扩展语言)
	树.Root.SetIALAttr("ext-type", 扩展类型)

	// 保存文档
	// TODO: 调用思源的保存机制
	return nil
}
