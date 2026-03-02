# MAGI实现状态调研

## 1. 调研范围与结论概览

本次调研覆盖了 MAGI 相关的设计文档、前端实现、后端接口与配置入口，重点包括：
- `docs/设计` 下 MAGI/AI人格/ATF/文体指纹相关文档
- `kernel/conf/agent.go`
- `kernel/api/magi.go`、`kernel/api/magi_messages.go`、`kernel/api/router.go`
- `app/src/magi` 目录
- `toread/MAGI` 目录

**总体结论**：当前项目处于“**设计文档非常完整 + 局部实现已落地 + 架构级核心（Ghost/ATF/记忆系统）未完整落地**”状态。

---

## 2. 已有设计文档清单与核心内容摘要

### 2.1 核心总纲与架构设计

1. `docs/设计/MAGI认知架构.design.md`
   - 定义 Ghost/Shell 分层、三贤人+Trinity、反射弧、Critical Decision/Rumination、ATF、Telemetry、语义安全、多源任务调度。
   - 给出了完整接口契约与运行机制，是总纲文档。

2. `docs/设计/AIagent设计.design.md`
   - 给出 Siyuan-Native Agent 的分层架构、接口抽象（Ghost/MemoryStore/ToolRegistry）、状态机与里程碑。
   - 强调记忆基于思源块系统而非外挂库。

3. `docs/设计/MAGI_Go后端落实工程设计.design.md`
   - 给出预期 Go 包结构（`kernel/agent/magi`、`kernel/agent/monitor`、`kernel/agent/adapter`）和落地路径。
   - 明确“Trinity 综合、三贤人后台侧写、Seraph 监控中间层”工程化方向。

4. `docs/设计/MAGI_Shell行动层.design.md`
   - 明确 NERV（理解决策）与 Tools（执行）的边界。
   - 约束 Action 发起/表决/反馈分发机制，以及暴走模式例外。

### 2.2 人格种子与问卷体系

5. `docs/设计/AI人格种子双轨制结构.design.md`
   - 定义“骨（`persona_matrix`）+肉（灵魂档案）”双轨制。
   - 定义 EMA 漂移、四盲微测、重写独白、工作空间绑定与专属记忆笔记本约束。

6. `docs/设计/MAGI_人格种子生成机制.design.md`
   - 规定 Persona Seed 结构化字段与生命周期。
   - 明确三贤人侧写的五层 Prompt 结构与模板注入方式。

7. `docs/设计/大五人格标测问卷(IPIP-NEO-120).design.md`
   - 提供 IPIP-NEO-120 标准题库与评分映射依据，是人格量化基线来源。

8. `docs/设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md`
   - 说明现有前端问卷与统一 `P_base` 目标冲突，定义迁移目标与数据格式。

9. `docs/设计/MAGI_大五人格映射掩码矩阵.design.md`
   - 从“掩码切分”转向“统一 `P_base` + 视角约束 Prompt”方法。

### 2.3 数学模型与风格指纹

10. `docs/设计/ATF数学模型.design.md`
    - 定义 `ρ`（同步率）与 `F`（ATF强度）数学体系：`C_int`/`C_ext`、赔率变换、动态趋势项、病理诊断。

11. `docs/设计/文体风格指纹算法.design.md`
    - 定义浅层统计特征+条件困惑度（PPL）组合指纹，用于实时风格一致性检测。

### 2.4 三贤人机制细化

12. `docs/设计/MAGI_三贤人_Melchior记忆与披露机制.design.md`
13. `docs/设计/MAGI_三贤人_Balthazar记忆与披露机制.design.md`
14. `docs/设计/MAGI_三贤人_Casper记忆与披露机制.design.md`
   - 分别细化贤人记忆边界、生命周期与披露策略。

### 2.5 交互层

15. `docs/设计/MAGI独立聊天面板.design.md`
   - 定义独立聊天面板目标、视觉规范、组件拆分、SSE 与 tool_use 展示。

---

## 3. 已实现代码模块与完成度评估

> 说明：完成度为调研估计（高/中/低），用于反映“与设计目标相比”的实现程度。

### 3.1 后端接口层（已落地）

1. `kernel/api/router.go`
   - 已注册 MAGI 路由：
     - `POST /api/s-forge/magi/v1/chat/completions`
     - `GET /api/s-forge/magi/v1/models`
     - `POST /api/s-forge/magi/v1/messages`
   - **完成度：高（接口已对外可用）**。

