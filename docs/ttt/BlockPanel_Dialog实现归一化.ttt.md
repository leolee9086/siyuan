# BlockPanel 标准 Dialog 归一化

## 目标

将生产路径 `app/src/block/panel/Panel.ts` 的块引用浮层迁移到标准 `app/src/dialog` 的 `Dialog` 模型，同时保持思源现有交互、插件接口和布局兼容。

本任务不把块引用浮层简化成普通模态框。BlockPanel 必须继续支持：

- 目标元素或坐标定位，以及嵌套块引用浮层的层级关系；
- 固定/取消固定、点击提升层级、关闭和全局 ESC 清理；
- 多个引用编辑器、IntersectionObserver 懒加载和 ResizeObserver 同步；
- 块引用浮层内的 Protyle 子实例销毁、菜单清理和目标元素 cursor 恢复；
- Electron 新窗口/新页签动作与原插件调用路径。

## 兼容基线

- `window.siyuan.blockPanels` 继续暴露 `BlockPanel[]`，插件可以继续调用 `destroy()`、读取 `element`、`targetElement`、`editors` 和固定状态。
- `BlockPanel.element` 从自建根节点改为标准 `Dialog.containerElement`；原有 `block__popover` 类和 `data-level/data-oid/data-pin` 属性保留，Dialog 根节点仍由 `Dialog.element` 管理。
- 原有 `block__popover--open`、z-index、Resize 手柄和工具栏 data-type 协议保持兼容；实现可以迁移到 Dialog 的可选扩展能力。
- 不移动目标块 DOM，不改变 `popover__block` 触发协议和 `showPopover/hidePopover` 调用签名。
- `Dialog.destroy()` 必须成为唯一最终销毁入口；BlockPanel 只负责取消观察器、销毁子 Protyle 和清理兼容状态。

## 阶段计划

- [x] 扫描 `Dialog` 当前构造、定位、拖拽缩放、销毁和子编辑器能力，形成缺口清单。
- [x] 为 Dialog 增加可选的根类/数据属性、非模态遮罩开关、Dialog 栈注册开关、稳定的 `rootElement/containerElement/bodyElement` 内容入口、`bringToFront()` 层级同步和幂等销毁；不改变已有 Dialog 调用方默认行为。
- [x] 将 BlockPanel 的 HTML/观察器/编辑器初始化接入 Dialog body，保留原 `BlockPanel` 公共属性和方法。
- [x] 统一固定、层级、ESC、菜单清理和子 Protyle 销毁协议；BlockPanel 只保留业务层级/内容编排，Dialog 承担根节点、拖拽缩放和最终 DOM 生命周期。
- [ ] 增加 DOM/浏览器契约测试：创建、定位、嵌套、固定、关闭、目标移除、懒加载和子编辑器销毁。
- [ ] 兼容验证通过后处理 `app/src/block/Panel.ts` 顶层 legacy 重复实现。

## 当前发现

- 生产路径是 `app/src/block/panel/Panel.ts`；`app/src/block/Panel.ts` 是未发现调用方的旧版重复实现。
- 迁移前 BlockPanel 直接 `document.createElement`、插入 `document.body`，并自行处理 `block__popover`、层级、定位、Resize 和销毁；当前生产实现已将根节点、Resize 和最终 DOM 生命周期交给 Dialog。
- 当前 Dialog 已提供统一 DOM 生命周期、拖拽调整大小、ESC/遮罩关闭、监听器 AbortSignal 清理和销毁回调；本阶段补齐了块引用浮层所需的非模态配置、根节点扩展属性和稳定内容入口。目标定位、嵌套层级和固定状态仍由 BlockPanel 业务逻辑维护，避免把块引用语义错误塞进通用 Dialog。
- BlockPanel 的异步块信息响应和 IntersectionObserver 初始化现在检查销毁状态及 DOM 连接状态；销毁时先断开观察器、清空捕获的编辑器数组、清理内容和交互监听，再调用 Dialog 的最终销毁入口。

## 验收

- 完整 App 原有块引用浮层行为无回归，插件仍能通过 `window.siyuan.blockPanels` 工作。
- `BlockPanel` 生产实现不再直接把根节点插入 `document.body`，不再自行实现 Dialog 级销毁/关闭协议。
- Dialog 的增强能力全部可选，普通 Dialog 的默认行为和现有调用方不变。
- `pnpm run typecheck:protyle-contract`、相关浏览器测试和 `git diff --check` 通过。

## 当前实现记录（2026-07-15）

- 生产路径 `app/src/block/panel/Panel.ts` 已使用标准 `Dialog` 作为根容器；`BlockPanel.element` 继续指向 Dialog container，以保持原插件和 `window.siyuan.blockPanels` 兼容，内容写入 `Dialog.bodyElement`。
- `app/src/block/Panel.ts` 顶层 legacy 重复实现暂不删除，待完整 App 和插件兼容性验证完成后处理。
- `pnpm run typecheck:protyle-contract` 与 `pnpm run build:app` 已通过；当前浏览器测试配置直接导入完整 Dialog 会触发既有 `.vue` 解析限制，契约测试需先补齐 Vue 编译插件或改用构建产物测试。
