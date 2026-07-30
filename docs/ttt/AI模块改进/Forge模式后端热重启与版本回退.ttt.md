# Forge 模式后端热重启与版本回退（TikTocTak）

> **最终目标**：从源码启动的 S-Forge 在 Kernel 源码形成可验证提交后，允许原生 Agent 或已登录的同设备主界面发起验证与热切换、用户逐次复核受保护变更、Forge Supervisor 执行全量验证、重编译、优雅重启、健康检查与自动回退；浏览器前端可由 Agent 独立触发页面重载。
>
> **当前目标**：Forge 热切换前端接续协议已部署到活动 Kernel `39cfb62bc3599c190b34b3003f2a4117b7549a05`；在下一次包含真实 Kernel 修改的上游语义合并阶段，验收浏览器进入隔离等待页并自动恢复到精确健康 revision。
>
> **下一步任务**：恢复上游 Issue 8554 系列的逐提交语义合并；下一次 Kernel 阶段提交继续执行人工审批、完整核心门禁和热切换，同时以实际主应用页面完成新连续性协议的端到端验收。

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
11. Forge 运行时只有一个认证控制面：新 CLI 发现同工作空间的健康 Supervisor 时必须复用其控制面并请求受控更新，不得因端口冲突创建第二个 Kernel；控制租约失联时仅在其记录 PID 已退出后隔离陈旧租约，PID 仍存活则明确阻断。
12. Git 提交验证与运行时部署是两个独立状态：`pre-commit` 只对暂存差异执行格式检查和按变更域选择的固定测试，绝不读取 Supervisor、活动 Kernel、审批或历史部署状态；`post-commit` 仍自动发起受控热切换并写入持久状态。部署失败阻断 delivery 的 `integrated` 标记和下一次替换验收，但不阻断独立 Git 提交。
13. 每个后端运行时提交必须实际热切换。每次 crash、候选启动/健康失败、意外退出和回退都写入独立结构化 incident，包含版本、二进制哈希、PID、exit code/signal、job phase、健康错误、恢复尝试和结果，且不记录控制凭据。
14. `pnpm forge` 启动入口在安装 hooks、探测端口或接管进程前必须确认整个 Git 工作树和索引干净；暂存、未暂存或未跟踪文件任一存在都明确列出并阻断启动。
15. 人工主界面控制面不复用 Agent 的进程内确认 capability，也不向前端公开 Supervisor 地址或令牌；公开 Kernel 路由必须同时满足登录态、管理员、非只读、同设备、同源 JSON 请求，并拒绝工作空间 API Token、插件 JWT、BasicAuth 和 query token 作为该 UI 通道的凭据。
16. 直接 WebUI 入口只能请求同一 Supervisor 门禁，不能提供跳过测试、跳过 Git 校验或直接杀启 Kernel 的参数；受保护变更审批必须由 Supervisor 再次核对当前 pending job、状态、阶段、`jobId` 与 `revision`，过期、拒绝和不匹配均明确失败并写盘。
17. 人工退出、信号退出和非 Forge 退出事件继续导航到 `about:blank`；只有通过 Supervisor 回环鉴权的受控切换可携带可恢复标记。等待文档必须与原应用 DOM/JS 上下文隔离，不持有 Supervisor 凭据，且只在 `jobId`、终态、健康版本和 `targetRevision` 契约一致时恢复原同源 URL；任何解析、鉴权或校验失败均保持隔离并可见报错。

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

Human -> main UI status control -> authenticated Kernel WebUI API
                                  -> same Forge Supervisor gate
                                  -> visible exact approval dialog when required

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

- [ ] **Phase 6：集成与运行验收（P0）** [在线控制面与迁移重验中 2026-07-24]
  - **行动**：执行 Go 单元测试、目标全量门禁测试和前端测试；在不直接读取开发工作空间配置与凭据的前提下验证 Supervisor 启动、认证控制租约、同工作空间复用和已提交 Kernel 更新的受控切换。前端 lint 结果可记录，但不属于刷新门禁。
  - **验收标准**：测试证据写入本文；当前工作树未满足清洁门禁时明确记录预期阻断，不伪造真实核心切换成功；旧控制面无租约时明确要求一次正常退出迁移，不创建第二 Kernel。

