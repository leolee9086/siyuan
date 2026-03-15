# MAGI 三贤人 ReAct 工具调用结构实现执行跟踪 (TikTocTak)

> **目标**: 实现完整的三贤人ReAct循环工具调用结构，确保三贤人通过工具调用进行思考和决策，最终由Trinity统一输出。
>
> **量化指标**:
> 1. 三贤人每轮响应100%通过工具调用完成（无纯文本回复）
> 2. 工具分类系统完整实现（回忆/思考/行动三类）
> 3. 行动工具调用后循环正确终止率100%
> 4. 投票机制在非wanna_speak行动工具时正确触发率100%
> 5. Trinity最终输出通过speak工具完成率100%
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

1. **状态机模式**: 工具调用本质是状态转移，function_call是进入/退出工具状态的标志
2. **工具强制**: 三贤人每轮必须通过工具调用进行状态转移，禁止纯文本回复
3. **类型分层**: 工具分为回忆/思考/行动三类，对应不同的状态类型
   - **回忆工具**: 进入查询状态，用于查询笔记和工作空间内容
   - **思考工具**: 进入计算状态，用于无副作用的计算和推理
   - **行动工具**: 进入决策状态，用于表达决策和派遣avatar等
4. **状态转移规则**:
   - 回忆/思考工具：进入→执行→退出→继续循环
   - 行动工具：进入→执行→退出→终止循环
5. **命名约定**: 三贤人行动工具统一使用wanna_前缀，Trinity工具无前缀
6. **投票触发**: 非wanna_speak的行动工具触发3×3投票机制
7. **输出统一**: Trinity通过speak工具统一对外输出

## 验证检查清单

- [ ] 三贤人工具定义包含category字段（recall/think/action）
- [ ] 三贤人每轮响应必须包含工具调用
- [ ] 行动工具调用后循环正确终止
- [ ] think_continue工具正确实现并可被调用
- [ ] wanna_speak工具正确传递内容到Trinity
- [ ] 非wanna_speak行动工具触发投票
- [ ] 投票结果正确转换为Trinity的工具调用
- [ ] Trinity的speak工具正确输出最终结果

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

- [ ] **Phase 1: 工具类型系统定义 (P0)**
  - **背景**: 需要建立工具分类的基础类型系统，区分回忆/思考/行动三类工具
  - **行动**:
    1. 在 `kernel/nerv/magi/types/types.go` 中定义 `ToolCategory` 枚举类型
    2. 在 `kernel/nerv/magi/config/config.go` 的 `ToolDef` 结构中添加 `Category` 字段
    3. 定义三类工具的语义约束（回忆=查询记忆，思考=推理分析，行动=决策输出）
  - **验收标准**:
    - `ToolCategory` 类型包含 `CategoryRecall`、`CategoryThink`、`CategoryAction` 三个常量
    - `ToolDef` 结构包含 `Category ToolCategory` 字段
    - 代码编译通过，类型定义清晰
  - **参考文档**: 
    - `kernel/nerv/magi/types/types.go`
    - `kernel/nerv/magi/config/config.go`

- [ ] **Phase 2: 三贤人基础工具集定义 (P0)**
  - **背景**: 需要为三贤人定义基础工具集，包括思考工具和行动工具
  - **行动**:
    1. 定义 `think_continue` 思考工具（category=think，用于普通思考推理）
    2. 定义 `wanna_speak` 行动工具（category=action，用于提交响应内容）
    3. 定义 `wanna_deliberate` 行动工具（category=action，用于触发审慎决策）
    4. 在 `config/config.go` 中实现工具构建函数
  - **验收标准**:
    - 三个工具定义完整，包含name、description、parameters、category
    - `think_continue` 的category为 `CategoryThink`
    - `wanna_speak` 和 `wanna_deliberate` 的category为 `CategoryAction`
    - 工具参数schema符合OpenAI工具调用规范
  - **参考文档**:
    - `kernel/nerv/magi/config/config.go` (参考现有BuildSpeakToolDef)

