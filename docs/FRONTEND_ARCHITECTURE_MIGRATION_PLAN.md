# 前端架构渐进式迁移计划 (Frontend Architecture Progressive Migration Plan)

本计划旨在为 **S-forge** (基于思源笔记内核构建的独立前端发行版) 建立一套全新的、去中心化的前端架构。

S-forge 的核心理念是：
1.  **Backend as a Service (BaaS), Frontend as a Platform**.
2.  **Asset-Centric (资产中心主义)**: 附件（Assets）与笔记（Notes）具有同等重要性。必须具备**任意文件缩略图生成**能力，弥补后端（Headless CMS）当前能力的缺失。
3.  **Pragmatic Native Integration (务实的原生集成)**: 对于缩略图等重型任务，优先调用 OS 原生能力（如 Windows Explorer/macOS Finder API），而非在前端通过 WASM 强行渲染。

通过将目前散落在 `config/` 目录下的“虚拟插件”（如 `fileTree`, `image`）迁移至标准的 `internal-plugins` 目录，并统一由 `App` 类进行加载管理，我们旨在证明并实现以下愿景：
1.  **内核复用**：前端只是内核的一个"皮肤"，任何遵循 API 规范的前端都可以替换官方前端。
2.  **彻底解耦**：Protyle 编辑器等核心组件应具备独立分发能力。

## 架构定义 (Architecture Definitions)

### 前端核心层 (Frontend Core Layer)
> 核心层仅包含应用的基础设施和生命周期管理，**不应包含**具体的业务功能实现（如 Protyle 编辑器）。

核心层主要职责包括：
- **Infrastructure**: Layout, Dock, Menus, Dialogs, Kernel API 通信.
- **Initialization**: `window.siyuan` 全局对象初始化, 语言环境加载.
- **Plugin System**: 插件加载、生命周期管理、API 暴露.
### 接口隔离策略 (Interface Isolation Strategy) [NEW]
为不仅在逻辑上，更在**代码物理层面**强制实现解耦，我们将采用**孤岛导入** (Island Imports) 策略。
此策略参考 `toread/0_lints/strict-import.ts` 规则，强制所有核心组件（如 Protyle）必须：
1.  **禁止越级访问**：禁止直接 `import ../` 访问父级或兄弟模块。
2.  **单一出入口**：所有对外依赖必须通过本地 `imports.ts` 显式转发。
3.  **禁止隐式依赖**：禁止直接导入第三方库，必须通过 Shell 层注入或统一接口层获取。

### 依赖分析与解耦方法论 (Dependency Analysis & Decoupling Methodology) [NEW]
为确保重构过程的安全性和可控性，我们将遵循 **"显式化 -> 分析 -> 解耦"** 的严格流程：
1.  **集中 (Centralize)**: 在重构任何模块前，先创建本地 `imports.ts`，将该模块所有对外部的依赖（父级导入、全局对象访问）全部收敛于此。
2.  **分析 (Analyze)**: 通过检查 `imports.ts`，清晰地看到该模块的"耦合触角"，识别不合理的依赖（如直接操作 DOM、隐式状态依赖）。
3.  **解耦 (Decouple)**: 针对识别出的不合理依赖进行重构，使用标准 Plugin API 替代硬编码逻辑。

### 规约完成标志 (Standardization Success Criteria) [NEW]
规约步骤（及其通过 Lint 强制执行）被视为完成的**唯一**客观标准是：
1.  **零报错**: 目标模块（如 `internal-plugins/file-tree`）在启用 `strict-import` 规则下，无任何 Lint 报错。
2.  **零豁免**: 代码中**不包含**任何 `// eslint-disable` 或 `// @ts-ignore` 用于绕过导入规则的注释。
3.  **全收敛**: 该模块目录下存在 `imports.ts`，且模块内所有对外引用均来自此文件。

### 插件层 (Plugin Layer) (本次迁移重点)
所有具体的业务功能模块应尽可能作为插件实现。
- **Internal Plugins**: `FileTree`, `Image/Assets`.
- **Future Goals**:  将 `Protyle` 编辑器彻底解耦为独立插件。目标是使其能够脱离核心层的 Tab/Layout 系统，在任意支持前端技术栈的环境中复用（作为单纯的块编辑器组件）。
- **Community Plugins**: 第三方扩展.

