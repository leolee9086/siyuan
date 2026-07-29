# AI Agent 会话外部任务目录绑定与所有者授权保护执行跟踪 (TikTocTak)

> **目标**: 允许远程设备在提供有效 guardian 身份授权后访问已有绑定的 S-Forge 任务 Agent；每个 Agent 会话支持一个主任务目录，以及多个只读、读写或命令权限目录。新增、更换和追加目录绑定只允许与 Kernel 同设备的 WebUI 发起，并继续要求对应 guardian owner 授权；远程 HTTPS owner 可以使用和管理已有授权，但不能扩张目录授权集合。
>
> **范围**: 后端 capability 存储与鉴权、task-directory 工具、Agent 会话访问控制、SSE 授权过期处理、前端目录绑定入口，以及本任务涉及的测试和编译修复。

## 同步规则

1. 代码、测试和验证未完成前，不将任务或阶段标记为完成。
2. 当前工作区已有的未提交改动全部属于本任务，本记录只描述本任务范围内的改动，不回退已有工作。
3. 每次阶段结束后同步更新当前状态、验证命令、已知问题和更新日志。
4. 外部目录的路径、所有者身份和会话活动信息不得通过普通客户端持久化或广播通道泄露。

## 架构边界

```text
GUI (网页端/Electron)
  -> X-SiYuan-Agent-Owner-Token
  -> kernel/api/agent.go
  -> kernel/agent/session.go capability store
  -> kernel/mcp/tools/task_directory.go
  -> task_directory_* 工具
```

外部目录会话的访问必须同时满足同设备连接或 HTTPS 传输、MAGI guardian 身份、`magi-main-ui` 通道和绑定时记录的 `OwnerIdentityID`。新增、更换主目录和追加附加目录还必须满足真实连接源来自 Kernel 同设备；解除已有绑定不扩张授权集合，允许远程 HTTPS owner 执行。绑定 capability 必须存放在工作空间内的内核私有区域，不能写入 `session.json`、`index.json`，也不能依赖前端隐藏入口形成安全边界。

同设备判断只读取服务端观察到的真实连接源地址及 Kernel 主机网络接口，不信任 `Origin`、`Host`、`X-Forwarded-For` 或 `X-Forwarded-Host`。前端 `canBindTaskDirectories` 只投影当前连接是否满足新增绑定的设备条件；实际变更仍由服务端逐请求校验 guardian owner、channel、route class 和会话归属。

## 角色与可达性契约

Avatar 的真实含义是协议角色而不是独立运行时：所有不是 MAGI、但向 MAGI 汇报的 Agent 都属于 Avatar。这一定义覆盖当前内部普通 Agent，也覆盖未来由 LLM 转发服务接入、实际运行在外部的 Agent 工具；外部接入只需提供等价的受控报告适配器，不另造一套角色语义。`avatar === 普通 Agent` 表示当前落地实现复用上游思源普通 Agent 系统，而不是把 Avatar 限制为某个运行时。task-directory capability 是可选的执行能力，不是 Avatar 的定义条件或专属权限。

目录写权限和会话可达性是两个独立维度，不能把“谁能写目录”误写成“只有某一种 Agent 才能写目录”。

| 主体 | 外部任务目录 | 主笔记 | 自身代码 | 会话可达性 |
|------|--------------|--------|----------|------------|
| 普通 Agent（含被派出的 Avatar） | 获得 capability 后可读写 | 按会话授权 | 按 forge 工具规则 | 仅绑定该会话的 guardian owner 可访问 |
| MAGI | 不绑定、不直接执行外部任务目录 | 完全编辑 | forge 模式可读自身代码 | 可读取和分析全部 Avatar 历史；只与 guardian 和受授权 Agent 通信 |
| Guardian | 负责真实设备所有者鉴权和会话控制 | 由产品权限决定 | 不通过 Agent capability 推导 | 可访问其 owner 身份绑定的 Agent |
| 其它用户/其它角色 | 无法访问 owner 绑定的 Agent capability | 无权推导 | 无权推导 | 后端拒绝 list/get/chat/工具控制、历史读取和结果回传 |

所有拥有外部目录 capability 的 Agent 都可以执行目录读写；目录 capability 不因 Avatar 身份获得特殊写权限。安全边界是 `OwnerIdentityID` 对应的 guardian owner 可达性，以及后端对每次会话和工具请求的鉴权。Agent 的入站和出站消息只允许经过 guardian 或 MAGI，Agent-Agent 直连以及与其它角色的通信一律禁止。

## 当前同步状态 (2026-07-19)

