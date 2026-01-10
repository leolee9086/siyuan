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
	"bytes"
	"go/scanner"
	"go/token"
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

	var 源码缓冲 bytes.Buffer

	// 1. 遍历文档节点，将所有内容拼接为源码（Markdown 内容转为注释）
	// 这样可以保留所有行号和上下文，方便后续处理
	logging.LogInfof("Start collecting source for doc: %s", 文档ID)
	ast.Walk(树.Root, func(n *ast.Node, entering bool) ast.WalkStatus {
		if !entering {
			return ast.WalkContinue
		}

		switch n.Type {
		case ast.NodeCodeBlock:
			语言 := 获取代码块语言(n)
			代码内容 := 获取代码块内容(n)
			logging.LogInfof("Found CodeBlock. Lang: %s, Length: %d", 语言, len(代码内容))

			if 语言匹配(语言, 目标语言) {
				// 目标语言代码块：直接追加
				源码缓冲.WriteString(代码内容)
				源码缓冲.WriteString("\n")
			} else if 代码内容 != "" {
				// 其他语言：转为注释
				编写多行注释(&源码缓冲, "```"+语言+"\n"+代码内容+"\n```")
			}

		case ast.NodeParagraph:
			文本 := 获取节点文本(n)
			if 文本 != "" {
				编写多行注释(&源码缓冲, 文本)
			}

		case ast.NodeHeading:
			文本 := 获取节点文本(n)
			if 文本 != "" {
				级别 := n.HeadingLevel
				前缀 := strings.Repeat("#", int(级别)) + " "
				编写多行注释(&源码缓冲, 前缀+文本)
			}

		case ast.NodeList:
			// 列表本身不包含文本，由子项处理

		case ast.NodeListItem:
			文本 := 获取节点文本(n)
			if 文本 != "" {
				编写多行注释(&源码缓冲, "- "+文本)
			}
			return ast.WalkSkipChildren

		case ast.NodeBlockquote:
			文本 := 获取节点文本(n)
			if 文本 != "" {
				行列表 := strings.Split(文本, "\n")
				for _, 行 := range 行列表 {
					源码缓冲.WriteString("// > ")
					源码缓冲.WriteString(行)
					源码缓冲.WriteString("\n")
				}
			}
			return ast.WalkSkipChildren
		}

		return ast.WalkContinue
	})

	// 2. 使用 scanner 解析并提升 import 语句
	fullSource := 源码缓冲.String()
	logging.LogInfof("Full source length before hoisting: %d", len(fullSource))

	finalSource, err := 提升Imports(fullSource)
	logging.LogInfof("Final source length after hoisting: %d", len(finalSource)) // If this is double, we know where.

	if err != nil {
		// 如果解析失败，回退到原始源码（可能只是简单的语法错误，交由编译器报错）
		logging.LogWarnf("解析 Imports 失败: %s", err)
		return fullSource, nil
	}

	return finalSource, nil
}

// 提升Imports 解析源码，提取 package 和 import 声明并放到顶部
func 提升Imports(source string) (string, error) {
	var s scanner.Scanner
	fset := token.NewFileSet()
	file := fset.AddFile("", fset.Base(), len(source))

	// Mode: 0 means comments are skipped and not returned as tokens.
	s.Init(file, []byte(source), nil, 0)

	var packageName = "main"
	var imports []string
	var bodySegments []string

	lastPos := token.Pos(file.Base()) // 初始位置

	for {
		pos, tok, _ := s.Scan()
		if tok == token.EOF {
			// 添加最后一段剩余内容
			if int(lastPos)-file.Base() < len(source) {
				bodySegments = append(bodySegments, source[int(lastPos)-file.Base():])
			}
			break
		}

		// 处理 Package 声明
		if tok == token.PACKAGE {
			// 1. 将 package 之前的内容（包括注释和空白）添加到 bodySegments
			if pos > lastPos {
				bodySegments = append(bodySegments, source[int(lastPos)-file.Base():int(pos)-file.Base()])
			}

			// 2. 扫描包名
			_, pkgNameTok, pkgName := s.Scan()
			if pkgNameTok == token.IDENT {
				packageName = pkgName
			}

			// 3. 找到 Package 声明的结束
			for {
				p, t, _ := s.Scan()
				if t == token.SEMICOLON || t == token.EOF {
					lastPos = p + 1
					break
				}
			}
			continue
		}

		// 处理 Import 声明
		if tok == token.IMPORT {
			// 1. 将 import 之前的内容（包括注释和空白）添加到 bodySegments
			if pos > lastPos {
				bodySegments = append(bodySegments, source[int(lastPos)-file.Base():int(pos)-file.Base()])
			}

			// 2. 记录 import 声明的开始位置
			importStart := int(pos) - file.Base()

			// 3. 扫描整个 import 声明
			balance := 0
			currentTok := tok
			currentPos := pos

			for {
				// 预读逻辑调整：如果是 IMPORT 刚开始，根据下一个 token 决定是否多行
				if currentTok == token.IMPORT {
					p, nextTok, _ := s.Scan()
					if nextTok == token.LPAREN {
						balance = 1
					}
					currentTok = nextTok
					currentPos = p
				} else {
					if currentTok == token.LPAREN {
						balance++
					} else if currentTok == token.RPAREN {
						balance--
					}
				}

				// 检查结束条件
				if (balance == 0 && currentTok == token.SEMICOLON) || currentTok == token.EOF {
					importEnd := int(currentPos) - file.Base()
					if currentTok == token.SEMICOLON {
						importEnd += 1 // 包含分号/换行
					}

					if importEnd > len(source) {
						importEnd = len(source)
					}

					imports = append(imports, source[importStart:importEnd])
					lastPos = token.Pos(importEnd + file.Base())
					break
				}

				// 继续扫描
				currentPos, currentTok, _ = s.Scan()
			}
			continue
		}
		// 其他内容留待下一次循环处理或最后附加
	}

	var result strings.Builder
	result.WriteString("package " + packageName + "\n\n")

	if len(imports) > 0 {
		for _, imp := range imports {
			result.WriteString(strings.TrimSpace(imp))
			result.WriteString("\n")
		}
		result.WriteString("\n")
	}

	for _, seg := range bodySegments {
		result.WriteString(seg)
	}

	return result.String(), nil
}

// 辅助函数保持不变
// 获取代码块语言 获取代码块的语言标识
func 获取代码块语言(节点 *ast.Node) string {
	if 节点.Type != ast.NodeCodeBlock {
		return ""
	}
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
func 编写多行注释(结果 *bytes.Buffer, 文本 string) {
	行列表 := strings.Split(文本, "\n")
	for _, 行 := range 行列表 {
		结果.WriteString("// ")
		结果.WriteString(行)
		结果.WriteString("\n")
	}
	结果.WriteString("\n")
}
