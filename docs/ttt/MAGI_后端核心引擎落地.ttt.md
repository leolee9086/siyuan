# MAGI 后端核心引擎落地计划 (TTT)

> **目标**: 将抽象的 `MAGI` 认知架构与 `Seraph` 监控体系落地到 S-forge (Siyuan 笔记内核) 的 `kernel` Go 代码库中，透明替换旧有的基础 AI 模块，实现高内聚、低耦合的并发安全认知中枢。

## 1. 任务背景与核心原则

本项目旨在将 `docs/设计/MAGI_Go后端落实工程设计.design.md` 和 `docs/设计/ATF数学模型.design.md` 中的设计蓝图转化为实际的 Go 代码。

**核心原则**:
1. **分级调度 (Hierarchical Orchestration)**: 新 `MAGI` 引擎与现有的简单 AI 接口**并非替代关系**。原有的基础 AI 请求接口将作为**执行层 (Execution AI)** 保留。`MAGI` （包含 Trinity 与三贤人）作为**认知中枢 (Cognitive Hub)**，除了向业务层暴露等效的 `Think` 或 `Chat` 接口外，其内部在做出决策后，依然会**调用基础 AI 接口去执行具体的生成任务**。
2. **严守架构**: 弃用旧版 JS 的“选拔打分制”。确立 Trinity 为唯一的执行中枢，三贤人（Melchior, Balthazar, Casper）仅作为并行的后台侧写器官。
3. **彻底并发安全**: 三贤人的并行评述必须受控且不阻塞，依赖 `context.WithTimeout` 和短路机制控制节奏。
4. **四盲伴随测试**: 严格落实基于 EMA 的“四盲测试 (Four-Blind Test)”以维系系统健康度，使用靶向比例抽题策略累积 $5 \times 6$ 矩阵面。

## 2. 目录结构设计 (Package Layout)

在 `kernel/agent`（如果不存在则新建）目录下，建立完整的 MAGI 模块群：

```text
kernel/agent/
├── engine.go          # 定义 MAGIEngine 接口，提供外部统一的入口 (Think, FastResolve)
├── magi/              # MAGI 主逻辑控制区
│   ├── trinity.go         # 执行中枢与综合判断机制，持有时钟 T_tick
│   ├── wise_man.go        # 定义贤人微型侧写逻辑 (Melchior, Balthazar, Casper)
│   └── introspection.go   # 将三贤人侧写转换为 Trinity 的“第一人称内心独白”
├── monitor/           # ATF 数学模型与心智遥测
│   ├── atf_math.go        # 同步率 ρ、ATF强度 F (包含静态和动态趋势) 等数学公式实现
│   ├── observer.go        # 负责闲时“四盲测试”抽题并发与矩阵 EMA 更新
│   ├── disease_detect.go  # 基于 T_tick 的心智劣化诊断（急性解离、长期塌陷、强迫死锁）
│   └── seraph.go          # 被动监控探针（Middleware拦截层），提供 Telemetry 指标并在极危时告警
└── adapter/           # 基础设施与外部环境交互
    ├── llm_client.go      # 对底层大模型的封层，带 Rate Limit 控制。作为**基础执行层**被 MAGI 引擎调用。
    └── native_memory.go   # 挂载/读取 Siyuan 本地笔记的接口包装
```

*(原 `kernel/model/ai.go` 中的简单问答逻辑可平滑迁移至 `llm_client.go`，或者直接作为执行节点被 `agent/engine.go` 引用)*

## 3. 落地实施路线图 (Execution Strategy)

请按以下三期路线逐步实装，保证系统始终处于可编译、可测试状态：

### Phase 1: 代理透传与脚手架搭建 (Proxy Phase)

**目标**: 建立目录结构和接口契约，但不启用复杂的心理学机制，保证老系统平滑过渡。

