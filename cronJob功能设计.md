# CronJob 定时任务功能设计

## 概述

为思源笔记添加用户可配置的定时任务功能，允许用户在笔记中定义定时执行的后端任务。

## 设计原则

1. 定时任务由后端执行，充分利用 Go 后端的现有能力
2. 定时任务各端之间不同步，配置存放在不会被同步服务检测的目录
3. 定时任务需要能够完成网络请求、文件操作等功能
4. 定时任务需要支持增删查改（CRUD）操作
5. 定时任务的实际定义可以在笔记的代码块中完成
6. 引入 yaegi 解释运行方式以支持灵活的任务配置和后端动态扩展

## 现有代码基础设施分析

### 1. 现有定时任务系统 (`kernel/job/cron.go`)

```go
// 现有的 every() 函数实现了基于 time.Ticker 的定时任务
func every(interval time.Duration, f func(), name ...string) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()
    for range ticker.C {
        f()
    }
}

// StartCron() 在启动时注册所有内置定时任务
func StartCron() {
    go every(5*time.Second, model.SyncDataJob)
    go every(2*time.Hour, model.StatJob)
    // ... 更多内置任务
}
```

**可复用点**：
- `every()` 函数的基础模式可以扩展为支持用户自定义任务
- 需要新增任务注册/注销机制

### 2. 任务队列系统 (`kernel/task/queue.go`)

```go
type Task struct {
    Action  string
    Handler reflect.Value
    Args    []interface{}
    Created time.Time
    Async   bool
    Delay   time.Duration
    Timeout time.Duration
}
```

**可复用点**：
- 任务结构体设计可参考
- 异步任务执行模式
- 超时控制机制

### 3. 文件监听系统 (`kernel/model/assets_watcher.go`)

```go
// 使用 fsnotify 实现文件变化监听
var assetsWatcher *fsnotify.Watcher

func WatchAssets() {
    assetsWatcher, _ = fsnotify.NewWatcher()
    // 监听 data/assets 目录变化
}
```

**可复用点**：
- fsnotify 已经作为依赖引入
- 可用于实现"监听本地文件夹变化"的功能

### 4. 存储机制 (`kernel/model/storage.go`)

```go
// 配置存储在 data/storage/ 目录下
// 例如: data/storage/local.json, data/storage/criteria.json
func setLocalStorage(val interface{}) (err error) {
    dirPath := filepath.Join(util.DataDir, "storage")
    // ...
}
```

### 5. 目录结构 (`kernel/util/working.go`)

```go
var (
    WorkspaceDir   string  // 工作空间目录
    DataDir        string  // data/ 目录，会被同步
    ConfDir        string  // conf/ 目录
    TempDir        string  // temp/ 目录，不会被同步
)
```

---

## 文学编程方案

### 核心理念

采用文学编程（Literate Programming）的思路，让用户直接在笔记文档中编写扩展代码：

- **整个文档**声明为一个扩展代码模块
- 文档内的**所有代码块按顺序连接**形成最终代码
- 非代码块的内容（段落、列表等）自动转换为注释

### 文档属性声明

使用**两个独立的文档属性**分别声明编译语言和应用目的：

| 属性 | 说明 | 示例值 |
|------|------|--------|
| `ext-lang` | 编译使用的语言 | `go` |
| `ext-type` | 扩展的应用目的 | `cronjob` |

### 配置通过代码导出

执行周期等元数据通过**代码导出变量/函数**的方式声明，而不是在文档属性中配置：

```go
// 导出的配置变量
var Name = "自动备份任务"
var Schedule = "*/5 * * * *"  // cron表达式
var Description = "每5分钟检查并推送变更"

// 导出的执行函数
func Run(ctx *CronContext) error {
    // 任务逻辑
    return nil
}
```

框架读取编译后的代码，通过 yaegi 获取导出的变量，再注册到调度器。

### 编译流程示例

**源文档（带 `ext-lang: go`, `ext-type: cronjob` 属性）**：

