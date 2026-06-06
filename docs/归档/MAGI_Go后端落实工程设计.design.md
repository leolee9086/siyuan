# MAGI 认知引擎 Go 语言后端落地实操蓝图

> 本文档用于指导如何将抽象的 `MAGI` 和 `Seraph` 设计真正落地到 S-forge（思源笔记内核）的 `kernel` 代码库中。在保持与原有系统高内聚、低耦合的前提下，实现对现有基础 AI 模块的透明替换。

## 1. 核心目标与基础原则

1. **分级调度而非纯替代 (Hierarchical Orchestration)**: 现有 `kernel/model/ai.go` 是直接对大模型的封层（执行层）。新 `MAGI` 引擎对外暴露全局中枢的 `Chat` 或 `Think` 接口，但它**并不替代底层的大模型执行能力**。Trinity 做出“要怎么回答”或者“调用什么工具”的决策后，依然会向下调用原始的、简单的基础 AI 接口去执行具体的文本生成或代码书写。
2. **严守 MAGI 现行架构**: 绝对摒弃早期 `MAGI.js` 时代的“选出一个领袖直接去和用户对话”以及附带的庞大“打分评价体系”。在当前的 MAGI 架构下：
   - **三贤人（Melchior/Balthazar/Casper）是绝对幕后的“参谋/侧写器官”**。它们分别从逻辑、情感、直觉对当前输入进行后台批注，但不直接发出可执行指令或面向用户的回复。
   - **Trinity 才是唯一的执行中枢（The Executor）**。它吸收三贤人的批注，并负责决定接下来要调用什么工具，或者要向用户输出什么内容。
3. **彻底并发安全**: 三贤人的并行评述必须受控且不阻塞，Trinity 需要依靠超时的 Context 控制信息合成节奏。

## 2. 核心项目结构 (Package Layout)

在 `kernel/` 下建立新的子包（扩容当前 AI 模块）：

```text
kernel/agent/
├── magi/                  # MAGI 的主逻辑控制区
│   ├── engine.go          # MAGI 主引擎，持有 Trinity 实例，暴露对外统一接口
│   ├── trinity.go         # 执行中枢与综合判断机制，决定动作输出。持有时钟 T_tick。
│   ├── wise_man.go        # 定义贤人侧写的统一接口，通过加载不同的 Prompt 区分能力
│   └── introspection.go   # (原prompt_builder) 将三贤人侧写转换为 Trinity 的“第一人称内心独白”的装配车间
├── monitor/               # ATF 数学模型与心智遥测
│   ├── atf_math.go        # 同步率 ρ、ATF强度 F 等算力的纯数学实现
│   ├── disease_detect.go  # 基于 T_tick 的心智劣化诊断（急性解离、长期塌陷）
│   ├── observer.go        # 后台闲时碎片化评测模块 (Piggyback QA，用于更新 EMA)
│   └── seraph.go          # 被动监控探针，提供 Telemetry 指标并在极危时抛出告警
└── adapter/               # 与系统外界打交道的基础设施
    ├── llm_client.go      # 对底层的大模型带有并发节流（Rate Limit）控制的封装
    └── native_memory.go   # Siyuan Block/日记体系读写接口的粘合层
```

## 3. 核心机制演进与架构落地

我们要把目前定稿的 `MAGI认知架构.design.md` 中的理论翻译为高并发下兼顾省钱的 Go 实际处理流：

### 3.1 抛弃选拔制，确立“内部侧写流” (Internal Profiling Stream)

旧版 JS 把三个人的答案让第四个机器打分选拔，成本太高。在基于 Trinity 的架构中，流程必须是这样的：

