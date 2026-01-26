# 思源笔记 CronJob 定时任务功能技术文档

## 概述

本文档介绍思源笔记**用户可配置定时任务功能**的技术实现。该功能允许用户在笔记文档中使用 Go 语言编写定时任务脚本，实现自动化工作流（如定时导出、Git 同步等）。

### 核心特性

1. **文学编程**：在 Markdown 文档中编写 Go 代码，代码块自动连接编译
2. **动态执行**：使用 [Yaegi](https://github.com/traefik/yaegi) 解释器运行代码，无需预编译
3. **安全鉴权**：敏感操作（外部文件访问、命令执行、网络请求）需用户授权
4. **API 访问**：脚本可调用思源内核 API

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                          前端 (app/)                             │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐   │
│  │ cronjobAuth  │◄──│ WebSocket 监听   │◄──│ 授权确认弹窗    │   │
│  └──────────────┘   └──────────────────┘   └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       后端 (kernel/cronjob/)                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │   Manager    │──►│  Executor    │──►│  脚本执行器 (Yaegi)  │ │
│  │  任务管理器   │   │   执行器     │   │                      │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
│         │                  │                      │              │
│         ▼                  ▼                      ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │   Storage    │   │    Auth      │   │   safe_stdlib        │ │
│  │  配置存储    │   │  鉴权管理器   │   │  受限标准库          │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 文件结构

### 后端核心模块

| 文件 | 说明 | 链接 |
|------|------|------|
| `cronjob.go` | 任务管理器、任务实例、Context 定义 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/cronjob.go) |
| `script_executor.go` | Yaegi 脚本执行器、思源符号表 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/script_executor.go) |
| `compiler.go` | 文档编译器（AST 遍历、代码块连接） | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/compiler.go) |
| `auth.go` | 安全鉴权机制（会话授权、AuthCode 验证） | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/auth.go) |
| `safe_stdlib.go` | 受限标准库包装（safeos/safeexec/safehttp） | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/safe_stdlib.go) |
| `logger.go` | 执行日志记录器（写入 DailyNote） | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/logger.go) |
| `storage.go` | 配置持久化 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/storage.go) |
| `exports.go` | 英文别名导出 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/exports.go) |

### 辅助功能模块

| 文件 | 说明 | 链接 |
|------|------|------|
| `watermark.go` | 图片水印处理 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/watermark.go) |
| `folder_watcher.go` | 文件夹监听器 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/kernel/cronjob/folder_watcher.go) |

### 前端模块

