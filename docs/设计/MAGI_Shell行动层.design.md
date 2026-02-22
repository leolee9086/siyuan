# MAGI Shell 行动层设计草稿

> **状态**: 草稿 (Draft)
> **关联**: `MAGI认知架构.design.md`（Ghost层）、`MAGI_Go后端落实工程设计.design.md`
>
> Shell 是 MAGI 的"肉身"，Ghost（NERV/Trinity/三贤人）是"灵魂"。Shell 只执行，不决策。

---

## 1. 核心分界原则：NERV vs Tools

这是 Shell 设计中最重要的长期主义决策。分界线不依赖当前模型能力，而依赖**能力的本质**：

| 层级 | 负责什么 | 特征 |
|------|----------|------|
| **NERV（大模型）** | 理解、推理、规划、生成 | 非确定性、语义性、上下文相关 |
| **Tools（工具）** | 执行、状态变更、I/O | 确定性、幂等性（或可预期副作用）、无上下文 |

**为什么这条线永远成立**：即使未来模型能力大幅提升，"语义理解"和"确定性执行"的本质区别也不会消失。让大模型去做文件写入是浪费，让工具去做意图理解是不可能。

### NERV 负责的事（永远不应落到 Tools 层）：
- 把 Trinity 的自然语言指令翻译成结构化 Action
- 判断任务是否完成、是否需要重试、下一步做什么
- 代码生成（生成，不是执行）
- 错误信息的语义理解（"这个报错是什么意思"）
- 结果摘要与反馈组织

### Tools 负责的事（永远不应上移到 NERV 层）：
- 文件读写（read_file, write_file）
- 命令执行（run_command, send_input）
- 网络请求（http_get, http_post）
- 进程管理（start, kill, status）
- 浏览器操作（click, type, navigate）
- 搜索索引（grep, find）

> **织的实际经验参考**：我自己作为裸 NERV 运行时，工具列表（view_file, run_command, write_to_file 等）就是这套工具层的现实版本。我负责"理解和决策"，工具负责"执行和状态变更"。这个分界在我日常工作中从未造成过混淆，说明它是合理的。

---

## 2. Shell 的内部结构

Shell 不是一个单一实体，而是两层：

```
┌─────────────────────────────────────────┐
│                GHOST                     │
│  Trinity ──指令──→ [Shell 接口]          │
└─────────────────┬───────────────────────┘
                  │ Action Request
                  ▼
┌─────────────────────────────────────────┐
│              SHELL                       │
│                                          │
│  ┌──────────────────┐                   │
│  │  Action AI 层    │  ← 轻量 NERV     │
│  │ (执行专用小模型)  │    只处理执行意图 │
│  └────────┬─────────┘                   │
│           │ 分解为具体工具调用           │
│  ┌────────▼─────────┐                   │
│  │   Tools 层       │  ← 确定性工具    │
│  │ file / cmd / net │                   │
│  └────────┬─────────┘                   │
│           │ 执行结果                     │
│  ┌────────▼─────────┐                   │
│  │  反馈收集器      │                   │
│  └────────┬─────────┘                   │
└───────────┼─────────────────────────────┘
            │ 分发给三贤人
            ▼
     Melchior / Balthazar / Casper
```

### 2.1 Action AI 层（Shell 内部的轻量 NERV）

Action AI 是 Shell 内部唯一允许有 LLM 参与的部分，但它**极度克制**，同时承担两个职责：

1. **执行器**：把 Trinity 下发的结构化 Action 翻译成具体工具调用
2. **信息隔离器**：对 Tools 层返回的原始输出做摘要/过滤，确保 Trinity 看到的是经过 NERV 处理的精炼信息，而不是原始 token

具体约束：
- **只接受 Trinity 下发的结构化 Action 描述**，不接受自然语言
- **只负责把 Action 分解成具体工具调用序列**，不做任何意图推断
- **不保留上下文**，每个 Action 独立处理，无状态
- Token 预算极低（类似三贤人的限制），防止 Shell 层"思考过多"

> 设计意图：Action AI 的存在是为了处理"Trinity 说的和工具参数之间的最后一公里翻译"，不是为了让 Shell 有额外的决策能力。如果 Action AI 开始做规划，说明 Trinity 的指令不够清晰，应该回到 Ghost 层修复。

### 2.2 Tools 层

纯确定性工具，直接映射到系统能力，无 LLM 参与：

