# SForge 通用配置扩展与 ModelScope 接入实施方案

本计划旨在建立一套独立于思源核心后端的扩展配置管理系统 (SForge)，并基于此系统通过 Vue UI 实现魔搭社区 (ModelScope) 的文生图功能接入。

## 用户审查要求

> [!IMPORTANT]
> **数据隔离策略**: 所有的扩展配置将存储于 `/data/storage/profiles/` 目录下，与核心配置 `conf.json` 完全物理隔离。
> **通用性设计**: 实现的 `ProfileManager` 将是一个通用的配置管理器，不仅限于 AI，后续可用于 FileTree、布局等任何扩展配置。

## 详细变更方案

### 1. 配置层 (Configuration Layer)

#### [NEW] [app/src/config/profileManager.ts](file:///d:/dev/siyuan-note/app/src/config/profileManager.ts)
实现通用的基于文件的配置管理器类 `ProfileManager`。

-   **核心职责**: 管理特定命名空间 (Namespace) 下的 JSON 配置文件。
-   **存储结构**:
    -   根目录: `/data/storage/profiles/`
    -   命名空间目录: `/data/storage/profiles/<namespace>/`
    -   配置文件: `<uuid>.json` (每个配置文件独立存储，便于分享和管理)
    -   状态文件: `_state.json` (记录当前激活的配置 ID)
-   **数据接口**:
    ```typescript
    interface Profile<T = any> {
        id: string;      // UUID
        name: string;    // 用户可读名称
        data: T;         // 具体的配置内容 (泛型)
    }

    interface NamespaceState {
        activeProfileId: string; // 当前激活的配置文件 ID
    }
    ```
-   **核心方法**:
    -   `getInstance(namespace: string)`: 单例工厂方法。
    -   `ensureNamespace()`: 确保存储目录存在。
    -   `listProfiles()`: 列出该命名空间下所有配置文件。
    -   `loadProfile(id)`: 读取特定配置。
    -   `saveProfile(profile)`: 保存特定配置。
    -   `deleteProfile(id)`: 删除特定配置。
    -   `getActiveProfileId()`: 获取当前激活的 ID。
    -   `setActiveProfileId(id)`: 设置当前激活的 ID。

#### [NEW] [app/src/config/sforge.ts](file:///d:/dev/siyuan-note/app/src/config/sforge.ts)
提供全局访问入口，严格区分原生配置与扩展配置。

-   **设计目的**: 替代 `getSiyuanConfig()` 用于扩展功能，避免混淆。
-   **导出接口**:
    ```typescript
    export const getSForgeConfigs = () => {
        return {
            ai: {
                modelScope: {
                    // 认证配置命名空间: 仅存储 Token
                    auth: ProfileManager.getInstance("ai_modelscope_auth"),
                    // 生成配置命名空间: 存储 Model, Size, Steps 等参数
                    text2image: ProfileManager.getInstance("ai_modelscope_text2image")
                }
            },
            // 未来扩展可在此添加, 例如:
            // filetree: ProfileManager.getInstance("filetree_layouts")
        };
    };
    ```

### 2. UI 层 (UI Layer)

#### [MODIFY] [app/src/config/ai/ai.ts](file:///d:/dev/siyuan-note/app/src/config/ai/ai.ts)
改造现有的 AI 配置面板，引入 Tab 分页机制。

-   **重构 `genHTML`**:
    -   增加 Tab 栏: `[OpenAI]` (保持原有后端配置), `[ModelScope]` (新增扩展配置)。
    -   增加容器: `<div id="modelscope-config-container">` 用于挂载 Vue 组件。
-   **重构 `bindEvent`**:
    -   实现 Tab 切换逻辑。
    -   在切换到 ModelScope Tab 时，动态挂载 `ModelScopeConfig.vue` 组件。

#### [NEW] [app/src/config/ai/ModelScopeConfig.vue](file:///d:/dev/siyuan-note/app/src/config/ai/ModelScopeConfig.vue)
基于 Vue 实现的 ModelScope 配置面板。

-   **组件结构**:
    1.  **认证配置区 (Authentication)**:
        -   使用 `getSForgeConfigs().ai.modelScope.auth`。
        -   即时切换不同的 Token 配置 (例如: "个人Key", "公司Key")。
    2.  **生成参数配置区 (Generation)**:
        -   使用 `getSForgeConfigs().ai.modelScope.text2image`。
        -   即时切换不同的生成预设 (例如: "快速预览-512x512", "高清生成-1024x1024")。
-   **交互逻辑**:
    -   下拉框选择当前的 Profile (显示 Active 状态)。
    -   **[新增]**: 创建新配置。
    -   **[删除]**: 删除当前配置。
    -   **[保存]**: 修改字段后自动保存或手动保存 (视体验优化而定)。

## 验证计划 (Verification Plan)

### 手动验证步骤

1.  **基础功能验证**:
    -   打开 `设置` -> `AI`，确认可以看到 `ModelScope` 标签页。
    -   点击进入，界面应正常渲染 Vue 组件。

2.  **配置隔离与持久化验证**:
    -   **认证配置**: 新建一个名为 "TestAuth" 的配置，填入 Token，保存。
    -   **生成配置**: 新建一个名为 "HD Gen" 的配置，修改分辨率为 1024x1024，保存。
    -   检查文件系统 `/data/storage/profiles/`：
        -   确认存在 `ai_modelscope_auth/` 目录，内含对应的 JSON 文件。
        -   确认存在 `ai_modelscope_text2image/` 目录，内含对应的 JSON 文件。

3.  **多配置切换验证**:
    -   新建第二个生成配置 "Draft Gen" (512x512)。
    -   在 UI 下拉框中在 "HD Gen" 和 "Draft Gen" 之间切换。
    -   确认下方的表单数值随之变化。
    -   重启软件/刷新页面，再次进入设置，确认上次选中的配置依然是激活状态。

4.  **SForge 访问器验证**:
    -   在控制台运行 `await getSForgeConfigs().ai.modelScope.auth.listProfiles()`，确认能获取到正确的数据列表。