- [x] **Phase 7：主界面人工控制面与主动审批（P0）** [已完成 2026-07-30]
  - **行动**：在完整桌面/Web 主应用状态栏注册 Forge Runtime 控制入口；通过 Kernel 公开 API 查询状态、直接发起验证与热切换；轮询发现受保护变更时主动显示文件清单及批准/拒绝弹窗。MAGI、移动端与独立窗口不通过全局断点或条件分支复用该入口。
  - **鉴权**：路由保留 `CheckAuth + CheckAdminRole + CheckReadonly`，Handler 追加真实同设备来源、协议与主机均一致的严格同源校验、精确 `application/json` 媒体类型校验与通用 Token 凭据拒绝；Kernel 代持唯一回环 Supervisor 凭据。Agent Bash 明确阻断 WebUI Runtime URL，CLI 凭据继续只允许状态与重启，不能审批。
  - **验收标准**：无需 Agent 消息即可打开控制面并发起任务；相同 pending `jobId + revision` 只弹一次；错误在界面可见；API Token、插件 JWT、BasicAuth、query token、跨源、远端和非 JSON 请求均不触达 Supervisor；真实审批、全量门禁和热切换通过。

- [ ] **Phase 8：热切换期间的安全前端接续（P0）** [协议已部署，等待下一次 Kernel 切换端到端验收 2026-07-30]
  - **行动**：Supervisor 在停止旧 Kernel 前向专用 shutdown 端点传入当前 `jobId` 和候选 `targetRevision`；Kernel 仅在回环根凭据校验成功且请求体严格合法时广播 `forge-restart` 退出上下文。浏览器立即导航到同源 Blob 隔离文档，持续查询公开 Kernel WebUI 状态 API，仅在精确任务完成且活动健康 revision 匹配时恢复原页。
  - **安全边界**：等待页不继承 App DOM、内存状态、插件对象或 Supervisor 凭据；CSP 只允许内联等待逻辑与原同源状态连接；原 URL 必须是无用户信息、无 `token` 查询的 HTTP(S) 同源地址。回滚、失败、任务不匹配、鉴权失效和超时均不自动进入未验证应用。
  - **实现文件**：`app/scripts/forge-runtime-supervisor.js`、`kernel/api/forge_runtime.go`、`kernel/model/conf.go`、`app/src/index.ts`、`app/src/sforge/forgeRuntime/types.ts`、`app/src/sforge/forgeRuntime/exitContinuity.ts`；契约测试位于 `app/test/forge-runtime-supervisor.test.js`、`kernel/api/forge_runtime_test.go`、`app/test/sforge/forgeRuntime.exitContinuity.test.ts` 与 `app/test/browser/sforge/forgeRuntimeRecovery.browser.ts`。
  - **自动化证据（2026-07-30）**：Forge 前端专项 15/15、Chromium Blob 隔离与恢复 3/3（精确成功、失败隔离、健康回滚后人工返回）、Supervisor 40/40、Kernel API Forge Runtime 专项及 `go test ./model` 通过；完整 `pnpm test` 通过 Node 254 项与 Vitest 877 项；`pnpm dev:once` 的 11 个目标全部编译成功；本批文件定向 TypeScript、`gofmt -d`、新增实现 lint 与 `git diff --check` 通过。
  - **类型状态**：完整 `pnpm typecheck` 仍被 Agent standalone、AppFacade、异步化、PDF、Layout/Protyle 等既有迁移诊断阻断；本批新增文件定向检查为零，`src/index.ts` 新增退出分支没有新增诊断。该事实不记为完整类型检查通过，也不在本阶段扩大修改范围。
  - **部署证据（2026-07-30）**：提交 `39cfb62bc` 后，任务 `2026-07-30T00-36-01.224Z-a1576038` 精确识别 `kernel/api/forge_runtime.go` 与 `kernel/model/conf.go`，经主界面人工批准，依次通过 `gofmt`、`go vet -tags fts5 ./...`、`go test -short -tags fts5 ./...`、候选构建和健康切换；候选 `2026-07-30T00-37-43.303Z-39cfb62bc359-candidate` 于 `00:37:59Z` 晋升。唯一 Supervisor PID `32436` 未变，活动版本为 `healthy` 且 revision 精确匹配 `39cfb62bc3599c190b34b3003f2a4117b7549a05`。
  - **首次切换边界**：停止方仍是未携带 `forge-restart` 退出上下文的旧 Kernel，因此浏览器此次按原安全语义进入 `about:blank`，不计为新协议端到端通过；主应用随后已恢复至 `/stage/build/desktop/` 并正常渲染。重复 post-commit 请求在目标 revision 已由主界面任务切换后留下失败 operation，内置 `retry-post-commit` 已以 operation `2026-07-30T00-45-26-209Z-39cfb62bc359-b8fbea89` 收口为 `completed`，Kernel、Supervisor 与六个页面探针通过。
  - **验收标准**：Go 测试覆盖 shutdown 鉴权和请求契约；Node 测试覆盖 Supervisor 精确转发；前端契约与浏览器测试覆盖普通退出、安全隔离、错误可见、任务/revision 不匹配阻断和成功自动恢复；真实核心门禁和热切换通过。

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
- [ ] 再次执行 `pnpm forge` 时，认证控制租约存在则对比活动版本与当前提交：Kernel 运行时代码变化走同一 Supervisor 的门禁、构建、切换与回退链；无 Kernel 变化直接附着；旧无租约进程明确提示迁移，不以新端口绕过工作空间锁。
- [ ] 界面“退出应用”可结束 Kernel 和 Supervisor；正常退出不自动恢复，崩溃退出仍恢复当前已验证版本。
- [x] Agent 可自行调用 `frontend(action=reload_app)` 重载当前页面。
- [x] Agent 发起 Kernel 重启时每次出现人在回路复核，直接 MCP 调用不能触发。
- [x] 所有 Agent Bash/命令调用先经独立模型审核；Forge 源码场景额外识别重启绕过意图，模型审核异常时失败关闭。
- [x] Bash 子进程不继承 Supervisor 地址、令牌和源码根环境；显式生命周期命令被确定性阻断，核心意外退出时仅恢复记录中的不可变活动版本。
- [x] 已登录的同设备主界面可在不创建 Agent 请求的情况下直接发起校验与热切换，且通用 API/插件凭据、跨源与远端请求不能使用该人工 UI 通道。
- [x] 主界面轮询在任务进入 `awaiting_protected_test_approval` 后主动弹出精确审批；用户无需依赖终端或 Agent 查询即可批准或拒绝。
- [x] 脏 Git、无新提交、无 Kernel 变化、格式/vet/任一测试失败均阻断重启并可查询原因。
- [x] 候选构建完成前现有 Kernel 持续运行。
- [x] 新 Kernel 健康检查通过后才晋升为当前版本；失败时自动拉起上一版本。
- [x] 至少保留 3 个可拉起核心版本，清理逻辑不删除当前和回退目标。
- [x] 相关 Go/Node/前端测试通过，TTT 记录实现文件与证据；lint 仅作为非阻断质量记录。

