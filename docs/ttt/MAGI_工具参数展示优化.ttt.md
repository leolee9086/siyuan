# MAGI 工具参数展示优化执行跟踪 (TikTocTak)

> **目标**: 实现工具调用参数的实时增量展示，让用户在流式过程中即可看到工具参数的逐步构建，达到100%参数可见性和实时更新体验。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

1. **增量推送**: 参数在拼接变化时持续发事件，而不是只在JSON完整后发一次
2. **稳定标识**: 使用稳定的key（roundId + seel + toolCallId/index）做upsert，同一工具调用更新同一条卡片
3. **参数可见**: 卡片必须明确展示调用参数（可折叠JSON），不能只显示"调用工具: xxx"
4. **向后兼容**: 保持现有`arguments`字段兼容性，新增可选的增量字段
5. **实时体验**: 用户在流式过程中即可看到参数逐步构建

### 当前问题

1. **后端**: `emittedTools`只发一次，参数能完整反序列化后才发事件，不会随参数分片持续更新
2. **前端投影**: `tool-call`消息ID用`eventId`，每次事件会变成新卡片，而不是更新同一条
3. **UI显示**: 消息卡片没有真正渲染参数，只显示工具名称

### 验证检查清单

- [ ] 工具参数在流式过程中持续更新（不是只在完整后发一次）
- [ ] 同一工具调用的多次事件更新同一条卡片
- [ ] 卡片明确展示参数内容（JSON格式，可折叠）
- [ ] 参数未完整时显示rawArguments，完整后显示解析后的arguments
- [ ] 旧版前端收到新事件不崩溃（向后兼容）
- [ ] 编译通过，无语法错误

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---
## 🟢 近期计划

（所有P0任务已完成，等待测试验证）

---

## 🟡 中期计划

- [ ] **Phase 7: 前端测试补充 (P1)**
  - **背景**: 需要验证同一toolCall连续两次事件只更新一条卡片
  - **行动**:
    1. 修改 `magiEventBridge.test.ts:235` 增加测试用例
    2. 测试场景：同一toolCall连续两次事件 -> 只更新一条卡片且参数变更可见
    3. 验证稳定key机制正确工作
  - **验收标准**:
    - 测试覆盖增量更新场景
    - 测试通过
  - **参考文档**:
    - `app/test/util/events/magiEventBridge.test.ts:235`

- [ ] **Phase 8: 后端测试补充 (P1)**
  - **背景**: 需要验证参数分片增量推送机制
  - **行动**:
    1. 在coordinator测试中补充"参数分片增量推送"用例
    2. 围绕`streamedToolCallCollector.Merge`测试
    3. 验证回调在参数变化时正确触发
  - **验收标准**:
    - 测试覆盖增量推送场景
    - 测试通过

- [ ] **Phase 9: 性能优化 (P2)**
  - **背景**: 增量推送可能增加事件频率，需要评估性能影响
  - **行动**:
    1. 测量增量推送的事件频率
    2. 评估前端渲染性能（大量参数更新）
    3. 必要时添加节流机制（如100ms内最多更新一次）
  - **验收标准**:
    - 事件频率在可接受范围（<100次/秒）
    - 前端渲染流畅，无卡顿

- [ ] **Phase 10: 工具调用事件显示工具名 (P1)**
  - **背景**: 工具调用相关事件需要在界面上明确显示工具名称，提升可读性
  - **行动**:
    1. 分析当前工具调用事件的显示逻辑
    2. 在事件卡片中添加工具名称显示
    3. 确保工具名称在各种事件类型中一致显示
  - **验收标准**:
    - 工具调用事件明确显示工具名称
    - 样式与现有设计一致
    - 不影响其他事件类型的显示

