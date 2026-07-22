# Forge 模式后端热重启与版本回退（TikTocTak）

> **最终目标**：从源码启动的 S-Forge 在 Kernel 源码形成可验证提交后，允许原生 Agent 发起、用户逐次复核、Forge Supervisor 执行全量验证、重编译、优雅重启、健康检查与自动回退；浏览器前端可由 Agent 独立触发页面重载。
>
> **当前目标**：Phase 6 重新打开：修复 Forge 默认工作空间路径回归，完成真实默认启动重验后再归档。
>
> **下一步任务**：验证默认启动参数固定指向仓库内 `.dev-workspace`，重跑 Supervisor 测试和真实默认启动，核对 Kernel 进程命令行后恢复服务。

---

## 不变量

1. Kernel 重编译仅在 `forge` 源码启动模式且存在有效 Supervisor 时可用，普通开发、生产、移动端和直接 MCP 调用均不触发核心切换。
2. 每次 Kernel 重启都要求本次用户确认；会话级“始终允许”不得豁免核心重启复核。
3. 重启门禁固定包含：Git 工作树干净、当前 HEAD 不等于运行版本、提交差异包含 `kernel/` 后端源码、Go 格式检查、`go vet -tags fts5 ./...`、`go test -short -tags fts5 ./...` 和候选构建成功；短模式只由各测试按其性能、规模或外部数据依赖性质显式排除，不收窄包范围。
4. 门禁、构建、停机、启动和健康检查任一步失败都必须形成可查询的失败状态及日志，不得静默跳过。
5. Supervisor 在停止当前核心前完成候选构建并保留当前可执行文件；候选启动失败时自动拉起上一个已知可用版本。
6. 版本目录仅保存不可变二进制和元数据，保留数量有固定上限；运行中的版本不被清理。
7. 前端页面重载与 Kernel 重编译是两个独立能力，不以参数分支强行共享生命周期逻辑。
8. Bash/命令工具在人工确认前必须先经独立配置的审核模型判断；Forge 源码命令额外审查绕过重启门禁的意图。审核请求失败、超时或返回格式异常时明确阻断，不静默放行。
9. 前端刷新只以前端测试结果作为门禁证据；lint 仅用于开发质量反馈，不得阻断前端刷新。
10. 用户从现有界面执行正常退出时必须同时结束 Kernel 与 Forge Supervisor；仅非零退出或信号终止按崩溃恢复，不得让 Supervisor 把正常退出重新拉起。

## 现状基线

- `app/scripts/forge-start.js` 只执行一次 `go build`，随后以前台子进程运行 Kernel；Kernel 退出后父脚本结束，不持有重启状态。
- Forge 原生 Agent 已有源码读写、命令和 Git 工具，写操作使用现有确认卡片，但没有重启工具。
- `frontend` 工具已通过 SSE 将动作交给 Agent Panel 宿主执行，但没有页面重载动作，且细粒度能力中没有重载 Port。
- `s-code/.opencode/tool/evolve.ts` 已验证交替产物和父/子进程交接思路；本任务增加 Git、全量测试、逐次复核、健康检查和自动回退，不直接复制其无门禁自杀流程。

## 目标架构

```text
Agent -> confirm card -> forge_runtime_restart
                         |
                         | loopback token + internal approval capability
                         v
                 Forge Supervisor (Node parent)
                 1. clean Git / revision / kernel diff
                 2. gofmt / go vet / all kernel tests
                 3. build immutable candidate
                 4. graceful shutdown current Kernel
                 5. start candidate + health probe
                 6. promote or restart previous version

Agent -> frontend(reload_app) -> FrontendReloadPort -> current browser reload
```

## 近期计划

- [x] **Phase 1：Supervisor 协议与确定性门禁（P0）** [已完成 2026-07-22]
  - **行动**：拆分可测试的 Supervisor 模块；实现本地认证控制端点、单任务互斥、Git/变更/格式/vet/测试/构建门禁、结构化状态和日志。
  - **验收标准**：自动化测试覆盖脏工作树、无 Kernel 变化、测试失败、并发请求、成功候选与未认证请求。

- [x] **Phase 2：版本切换、健康检查与回退（P0）** [已完成 2026-07-22]
  - **行动**：使用不可变版本目录启动 Kernel；保留最近版本；通过内部本地端点优雅停机；候选健康检查失败后启动上一版本。
  - **验收标准**：进程替身测试证明切换成功、失败回退和版本清理不会删除运行版本。