2. `kernel/api/magi.go`
   - 已实现基础串行队列调度（`magiQueue` + dispatcher）。
   - 支持同步/流式，支持 OpenAI 与 Claude 流式分发路径。
   - 目前主要是“队列+转发+封装响应”，尚非完整 Trinity/三贤人认知引擎。
   - **完成度：中（第一阶段雏形）**。

3. `kernel/api/magi_messages.go`
   - 已实现 Claude `messages` 协议兼容层。
   - 处理 string/array content 归一化、OpenAI↔Claude 请求响应转换、流式/非流式路径。
   - 有独立队列（非流式）与直连流式处理策略。
   - **完成度：中高（协议兼容层较完整）**。

### 3.2 后端配置层

4. `kernel/conf/agent.go`
   - 已提供 `AgentConfig` 与环境变量注入（enabled、soulDocID、model、token 等）。
   - 当前是通用 Agent 配置入口，不等同于完整 MAGI 认知内核配置系统。
   - **完成度：中（配置骨架具备）**。

### 3.3 前端 MAGI（主工程 `app/src/magi`）

5. `app/src/magi` 目录
   - 已存在完整模块化结构：`components/composables/core/entry/service/prompts/data`。
   - 已有 `core/magiSystem.ts`、`core/marduk.ts`、`core/wise/*`、`composables/useMagi.ts`、独立入口与状态按钮。
   - 实现了三贤人式投票编排、共识消息、UI 交互、国际化等。
   - 但与文档定义的 Ghost/ATF/病理监控/人格漂移数学链路相比仍有距离。
   - **完成度：中（可运行前端系统，非最终架构态）**。

### 3.4 toread/MAGI 参考实现（历史/实验资产）

6. `toread/MAGI`
   - 包含较完整原型：`core/magiSystem.js`、`core/nerv.js`、`core/marduk.js`、`components`、`persona/questionnaire` 等。
   - 更偏原型/探索性质，为现有 `app/src/magi` 与设计文档提供灵感与迁移来源。
   - **完成度：中（参考实现存在，但非内核主线代码）**。

---

## 4. 未实现但已设计的功能清单

### 4.1 Ghost 核心认知引擎完整落地（未完成）

- 设计要求的 `kernel/agent/magi` 包（`engine.go/trinity.go/wise_man.go/introspection.go`）未见实际代码落地。
- 当前后端主要是 API 网关与协议兼容层，不是完整认知中枢实现。

### 4.2 ATF 数学模型工程化（未完成）

- `ρ`/`F`、`C_int/C_ext`、赔率变换、趋势项与病理诊断尚未形成独立后端模块与稳定数据管线。
- 文体风格指纹算法（浅层统计+PPL）未见对应生产级实现入口。

### 4.3 Persona Seed 双轨制闭环（未完成）

- “骨（矩阵）+肉（灵魂文档）”自动更新闭环未完整落地。
- 四盲测试、EMA 漂移、阈值触发重写、监护人干预工具链未形成端到端实现。

### 4.4 问卷统一迁移（进行中/未完全）

- 设计目标为统一 IPIP-NEO-120 与统一 `P_base`。
- 当前前端仍可见历史自定义问卷体系痕迹（迁移文档已明确冲突与目标态）。

### 4.5 Shell 行动层严格分层机制（未完成）

- Action AI / Tools / 固定反馈分发 / 表决拦截链路尚未在后端形成与设计一致的完整实现。

### 4.6 Telemetry 广播与可视化联动（未完成）

- 设计中的 `magi-telemetry` 广播（同步率、ATF、投票轮次）未见完整后端广播与前端消费闭环。

### 4.7 Dreaming 与记忆固化流程（未完成）

- 设计中的造梦流程（场景快照/经验教训/日记/统合叙事）尚未见主线实现。

---

## 5. 模块依赖关系（当前态）

## 5.1 运行时调用关系（已落地主路径）

1. 前端 `app/src/magi` 或独立面板
2. 调用后端 `kernel/api/router.go` 注册的 MAGI 接口
3. 进入 `kernel/api/magi.go` / `kernel/api/magi_messages.go` 队列与分发
4. 调用 `kernel/util` 的 OpenAI/Claude 客户端封装
5. 依赖 `model.Conf.AI.OpenAI` 配置与 `kernel/conf/agent.go`（Agent配置项）