- **总体状态**: workspace 自持、多目录 capability、同设备新增绑定、远程 guardian 使用已有绑定、目录工具权限和后端 owner 矩阵已落地；真实 Electron 已完成登录、菜单绑定、脱敏查询、workspace store 校验、解除与清理闭环；手机/Web 端到端交互仍需用户验收，尚不能归档整个任务。
- **当前残余**: 完成同设备连接源能力矩阵、远程 HTTPS owner 使用和解除已有绑定、伪造转发头无效的自动回归；再在真实远程设备上完成 guardian 登录、会话发现、发任务和已有目录读写验收。远程客户端不承担新增、更换或追加目录授权的验收。
- **工作区约束**: 当前未提交修改全部视为本任务内容，不回退、不覆盖无关改动。
- **验证基线**: `go test ./agent`、`go test ./mcp/tools` 和目录绑定相关 API 测试已通过；完整 API 测试已完成编译，但仍有 MAGI runtime/vector 运行失败。

## 近期计划

- [x] **Phase 4.1 工具定义分离 (P1)**
  - **当前状态**: 已完成。`kernel/mcp/tools/task_directory.go` 独立承载 task-directory 常量、capability、root 分派、注册模板和初始化注册；`forge.go` 仅保留 forge 工具实现。
  - **验收结果**: Agent 按绑定状态暴露正确工具，通用工具列表不返回 task-directory 工具；`go test ./mcp/tools` 通过。

- [x] **Phase 4.2 测试补齐 (P1)**
  - **当前状态**: 已完成。新增 task-directory 工具注册、缺少 capability、路径穿越、符号链接逸出测试；新增 capability store 损坏时 `ListSessions` 返回 error 测试；新增本地传输/远程传输 API 边界测试。
  - **验收结果**: 测试使用临时目录和临时配置，不依赖真实用户路径；`go test ./agent ./mcp/tools` 与目录绑定相关 API 测试通过。

- [x] **Phase 4.3 MAGI 测试编译修复 (P1)**
  - **当前状态**: 已完成。三处测试调用已适配当前 `upsert` 签名；同时修复 API 包四处动态日志格式串的 Go vet 阻塞。
  - **验收结果**: `go test ./api -run 'TestAgentTaskDirectory|TestMagiIdentityStorePasswordStoredAsHash|TestSetupMagiPersonaPreset'` 通过；`go build ./agent ./api ./mcp/tools` 通过。

- [ ] **Phase 4.4 前端与全量验证 (P1)**
  - **当前状态**: 后端专项验证和三包编译已完成；原 `AgentSessionPanel.ts` 已改为无 class 的 controller/view/types/imports/menu actions 模块，五个新模块完整 lint 通过。`AgentChat.ts` 的历史大文件/类设计问题与 `SessionStore.ts` 的模块级状态容器规则仍阻断仓库级前端 lint；完整 API 测试仍有 MAGI runtime/vector 既有失败。
  - **行动**: 后续如要清零仓库级 lint，需要继续拆分 `AgentChat.ts`，并将 Agent 会话 store 的可变状态迁移到显式 factory/state holder；不要以 class 豁免替代可以消除的类。另需单独修复 runtime/vector 测试；这些不属于本轮目录安全逻辑的必要改动。
  - **验收标准**: 本任务专项测试与编译通过；上述仓库既有失败在验证记录和风险项中明确列出。

