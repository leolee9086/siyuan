# MAGI 工具分类与治理规则执行跟踪 (TikTocTak)

> **目标**: 确立并实施 MAGI 工具的分类体系——调查类工具（只读、无审核调用）与行动类工具（写操作、需主导选举 + 动机参数 + 投票治理）——并在心跳、主导者直答、Avatar 等所有上下文中统一执行。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发、测试和验证。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

### 工具分类体系

```
工具
├── 🔍 调查类工具 (Investigation) — 无审核、无投票、全员随时可用
│   ├── search_notes_by_keywords
│   ├── read_note_by_id
│   ├── forge_dev_repo_list
│   ├── forge_dev_repo_read
│   ├── forge_dev_repo_search
│   └── recall_cross_session_memories
│
├── 🛠️ 行动类工具 (Action) — 需主导选举 + motivation 参数 + 治理投票
│   │   （全员工具集中可见，但治理以当选主导的身份注册）
│   ├── write_diary_entry
│   ├── forge_dev_repo_edit
│   ├── forge_dev_repo_batch_replace
│   ├── forge_dev_repo_bash
│   ├── create_note_document
│   ├── append_note_blocks
│   ├── modify_note_block
│   ├── revert_note_block
│   ├── send_channel_message
│   ├── buildAvatar / modifyAvatar / synthesizeAvatar
│   └── persist_session_memory
│
├── 🗣️ 表达/状态工具 (Speech/State)
│   ├── wanna_speak_start / wanna_speak_continue / wanna_speak_stop
│   └── deliberation_signal / vote / dominant_election
│
└── 😴 睡眠工具 (Sleep)
    ├── wanna_sleep_record (Casper)
    ├── wanna_sleep_plan (Melchior)
    └── wanna_sleep_dream (Balthazar)
```

### 核心规则

1. **调查类工具（只读）**: 任何贤者在任何上下文中均可无审核调用。不需要 motivation 参数。可跨轮次积累结果。
2. **行动类工具（写操作）**: 必须先选举主导 AI，以当选主导身份注册治理轮次，然后调用行动工具时必须提供 `motivation` 参数，经其他两位贤者投票治理（通过/拒绝/弃权），连续两次拒绝则触发主导权转移。
3. **表达状态中的工具调用**: 进入表达状态后只能调用 `wanna_speak_continue/stop` 和只读 forge 工具。不得调用其他工具。
4. **心跳唤醒轮次必须选举主导**: 心跳唤醒时先选举主导再注册治理，不得硬编码特定 sage。
5. **唤醒心跳中必须先调查才能休息**: 唤醒期间每个 sage 必须先调用至少一次调查类工具，才能调用睡眠工具。不对非当选 sage 强制要求行动工具。

### 验证检查清单

- [ ] 调查类工具列表完整、无遗漏
- [ ] 行动类工具列表与 `isGovernedActionToolName` 一致
- [ ] 心跳唤醒轮次通过 `electDominantSage` 选举主导，不硬编码
- [ ] 唤醒心跳中调查约束已实施（仅要求调查，不要求行动）
- [ ] 表达状态中只读 forge 工具正常可用
- [ ] 编译通过，测试全部通过

---

## 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 近期计划

- [ ] **Phase 2: 心跳唤醒轮次主导选举 + 调查约束 (P0)**
  - **背景**: 当前 `heartbeat.go:71` 将 Melchior 硬编码为 `RegisterRound` 的 `currentDominant`，违反规则 4。唤醒期间 sage 可不做任何调查直接调用睡眠工具。
  - **行动**:
    1. `heartbeat.go:70-72`: 在 `RegisterRound` 前调用 `electDominantSage` → `resolveDominantSage`，以当选主导替换硬编码 `melchior`
    2. `collector_state.go`: 新增 `isInvestigationTool` 和 `isActionTool` 分类函数
    3. `collector_sage.go` `collectSingleSageResponse`: 新增 `hbInvestigated` 追踪，`checkWannaSleep` 返回 `found==true` 时检查约束，不满足则注入 continuation prompt 并 `continue`
    4. `prompts/core.go` `BuildCoreSageHeartbeatWakePrompt`: 添加"必须先调查再休息"的强制指令
    5. 新增测试覆盖约束场景
  - **验收标准**:
    - 心跳唤醒通过选举确定主导，不硬编码
    - 未调查直接睡眠 → 被拒，注入提示
    - 调查后可正常睡眠
    - 同轮调查+睡眠 → 允许
    - 跨轮次积累调查 → 允许
    - 睡眠时间段心跳不受影响
    - 用户对话（非心跳）不受影响
  - **参考文档**:
    - `heartbeat.go:70-72` — 硬编码位置
    - `dominant_reply.go:31,147-150` — 选举+注册的正确模式
    - `collector_sage.go:25-198` — 约束注入点
    - `prompts/core.go:45-64` — 唤醒提示词
    - `collector_state.go` — 分类函数位置

---

## 中期计划

- [ ] **Phase 3: 治理投票错误处理与重试优化 (P1)**
  - **背景**: 当前治理连续两次拒绝后触发主导权转移，但重试提示不够清晰。
  - **行动**:
    1. 评估 `GovernedInstruction` 提示词质量
    2. 改进重试提示：明确告知 sage 需修改 motivation 或更换工具

- [ ] **Phase 4: 需要 motivation 但无需治理的工具引入 (P2)**
  - **背景**: 某些只读工具在表达状态中使用时只需说明动机但无需投票。当前统一用 `AddMotivationParam` 包裹。
  - **行动**:
    1. 定义 "requires motivation only" 层级
    2. 将只读 forge 工具的 motivation 改为非治理（移除"用于行动工具复核"描述）

- [ ] **Phase 5: 调查类工具结果跨 sage 共享 (P2)**
  - **背景**: 一个 sage 的调查结果（如 forge search）对其他 sage 不可见，导致重复调用。
  - **行动**:
    1. 在 `collectHeartbeatResponses` 或 `coordinateDominantDirectReply` 中实现调查结果共享
    2. 将调查结果注入其他 sage 的上下文

---

## 已归档/已完成

- [x] **Phase 1: 工具分类与动机参数补齐** [已完成 2026-05-01]
  - **背景**: 三个只读 forge 工具缺乏动机参数，表达状态中被错误拦截
  - **完成情况**:
    - `AddMotivationParam` 已应用于 `BuildForgeDevRepoListToolDef/ReadToolDef/SearchToolDef`
    - `collector_state.go` 的 `default` 分支放行只读 forge 工具
    - 新增 `isReadOnlyForgeTool` 函数
    - 测试已更新并全部通过
  - **成果文件**:
    - `config/config.go:470-531` — 工具定义修改
    - `coordinator/collector_state.go:86-93,235-239` — 状态机放行逻辑 + 辅助函数
    - `coordinator/collector_test.go:529-538` — 测试更新
