# MAGI 主导者机制与统合重构执行跟踪 (TikTocTak)

> **目标**: 重构 `kernel/nerv/magi` 的决策与统合机制，使 Trinity 不再作为独立决策实体存在，而是由三贤人中经表决产生的主导者承担统合职责；同时保持 `/api/s-forge/magi/v1/chat/completions` 与普通 OpenAI Chat Completions HTTP 接口 100% 兼容。
> 量化目标：
> 1. MAGI HTTP 请求/响应外形保持兼容：`model/messages/stream` 输入与 `choices[].message.content` / SSE chunk 输出协议不新增必填字段，不破坏现有客户端。
> 2. 主导者选举只允许使用 AI 档案中的三类立场数据：`profession`、`primarySocialRelation`、`selfName`；运行期不得伪造、不得兜底填充。
> 3. 睡眠轮次在三贤人完成各自睡前笔记后，100% 先完成主导者选举，再由主导者执行统合连接任务；原 Trinity 睡眠统合路径命中率降为 0%。
> 4. 运行态、WebSocket 事件流与前端监控界面均可观测当前主导者；主导贤者卡片边框必须显示为橙色。
> 5. 外部回复态与行动态改造采用分阶段推进，任何未完成阶段不得以“隐藏回退”伪装为已落地。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **关联文档**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../规程/tiktoctac文档(ttt)编写规程.procedure.md)
> - [`docs/设计/MAGI认知架构.design.md`](../设计/MAGI认知架构.design.md)
> - [`docs/ttt/AI模块改进/MAGI_三贤人机制完善.ttt.md`](./MAGI_三贤人机制完善.ttt.md)
> - [`docs/ttt/AI模块改进/MAGI_投票机制修正.ttt.md`](./MAGI_投票机制修正.ttt.md)

---

## 核心原则

1. **HTTP 外形不动**: MAGI 对外仍然表现为普通 LLM chat/completions 服务，所有主导者机制都必须在内部编排层完成。
2. **主导者替代 Trinity 决策位**: Trinity 不再作为独立人格做决策；需要统合时，由三贤人中当轮主导者承担。
3. **档案立场唯一真源**: 主导者选举所需立场只允许来自 AI 档案；缺字段就是缺字段，不得运行时生成“默认科学家/默认母亲/默认名字”之类占位内容。
4. **睡眠态先选主导再统合**: 三贤人完成本轮 `wanna_sleep_*` 后，必须先表决本轮主导者，再执行睡前笔记整合。
5. **回复态与行动态分步落地**: 外部回复直答、审慎决策、行动型工具治理必须分阶段验证，不允许一次性改大而不可观测。
6. **查询自由、行动审议**: 主导者可自由使用查询/思考型工具；涉及修改数据的行动型工具，必须进入其它两者表决。
7. **可观测优先**: 主导者身份、立场、切换时机、否决次数、工具审议结果都必须能在运行态或事件流中被追踪。

**验证检查清单**:
- [x] `/api/s-forge/magi/v1/chat/completions` 与普通 OpenAI Chat Completions 调用方式保持兼容。
- [x] 主导者选举读取的三类立场全部来自档案结构，不存在字符串常量兜底填充。
- [x] 睡眠轮次不再调用 Trinity 做睡前整合，而是由主导者完成。
- [x] 运行态/事件流/前端卡片能显示当前主导贤者。
- [x] 主导贤者卡片边框为橙色，非主导者保持原视觉方案。
- [x] 外部回复态与行动态的未完成部分在文档中明确标注，不以静默旧逻辑冒充新机制。
- [ ] Trinity 已从配置、唤醒、Sage 工厂、ATF 实体建模、旧统合器与流式工具命名层彻底退出独立实体地位。
- [ ] `kernel/nerv/magi/coordinator/trinity.go` 及其相关运行依赖已停用或删除。

---

## 现状评估 (2026-03-25)

