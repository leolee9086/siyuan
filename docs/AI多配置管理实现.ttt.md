# AI 多配置管理系统 执行跟踪 (TikTocTak)

> **目标**: 实现 AI Profiles 多配置管理系统，支持在 SQLite 中存储多套 AI 后端配置 + 模型能力目录，运行时无缝切换，且 `conf.json` 保持与原版思源完全兼容。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **前后端同步**：所有 Phase 都含 backend + frontend 子任务，不得单独完成一端。

---

## 核心原则

1. **schema 先行**：任何代码改动前必须确认 `docs/AI_PROFILES_SCHEMA.md` 的表定义是否覆盖需求
2. **conf.json 兼容**：每次 SetActive 必须写 `SyncToConf`，保证原版思源打开时 `conf.json` 的结构完全有效
3. **迁移规则**：首次启动时 `conf.json` → DB（创建 default profile）；每次切换时 DB → `conf.json`（同步活跃配置）。`sleep_start_hour`/`sleep_end_hour` 作为 MAGI 系统级参数始终留在 `conf.json` 中，不随 profile 切换
4. **前端复用模式**：Profile CRUD UI 复用 `config/ai/ModelScopeConfig.vue` 的下拉框 + 增删 + 自动保存模式
5. **验收标准不可省略**：每个任务必须有可执行的验收标准

---

## 🟢 近期计划

- [-] **Phase 1: Profile Store 实现 (P0)**
  - **背景**: 后端存储层是一切的基础，含 SQLite 表创建 + CRUD + SetActive/SyncToConf + 首次迁移
  - **行动**:
    1. 新建 `kernel/model/ai_profile_store.go`，遵循 `message_store.go` 的 SQLite 模式
    2. 建表：`ai_profiles` / `ai_profile_models` / `ai_active_profile`
    3. 实现 CRUD：`List / Get / Upsert / Delete / SetActive / GetActive`
    4. 实现 `SyncToConf()`：1:1 映射 profile 字段到 `model.Conf.AI.OpenAI`（sleep 字段不动）
    5. 实现首次迁移引导 `migrateFromConf()`：
       - DB 为空 + `conf.json` 有配置 → 读 `conf.OpenAI` → 创建名为 `"default"` 的 profile → 设为 active
       - `conf.OpenAI` 全部字段映射到 profile 对应列，无一遗漏
       - `sleep_start_hour`/`sleep_end_hour` 保持原地，不写入 profile
    6. 导出 Go 类型 `Profile` / `ProfileModel` 供其他包使用
  - **验收标准**:
    - [ ] 单元测试覆盖全部 CRUD 路径
    - [ ] `SetActive` 后 `model.Conf.AI.OpenAI` 与 profile 字段一一对应（sleep 除外）
    - [ ] 首次迁移：`conf.json` 的配置完整出现在 `ai_profiles` 表中，active 指向该 profile
    - [ ] 回退：`SetActive` 写 `conf.json` 后，原版思源可正常读取
  - **参考文档**: `docs/AI_PROFILES_SCHEMA.md`, `kernel/nerv/magi/channel/message_store.go`

- [ ] **Phase 2: LLM 客户端池 + 模型路由 (P0)**
  - **背景**: `llm.Client` 从单例变为 profile-aware，根据请求需求(model + modality)自动选择 profile+model
  - **行动**:
    1. 新建 `kernel/nerv/magi/llm/pool.go`
    2. 实现 `ProfileManager`：按 `(model, requiredModalities)` 查询 `ai_profile_models.capabilities`
    3. 选择逻辑：`enabled` → `priority` 分组 → 同 priority 组内随机选 → JOIN `ai_profiles` 拿连接参数
    4. 实现 `SwitchClient(profile)`：新建 `llm.Client` 并原子替换 active
    5. 实现 `OnChange` 回调注册（供 MAGI 重建 Sage 的 client）
    6. 留接口 `GetClient(model, opts)`：按需选择 profile+model，而不只是返回 active
  - **验收标准**:
    - [ ] `GetClient("gpt-4o", {modalities:["image"]})` 正确路由到有 vision 能力的 profile
    - [ ] `SwitchClient` 后新请求使用新 client，旧请求不受影响
    - [ ] 无匹配 profile 时返回明确的错误信息
  - **参考文档**: `toread/one-api/middleware/distributor.go`, `kernel/nerv/magi/llm/client.go`