- [-] **Phase 5 架构边界修正：workspace 自持与后端鉴权为唯一事实源 (P0)**
  - [x] **Phase 5.1 capability 存储迁移到工作空间私有区域 (P0)**
    - **当前状态**: 已完成实现和 workspace 复制/路径切换测试。
    - **行动**: capability store 使用当前 workspace `data/.siyuan/agent-task-directories.json`；保留 `0700/0600`、原子写入和不进入 `session.json/index.json` 的约束；禁止普通文件 API、同步和客户端会话保存流程直接改写该文件。
    - **验收结果**: 工作空间复制并切换 `DataDir` 后 capability 仍可读取；路径 hash 和用户配置目录不再参与绑定生命周期；session/index 不保存 capability。
  - [x] **Phase 5.2 绑定记录重验证与新 store 失效策略 (P0)**
    - **当前状态**: 已完成实现和删除/损坏/失效场景测试。
    - **行动**: 直接采用 version 2 workspace 私有 store，不读取旧用户配置路径；每次 bind、list、get、chat、工具执行前重新检查目录存在性、工作空间边界、符号链接和 `OwnerIdentityID`；新 store 损坏、路径逸出或身份不匹配时默认拒绝。
    - **验收结果**: malformed store、目录失效、符号链接、owner 不匹配和过期 token 默认拒绝；删除会话会清理主目录和全部附加 grant；不存在旧路径 fallback。
  - [ ] **Phase 5.3 全客户端 Agent 入口与授权判断解耦 (P1)**
  - **当前状态**: 已完成入口改造、workspace API token 透传、MAGI 身份会话变化后的列表刷新；新增绑定动作由 `canBindTaskDirectories` 按真实连接源裁剪，已有绑定的解除动作不随该能力隐藏。真实 Electron 已验证 Agent 钥匙入口、guardian `magi-main-ui` 登录、菜单绑定、绑定后菜单刷新和解除流程；仅剩手机/Web 远程使用已有授权的验收。
  - **行动**: 所有支持 Agent 的客户端都允许发现 owner 可达的已有会话和目录摘要；只有与 Kernel 同设备的 WebUI 显示新增、更换和追加目录动作，Electron 仅额外提供原生目录选择器。远程 HTTPS guardian 可以使用和解除已有绑定，不能新增、更换或追加授权。普通 Agent（含 Avatar）均可在获得 capability 后读写目录；MAGI 不暴露 task-directory capability。Agent chat、SSE、confirm、question 和工具结果回传在手机端与桌面端使用同一 owner headers 链路。
  - **验收标准**: 后端测试证明同设备 WebUI 可新增主目录与附加目录、远程 HTTPS guardian 新增绑定被设备边界拒绝、远程 owner 可使用和解除已有绑定、伪造转发头不能改变结论；手机/Web 客户端验证加载、查看和执行已有授权任务。
  - [ ] **Phase 5.4 后端鉴权矩阵回归 (P0)**
    - **当前状态**: bind/unbind/list/get/chat/confirm/question/frontendToolResult/save/remove 的 owner、channel、route class、token 过期和传输矩阵已覆盖；仍待真实远程 owner chat 成功路径验收和错误码枚举收敛。
  - **行动**: 增加 bind、add、unbind、list、get、chat、confirm、question、frontendToolResult、save、remove 的矩阵测试，覆盖缺失/过期/错误 channel/错误 route class/错误 owner/远程来源/运行中会话/伪造 session 字段；单独验证手机/Web 在 owner authorization 有效时可以使用已有绑定会话，而新增、更换和追加目录只能由 Kernel 同设备 WebUI 完成。
    - **验收标准**: 测试直接调用后端 handler 或路由，不构造前端菜单状态；每个拒绝分支验证状态码和稳定错误码；授权成功路径验证实际 capability 使用。
  - [x] **Phase 5.5 workspace 自持行为验证 (P1)**
    - **当前状态**: 已完成临时 workspace fixture 验证。
    - **行动**: 使用临时 workspace fixture 验证移动、复制、损坏恢复、删除会话、重新登录和 owner token 过期场景；确认不会把外部目录路径广播到普通 WebSocket 或响应正文。
    - **验收结果**: workspace 复制/切换、store 损坏、目录失效、删除会话、owner token 过期和跨 owner 场景均有可重复测试；API 响应不包含目录绝对路径，受保护会话不进入普通 WebSocket 广播。
  - [ ] **Phase 5.6 MAGI 特殊边界与 Agent 通信 ACL (P0)**
    - **当前问题**: 当前 task-directory capability 以 Agent session 为通用入口，尚未显式排除 MAGI，也未把 Agent 之间的不可达性作为后端通信策略验证。
    - **行动**: 为 MAGI 单独建立主笔记完全编辑、forge 模式自身代码只读、其它目录只读且不绑定 task-directory 的工具集；普通 Agent/Avatar 继续按 capability 获得目录读写。为会话消息、工具回调和控制接口增加 guardian/MAGI/owner Agent 的通信 ACL，禁止其它用户、其它角色和 Agent 间直连。
    - **验收标准**: MAGI 无法通过伪造 session 参数取得外部目录写 capability；有 capability 的普通 Agent 可以读写；非 owner 用户无法发现或控制该 Agent；Agent 间直连、向非 guardian/MAGI 角色发送消息和伪造工具结果均被后端拒绝。
  - [ ] **Phase 5.7 report2magi 与全量 Avatar 历史分析 (P0)**
    - **当前问题**: 当前 Agent 工具链没有统一的 `report2magi` 原生工具，MAGI 也没有受控的全量 Avatar 会话历史读取入口。
    - **行动**: 为所有内部普通 Agent/Avatar 注册 `report2magi` 工具，工具只能向 MAGI 发送进度、结果、阻塞、证据引用和需要决策的报告，不能指定其它接收角色；报告必须由后端绑定真实 `sessionID` 和 owner/Agent 身份，不能由模型参数伪造来源。为未来外部 Avatar 增加 LLM 转发服务的等价报告适配器。为 MAGI 提供受保护的全量 Avatar 历史读取与分析服务；普通 guardian 只能读取自己 owner 下的会话，其它用户和 Agent 不得读取。
    - **验收标准**: 所有内部普通 Agent 都能调用 `report2magi`，外部 Avatar 的转发适配器遵守同一单向汇报契约；任意其它接收者、伪造 session、伪造 owner 和跨 owner 历史读取均被拒绝；MAGI 可以读取和分析所有已接入 Avatar 聊天历史，但不能因此获得外部任务目录 capability；报告和历史读取不会通过普通用户 WebSocket 广播。

  - [x] **Phase 5.8 主任务目录与多权限目录 capability (P0)**
    - **当前状态**: 已完成后端实现和专项测试。
    - **行动**: 每个 Agent 会话支持一个 `main` 主任务目录，以及多个附加目录；附加目录权限为 `read-only`、`read-write` 或 `command`，由后端按 `directoryID` 注入 capability。新增 `task_directory_command`，仅可在 command grant 中执行。
    - **验收标准**: 主目录可读写；只读目录拒绝写操作；读写目录允许增删查改；命令目录仅允许受边界保护的命令工具；目录路径和 owner 不进入普通响应、session.json 或 index.json。