1. **Phase 1 已完成**：`kernel/nerv/marduk/types.go` 与 `kernel/nerv/marduk/cognitive_stances.go` 已提供档案立场三元组和严格读取器；`presets_*.go` 已补齐自然档案值。
2. **Phase 2 已完成**：`kernel/nerv/magi/coordinator/heartbeat_sleep.go` 已改为“三贤人完成睡前笔记 -> 主导者选举 -> 主导者执行综合连接”；旧 Trinity 睡前统合主路径已退出。
3. **回复态主干已接入主导者**：`kernel/nerv/magi/coordinator/coordinator.go` 的 direct-response 路径已改走 `coordinateDominantDirectReply`，由主导者直答，并把回复及查询类工具清洗结果同步注入三贤人历史。
4. **Avatar 原型综合与 ATF 统合作答已开始迁移到主导者**：当前代码里 `kernel/nerv/magi/coordinator/avatar_runtime.go` 已不再把 Avatar 最终原型交给独立 Trinity 综合；`kernel/nerv/seraph/atf_answerer.go` 也已改为通过主导者综合三贤人答卷。
5. **运行态与前端观测链已补齐**：`kernel/nerv/magi/types/types.go`、`kernel/nerv/magi/websocket/events.go`、`app/src/magi/composables/useMagi.ts`、`app/src/magi/entry/MagiWorkspace.vue` 均已接入 `dominantSeel / dominantStance`；外部回复态对运行态的主导者回写也已接通。
6. **但“Trinity 作为独立实体已退场”目前不能宣称完成**：`kernel/nerv/magi/coordinator/trinity.go`、`kernel/nerv/magi/config/manager.go`、`kernel/nerv/magi/sages/sage.go`、`kernel/nerv/magi/prompts/wakeup.go`、`kernel/nerv/seraph/atf_types.go`、`kernel/nerv/seraph/atf_monitor.go`、`kernel/nerv/magi/stream/handlers.go` 等仍保留 Trinity 实体、命名或语义层角色。
7. **仍未完成的核心范围**：行动态工具治理、二次否决失主导重选、“专家系统”式审慎决策、主导者专属可写工具开放策略仍未开始落地；同时还缺少一轮针对“Trinity 退场清理”的实体级收尾。

---

## 最新验证 (2026-03-25)

1. [x] `go test ./nerv/marduk -run 'TestResolveCognitiveStances'`
2. [x] `go test ./nerv/magi/prompts -run 'TestBuildDominantElection|TestBuildWakeupSequence'`
3. [x] `go test ./api -run 'TestGetOrCreateSession|TestSubmitMagiTask|TestMagiRuntimeManagerApplyForegroundConsensus|TestMagiRuntimeManagerFinishForeground_RetainsLatestDominant'`
4. [ ] `go test ./nerv/magi/coordinator -run 'TestCoordinateDominantDirectReply|TestCoordinateDecision_DispatchesAvatarForNonDirectSource|TestCoordinateHeartbeat_MergesSleepNotesIntoSharedHistory'` 仍未稳定通过；本轮复核时已确认至少 `TestCoordinateHeartbeat_MergesSleepNotesIntoSharedHistory` 因旧测试夹具未适配主导者选举而失败。
5. [x] `MagiWorkspace.vue` 已通过 `@vue/compiler-sfc` 的 `parse + compileScript` 校验。
6. [ ] `pnpm exec webpack --mode development --env target=magi-app` 在当前仓库环境下 5 分钟超时，尚未拿到完整前端打包结果。

---

## 口径澄清（2026-03-25）