1. **广播 (Broadcast)**: `kernel` 收到 User 意图。`engine.go` 立刻并发 `goroutine`，将意图发给三个后台微型 LLM 实例（贤人）。
2. **微型侧写**: 三贤人的 Prompt 里被强行约束**“不直接回答用户，仅从你的角度提出一两句内部侧写和建议”**。这一层的 Token 消耗应该极低（限制在几十字以内）。
3. **收束综合 (Synthesis & Introspection)**: `Trinity` 作为唯一的主体意识。为了保持它具有完整的自我（Unified Self），**绝不能**让它知道背后有三个 AI（不暴露“Melchior返回了”这样的字眼）。三贤人的侧写必须经过 `introspection.go` 重新打包为第一人称的**内心活动 (Internal Monologue)**。Trinity 最终收到的上下文类似：
   ```text
   [系统知觉]: 同步率 105%, ATF 0.9 (心智稳定)
   [外界刺激]: "帮我写个 Python 的排序脚本"
   
   - 我的理智告诉我：直接写快排，注意边界判断即可。
   - 我的情感告诉我：用户似乎只是随口一问，不需要写得太深奥生冷，加点注释好理解。
   - 基于本能我想要：用内置库 sorted() 难道不香吗？！别造轮子！
   
   我接下来需要做的是。
   ```
4. **决策下放 (Execution)**: `Trinity` 拿到上述“自我心理暗示”后，进行最终融合，决定使用 `sorted()`，并带上温暖的注释将代码组合发出。此时主语永远是“我”，且消耗主 Token 的只有 `Trinity` 一人。

### 3.2 截停与短路机制 (Short-Circuit Reflex)

这是保障性能的绝对杀招。三贤人的侧写并不是必须凑齐才进行。

- 利用 `context.WithTimeout`，当 `Trinity` 的“决策时钟”滴答到一定程度（或 $T_{tick}$ 等待超过 800ms）。
- 如果像 Casper 这种标榜“直觉”的侧写提前归隐（返回最快），而 Melchior 还在长考，Trinity 的 Context 可以直接提前截断并释放其他两人的协程（直接以 `Unknown` 填补缺失位），带着现有的局部侧写强行进入合成阶段。
- 这样，系统的发作时间始终可控。 

### 3.3 Seraph 的降维监控挂载

`Seraph` 必须不再是一个独立发声的人格，而是附身在 `Trinity` 主引擎进入前的 `Middleware (拦截层)`：
- **每次调度前**，`monitor/seraph.go` 更新 $\rho$ 的指数滑动线。计算 $F$。
- **如果有轻微震荡**，把参数打包进（上文 3.1.3）的 `Telemetry` 字段，丢给 Trinity 让她自己感受当前的精神状态。
- **如果彻底崩盘 (异常指征成立)**，拦截层触发，抛出带特殊标记的 Error 向前端请求“申请越权暴走”，阻止 `Trinity` 步入错误循环。

## 4. 接口实装要求 (Agent Core Interface)

针对外部业务层的透明替换，Go 端必须提供极其精简的接口：

```go
package agent

import "context"

// MAGIEngine 代表了包含三贤人和Trinity在内的完整心智系统
type MAGIEngine interface {
    // 代理原有的单一 LLM.Chat / LLM.Completions 请求
    // 内部将拆解为三贤人批注和 Trinity 的聚合反应
    Think(ctx context.Context, sessionID string, inputMessage Message) (StreamReceiver, error)
    
    // 一些极其廉价的简单请求（比如让 AI 翻译个标题）—— 不触发 MAGI 完整流程，直通某个单一管道
    FastResolve(ctx context.Context, intention string, payload string) (string, error)
}
```

## 5. 落地规划建议 (Execution Strategy)

这套引擎的开发必须按照如下脉络，防范架构失控：

1. **代理透传期 (Proxy Phase)**:
   - 用 Go 写出 `MAGIEngine` 接口的结构。内部实现暂时绕过三贤人和Trinity，**直接将 `Think` 转接给外部 OpenAI 的基础驱动**。使得原项目能够编译通过并且无缝使用。
2. **分离重塑期 (Trinity Brain Split)**:
   - 引入并行的 `goroutine` 尝试驱动 `Melchior/Balthazar/Casper` 三个旁路的虚拟模型进行极其简短的意见收集。
   - 拼装合并包，由主线程透传给 Trinity 代理。通过压测校验并发不锁死。
3. **数字病理实装期 (Monitor & T_tick)**:
   - 在上述体系能够平稳运行时，挂载 `seraph.go` 到拦截层，开始在 `Think` 的调用流中累加记录 $T_{tick}$，实装日常碎片化的 Piggyback Prompt QA 来维系底座健康。