```markdown
这是一个定时备份任务的说明文档。

下面定义任务的基本配置：

​```go
package main

var Name = "自动备份"
var Schedule = "0 2 * * *"
​```

核心逻辑是检查文件变化并推送到 Git：

​```go
func Run(ctx *CronContext) error {
    // 执行备份逻辑
    return nil
}
​```
```

**编译产物（`temp/extensions/<docID>.go`）**：

```go
// 这是一个定时备份任务的说明文档。
// 
// 下面定义任务的基本配置：
// 
package main

var Name = "自动备份"
var Schedule = "0 2 * * *"
// 
// 核心逻辑是检查文件变化并推送到 Git：
// 
func Run(ctx *CronContext) error {
    // 执行备份逻辑
    return nil
}
```

### 存储结构

```
workspace/
├── conf/
│   └── extensions.json       # 记录已注册的扩展文档ID及其属性缓存
└── temp/
    └── extensions/           # 编译产物目录（不同步）
        └── <docID>.go        # 编译后的Go源码
```

### 扩展类型（当前）

| ext-type | 说明 | 必需导出 |
|----------|------|----------|
| `cronjob` | 定时任务 | `Name`, `Schedule`, `Run(ctx)` |

后续可扩展更多类型如 `api-ext`（动态API）、`hook`（事件钩子）等。

---

## 详细设计

### 1. 任务配置存储

由于定时任务不应跨设备同步，配置应存放在 **不被同步的目录** 中：

```
workspace/
├── temp/
│   └── cronjobs/              # 定时任务配置目录
│       ├── config.json        # 主配置文件
│       └── scripts/           # 用户脚本目录（可选）
│           └── *.go           # Go 脚本文件
```

或者使用 `conf/` 目录（根据现有模式）：

```
workspace/
├── conf/
│   └── cronjobs.json          # 定时任务配置
```

### 2. 任务配置结构

```go
// CronJobConfig 定时任务配置
type CronJobConfig struct {
    ID          string            `json:"id"`          // 唯一标识
    Name        string            `json:"name"`        // 任务名称
    Description string            `json:"description"` // 任务描述
    Enabled     bool              `json:"enabled"`     // 是否启用
    Schedule    CronSchedule      `json:"schedule"`    // 调度配置
    Action      CronAction        `json:"action"`      // 执行动作
    CreatedAt   int64             `json:"createdAt"`   // 创建时间
    UpdatedAt   int64             `json:"updatedAt"`   // 更新时间
    LastRunAt   int64             `json:"lastRunAt"`   // 上次执行时间
    NextRunAt   int64             `json:"nextRunAt"`   // 下次执行时间
    LastError   string            `json:"lastError"`   // 上次错误信息
}

// CronSchedule 调度配置
type CronSchedule struct {
    Type     string `json:"type"`     // "interval" | "cron" | "once"
    Interval string `json:"interval"` // 间隔，如 "5m", "1h", "24h"
    CronExpr string `json:"cronExpr"` // Cron 表达式，如 "0 0 * * *"
    RunAt    int64  `json:"runAt"`    // 一次性任务的执行时间戳
}

// CronAction 执行动作
type CronAction struct {
    Type   string                 `json:"type"`   // 动作类型
    Config map[string]interface{} `json:"config"` // 动作配置
}
```

### 3. 动作类型设计

#### 3.1 内置动作类型

| 类型 | 描述 | 配置参数 |
|------|------|----------|
| `http_request` | HTTP 请求 | `url`, `method`, `headers`, `body` |
| `git_push` | Git 推送 | `watchDir`, `remote`, `branch`, `commitMsg` |
| `watch_folder` | 文件夹监听触发 | `watchDir`, `onEvent` (create/modify/delete) |
| `execute_script` | 执行 Go 脚本 | `script` (内联代码或脚本路径) |
| `call_api` | 调用思源内部 API | `endpoint`, `params` |

