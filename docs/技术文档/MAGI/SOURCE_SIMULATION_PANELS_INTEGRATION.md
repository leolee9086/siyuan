# Source Simulation Panels 对接方案

更新时间：2026-03-08
状态：进行中（Phase 1 已完成，Phase 2 进行中）

## 1. 目标

`Source Simulation Panels` 不是普通聊天窗口，而是来源仿真台。它用于验证：

1. 来源身份解析是否正确（channel/source/trust/risk/caller）。
2. 入口策略是否按来源分流（放行/拦截/Avatar-only）；Avatar-only 表示路由到 Avatar 协议角色，当前内部实现使用上游普通 Agent 会话，未来也可通过 LLM 转发服务接入，不表示独立 Avatar 运行时。
3. 多来源并发请求时，路由与会话绑定是否稳定。

## 2. 前端输入契约

前端在来源仿真请求中，会在系统消息中注入：

```xml
<magi_request_source>{"requestId":"...","callerId":"...","source":"...","trustBase":"...","riskLevel":"...","profileId":"...","profileLabel":"...","sourceChannel":"...","sourcePanelId":"...","sourcePanelTitle":"..."}</magi_request_source>
```

其中核心字段：

1. `source`：`guardian|external-agent|system-cron|unknown`
2. `trustBase`：`low|medium|high`
3. `riskLevel`：`low|medium|high`
4. `sourceChannel`：白名单通道枚举
5. `sourcePanelId/sourcePanelTitle`：用于区分来源面板实例

## 3. 后端接收契约

后端通过 `resolveOpenAISourceContext` / `resolveClaudeSourceContext` 解析系统消息中的 `magi_request_source`（或 `request_source`）标签，构建 `RequestSourceContext`，并参与：

1. 综合鉴权（先过 `CheckAuth`，再做来源键校验 `X-MAGI-Source-Key` / `X-API-Key` / token 解析）。
2. 信任与风险信号归一化。
3. `DirectResponseAllowed` 计算（是否允许直接 MAGI 主通道响应）。
4. `sourceSessionKey` 绑定（来源会话复用）。

接口：

1. `POST /api/s-forge/magi/v1/chat/completions`
2. `POST /api/s-forge/magi/v1/messages`

## 4. 端到端流程（目标形态）

1. 来源面板构造来源上下文。
2. 前端发起 OpenAI-compatible 请求到后端 MAGI 接口。
3. 后端解析来源上下文并执行入口策略。
4. 后端按策略走 Avatar 或主 MAGI 决策；内部 Avatar 通过 `report2magi`、外部 Avatar 通过等价转发适配器向 MAGI 汇报。
5. 前端来源面板显示该来源请求结果；主面板/贤者面板通过事件流投影状态。

## 5. 分阶段落地

### Phase 1（已开始）

范围：仅来源仿真请求先走后端 MAGI 接口。

1. 来源仿真请求由前端适配层转发到 `/api/s-forge/magi/v1/chat/completions`。
2. 保持原有 `CheckAuth` 链路不简化，额外附带 `X-MAGI-Source-Key` 作为来源层鉴权输入。
3. 普通主聊天请求仍维持现有路径，降低一次性改动风险。

### Phase 2（后续）

范围：主聊天也切到后端 MAGI，前端本地共识流程退到 fallback/debug。

当前进展：

1. `magi` 适配器主路径已改为统一后端转发（不再走本地 MAGI 共识实现）。
2. 非 `sourceSimulation` 请求默认使用 `magi-main-ui` 身份头（`X-MAGI-Interface-*`）与 `user` 身份字段。
3. 后端对 `magi-main-ui` 非来源仿真请求启用 direct-main 策略约束，不满足条件直接拒绝，不降级 Avatar。
4. 前端已移除 `llmAdapterMode` 运行时切换入口，MAGI 界面固定使用后端 MAGI 适配器。

### Phase 3（后续）

范围：接入后端 `magiEvent` 实时事件，驱动贤者面板与投票进度的统一投影。

## 6. 明确边界

1. `Source Simulation Panels` 的职责是来源策略联调，不承担人格问卷（Persona Seed）逻辑。
2. 来源仿真请求必须可独立追踪，不与普通主输入混淆。
3. 来源仿真路径后端不可用时直接失败，不回退本地 MAGI 路径。