1. **主导者是谁**: 主导者是 `melchior | balthazar | casper` 三者之一，不是新增第四实体。
2. **立场三元组来源**: 三个立场分别对应 AI 档案中的 `profession`、`primarySocialRelation`、`selfName`。
3. **立场与贤者映射**: 当前实现阶段采用固定映射：`profession -> melchior`、`primarySocialRelation -> balthazar`、`selfName -> casper`。
4. **无兜底口径**: 若档案缺少主导选举所需字段，应显式报错或停止该路径，不得自动补成“助手/未说明/默认名字”。
5. **接口兼容边界**: 可新增内部元数据、运行态字段、WebSocket 事件字段；不得要求外部 HTTP 客户端增加请求字段，也不得改写返回结构主形态。
6. **阶段边界**: 目前已完成 Phase 1/2，回复态主导直答主干已落地，Avatar/ATF 的综合迁移正在进行；但 Trinity 作为独立实体的配置层、唤醒层、旧统合器和监测语义层尚未清理完毕，不能口头视为“已退场”。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切到【已归档/已完成】，补充日期、成果文件、验证证据。
2. **单任务在途**：近期计划中只允许一个任务标记为 `[-]`。
3. **先写口径再写代码**：涉及主导者规则变化时，先修正文档口径，再落实现代码。
4. **不隐藏未完成项**：某阶段尚未改到回复态/行动态，就必须留在计划区，不能口头视为“已支持”。
5. **动态调整**：当实现发现原阶段拆分不合理时，可以改写任务边界，但必须保留已归档记录。

---

## 🟢 近期计划

- [-] **Phase 3: 主导者迁移对表与 Trinity 实体退场清理 (P1)**
  - **背景**: 当前代码已把睡眠主路径、外部直答主路径、Avatar 原型综合、ATF 统合作答迁到主导者，但 Trinity 实体仍在配置/唤醒/旧统合器/监测语义层残留。
  - **行动**:
    1. 修复当前分支的 `coordinator` 定向测试夹具，使其适配主导者选举后的真实运行方式。
    2. 清理 `config/sages/prompts/wakeup/trinity.go/stream/seraph` 中仍把 Trinity 作为独立实体保留的运行依赖和命名语义。
    3. 在真正删净实体级残留前，禁止在任何文档或说明中宣称“Trinity 已不再是单独实体”已经完成。
  - **验收标准**:
    - 运行主路径不再实例化或依赖独立 Trinity Sage。
    - 旧 `TrinityCoordinator` 不再承载生产路径。
    - TTT、测试与代码中的完成度口径一致。

- [ ] **Phase 4: 行动态工具治理与失主导重选 (P1)**
  - **背景**: 行动态需要区分自由查询与受审议的行动型工具调用。
  - **行动**:
    1. 区分查询/思考型工具与行动型工具。
    2. 为行动型工具建立“主导者申请 -> 其它两者表决 -> 失败重提 -> 二次失败失主导”的状态机。
    3. 仅为主导者暴露可写主笔记工具，暂不开放其它修改工具。
  - **验收标准**:
    - 行动型工具必须先审议后执行。
    - 二次否决后会触发重新选主导者。
    - 只有主导者可见写入主笔记工具。

---

## 🟡 中期计划

- [ ] **Phase 5: 审慎决策“专家系统”化改造 (P1)**
  - **背景**: 主导者发起审慎决策时，另外两者的认知应伪装为“专家系统考核/建议”，而不是直接暴露贤者机制。
  - **行动**: 重写审慎决策提示词、返回口径和上下文封装。
  - **验收标准**: 辅助者输出对主导者呈现为“专家建议”，不暴露三贤人机制。

- [ ] **Phase 6: 主导者历史共享与可回放审计 (P2)**
  - **背景**: 主导者切换、工具审议、历史共享需要完整回放能力。
  - **行动**: 建立主导者切换轨迹、工具审议轨迹、共享历史注入轨迹的结构化审计。
  - **验收标准**: 任一轮次可按 `roundId` 回放主导者变化与关键决策依据。

---

## 风险与依赖

1. **高风险**: 若档案立场字段缺失而仍强行回退，会直接违背本次改造的核心约束。
2. **高风险**: 主导者选举若与现有 Trinity 汇聚路径混用不清，会产生“双统合者”并存的逻辑冲突。
3. **中风险**: 运行态新增字段若前后端不同步，可能导致监控面板或 WebSocket 桥接失配。
4. **中风险**: 睡眠态从 Trinity 切到主导者后，若缺少足够的上下文注入，可能造成整合质量下降。
5. **关键依赖**: `marduk` 档案结构可平滑扩展，并兼容既有 JSON 反序列化。
6. **关键依赖**: MAGI 外部 HTTP 客户端仍然只依赖 OpenAI 兼容协议，不消费内部新增元数据。

