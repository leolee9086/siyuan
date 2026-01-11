# 设置面板 Tab 化改进计划

## 背景

思源笔记现有设置面板采用**模态 Dialog** 实现。哥哥尝试将**文档树配置**作为普通 Tab 打开，但采用了"伪造 Plugin"的 hack 方式实现。

---

## 架构决策

> [!IMPORTANT]
> **采用扩展点 + 插件 API 两层架构**

```
┌─────────────────────────────────────────────┐
│           扩展点层 (Extension Points)        │  ← 内部使用
├─────────────────────────────────────────────┤
│  TabRegistry                                 │  Tab 扩展点
│  DockRegistry（已存在）                       │  侧边栏扩展点
│  CommandRegistry                             │  命令扩展点
└─────────────────────────────────────────────┘
                    ↑ 封装
                    ↓
┌─────────────────────────────────────────────┐
│           插件层 (Plugin API)                │  ← 外部插件使用
├─────────────────────────────────────────────┤
│  plugin.addTab()      →  TabRegistry        │
│  plugin.addDock()     →  DockRegistry       │
│  plugin.addCommand()  →  CommandRegistry    │
└─────────────────────────────────────────────┘
```

### 重要发现：Dock 系统已有成熟模式

> [!TIP]
> 哥哥已在 Dock 系统中实现了 Registry + Factory 模式，可直接复用！