## 已完成实现

- [x] **Phase 1 capability 存储与基础边界**
  - `kernel/agent/session.go` 提供独立 task-directory store、工作空间隔离、`0600` 权限、绑定/解除绑定和会话列表隔离；store 位于 workspace `data/.siyuan` 私有区域。
  - `session.json` 与 `index.json` 不接受客户端伪造的 task-directory capability。

- [x] **Phase 2 Agent 与 API 鉴权链路**
  - `kernel/api/agent.go` 校验 owner token、guardian、main-ui、传输安全、会话所有者和运行中会话操作。
  - 外部目录会话注入 capability 后才暴露 task-directory 工具，并在授权过期时关闭 SSE。
  - 普通 WebSocket 会话广播跳过外部目录会话。

- [x] **Phase 3 前端接入**
  - `SessionStore`、`AgentChat`、`agentSSE` 和 `session-panel` controller/view 已接入 owner headers、MAGI armor session、Electron 原生目录选择器、移动/Web 路径输入、多目录权限入口及绑定/解除流程。

## 验证记录

| 日期 | 命令 | 结果 | 说明 |
|------|------|------|------|
| 2026-07-18 | `cd kernel && go test ./agent` | 通过 | Agent 工具签名和现有测试通过 |
| 2026-07-18 | `cd kernel && go test ./mcp/tools` | 通过 | 当前 forge/tool registry 测试通过 |
| 2026-07-18 | `cd kernel && go test ./api` | 未通过 | 已完成编译，但 MAGI runtime 与 vector 流程测试在运行阶段失败；目录绑定相关测试不受影响 |
| 2026-07-18 | `cd kernel && go test ./agent ./mcp/tools` | 通过 | 新增 session store 和 task-directory 安全测试通过 |
| 2026-07-18 | `cd kernel && go test ./api -run 'TestAgentTaskDirectory\|TestMagiIdentityStorePasswordStoredAsHash\|TestSetupMagiPersonaPreset'` | 通过 | 目录绑定 API 边界和 MAGI upsert 适配测试通过 |
| 2026-07-18 | `cd kernel && go build ./agent ./api ./mcp/tools` | 通过 | 三个受影响后端包编译通过 |
| 2026-07-18 | `cd kernel && go test ./agent ./mcp/tools` | 通过 | workspace store、多目录权限和 command 工具专项测试通过 |
| 2026-07-18 | `cd kernel && go test ./api -run 'TestSanitizeSessionForResponseRedactsNestedTaskDirectoryFields\|TestAgentTaskDirectory'` | 通过 | 递归脱敏、远程 HTTPS guardian 绑定、多 owner 会话控制、错误 channel/avatar-only/过期 token/HTTP 拒绝和会话清理通过 |
| 2026-07-18 | `cd app && pnpm run build:app` | 通过 | 远程目录入口、多目录权限菜单以及 workspace API token + MAGI owner armor token 双请求头链路构建通过 |
| 2026-07-18 | `cd app && pnpm exec vitest --run test/layout/dock/agent/SessionStore.headers.test.ts` | 通过 | 前端单元测试确认 workspace API token 与 guardian owner armor token 同时透传，并保留显式 Authorization |
| 2026-07-18 | `cd app && pnpm run lint:file -- src/layout/dock/agent/SessionStore.ts ...` | 未通过 | AgentSessionPanel 的既有代码规模规则和 SessionStore 模块级可变状态容器规则仍待单独重构 |
| 2026-07-19 | `cd app && pnpm exec vitest --run test/magi/magiIdentitySession.sync.test.ts test/layout/dock/agent/SessionStore.headers.test.ts` | 通过 | armor 跨 renderer 登录/登出同步，以及 workspace token + owner armor 请求头通过 |
| 2026-07-19 | `cd app && pnpm run build:app && pnpm run build:magi-identity` | 通过 | Agent 直接身份入口、Identity Access Tab/Dock/独立页面构建通过 |
| 2026-07-19 | `cd app && pnpm run build:desktop` | 通过 | 真实桌面宿主构建通过；修复常显 Guardian 入口、Dock/Tab 查重冲突和会话“更多”子菜单展开样式 |
| 2026-07-19 | `cd app && pnpm exec vitest --run test/magi/identityAccess.mount.test.ts test/magi/identityAccess.adapters.test.ts test/magi/magiIdentitySession.sync.test.ts test/layout/dock/agent/SessionStore.headers.test.ts` | 通过 | 9 项前端测试覆盖多宿主生命周期、Tab 单实例、独立页回退、armor 同步和双请求头 |
| 2026-07-19 | `cd kernel && go test ./agent ./mcp/tools ./api -run 'TestAgentTaskDirectory\|TestTaskDirectory\|TestMagiIdentityStorePasswordStoredAsHash\|TestSetupMagiPersonaPreset'` | 通过 | task-directory、MAGI identity/upsert 专项测试通过 |
| 2026-07-19 | `cd app && pnpm exec vitest --run test/layout/Model.lifecycle.test.ts` | 通过 | 5 项测试覆盖 CONNECTING/OPEN/CLOSED 发送与销毁、Agent 类资源钩子和异常时最终释放 |
| 2026-07-19 | `cd app && pnpm run build:desktop` | 通过 | 模型销毁与 WebSocket 生命周期修复通过桌面构建；干净启动无布局重置对话框、CONNECTING 或 resetLayout 错误 |
| 2026-07-19 | `cd app && pnpm run build:desktop && pnpm run build:magi-desktop` | 通过 | `ILayoutModel` 接口化、错误占位去继承及结构守卫迁移后，两类最终生产包均成功构建；最终入口分别为 `main.c8f646052f4533e7a164.js` 和 `main.93c8858d752c6a8e5fe5.js` |
| 2026-07-19 | `cd app && pnpm exec vitest --run test/layout/Model.lifecycle.test.ts test/layout/LayoutModel.contract.test.ts test/magi/identityAccess.mount.test.ts test/magi/identityAccess.adapters.test.ts test/magi/magiIdentitySession.sync.test.ts test/layout/dock/agent/SessionStore.headers.test.ts` | 通过 | 6 个文件、20 项测试覆盖模型接口形状、挂载、错误恢复数据、序列化、可选销毁、身份多宿主、armor 同步和 owner headers |
| 2026-07-19 | 目标模块 ESLint 与独立严格 TypeScript 检查 | 通过 | `layout/lifecycle` 与 `dock/errorPlaceholder` 接口、守卫、挂载、序列化模块无 lint 或类型错误；仓库级 `tsc` 两次运行 5 分钟仍未结束，未作为完成门禁 |
| 2026-07-19 | 浏览器加载 `/stage/build/magi-desktop/` 与 `/stage/build/desktop/` 并检查控制台 | 通过 | 最终生产哈希完整加载；无 `Model` 未定义、`InvalidStateError` 或布局初始化失败，desktop 无重置对话框 |
| 2026-07-19 | `cd app && pnpm exec vitest --run test/layout/dock/agent/AgentSessionMenu.actions.test.ts test/layout/dock/agent/SessionStore.headers.test.ts` | 通过 | 5 项测试确认目录命令不受前端授权门禁控制，并继续携带 workspace token 与 guardian owner armor |
| 2026-07-19 | `cd app && pnpm run build:desktop && pnpm run build:app && pnpm run build:magi-desktop` | 通过 | 会话面板改为函数式 controller/view 并将“更多”改为顶层标准菜单后，三目标均成功构建；最终入口分别为 `main.8d209841d3f3820a7ec1.js`、`main.b11be4faebb68d64bbb4.js`、`main.e01b8490132cbb41714e.js` |
| 2026-07-19 | 真实 Electron + Playwright CDP 临时 guardian/会话/目录闭环 | 通过 | 从 Agent 钥匙入口打开 Identity Access，激活 `guardian + magi-main-ui`；会话“更多”显示“绑定主任务目录”，将 Electron 目录选择 IPC 结果注入为临时目录后完成真实后端绑定；菜单刷新为“更换/解除”，API 仅返回空 `path/ownerIdentityId` 的脱敏摘要 |
| 2026-07-19 | 实际 workspace capability 与清理校验 | 通过 | 内核实际使用 `D:\dev\s-forge\.dev-workspace`；version 2 store 的临时记录持有正确 owner 和路径。随后通过菜单解除，并删除临时会话、身份和目录；四项残留复查均为空，渲染进程无 console error |
| 2026-07-19 | 五个 `session-panel` 文件 `lint:file --show-all` | 通过 | controller、view、types、imports 和 menu actions 无 lint 错误；旧 `AgentSessionPanel` class 已删除，未使用 class 豁免掩盖代码规模问题 |
| 2026-07-19 | `node --test test/lint/class-policy.test.mjs` | 通过 | 5 项规则测试确认普通类和抽象类默认禁止，充分的 `@允许类:` 可豁免；`private`/`#` 字段允许，`private`/`#` 方法仍禁止 |
| 2026-07-19 | 8 文件 Vitest、Agent/MCP/API 专项 Go 测试 | 通过 | 前端 24 项覆盖目录菜单、owner headers、布局模型、armor 同步和独立 Identity Access 刷新合并；后端三个目标包专项测试通过 |
| 2026-07-19 | 最新 Electron 完整重载与会话菜单复验 | 通过 | `/stage/build/app/` 正常重载，Agent Dock、会话弹层和挂载在 `BODY` 的“绑定主任务目录”菜单正常；无白屏、循环依赖、WebSocket CONNECTING 或布局重置错误，仅有 ONNX Runtime 执行器分配性能警告 |
| 2026-07-19 | `pnpm run build:desktop && pnpm run build:magi-identity` | 通过 | Web Agent 路径输入改为统一应用 Dialog；desktop 最终入口为 `main.b43154839914d29a33a0.js`，magi-identity 最终入口为 `main.09cb4f1d4694c5060169.js` |
| 2026-07-19 | `http://127.0.0.1:6806/stage/build/magi-identity/` 强制重载观察 | 通过 | 2.5 秒观察窗内独立入口执行日志只增加 1 次，未发生二次文档加载；启动期重复 `identity-required` 广播由 in-flight 与注意态双重合并，不再重复加载身份列表和统计 |

