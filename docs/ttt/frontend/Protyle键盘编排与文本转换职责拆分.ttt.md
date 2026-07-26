# Protyle 键盘编排与文本转换职责拆分（TikTocTak）

> **最终目标**：在保持 Protyle 键盘事件顺序、中止语义、快捷键行为和公开导入语义不变的前提下，将 `wysiwyg/keydown.ts` 的内容转换、上下文构造与中间件调度职责拆成单向子域，使键盘子模块不再反向加载编排根。
>
> **当前目标**：迁移 `getContentByInlineHTML` 的唯一实现，消除 `keydown.ts <-> keydown.attr/copy.ts` 两条最短直接环。
>
> **下一步任务**：根据迁移后的最短路径审计 577 行键盘监听器中的事件驱动、上下文构造和中间件执行职责，建立行为基线后继续拆分。

## 不变量

- 不改变中间件注册及执行顺序、AbortController 原因、事件冒泡或默认行为。
- 不通过动态导入、事件转发、回调 Port 或复制函数隐藏循环。
- `imports.ts` 必须直达真实声明或唯一实现，不串联其它 imports 网关。
- 文本转换保持 Range 克隆、文本节点拼接、元素 outerHTML、`/api/block/getDOMText` 请求及回调时序不变。
- 旧公开导出可静态指向同一实现，但生产消费方应直达真实职责所有者。

## 现状基线

- `app/src/protyle/wysiwyg/keydown.ts` 共 `577` 行，聚合 40 余个键盘中间件与编辑器、布局、菜单和网络能力。
- `getContentByInlineHTML` 位于编排根，`keydown.attr.ts` 与 `keydown.copy.ts` 为调用该函数反向加载根，形成两条两节点环。
- 外部消费还包括全局 keydown 与 `editKeydown/imports.ts`；后者作为 imports 网关必须直达迁移后的唯一实现。
- 本任务建立前全源码为 `2195` 个节点、`500` 条代表环、唯一 SCC `680`。

## 目标架构

```text
keydown.ts -> keydown middleware
keydown.attr/copy -> keydown/content/getContentByInlineHTML
global keydown -> keydown/content/getContentByInlineHTML
editKeydown/imports.ts -> keydown/content/getContentByInlineHTML
keydown/content/imports.ts -> util/network/fetch
```

## 近期计划

- [x] 新建内容转换子域及直达 imports 网关。
- [x] 将所有生产消费方改为直达唯一实现。
- [x] 在旧 keydown 入口保留同身份静态导出。
- [x] 验证两条直接环归零、Node、类型、lint 和网关门禁。

## 中期计划

- [ ] 为键盘事件上下文和中间件执行顺序建立可测试基线。
- [ ] 拆分监听器中的事件驱动、状态记录与中间件调度职责。
- [ ] 让叶子中间件只依赖稳定编辑器领域数据和真实行为所有者。

## 远期计划

- [ ] `keydown.ts` 只保留稳定监听入口与高层编排。
- [ ] Keydown 子图退出应用级 SCC，并与主循环依赖任务归档。

## 风险与验收标准

- Range 内容序列化必须保持节点顺序和原 HTML，不引入 sanitize 或格式变化。
- 请求与回调保持异步语义，不改为 Promise 或额外回退路径。
- 不以局部键盘 Host 接口或 `unknown` 参数替代真实领域根。
- 每批记录目标边、SCC 性质、测试、类型诊断、lint 和 `git diff --check`。

## 已完成记录

- **2026-07-26**：创建专项 TTT，登记 577 行编排根、两条直接环及全图 `2195/500/680` 基线；开始迁移文本转换唯一实现。
- **2026-07-26**：`getContentByInlineHTML` 迁入 `keydown/content`，专属 `imports.ts` 直达唯一 `fetchPost`；attr、copy、全局 keydown 与 editKeydown 网关全部直达真实所有者，原 keydown 入口仅静态导出同一函数身份。Range DOM 快照进一步成为无网络依赖的纯叶子实现，Node 测试用真实 happy-dom Range 固定文本/元素节点顺序，不为测试注入 fetch Port 或弱化标准 DOM `Range` 类型。两条直接环归零，内容子域退出 SCC；源码图 `2198` 节点、代表环 `500 -> 466`、最大 SCC `680 -> 679`。专项 `1/1`、Node `178/178`、新子域 lint、目标类型诊断、imports 多跳与 diff 校验通过；下一阶段继续建立键盘调度行为基线。