| 文件 | 说明 |
|------|------|
| [dock.registry.ts](file:///d:/dev/siyuan-note/app/src/layout/dock/dock.registry.ts) | 类型占用注册表（解决多 Dock 实例去重） |
| [dock.factory.ts](file:///d:/dev/siyuan-note/app/src/layout/dock/dock.factory.ts) | Model 工厂（内置类型 → 特殊前缀 → 插件回退） |

**dock.factory.ts 的模式**：
```typescript
const MODEL_FACTORIES: Record<string, ModelFactory> = {
    file: initFile,
    bookmark: initBookmark,
    // ...内置类型
};

export const createModel = (options) => {
    // 1. 先查内置工厂
    const factory = MODEL_FACTORIES[options.type];
    if (factory) return factory(...);
    
    // 2. 回退到插件遍历
    return initPlugin(app, tab, type);
};
```

---

## 现有实现分析

### 现有 Plugin API 结构

```typescript
// plugin/index.ts
class Plugin {
    models: { [type: string]: ModelFactory } = {};   // Tab 工厂函数
    docks: { [type: string]: DockConfig } = {};      // Dock 配置和工厂
    commands: ICommand[] = [];                        // 命令列表
    
    addTab(options) {
        const type2 = this.name + options.type;       // 类型 = 插件名+类型
        this.models[type2] = (arg) => new Custom(...);
    }
    
    addDock(options) {
        const type2 = this.name + options.type;
        this.docks[type2] = { config, model: ... };
    }
}
```

### 数据分散问题

- **无全局 Registry**：Tab/Dock 数据分散在 `app.plugins[i].models` 和 `app.plugins[i].docks`
- **查找需遍历**：`layout/util.ts` 中 `newModelByInitData` 需遍历所有插件查找 model
- **内部使用困难**：必须创建假 Plugin 才能注册 Tab

```typescript
// layout/util.ts L695-703 - 查找 Custom Tab 的 model
app.plugins.find(item => {
    if (item.models[json.customModelType]) {
        model = item.models[json.customModelType]({ tab, data });
        return true;
    }
});
```

---

## 详细设计

### 1. TabRegistry

```typescript
// app/src/layout/registry/TabRegistry.ts

interface TabRegistration {
    type: string;                    // 唯一类型标识
    init: (model: Custom) => void;   // 初始化函数
    destroy?: () => void;
    beforeDestroy?: () => void;
    resize?: () => void;
    update?: () => void;
}

class TabRegistry {
    private static instance: TabRegistry;
    private tabs: Map<string, TabRegistration> = new Map();
    
    static getInstance(): TabRegistry {
        if (!TabRegistry.instance) {
            TabRegistry.instance = new TabRegistry();
        }
        return TabRegistry.instance;
    }
    
    /**
     * 注册 Tab 类型（内部使用）
     * @param registration Tab 注册配置
     */
    register(registration: TabRegistration): void {
        this.tabs.set(registration.type, registration);
    }
    
    /**
     * 获取 Tab 注册信息
     */
    get(type: string): TabRegistration | undefined {
        return this.tabs.get(type);
    }
    
    /**
     * 检查类型是否已注册
     */
    has(type: string): boolean {
        return this.tabs.has(type);
    }
    
    /**
     * 创建 Custom Model 实例
     */
    createModel(options: {
        app: App;
        tab: Tab;
        type: string;
        data: any;
    }): Custom | null {
        const registration = this.tabs.get(options.type);
        if (!registration) return null;
        
        return new Custom({
            app: options.app,
            tab: options.tab,
            type: options.type,
            data: options.data,
            init: registration.init,
            destroy: registration.destroy,
            beforeDestroy: registration.beforeDestroy,
            resize: registration.resize,
            update: registration.update,
        });
    }
}

export const tabRegistry = TabRegistry.getInstance();
```

### 2. 重构 Plugin.addTab

```typescript
// plugin/index.ts - 修改后
import { tabRegistry } from "../layout/registry/TabRegistry";

class Plugin {
    public addTab(options: TabOptions) {
        const type = this.name + options.type;
        
        // 委托给 TabRegistry
        tabRegistry.register({
            type,
            init: options.init,
            destroy: options.destroy,
            beforeDestroy: options.beforeDestroy,
            resize: options.resize,
            update: options.update,
        });
        
        // 保持兼容：同时存储在 this.models（供 getOpenedTab 使用）
        this.models[type] = (arg: { data: any, tab: Tab }) => {
            return tabRegistry.createModel({
                app: this.app,
                tab: arg.tab,
                type,
                data: arg.data,
            });
        };
        
        return this.models[type];
    }
}
```

### 3. 重构 newModelByInitData

```typescript
// layout/util.ts - 修改后
import { tabRegistry } from "./registry/TabRegistry";

export const newModelByInitData = (app: App, tab: Tab, json: any) => {
    if (json.instance === "Custom") {
        // 优先从全局 Registry 查找
        if (tabRegistry.has(json.customModelType)) {
            return tabRegistry.createModel({
                app,
                tab,
                type: json.customModelType,
                data: json.customModelData,
            });
        }
        
        // 回退：遍历插件（兼容旧插件）
        // ...原有逻辑
    }
    // ...
};
```

### 4. 内部 Tab 注册示例

```typescript
// config/fileTree.ts - 修改后（删除伪造 Plugin）
import { tabRegistry } from "../layout/registry/TabRegistry";
import fileTreeConfigPanel from "../components/panels/fileTreeConfig.panel.vue";
import { createApp } from "vue";

// 直接注册，无需伪造 Plugin
tabRegistry.register({
    type: "internal-settings-filetree",
    init: (model: Custom) => {
        const app = createApp(fileTreeConfigPanel);
        app.mount(model.tab.panelElement);
    }
});

// 打开方式
openFile({
    app: window.siyuan.ws.app,
    custom: {
        title: "文档树设置",
        icon: "#iconFiles",
        id: "internal-settings-filetree"  // 直接使用 type，无需拼接
    }
});
```

---

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `app/src/layout/registry/TabRegistry.ts` | Tab 扩展点注册表 |
| `app/src/layout/registry/DockRegistry.ts` | Dock 扩展点注册表（后续） |
| `app/src/layout/registry/CommandRegistry.ts` | Command 扩展点注册表（后续） |
| `app/src/layout/registry/index.ts` | 统一导出 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `app/src/plugin/index.ts` | `addTab` 委托给 TabRegistry |
| `app/src/layout/util.ts` | `newModelByInitData` 优先查 Registry |
| `app/src/config/fileTree.ts` | 删除伪造 Plugin，直接用 Registry |

---

## 实施阶段

### 阶段一：TabRegistry 📋 待实现

1. [ ] 创建 `TabRegistry` 类
2. [ ] 修改 `Plugin.addTab` 委托给 Registry
3. [ ] 修改 `newModelByInitData` 优先查 Registry
4. [ ] 重构 `fileTree.ts` 使用新方式

### 阶段二：扩展 Registry（后续）

1. [ ] 创建 `DockRegistry`
2. [ ] 创建 `CommandRegistry`
3. [ ] 统一所有内部 Tab 注册

---

## 参考文件

| 文件 | 说明 |
|------|------|
| [plugin/index.ts](file:///d:/dev/siyuan-note/app/src/plugin/index.ts#L352-382) | `addTab` 现有实现 |
| [layout/util.ts](file:///d:/dev/siyuan-note/app/src/layout/util.ts#L685-724) | `newModelByInitData` |
| [layout/dock/Custom.ts](file:///d:/dev/siyuan-note/app/src/layout/dock/Custom.ts) | Custom Model 类 |
| [config/fileTree.ts](file:///d:/dev/siyuan-note/app/src/config/fileTree.ts#L190-219) | 现有伪造 Plugin 实现 |