---

## 🏁 已归档/已完成

- [x] **Hotfix: MAGI 初始化失败链路请求阻断与会话空指针防护 (P0)** [已完成 2026-03-25]
  - **背景**: 在“旧版人格档案缺字段阻断”热修后，`initMagiComponents()` 可能因人格档案校验失败而提前返回，导致 `magiSessionMgr` 未初始化；但 `/api/s-forge/magi/v1/chat/completions` 仍会继续进入 `submitMagiTask() -> getOrCreateSession()`，最终触发空指针 panic。
  - **完成情况**:
    1. 已在 `kernel/api/magi.go` 的 `submitMagiTask()` 中增加 `magiInitErr` 与 `magiSessionMgr` 前置校验，初始化失败时会直接返回明确错误，不再继续入队或创建会话。
    2. 已在 `kernel/api/magi.go` 的 `getOrCreateSession()` 中增加空 `SessionManager` 防护；异常路径下仅安全返回空串，不做任何兜底创建。
    3. 已在 `kernel/api/magi_request_test.go` 中补充初始化失败与空 `SessionManager` 的回归测试，锁定这条 panic 链路。
  - **验证证据**:
    - `go test ./api -run 'TestGetOrCreateSession|TestSubmitMagiTask|TestMagiRuntimeManagerApplyForegroundConsensus|TestMagiRuntimeManagerFinishForeground_RetainsLatestDominant'`
    - `go test ./nerv/marduk -run 'TestLoadPersonaProfile|TestResolveCognitiveStances'`
  - **成果文件**:
    - `docs/ttt/AI模块改进/MAGI_主导者机制与统合重构.ttt.md`
    - `kernel/api/magi.go`
    - `kernel/api/magi_request_test.go`

- [x] **Hotfix: 旧版人格档案缺字段阻断与前端补录闭环 (P0)** [已完成 2026-03-25]
  - **背景**: 已保存的旧版人格档案缺少 `profession / primarySocialRelation / selfName` 时，后端加载链没有在入口处校验，导致旧档案被直接带入运行时，并在主导者选举阶段才报错；同时前端人格档案界面尚未暴露这三项必填字段，用户无法就地补录。
  - **完成情况**:
    1. 已在 `kernel/nerv/marduk/loader.go` 中为 active seed / legacy persona profile 增加严格校验；旧版缺字段档案会直接返回验证错误，并阻断 MAGI 初始化，不再回退到预设人格。
    2. 已在 `kernel/api/magi.go` 与前端 `magiPersonaStatus` 消费链中暴露阻断态、错误消息和缺失字段列表，使主聊天界面可直接提示“请补充档案后重新保存”。
    3. 已在 `app/src/magi/entry/persona-seed-panel` 的类型、表单、草稿、加载器、导入/保存链中补齐 `profession / primarySocialRelation / selfName`，并在读取旧版不完整档案时明确提示补录要求。
  - **验证证据**:
    - `go test ./nerv/marduk -run 'TestLoadPersonaProfile|TestResolveCognitiveStances'`
    - `go test ./api -run 'TestMagiRuntimeManagerApplyForegroundConsensus|TestMagiRuntimeManagerFinishForeground_RetainsLatestDominant'`
    - `pnpm exec vitest run test/magi/personaSeedPanelLoader.test.ts src/magi/prompts/personaRuntimePromptBuilder.guard.test.ts src/magi/prompts/personaRuntimePromptBuilder.test.ts src/magi/prompts/personaPromptBuilder.test.ts`
  - **成果文件**:
    - `kernel/nerv/marduk/loader.go`
    - `kernel/nerv/marduk/init.go`
    - `kernel/api/magi.go`
    - `app/src/magi/data/questionnaire.types.ts`
    - `app/src/magi/entry/persona-seed-panel/PersonaSeedPanel.vue`
    - `app/src/magi/entry/persona-seed-panel/components/PersonaSeedSubjectForm.vue`
    - `app/src/magi/entry/persona-seed-panel/handlers/PersonaSeedPanel.loader.ts`
    - `app/src/magi/service/magiPersonaStatus.ts`