## 已知问题与风险

1. 手机/Web 客户端的实际远程交互仍需验收，见 Phase 5.3；Electron 桌面绑定闭环已完成。
2. Phase 5.4 的成功 owner chat 需要真实模型配置做端到端验证；当前自动测试证明跨 owner chat 在模型执行前被拒绝，并覆盖其余控制接口。
3. MAGI 尚未在 task-directory 工具注册、全量 Avatar 历史读取、`report2magi` 和 Agent 通信层显式落实特殊边界，见 Phase 5.6-5.7；这些不影响当前普通 Agent 目录验收。
4. 最新完整 Kernel 短测试与 vet 已通过；目录绑定测试已按“仅同设备 WebUI 可新增、更换或追加绑定”的既定边界覆盖远程 403、owner、armor、会话与本地传输条件。
5. 会话面板五个新模块的 lint 已清零；整份 `AgentChat.ts` 仍有历史大文件/类设计等规则错误，`SessionStore.ts` 仍有模块级状态容器错误，需要后续独立重构。

## 待用户远程验收

以下验收应在可通过 HTTPS 访问 Kernel 的手机或 Web 浏览器完成。远程客户端只使用同设备 WebUI 已经建立的目录授权，不输入目录路径，也不新增、更换或追加绑定；实际目录操作由 Kernel 执行。

