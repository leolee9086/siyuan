# Protyle WYSIWYG 领域根与事件编排拆分

## 最终目标

在保持编辑区 DOM、输入法、选择、剪贴板、AV、媒体与上下文菜单行为不变的前提下，使 WYSIWYG 具体 class 只在创建、组合和契约校验边界出现；下层模块及全局 Protyle 数据结构统一依赖完整 WYSIWYG 领域根，并逐步拆分 375 行事件编排组合根。

## 当前目标

- [x] 登记 WYSIWYG 完整公共实例表面。
- [x] 建立单一 `WYSIWYGDomain`、模块级 Symbol 厂牌和独立双向契约。
- [x] 将只操作 DOM 的自定义属性渲染参数化为 `HTMLDivElement`，清除对具体 WYSIWYG class 的类型回边。
- [x] 将 `IProtyle.wysiwyg` 改为完整领域根，停止传播具体实现类型。
- [ ] 为输入、鼠标、选择与上下文菜单生命周期补齐行为基线。

## 下一步任务

1. 固定输入法组合事件、pending input 调度和输入抑制行为。
2. 按输入、选择和媒体交互的真实状态所有权拆分事件编排，不创建调用点碎片接口。
3. 每批复算代表环和 Tarjan SCC，并记录仍然存在的运行时返回路径。

## 不变量

- `WYSIWYGDomain` 必须覆盖 WYSIWYG class 的完整公共实例表面，并由 `PublicInstanceLooksLike` 双向校验。
- 不为 `renderCustomWithCtx` 创建只含 `element` 的局部接口。
- 不使用 `unknown`、断言、动态导入、事件转发、回调 Port、工厂闭包或服务定位器隐藏依赖。
- DOM 事件注册顺序、同步阻止默认行为、输入法状态和 pending input 生命周期保持不变。
- 所有 `imports.ts` 保留并继续参与循环与多跳扫描。

## 现状基线

- `app/src/protyle/wysiwyg/index.ts` 为 375 行具体 class 与事件组合根。
- `index.input.ts` 依赖 `utils/rendercustomWithCtx.ts`，后者反向导入具体 WYSIWYG 类型，形成三节点环。
- `IProtyle.wysiwyg` 直接引用具体 class，使实现类型传播到所有编辑器调用方。
- 阶段开始时源码节点 `2200`，代表环 `421`，唯一 SCC `676`，imports 网关多跳 `0`。

## 目标架构

- `wysiwyg/domain/wysiwyg.types.ts`：完整公共领域根与稳定身份。
- `wysiwyg/index.ts`：具体状态、事件生命周期与子职责组合；纯 DOM 渲染只传递其真实输入元素。
- 下层渲染、输入和编辑器数据结构：只依赖完整领域根。
- `app/test/protyle/WYSIWYGDomain.contract.test.ts`：独立证明抽象与具体 class 公共表面双向等价。

## 近期计划

- [x] 完整领域根、厂牌与契约校验。
- [x] 解除自定义属性渲染具体类型回边。
- [ ] 补齐事件行为测试并拆分下一层职责。

## 中期计划

- 输入调度状态和组合输入生命周期归入明确所有者。
- 鼠标选择、AV 操作、媒体操作和上下文菜单按真实领域拆分，组合根只负责装配顺序。

## 远期计划

- WYSIWYG 具体 class 仅存在于创建、组合和契约校验边界。
- WYSIWYG 子图退出主 SCC，并与 Protyle 领域根专项共同归档。

## 风险

- 输入法 composition 事件、光标恢复和同步事件阻止顺序容易产生行为漂移。
- 鼠标事件共享 `preventClick/preventInput/inputScheduler`，过早拆分会形成参数袋或隐式状态。
- 只清除类型回边不会自动移除 AV、菜单和移动编辑器的运行时长链。

## 验收标准

- 具体 WYSIWYG 类型回边归零，全局编辑器结构依赖完整领域根。
- 双向契约、目标类型检查、Node 测试、lint、imports 网关检查与 diff 校验通过。
- 每个事件职责拆分均有行为证据并记录图指标。

## 已归档/已完成区域

- **2026-07-27**：建立专项 TTT 和完整 WYSIWYG 领域根。初次类型验证发现 BlockPanel 测试以只有 `element` 的浅对象冒充完整编辑区；现新增满足完整领域根的测试夹具，并补齐既有 Protyle 测试夹具遗漏的 `zoomOut()` 完整契约。自定义属性渲染本质只操作 DOM，不强制接收完整领域对象，改为显式传递 `HTMLDivElement`，其 IAL 输入收紧为唯一调用方真实提供的 `Record<string, string>`。`IProtyle.wysiwyg` 统一依赖完整领域根，具体 class 类型回边归零。目标类型诊断 `0`，Node `181/181`、BlockPanel Vitest `1/1`、imports 多跳和 diff 校验通过；旧渲染文件仍有既存条件注释与多参数 lint 诊断。源码节点 `2201`，代表环 `421 -> 420`，唯一 SCC `676 -> 675`，原 `WYSIWYG -> index.input -> rendercustomWithCtx` 三节点环消失。
