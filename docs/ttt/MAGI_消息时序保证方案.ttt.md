# MAGI 消息时序保证执行跟踪 (TikTocTak)

> **目标**: 解决工具调用事件和回复完成事件在WebSocket传输中的乱序问题，保证前端按正确顺序显示消息，达到100%时序正确率。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

1. **会话级seq**: seq必须按会话隔离，避免全局seq导致的单会话缺口
2. **原子性保证**: seq生成与事件构建必须原子化，避免eventId与seq错配
3. **源头顺序**: 修复工具事件源头的map遍历无序问题
4. **UI逻辑顺序**: 修复消息插入位置，保证视觉顺序正确
5. **100%不丢失**: 队列满时阻塞等待，不丢弃事件

### 关键发现

**所有事件都有后端timestamp**: 每个事件在生成时都调用`time.Now().UnixMilli()`获取时间戳

### 技术方案（两种选择）

#### 方案A：基于timestamp排序（推荐）
- **优势**: 无需修改seq生成逻辑，利用现有timestamp字段
- **实现**: 前端按timestamp排序，相同timestamp时按seq排序
- **风险**: 并发事件可能有相同timestamp（毫秒精度），需要seq辅助

#### 方案B：会话级seq（彻底方案）
- **优势**: seq语义清晰，严格递增，无缺口
- **实现**: 为每个sessionId维护独立的seq计数器
- **成本**: 需要重构seq生成逻辑，增加会话管理复杂度

### 最终方案（混合）

**第一层（源头）**: 修复工具事件遍历顺序，使用有序列表替代map遍历
**第二层（传输）**: 使用Go channel作为会话级消息队列，保证推送顺序
**第三层（前端）**: 按timestamp主排序 + seq辅助排序，处理网络传输乱序

### 非阻塞策略

**后端消息队列**:
- 队列满时**阻塞等待**（不是非阻塞丢弃）
- 超时时间5秒，超时后返回错误
- 保证100%不丢失事件，满足"100%时序正确率"目标

**前端Ring缓冲区**:
- 缓冲区满时淘汰最旧的事件（FIFO）
- 记录警告日志但不阻塞新事件接收

### 缺口恢复策略

**前端Ring缓冲区**:
- 等待连续seq事件（如seq=100,101,102可提取）
- 缺口超时时间：2秒
- 超时后强制跳过缺失的seq，继续处理后续事件
- 记录警告日志：`[MAGI] seq缺口超时，跳过seq=${missingSeq}`
- 不重试、不重连，避免阻塞后续事件

### 依赖决策

**后端**: 不引入外部依赖
- Go标准库的channel天然支持消息队列语义
- sync/atomic包提供原子操作

**前端**: 不引入外部依赖
- Ring Buffer实现简单（约50-100行代码）
- 完全可控，易于针对MAGI场景优化

### 验证检查清单

- [ ] 工具调用事件在回复完成事件之前显示
- [ ] 多个工具调用事件按seq顺序显示
- [ ] 后端推送不阻塞
- [ ] 前端Ring缓冲区内存固定（如4096个事件）
- [ ] seq序列号单调递增
- [ ] 旧版前端收到新事件不崩溃

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

- [ ] **Phase 5: 修复工具调用事件发射延迟问题 (P0 - 紧急)**
  - **背景**: 工具调用事件在流式完成后才发射，导致前端按 timestamp 排序后工具调用显示在所有 content 之后
  - **问题现象**: speak_continue 的内容都显示完成了才开始显示工具调用
  - **根本原因**: 工具调用在流式过程中逐步检测，但事件发射延迟到 turn 完成后（271行），违反"逻辑发生=事件发射"原则
  - **实施方案**:
    1. 修改 `streamedToolCallCollector` 添加回调机制：`SetCallback(ToolCallEventCallback)`
    2. 在 `Merge` 方法中检测到工具调用完整（name + arguments）时立即触发回调
    3. 在 `collector.go:167` 创建 turnCollector 时设置回调，立即发射 TOOL_CALL_DETECTED 事件
    4. 移除 turn 完成后的延迟事件发射代码（原271-286行）
    5. 记录首次检测时间戳，确保事件 timestamp 准确
  - **验收标准**:
    - ✅ 工具调用事件在检测到完整参数时立即发射（流式过程中）
    - ✅ 事件 timestamp 是首次检测到的时间
    - ✅ 前端按 timestamp 排序后，工具调用显示在对应的 content chunk 附近
    - ✅ 编译通过，无语法错误
  - **修改文件**:
    - `kernel/nerv/magi/coordinator/toolcall_context.go`: 添加回调机制和首次检测时间记录
    - `kernel/nerv/magi/websocket/events.go`: PushToolCallDetected 接受 timestamp 参数
    - `kernel/nerv/magi/coordinator/collector.go`: 设置回调立即发射事件，移除延迟发射代码