1. 使用正常工作空间打开独立 Identity Access、Tab 或 Dock 并取得 guardian 身份，确认会话为 `routeClass=guardian`、`channel=magi-main-ui`；确认不依赖 Electron，手机/Web 也能打开 Agent 会话列表。
2. 先在 Kernel 同设备 WebUI 为 Agent 会话绑定主任务目录，再从远程客户端刷新页面或重新登录；应能看到该会话和脱敏后的目录名称/权限，但不出现新增、更换或追加目录动作，响应中不出现绝对路径、owner 身份或 capability 文件内容。
3. 在主目录创建、读取、编辑、删除一个测试文件；每个写入或命令操作都应出现确认流程，确认后文件结果正确。
4. 附加目录同样先由 Kernel 同设备 WebUI 添加；远程客户端验证只读目录可列出/读取/搜索但写入、编辑、删除被拒绝，读写目录可完成增删查改，命令目录只能执行受边界保护的命令工具且不能通过相对路径逃出目录。
5. 验证边界：目录内放置符号链接指向 workspace 外部或尝试 `..`、绝对路径、其它目录 `directoryID`，均应失败；普通 forge/frontend/HTTP 工具不能绕过 task-directory capability。
6. 用另一 guardian 身份、无 owner armor token、过期 token、错误 channel 或 avatar-only 身份访问同一会话；列表、读取、聊天、confirm/question、工具结果回传、保存和删除都应被后端拒绝。
7. 删除附加目录后再解除主目录；删除 Agent 会话后重新查询，所有目录 capability 应消失，普通 Agent WebSocket 不应收到该受保护会话的路径或活动信息。

## 关联文件

```text
kernel/agent/agent.go
kernel/agent/session.go
kernel/agent/tools.go
kernel/agent/forge_test.go
kernel/api/agent.go
kernel/api/router.go
kernel/mcp/tools/forge.go
kernel/mcp/tools/register.go
kernel/mcp/tools/task_directory.go
kernel/mcp/tools/task_directory_test.go
kernel/agent/session_test.go
kernel/agent/task_directory_tools_test.go
kernel/api/agent_task_directory_test.go
app/src/magi/service/magiIdentitySession.ts
app/src/magi/identity-access/
app/src/layout/dock/agent/SessionStore.ts
app/src/layout/dock/agent/AgentChat.ts
app/src/layout/dock/agent/agentSSE.ts
app/src/layout/dock/agent/session-panel/
app/test/layout/dock/agent/SessionStore.headers.test.ts
app/test/layout/dock/agent/AgentSessionMenu.actions.test.ts
app/test/magi/identityAccess.refresh.test.ts
app/0_lints/no-class.mjs
app/test/lint/class-policy.test.mjs
```