## 已归档/已完成

- [x] **2026-07-30：`15bda522e` 前端防重入门禁闭合**
  - 首次 post-commit 在外层提交命令被 5 秒执行器终止时连带中断 `dev:once`，失败 operation `2026-07-29T23-40-29-838Z-15bda522ee5f-9db3d545` 保留且不计为构建结论。独立 `dev:once` 随后用时 80.7 秒完成全部 11 个目标，证明源码无构建回归。
  - 正式 recovery operation `2026-07-29T23-51-53-034Z-15bda522ee5f-b3285c41` 状态 `completed`；完整 `pnpm test`、`pnpm dev:once`、Kernel/Supervisor 健康和六个页面探针通过。前端活动 revision 为 `15bda522ee5f3a2aed402468f77d97192fb91203`，Kernel 保持 `8dd352e875271446c5a559eb618f2731db395cc8`，唯一 Supervisor PID `32436` 未变。

- [x] **2026-07-30：提交验证与运行时部署解耦**
  - **更正**：此前 `pre-commit` 读取活动版本、Supervisor 可达性和上一轮 deployment failure，导致已经通过测试的后续原子提交被旧 Kernel 或未审批任务阻断。这些运行态事实不描述提交有效性。
  - **新语义**：`pre-commit` 仅对暂存差异运行 `git diff --cached --check`，并在 `kernel/` 变更时运行固定全包 `go test -short -tags fts5 ./...`、在 App/hook/前端构建链变更时运行 `pnpm test`；不启动、探测或要求 Kernel。`post-commit` 的受控部署、工作树清洁、人工审批、候选回退和 incident 语义保持不变；部署失败写盘并显示摘要，钩子向 Git 返回成功，失败只阻断交付闭合，不反向阻断提交。
  - **验证证据**：`node --test test/forge-commit-runtime-gate.test.js` 15/15 通过，覆盖历史 deployment 失败、Supervisor 不可达和暂存 Kernel 变更三种提交前场景；`git diff --check` 通过。完整 `pnpm test` 通过；新增后置钩子失败不改变 Git 提交有效性的回归将在本提交门禁中验证。后续人工批准的热切换仍属于对应 Kernel delivery 的部署验收，不将历史审批超时或执行器超时改写为成功。

