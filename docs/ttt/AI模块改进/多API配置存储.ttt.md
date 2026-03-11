# 多API配置存储 执行跟踪 (TikTocTak)

> **目标**: 在保持与上游思源笔记配置数据格式100%兼容的前提下，基于 S-forge ProfileManager 实现多API配置存储，支持多模态（文本/图像等不同API端点）和灵活的API切换。最终所有AI配置消费者统一从 Profile 机制读取。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 核心原则

### 问题定义

当前思源笔记的AI配置采用**单配置结构**：`IAI { openAI: IOpenAI }`。整个系统只能配置一个 OpenAI 兼容的 API 端点。MAGI 三贤人、AI菜单操作、ModelScope 文生图组件全部共享同一份配置。

**核心矛盾**：
- 用户需要同时使用多个 AI 服务（DeepSeek 用于日常、Claude 用于代码等）
- MAGI 三贤人理论上各自应有独立的 AI 配置
- 不同场景（聊天、翻译、生成图片）可能需要不同的 API 端点
- 上游 kernel 层数据结构不可变（fork 项目需保持合并兼容性）

### 架构决策

**已确定方案：S-forge 扩展层 + 上游回退**

**决策理由**：
1. **不修改 kernel**：上游 `conf.json` 中的 `ai.openAI` 始终作为默认/后备配置保留，保证 fork 项目与上游合并时零冲突。
2. **复用 ProfileManager**：`ModelScopeConfig.vue` 已证明 ProfileManager 多配置管理完全可用。Profile 存储在 `/data/storage/profiles/` 下，通常包含在思源同步范围内。
3. **渐进式适配**：配置消费者优先读取 S-forge 活跃 Profile，找不到时回退到上游配置。未创建 Profile 的用户行为完全不变。

### 验收检查清单

- [ ] `getSForgeConfigs().ai.openAI` namespace 正常运作（创建/切换/删除 Profile）
- [ ] 设置面板新增"多配置管理"tab，可管理多个 OpenAI 兼容配置
- [ ] Profile 的 `data` 字段结构与 `IOpenAI` 接口完全一致（字段名和类型一一对应）
- [ ] 不创建 Profile 时，所有 AI 功能使用上游 `conf.ai.openAI`（行为不变）
- [ ] 创建并激活 Profile 后，MAGI 和 AI 菜单操作使用活跃 Profile 配置
- [ ] Profile 持久化——刷新页面后配置还原
- [ ] "从当前思源配置导入"功能正常——一键将上游配置克隆为 Profile

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**把对应的任务剪切粘贴到最底下的【已归档】列表里，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **配合文档**：调查报告详见 [多API配置存储_现状调查.md](多API配置存储_现状调查.md)

---

## 🟢 近期计划

- [ ] **Phase 1: 配置存储层扩展 (P0)**
  - **背景**: S-forge 配置入口需要新增 `ai.openAI` namespace，Profile 数据类型需要与上游 `IOpenAI` 对齐。
  - **行动**:
    1. 在 `app/src/config/sforge.ts` 的 `getSForgeConfigs()` 中新增 `ai.openAI: ProfileManager.getInstance("ai_openai")`
    2. 新建 `app/src/config/ai/openAIProfileData.types.ts`，定义 `OpenAIProfileData` 接口（与 `IOpenAI` 字段一一对应）和工厂函数 `创建默认OpenAI配置()` `从思源配置创建Profile()`
    3. 验证 Profile 可正常创建/读取/删除（通过控制台调用）
  - **验收标准**: `ProfileManager.getInstance("ai_openai")` 可成功创建 Profile 并从 `/data/storage/profiles/ai_openai/` 读取
  - **成果文件**: `app/src/config/ai/openAIProfileData.types.ts`, `app/src/config/sforge.ts`

