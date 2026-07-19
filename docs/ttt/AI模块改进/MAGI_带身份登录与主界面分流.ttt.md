# MAGI 身份登录、着甲与主界面分流执行跟踪 (TikTocTak)

> **目标**: 建立由后端鉴权结果驱动的 MAGI/Agent 身份访问链路；Identity Access 使用一个共享实现覆盖思源笔记 Tab、右侧 Dock 和独立 Web 页面三种容器；armor token 不写浏览器持久化存储、`session.json` 或 `index.json`，所有受保护请求均由后端重新验签。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。

---

## 核心原则

1. **后端鉴权是唯一安全边界**: 前端入口是否可见、是否运行在 Electron、菜单是否隐藏，都不能作为授权依据。
2. **全客户端可达**: Electron、桌面 Web、移动 Web 均可打开 Identity Access；Electron 只可提供体验增强，不获得额外信任。
3. **工作空间自持**: 身份配置和 Agent capability 由工作空间后端管理，不写用户设备全局 capability 文件。
4. **armor 不持久化**: armor token 只保存在当前页面内存，并通过同源 `BroadcastChannel` 临时同步；刷新或所有页面关闭后必须重新登录。
5. **跨窗口同步不等于鉴权**: `BroadcastChannel` 只解决同源 renderer 之间的会话交接，后端仍对每次请求验证签名、有效期、workspace、identity 和 channel。
6. **身份、昵称与路由分离**: `nickname` 只用于展示；`guardian`/`avatar-only` 只决定路由和会话可达性，不构成通用 RBAC。
7. **Avatar 是协议角色**: 所有不是 MAGI、但向 MAGI 汇报的 Agent 都属于 Avatar；内部复用普通 Agent，未来外部 Agent 通过 LLM 转发服务接入。

**验证检查清单**:

- [x] Identity Access 的 Tab、Dock、独立页面均挂载同一个 Vue 组件，业务逻辑无容器分叉。
- [x] Agent 工具栏可直接打开 Identity Access，不依赖先打开 MAGI 监控窗口。
- [x] 在一个同源页面登录后，已打开的其它 renderer 能收到 armor；登出和过期也能同步。
- [x] armor 不出现在 `localStorage`、`sessionStorage`、`session.json`、`index.json` 或 workspace capability 文件中。
- [x] 未授权、错误身份、错误 channel、错误 workspace 和过期 armor 均由后端拒绝。
- [ ] Web/移动端可见并可操作登录入口，前端不检查 Electron 身份作为权限条件。
- [x] Agent task-directory 请求继续同时满足 workspace API token 和 guardian owner armor 校验。

---

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后，必须剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】少于 3 项时，从【中期计划】提升可执行任务。
3. **因地制宜**: 发现计划与代码现状不符时，先记录证据，再调整或删除任务。
4. **数据驱动**: 只根据测试、构建和实际端到端行为更新状态。

---

## 当前状态 (2026-07-19)

- 原实现的 `activeSession` 是 renderer 本地内存。MAGI 窗口登录后返回 Agent 窗口并不能使用 armor，先前“回来后 Agent 能操作”的判断不成立。
- 已增加同源、非持久化 `BroadcastChannel` 同步和新窗口握手，并在 Agent 工具栏增加 guardian armor 状态入口；登录/登出同步测试和 Agent owner 请求头测试已通过。
- Identity Access 已从 MAGI 工作区移出，使用同一共享组件接入思源 Tab、右侧 Dock 和独立 Web 页面；原身份 upsert 面板的无效类型、函数和表单字段已清理。
- 真实桌面 Web 宿主已验证：Tab 与 Dock 可同时挂载，382px Dock 内容宽度无水平溢出，重复点击 Agent 身份入口仍保持一个 Tab 实例；修复了 Dock/Tab 同类型查重冲突，并将 Guardian 登录入口改为常显。
- 修复布局恢复阶段删除未固定 Agent Tab 时的 WebSocket 生命周期竞态：模型销毁现在先执行专用 `destroy()`，再安全释放基础连接；CONNECTING socket 不再调用 `send()`。干净桌面启动实测无布局重置对话框或同类控制台错误。
- 修复错误占位被迫继承 WebSocket `Model` 所暴露的布局抽象缺陷：新增不含网络能力的最小布局模型接口，以结构守卫替代通用 `instanceof Model`；`Model` 与纯工厂错误占位并列实现，错误占位只保留挂载、渲染和自描述序列化数据。未绕过 `imports.ts` 架构边界，`magi-desktop` 与 desktop 最终产物均已实机加载且无目标启动错误。
- `build:app`、`build:desktop`、`build:magi-identity`、新模块目标 lint 和 6 个挂载/适配器测试已通过；独立页浏览器实测 1440px 双列与 390px 单列均无水平溢出。
- 关联任务: [`AI Agent 会话外部任务目录绑定与所有者授权保护`](../AI_Agent任务目录绑定与授权保护.ttt.md)。该任务消费本任务签发和同步的 guardian armor，但目录 capability 的保存、权限和 owner 隔离仍由后端独立负责。

## 🟢 近期计划

- [ ] **Phase 8: armor 跨 renderer 生命周期与后端拒绝回归 (P0)**
  - **背景**: renderer 本地状态无法支撑独立窗口、Tab 与 Agent Dock 之间的鉴权交接。
  - **行动**: 验证登录、登出、过期、新窗口握手和页面关闭后的行为；验证同步消息不能替代后端验签；补齐错误 channel、route class 和 workspace 拒绝用例。
  - **验收标准**: 同源已打开页面同步成功；关闭全部页面后不残留 armor；伪造广播消息不能令无效 token 通过后端。
  - **参考文档**: `app/src/magi/service/magiIdentitySession.ts`、`app/test/magi/magiIdentitySession.sync.test.ts`、`kernel/api/magi_identity_test.go`