#### 3.2 Git 推送动作示例配置

```json
{
    "id": "git-push-notes",
    "name": "自动推送笔记到 GitHub",
    "enabled": true,
    "schedule": {
        "type": "cron",
        "cronExpr": "0 */6 * * *"
    },
    "action": {
        "type": "git_push",
        "config": {
            "watchDir": "D:/notes/export",
            "remote": "origin",
            "branch": "main",
            "commitMsg": "Auto commit: {{.Time}}"
        }
    }
}
```

### 4. Yaegi 解释器集成

为支持灵活的脚本任务和后端动态扩展，引入 [yaegi](https://github.com/traefik/yaegi) Go 解释器：

```go
import "github.com/traefik/yaegi/interp"

// CronScriptExecutor 脚本执行器
type CronScriptExecutor struct {
    interpreter *interp.Interpreter
}

func NewCronScriptExecutor() *CronScriptExecutor {
    i := interp.New(interp.Options{})
    // 导入标准库
    i.Use(stdlib.Symbols)
    // 导入思源内部符号（受限）
    i.Use(siyuanSymbols)
    return &CronScriptExecutor{interpreter: i}
}

func (e *CronScriptExecutor) Execute(script string) error {
    _, err := e.interpreter.Eval(script)
    return err
}
```

#### 4.1 脚本示例：监听文件夹并推送到 Git

```go
// 可以在笔记代码块中定义
package main

import (
    "os/exec"
    "path/filepath"
)

func Run(ctx *CronContext) error {
    dir := ctx.Config["watchDir"].(string)
    
    // 执行 git 命令
    cmd := exec.Command("git", "-C", dir, "add", ".")
    if err := cmd.Run(); err != nil {
        return err
    }
    
    cmd = exec.Command("git", "-C", dir, "commit", "-m", "Auto commit")
    cmd.Run() // 忽略没有变化的情况
    
    cmd = exec.Command("git", "-C", dir, "push", "origin", "main")
    return cmd.Run()
}
```

#### 4.2 后端动态扩展接口

Yaegi 还可用于实现动态后端 API 扩展：

```go
// 动态注册 API 端点
// 脚本可以定义新的 HTTP 处理函数
func RegisterDynamicAPI(path string, handler func(ctx *gin.Context)) {
    // 在运行时动态添加路由
}
```

### 5. 核心模块设计

#### 5.1 新增文件结构

```
kernel/
├── cronjob/                    # 新增的定时任务模块
│   ├── cronjob.go              # 核心定义和类型
│   ├── manager.go              # 任务管理器
│   ├── scheduler.go            # 调度器
│   ├── executor.go             # 执行器
│   ├── script_executor.go      # Yaegi 脚本执行器
│   ├── actions/                # 内置动作
│   │   ├── http_request.go
│   │   ├── git_push.go
│   │   ├── watch_folder.go
│   │   └── call_api.go
│   └── storage.go              # 配置存储
├── api/
│   └── cronjob.go              # API 端点（新增）
```

#### 5.2 任务管理器

```go
// Manager 任务管理器
type Manager struct {
    jobs     map[string]*CronJob
    lock     sync.RWMutex
    executor *Executor
    storage  *Storage
}

func (m *Manager) Initialize() error {
    // 加载配置
    // 启动已启用的任务
}

func (m *Manager) AddJob(config *CronJobConfig) error
func (m *Manager) RemoveJob(id string) error
func (m *Manager) UpdateJob(config *CronJobConfig) error
func (m *Manager) GetJob(id string) (*CronJobConfig, error)
func (m *Manager) ListJobs() []*CronJobConfig
func (m *Manager) EnableJob(id string) error
func (m *Manager) DisableJob(id string) error
func (m *Manager) RunJobNow(id string) error  // 立即执行
```

### 6. API 端点设计

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/cronjob/list` | 列出所有定时任务 |
| POST | `/api/cronjob/get` | 获取单个任务详情 |
| POST | `/api/cronjob/create` | 创建定时任务 |
| POST | `/api/cronjob/update` | 更新定时任务 |
| POST | `/api/cronjob/delete` | 删除定时任务 |
| POST | `/api/cronjob/enable` | 启用任务 |
| POST | `/api/cronjob/disable` | 禁用任务 |
| POST | `/api/cronjob/run` | 立即执行任务 |
| POST | `/api/cronjob/logs` | 获取任务执行日志 |

### 7. 与笔记代码块集成

用户可以在笔记中使用特定格式的代码块定义任务：

````markdown
```cronjob
name: 每日备份推送
schedule: 0 2 * * *
action: git_push
watchDir: D:/notes/backup
remote: origin
branch: main
```
````

或者使用 Go 脚本：

````markdown
```cronjob-script
// name: 自定义任务
// schedule: */5 * * * *

package main

func Run(ctx *CronContext) error {
    // 自定义逻辑
    return nil
}
```
````

### 8. 目标功能实现：监听文件夹 + Git 推送

这是计划中明确要实现的核心功能：

```json
{
    "id": "folder-to-git",
    "name": "本地文件夹变化自动推送到 GitHub",
    "enabled": true,
    "schedule": {
        "type": "interval",
        "interval": "1m"
    },
    "action": {
        "type": "composite",
        "steps": [
            {
                "type": "watch_folder",
                "config": {
                    "dir": "D:/notes/export",
                    "recursive": true
                }
            },
            {
                "type": "git_push",
                "config": {
                    "remote": "https://github.com/user/repo.git",
                    "branch": "main",
                    "commitMessage": "Auto sync: {{.Time}}"
                }
            }
        ]
    }
}
```

---

## 实现阶段

### 阶段一：基础框架（MVP）
- [ ] 创建 `kernel/cronjob/` 模块基础结构
- [ ] 实现 CronJobConfig 配置类型
- [ ] 实现配置存储（`conf/cronjobs.json`）
- [ ] 实现基础调度器（基于 time.Ticker）
- [ ] 实现简单的任务管理器
- [ ] 添加基础 API 端点

### 阶段二：内置动作
- [ ] 实现 `http_request` 动作
- [ ] 实现 `git_push` 动作
- [ ] 实现 `watch_folder` 动作（基于 fsnotify）
- [ ] 实现 `call_api` 动作

### 阶段三：动态脚本
- [ ] 集成 yaegi 解释器
- [ ] 实现脚本执行安全沙箱
- [ ] 暴露受限的思源内部 API 给脚本
- [ ] 支持从笔记代码块读取脚本

### 阶段四：前端 UI
- [ ] 设计任务管理界面
- [ ] 实现任务创建/编辑表单
- [ ] 实现任务执行日志查看
- [ ] 实现笔记代码块语法高亮

### 阶段五：后端动态扩展
- [ ] 实现动态 API 端点注册
- [ ] 支持脚本定义新的 HTTP 处理函数
- [ ] 热加载和热更新机制

---

## 安全考虑

1. **脚本沙箱**：yaegi 执行器应限制可访问的包和功能
2. **文件访问控制**：限制脚本只能访问特定目录
3. **网络访问控制**：可选地限制外部网络请求
4. **执行超时**：所有任务必须有超时限制
5. **资源限制**：限制并发任务数量

## 依赖

```go
// go.mod 新增依赖
require (
    github.com/traefik/yaegi v0.16.1  // Go 解释器
    github.com/robfig/cron/v3 v3.0.1  // Cron 表达式解析（可选）
)

// 已有依赖，可直接使用
// github.com/fsnotify/fsnotify v1.9.0  // 文件监听
```

## 参考

- 现有定时任务实现：`kernel/job/cron.go`
- 任务队列实现：`kernel/task/queue.go`
- 文件监听实现：`kernel/model/assets_watcher.go`
- 存储机制：`kernel/model/storage.go`
- API 路由注册：`kernel/api/router.go`