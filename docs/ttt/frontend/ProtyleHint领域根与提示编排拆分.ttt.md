# Protyle Hint 领域根与提示编排拆分

## 最终目标

在保持提示面板运行时行为、事件顺序和扩展能力不变的前提下，使 Hint 具体类只承担状态所有权与组合职责；下层填充、渲染和选择模块统一依赖完整 Hint 领域根，不再反向加载具体类，并逐步按真实职责拆分 302 行提示编排根。

## 当前目标

- [x] 登记 Hint 完整公共实例表面。
- [x] 建立单一 `HintDomain`、模块级 Symbol 厂牌和双向契约校验。
- [x] 清除 fill、AV fill、slash fill、render、select 对具体 Hint class 的类型回边。
- [x] 将块提示结果项渲染迁入独立 `result` 子域，解除引用搜索对综合 `extend.ts` 的加载。
- [ ] 基于行为测试拆分输入解析、面板渲染和命令执行职责。

## 下一步任务

1. 锁定 `hintSlash` 的命令清单、筛选和快捷键展示行为，将 348 行命令目录从综合编排根迁入完整职责子域。
2. 为提示键解析、emoji 导航和斜杠命令分发补齐行为基线。
3. 识别输入解析、展示状态与命令执行的真实状态所有权，不创建调用点碎片接口。
4. 每批复算代表环与 Tarjan SCC，按组件性质决定后续拆分顺序。

## 不变量

- `HintDomain` 必须覆盖 Hint class 的完整公共实例表面，并由 `PublicInstanceLooksLike` 双向校验。
- 子模块只依赖 `hint.types.ts`，不得经 `imports.ts` 多跳转发。
- 不以 `unknown`、类型断言、动态导入、事件转发、工厂闭包或服务定位器隐藏依赖。
- 不把 fill、render、select 分别抽成局部能力接口。
- 运行时选择、填充、上传、emoji、搜索和扩展提示语义保持不变。

## 现状基线

- `app/src/protyle/hint/index.ts` 为 302 行组合根。
- `app/src/protyle/hint/extend.ts` 在结果项迁移后仍为 593 行，其中 `hintSlash` 实际代码 348 行、`hintMoveBlock` 实际代码 86 行，继续作为本专项的上帝模块拆分对象。
- 具体 Hint class 与 `index.fill.ts`、`index.render.ts`、`index.select.ts` 形成三条直接两节点环。
- AV 与 slash 填充分支同样反向导入具体 Hint 类型。
- 阶段开始时全图代表环 `459`，最大/唯一 SCC `676`，imports 网关多跳 `0`。

## 目标架构

- `hint.types.ts`：完整公共领域根与稳定身份。
- `index.ts`：具体状态、DOM 生命周期和子职责组合。
- `index.fill.ts`、`fill/*.ts`、`index.render.ts`、`index.select.ts`：只依赖完整领域根；AV 与 slash 填充分支归入专属子目录。
- `result/item.ts`：块搜索提示结果项唯一同步渲染实现；外部图标、Emoji 和 i18n 依赖由 `result/imports.ts` 逐项直达真实所有者。
- `app/test/protyle/HintDomain.contract.test.ts`：独立证明抽象与实现公共表面双向等价。

## 近期计划

- [x] 完整领域根与契约校验。
- [x] 清除具体类直接回边。
- [x] 提取块提示结果项渲染并锁定 HTML 行为。
- [ ] 补齐关键行为测试后拆分下一层职责。

## 中期计划

- 将输入解析、提示数据获取、展示状态与命令执行迁入真实职责所有者。
- 保持插件 hint、斜杠命令和编辑器上下文的现有扩展协议。

## 远期计划

- Hint 组合根退出主 SCC，所有提示子域依赖方向稳定且可独立测试。
- 与 Protyle 领域根拆分共同归档。

## 风险

- DOM Range、输入法组合事件和键盘事件的同步顺序容易产生行为漂移。
- emoji、块引用、AV 和 slash 分支共享状态，过早拆分会形成参数袋或隐式耦合。
- 只删除直接环而不复算 SCC，可能掩盖更长返回路径。

## 验收标准

- 具体 Hint class 回边归零。
- 双向契约、目标类型检查、Node 测试、lint 与 imports 网关检查通过。
- 每个职责拆分均有行为证据，并记录环与 SCC 变化。

## 已归档/已完成区域

- **2026-07-26**：完成领域根首批改造。`HintDomain` 覆盖 9 个公开状态字段、6 个公开方法及 Symbol 身份；五个 helper 文件统一直达类型声明，具体类仅在组合根和独立契约测试出现。目录原有 10 项已满，按 lint 指引将 AV 与 slash 填充分支归入 `hint/fill/`，没有添加目录豁免。Node `180/180`（含 Hint 契约）与新类型文件 lint 通过，imports 网关多跳保持 `0`；完整类型检查正常结束且新类型/契约无诊断，既有 Hint 实现仍有严格空值、函数规模和参数数量诊断。源码节点 `2200`，代表环 `459 -> 454`，唯一 SCC 保持 `676`：具体类直接回边已经归零，Hint 仍经移动编辑器与 Protyle 运行路径处于主组件，后续继续按行为基线拆分。
- **2026-07-27**：`genHintItemHTML` 从 636 行综合 `extend.ts` 完整迁入 `hint/result/item.ts`，普通块图标、文档 Emoji、名称/别名/备注、引用计数、内容与路径的现有同步 HTML 语义保持；`extend.hintRef.ts`、`index.render.ts` 与 `hintEmbed` 直达唯一实现，旧根不保留转发。新子域网关逐项直达图标映射、Emoji 渲染和 i18n 真实所有者，不经其它 `imports.ts`。专项 `4/4`、完整 Node `198/198`、Protyle 契约类型、新文件 lint、全量类型检查目标诊断 `0`、imports 多跳与 diff 检查通过；生产图 `2256 / 321 / SCC 613`，相对前批 `2254 / 335 / SCC 615`，结果子域、网关和 `extend.hintRef.ts` 全部退出 SCC。新的首环不再经过 Hint，转为 AV Cell Edit 经 OpenMenuPanel/Relation/View 返回事务链。
- **2026-07-27**：`hintRenderAssets` 实际是完整的 Protyle 资源写入行为，不属于提示数据或提示面板职责；其唯一实现迁入 `protyle/asset/insert.ts`，保留 Range 恢复、资源 HTML 参数、插入和工具层收起顺序，并对未初始化 Toolbar/Range 显式失败。Slash Fill 只在资源命令组合点绑定编辑器去向，资源菜单和 AV 调用不再加载 Hint 综合根。写入及菜单目标专项 `7/7`、Node `199/199`、契约类型、新目标类型诊断 `0` 与网关门禁通过；Hint `extend.ts` 仍有 Slash 目录、模板/挂件与移动块职责，继续按本专项拆分。
