# Imports 网关多跳转发清理 (TikTocTak)

## 最终目标

清除 `app/src` 中 `imports.ts -> imports.ts` 的无依据多跳转发；每个领域网关直接指向真实声明或实现所有者，使依赖图、循环路径和变更影响可以从单层网关准确判断。

## 当前目标

- [x] 修正 `dialog/processSystem/imports.ts` 的 Card/Plugin 多跳。
- [ ] 审计并清理剩余 `32` 条多跳边。
- [ ] 在存量清零后加入静态门禁，防止新增网关串联。

## 下一步任务

1. 清理 `block/panel` 与 `block/imports` 的父级网关串联。
2. 清理 `bazaar-hub/internal`、window keydown 子域和菜单子域多跳。
3. 清理 Protyle gutter/AV 子域多跳，并结合 SCC 判断真实方向。
4. 对确需领域聚合的入口给出明确领域根，不以 `imports.ts` 串联代替。

## 不变量

- 保留每个业务目录自己的 `imports.ts`，但其来源直接指向真实声明/实现文件。
- 不动态导入、不复制实现、不用事件或注册表隐藏静态行为依赖。
- 类型依赖可直接指向稳定抽象定义；具体 class 仅保留在初始化、组合和契约校验边界。
- 工厂不持有跨调用状态；状态仍由统一 Symbol 注册表拥有。
- 多跳清理不得改变函数、class、对象或回调身份。

## 现状基线

- `rg '^import .*from .*imports' app/src --glob imports.ts` 得到 `49` 条多跳导入。
- 主要集中于 `block/panel`、`bazaar-hub/internal`、window keydown 子域、Protyle 菜单/AV 子域。
- 本任务启动时唯一 SCC `689`，Madge 枚举环 `542`。

## 近期计划

- [ ] 每批记录清除边、真实所有者、SCC 成员变化和测试证据。
- [ ] 所有目标文件专项 lint 与类型诊断通过。

## 中期计划

- [ ] 残余多跳仅允许经过明确登记的正式公共领域入口，而非另一个依赖网关。
- [ ] 建立源目录静态检查和专项测试。

## 远期计划

- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 完成全源码零循环验收。

## 风险与验收标准

- 所有迁移后的导入解析到与原转发完全相同的声明或实现身份。
- `imports.ts -> imports.ts` 无依据边清零，不以 barrel 或别名替代。
- Node/Vitest、目标 TypeScript、lint、循环图和 `git diff --check` 通过。

## 已完成记录

- **2026-07-26**：创建专项 TTT。`dialog/processSystem/imports.ts` 的 `fetchPost` 从 Card 网关改为网络真实实现，`AppFacade/isMobile/getAllEditor` 从 Plugin 网关改为各自真实类型/行为所有者；该目录多跳清零。清理后建立全仓权威基线 `49` 条，Madge 枚举环 `542 -> 490`，唯一 SCC 保持 `689`。
- **2026-07-26**：`block/panel/imports.ts` 的 17 项父网关转发全部追到 Protyle、Editor、Window、Platform、Dialog、环境访问器和 AppFacade 的真实所有者；Panel 消费文件及值身份不变。全仓多跳 `49 -> 32`，专项 lint 通过；枚举环因路径重排 `490 -> 572`，唯一 SCC 保持 `689`，Panel 四个模块仍有其它返回路径，继续按依赖性质推进。