- [x] **2026-07-30：严格 WebUI 鉴权下的真实热切换与重复任务防重入**
  - **运行证据**：唯一 Supervisor PID `32436` 保持不变；任务 `2026-07-29T23-30-40.269Z-c800027a` 在主界面显示精确受保护文件并由人工批准，随后通过 `gofmt`、`go vet -tags fts5 ./...`、`go test -short -tags fts5 ./...`、候选构建、切换和健康检查；正式 operation `2026-07-29T23-30-39-837Z-8dd352e87527-3a0ece49` 状态为 `completed`。
  - **新鲜度证据**：活动 Kernel revision 为 `8dd352e875271446c5a559eb618f2731db395cc8`，二进制 SHA-256 为 `9083d44e23bbd952ac04c6eb1a200a7734725df81bd1519b9b7db3eb08f5f7ba`；主入口、Agent App、MAGI desktop/mobile/identity 和 Protyle App 探针均为 200。
  - **问题与修复**：运行中的 Supervisor 任务本应使“校验并热切换”按钮不可用，原界面仅依据短暂 mutation `busy` 状态，因而可以重复发起并收到 HTTP 409。现将非终态任务判定收口为 `isForgeRuntimeJobActive()`，同时用于控制器网络前阻断、视图按钮状态和轮询周期；任务进入 `completed`/`failed`/`rolled_back` 后立即恢复发起能力，不吞掉 Supervisor 返回的错误。
  - **验证**：控制器和视图契约同时覆盖活动任务拒绝重复请求、按钮禁用、终态任务恢复发起和按钮恢复。

