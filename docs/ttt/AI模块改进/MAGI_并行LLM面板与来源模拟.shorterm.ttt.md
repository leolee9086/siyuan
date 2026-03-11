# MAGI 并行LLM面板与来源模拟短期攻坚 (TikTocTak)

> **归属**: [MAGI_NERV_Avatar池化_内外工具隔离.ttt.md](./MAGI_NERV_Avatar池化_内外工具隔离.ttt.md)
> **目标**: 在 MAGI 前端增加可并行的多 LLM 聊天面板，并支持每个面板独立切换可信/不可信来源模拟，作为 Trust Rule Layer 与 Trinity 分发策略的前端验证入口。
> **完成口径**:
> 1. 支持创建/删除多个来源模拟面板，面板可同时发起请求。
> 2. 每个面板可独立切换来源画像（可信/不可信等）。
> 3. 面板消息与请求来源画像可追踪（至少在消息 meta 或调试输出中可见）。
> 4. 不破坏现有 OpenAI-compatible 适配器外观。

---

## 近期计划

- [x] **Step 1: 子TTT立项与边界冻结 (P0)** [已完成 2026-03-05]
  - **行动**:
    1. 固化面板作用与验收口径。
    2. 定义最小来源画像集合。
    3. 定义并发发送与失败回显行为。
  - **验收标准**:
    - 文档与父 TTT 建立双向关系。
    - 范围不包含后端协议扩展。

- [x] **Step 2: 前端并行面板UI落地 (P0)** [已完成 2026-03-05]
  - **行动**:
    1. 增加来源模拟面板容器与面板卡片组件。
    2. 支持动态创建/删除面板。
    3. 每个面板维护独立输入与本地会话展示。
  - **验收标准**:
    - 页面可创建 3+ 面板并并行操作。

- [x] **Step 3: 来源画像接线与发送链路 (P0)** [已完成 2026-03-05]
  - **行动**:
    1. 为每个面板接入来源画像选择器。
    2. 将来源画像映射为内部请求上下文并随调用传递。
    3. 回填每个面板本地回复与错误。
  - **验收标准**:
    - 可信/不可信来源切换后可见行为差异（至少在 meta 侧可观测）。

- [ ] **Step 4: 回归与文档回写 (P1)**
  - **行动**:
    1. 回归主面板输入链路与三贤者显示。
    2. 补充父 TTT 完成记录与风险结论。
  - **验收标准**:
    - 主链路无回归，子 TTT 结论可回写父文档。

---

## 风险

1. 多面板并发可能导致共享会话消息交叉污染，需要请求级关联标识。
2. 若来源画像仅停留 UI，不进入请求上下文，将失去策略验证价值。
3. 若改动过深触及适配器契约，可能破坏 OpenAI-compatible 外观。

---

## 已归档/已完成

- [x] **子TTT创建与边界冻结** [已完成 2026-03-05]
  - **完成情况**: 建立短期攻坚文档并冻结“多面板 + 来源模拟 + 契约兼容”目标边界。
  - **成果文件**:
    - `docs/ttt/MAGI_并行LLM面板与来源模拟.shorterm.ttt.md`

- [x] **并行面板 UI 与来源模拟接线** [已完成 2026-03-05]
  - **完成情况**: 支持多面板创建/删除、独立来源画像切换、独立输入与本地会话展示，并将来源模拟信封注入标准 LLM 调用链路。
  - **成果文件**:
    - `app/src/magi/components/source-sim-panels/SourceSimulationPanels.vue`
    - `app/src/magi/components/source-sim-panels/SourceSimulationPanels.css`
    - `app/src/magi/entry/MagiRoot.ctx.ts`
    - `app/src/magi/entry/MagiRoot.types.ts`
    - `app/src/magi/entry/MagiWorkspace.vue`
    - `app/src/magi/composables/useMagi.ts`
    - `app/src/magi/composables/useMagi.types.ts`
    - `app/src/magi/composables/useMagi.consensus.ts`
    - `app/src/magi/adapters/magiStandardLLMAdapter.ts`

- [x] **来源上下文实传 + Trinity speak channel 分流** [已完成 2026-03-05]
  - **完成情况**:
    1. 来源模拟增加 `sourceChannel/sourcePanelId/sourcePanelTitle`，并以 `callerId + panelId` 形成同画像不同面板的可区分来源。
    2. Trinity 综合输入显式注入来源情报（来源/调用者/可信度/风险/面板标识），不再仅停留消息 meta。
    3. Trinity `speak` 工具新增 `channel`（`public/internal`）语义；`internal` 报告仅写入内部消息，不进入外部 LLM 可见输出。
  - **成果文件**:
    - `app/src/magi/entry/MagiRoot.ctx.ts`
    - `app/src/magi/composables/useMagi.types.ts`
    - `app/src/magi/composables/useMagi.consensus.ts`
    - `app/src/magi/composables/magiConsensus.ts`
    - `app/src/magi/composables/magiConsensus.deliberation.ts`
    - `app/src/magi/composables/consensus/magiConsensus.content.ts`
    - `app/src/magi/core/wise/trinity.toolset.ts`
    - `app/src/magi/utils/streamProcessor.ts`
    - `app/src/magi/adapters/magiStandardLLMAdapter.ts`