- [x] **Phase 3：Agent 人在回路工具（P0）** [已完成 2026-07-22]
  - **行动**：增加只读状态工具与重启请求工具；重启 Handler 要求 Agent 内部复核 capability；逐次确认不接受“始终允许”豁免。
  - **验收标准**：直接 Handler/MCP 调用被阻断；确认后的 Agent 调用可提交任务；状态工具不要求确认。

- [x] **Phase 4：前端细粒度重载能力（P1）** [已完成 2026-07-22]
  - **行动**：增加 `FrontendReloadPort`，完整 App 和独立浏览器宿主分别注入；Agent 的 `reload_app` 动作先回传执行结果再重载页面。
  - **验收标准**：动作路由测试通过，缺失能力时返回明确错误，不影响设置、编辑器和插件动作 Port。

- [x] **Phase 5：Bash 独立模型审核与重启绕过防护（P0）** [已完成 2026-07-22]
  - **行动**：参考 `D:/dev/s-code/packages/opencode/src/session/bash-review.ts` 的独立纯文本审核会话语义，为所有原生 Agent 命令工具增加通用风险审核；Forge 源码命令追加绕过 Supervisor、门禁、受保护测试审批、版本切换或回退链的专项判断。审核模型在 AI 设置中独立选择，不继承当前会话临时选模；保留确定性生命周期阻断、Supervisor 凭据隔离与意外退出后同版本恢复作为纵深约束。
  - **验收标准**：安全命令放行；危险命令、重启绕过意图、审核网络错误、超时和无效格式均明确阻断；单元测试不调用真实模型且覆盖各分支。

- [ ] **Phase 6：集成与运行验收（P0）** [路径回归修复与重验中 2026-07-22]
  - **行动**：执行 Go 单元测试、目标全量门禁测试和前端测试；在不直接读取开发工作空间配置与凭据的前提下验证 Supervisor 启动和状态查询。前端 lint 结果可记录，但不属于刷新门禁。
  - **验收标准**：测试证据写入本文；当前工作树未满足清洁门禁时明确记录预期阻断，不伪造真实核心切换成功。

## 中期计划

- [ ] 在 Agent Panel 增加可视化重启任务进度和“连接恢复”状态，而不是依赖 Agent 再次查询。
- [ ] 为前端构建产物增加独立的宽松重载门禁，保持与 Kernel 全量门禁分离。
- [ ] 评估跨平台守护进程、系统服务和 Electron 宿主的统一 Supervisor 协议。

## 远期计划

- [ ] 支持经签名的候选版本元数据、重启审计历史和显式选择历史版本。
- [ ] 支持数据库/配置迁移声明，在不满足向后兼容条件时阻断自动回退。

## 风险

- Windows 不能覆盖运行中的可执行文件，因此候选必须使用不可变唯一路径。
- 全量 Kernel 测试可能耗时较长，任务必须异步运行并持续保留阶段与日志摘要。
- 新版本可能已经启动但业务初始化未完成，健康检查必须同时验证进程存活和 Kernel HTTP 版本端点。
- 数据格式迁移可能使二进制回退失效；首版只保证进程级回退路径，并在元数据中明确该边界。

## 验收标准

- [ ] `pnpm forge` 使用仓库内 `.dev-workspace` 启动，且由 Supervisor 持有 Kernel 子进程；Kernel 意外退出不会被误判为成功切换。
- [ ] 界面“退出应用”可结束 Kernel 和 Supervisor；正常退出不自动恢复，崩溃退出仍恢复当前已验证版本。
- [x] Agent 可自行调用 `frontend(action=reload_app)` 重载当前页面。
- [x] Agent 发起 Kernel 重启时每次出现人在回路复核，直接 MCP 调用不能触发。
- [x] 所有 Agent Bash/命令调用先经独立模型审核；Forge 源码场景额外识别重启绕过意图，模型审核异常时失败关闭。
- [x] Bash 子进程不继承 Supervisor 地址、令牌和源码根环境；显式生命周期命令被确定性阻断，核心意外退出时仅恢复记录中的不可变活动版本。
- [x] 脏 Git、无新提交、无 Kernel 变化、格式/vet/任一测试失败均阻断重启并可查询原因。
- [x] 候选构建完成前现有 Kernel 持续运行。
- [x] 新 Kernel 健康检查通过后才晋升为当前版本；失败时自动拉起上一版本。
- [x] 至少保留 3 个可拉起核心版本，清理逻辑不删除当前和回退目标。
- [x] 相关 Go/Node/前端测试通过，TTT 记录实现文件与证据；lint 仅作为非阻断质量记录。

