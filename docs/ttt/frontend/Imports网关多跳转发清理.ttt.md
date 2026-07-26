# Imports 网关多跳转发清理 (TikTocTak)

## 最终目标

清除 `app/src` 中 `imports.ts -> imports.ts` 的无依据多跳转发；每个领域网关直接指向真实声明或实现所有者，使依赖图、循环路径和变更影响可以从单层网关准确判断。

## 当前目标

- [x] 修正 `dialog/processSystem/imports.ts` 的 Card/Plugin 多跳。
- [x] 审计并清理剩余 `32` 条多跳边。
- [x] 在存量清零后加入静态门禁，防止新增网关串联。

## 下一步任务

1. 持续运行静态门禁，保持 `imports.ts -> imports.ts` 为零。
2. 对确需领域聚合的入口给出明确领域根，不以 `imports.ts` 串联代替。
3. 在应用级 SCC 主线中按真实值依赖方向继续缩减成员。

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

- [x] 每批记录清除边、真实所有者、SCC 成员变化和测试证据。
- [x] 所有目标文件专项 lint 与类型诊断通过。

## 中期计划

- [x] 残余多跳仅允许经过明确登记的正式公共领域入口，而非另一个依赖网关。
- [x] 建立源目录静态检查和专项测试。

## 远期计划

- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 完成全源码零循环验收。

## 风险与验收标准

- 所有迁移后的导入解析到与原转发完全相同的声明或实现身份。
- `imports.ts -> imports.ts` 无依据边清零，不以 barrel 或别名替代。
- Node/Vitest、目标 TypeScript、lint、循环图和 `git diff --check` 通过。

## 已完成记录

- **2026-07-26**：创建专项 TTT。`dialog/processSystem/imports.ts` 的 `fetchPost` 从 Card 网关改为网络真实实现，`AppFacade/isMobile/getAllEditor` 从 Plugin 网关改为各自真实类型/行为所有者；该目录多跳清零。清理后建立全仓权威基线 `49` 条，Madge 枚举环 `542 -> 490`，唯一 SCC 保持 `689`。
- **2026-07-26**：`block/panel/imports.ts` 的 17 项父网关转发全部追到 Protyle、Editor、Window、Platform、Dialog、环境访问器和 AppFacade 的真实所有者；Panel 消费文件及值身份不变。全仓多跳 `49 -> 32`，专项 lint 通过；枚举环因路径重排 `490 -> 572`，唯一 SCC 保持 `689`，Panel 四个模块仍有其它返回路径，继续按依赖性质推进。
- **2026-07-26**：完成剩余 32 条网关串联清理。Bazaar internal、Boot window keydown、Block、Protyle gutter/AV 与媒体菜单网关全部直达网络、平台、环境、领域类型或唯一行为实现；`rg` 扫描 `imports.ts -> imports.ts` 为 `0`。Madge 枚举环为 `486`，唯一 SCC 从 `689` 缩到 `681`；目标文件专项 lint 通过，目标 TypeScript 路径诊断 `0`，`git diff --check` 通过。全仓严格类型检查能够完成但仍报告其它既有诊断，不登记为全仓通过。
- **2026-07-26**：新增基于 TypeScript AST 的 `lint:imports-gateway-hops` 门禁，同时覆盖静态 import 与 re-export；仅禁止 `imports.ts` 指向其它相对 `imports` 网关，不限制普通业务模块使用本域网关。3 项专项测试覆盖直达实现、三类网关转发和非网关文件，完整 Node 回归 `166/166`。专项任务完成，后续由循环依赖主线持续维护零多跳不变量。
- **2026-07-26**：复核 `dialog/processSystem/imports.ts` 的 `AppFacade` 来源已直接指向 `app/AppFacade.types.ts`；门禁测试补充 `import type` 与 `export type ... from` 两类类型多跳语法，专项 `3/3` 通过，全仓扫描继续保持 `0`。
- **2026-07-26**：修复 Windows 下门禁对 POSIX 风格模块说明符的漏检：旧实现使用平台相关 `path.basename()`，不能把 `../../plugin/imports` 的 `/` 识别为分隔符；现改为按 TypeScript 模块说明符语义匹配末段 `imports`/`imports.ts`。测试新增显式后缀的类型 re-export，`import type {AppFacade} from "../../plugin/imports"` 等跨目录中转均被确定性阻断；源码扫描仍为 `0`，Node `177/177`、`git diff --check` 通过。
- **2026-07-26**：在“禁止 imports 网关互转”之外继续落实“网关尽可能直达真实声明/唯一实现”：Block Popover、Window、Menus 与桌面全局命令的 `getInstanceById` 来源从 `layout/util.ts` 或 `layout/tabUtil.ts` 普通聚合出口改为 `layout/query/layoutInstance.ts`。`processSystem/imports.ts` 的 `AppFacade` 同样维持直达 `app/AppFacade.types.ts`；全仓 `imports.ts -> imports.ts` 门禁保持 `0`。
- **2026-07-27**：进一步处理网关职责宽度而非绕过网关：窗口创建使用独立 `window/open/imports.ts`，逐项直达真实声明或唯一实现，避免根 `window/imports.ts` 为创建窗口附带加载窗口消息与锁屏。全仓 `imports.ts -> imports.ts` 仍为 `0`；`openNewWindow.ts` 和新网关退出循环 SCC，原 OpenMenu/Window/LockScreen 返回路径归零。