### 5.2 设计态目标依赖（尚未完全落地）

1. Persona Seed（IPIP-NEO-120 + 双轨制）
   → 提供统一 `P_base` 与动态状态
2. 三贤人侧写与 Trinity 综合（Ghost）
   → 产出决策与内省数据
3. ATF/文体指纹/病理检测（Seraph）
   → 产生调节与告警信号
4. Shell 行动层执行与反馈分发
   → 结果回注三贤人，形成闭环
5. Telemetry 广播到前端独立面板
   → 可视化运行状态

---

## 6. `toread/MAGI` 目录实现状态摘要

`toread/MAGI` 目录内容较完整，涵盖：
- UI：主面板、消息气泡、SEEL 面板、人格问卷组件
- Core：`magiSystem.js`、`nerv.js`、`marduk.js`、`wise/*`
- Data：问卷分区、私有种子目录
- 工具：SSE/消息格式等

该目录体现了较成熟的原型思路（多人格、共识、问卷、界面），但当前主工程采用了 `app/src/magi` 作为更规范化实现路径。可视为“历史原型 + 参考资产”，不是内核后端落地主线。

---

## 7. 综合评估

- **设计完整度**：高
- **前端可用度**：中高（已有可运行模块与入口）
- **后端接口可用度**：中高（API 与流式兼容已具备）
- **核心认知引擎落地度（Ghost/ATF/记忆闭环）**：低到中

当前最显著特征是：**“接口与前端先行，认知内核分层实现滞后”**。后续若按设计推进，应优先补齐 `kernel/agent/*` 核心包与 ATF/Persona Seed 数据闭环，再将现有 API 层由“协议转发+基础队列”升级为“完整 MAGI 认知执行入口”。

---

## 8. 补充结论（2026-03-02）

> 本节补充了对 `app/src/magi` 当前实现细节的二次核查结论，重点聚焦“人格种子问卷是否已形成闭环”。

### 8.1 关键新增判断

1. **问卷采集层并非空白，已具备可用基础**
   - 已有统一 IPIP-NEO-120 题库与分布校验（`ipip-neo-120.ts`）。
   - 已有逐题 Likert 作答、进度控制、提交事件与 JSON 落盘（`CompositeRating` + `PersonaSeedPanel`）。
   - 前端提交格式与 `schema_version: "IPIP-NEO-120-v1"` 对齐。

2. **真正缺口不在“再做一版问卷UI”，而在“人格种子闭环未接通”**
   - 当前链路基本停在“采集并保存原始答案”，问卷保存后仅追加系统提示消息。
   - 缺少从原始答案到 `PersonaBase(OCEAN+30)` 的计算与消费主链。
   - 缺少把 `IpipPersonaProfile` / `summaryPrompts` 产物注入三贤人运行时提示词的接线。

3. **三贤人运行仍以默认人格提示词为主，未被新问卷结果驱动**
   - `initMagi` 启动流程当前未接入基于采样结果动态生成的四视角 Prompt。
   - 说明“IPIP迁移”在当前代码中完成了“数据层+组件层”，但未完成“运行时行为层”。

4. **共识与投票链路已进展到“可跑通”，但仍有占位能力**
   - Critical Decision 已改为二元表决触发。
   - Rumination 仍是入口存根，尚未形成真实反刍循环。
   - `wise.guard` 中仍有 `@AITODO` 提示的守卫精度问题，存在潜在健壮性风险。

### 8.2 对“下一任务”的更新建议（优先级）

**P0（首要）**：实现“人格种子闭环接线”
- 目标链路：`IPIP原始答案 -> PersonaBase计算 -> 四视角Prompt生成 -> 注入/重建MAGI实例`
- 价值：这是把问卷从“采样工具”升级为“人格驱动器”的关键一步。

**P1（次优）**：补全 Rumination 实循环
- 把当前反刍入口从提示文案升级为真实多轮状态机。

**P2（并行修正）**：修复守卫与题面质量细节
- 收敛 `wise.guard` 的弱守卫问题。
- 校对题库个别文案错误（例如个别题干措辞异常），避免长期污染采样质量。

### 8.3 结论修正

如果只讨论“问卷”，当前阶段最应该做的是**“完善问卷结果接入运行时”**，而不是继续扩展问卷表单本身。  
换句话说，下一步应优先做“人格种子闭环”，而不是“问卷功能堆叠”。