## 核心目标

1.  **统一架构**：所有功能模块（核心/内置/社区）皆为插件。
2.  **降低耦合**：移除 `config/*.ts` 中的副作用代码（自动注册插件的代码），明确核心层与功能层的边界。
3.  **标准化**：内置插件应遵循与社区插件相同的接口规范 (`Plugin` 类)。

## 技术详情 (Technical Details)

内置插件将继承现有的 `Plugin` 类 (位于 `app/src/plugin/index.ts`)，并被放置在 `app/src/internal-plugins/` 目录下。

### 目录结构 (Directory Structure)

```text
app/src/
├── internal-plugins/           # [NEW] 存放所有内置插件
│   ├── index.ts                # [DELETE] 移除，不需要统一导出
│   ├── file-tree/              # [NEW] 文档树插件
│   │   └── index.ts
│   ├── image/                  # [NEW] 图片/资源管理插件
│   │   └── index.ts
│   └── thumbnail/              # [NEW] 缩略图生成/管理插件 (Asset-Centric Core)
│       └── index.ts
├── config/
│   ├── fileTree.ts             # [MODIFY] 仅保留配置数据，移除插件注册逻辑
│   └── image.ts                # [MODIFY] 仅保留配置数据，移除插件注册逻辑
└── index.ts                    # [MODIFY] App 类加载 internal-plugins
```

### 后端能力依赖 (Backend Capability Requirements) [NEW]
为支撑前端的 **Asset-Centric** 理念，Go 后端必须实现以下能力：
1.  **原生缩略图生成**:
    *   **目标**: 移除对外部 C# 进程的依赖，实现单二进制文件分发。
    *   **Windows**: 使用 Go `syscall` 或 `cgo` 直接调用 `IShellItemImageFactory` (COM 接口)，获取系统资源管理器级别的缩略图。
    *   **macOS**: 使用 `cgo` 调用 `QuickLook` 框架。
    *   **Linux**: 遵循 freedesktop.org 规范调用缩略图生成器。

### 核心加载策略：显式静态初始化 (Core Loading Strategy: Explicit Static Initialization) [NEW]
基于 **"显式优于隐式" (Explicit is better than Implicit)** 原则，我们将**放弃**最初设计的使用 `internalPlugins` 数组进行统一遍历加载的方案。

核心插件（Internal Plugins）是 S-forge 系统的**基础设施**，它们的加载顺序至关重要且固定的。隐藏在循环中的加载逻辑会模糊依赖关系。

**新方案**：
在 `App` 初始化流程中，**直接编写**硬编码的加载顺序，明确每一个核心插件的启动时机。

```typescript
// app/src/index.ts
import { FileTreePlugin } from "./internal-plugins/file-tree";
import { ImagePlugin } from "./internal-plugins/image";
import { ThumbnailPlugin } from "./internal-plugins/thumbnail";

// ... Inside App class ...
private async initCore() {
    // 0. 显式初始化 Thumbnail Service (作为基础能力，可能被 FileTree/Image 依赖)
    this.thumbnailManager = new ThumbnailPlugin(this.options);
    await this.thumbnailManager.onload();

    // 1. 显式初始化 FileTree
    this.fileTree = new FileTreePlugin(this.options);
    await this.fileTree.onload();

    // 2. 显式初始化 Image Manager
    this.imageManager = new ImagePlugin(this.options);
    await this.imageManager.onload();

    // ... 其他核心模块显式加载 ...

    // 3. 最后才加载不确定的第三方插件
    await this.loadCommunityPlugins();
}
```

社区插件保持原有的动态扫描及加载机制。

### 接口隔离策略 (Interface Isolation Strategy) [NEW]

### 第二阶段：FileTree 插件迁移 (Phase 2: FileTree Migration)

`FileTree` 将从 `config/fileTree.ts` 的隐式注册变为显式插件类。