- [ ] **Phase 3: 三贤人ReAct循环执行器实现 (P0)**
  - **背景**: 需要实现三贤人的ReAct循环，确保每轮必须调用工具，并根据工具类型控制循环
  - **行动**:
    1. 在 `kernel/nerv/magi/sages/sage.go` 中实现 `ExecuteReActLoop` 方法
    2. 实现工具调用强制检查：每轮响应必须包含工具调用
    3. 实现纯文本输出提醒机制：当检测到纯文本输出时，自动注入系统消息"你的纯文本输出不会被用户看到,如果你想要说什么或者做什么,需要调用相应的工具"，并继续循环
    4. 实现wanna_speak特殊表达模式：
       - 调用wanna_speak后，注入系统消息"现在你可以输出你想要说的话"
       - 进入表达模式，允许纯文本输出
       - 每轮纯文本输出后提示"如果说完了就调用wanna_speak"
       - 再次调用wanna_speak时结束表达模式，收集所有表达内容
    5. 实现循环终止判断：检测到非wanna_speak的action类工具时终止循环
    6. 实现最大循环次数限制（防止无限循环）
    7. 实现工具调用结果回注到上下文的逻辑
  - **验收标准**:
    - 普通模式下纯文本输出触发提醒并继续循环
    - wanna_speak调用后进入表达模式，允许纯文本输出
    - 表达模式下每轮提示"如果说完了就调用wanna_speak"
    - 再次调用wanna_speak时正确收集所有表达内容并终止
    - 调用其他action类工具后循环正确终止
    - 调用recall/think类工具后循环继续
    - 达到最大循环次数时正确终止并返回状态
  - **参考文档**:
    - `kernel/nerv/magi/sages/sage.go`
    - `kernel/nerv/magi/stream/processor.go`

- [ ] **Phase 4: 工具调用解析与分发 (P0)**
  - **背景**: 需要解析三贤人的工具调用，提取wanna_speak内容或触发投票
  - **行动**:
    1. 在 `kernel/nerv/magi/coordinator/collector.go` 中实现工具调用解析
    2. 识别wanna_speak工具调用，提取content参数
    3. 识别其他wanna_*行动工具，标记需要投票
    4. 将wanna_speak内容作为三贤人响应传递给Trinity
    5. 实现工具调用验证（参数完整性检查）
  - **验收标准**:
    - wanna_speak工具的content正确提取
    - 非wanna_speak的行动工具正确标记为需要投票
    - 工具调用参数缺失时返回明确错误
    - 三贤人响应结构包含工具调用信息
  - **参考文档**:
    - `kernel/nerv/magi/coordinator/collector.go`
    - `kernel/nerv/magi/types/types.go`

- [ ] **Phase 5: 投票机制与Trinity工具调用集成 (P1)**
  - **背景**: 需要将投票结果转换为Trinity的工具调用，实现统一输出
  - **行动**:
    1. 修改 `kernel/nerv/magi/coordinator/voting.go` 支持非speak场景的投票
    2. 投票通过时，将行动工具名称（去除wanna_前缀）和参数传递给Trinity
    3. 投票否决时，生成否决消息通过Trinity的speak工具输出
    4. 确保Trinity只通过speak工具对外输出
    5. 实现投票结果到工具调用的映射逻辑
  - **验收标准**:
    - 投票通过时Trinity正确调用对应工具（无wanna_前缀）
    - 投票否决时Trinity通过speak输出否决消息
    - Trinity不直接输出纯文本，必须通过工具
    - 工具调用参数正确传递
  - **参考文档**:
    - `kernel/nerv/magi/coordinator/voting.go`
    - `kernel/nerv/magi/coordinator/coordinator.go`
---

## 🟡 中期计划

- [ ] **Phase 6: 回忆工具集实现 (P1)**
  - **背景**: 三贤人需要查询笔记和工作空间内容的能力
  - **行动**:
    1. 定义 `recall_notes` 工具（查询相关笔记块）
    2. 定义 `recall_workspace` 工具（查询工作空间文件结构）
    3. 实现工具执行逻辑，调用现有的搜索和文件系统API
    4. 将工具添加到三贤人的工具集配置中