## 更新日志

- 2026-07-18：根据当前工作区和测试结果校正任务格式与完成状态；确认所有未提交改动属于本任务；将 MAGI `upsert` 测试编译修复纳入本轮。
- 2026-07-18：完成 task-directory 工具拆分、capability store/API/路径安全测试和 MAGI 测试适配；三包编译通过，记录完整 API 与前端 lint 的仓库既有残余。
- 2026-07-18：架构复核确认两项改进：capability store 必须随工作空间自持，前端菜单隐藏不能承担授权职责；根据内部开发前提移除旧 store 迁移任务，改为直接切换新结构且禁止旧路径 fallback，保留 Phase 5.1-5.5 的存储、失效、全客户端入口、UI 解耦和鉴权矩阵任务。
- 2026-07-18：进一步确认 Electron 不是安全边界；取消“只有 Electron 才能看到菜单”的设计前提，要求手机/Web 客户端在后端 owner authorization 有效时可以访问已绑定会话并发起任务，Electron 仅作为原生目录选择器能力提供方。
- 2026-07-18：修正角色模型：所有获得 capability 的普通 Agent（含 Avatar）都可以绑定并读写外部目录；安全限制是仅对应 guardian owner 可达，而不是限制为 Avatar。MAGI 不绑定外部目录，只编辑主笔记，forge 模式仅可读自身代码，并新增 Agent 通信 ACL、`report2magi` 和全量 Avatar 历史分析任务。
- 2026-07-18：明确 Avatar 的协议定义：所有非 MAGI 且向 MAGI 汇报的 Agent 都属于 Avatar；内部实现复用上游普通 Agent，未来外部 Agent 工具通过 LLM 转发服务接入并使用等价报告适配器。task-directory capability 不是 Avatar 的定义条件或专属权限。
- 2026-07-18：开始执行任务目录特性：capability store 改为 workspace `data/.siyuan` 私有文件，移除本机绑定门禁；实现一个主任务目录、多附加目录和 read-only/read-write/command 权限，新增远程 guardian 绑定接口、目录列表接口和 `task_directory_command` 工具，并完成专项测试。
- 2026-07-18：补齐完成审计：增加真实 Agent `executeTool` capability/owner/过期授权测试，补齐远程会话 chat/confirm/question/frontendToolResult/save/remove 跨 owner 矩阵，以及 workspace 复制、目录失效、主目录删除约束和删除会话清理全部 grant 测试；Phase 5.1、5.2、5.5 标记完成。
- 2026-07-18：修复远程 Agent 前端请求鉴权链路：`SessionStore.agentOwnerHeaders()` 在不覆盖显式 `Authorization` 的前提下透传 workspace API token，并继续附带 MAGI guardian owner armor token；`agentSSE` 自动复用同一请求头。再次明确 Avatar 覆盖所有非 MAGI 且向 MAGI 汇报的 Agent，未来外部 LLM 转发 Agent 使用等价报告适配器。
- 2026-07-18：完成本轮交付前审计和专项复验；kernel Agent/task-directory/API 测试、受影响 Go 包编译、前端请求头单元测试和 `build:app` 均通过。新增远程手机/Web 验收清单，明确目录路径属于 kernel 主机，并保留真实模型/设备验证为任务归档前置条件。
- 2026-07-18：完成 API 响应隐私边界复审；`getSession` 现在递归清理嵌套 `taskDirectory.main/directories` 中的路径和 owner 身份，并加入回归测试，避免客户端保存的嵌套元数据绕过脱敏。
- 2026-07-18：补齐远程授权状态切换体验；AgentChat 监听 MAGI identity session 变化，在 guardian 授权取得、切换或过期时重新查询会话列表和目录菜单，权限结论仍完全以后端响应为准；`build:app` 通过。
- 2026-07-19：修正“在 MAGI 窗口登录后返回 Agent 即可操作”的错误假设；armor 现在通过非持久化同源 BroadcastChannel 在 renderer 间同步，Agent 锁形入口直接打开共享 Identity Access Tab，另提供右侧 Dock 和独立 Web 页面。Identity Access 目标 lint、两项前端测试、`build:app` 和 `build:magi-identity` 均通过；真实手机/Web 的 Agent/task-directory 操作仍待用户验收。
- 2026-07-19：真实桌面宿主复验修复两项运行问题：Agent Guardian 入口改为常显；Tab 与 Dock 使用明确宿主数据并仅复用 Tab 宿主，避免同类型 Dock 截获打开请求。实测 Tab/Dock 共存、382px Dock 无水平溢出且重复打开保持单实例。
- 2026-07-19：根据用户已登录截图定位会话“更多”菜单不显示：触发器为 `b3-list-item__action`，但原展开样式只匹配 `b3-menu__item--show`。已增加 Agent 会话子菜单专用展开规则和 `aria-expanded` 同步；目录项仍只由 guardian 会话状态生成，后端鉴权不变，待用户刷新客户端确认。
- 2026-07-19：修复布局恢复删除未固定 Agent Tab 时的 WebSocket 竞态。通用销毁器现在调用 AgentChat/Graph/Cronjob/Custom 等模型的资源钩子并最终释放基础连接；`Model.send()` 仅在 OPEN 状态发送，CONNECTING socket 销毁时直接关闭。新增 5 项生命周期测试并完成干净桌面启动复验。
- 2026-07-19：修正此前把 `dock/imports.ts` 误判为根因并用父级直接导入绕过架构约束的错误方案。新增不含 WebSocket 的 `ILayoutModel` 最小契约和结构守卫；`Model` 与纯工厂错误占位成为并列实现，`Tab` 挂载、Dock 尺寸、布局序列化/恢复和通用销毁均按接口形状或实际能力工作。父级导入豁免、`ErrorPlaceholder extends Model`、相关 `instanceof` 和临时工厂已移除；最终双构建、20 项测试和两入口浏览器复验通过。
- 2026-07-19：完成布局模型最小契约最终审计：Dock 不再重复实现 `isLayoutModel`，统一由 `lifecycle/model.guard.ts` 定义并经 `dock/imports.ts` 合法转发；新抽象模块 ESLint、独立严格 TypeScript、20 项回归、desktop/magi-desktop 双构建和最新生产入口运行时复验通过，目标启动错误为零。
- 2026-07-19：用户登录 guardian 后再次实测仍无法配置外部目录，证明先前仅增加嵌套子菜单展开样式的修复结论错误。根因是目录项仍受前端 `canManageTaskDirectories` 状态门禁控制，且菜单 DOM 嵌套在右侧 Dock 的可滚动裁剪上下文。现已删除前端可见性门禁，所有客户端始终生成目录管理命令；点击“更多”使用全局顶层标准菜单，owner armor 只用于请求并由后端完成授权。新增 3 项菜单策略测试，desktop/app/magi-desktop 构建及最新 desktop 入口运行时复验通过；后续真实 Electron 绑定结果见下一条。
- 2026-07-19：使用真实 Electron 完成临时 guardian 和 Agent 会话验收；通过 Agent 钥匙入口登录 `magi-main-ui`，从顶层“更多”菜单绑定临时外部目录，验证绑定后菜单、脱敏 API 摘要与 workspace version 2 capability 记录。验收后从菜单解除并删除临时会话、身份和目录，无残留且无 renderer console error。
- 2026-07-19：桌面白屏诊断确认两种状态：正常启动时渲染页会在 `boot.html` 后载入主应用；测试过程关闭 Electron 会按端口停止 6806 kernel，随后启动若未先恢复 kernel，窗口会停在空白 `boot.html` 并持续 `ERR_CONNECTION_REFUSED`。验收时已按 kernel 实际工作空间 `D:\dev\s-forge\.dev-workspace` 重新启动，主页与 MAGI 页均正常渲染。
- 2026-07-19：删除仅用于组织会话面板状态的 `AgentSessionPanel` class，将其拆为函数式 controller、view、types、imports 和 menu actions；五个模块完整 lint 通过，最新三目标生产构建及真实 Electron 会话菜单复验通过。
- 2026-07-19：明确 class 策略为“最好不存在，存在则必须长得漂亮”：`no-class` 保留默认禁令和至少 500 字符的 `@允许类:` 显式豁免，移除 abstract class 自动豁免；类豁免只允许 class 存在，私有字段可保存状态，TypeScript `private` 与 ES `#` 私有方法仍被独立规则禁止。新增 5 项规则测试并通过。
- 2026-07-19：替换 Web/移动端 task-directory 的原生 `window.prompt`，新增统一主题 Dialog、文件夹图标、等宽路径输入、空值错误态和主机路径提示；Electron 继续使用原生目录选择器，后端仍负责路径与授权校验。
- 2026-07-19：修复独立 `magi-identity` 启动时重复加载身份数据：刷新函数拒绝并发重入，同一注意态窗口合并多个 BroadcastChannel `identity-required` 回放，并在首次刷新前注册监听以免产生竞态。清理 2026-07-19 遗留的第二套 `pnpm dev` watcher，保留 2026-07-17 原开发 watcher，避免两个 Webpack 实例同时清理和写入同一构建目录。
- 2026-07-29：重新核对绑定边界并修正回归契约：新增、更换和追加任务目录只接受 Kernel 同设备 WebUI，远程 WebUI 只消费既有授权；这属于既定需求，不把远程 guardian 身份误当作新增绑定授权。Agent API 专项、`go test -short -tags fts5 ./...` 与 `go vet -tags fts5 ./...` 均通过。活动 Kernel 尚未热切换，因此前端调用新 `taskDirectoryCapabilities` 路由仍收到 200 空正文；当前功能阻断归属于关联任务 `AI模块改进/Forge模式后端热重启与版本回退.ttt.md` 的 Phase 6。