---

## 🟡 中期计划

- [ ] **Phase 5: 后端重启seq回绕处理 (P1)**
  - **背景**: ATF路径传nil给SEEL_REPLY_STARTED，前端guard会拒绝该事件
  - **行动**:
    1. 修改 `kernel/nerv/magi/coordinator/coordinator_atf.go:56,73,90`
    2. 创建空的streamMessage对象：`&types.Message{ID: "", Type: types.TypeAI, Content: "", Status: types.StatusStreaming, Timestamp: time.Now().UnixMilli()}`
  - **验收标准**:
    - ATF路径的SEEL_REPLY_STARTED事件能被前端正常接收
    - 不影响正常路径的流式更新
  - **参考文档**:
    - `kernel/nerv/magi/coordinator/coordinator_atf.go:42-90`
    - `app/src/magi/events/dispatchMagiWebSocketMessage.guard.ts:36-44`

- [ ] **Phase 5: 后端重启seq回绕处理 (P1)**
  - **背景**: 后端重启时seq从0开始，前端会把新事件当旧事件丢弃
  - **行动**:
    1. 在 `kernel/nerv/magi/websocket/events.go` 添加启动时间戳
    2. 在每个事件中添加 `serverStartTime` 字段
    3. 前端检测到serverStartTime变化时重置状态（清空processedEventIds和latestSeq）
  - **验收标准**:
    - 后端重启后前端能正常接收新事件
    - 不影响正常运行时的事件处理
  - **参考文档**:
    - `kernel/nerv/magi/websocket/events.go:44-47`
    - `app/src/magi/events/magiProjector.ts:136-153`

- [ ] **Phase 6: 后端会话级消息队列 (P2)**
  - **背景**: 作为额外保障，防止并发推送导致的传输层乱序
  - **行动**:
    1. 在 `kernel/nerv/magi/websocket/pusher.go` 创建会话级消息队列
    2. 为每个sessionId维护独立的goroutine和channel（缓冲区1024）
    3. 队列满时阻塞等待5秒，超时返回错误
  - **验收标准**:
    - 同一会话的事件按Push调用顺序推送
    - 队列满时阻塞调用方，超时后返回错误
    - 会话结束时队列正确清理

---

## 🔴 远期计划

- [ ] **Phase 7: 单元测试 (P2)**
  - **愿景**: 完整的单元测试覆盖
  - **行动**:
    1. 后端：测试实时事件推送、seq原子性、timestamp一致性
    2. 前端：测试timestamp排序、时间窗口去重、消息插入位置
    3. 测试覆盖率目标：后端≥80%，前端≥90%

- [ ] **Phase 8: 集成测试 (P2)**
  - **愿景**: 验证端到端时序正确性
  - **行动**:
    1. 模拟并发场景：三贤人同时响应
    2. 验证工具调用事件在AI回复之前显示
    3. 验证事件按timestamp顺序显示

- [ ] **Phase 9: 性能测试 (P2)**
  - **愿景**: 验证性能影响
  - **行动**:
    1. 测量实时事件推送的延迟
    2. 测量前端timestamp排序的性能开销
    3. 压力测试：高频事件推送（1000事件/秒）

- [ ] **Phase 10: 技术文档 (P2)**
  - **愿景**: 完善技术文档
  - **行动**:
    1. 编写技术设计文档说明事件实时推送机制
    2. 更新MAGI开发指南：事件推送最佳实践
    3. 添加故障排查指南：timestamp乱序、seq错配等