- [x] **2026-07-30：主界面直接控制面实现与专项验证**
  - **完成情况**：新增独立 `ForgeRuntimeClient`、控制器、状态栏/Dialog 视图和样式；主应用在布局与消息系统初始化后启动控制面，非 Forge 模式按 capability 不显示入口。重启 mutation 完成后立即切换为 1 秒活动轮询；相同 pending `jobId + revision` 只创建一个审批弹窗；控制 Dialog 周期刷新保留用户已输入的更新说明。
  - **鉴权情况**：Kernel WebUI API 与 MCP 共用唯一 `CallForgeSupervisor` 传输，但不共用 Agent 确认 capability；路由要求登录管理员且非只读，Handler 额外拒绝远端、协议或主机跨源、缺失 `Origin`、非精确 JSON 媒体类型、Authorization、`X-Auth-Token` 和 query token。批准/拒绝由 Supervisor 对当前 pending 对象执行精确重验，CLI token 调用审批保持 403；Agent Forge Bash 规则覆盖新 WebUI Runtime 路径。
  - **成果文件**：`app/src/sforge/forgeRuntime/*`、`app/src/index.ts`、Forge i18n、`kernel/api/forge_runtime.go`、`kernel/util/forge_supervisor.go`、`kernel/mcp/tools/forge.go`、`app/scripts/forge-runtime-supervisor.js` 及对应测试。
  - **验证证据**：`go test ./api ./mcp/tools ./util -count=1` 通过；Supervisor `39/39` 通过；前端 Forge Runtime `8/8` 通过；主应用 development one-shot 构建成功；`git diff --check` 无差异错误。2026-07-30 再次复跑上述三组专项测试均通过，并新增跨协议 Origin、缺失 Origin 与 `application/jsonp` 媒体类型伪装拒绝用例。完整 `pnpm typecheck` 仍被 AppFacade、异步迁移、Protyle 等现有全局诊断阻断，但本次 `forgeRuntime` 文件与新增测试的筛选诊断已归零，未将全量类型检查记为通过。首个真实提交门禁与 Kernel 热切换已通过；严格鉴权收紧提交下的直接发起和主动审批仍属于 Phase 7 待验收项。

