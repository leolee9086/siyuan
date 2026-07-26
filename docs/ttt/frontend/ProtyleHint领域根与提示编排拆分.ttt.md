# Protyle Hint 领域根与提示编排拆分

## 最终目标

在保持提示面板运行时行为、事件顺序和扩展能力不变的前提下，使 Hint 具体类只承担状态所有权与组合职责；下层填充、渲染和选择模块统一依赖完整 Hint 领域根，不再反向加载具体类，并逐步按真实职责拆分 302 行提示编排根。

## 当前目标

- [x] 登记 Hint 完整公共实例表面。
- [x] 建立单一 `HintDomain`、模块级 Symbol 厂牌和双向契约校验。
- [x] 清除 fill、AV fill、slash fill、render、select 对具体 Hint class 的类型回边。
- [ ] 基于行为测试拆分输入解析、面板渲染和命令执行职责。

## 下一步任务

1. 为提示键解析、emoji 导航和斜杠命令分发补齐行为基线。
2. 识别输入解析、展示状态与命令执行的真实状态所有权，不创建调用点碎片接口。
3. 每批复算代表环与 Tarjan SCC，按组件性质决定后续拆分顺序。

## 不变量

- `HintDomain` 必须覆盖 Hint class 的完整公共实例表面，并由 `PublicInstanceLooksLike` 双向校验。
- 子模块只依赖 `hint.types.ts`，不得经 `imports.ts` 多跳转发。
- 不以 `unknown`、类型断言、动态导入、事件转发、工厂闭包或服务定位器隐藏依赖。
- 不把 fill、render、select 分别抽成局部能力接口。
- 运行时选择、填充、上传、emoji、搜索和扩展提示语义保持不变。

## 现状基线

- `app/src/protyle/hint/index.ts` 为 302 行组合根。
- 具体 Hint class 与 `index.fill.ts`、`index.render.ts`、`index.select.ts` 形成三条直接两节点环。
- AV 与 slash 填充分支同样反向导入具体 Hint 类型。
- 阶段开始时全图代表环 `459`，最大/唯一 SCC `676`，imports 网关多跳 `0`。

## 目标架构

- `hint.types.ts`：完整公共领域根与稳定身份。
- `index.ts`：具体状态、DOM 生命周期和子职责组合。
- `index.fill.ts`、`fill/*.ts`、`index.render.ts`、`index.select.ts`：只依赖完整领域根；AV 与 slash 填充分支归入专属子目录。
- `app/test/protyle/HintDomain.contract.test.ts`：独立证明抽象与实现公共表面双向等价。

## 近期计划

- [x] 完整领域根与契约校验。
- [x] 清除具体类直接回边。
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