## 已归档/已完成

- [x] **2026-07-22：现状调查与架构决策**
  - **完成情况**：确认 Forge 父进程当前不保活；确认现有 Agent 确认机制可扩展但“始终允许”需要对重启单独禁用；确认 `s-code` 使用交替不可变产物；确定采用 Supervisor 控制面而非 Kernel 自行覆盖并拉起自身。
  - **调查文件**：`app/scripts/forge-start.js`、`kernel/agent/agent.go`、`kernel/mcp/tools/forge.go`、`kernel/model/conf.go`、`D:/dev/s-code/.opencode/tool/evolve.ts`

- [x] **2026-07-22：Supervisor、门禁与不可变版本链**
  - **完成情况**：`forge-start.js` 改为长驻父进程；新增本地令牌控制面、互斥任务、Git 清洁/提交差异/Kernel 运行时代码变化/gofmt/vet/全量测试/二次源码稳定性门禁；构建产物写入 `.forge-runtime/versions`，状态与完整命令输出写盘，CLI 仅输出阶段摘要。
  - **成果文件**：`app/scripts/forge-runtime-supervisor.js`、`app/scripts/forge-start.js`、`.gitignore`、`app/test/forge-runtime-supervisor.test.js`
  - **验证证据**：Supervisor 单元测试 9/9 通过，覆盖未认证、并发、脏工作树、仅测试变化、回退、终态、版本清理和完整启动进度门禁。

- [x] **2026-07-22：Kernel Agent 工具与逐次复核**
  - **完成情况**：新增只读 `forge_runtime_status` 和写入型 `forge_runtime_restart`；重启 Handler 要求不可由 JSON/MCP 构造的进程内 approval capability；重启忽略会话“始终允许”，前端确认卡不显示该按钮；新增回环令牌停机端点并使用 `setCurrentWorkspace=false` 避免内部重启修改最近工作空间。
  - **成果文件**：`kernel/mcp/tools/forge_runtime.go`、`kernel/agent/tools.go`、`kernel/agent/agent.go`、`kernel/api/forge_runtime.go`、`kernel/util/forge_supervisor.go` 及对应测试。
  - **验证证据**：`util`、`mcp/tools`、`agent`、`api` 四包定向测试通过；同范围 `-race` 通过；`go vet -tags fts5` 定向检查已执行。

- [x] **2026-07-22：前端重载细粒度 Port 与宿主边界**
  - **完成情况**：新增 `FrontendReloadPort`；完整 App 与独立 Agent 页复用同一浏览器重载 factory；工具结果 POST 成功后才同步重载；App 宿主 capability、菜单 factory 和依赖网关收口至 `runtime/host/`。
  - **成果文件**：`agentPanel.ports.types.ts`、`runtime/host/*`、`AgentChat.ts`、`agent-standalone/capabilities.browser.ts`、`kernel/mcp/tools/frontend.go`。
  - **验证证据**：前端重载测试 1/1 通过；所有新增/迁移宿主文件定向 lint 通过。`AgentChat.ts` 全文件仍仅报告既有超大文件/超长函数债务，本次新增分支未引入其它 lint 类别。

- [x] **2026-07-22：真实 Kernel Supervisor 启停验证**
  - **完成情况**：在随机临时端口和系统临时工作空间中两次执行真实 `fts5` Kernel 构建、`--version` 冒烟、HTTP 启动、健康探针、令牌停机和进程退出；未读取 `.dev-workspace`。第一次验证发现版本端点过早可用，随后将健康条件收紧为 `bootProgress=100` 加有效版本端点；第二次验证通过且无“意外退出”误报。
  - **成果文件**：`app/test/forge-runtime-supervisor.integration.test.js`
  - **验证证据**：真实进程测试两次通过，第二次耗时约 23 秒完成测试主体；临时工作空间已删除，测试引入的失效最近工作空间记录已清理。

