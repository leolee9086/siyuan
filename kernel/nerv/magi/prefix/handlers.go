package prefix

import (
	"fmt"
	"strings"
	"time"

	"github.com/88250/lute/ast"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/treenode"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// inboxHandler 是"收集"前缀指令的 Go 内置处理器。
// 将微信消息内容收集到思源笔记，创建本地文档。
// 全流程不调用云端收集箱 API，不需要年付订阅。
func inboxHandler(ctx *HandlerContext) (*CommandResult, error) {
	args := strings.TrimSpace(ctx.Match.Args)
	if args == "" && len(ctx.Inbound.Media) == 0 {
		return &CommandResult{
			ReplyText: "收集内容为空，请在指令后输入要收集的文本",
		}, nil
	}

	// 确定目标笔记本：优先使用配置的 ShorthandSaveBox，其次尝试 AI 主笔记本
	boxID := model.Conf.FileTree.ShorthandSaveBox
	if boxID == "" {
		scope, err := model.ResolveWorkspaceAIMainNotebookAccessScope()
		if err != nil || scope == nil || scope.ActiveNotebook == nil {
			return &CommandResult{
				ReplyText: "未配置收集目标笔记本，请先在设置中配置\"闪念速记存储笔记本\"",
			}, fmt.Errorf("no target notebook configured: %v", err)
		}
		boxID = scope.ActiveNotebook.ID
	}

	// 确定 HPath：使用 ShorthandSavePath 模板或默认日期路径
	hPath := model.Conf.FileTree.ShorthandSavePath
	if hPath == "" {
		hPath = "/{YYYY}/{MM}/{DD}"
	}
	renderedPath, err := model.RenderGoTemplate(hPath)
	if err != nil {
		logging.LogErrorf("prefix inbox: render path template failed: %v", err)
		renderedPath = "/" + time.Now().Format("2006/01/02")
	}

	// 生成文档标题
	now := time.Now()
	titleSummary := args
	if len(titleSummary) > 30 {
		titleSummary = titleSummary[:30] + "..."
	}
	title := fmt.Sprintf("[收集] %s %s", now.Format("2006-01-02 15:04"), titleSummary)

	// 构建 Markdown 内容
	mdContent := buildInboxMarkdown(args, ctx.Inbound.Media, now, ctx.Inbound.Nickname)

	// 生成文档 ID
	docID := ast.NewNodeID()

	// 创建文档
	retID, err := model.CreateWithMarkdown("", boxID, renderedPath+"/"+title, mdContent, "", docID, false, "", nil)
	if err != nil {
		return &CommandResult{
			ReplyText: fmt.Sprintf("收集失败: %v", err),
		}, fmt.Errorf("createDoc failed: %w", err)
	}

	model.FlushTxQueue()

	docPath := renderedPath + "/" + title
	replyText := fmt.Sprintf("已收集到：%s", docPath)
	summary := fmt.Sprintf("用户通过 %s 渠道收集了内容到文档 %s（ID: %s）",
		ctx.Inbound.ChannelType, docPath, retID)

	return &CommandResult{
		ReplyText: replyText,
		Summary:   summary,
		Data: map[string]any{
			"docID":   retID,
			"docPath": docPath,
			"boxID":   boxID,
		},
	}, nil
}

// buildInboxMarkdown 构建收集箱文档的 Markdown 内容。
func buildInboxMarkdown(text string, media []channel.MediaAttachment, timestamp time.Time, nickname string) string {
	var sb strings.Builder
	sb.WriteString("## 收集内容\n\n")
	if text != "" {
		sb.WriteString(text)
		sb.WriteString("\n\n")
	}
	if len(media) > 0 {
		sb.WriteString("### 附件\n\n")
		for _, m := range media {
			switch m.Type {
			case channel.MediaTypeImage:
				sb.WriteString(fmt.Sprintf("![%s](%s)\n\n", m.FileName, m.URL))
			case channel.MediaTypeAudio:
				sb.WriteString(fmt.Sprintf("<audio src=\"%s\"></audio>\n\n", m.URL))
			case channel.MediaTypeVideo:
				sb.WriteString(fmt.Sprintf("<video src=\"%s\"></video>\n\n", m.URL))
			case channel.MediaTypeFile:
				sb.WriteString(fmt.Sprintf("[%s](%s)\n\n", m.FileName, m.URL))
			}
		}
	}
	sb.WriteString("---\n\n")
	sb.WriteString(fmt.Sprintf("**收集时间**：%s\n\n", timestamp.Format("2006-01-02 15:04:05")))
	if nickname != "" {
		sb.WriteString(fmt.Sprintf("**来源用户**：%s\n\n", nickname))
	}
	return sb.String()
}

// todoHandler 是"待办"前缀指令的 Go 内置处理器。
// 在指定文档中追加待办事项列表项。
func todoHandler(ctx *HandlerContext) (*CommandResult, error) {
	args := strings.TrimSpace(ctx.Match.Args)
	if args == "" {
		return &CommandResult{
			ReplyText: "待办内容为空，请在指令后输入待办事项",
		}, nil
	}

	// 从 metadata 获取待办文档路径
	checklistDocPath := "/待办清单"
	if ctx.Metadata != nil {
		if val, ok := ctx.Metadata["checklistDocPath"]; ok {
			if s, ok2 := val.(string); ok2 && s != "" {
				checklistDocPath = s
			}
		}
	}

	// 确定目标笔记本
	boxID := model.Conf.FileTree.ShorthandSaveBox
	if boxID == "" {
		scope, err := model.ResolveWorkspaceAIMainNotebookAccessScope()
		if err != nil || scope == nil || scope.ActiveNotebook == nil {
			return &CommandResult{
				ReplyText: "未配置目标笔记本，请先在设置中配置\"闪念速记存储笔记本\"",
			}, fmt.Errorf("no target notebook configured: %v", err)
		}
		boxID = scope.ActiveNotebook.ID
	}

	// 尝试查找已有文档
	docID := findDocByHPath(boxID, checklistDocPath)
	if docID == "" {
		// 文档不存在，创建新文档
		mdContent := fmt.Sprintf("## 待办清单\n\n- [ ] %s\n", args)
		newID := ast.NewNodeID()
		var err error
		docID, err = model.CreateWithMarkdown("", boxID, checklistDocPath, mdContent, "", newID, false, "", nil)
		if err != nil {
			return &CommandResult{
				ReplyText: fmt.Sprintf("创建待办清单失败: %v", err),
			}, fmt.Errorf("createDoc failed: %w", err)
		}
		model.FlushTxQueue()
	} else {
		// 文档已存在，追加待办项
		markdown := fmt.Sprintf("- [ ] %s\n", args)
		dom := util.NewLute().Md2BlockDOM(markdown, false)
		transactions := []*model.Transaction{
			{
				DoOperations: []*model.Operation{
					{
						Action:   "appendInsert",
						Data:     dom,
						ParentID: docID,
					},
				},
			},
		}
		model.PerformTransactions(&transactions)
		model.FlushTxQueue()
	}

	replyText := fmt.Sprintf("已添加待办：%s", args)
	summary := fmt.Sprintf("用户通过 %s 渠道添加了待办事项 \"%s\" 到 %s",
		ctx.Inbound.ChannelType, args, checklistDocPath)

	return &CommandResult{
		ReplyText: replyText,
		Summary:   summary,
		Data: map[string]any{
			"docID":   docID,
			"docPath": checklistDocPath,
			"todo":    args,
		},
	}, nil
}

// findDocByHPath 尝试通过 HPath 在指定笔记本中查找文档的 rootID。
// 如果找不到返回空字符串。
func findDocByHPath(boxID, hPath string) string {
	if !strings.HasPrefix(hPath, "/") {
		hPath = "/" + hPath
	}
	bt := treenode.GetBlockTreeRootByHPath(boxID, hPath)
	if bt == nil {
		return ""
	}
	return bt.ID
}