- [x] **2026-07-30：直接控制面的单次引导上线**
  - **运行证据**：唯一 Supervisor PID `32436` 未变化；任务 `2026-07-29T23-11-16.327Z-33baaf44` 经精确受保护文件人工批准后依次通过 `gofmt`、`go vet -tags fts5 ./...`、`go test -short -tags fts5 ./...`、源码二次检查、候选构建和健康检查，活动 Kernel 晋升为 `7fd0cbeab3be1ed9c85a7908767976fb37756e9d`。
  - **恢复证据**：正式 `retry-post-commit` operation `2026-07-29T23-17-29-900Z-7fd0cbeab3be-86dcea0c` 已闭合为 `completed`；Supervisor、Kernel 与 `/`、Agent App、MAGI desktop/mobile/identity、Protyle App 页面探针全部通过，未删除或覆盖此前审批超时记录。
  - **界面证据**：刷新主应用后状态栏出现“Forge 核心更新”；无需 Agent 消息即可打开控制 Dialog，界面显示活动 revision、任务状态、阶段、更新说明及“校验并热切换”动作。

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
- **2026-07-24**：发现 `pnpm forge` 在 6806 已有 Forge Kernel 时递增到 6807 后重新构建，最终被同一 `.dev-workspace` 的 Kernel 锁拒绝。修复为在线服务控制面语义：Supervisor 在 `.forge-runtime/supervisor.json` 以排他创建方式持久化认证租约（PID、仓库、工作空间、端口、控制地址和最小权限 CLI 凭据）；Kernel 环境中的 Supervisor 根令牌不落盘，CLI 凭据只能查询状态和请求受控重启，不能批准受保护测试或调用内部停机动作。新 CLI 先认证现有控制面，比较活动版本与当前提交，发现已提交 Kernel 运行时代码变化即请求原 Supervisor 运行完整门禁、候选构建、短停机切换和健康失败回退，而非保留旧 Kernel；并发 CLI 附着已有重启任务，不重复创建。未提交 Kernel 改动、租约 PID 仍存活但失联、多个同工作空间 Kernel 和健康失败都形成明确错误；死 PID 租约隔离后可恢复启动。`.lock` 为持久锁文件，已从在线状态判断中移除。旧版 Supervisor 没有租约时，通过 Windows/Posix 进程参数精确识别其工作空间和端口，并明确要求一次由现有界面完成的正常退出迁移，禁止另起第二实例。为避免 Agent Bash 读取/使用该受限凭据绕过控制面，命令确定性拦截同步覆盖租约文件和控制请求头。实现：`app/scripts/forge-start.js`、`app/scripts/forge-runtime-supervisor.js`、`app/test/forge-runtime-supervisor.test.js`、`kernel/mcp/tools/forge.go`、`kernel/mcp/tools/forge_protection_test.go`；验证：Supervisor/启动编排测试 29/29 通过，`go test ./mcp/tools` 通过，实际发现现有 Kernel PID 62244、父 `forge-start.js`、`--workspace=D:/dev/s-forge/.dev-workspace`、6806 健康；在该旧实例上运行 `pnpm forge -- --no-browser` 明确报告迁移要求且不再构建第二 Kernel。待完成一次租约化启动后的真实受控更新验收。
- **2026-07-29**：提交自动门禁与 incident 实现进入引导提交前验证。新增版本化 `pre-commit/post-commit`、持久 operation 状态、多入口健康探针，以及候选失败和意外退出的独立 incident；门禁脚本、hooks、Webpack 生命周期和测试已纳入受保护基础设施。根据启动约束，`forge-start.js` 复用唯一 Git porcelain 读取函数，在安装 hooks、端口探测和进程接管前拒绝整个仓库的暂存、未暂存与未跟踪变化。
- **2026-07-29**：自动 gate 审查发现前端-only 提交若以 Kernel revision 判断新鲜度，会在下一次 `pre-commit` 被永久误判为漂移；现改为 Kernel 由活动 revision 的后端差异证明，前端由最近一次成功 gate 的 commit 证明，并新增对应回归。首次重跑中只有旧错误文案断言失败，更新断言后通过。定向测试最终 40/40 通过。
- **2026-07-29**：完整前端回归通过：最新 Node 239 项、Vitest 188 个文件 845 项。完整 `pnpm typecheck` 在 41.9 秒后暴露仓库既有的大范围 TypeScript 诊断，本轮未修改 `app/src`、类型配置或锁文件，该门禁保持失败且另行闭合。首次 `pnpm dev` 因开发配置固定 watch 在 604 秒超时，并遗留本轮进程链；已仅终止 21:49 创建的进程，保留 03:32 既有 watcher。新增复用同一 Webpack 配置的 `dev:once` 生命周期后，11 个开发目标在 77 秒内全部成功并正常退出；主入口、Agent、MAGI Desktop/Mobile/Identity 与 Protyle 页面均回读 200。真实服务仍运行旧 Supervisor，引导提交和受控切换尚待完成。
- **2026-07-29**：Node Supervisor 与 Go Agent 工具的重复受保护路径表已收口到唯一 `kernel/forge_restart_test_policy.json` schema 2。策略包含固定全包短测试命令、排序且无重复的精确路径和前缀；两端均拒绝缺失、未知字段、空集合、乱序、重复、反斜杠、绝对/上行路径和测试命令缩窄。策略文件自身与所有 `kernel/**/*_test.go` 保留为代码根保护项，不依赖 JSON 自我声明；运行中的 Kernel 固定首次加载的策略快照，Supervisor 将策略快照写入不可变版本元数据并拒绝后续策略缩窄。Agent 在确认阶段发现策略错误时输出可见工具失败并终止执行，批量替换与 Bash 同样逐次复核。组合 Node 测试 `45/45`、Supervisor 专项 `33/33`、`go test ./mcp/tools -count=1` 均通过；引导提交、完整门禁和真实 Supervisor 迁移仍待完成。
- **2026-07-29**：引导提交前完整门禁继续执行。Node `244/244`、Vitest `188` 文件 `845/845`、`go vet -tags fts5 ./...` 通过。首次本轮 `go test -short -tags fts5 ./...` 在 129 秒后明确失败，仅 `kernel/api` 的 `TestAgentTaskDirectoryEndpointsDoNotTreatRemoteTransportAsAuthorization/bind` 与 `TestAgentTaskDirectoryRemoteGuardianCanBindMultipleDirectories` 失败：预期进入 guardian 鉴权的远程请求被生产代码提前以 `task directories can only be bound from WebUI on the kernel device` 返回 403。该失败保持可见，先审计生产鉴权链与测试意图，不修改受保护测试来迎合当前实现。
- **2026-07-29**：审计确认“仅 Kernel 同设备 WebUI 能新增、更换或追加目录绑定”是既定产品边界，不是生产代码冲突。受保护测试现按该公开契约验证远程绑定确定性返回 403，同时保留同设备 WebUI、owner、armor 与会话授权矩阵；`go test -short -tags fts5 ./...`、`go vet -tags fts5 ./...`、`pnpm test` 以及 Forge Node 专项 `45/45` 全部通过。真实 API 回读显示活动 Kernel 仍停留在 `a2347f71d809`：`/api/system/version` 正常，但新 `taskDirectoryCapabilities` 路由返回 200 空正文；这不是前端协议问题，Phase 6 的唯一当前阻断是尚未执行最新提交的受控 Kernel 热切换。
- **2026-07-30**：第一次真实切换在受保护测试审批等待 5 分钟后明确超时；确认 Supervisor 只记录等待状态，没有向主界面广播可发现的审批请求，用户因此看不到审批界面。第二次请求通过 Agent 内联逐次确认完成精确 `jobId + revision` 审批，随后暴露 Windows `gofmt` 门禁错误：已有 `*.go eol=lf`，但旧工作树仍为 CRLF，`gofmt -l` 因行尾把数百个文件误报为整文件格式变化。已用同一文件复现：原文件被列出，先将 CRLF 规范化为 LF 后 `gofmt` 输出逐字节相等。
- **2026-07-30**：当前 Supervisor 源码将格式门禁改为只检查候选提交实际变化且仍存在的 Go 文件，输入先规范化行尾再由真实 `gofmt` 比较；`go vet ./...` 与核心 `go test -short ... ./...` 的全包范围不变。新增 CRLF 通过、真实格式差异失败和未变化文件不参与的回归，Supervisor 测试 `35/35` 通过。旧进程经现有可见界面正常退出后，在用户可触及的 PowerShell 窗口启动唯一新版 Supervisor；当前 Supervisor PID `32436`、Kernel PID `6008`、活动 revision `efb5b3fa288b`，`6806` 与 Agent 新接口均健康。审批主动通知仍待闭合。
- **2026-07-30**：Agent Composer 修复提交 `a7e5ffcb6` 后，版本化 post-commit hook 确定性失败并写入 `.forge-runtime/commit-runtime-gate.json`：前端变更识别正确，但默认 `runFrontendUpdate` 的第二参数仍是进程 runner，调用方却统一传入 `changedPaths`，最终报错 `run is not a function`；同次执行还因 `forge-start.js <-> forge-commit-runtime-gate.js` 顶层互相加载产生 `installCommitRuntimeHooks` 未初始化警告。服务未中断，前端 watcher 已生成包含该提交源码的最新 desktop bundle，唯一 Supervisor/Kernel 仍健康；失败状态必须通过修正后的同一 gate 重放闭合，不能手工删除或伪造成功状态。
- **2026-07-30**：VS Code 提交再次确定性复现 `previous commit runtime gate failed: run is not a function`，确认失败发生在当前提交内容审查之前。恢复实现将“已提交 Kernel 差异读取”与“热切换前 Kernel 工作树必须干净”分层：`retry-post-commit` 只接受当前 HEAD 对应的持久失败状态；若该提交没有 Kernel 运行时差异，则保留现有 Kernel 并重放前端门禁，若存在差异则仍进入严格同步器。回归同时证明恢复后未暂存 Kernel 源码继续被 `pre-commit` 拒绝，全部暂存后才可提交。Forge 组合测试 `48/48`、完整 Node `247/247`、Vitest `191` 文件 `862/862` 通过；第一次组合 `pnpm test` 因外层 180 秒执行器超时关闭管道而产生 `EPIPE`，未计为测试结论，随后按项目既有分段入口重跑取得上述完整结果。
- **2026-07-30**：第一次真实 `retry-post-commit` 在进入前端测试前明确失败并持久记录 `spawnSync pnpm.cmd EINVAL`。确认 Node 22 的同步进程 API 在 Windows 上不能直接执行批处理入口；调用改为显式 `cmd.exe /d /s /c pnpm.cmd run <固定脚本名>`，参数保持数组传递，不拼接用户输入、不启用通用 shell 字符串，子命令退出码继续由 `execFileSync` 原样传播。该失败不计作测试或构建结果，修复验证后重新创建独立 recovery operation。
- **2026-07-30**：第二、三次真实 `retry-post-commit` 均完整通过 `pnpm test` 与 11 个 `dev:once` 构建目标，随后在第一次 post-build Supervisor 探针处以 `Forge runtime ownership is stale or unreachable: fetch failed` 失败；两次失败后同一 PID `32436`、租约、活动 Kernel PID `6008` 和 revision `efb5b3fa288b` 均未变化，控制端再次采样约 157ms 即返回。由重复时序证据确认问题是资源密集构建后的单点 readiness 竞态，不是租约陈旧、Supervisor 退出或 Kernel 故障；两次失败 operation 均保留写盘，不计作恢复成功。
- **2026-07-30**：post-build 检查改为 20 秒截止时间内等待 Supervisor 连续两次成功，网络拒绝、连接超时等暂态失败逐次写入 operation；401、响应进程与租约不匹配等确定性控制面错误仍立即阻断。`probeSupervisor` 现在保留底层 `cause` 与错误码，避免日志只剩无信息量的 `fetch failed`。新增暂态恢复、连续成功、确定性错误立即失败和网络原因保留测试；Forge 门禁与 Supervisor 专项合计 `51/51` 通过，`git diff --check` 通过。下一次真实恢复尚待完成，不提前标记 gate 成功。
- **2026-07-30**：真实 recovery operation `2026-07-29T19-08-48-984Z-a7e5ffcb60b4-8b300a66` 完成：`status=completed`、`trigger=retry-post-commit`、commit=`a7e5ffcb60b4`。完整 `pnpm test` 和全部 `dev:once` 目标通过；第一次 post-build 探针明确记录 `ECONNABORTED: write ECONNABORTED`，随后 539ms 内取得连续成功，readiness 共 3 次采样、1 次暂态失败。Kernel 保持原 PID `6008`、revision `efb5b3fa288b`，Supervisor 保持 PID `32436`，没有新建进程；Kernel 健康探针与主入口、Agent 独立页、MAGI Desktop/Mobile/Identity、Protyle 六个页面均返回 200。旧 `run is not a function` 持久失败已通过正式重放闭合，未删除或伪造状态。
- **2026-07-30**：门禁修复已原子提交为 `29c6ba9d8 fix(forge): stabilize post-build supervisor readiness`；自动 post-commit operation 状态为 `completed`，readiness 连续 2 次成功，六个页面均为 200。为避免临时索引把 Kernel 批次混入门禁提交，先保存完整 Git 对象快照，再从专用快照按 6 个 Kernel 路径恢复；恢复后的索引 blob OID 与快照逐文件完全一致。Kernel 定向验证 `go test ./model ./mcp/tools -count=1` 通过，6 个文件 `gofmt -d` 无输出，`git diff --cached --check` 通过；下一提交仍须经过受保护测试审批及真实热切换，不以定向测试替代全量核心门禁。