- [x] **2026-07-22：命令审核与保护基础设施**
  - **完成情况**：新增独立 `AI.commandReview` 模型/超时配置；所有 Agent Bash 与任务目录命令在人工确认前执行失败关闭的语义审核；Forge 源码命令额外审核绕过 Supervisor、Git、门禁测试、受保护文件审批、版本切换和回退链的意图。审核仅接受首行 `SAFE:`/`UNSAFE:`，请求错误、超时和无效输出均明确阻断。Supervisor 凭据不进入 Bash 环境，显式 Kernel/Supervisor 生命周期命令另有确定性阻断。
  - **成果文件**：`kernel/agent/command_review.go`、`kernel/conf/ai.go`、`kernel/mcp/tools/forge_protection.go`、AI 设置页及对应测试。
  - **验证证据**：命令审核单测及 `-race` 通过；Forge 保护测试通过；Supervisor 14/14 通过；前端生产目标构建通过。

- [x] **2026-07-22：核心短测试范围审计与向量并发基底修复**
  - **完成情况**：保持 `./...` 包范围；明确的性能、规模、参数扫描、外部数据集、CPU Profile、吞吐量和内存测量测试在 `testing.Short()` 下显式跳过。修复 HNSW 扩容复制已加锁 Mutex、邻居切片并发读取和索引操作时序；修复 Vamana `TestNodeCacheConcurrent` 未等待工作协程及跨协程共享 `rand.Rand`，未在生产路径增加空值回退。
  - **成果文件**：`kernel/vectordb/hnsw/types.go`、`kernel/vectordb/hnsw/utils.go`、`kernel/vectordb/hnsw/delete.go`、`kernel/vectordb/hnsw_proxy.go`、`kernel/vectordb/vamana/node_cache_test.go` 及短模式标注测试。
  - **验证证据**：`TestHNSWRobustness -count=10` 与 `-race` 通过；`TestNodeCacheConcurrent -count=10` 与 `-race` 通过；`go test -short -tags fts5 ./vectordb ./vectordb/hnsw ./vectordb/vamana` 全部通过（22.781s、0.622s、46.511s）。

- [x] **2026-07-22：集成、前端测试门禁与运行验收**
  - **完成情况**：新增 `test:agent-panel`，按功能域执行 `test/layout/dock/agent/**` 与 `test/magi/**` 全部测试；Dock 工厂测试更新到迁移后的 Host capability 路径，并显式注入平台探测所需的最小 DOM 契约。启动真实长驻 Forge Supervisor，确认活动版本为 `healthy`；只读调用真实源码门禁确认当前脏工作树被 `Git worktree is not clean:` 阻断。前端刷新不执行 lint，测试是唯一刷新门禁证据。
  - **成果文件**：`app/package.json`、`app/test/layout/dock/agent/dock.factory.test.ts` 以及本任务全部 Supervisor、Kernel 工具、Host Port 和保护测试文件。
  - **验证证据**：固定核心门禁与独立 vet 通过；Supervisor 14/14 与真实进程集成测试通过；Agent/MAGI 前端 21 文件、56 用例通过；主应用、独立 Agent、MAGI Desktop/Mobile/Identity HTTP 均为 200；浏览器验证独立 Agent 无控制台错误，MAGI 桌面和 `390x844` 移动访问引导正常渲染，移动端 `scrollWidth=viewportWidth=390`。当前开发工作空间没有 AI 主笔记本，因此未执行会创建数据的操作。

## 滚动记录