- [ ] **Phase 9: 多端与 Agent 目录授权端到端验收 (P1)**
  - **背景**: 单元测试不能替代真实桌面 Web 和手机访问路径。
  - **行动**: 在桌面 Web 与手机访问独立 Identity Access，完成 guardian 登录、Agent 会话发现、发任务和 task-directory 操作；确认 UI 可见性不影响后端授权结论。
  - **验收标准**: 两类远程客户端均可登录并使用受授权 Agent；无 owner armor 时相同入口由后端拒绝；目录路径不向未授权客户端泄露。
  - **参考文档**: `../AI_Agent任务目录绑定与授权保护.ttt.md`

- [ ] **Phase 10: 身份生命周期管理 (P1)**
  - **背景**: 需要覆盖口令轮换、主动撤销和审计查询。
  - **行动**: 增加口令修改、会话撤销、`jti` 撤销记录和可查询审计事件。
  - **验收标准**: 口令轮换后旧凭证失效；主动撤销可稳定拒绝后续请求；审计事件不记录明文口令或完整 token。
  - **参考文档**: `kernel/api/magi_identity.go`、`kernel/api/magi_identity_test.go`

## 🟡 中期计划

- [ ] **Phase 11: 外部 Avatar 身份转发契约 (P1)**
  - **背景**: 未来外部 Agent 需要作为 Avatar 向 MAGI 汇报，但不能取得 MAGI 或其它 Agent 的通信权限。
  - **行动**: 为 LLM 转发服务定义身份映射、owner 绑定、`report2magi` 等价适配器和历史读取接口。

## 🔴 远期计划

- [ ] **Phase 12: 身份行为画像与提示策略 (P2)**
  - **愿景**: 在不把展示昵称或 model 字段升级为安全字段的前提下，为不同身份提供稳定的交互策略。

## 🏁 已归档/已完成

- [x] **Phase 7: Identity Access 独立模块与多容器接入** [已完成 2026-07-19]
  - **完成情况**: 身份面板已重构为容器中立的共享 Vue 模块；接入思源 Tab、右侧 Dock 和 `/stage/build/magi-identity/` 独立页面；Agent 常显锁形入口直接打开 Identity Access；MAGI 缺少身份时打开独立页，不再切换内嵌模式；同时修复 upsert 面板编译残留、窄屏长渠道标识溢出和 Dock/Tab Custom Model 查重冲突。
  - **成果文件**: `app/src/magi/identity-access/`、`app/src/layout/dock/agent/AgentChat.ts`、`app/src/magi/entry/MagiWorkspace.vue`、`app/build.targets.json`、`app/src/constants.ts`。
  - **验证结果**: `build:app`、`build:desktop`、`build:magi-desktop`、`build:magi-identity`、Identity Access 目标 lint、布局模型目标 lint/严格类型检查、20 项相关前端测试、armor 同步测试和 Agent owner headers 测试通过；真实桌面宿主验证 Tab/Dock 共存、Tab 单实例复用、Dock 无水平溢出及布局恢复无 WebSocket CONNECTING 异常，MAGI 与 desktop 最终生产入口无 `Model` 初始化、`InvalidStateError` 或布局重置错误，独立页 1440x900 与 390x844 实测无水平溢出。
  - **参考文档**: `../AI_Agent任务目录绑定与授权保护.ttt.md`

- [x] **Phase 1: 身份模型与 claims 冻结** [已完成 2026-03-12]
  - **完成情况**: 已落地 `identity_id/display_name/route_class/enabled/password_hash`；armor claims 固定为 `sub/chn/ws/rtc/nck/iat/exp/jti`。
  - **成果文件**: `kernel/api/magi_identity.go`、`conf/magi-identities.json` 运行时契约。
  - **参考文档**: `docs/设计/MAGI/ARCHITECTURE.md`

- [x] **Phase 2: 身份登录与 armor 签发** [已完成 2026-03-12]
  - **完成情况**: 已实现 identity login；先验证 workspace API token，再校验身份口令并签发短期 armor；密码只保存 bcrypt 哈希。
  - **成果文件**: `kernel/api/magi_identity.go`、`app/src/magi/service/magiIdentitySession.ts`。
  - **参考文档**: `kernel/api/magi_identity_test.go`

- [x] **Phase 3: 标准 LLM 请求链路校验** [已完成 2026-03-12]
  - **完成情况**: OpenAI/Claude 兼容端点仅接受 armor Bearer；请求体镜像字段只做一致性比对；缺失或无效 token 返回 401，身份或渠道冲突返回 403。
  - **成果文件**: `kernel/api/magi.go`、`kernel/api/magi_messages.go`、`kernel/api/magi_source.go`。
  - **参考文档**: `docs/技术文档/MAGI/WEBSOCKET_PROTOCOL.md`

---

## 风险与约束

1. `BroadcastChannel` 只在同源且页面仍存活时有效；它不是持久会话，也不是跨设备同步机制。
2. 同源页面脚本环境本身不构成受信任执行环境，任何收到的 armor 仍必须由后端验签。
3. 独立页面读取 workspace API token 的方式必须沿用当前工作空间配置和访问授权链，不能另建浏览器持久凭证。
4. Identity Access 可见不代表用户已授权；隐藏入口同样不能阻止直接构造 API 请求。
5. MAGI 不取得 Agent task-directory capability；需要修改外部目录时派出普通 Agent/Avatar。

## 参考资料

- `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
- `docs/设计/MAGI/AVATAR.md`
- `app/src/magi/service/magiIdentitySession.ts`
- `app/src/layout/dock/agent/SessionStore.ts`
- `kernel/api/magi_identity_test.go`