---

## 🏁 已归档/已完成

- [x] **Phase 4: 修复ATF路径streamMessage为nil问题 (P1)** - 2026-03-17
  - **背景**: ATF路径传nil给SEEL_REPLY_STARTED，前端guard会拒绝该事件
  - **实施方案**:
    1. 修改 `coordinator_atf.go` 三处PushSeelReplyStarted调用
    2. 创建空的streamMessage对象替代nil
  - **验收结果**:
    - ✅ ATF路径的SEEL_REPLY_STARTED事件包含有效streamMessage
    - ✅ 不影响正常路径的流式更新
    - ✅ 编译通过，无语法错误
  - **修改文件**:
    - `kernel/nerv/magi/coordinator/coordinator_atf.go`: 三处PushSeelReplyStarted调用

- [x] **Phase 3: 前端按timestamp主排序 (P0)** - 2026-03-17
  - **背景**: 所有事件都有后端timestamp，timestamp比seq更可靠（seq有全局缺口问题）
  - **实施方案**:
    1. 修改 `upsertMessage` 函数，实现按timestamp二分查找插入
    2. 相同timestamp时按seq排序（作为辅助）
    3. 修改 `shouldProcessEvent`，添加processedEventIds大小限制（10000）防止内存泄漏
  - **验收结果**:
    - ✅ 消息按timestamp主排序插入
    - ✅ 相同timestamp按seq辅助排序
    - ✅ processedEventIds有上限防止内存泄漏
    - ✅ 核心逻辑实现完成
  - **修改文件**:
    - `app/src/magi/events/magiProjector.ts`: upsertMessage和shouldProcessEvent函数

- [x] **Phase 2: 修复seq并发安全与eventId错配 (P0)** - 2026-03-17
  - **背景**: `generateEventID()`内`globalSeq++`无原子保护，且eventId与seq可能错配
  - **实施方案**:
    1. 引入 `sync/atomic` 包
    2. 修改 `generateEventID` 函数签名为 `func generateEventID() (string, int64)`
    3. 使用 `atomic.AddInt64(&globalSeq, 1)` 原子递增
    4. 修改所有16个Push函数，使用 `eventId, seq := generateEventID()`
  - **验收结果**:
    - ✅ eventId后缀与seq字段严格一致
    - ✅ 并发推送时seq无竞态条件
    - ✅ 编译通过，无语法错误
  - **修改文件**:
    - `kernel/nerv/magi/websocket/events.go`: 修改generateEventID和所有Push函数

- [x] **Phase 1: 修复事件延迟聚合问题 (P0 - 最严重)** - 2026-03-17
  - **背景**: 当前实现将工具调用收集到processor，等待turn结束后才批量推送事件，违反"事件应立即发射"原则
  - **问题位置**:
    - `collector.go:214-220`: 工具调用被收集但不推送
    - `collector.go:271-290`: turn结束后才调用buildSageResponse推送事件
    - `collector.go:368-379`: 在buildSageResponse内部遍历map推送
  - **实施方案**:
    1. 在 `collector.go:271` processor.GetResult(true)之后立即推送TOOL_CALL_DETECTED事件
    2. 遍历result.ToolArgumentsByName，按工具名称推送事件
    3. 移除 `buildSageResponse` 中的延迟推送逻辑（原368-379行）
    4. processor仍然收集工具调用数据（用于传递给trinity），事件推送与数据收集完全分离
  - **验收结果**:
    - ✅ 工具调用事件在processor.GetResult()后立即推送
    - ✅ 事件推送不再延迟到buildSageResponse
    - ✅ Trinity数据收集不受影响
    - ✅ 编译通过，无语法错误
  - **修改文件**:
    - `kernel/nerv/magi/coordinator/collector.go`: 在271行后添加立即事件推送，移除buildSageResponse中的延迟推送

---

## 📚 参考文档

- `kernel/nerv/magi/websocket/events.go` - WebSocket事件推送
- `kernel/nerv/magi/coordinator/collector.go` - 贤者响应收集
- `app/src/magi/events/magiProjector.ts` - 前端事件投影
- `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md` - TTT文档规程
