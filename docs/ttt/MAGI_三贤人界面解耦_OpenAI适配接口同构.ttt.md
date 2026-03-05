# MAGI 三贤人界面解耦与 OpenAI 适配接口同构执行跟踪 (TikTocTak)

> **目标**: 将三贤人界面（含 `main-message-container` 主消息区）与 MAGI 内部实现彻底解耦；UI 调用 MAGI 的方式在接口契约上与常见标准 LLM 适配器一致（OpenAI-compatible）。  
> **量化指标（最终态）**:  
> 1. `app/src/magi/components/*` 与 `app/src/magi/entry/*` 不再直接依赖 `useMagi.types`、`messageFactory.types`、`core/wise/*`。  
> 2. UI 层仅通过统一 `StandardLLMAdapter` 交互（请求体、响应体、SSE chunk 结构与常见 OpenAI-compatible 适配器一致）。  
> 3. 仅改配置即可在 `MagiOpenAIAdapter` 与 `RawOpenAIAdapter` 间切换，界面层零改动。  
> 4. 流式输出仍以 `data: ...` + `data: [DONE]` 终止，且现有三贤人卡片与主消息区行为无回归。  
>
> **流程**: 这是一个滚动更新的执行路线图。  
> 1. 从“近期计划”认领任务。  
> 2. 完成设计、开发和测试。  
> 3. 将任务移动到“已归档/已完成”。  
> 4. 从“中期计划”提级补位到“近期计划”。

---

## 核心原则

1. **接口先行**: 先冻结 OpenAI 兼容契约，再改 UI 与运行时接线，禁止边改边发明协议。  
2. **UI 不感知内核**: 三贤人界面只消费通用聊天视图模型，不感知 Trinity/投票/贤者内部状态机。  
3. **契约同构，不做“看起来像”**: 请求字段、流式 chunk、错误模型必须与常见标准 LLM 适配器形态一致（OpenAI-compatible）。  
4. **适配层吸收差异**: MAGI 特有语义（投票、人格、系统态）只允许在 Adapter 内转换，不泄漏到 `main-message-container`。  
5. **渐进替换**: 保留旧链路灰度期，但“单向迁移”到新接口，不做长期双轨维护。

**验证检查清单**:
- [ ] `rg` 验证 UI 层无对 `../composables/useMagi*`、`../core/wise/*`、`../utils/messageFactory.types` 的直接导入
- [ ] UI 发起请求仅使用 `StandardLLMAdapter`（无 MAGI 私有参数）
- [ ] `MagiOpenAIAdapter` 与 `RawOpenAIAdapter` 通过同一份契约测试
- [ ] 流式响应解析对两类适配器均输出一致增量行为
- [ ] 主消息区/三贤人卡片现有展示能力（含进度与状态）通过回归验证

---

## 📌 迁移边界与现状

### 本次边界

1. **包含**: `main-message-container`、`MagiMainPanel`、`MagiWorkspace`、`MagiRoot` 到会话发起层的调用解耦。  
2. **包含**: 新建标准 LLM 适配层（Magi/Raw 两种实现，OpenAI-compatible）。  
3. **不包含**: MAGI 内部三贤人推理策略、投票规则、人格提示词算法本身。  
4. **不包含**: 后端协议重写（前端先完成接口同构与可替换调用）。

### 现状快照（2026-03-05）

1. `MagiMainPanel` Props 仍直接依赖 `WrappedSeel` 与 `MagiMessage`（`app/src/magi/components/magi-main-panel/MagiMainPanel.types.ts`）。  
2. `MagiRoot.ctx.ts` 直接依赖 `UseMagiReturn` 并以内核消息 `meta.type === "sage-response"` 做 UI 分流。  
3. `useMagi.ts` 直接绑定 `initMagi` 与共识链路，UI 入口天然绑定 MAGI 内部模型。  
4. `requestController` 已是 OpenAI 兼容请求形式，但接口仍散落在 `magi` 与 `ai` 多条链路中，尚未形成统一 Port。

---

## 目标架构（冻结草案）

### 分层

1. **UI 层** (`components/entry`)  
   - 仅消费 `ChatMessageView[]`、`ConnectionView[]`、`ChatSessionController`。  
2. **会话编排层** (`magi/session` 或 `magi/application`)  
   - 仅依赖 `StandardLLMAdapter` Port，不依赖 `core/wise/*` 具体实现。  
3. **适配层** (`magi/adapters`)  
   - `MagiOpenAIAdapter`: 将 MAGI 内部能力映射为 OpenAI 外观。  
   - `RawOpenAIAdapter`: 直接调用裸 OpenAI 兼容端点。  
