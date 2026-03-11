# MAGI 流式响应处理器职责解耦与分层重构执行跟踪 (TikTocTak)

> **目标**: 解决 `llm.ProcessStreamResponse` 与 `stream.Processor` 职责重叠导致的行为不一致与维护成本问题，在不破坏现有业务的前提下完成流式处理能力统一。  
> **量化指标**:  
> 1. 流式核心处理实现从 2 套收敛为 1 套（重复实现归零）。  
> 2. 完成 5 处调用方迁移（`dummysys` 1 处 + `magi/seraph` 4 处）。  
> 3. `tool_calls` 合并、`finish_reason`、`ToolArgumentsByName` 行为一致性用例覆盖率达到 100%（以新增回归用例集合计）。  
> 4. `go test` 在 `kernel/nerv/magi/...`、`kernel/nerv/seraph/...`、`kernel/nerv/dummysys/...`、`kernel/util/...` 通过。  
>
> **流程**: 这是一个滚动更新的执行路线图。  
> 1. 从"近期计划"中认领一个任务。  
> 2. 完成开发和测试。  
> 3. 将其移动到"已归档/已完成"区域。  
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 核心原则

- **通用能力下沉**: 流式 chunk 解析、内容累积、tool_calls 合并属于通用能力，必须下沉到 `kernel/util/stream`，不得绑死在 `magi` 目录。
- **业务逻辑注入**: `speak` 与 `deliberation_signal` 解析保留在 MAGI 层，通过 handler 注入到通用处理器，避免反向污染 util 层。
- **兼容优先迁移**: 迁移阶段保留旧入口（兼容包装/弃用标记），先保证调用方稳定，再执行删除旧实现。
- **行为可验证**: 每个阶段必须有可执行验收用例，不以“代码看起来对”作为完成标准。

**验证检查清单**（每个 Phase 完成后必须检查）:
- [ ] `go build ./kernel/...` 无编译错误。
- [ ] `tool_calls` 增量合并在跨 chunk、乱序 index 场景下结果稳定。
- [ ] `finish_reason` 与最终 `StreamResult` 字段行为一致且有测试覆盖。
- [ ] Trinity 的 `speak` channel 解析与 `deliberation_signal` 判定行为与迁移前一致。
- [ ] dummysys 简单流式路径仍可直接获取完整结果。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：行为一致性以测试和回归结果为准，不凭主观判断。

---

## 🟢 近期计划

- [ ] **Phase 1: 建立通用流式处理核心 (`kernel/util/stream`) (P0)**
  - **背景**: 先把重复的基础能力收敛到单一实现，消除双轨维护的根源。
  - **行动**:
    1. 新建 `kernel/util/stream`，实现通用 `Processor`（内容累积、tool_calls 合并、结果生成）。
    2. 定义可注入 handler 接口，支持 `OnContent` / `OnToolCall` / `OnComplete`。
    3. 补齐单元测试：文本累积、tool_calls 增量拼装、`finish_reason` 处理、`ToolArgumentsByName` 生成。
  - **验收标准**:
    - `kernel/util/stream` 包测试通过。
    - 通用处理器可在不依赖 `magi` 的情况下独立编译和运行。
    - 与调研样例对应的基础行为回归用例通过。
  - **参考文档**: `docs/调研/流式响应处理器职责重叠分析.md`

- [ ] **Phase 2: 提取 MAGI 业务处理器 (`kernel/nerv/magi/stream/handlers`) (P1)**
  - **背景**: 业务逻辑与通用逻辑解耦，避免 util 层侵入 MAGI 语义。
  - **行动**:
    1. 将 `speak` channel 解析迁移为 `SpeakToolHandler`。
    2. 将 `deliberation_signal` 解析迁移为 `DeliberationHandler`。
    3. 增加 handler 级单元测试，验证公开/内部 channel 分离和 deliberation 标记提取。
  - **验收标准**:
    - MAGI 业务解析能力不再依赖旧 `magi/stream/processor.go` 内部状态实现。
    - handler 测试覆盖 `speak` 与 `deliberation_signal` 的正常与异常输入。
  - **参考文档**: `kernel/nerv/magi/coordinator/trinity.go`、`kernel/nerv/magi/coordinator/avatar_runtime.go`

- [ ] **Phase 3: 迁移调用方并提供兼容层 (P1)**
  - **背景**: 调用方分布在 dummysys、seraph、magi 多个入口，迁移需要一次性收口避免长期分叉。
  - **行动**:
    1. 迁移 `kernel/nerv/dummysys/runtime.go` 到通用处理器路径。
    2. 迁移 `kernel/nerv/seraph/atf_answerer.go` 到通用处理器或轻量封装。
    3. 迁移 `kernel/nerv/magi/coordinator/{collector.go,trinity.go,avatar_runtime.go}` 到“通用处理器 + handler”模式。
    4. 将 `llm.ProcessStreamResponse` 改为对新实现的兼容包装并标记 deprecated。
  - **验收标准**:
    - 5 处调用点全部切换到统一实现链路。
    - 旧 API 仍可调用，且行为与迁移前一致。
    - 相关包编译和核心测试通过。
  - **参考文档**: `docs/调研/流式响应处理器职责重叠分析.md`

- [ ] **Phase 4: 行为一致性回归与旧实现下线 (P1)**
  - **背景**: 迁移完成后必须消除历史实现，避免未来再次分叉。
  - **行动**:
    1. 建立迁移前后对照用例（重点覆盖 tool_calls 合并、finish_reason、工具参数提取）。
    2. 在确认兼容后删除旧 `kernel/nerv/magi/stream/processor.go`（若仍有依赖，先清理依赖再删）。
    3. 更新相关开发文档，明确新的分层边界和扩展方式。
  - **验收标准**:
    - 回归测试全部通过，无行为差异回归。
    - 代码库中不再存在旧处理器的有效引用。
    - 文档可指导新模块按 handler 方式扩展流式解析。
  - **参考文档**: `docs/调研/流式响应处理器职责重叠分析.md`

---

## 🟡 中期计划

- [ ] **Phase 5: 流式处理可观测性补齐 (P1)**
  - **背景**: 统一实现后需要可观测数据支撑稳定性优化。
  - **行动**: 增加 chunk 处理耗时、tool_calls 合并次数、异常退出原因等指标上报。

- [ ] **Phase 6: 取消与背压语义统一 (P1)**
  - **背景**: 不同调用方对 context cancel、channel 关闭的处理仍可能不一致。
  - **行动**: 统一取消语义、错误分类和 channel 关闭策略，减少边界条件故障。

- [ ] **Phase 7: 通用处理器对外复用评估 (P2)**
  - **背景**: 新增模块（非 MAGI）可能需要复用流式能力。
  - **行动**: 评估在其他 kernel 子模块复用 `kernel/util/stream` 的可行性并形成接入指南。

---

## 🔴 远期计划

- [ ] **Phase 8: 多协议流式适配层 (P2)**
  - **愿景**: 在统一处理核心上扩展不同上游协议（OpenAI/Claude 兼容）到统一 chunk 模型，降低适配成本。

---

## 🏁 已归档/已完成

*(暂无)*
