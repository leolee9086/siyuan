# 思源笔记插件加载机制详解

## 概述

思源笔记采用了一套完整的插件系统，允许开发者扩展笔记功能。本文档详细介绍了思源笔记插件的加载机制、生命周期和API接口，帮助开发者更好地理解和开发插件。

注意由于我的环境经过定制,所以以下内容仅供参考,跟官方版本存在差异的地方我会尽可能说明,但还是不一定准确

## 插件系统架构

### 核心组件

思源笔记插件系统主要由以下几个核心组件构成：

1. **插件加载器** (`app/src/plugin/loader.ts`)
   - 负责发现、加载和管理插件
   - 处理插件的注册、初始化和卸载

2. **插件基类** (`app/src/plugin/index.ts`)
   - 定义插件的基本结构和生命周期方法
   - 提供插件与主应用交互的接口

3. **API接口** (`app/src/plugin/API.ts`)
   - 提供给插件的API集合
   - 允许插件访问思源笔记的核心功能

4. **事件总线** (`app/src/plugin/EventBus.ts`)
   - 处理插件间和插件与主应用间的通信

## 插件加载流程

### 1. 应用初始化阶段

在 [`app/src/index.ts`](app/src/index.ts:190) 中，应用初始化时会调用 [`loadPlugins(this)`](app/src/index.ts:190) 加载所有插件：

```typescript
fetchPost("/api/system/getConf", {}, async (response) => {
    // ... 其他初始化代码
    window.siyuan.config = response.data.conf;
    // ...
    await loadPlugins(this); // 加载插件
    // ...
});
```

### 2. 获取插件列表

插件加载器通过 [`/api/petal/loadPetals`](app/src/plugin/loader.ts:31) API 从服务器获取插件列表：

```typescript
export const loadPlugins = async (app: App, names?: string[]) => {
    const response = await fetchSyncPost("/api/petal/loadPetals", {frontend: getFrontend()});
    // response.data 包含所有插件的元数据和代码
    // ...
};
```

每个插件的数据结构包含：
- `name`: 插件名称
- `displayName`: 显示名称
- `js`: 插件的JavaScript代码
- `css`: 插件的样式代码（可选）
- `i18n`: 国际化数据

### 3. 插件代码执行

在 [`loadPluginJS`](app/src/plugin/loader.ts:50) 函数中，每个插件的代码被独立执行：

```typescript
const loadPluginJS = async (app: App, item: IPluginData) => {
    const exportsObj: { [key: string]: any } = {};
    const moduleObj = {exports: exportsObj};
    
    try {
        // 使用特殊的require函数执行插件代码
        runCode(item.js, "plugin:" + encodeURIComponent(item.name))(requireFunc, moduleObj, exportsObj);
    } catch (e) {
        console.error(`plugin ${item.name} run error:`, e);
        return;
    }
    
    // 获取插件类
    const pluginClass = (moduleObj.exports || exportsObj).default || moduleObj.exports;
    // ...
};
```

#### 特殊require机制

插件中的 `require` 被特殊处理，提供对思源API的访问：

```typescript
const requireFunc = (key: string) => {
    const modules = {
        siyuan: API // 将思源API暴露给插件
    };
    // @ts-ignore
    return modules[key] ?? window.require?.(key);
};
```

这意味着插件可以通过 `require("siyuan")` 访问思源笔记的API。

### 4. 插件实例化

插件代码执行后，加载器会实例化插件类：

```typescript
// 验证插件类
if (typeof pluginClass !== "function") {
    console.error(`plugin ${item.name} has no export`);
    return;
}
if (!(pluginClass.prototype instanceof Plugin)) {
    console.error(`plugin ${item.name} does not extends Plugin`);
    return;
}

// 创建插件实例
const plugin = new pluginClass({
    app,
    displayName: item.displayName,
    name: item.name,
    i18n: item.i18n
});

// 添加到应用插件列表
app.plugins.push(plugin);
```

### 5. 插件生命周期调用

实例化后，插件的生命周期方法被依次调用：

```typescript
try {
    await plugin.onload(); // 插件加载完成
} catch (e) {
    console.error(`plugin ${item.name} onload error:`, e);
}
```

随后，在布局准备就绪后调用：

```typescript
// 在 afterLoadPlugin 函数中
try {
    plugin.onLayoutReady(); // 布局准备就绪
} catch (e) {
    console.error(`plugin ${item.name} onLayoutReady error:`, e);
}
```

### 6. 样式注入

插件的CSS通过动态创建的 `<style>` 标签注入到页面：

```typescript
if (item.css) {
    css += `<style id="pluginsStyle${item.name}">${item.css}</style>`;
}

// 将样式插入到文档头部
const pluginsStyle = document.getElementById("pluginsStyle");
if (pluginsStyle) {
    pluginsStyle.insertAdjacentHTML("afterend", css);
} else {
    document.head.insertAdjacentHTML("beforeend", css);
}
```

## 插件生命周期

### 1. 构造函数

插件类必须继承自 `Plugin` 基类，构造函数接收以下参数：

```typescript
constructor(options: {
    app: App,           // 应用实例
    name: string,        // 插件名称
    displayName: string,  // 显示名称
    i18n: IObject      // 国际化数据
})
```

### 2. onload()

插件加载完成后调用，是插件执行初始化逻辑的地方：

```typescript
public onload() {
    // 插件初始化代码
    // 添加UI元素、注册事件监听器等
}
```

### 3. onLayoutReady()

布局准备就绪后调用，此时可以安全地操作DOM元素：

```typescript
public onLayoutReady() {
    // 布局相关的初始化代码
    // 添加顶栏按钮、状态栏图标等
}
```

### 4. onunload()

插件被禁用或卸载时调用，用于清理资源：

```typescript
public onunload() {
    // 清理事件监听器、移除UI元素等
}
```

### 5. uninstall()

插件被卸载时调用，用于永久性清理：

```typescript
public uninstall() {
    // 永久性清理，如删除存储的数据
}
```

## 插件API接口

思源笔记为插件提供了丰富的API接口，通过 `require("siyuan")` 访问：

### 核心API

- `fetchPost`: 发送POST请求到思源后端
- `fetchSyncPost`: 同步发送POST请求
- `fetchGet`: 发送GET请求
- `Constants`: 访问思源常量
- `showMessage`/`hideMessage`: 显示/隐藏消息
- `confirm`: 显示确认对话框

### UI相关API

- `openTab`: 在新标签页中打开内容
- `openWindow`: 在新窗口中打开内容
- `addTopBar`: 添加顶栏按钮
- `addStatusBar`: 添加状态栏图标
- `addDock`: 添加侧边栏面板

### 编辑器API

- `Protyle`: 访问编辑器类
- `getAllEditor`: 获取所有编辑器实例
- `getActiveEditor`: 获取当前活动的编辑器

### 数据存储API

- `loadData`: 加载插件存储的数据
- `saveData`: 保存插件数据
- `removeData`: 删除插件数据