4. **内核层** (`magi/core/composables/events`)  
   - 保留现有三贤人实现，不直接暴露给 UI。

### 统一 Port（草案）

```ts
interface StandardLLMAdapter {
  createChatCompletion(request: ChatRequestParams): Promise<ChatResponseData>;
  streamChatCompletion(
    request: ChatRequestParams,
    callbacks: StandardLLMStreamCallbacks
  ): Promise<void>;
}
```

### 关键约束

1. UI 向 Port 传入的请求字段与常见 OpenAI-compatible 适配器一致（`model/messages/stream/temperature/max_tokens`）。  
2. UI 只消费标准响应（同步 `choices[].message.content`，流式 `choices[].delta.content`）。  
3. MAGI 特有元数据通过 Adapter 内部映射为 UI 可选扩展字段，不进入公共 Port 主契约。

---

## ℹ️ 如何维护此文档

1. 完成任务后必须移入“已归档/已完成”，并补齐完成日期与成果文件。  
2. 任何协议字段变更必须同步更新“统一 Port（草案）”和验证清单。  
3. 若新增临时桥接逻辑，必须在对应 Phase 标注移除条件。  
4. 若近期计划少于 2 项，从中期计划提级补位。

---

## 🟢 近期计划

- [ ] **Phase 1: 耦合面冻结与门禁脚本 (P0)**
  - **背景**: 先锁定现有耦合点，避免迁移过程中边界漂移。
  - **行动**:
    1. 输出 UI 层禁止直连依赖清单（`useMagi*`、`core/wise/*`、`messageFactory.types`）。
    2. 增加静态扫描脚本或 lint 规则，阻止新增反向耦合。
    3. 固化本次迁移对齐文件清单与责任边界。
  - **验收标准**: PR 级别可自动阻断新增耦合。
  - **参考文件**: `app/src/magi/components/magi-main-panel/MagiMainPanel.types.ts`, `app/src/magi/entry/MagiRoot.ctx.ts`

- [-] **Phase 2: 标准 LLM 适配器契约定稿 (P0)**
  - **背景**: 没有统一契约，无法保证“调用外观完全一致”。
  - **行动**:
    1. 定义 `StandardLLMAdapter`、请求/响应/SSE 回调类型。
    2. 明确错误模型（网络错误、协议错误、业务错误）与终止语义。
    3. 增加契约测试夹具（同步 + 流式）。
  - **验收标准**: 裸 OpenAI 与 MAGI 两类适配器均可跑同一套契约用例。
  - **参考文件**: `app/src/magi/service/requestController.ts`, `app/src/magi/service/streamResponseHandler.ts`
  - **执行进展 (2026-03-05)**:
    1. 已新增 `StandardLLMAdapter` 契约类型文件：`app/src/magi/types/llmAdapter.types.ts`。
    2. 已新增双适配器首版实现：`app/src/magi/adapters/magiStandardLLMAdapter.ts`、`app/src/magi/adapters/rawOpenAIStandardLLMAdapter.ts`。
    3. 已新增契约测试夹具：`app/src/magi/adapters/standardLLMAdapter.contract.test.ts`（覆盖 magi/raw-openai 同步与流式行为）。
    4. 待完成：错误模型统一（网络错误/协议错误/业务错误分层约定）。

- [-] **Phase 3: 实现双适配器并打通切换 (P0)**
  - **背景**: 需要用实现证明“同构接口”可替换。
  - **行动**:
    1. 新增 `MagiOpenAIAdapter`：把 MAGI 运行时映射到统一 Port。
    2. 新增 `RawOpenAIAdapter`：直接调用裸 OpenAI 兼容端点。
    3. 提供工厂或注入点，根据配置选择适配器实现。
  - **验收标准**: 同一 UI 会话逻辑可无分支切换两类适配器。
  - **参考文件**: `app/src/magi/composables/useMagi.ts`, `app/src/magi/composables/useMagi.consensus.ts`
  - **执行进展 (2026-03-05)**:
    1. `useMagi.sendUserMessage` 已切换为通过 `StandardLLMAdapter` 调用（首版）。
    2. 已新增适配器工厂：`app/src/magi/adapters/standardLLMAdapterFactory.ts`，并支持 `magi`/`raw-openai` 模式。
    3. `useMagi` 已新增 `llmAdapterMode` 选项并接入工厂。
    4. `MagiRoot` 启动时已支持运行时模式解析：URL `?llmAdapter=raw-openai` 或 `window.siyuan.magi.llmAdapterMode`。
    5. 待完成：界面内显式切换开关与状态展示（可观测当前适配器模式）。