- [ ] **Phase 11: 消息虚拟滚动支持 (P1)**
  - **背景**: 大量消息时需要虚拟滚动提升性能，避免DOM节点过多导致卡顿
  - **行动**:
    1. 调研项目中现有的瀑布流实现（搜索关键词：virtual scroll, waterfall, infinite scroll）
    2. 分析SeelPanel消息列表的渲染逻辑
    3. 集成虚拟滚动方案，支持无限消息列表
    4. 确保滚动位置正确维护（新消息自动滚动到底部）
  - **验收标准**:
    - 支持1000+消息的流畅滚动
    - DOM节点数量控制在合理范围（<100个可见节点）
    - 新消息到达时自动滚动到底部
    - 用户手动滚动时不受干扰
  - **参考文档**:
    - 项目中现有瀑布流实现（待调研）

---

## 🔴 远期计划

- [ ] **Phase 10: 参数高亮与格式化 (P2)**
  - **愿景**: 提升参数展示的可读性
  - **行动**:
    1. JSON语法高亮
    2. 大型参数自动折叠
    3. 支持复制参数内容

- [ ] **Phase 11: 参数历史记录 (P2)**
  - **愿景**: 记录参数的变化历史，方便调试
  - **行动**:
    1. 记录每次参数更新的快照
    2. 提供时间轴查看参数演变
    3. 支持对比不同版本的参数

- [ ] **Phase 12: 技术文档 (P2)**
  - **愿景**: 完善技术文档
  - **行动**:
    1. 编写工具参数增量推送机制文档
    2. 更新MAGI开发指南：工具调用最佳实践
    3. 添加故障排查指南：参数显示异常等

---

## 🏁 已归档/已完成

- [x] **Phase 1-3: 后端增量推送机制实现 (P0)** - 2026-03-17
  - **背景**: 后端需要支持工具参数的增量推送，而不是只在完整后发一次
  - **完成情况**:
    - ✅ 修改回调签名支持增量字段（toolCallIndex/toolCallId/rawArguments/isComplete）
    - ✅ 在参数拼接变化时重复发事件
    - ✅ collector集成增量推送回调
    - ✅ websocket事件类型扩展支持增量字段
    - ✅ 后端编译通过
  - **成果文件**:
    - `kernel/nerv/magi/coordinator/toolcall_context.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `kernel/nerv/magi/websocket/events.go`

- [x] **Phase 4-6: 前端增量展示实现 (P0)** - 2026-03-17
  - **背景**: 前端需要接受增量参数事件并实时展示
  - **完成情况**:
    - ✅ 前端事件类型扩展支持增量字段
    - ✅ Zod schema校验支持增量参数
    - ✅ guard校验允许arguments未完整但rawArguments有值
    - ✅ 投影使用稳定key（roundId + seel + toolCallId/index）
    - ✅ 同一工具调用的多次事件更新同一条卡片
    - ✅ UI卡片明确展示参数内容（可折叠JSON）
    - ✅ 参数未完整时显示rawArguments，完整后显示arguments
    - ✅ 添加工具参数块样式
  - **成果文件**:
    - `app/src/magi/events/magiEventBus.types.ts`
    - `app/src/magi/events/magiEventBus.ts`
    - `app/src/magi/events/dispatchMagiWebSocketMessage.guard.ts`
    - `app/src/magi/events/magiProjector.ts`
    - `app/src/magi/components/seel-panel/SeelPanel.vue`
    - `app/src/magi/components/seel-panel/SeelPanel.css`

---

## 📚 参考文档

- `kernel/nerv/magi/coordinator/toolcall_context.go` - 工具调用上下文
- `kernel/nerv/magi/coordinator/collector.go` - 响应收集器
- `kernel/nerv/magi/websocket/events.go` - WebSocket事件推送
- `app/src/magi/events/magiEventBus.types.ts` - 前端事件类型定义
- `app/src/magi/events/magiEventBus.ts` - 前端事件总线
- `app/src/magi/events/dispatchMagiWebSocketMessage.guard.ts` - 前端事件校验
- `app/src/magi/events/magiProjector.ts` - 前端事件投影
- `app/src/magi/components/seel-panel/SeelPanel.vue` - Seel面板组件
- `app/src/magi/components/seel-panel/SeelPanel.css` - Seel面板样式
- `app/test/util/events/magiEventBridge.test.ts` - 前端事件桥接测试
- `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md` - TTT文档规程
