# 示例：自动 Git 推送更新的文档

这是一个定时任务示例，演示如何：
1. 每 10 分钟检查最近更新的文档
2. 将文档导出为 Markdown 到指定文件夹
3. 使用 Git 提交并推送到远程仓库

> ⚠️ **安全提示**：此任务会调用外部命令（git），首次执行时会弹出授权确认对话框。

## 任务配置

```go
package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"safeos"
	"safeexec"
	"siyuan"
)

// 任务名称
var Name = "自动 Git 推送"

// 任务描述
var Description = "每 10 分钟检查更新的文档，导出并推送到 Git 仓库"

// Cron 表达式：每 10 分钟执行一次
var Schedule = "*/10 * * * *"

// ========== 用户配置 ==========

// Git 仓库目录（必须是已初始化的 Git 仓库）
var GitRepoDir = "D:/notes/my-siyuan-backup"

// 导出子目录（相对于仓库根目录）
var ExportSubDir = "docs"

// 远程仓库名称
var GitRemote = "origin"

// 分支名称
var GitBranch = "main"

// 查询多久内更新的文档（分钟）
var UpdatedWithinMinutes = 10

// ========== 任务逻辑 ==========

// Run 任务入口函数
func Run(ctx *siyuan.Context) error {
	exportDir := filepath.Join(GitRepoDir, ExportSubDir)

	// 1. 确保导出目录存在
	if err := safeos.MkdirAll(exportDir, 0755); err != nil {
		return fmt.Errorf("创建导出目录失败: %v", err)
	}

	// 2. 查询最近更新的文档
	threshold := time.Now().Add(-time.Duration(UpdatedWithinMinutes) * time.Minute)
	thresholdStr := threshold.Format("20060102150405")

	stmt := fmt.Sprintf(
		"SELECT id, content FROM blocks WHERE type = 'd' AND updated > '%s' ORDER BY updated DESC LIMIT 50",
		thresholdStr,
	)

	ret, err := ctx.Call("/api/query/sql", map[string]interface{}{
		"stmt": stmt,
	})
	if err != nil {
		return fmt.Errorf("查询文档失败: %v", err)
	}

	dataList, ok := ret["result"].([]interface{})
	if !ok || len(dataList) == 0 {
		siyuan.日志信息("没有发现更新的文档，跳过本次同步")
		return nil
	}

	siyuan.日志信息(fmt.Sprintf("发现 %d 个更新的文档", len(dataList)))

	// 3. 逐个导出文档
	exportedCount := 0
	for _, item := range dataList {
		row := item.(map[string]interface{})
		docID := row["id"].(string)
		docTitle := row["content"].(string)

		retExport, err := ctx.Call("/api/export/exportMdContent", map[string]interface{}{
			"id": docID,
		})
		if err != nil {
			siyuan.日志警告(fmt.Sprintf("导出文档 %s 失败: %v", docTitle, err))
			continue
		}

		mdContent, _ := retExport["content"].(string)
		if mdContent == "" {
			continue
		}

		// 生成安全的文件名
		safeTitle := sanitizeFilename(docTitle)
		if safeTitle == "" {
			safeTitle = docID
		}
		filename := safeTitle + ".md"
		fullPath := filepath.Join(exportDir, filename)

		if err := safeos.WriteFile(fullPath, []byte(mdContent), 0644); err != nil {
			siyuan.日志警告(fmt.Sprintf("写入文件 %s 失败: %v", filename, err))
			continue
		}

		exportedCount++
		siyuan.日志信息(fmt.Sprintf("已导出: %s", filename))
	}

	if exportedCount == 0 {
		siyuan.日志信息("没有成功导出任何文档")
		return nil
	}

	siyuan.日志信息(fmt.Sprintf("共导出 %d 个文档，开始 Git 提交...", exportedCount))

	// 4. Git 操作
	// 4.1 git add
	addCmd := safeexec.Command("git", "-C", GitRepoDir, "add", ".")
	if output, err := addCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git add 失败: %v\n%s", err, string(output))
	}

	// 4.2 git commit
	commitMsg := fmt.Sprintf("自动同步: %s (%d 个文档)", time.Now().Format("2006-01-02 15:04"), exportedCount)
	commitCmd := safeexec.Command("git", "-C", GitRepoDir, "commit", "-m", commitMsg)
	commitOutput, err := commitCmd.CombinedOutput()
	if err != nil {
		// 如果没有变更，commit 会返回错误，但这不是真正的错误
		if strings.Contains(string(commitOutput), "nothing to commit") {
			siyuan.日志信息("没有新的变更需要提交")
			return nil
		}
		return fmt.Errorf("git commit 失败: %v\n%s", err, string(commitOutput))
	}

	siyuan.日志信息("Git 提交成功")

	// 4.3 git push
	pushCmd := safeexec.Command("git", "-C", GitRepoDir, "push", GitRemote, GitBranch)
	if output, err := pushCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git push 失败: %v\n%s", err, string(output))
	}

	siyuan.日志信息(fmt.Sprintf("成功推送到 %s/%s", GitRemote, GitBranch))
	return nil
}

// sanitizeFilename 移除文件名中的非法字符
func sanitizeFilename(name string) string {
	result := ""
	for _, r := range name {
		if r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' {
			continue
		}
		result += string(r)
	}
	if len(result) > 100 {
		result = result[:100]
	}
	return result
}
```


## 使用说明

### 1. 前置条件

- 目标目录必须是已初始化的 Git 仓库：
  ```bash
  cd D:/notes/my-siyuan-backup
  git init
  git remote add origin https://github.com/your-username/your-repo.git
  ```

- Git 必须已配置好认证（SSH 密钥或 HTTPS 凭据）

### 2. 设置文档属性

在文档属性中添加：
- `ext-lang`: `go`
- `ext-type`: `cronjob`

### 3. 修改配置

根据你的实际情况修改以下变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `GitRepoDir` | Git 仓库本地路径 | `D:/notes/my-backup` |
| `ExportSubDir` | 导出文件的子目录 | `docs` |
| `GitRemote` | 远程仓库名称 | `origin` |
| `GitBranch` | 分支名称 | `main` |
| `UpdatedWithinMinutes` | 检查多久内的更新 | `10` |

### 4. 首次运行

首次执行时，由于涉及外部命令调用，会弹出授权确认对话框：

> 🔐 **任务「自动 Git 推送」请求执行命令**：
> `git -C D:/notes/my-siyuan-backup add .`
>
> [允许] [拒绝]

点击「允许」后，该任务在本次内核生命周期内不再重复询问。

### 5. 验证

- 修改几篇笔记
- 等待 10 分钟（或手动触发任务）
- 检查远程仓库是否有新的提交

## 注意事项

1. **Git 认证**：确保 Git 已配置好免密认证（SSH 或凭据管理器）
2. **冲突处理**：此脚本不处理合并冲突，建议仅单向同步
3. **大型仓库**：首次同步可能较慢，建议先手动初始化仓库
