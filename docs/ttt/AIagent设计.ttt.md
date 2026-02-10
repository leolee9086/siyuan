# AI Agent 移植执行跟踪 (TikTocTak)

> **目标**: 将 `toread/nanoClaw`（Python asyncio AI Agent 框架，~2800行）移植到 `kernel/agent`（Go），构建高性能、安全且具备持久记忆的通用 Agent 运行时。预估 ~4300 行 Go 代码，27 个工作项分 6 个阶段。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 项目背景

### 源码与设计文档

- **源码**: [`toread/nanoClaw/`](../../toread/nanoClaw/) — Python asyncio 实现，约 2800 行
- **设计文档**: [`docs/设计/AIagent设计.design.md`](../设计/AIagent设计.design.md) — 包含完整架构设计、移植调研、工作项清单和技术风险分析
- **目标位置**: `kernel/agent/` — Go 实现

### 关键路径

LLM 客户端 (#2) → Agent 主循环 (#5) → 工具注册表 (#4) → 安全层 → 其余模块

### 架构决策点

| 决策项 | 待定选项 | 参考 |
|--------|---------|------|
| LLM 提供商策略 | A: 多提供商原生适配 / B: 统一 OpenAI 兼容格式 | 设计文档 §五 |
| 记忆搜索引擎 | A: FTS5 / B: 向量语义搜索 | 设计文档 §五 |
| 技能系统 | A: yaegi 解释执行 / B: 编译时注册 | 设计文档 §五 |
| Telegram 通道 | A: 移植 / B: 不移植 | 设计文档 §五 |

### 可复用 kernel 基础设施

| 设施 | 位置 | 用途 |
|------|------|------|
| HTTP 服务 | `kernel/server/` | API 端点复用 gin 路由 |
| AI 模型调用 | `kernel/model/ai.go` | 已有 go-openai 集成 |
| 定时任务 | `kernel/cronjob/` | yaegi 沙箱、安全执行 |
| 向量数据库 | `kernel/vectordb/` | 语义搜索基础设施 |
| 嵌入向量 | `kernel/embedding/` | Ollama 集成 |
| SQL 层 | `kernel/sql/` | SQLite + FTS5 |

---

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理，随时修改或删除。
4. **子计划管理**: 复杂阶段应创建 `.shortterm.ttt.md` 子计划文档。
5. **决策记录**: 架构决策确定后，更新上方决策表并注明日期和理由。

---

## 🟢 近期计划 (立即聚焦)

- [ ] **Phase 0: The Mind Prototype (TypeScript)**
  - **目标**: 在独立的 TS 环境中验证 MAGI/ATF 核心算法，避免 Go 的复杂性。
  - **范围**:
    1. **Setup**: Init TS project + OpenAI SDK setup.
    2. **ATF Logic**: Implement $F(\rho)$ and SyncRate calc.
    3. **Trinity Core**: Implement Reflex Arc & Monologue Loop.
    4. **Simulation**: Run a mock conversation to test stability.
  - **验收标准**:
    - TS 脚本可运行并模拟多轮对话
    - ATF 曲线符合预期

- [ ] **Phase 1: 核心引擎基础 — 配置 + LLM 客户端 + 上下文构建器**
  - **背景**: 核心引擎是所有后续模块的基础，包含工作项 #1 #2 #3 #6（设计文档 §3.1）
  - **范围**:
    1. 配置模型 (#1): Go struct + `encoding/json`，扩展 `kernel/conf/`，~150 行
    2. LLM 客户端 (#2): 扩展 `go-openai`，**高复杂度**，~400 行
    3. 上下文构建器 (#3): 动态工具选择 + 自适应历史窗口，~200 行
    4. SessionCache (#6): `sync.Map` + TTL 过期，~60 行
    5. **Soul解析器** (#new): 解析 Siyuan 文档结构，提取 System/Tools，~250 行
    6. **JS运行时** (#new): 集成 `dop251/goja`，实现 Native Function 注入，~150 行
    7. **Feedback Dispatcher** (#new): 实现 Ghost/Shell 的消息反馈分发机制 (Content/Status/Full)，~100 行
  - **验收标准**:
    - `kernel/agent/` 目录结构建立
    - 配置可从 JSON 加载
    - LLM 客户端可完成单轮对话
    - **Soul Document**: 可解析 Siyuan 笔记提取 System Prompt 和 JS 工具
    - **JS Runtime**: 集成 goja，可简单的 `eval` JS 代码
  - **⚠️ 高风险**: Anthropic Messages API 适配（设计文档 §4.1.1）

- [ ] **Phase 2: Agent 主循环 + 工具注册表**
  - **背景**: ReAct 循环是 Agent 的核心，工具注册表是工具系统的基础，包含工作项 #4 #5（设计文档 §3.1）
  - **范围**:
    1. 工具注册表 (#4): Go `interface` + `sync.Map`，~200 行
    2. Agent 主循环 (#5): System 1 (Fast ReAct) + System 2 (MAGI Cognitive Loop)，**极高复杂度**，~650 行
    3. **Three Wise Men** (#new): Melchior/Balthazar/Casper 侧写生成与 (Semantic/Episodic/Working) Memory 绑定，~200 行
    4. **Trinity Core** (#new): 内省机制 (Introspection) + 唯我执行权 (Exclusive Execution)，~150 行
    5. **Time-Based Competition** (#new): 实现 Casper 抢占 (Preemption) 和超时丢弃逻辑，~100 行
    6. **Global Broadcast** (#new): 实现 Trinity 自述循环 (Monologue -> State Modulation)，~150 行
  - **验收标准**:
    - ReAct 循环可迭代执行
    - 复杂问题触发 MAGI 多角色投票
    - 仅 Trinity 可调用工具，三贤人仅输出思考
    - 工具可注册和调用
    - BudgetTracker 正确限制迭代/Token/速率
  - **⚠️ 高风险**: 并发安全（设计文档 §4.1.2）
  - **依赖**: Phase 1

---

## 🟡 中期计划 (架构演进)

- [ ] **Phase 3: 安全层 (Security & Health)**
  - **背景**: 多层级安全沙箱及 **精神卫生调节**，包含工作项 #7-#12 + #Seraph（设计文档 §3.2 + §7.4）
  - **范围**: 
    - PromptGuard、SessionBudget、FileGuard、ShellSandbox、AuditLog、SecurityDoctor
    - **Seraph System** (#new): 每日心理调节、同步率 (SyncRate) 监控、紧急停机机制，~250 行
    - **Psyche Matrix** (#new): OCEAN 向量计算与相似度评估，~150 行
  - **⚠️ 中风险**: Shell 沙箱跨平台适配（设计文档 §4.2.4）、NFKC 归一化（设计文档 §4.2.5）
  - **依赖**: Phase 2

- [ ] **Phase 4: 存储与记忆 + 工具实现**
  - **背景**: 记忆系统和工具集，包含工作项 #13-#20（设计文档 §3.3 + §3.4），~990 行
  - **范围**:
    - MemoryStore (#13): 复用 `kernel/sql`，SQLite + FTS5
    - **Native Bridge** (#new): 暴露 `siyuan.kernel.*` API 给 JS 运行时
    - 语义搜索升级 (#14): 集成 `kernel/embedding` + `kernel/vectordb`
    - **Dreaming Process** (#new): 实现记忆固化循环 (Scene/Lessons/Diary/Narrative) + 文生图集成，~250 行
    - 文件/Shell/Web/记忆/后台任务工具 (#15-#20)
  - **⚠️ 中风险**: SSRF 防护 DNS 解析（设计文档 §4.2.3）
  - **依赖**: Phase 3

---

## 🔴 远期计划 

- [ ] **Phase 5: 通道与调度**
  - **愿景**: 消息路由、HTTP API、Telegram（可选）、Cron 调度、Dashboard
  - **范围**: 工作项 #21-#25（设计文档 §3.5），~630 行
  - **依赖**: Phase 4

- [ ] **Phase 6: 技能系统 + 集成测试**
  - **愿景**: 技能加载器 + 内置技能 + 端到端集成测试
  - **范围**: 工作项 #26-#27（设计文档 §3.6），~230 行
  - **依赖**: Phase 5

---

## ⚠️ 风险与依赖

> 详细风险分析见 [设计文档 §四](../设计/AIagent设计.design.md)

| 风险等级 | 风险项 | 涉及工作项 |
|----------|--------|-----------|
| 🔴 高 | Anthropic Messages API 适配 | #2 LLM 客户端 |
| 🔴 高 | Agent ReAct 循环并发安全 | #5 Agent 主循环 |
| 🟡 中 | SSRF 防护 DNS 解析 | #18 Web 抓取 |
| 🟡 中 | Shell 沙箱跨平台适配 | #10 ShellSandbox |
| 🟡 中 | 提示注入正则 Go 兼容性 | #7 PromptGuard |

---

## 📊 进度跟踪

| 阶段 | 工作项数 | 行数估算 | 状态 |
|------|---------|---------|------|
| Phase 1: 核心引擎基础 | 4 (#1,#2,#3,#6) | ~810 | 未开始 |
| Phase 2: Agent 主循环 + 工具注册表 | 2 (#4,#5) | ~650 | 未开始 |
| Phase 3: 安全层 | 6 (#7-#12) | ~990 | 未开始 |
| Phase 4: 存储与记忆 + 工具 | 8 (#13-#20) | ~990 | 未开始 |
| Phase 5: 通道与调度 | 5 (#21-#25) | ~630 | 未开始 |
| Phase 6: 技能系统 | 2 (#26-#27) | ~230 | 未开始 |
| **合计** | **27** | **~4300** | **0%** |

---

## 🏁 已归档/已完成

- [x] **移植调研 (2026-02-09)**
  - 完成 nanoClaw 完整源码阅读和 kernel 环境分析
  - 产出: [设计文档](../设计/AIagent设计.design.md) §二至§六
  - 关键结论: 27 个工作项，~4300 行 Go，kernel 可复用约 25% 工作量

- [x] **二次调研：myclaw Go 实现参考 (2026-02-10)**
  - 完成 myclaw 完整源码阅读（~2000 行 Go，基于 agentsdk-go）
  - 产出: [设计文档](../设计/AIagent设计.design.md) §七至§九
  - 关键发现: 消息总线架构、企业通道支持、配置优先级机制值得借鉴
  - 架构警示: 外部 SDK 依赖失去核心控制权，kernel 应坚持自建 ReAct 循环
  - 工作量更新: 原计划 ~4300 行 + 可选扩展 ~730 行 = ~5030 行 Go 代码

---

**文档创建**: 2026-02-10 00:37 (UTC+8)
**最后更新**: 2026-02-10 00:58 (UTC+8)