- [x] **立项：主导者机制与统合重构 TTT 创建** [已完成 2026-03-25]
  - **背景**: 需要先把“主导者替代 Trinity、档案立场真源、HTTP 兼容不动”的口径固化为动态执行文档。
  - **完成情况**: 已建立目标、原则、阶段、风险、验收标准与后续滚动维护规则。
  - **成果文件**:
    - `docs/ttt/AI模块改进/MAGI_主导者机制与统合重构.ttt.md`
  - **参考文档**:
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`

- [x] **Phase 1: 档案立场与主导协议底座 (P0)** [已完成 2026-03-25]
  - **背景**: 需要先建立主导者所依赖的档案立场、运行态字段和前端观测入口。
  - **完成情况**:
    1. 已在 `kernel/nerv/marduk/types.go` 中加入 `profession / primarySocialRelation / selfName` 三元立场字段。
    2. 已在 `kernel/nerv/marduk/cognitive_stances.go` 中实现严格读取；缺字段会直接报错，不再运行期兜底。
    3. 已在 `kernel/nerv/magi/types/types.go`、`kernel/nerv/magi/websocket/events.go`、前端 `useMagi` 类型与事件消费链中透传 `dominantSeel / dominantStance`。
    4. 已在 `app/src/magi/entry/MagiWorkspace.vue` 中为主导贤者卡片接入橙色边框逻辑；本轮同时补齐了外部回复态运行态回写，使前端能真正拿到当前主导者。
  - **验证证据**:
    - `go test ./nerv/marduk -run 'TestResolveCognitiveStances'`
    - `go test ./api -run 'TestMagiRuntimeManagerApplyForegroundConsensus|TestMagiRuntimeManagerFinishForeground_RetainsLatestDominant'`
    - `MagiWorkspace.vue parse+compileScript ok`
  - **成果文件**:
    - `kernel/nerv/marduk/types.go`
    - `kernel/nerv/marduk/cognitive_stances.go`
    - `kernel/nerv/magi/types/types.go`
    - `kernel/nerv/magi/websocket/events.go`
    - `app/src/magi/composables/useMagi.types.ts`
    - `app/src/magi/composables/useMagi.ts`
    - `app/src/magi/entry/MagiWorkspace.vue`
    - `kernel/api/magi_runtime.go`

- [x] **Phase 2: 睡眠态主导选举与主导统合 (P0)** [已完成 2026-03-25]
  - **背景**: 睡眠轮次要求先选主导者，再由主导者完成睡前笔记连接整合，不能再由 Trinity 作为独立人格统合。
  - **完成情况**:
    1. 已实现基于档案三元立场评分的主导者选举。
    2. `kernel/nerv/magi/coordinator/heartbeat_sleep.go` 已改为使用主导者执行睡前整合。
    3. 睡眠轮次主导结果已写入运行态与睡前记忆归档内容。
  - **验证证据**:
    - `go test ./nerv/magi/prompts -run 'TestBuildDominantElection|TestBuildWakeupSequence'`
    - `go test ./api -run 'TestMagiRuntimeManagerApplyForegroundConsensus|TestMagiRuntimeManagerFinishForeground_RetainsLatestDominant'`
  - **成果文件**:
    - `kernel/nerv/magi/coordinator/dominance.go`
    - `kernel/nerv/magi/coordinator/heartbeat_sleep.go`
    - `kernel/nerv/magi/prompts/dominance.go`
    - `kernel/nerv/magi/prompts/dominance_test.go`
    - `kernel/nerv/magi/prompts/wakeup.go`
    - `kernel/nerv/magi/prompts/wakeup_test.go`