- [ ] **Phase 2: 统一配置解析入口 (P0)**
  - **背景**: 目前 `ai/utils.config.ts` 和 `mockWise.ts` 分别直接读取 `window.siyuan.config`，需要统一为优先读取活跃 Profile。
  - **行动**:
    1. 新建 `app/src/config/ai/resolveAIConfig.ts`，实现 `解析当前AI配置(): Promise<Config.IOpenAI>`，优先级：S-forge 活跃 Profile > 上游配置
    2. 将 `ai/utils.config.ts` 改为使用 `解析当前AI配置()`（注意：同步→异步变更）
    3. 将 `mockWise.ts` 的 `合并MockWISE配置()` 中全局配置读取改为 `解析当前AI配置()`
    4. 检查并适配所有 `getAIConfigFromSiyuan()` 的调用方
  - **验收标准**: 活跃 Profile 存在时使用 Profile 配置；不存在时回退到上游配置
  - **成果文件**: `app/src/config/ai/resolveAIConfig.ts`, `app/src/ai/utils.config.ts`, `app/src/magi/core/wise/mockWise.ts`

- [ ] **Phase 3: 多配置管理UI (P1)**
  - **背景**: 需要一个 Vue 组件让用户管理多个 OpenAI 兼容配置，并集成到设置面板。
  - **行动**:
    1. 参照 `ModelScopeConfig.vue` 新建 `app/src/config/ai/OpenAIMultiConfig.vue`，含 Profile 选择器、表单字段、导入按钮
    2. 修改 `app/src/config/ai/ai.ts`，新增第三个 tab "多配置"，挂载 Vue 组件
    3. 复用现有 i18n key（`apiKey`, `apiBaseURL` 等）
  - **验收标准**: 设置 → AI → "多配置" tab 可正常创建/切换/删除/编辑 Profile
  - **成果文件**: `app/src/config/ai/OpenAIMultiConfig.vue`, `app/src/config/ai/ai.ts`

---

## 🟡 中期计划

- [ ] **Phase 4: MAGI 三贤人独立配置支持 (P2)**
  - **背景**: MAGI 设计上三贤人应使用不同的 AI 服务（如 Melchior 用推理强的模型，Casper 用快速模型），需要在 `MockWISEConfig` 中支持指定 Profile ID。
  - **行动**:
    1. 在 `MockWISEConfig` 中新增 `openAIProfileId?: string` 字段
    2. `合并MockWISE配置()` 优先级改为：子类指定 ProfileId > 全局活跃 Profile > 上游配置
    3. MAGI设置面板中为每个贤人添加 Profile 下拉选择器

- [ ] **Phase 5: 配置加载路径统一 (P2)**
  - **背景**: `magi/core/configLoader.ts` 和 `magi/core/marduk.ts` 有独立的配置文件加载逻辑（`ai-config.json` 和 `petal/SACKeyManager/`），应逐步迁移到 Profile 机制。
  - **行动**:
    1. `configLoader.ts` 改为读取 S-forge Profile
    2. `marduk.ts` 的 `loadLatestConfig` 改为优先读取 Profile
    3. 清理遗留的独立配置文件加载代码

- [ ] **Phase 6: 场景绑定配置 (P2)**
  - **背景**: 不同 AI 操作场景（聊天、翻译、续写、图生文）可能需要不同的 API 配置。
  - **行动**:
    1. 设计场景→Profile 映射机制（如 `{ chat: profileId1, translate: profileId2 }`）
    2. 在 AI 菜单操作中根据场景选择对应 Profile
    3. 在设置面板中提供场景路由配置UI

---

## 🔴 远期计划

- [ ] **Phase 7: 配置自动发现与健康检查 (P3)**
  - **愿景**: 自动探测 API 端点可用性，提供连接状态指示器，在端点不可用时自动切换到备用配置。

- [ ] **Phase 8: 配置共享与导入/导出 (P3)**
  - **愿景**: 支持将 Profile 配置（脱敏后）导出为 JSON 文件，便于跨设备迁移或分享。

---

## 🏁 已归档/已完成

- [x] **Phase 0: 现状调查** [已完成 2026-03-02]
  - **背景**: 需要全面了解当前 AI 配置存储的架构、数据结构和消费链路。
  - **完成情况**: 调查了后端 kernel `conf/ai.go` 结构、前端 `config.d.ts` 类型、设置面板 `ai.ts` 读写逻辑、S-forge ProfileManager 机制、MAGI 三贤人配置消费方式。确认上游为单配置结构，S-forge Profile 机制已成熟可复用。
  - **成果文件**: [`docs/ttt/多API配置存储_现状调查.md`](多API配置存储_现状调查.md)