- **2026-07-22**：创建任务文档。登记当前工作树已有 Agent Panel/MAGI 未提交修改；实现过程中只追加本任务变更，不清理或覆盖既有修改。真实热重启门禁会因当前 Git 非清洁而按设计阻断，协议与切换行为使用隔离测试验证。
- **2026-07-22**：Phase 1-4 完成。Supervisor 只保留 `healthy` 历史版本，失败候选不占回退名额；任务状态公开相对日志路径。进入 Phase 5 全量验证。
- **2026-07-22**：根据绕过风险复核新增 Phase 5。现有命令黑名单仅作为确定性显式拦截，不承担语义审核职责；新增独立命令审核模型及 Forge 进化专项提示，审核链必须失败关闭。关联 Agent Panel 能力扩展任务：`AgentPanel_能力扩展与MAGI持续会话.ttt.md`，设置入口沿用其细粒度可扩展配置方向。
- **2026-07-22**：Phase 5 实现中。新增 `AI.commandReview` 独立模型/超时配置、设置页独立选择器和 `kernel/agent/command_review.go`；所有 Agent Bash 与任务目录命令在人工确认前审核，Forge 源码命令追加受控重启专项规则。审核输出严格解析首行 `SAFE:`/`UNSAFE:`，请求错误、超时、空响应或格式错误均返回可见阻断结果。当前证据：命令审核单测 4 组通过，Forge 命令保护测试通过，Supervisor 14/14 通过（含活动不可变版本意外退出恢复）。
- **2026-07-22**：核心门禁审计发现两类基底问题。其一，`finishHeartbeat` 在全员休眠分支漏写 `Downtime/Awake/LastDowntimeAt`，已修生产状态机且对应功能测试通过。其二，`kernel/api/vector_test.go` 使用空 HTTP body、旧 `vectors/keys` payload，与当前 SDK/前端 `points/ids` 契约不一致；多个明确的规模/CPU profile 测试未在 `testing.Short()` 下跳过，并在门禁运行时改写仓库内 `.prof`。已向用户请求受保护测试修改授权；授权前不修改这些测试，不以包白名单绕开失败。
- **2026-07-22**：将 `kernel/agent/command_review.go` 与 `kernel/conf/ai.go` 加入工具侧和 Supervisor 侧受保护基础设施集合，避免 Agent 先弱化审核器或独立模型解析再调用命令。对应 Go 保护测试及 Supervisor 14/14 再次通过；前端 App 生产构建通过；审核单测 `-race` 通过。当前固定门禁仍由受保护测试授权事项阻塞，Phase 5 保持未归档。
- **2026-07-22**：用户明确批准受保护测试调整。`kernel/api/vector_test.go` 已按当前 SDK/前端契约重写为真实 JSON HTTP body，保留创建、插入、查询、键/状态、删除后查询和重建全链路断言，并消除错误响应后的类型断言二次 panic。明确的性能、规模、外部 SIFT1M 数据集、吞吐量与 CPU Profile 测试已增加 `testing.Short()` 标记；`./...` 包范围未改变。短模式跳过验证与向量/MAGI 功能测试均通过，进入固定全包门禁。
- **2026-07-22**：向量包完整短测试通过。Vamana 并发缓存用例的 panic 被确定为测试清理早于工作协程退出，并伴随共享随机源数据竞争；测试现已等待全部搜索/插入协程，并为每个插入器使用独立固定种子。10 次重复运行和 `-race` 均通过，随后三个向量包完整短测试通过。下一步执行固定 `go test -short -tags fts5 ./...`，不以包白名单替代门禁。
- **2026-07-22**：首次固定门禁 `go test -short -tags fts5 ./...` 在 40.8 秒后明确失败。失败分为三组：`coordinator` 的直接回复测试意外进入真实笔记全文搜索并因未初始化模型配置 panic；`prompts` 两个唤醒测试对 Melchior 身份维度的期待与当前输出不一致；Go 1.25 对 `filesys`、`mobile`、`model`、`server` 中非常量格式字符串调用给出构建级静态检查错误。向量包在本次全量门禁中仍通过。上述失败不通过缩小门禁或增加静默回退处理，进入逐项契约审计和修复。
- **2026-07-22**：首次门禁问题已完成确定性修复。直接回复路径不再执行仅供 `AllowWannaSleep` 分支消费的 `#todo#` 预取，并新增零搜索断言；唤醒测试改为校验当前人格预设的 `Professional/InstinctNeeds/Life` 字段本身，不绑定旧版文案；心跳测试按“行动计划→选举→响应”协议提供脚本并注入隔离的笔记搜索，笔记工具参数更新为带 `purpose` 的 `query`；治理投票 mock 在多工具场景按显式 `decision` 投影为 `vote` 调用；审查载荷测试改为解析 JSON 并逐字段校验原始工具调用。Go 1.25 动态格式串问题按用途改为非格式化日志 API、`errors.New` 或直接字符串。验证证据：三个问题用例各连续 3 次通过，`prompts` 通过，`coordinator` 完整短测试通过（35.893s），`filesys/mobile/model/server` 通过。
- **2026-07-22**：第二次固定核心门禁 `go test -short -tags fts5 ./...` 完整通过，耗时 39.8 秒。随后独立 `go vet -tags fts5 ./...` 继续发现四组全包问题：Windows mmap 的 `unsafe.Pointer` 转换、`RelTimeMagnitude` 未命名字段初始化、无缓冲 `os.Signal` 通道、MAGI API 测试复制含锁的 `sync.Map`。独立 vet 保持为必过门禁，进入逐项修复，不以测试命令已通过替代。
- **2026-07-22**：独立 vet 问题已修复。Windows Vamana 存储改由仓库现有 `mmap-go` 持有映射切片及句柄生命周期；相对时间表改为命名字段；信号通道增加单元素缓冲；MAGI API 测试通过遍历快照、`Clear` 和逐项恢复隔离 `sync.Map`，不复制锁。相关四包测试通过，`go vet -tags fts5 ./...` 完整通过；修改后的第三次 `go test -short -tags fts5 ./...` 再次完整通过，耗时 74.4 秒。
- **2026-07-22**：Supervisor 单测 14/14 通过；真实进程集成测试完成不可变 Kernel 构建、版本冒烟、临时工作空间启动、完整启动进度健康探针和优雅停机，测试主体约 22 秒。前端细粒度重载、MAGI 身份同步和主界面持续会话共 3 个 Vitest 文件、5 个用例全部通过。`git diff --check` 通过。新增 Supervisor、Host Port 和测试文件定向 lint 无错误；`aiUi.ts` 与 `aiTab.ts` 的尺寸规则在 HEAD 基线已失败（HEAD 分别 1140/170 行，当前 1145/188 行，报错函数未由本次差异修改）。全项目只读 lint 还包含 Electron 环境、专用违规夹具和大量旧模块债务，输出超过 1.4 万行；该结果仅作非阻断质量记录，不参与前端刷新门禁，也不在本任务中无边界重构。
- **2026-07-22**：根据用户校正，明确 lint 不属于前端刷新门禁，只有测试属于。默认 `vitest --run` 的全仓发现将 `node:test` 文件误判为无套件、以 Node 环境运行 DOM 测试，并收集引用已删除模块的旧测试；该配置结果不作为门禁。新增按功能域固定的 `test:agent-panel`，覆盖 Agent Dock 与 MAGI 全部 21 个测试文件并通过 56 个用例，不按单次通过结果挑选文件。
- **2026-07-22**：真实 Forge 服务在 `127.0.0.1:6806` 启动并保持运行，Supervisor 状态为 `forge-source-supervisor`、活动不可变版本为 `healthy`。主应用、Agent 独立页、MAGI Desktop/Mobile/Identity 均返回 200；真实工作树门禁明确返回 `Git worktree is not clean:`，未进入编译或切换阶段。Phase 6 与近期任务全部归档。
- **2026-07-22**：重新打开 Phase 6。热重启改造把旧脚本在 `app/kernel` 下解析的 `--workspace=../../.dev-workspace` 错误翻译为 `path.resolve(repoRoot, "..", ".dev-workspace")`，导致真实默认启动从 `D:/dev/s-forge/.dev-workspace` 偏移到 `D:/dev/.dev-workspace`。错误 Supervisor（PID 35164）和 Kernel（PID 6072）已停止，`6806` 已释放。错误 Kernel 的启动流程已经读取该工作空间配置，并执行证书、临时数据库和索引等初始化；不删除该目录、不把影响描述为原有默认行为。修复将默认路径固定为 `path.resolve(repoRoot, ".dev-workspace")`，并增加直接断言默认启动配置的回归测试；完成测试与真实进程命令行核验后再归档。
- **2026-07-22**：默认路径回归测试与既有 Supervisor 单测合计 15/15 通过。真实临时工作空间集成测试没有通过：Kernel 接受优雅停机请求后与 Pandoc 延迟初始化发生交错，30 秒内未退出；清理钩子已终止 PID 47088，临时目录已删除，随机端口与 `6806` 均已释放。该失败保持可见并继续调查，不计作验收通过。
- **2026-07-22**：补充界面退出语义。复用现有“退出应用”界面入口：Kernel 以退出码 0 正常结束时，Supervisor 关闭自身控制服务并结束 Forge 进程链；非零退出或信号终止仍执行已验证版本恢复。增加进程替身测试，防止正常退出被错误重启。
- **2026-07-22**：路径和退出语义变更后的 Supervisor 单测 16/16 通过。重新加载新代码后的真实 Supervisor PID 24480、Kernel PID 62244；Kernel 实际参数为 `--workspace=D:/dev/s-forge/.dev-workspace`，`6806` 监听且 `/api/system/version` 返回 HTTP 200 与版本 `3.7.1-alpha.1`。Phase 6 仍因临时工作空间集成测试的停机竞态保持打开，不提前归档。