1.  **新建 `app/src/internal-plugins/file-tree/index.ts`**
    ```typescript
    import { Plugin } from "../../plugin";
    import { Custom } from "../../layout/dock/Custom";
    import fileTreeConfigPanel from "../../components/panels/fileTreeConfig.panel.vue";
    import { createApp } from "vue";
    import { fileTree } from "../../config/fileTree"; // 暂时引用旧配置对象以获取 genHTML 等（如果需要）

    export class FileTreePlugin extends Plugin {
        static displayName = "文档树内部插件";
        static name = "internal-plugin-filetree";

        constructor(options) {
             super({ ...options, name: FileTreePlugin.name, displayName: FileTreePlugin.displayName });
        }

        onload() {
            this.addTab({
                type: "internal-filetree",
                init: (model: Custom) => {
                    const tab = model.tab;
                    const app = createApp(fileTreeConfigPanel);
                    if (tab) {
                        app.mount(tab.panelElement);
                    }
                }
            });
        }
    }
    ```

2.  **注册插件**
    更新 `app/src/internal-plugins/index.ts` 导出 `FileTreePlugin`。

3.  **清理 `app/src/config/fileTree.ts`**
    - 删除底部的 `plugin = new Plugin(...)` 和 `document.addEventListener("app-ready", ...)` 代码。
    - **保留** `export const fileTree = { ... }` 如果它被作为配置仓库使用。
    - 确保没有副作用代码执行。

### 第三阶段：Image 插件迁移 (Phase 3: Image Migration)

`Image` 插件依赖手动 DOM 操作，逻辑将直接迁移到插件类的方法中。

1.  **新建 `app/src/internal-plugins/image/index.ts`**
    ```typescript
    import { Plugin } from "../../plugin";
    import { image } from "../../config/image"; // 引用旧逻辑

    export class ImagePlugin extends Plugin {
        static displayName = "资源管理内部插件";
        static name = "internal-plugin-image";

        constructor(options) {
             super({ ...options, name: ImagePlugin.name, displayName: ImagePlugin.displayName });
        }

        onload() {
            // 注册主资源页签
            this.addTab({
                type: "internal-image",
                init: (model: Custom) => {
                    const tab = model.tab;
                    if (tab) {
                        tab.panelElement.innerHTML = image.genHTML();
                        image.bindEvent(tab.panelElement);
                    }
                }
            });
            // 注册未引用/丢失资源页签... (逻辑同上，复用 image.ts 中的辅助函数)
        }
    }
    ```

2.  **注册插件**
    更新 `app/src/internal-plugins/index.ts` 导出 `ImagePlugin`。

3.  **清理 `app/src/config/image.ts`**
    - 删除底部的 `plugin = new Plugin(...)` 和 `document.addEventListener("app-ready", ...)` 代码。
    - 此时 `image.ts` 变为纯粹的函数库供 `ImagePlugin` 调用。

### 第四阶段：验证与清理 (Phase 4: Verification & Cleanup)

1.  **验证清单**
    - [ ] 启动 App，检查控制台无报错。
    - [ ] 检查设置 -> 插件管理（如果显示内部插件）或直接检查功能。
    - [ ] 打开文档树配置面板。
    - [ ] 打开资源管理面板。

2.  **后续优化**
    - 将 `config/image.ts` 中的 `genHTML` 等视图逻辑彻底移动到 `ImagePlugin` 类或许 Vue 组件中，完全废弃 `config/image.ts` 的视图部分，只保留纯配置。

## 变更文件概览

#### [NEW] [app/src/internal-plugins/index.ts](file:///d:/dev/siyuan-note/app/src/internal-plugins/index.ts)
#### [NEW] [app/src/internal-plugins/file-tree/index.ts](file:///d:/dev/siyuan-note/app/src/internal-plugins/file-tree/index.ts)
#### [NEW] [app/src/internal-plugins/image/index.ts](file:///d:/dev/siyuan-note/app/src/internal-plugins/image/index.ts)
#### [MODIFY] [app/src/index.ts](file:///d:/dev/siyuan-note/app/src/index.ts)
#### [MODIFY] [app/src/config/fileTree.ts](file:///d:/dev/siyuan-note/app/src/config/fileTree.ts)
#### [MODIFY] [app/src/config/image.ts](file:///d:/dev/siyuan-note/app/src/config/image.ts)