- [ ] **Phase 7: 扩展思考工具集 (P2)**
  - **背景**: 三贤人需要更多无副作用的计算和推理工具
  - **行动**:
    1. 定义 `think_calculate` 工具（数学计算）
    2. 定义 `think_analyze` 工具（逻辑分析）
    3. 实现工具执行逻辑
    4. 确保工具无副作用（纯计算）

- [ ] **Phase 8: 扩展行动工具集 (P2)**
  - **背景**: 三贤人需要更多决策和派遣能力
  - **行动**:
    1. 定义 `wanna_dispatch_avatar` 工具（派遣Avatar执行任务）
    2. 定义 `wanna_request_permission` 工具（请求用户授权）
    3. 实现工具到投票机制的集成
    4. 确保所有行动工具都触发适当的审批流程

- [ ] **Phase 9: 提示词优化 (P1)**
  - **背景**: 需要优化三贤人的系统提示词，引导其正确使用工具
  - **行动**:
    1. 在系统提示词中明确说明必须使用工具调用
    2. 说明工具类型和使用场景
    3. 提供工具使用示例
    4. 强调行动工具会结束当前思考循环

- [ ] **Phase 10: 错误处理与降级策略 (P1)**
  - **背景**: 需要处理工具调用失败、LLM不遵守规则等异常情况
  - **行动**:
    1. 实现工具调用失败的重试机制
    2. 实现LLM未调用工具时的提示和重试
    3. 实现循环超时的优雅降级
    4. 记录异常情况用于后续分析

- [ ] **Phase 11: 监控与可观测性 (P2)**
  - **背景**: 需要监控ReAct循环的执行情况
  - **行动**:
    1. 添加工具调用统计（各类型工具的调用频率）
    2. 添加循环次数统计
    3. 添加循环终止原因统计
    4. 通过WebSocket推送循环执行状态

- [ ] **Phase 12: 前端适配 (P1)**
  - **背景**: 前端需要适配新的工具调用结构
  - **行动**:
    1. 更新前端类型定义，支持工具调用信息
    2. 在三贤人卡片中显示工具调用历史
    3. 在主消息区显示最终的speak工具输出
    4. 实现工具调用的可视化展示

---

## 🔴 远期计划

- [ ] **Phase 13: 工具学习与优化 (P2)**
  - **愿景**: 基于历史数据优化工具选择策略，提高决策效率

- [ ] **Phase 14: 自定义工具注册 (P2)**
  - **愿景**: 允许用户或插件注册自定义工具，扩展三贤人能力

- [ ] **Phase 15: 多模态工具支持 (P2)**
  - **愿景**: 支持图像、音频等多模态输入输出的工具

---

## 🏁 已归档/已完成

（暂无已完成任务）

---

## 风险与依赖

### 技术风险

1. **LLM遵守度风险**: LLM可能不严格遵守"必须调用工具"的规则
   - 缓解措施: 强化提示词，实现检测和重试机制

2. **循环控制风险**: 循环可能因判断错误而提前终止或无限循环
   - 缓解措施: 严格的类型检查，最大循环次数限制

3. **性能风险**: ReAct循环增加LLM调用次数，可能影响响应速度
   - 缓解措施: 优化提示词减少循环次数，实现并发优化

### 依赖关系

- Phase 3 依赖 Phase 1、2
- Phase 4 依赖 Phase 3
- Phase 5 依赖 Phase 4
- Phase 6-8 依赖 Phase 3
- Phase 9 依赖 Phase 1-3
- Phase 12 依赖 Phase 1-5

---

## 参考文档

- `docs/设计/MAGI认知架构.design.md` - MAGI整体架构设计
- `docs/设计/MAGI_Shell行动层.design.md` - Shell层与工具系统设计
- `docs/调研/myclaw_nanoClaw_调研报告.md` - ReAct循环实现参考
- `toread/` - 3×3投票机制参考实现
- `kernel/nerv/magi/` - MAGI后端实现代码
- `app/src/magi/` - MAGI前端实现代码

---

**文档创建**: 2026-03-15
**最后更新**: 2026-03-15
**负责人**: AI开发团队