| 文件 | 说明 | 链接 |
|------|------|------|
| `cronjobAuth.ts` | WebSocket 鉴权请求监听、授权弹窗 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/app/src/util/cronjobAuth.ts) |
| `cronjob.types.ts` | TypeScript 类型定义 | [查看](https://github.com/leolee9086/siyuan/blob/multipleAI/app/src/util/cronjob.types.ts) |

### 示例文档

| 文件 | 说明 |
|------|------|
| `示例_每分钟创建文件.md` | 演示 SQL 查询 + 文档导出 |
| `示例_自动水印任务.md` | 演示图片处理 |
| `示例_自动Git推送.md` | 演示 safeexec 命令执行 |

---

## 核心原理

### 1. 文学编程编译

用户在 Markdown 文档中编写代码，设置文档属性：

- `ext-lang: go`
- `ext-type: cronjob`

**编译流程**：

```
Markdown 文档
    │
    ▼ (AST 遍历)
提取所有代码块
    │
    ▼ (按顺序连接)
完整 Go 源码
    │
    ▼ (Yaegi 解释执行)
导出变量: Name, Schedule, Run()
```

### 2. Yaegi 解释器配置

```go
// script_executor.go

func 创建脚本执行器() (*脚本执行器, error) {
    i := interp.New(interp.Options{})
    
    // 1. 先加载完整标准库（提供 fmt/strings/time 等安全包）
    i.Use(stdlib.Symbols)
    
    // 2. 再加载受限符号表（覆盖危险操作）
    i.Use(受限标准库符号表)  // safeos, safeexec, safehttp
    
    // 3. 加载思源内部符号
    i.Use(思源符号表)  // Context, 日志函数 等
    
    return &脚本执行器{解释器: i}, nil
}
```

### 3. 安全鉴权机制

**鉴权流程**：

```
脚本执行敏感操作
    │
    ▼
检查内存缓存 (已授权会话)
    │ 已授权 → 放行
    ▼ 未授权
检查 AuthCode (HMAC 签名)
    │ 有效 → 标记授权 → 放行
    ▼ 无效
发送 WebSocket 请求到前端
    │
    ▼
前端弹出授权确认对话框
    │
    ├─ 允许 → 标记授权 → 放行
    └─ 拒绝 → 返回错误
```

**鉴权类型**：

| 类型 | 触发条件 |
|------|----------|
| `file_read` | 读取工作空间外的文件 |
| `file_write` | 写入工作空间外的文件 |
| `file_delete` | 删除工作空间外的文件 |
| `command_exec` | 执行任意外部命令 |
| `network_request` | 发起 HTTP 请求 |

**工作空间内路径免鉴权**：

```go
// safe_stdlib.go

func 是安全路径(路径 string) bool {
    绝对路径, _ := filepath.Abs(路径)
    
    // 工作空间目录内 → 免鉴权
    if strings.HasPrefix(绝对路径, util.WorkspaceDir) ||
       strings.HasPrefix(绝对路径, util.DataDir) ||
       strings.HasPrefix(绝对路径, util.TempDir) {
        return true
    }
    return false
}
```

### 4. 受限标准库

脚本使用 `safeos`/`safeexec`/`safehttp` 包替代原生包：

```go
// 脚本中使用
import (
    "safeos"    // 替代 os
    "safeexec"  // 替代 os/exec
    "safehttp"  // 替代 net/http
)

func Run(ctx *siyuan.Context) error {
    // 工作空间内 → 免鉴权
    safeos.WriteFile("./data/test.txt", data, 0644)
    
    // 工作空间外 → 触发前端鉴权弹窗
    safeos.WriteFile("C:/外部/file.txt", data, 0644)
    
    // 命令执行 → 触发鉴权
    cmd := safeexec.Command("git", "push")
    cmd.Run()
    
    return nil
}
```

### 5. 任务生命周期

```
注册文档 (RegisterExtension)
    │
    ▼
编译并启动 (CompileAndStartTask)
    │
    ├─ 编译文档 → 提取 Go 代码
    ├─ 加载代码 → 获取 Name/Schedule/Run
    ├─ 检查 AuthCode → 尝试预授权
    ├─ 停止旧任务 → close(oldTask.StopChan)
    └─ 启动新任务 → go RunTaskLoop()
           │
           ▼
     定时执行 (ticker)
           │
           ▼
     ExecuteTask
           │
           ├─ 设置执行上下文
           ├─ 调用 task.Handler(ctx)
           ├─ 记录日志到 DailyNote
           └─ 更新运行时状态
```

### 6. 日志记录

执行日志自动追加到笔记本的 **DailyNote**：

```go
// logger.go

func (l *执行日志记录器) 保存日志到子文档(...) error {
    // 使用 appendDailyNoteBlock API
    GlobalAPIProvider("/api/block/appendDailyNoteBlock", map[string]interface{}{
        "notebook": notebook,
        "data":     markdown,
        "dataType": "markdown",
    })
}
```

**日志格式**：

```markdown
### 🕐 自动备份任务 - 01:58:32

**状态**: ✅ 成功 · **耗时**: 15ms

**详细日志**:

> `01:58:32.000` ℹ️ 任务开始执行
> `01:58:32.015` ℹ️ 任务执行完成
```

---

## API 参考

### 脚本可用的上下文方法

```go
type Context struct {
    DocID  string                 // 任务所属文档ID
    Name   string                 // 任务名称
    Time   time.Time              // 本次执行开始时间
    Log    func(string)           // 日志记录函数
}

// 调用内核 API
func (c *Context) Call(path string, args map[string]interface{}) (map[string]interface{}, error)
```

### 思源符号表 (siyuan 包)

```go
// 日志函数
siyuan.日志信息(msg string)
siyuan.日志警告(msg string)
siyuan.日志错误(msg string)

// 图片处理
siyuan.添加图片水印(图片路径, 输出路径, 配置)
siyuan.LoadOpenTypeFont(data []byte, size float64)
siyuan.DrawText(img, face, x, y, text, color)

// 类型
siyuan.Context
siyuan.TaskHandler
```

### 受限标准库

**safeos 包**：

```go
safeos.ReadFile(path string) ([]byte, error)
safeos.WriteFile(path string, data []byte, perm fs.FileMode) error
safeos.Remove(path string) error
safeos.MkdirAll(path string, perm fs.FileMode) error
safeos.Stat(path string) (fs.FileInfo, error)
// ...
```

**safeexec 包**：

```go
cmd := safeexec.Command(name string, args ...string)
cmd.Run() error
cmd.Output() ([]byte, error)
cmd.CombinedOutput() ([]byte, error)
cmd.SetDir(dir string)
cmd.SetEnv(env []string)
```

**safehttp 包**：

```go
safehttp.Get(url string) (*http.Response, error)
safehttp.Post(url, contentType string, body io.Reader) (*http.Response, error)
```

---

## 使用示例

### 1. 最小任务

```go
package main

import "siyuan"

var Name = "Hello World"
var Schedule = "*/5 * * * *"  // 每 5 分钟

func Run(ctx *siyuan.Context) error {
    siyuan.日志信息("任务执行了！")
    return nil
}
```

### 2. 调用 API 查询文档

```go
ret, err := ctx.Call("/api/query/sql", map[string]interface{}{
    "stmt": "SELECT * FROM blocks WHERE type = 'd' LIMIT 10",
})
```

### 3. 执行 Git 命令

```go
import "safeexec"

cmd := safeexec.Command("git", "-C", "/path/to/repo", "push")
output, err := cmd.CombinedOutput()
```

---

## 安全考量

1. **沙箱隔离**：使用 Yaegi 解释器，限制可访问的包
2. **路径检查**：工作空间内路径免鉴权，外部路径需用户确认
3. **会话授权**：一次授权，本次内核生命周期内有效
4. **AuthCode 机制**：基于 HMAC-SHA256 的机器绑定签名
5. **执行超时**：TODO - 待实现
6. **资源限制**：TODO - 限制并发任务数量

---

## 依赖

```go
// go.mod
require (
    github.com/traefik/yaegi v0.16.1  // Go 解释器
    github.com/robfig/cron/v3 v3.0.1  // Cron 表达式解析（可选）
)
```

---

## 后续规划

- [ ] 实现执行超时机制
- [ ] 限制并发任务数量
- [ ] 前端侧边栏任务管理面板
- [ ] 动态 API 端点注册
- [ ] 事件钩子（hook）支持