- [-] **Phase 4: 主界面改造为适配器消费模型 (P0)**
  - **背景**: `main-message-container` 当前仍吃 MAGI 内部类型，未彻底解耦。
  - **行动**:
    1. `MagiMainPanel` 改为只接收通用 `ChatMessageView[]` 与 `SessionStateView`。
    2. `MagiRoot/MagiWorkspace` 从 `UseMagiReturn` 迁移为 `ChatSessionController`。
    3. 移除 UI 对 `meta.type === "sage-response"` 等内核判定的直接依赖。
  - **验收标准**: UI 组件不再引用 MAGI 内核类型，`main-message-container` 渲染行为保持一致。
  - **参考文件**: `app/src/magi/components/magi-main-panel/MagiMainPanel.vue`, `app/src/magi/entry/MagiWorkspace.vue`
  - **执行进展 (2026-03-05)**:
    1. 已新增界面独立视图类型：`app/src/magi/entry/magiView.types.ts`。
    2. `MagiMainPanel` 类型/上下文/守卫已切换到 View 类型，不再直接依赖 `useMagi.types`。
    3. `MagiRoot` 与 `MagiWorkspace` 已新增 `mainPanelSeels` 映射并完成接线。
    4. `SeelPanel`/`MessageBubble`/`SseStreamContent` 已切换到通用 UI MessageView/SeelView 类型。
    5. 待完成：`MagiRoot` 对 `WrappedSeel` 暴露面的进一步收敛（保留给导出与内部控制，UI 不直接消费）。

- [ ] **Phase 5: 回归与兼容验证 (P1)**
  - **背景**: 解耦后最易回归在流式、状态机与消息分流。
  - **行动**:
    1. 增加“同输入、双适配器、同渲染结果”快照测试。
    2. 覆盖中断/重连/错误恢复链路。
    3. 覆盖三贤人显示开关与主消息区过滤行为。
  - **验收标准**: 双适配器回放结果一致，已有关键交互无功能回退。

---

## 🟡 中期计划

- [ ] **Phase 6: 统一 AI 与 MAGI 请求控制底座 (P1)**
  - **背景**: 当前 `ai` 与 `magi` 有可复用但分散的请求控制实现。
  - **行动**: 抽取共享请求控制内核，保留领域扩展层。
  - **验收标准**: 重复逻辑下降，协议行为保持一致。

- [ ] **Phase 7: 事件协议与 UI 视图模型彻底分层 (P1)**
  - **背景**: 事件总线与 UI 投影仍残留领域细节。
  - **行动**: 固化事件契约版本，建立从领域事件到通用视图模型的单向映射。
  - **验收标准**: UI 对领域事件零直读，仅消费投影结果。

---

## 🔴 远期计划

- [ ] **Phase 8: 多后端并行适配 (P2)**
  - **愿景**: 在保持 UI 不变前提下，支持更多 OpenAI 兼容后端与本地推理引擎。

- [ ] **Phase 9: 会话层独立包化 (P2)**
  - **愿景**: 将 `StandardLLMAdapter + ChatSessionController` 抽为独立可复用模块，供 MAGI 与通用 AI 面板共用。

---

## ⚠️ 风险与缓解

- 风险：迁移期双链路共存导致状态抖动。  
  - 缓解：界面层只认新 `ChatSessionController`，旧链路仅保留在 Adapter 内部桥接。  
- 风险：为了“同构”过度压平 MAGI 特性。  
  - 缓解：主契约保持 OpenAI 外观，特性通过扩展字段或旁路事件承载。  
- 风险：流式协议细节不一致导致渲染差异。  
  - 缓解：以契约测试固定 chunk 与 `[DONE]` 行为，再实施 UI 替换。  
- 风险：重构范围大影响迭代节奏。  
  - 缓解：按“Port -> Adapter -> UI”三段分批落地，每段独立可回归。

---

## 🏁 已归档/已完成

- [x] **立项：三贤人界面解耦与 OpenAI 适配接口同构 TTT 建立** [已完成 2026-03-05]
  - **背景**: 当前 `main-message-container` 与 `MagiRoot` 仍直接绑定 MAGI 内核类型与消息语义，无法实现调用外观同构。
  - **完成情况**: 完成迁移边界、目标架构、阶段拆解、验收标准与风险矩阵定义。
  - **成果文件**: `docs/ttt/MAGI_三贤人界面解耦_OpenAI适配接口同构.ttt.md`