- **任务 1.1**: 在 `kernel/agent/engine.go` 中定义 `MAGIEngine` 接口 (`Think`, `FastResolve`)。
- **任务 1.2**: 在 `adapter/llm_client.go` 中封装基础的 LLM 请求客户端（复用或搬运 `model/ai.go` 里的基础请求逻辑）。
- **任务 1.3**: 提供一组 Default 实现（Dummy 级别），让 `kernel/model/ai.go` 获取其实例并将所有原有 AI 请求直接透明转发过去。
- **验证**: 编译内核，确保原有的“AI对话”、“摘要”等功能工作完全正常，接口无缝对齐。

### Phase 2: 意识流分化 (Trinity Brain Split)

**目标**: 跑通基于 Context 的并发三贤人侧写及 Trinity 内心独白整合闭环。

- **任务 2.1**: 实现 `magi/wise_man.go`，建立虚拟的三贤人协程（挂载不同的基础 Prompt）。限定它们的返回长度。
- **任务 2.2**: 在 `engine.go` 和 `trinity.go` 的 `Think` 流程中，引入并发：收到 User 意图后，立即通过 `goroutine` 广播给三贤人计算节点。
- **任务 2.3**: 实现**截停与短路机制 (Short-Circuit Reflex)**。配置合理的 `context.WithTimeout`（例如 800ms）。不管有几个贤人按时返回，都收集现有侧写，进入下一环节。
- **任务 2.4**: 实现 `introspection.go`，将收集到的微型侧写组装成第一人称的“内心独白”，并喂给真正的 Trinity（主模型流程）去做出最终动作并返回给用户。
- **验证**: 发送测试请求，通过日志确认是否触发了多个后台 LLM 请求，并且组合后的 Prompt 成功流入了最终的生成动作中；测试超时截断是否会引起 Goroutine 泄露（重要！）。

### Phase 3: 遥测、四盲测试与病理诊断 (Monitor & Telemetry)

**目标**: 实装基于底层结构的定量自我监督与系统状态漂移检测。

- **任务 3.1**: 实现实体数据结构。按照 `MAGI_人格种子生成机制.design.md`，定义 $5 \times 6$ 的 $\mathbf{P}$ 矩阵与种子 JSON 的映射。
- **任务 3.2**: 实装 `monitor/atf_math.go`，包含 Frobenius 内积、同步率转换 $\rho$、速度 $v_{rec}$ 计算及 ATF 综合强度 $F$ 的推演算法。
- **任务 3.3**: 实装**四盲测试引擎 (observer.go)**。
  - 在系统的闲置循环或批量任务末尾，触发题目抽取。
  - 核心逻辑：**靶向比例抽题 (Targeted Ratio Sampling)**。为 Trinity 提供全随机抽题；为三贤人提供 80% 领域内 + 20% 跨界题目的试卷。
  - 并发投递给被**完全隔离**的四大实体。获取答案，按 $\lambda$ 衰减值更新对应 EMA 面。
- **任务 3.4**: 实装 `seraph.go` 拦截层。在每次 `Think` 启动前更新指标，将轻微震荡作为 Telemetry 注入系统。
- **任务 3.5**: 实装 `disease_detect.go`，完成对急性解离、长期塌陷等病症的数值诊断界定。在检测到阈值击穿时截断流程，抛出“紧急越权申请” Error。
- **验证**: 编写纯数学相关的单元测试来测试 ATF 公式的收敛性；使用 Mock 的 LLM 客户端模拟四盲测试流程，观察四方矩阵在 100 个模拟周期 ($T_{tick}$) 下的演进漂移是否符合预期。

## 4. 特殊注意事项

- **Token 节流**: 三贤人的内部侧写必须极致简短。系统要硬性插入 `max_token` 限制。
- **时钟体系**: 不要用自然世界的绝对时间来管理衰减和诊断，必须统一引入“经验周期”即 $T_{tick}$ 的概念。
- **防锚定**: 在 Phase 3 中，必须严密检查代码执行路径，**绝对禁止** Trinity 在伴随性自我评估阶段获取当前三贤人的输出。