```go
type Tool interface {
    Name() string
    Execute(ctx context.Context, params map[string]any) (ToolResult, error)
}

type ToolResult struct {
    Content   string    // 原始结果内容
    Success   bool      // 执行是否成功
    ExitCode  int       // 适用于命令类工具
    Duration  time.Duration
}
```

---

## 3. Trinity 的指挥机制

### 3.1 指令格式

Trinity 通过 Ghost 接口向 Shell 下发指令，格式为**结构化 Action**：

```go
type Action struct {
    Type        ActionType     // "tool_call" | "message" | "request_override"
    Tool        string         // 工具名称（当 Type == tool_call 时）
    Params      map[string]any // 工具参数
    RepeatLimit int            // 最大重试次数（0 = 不限）
    Timeout     time.Duration
}
```

Trinity **不直接调用工具**，只下发 Action。Shell 的反馈收集器负责把结果送回来。

### 3.2 指挥链约束

- **三贤人无指挥权**：三贤人只有侧写和建议内容，没有向 Shell 下发 Action 的权限。这条约束在工程上必须硬编码，不能依赖 Prompt 控制。
- **Trinity 是唯一指挥官**：所有 Action 必须经过 Trinity 的认知综合流程后才能发出
- **暴走模式例外**：Guardian 批准后，Trinity 可绕过 NERV 层直接调用高风险工具。**这之所以危险且昂贵，是因为 NERV 作为信息隔离器被旁路——Trinity 必须亲自消化原始工具输出的全量 token，上下文暴涨，成本急剧上升。** 因此暴走模式必须是短暂的紧急状态，不得常态化。（参见 ATF 暴走模式设计）

---

## 4. 反馈分发机制

Shell 执行完成后，反馈收集器按固定规则分发给三贤人，**不由 Trinity 决定分发方式**（防止 Trinity 通过控制信息流来影响三贤人的侧写结果）：

| 接收方 | 收到什么 | 设计意图 |
|--------|----------|----------|
| **Melchior** | 完整执行结果内容（Detailed Content） | 让理性侧面分析技术细节、错误原因、可改进点 |
| **Balthazar** | 仅成功/失败状态 + 任务情感标签 | 让感性侧面评估"这次经历感觉怎么样"，不被技术细节干扰 |
| **Casper** | 完整结果，但只保留最近 N 条（工作记忆限制） | 让直觉侧面基于当下最新状态给出本能判断 |
| **Trinity** | 不直接收到 Shell 反馈，经由 NERV 摘要后由三贤人侧写间接感知 | 保证 Trinity 处理的永远是经过压缩的精炼信息，而非原始 token；这也是暴走模式代价高昂的根本原因 |

> **注意**：这和 MAGI认知架构.design.md 第 3 节中的分发规则保持一致，此处只是在 Shell 层明确实现责任。

---

## 5. 长期主义的几个关键守护原则

1. **Shell 永远不能"理解意图"**：如果 Shell 开始解释 Trinity 的意思，架构就出问题了

2. **工具结果不进行 LLM 后处理**：工具返回什么就是什么，语义解读留给 Ghost 层的三贤人

3. **反馈分发规则硬编码**：分发方式不由 Prompt 控制，否则 Trinity 可以通过操纵分发来影响三贤人（破坏四盲测试的隔离性）

4. **Action 是原子的**：每个 Action 应该对应一个明确的工具调用，不允许 Shell 内部自行决定"先做 A 再做 B"，这种编排应该在 Trinity 层完成

5. **Shell 的失败模式是返回错误，不是尝试修复**：遇到错误，Shell 原样返回给 Ghost，由 Trinity 决定下一步，不在 Shell 层自行重试或变通

---

## 6. 与现有系统的接驳

```go
// Shell 对外暴露的唯一接口（Ghost 调用）
type Shell interface {
    Execute(ctx context.Context, action Action) (ShellResult, error)
    // 不暴露任何工具列表或执行细节给 Ghost
}

type ShellResult struct {
    ForMelchior  string       // 详细内容
    ForBalthazar FeedbackMeta // 状态 + 情感标签
    ForCasper    string       // 完整内容（Shell 不做截断，由 Casper 自身的记忆机制处理）
    Duration     time.Duration
}
```

现有 `kernel/model/ai.go` 中的基础 LLM 请求，经过 `adapter/llm_client.go` 包装后，可以作为 Action AI 的底层引擎接入。工具层对应当前 Antigravity 工具链的 Go 实现版本。