- [ ] **Phase 3: API 端点 (P0)**
  - **背景**: 供前端和 CLI 调用的 REST 接口
  - **行动**:
    1. 新建 `kernel/api/ai_profile.go`
    2. 实现 `listAIProfiles`：返回全部 profile + 每个 profile 的模型列表 + 当前 active
    3. 实现 `upsertAIProfile`：创建或更新 profile（含 models 数组，同步写 `ai_profile_models`）
    4. 实现 `deleteAIProfile`：删除 profile（CASCADE 删除 models）
    5. 实现 `switchAIProfile`：SetActive + SyncToConf + 通知 LLM 池 + 返回新 active
    6. 统一返回值格式：`{profiles, active, activeProfile}`（供前端直接渲染）
  - **验收标准**:
    - [ ] curl 调通全部四个端点
    - [ ] upsert 支持同时提交 profiles 和 models
    - [ ] switch 后 `cat conf.json` 的 `openAI` 块与 profile 一致
  - **参考文档**: `kernel/api/magi_channel.go`, `kernel/api/setting.go:setAI`

---

## 🟡 中期计划

- [ ] **Phase 4: 前端 AI Profiles 配置面板 (P1)**
  - **背景**: 在设置页增加 "AI Profiles" 标签，可视化管理多配置
  - **行动**:
    1. 在 `app/src/config/index.ts` 的 `openSetting()` 侧边栏增加 `data-name="AIProfiles"` 条目
    2. 在 `genItemPanel()` 中增加 `case "AIProfiles"`，挂载 `AIProfilesConfig` Vue 组件
    3. 新建 `app/src/config/ai/AIProfilesConfig.vue`，复用 `ModelScopeConfig.vue` 的下拉框 + 增删 + 自动保存模式
    4. 每个 profile 可展开编辑：连接参数、模型列表（每行一个 model + capabilities 标签选择）
    5. 切换 profile 调用 `switchAIProfile`
    6. 显示当前 active 的 profile 标签
  - **验收标准**:
    - [ ] 可创建/编辑/切换/删除 profile
    - [ ] 切换后 AI 面板的 OpenAI 配置同步更新
    - [ ] 原 ModelScope 配置不受影响
  - **参考文档**: `app/src/config/ai/ModelScopeConfig.vue`, `app/src/config/ai/ai.ts`, `app/src/config/index.ts`

- [ ] **Phase 5: MAGI 启动集成 (P1)**
  - **背景**: MAGI 初始化时连接 ProfileStore，Sage 使用 profile-aware 的 client
  - **行动**:
    1. `kernel/api/magi.go` 的 `initMagiComponents()` 中调用 `model.InitProfileStore()`
    2. 从 DB 加载 active profile，若不存在则调用 `migrateFromConf()` 从 `conf.json` 创建
    3. 调用 `llm.OnProfileSwitched(active)` 初始化 LLM 池
    4. 注册 `llm.OnChange` 回调：MAGI 三个 Sage 调用 `UpdateLLMClient(newClient)`
    5. Sage 增加 `UpdateLLMClient(client llm.Client)` 方法
    6. 运行时切换 profile 时通过回调热更新 Sage 的 client
  - **验收标准**:
    - [ ] MAGI 启动后 `llm.GetClient()` 返回正确的 active profile client
    - [ ] 切换 profile 后新对话使用新 client
    - [ ] 正在进行的对话不受切换影响
    - [ ] 首次启动：conf.json 配置自动迁移为 default profile
  - **参考文档**: `kernel/api/magi.go:initMagiComponents`, `kernel/nerv/magi/sages/sage.go`

- [ ] **Phase 6: CLI 工具通过 WebSocket 切换配置 (P2)**
  - **背景**: 已实现的 CLI WebSocket adapter 应能通过消息帧切换 AI 配置
  - **行动**:
    1. 定义 CLI 协议帧：`{"type":"switch_profile","profile":"gpt4"}`
    2. `channel/cli/adapter.go` 的 `readLoop` 处理 `switch_profile` 类型消息
    3. 调用 `api.switchAIProfile` 或直接调用 `model.SetActive` + `llm.SwitchClient`
    4. 回复结果帧：`{"type":"switch_result","ok":true,"active":"gpt4"}`
  - **验收标准**:
    - [ ] CLI 发送 `switch_profile` 帧后，MAGI 使用目标 profile
    - [ ] 不存在的 profile 返回错误帧
  - **参考文档**: `kernel/api/magi_cli.go`, `kernel/nerv/magi/channel/cli/adapter.go`

---

## 🔴 远期计划

- [ ] **Per-Agent Profile 分配**: 允许 Melchior/Balthazar/Casper 使用不同 AI 后端
- [ ] **Schedule 自动切换**: 基于 `schedule_cron` 的定时 profile 切换
- [ ] **请求日志 `ai_request_log`**: 调试与分析
- [ ] **Profile 导出/导入**: 方便分享配置

---

## 🏁 已归档/已完成

- [x] **Schema 设计** [已完成 2026-05-03]
  - **完成情况**: 完成 `docs/AI_PROFILES_SCHEMA.md`，含三表设计 + SyncToConf + 设计决策说明
  - **成果文件**: `docs/AI_PROFILES_SCHEMA.md`, `docs/AI多配置管理实现.ttt.md`
