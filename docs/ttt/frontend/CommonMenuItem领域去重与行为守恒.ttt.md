# CommonMenuItem 领域去重与行为守恒（TikTocTak）

> **最终目标**：以当前实际生效的 `app/src/menus/commonMenuItem.ts` 为行为基线，将通用菜单能力迁入职责明确的唯一所有者，调用方直达真实实现，删除失活重复实现和旧综合入口，并保持菜单结构、事件、请求、错误传播与平台差异不变。
>
> **当前目标**：重命名、移动与导出动作已唯一化；继续迁移根文件剩余能力并删除综合入口。
>
> **下一步任务**：逐项核对 `openAttr/copySubMenu/openMenu/openWechatNotify/openFileWechatNotify/openFileAttr` 的实际调用与已拆分实现，先迁移功能一致的调用，差异项继续按提交意图处理。

## 不变量

- 每次修改前读取当前文件、目标行、调用点和依赖真实声明，不根据文件名、历史结构或相邻模块推测内容。
- 当前模块解析规则下，`./commonMenuItem` 命中根文件 `commonMenuItem.ts`；因此迁移前以该文件的实际运行语义为基线。
- 菜单 ID、标签、图标、快捷键、条目顺序、同步返回、点击时序、请求参数和错误传播保持不变。
- 加密笔记本文档重命名必须继续向 `/api/block/getDocInfo` 传递 `notebook`；普通文档和笔记本路径保持现状。
- 文件移动继续按输入顺序生成 `rootIDs`，并将选择器回调的首个有效 notebook/path 原样交给现有移动命令；选择器违反非空协议时显式抛错。
- Electron、移动应用与浏览器导出行为分别守恒，不用全局条件或参数上下文强行合并不同行为。
- 功能完全一致时只保留唯一实现；行为不同的代码先记录差异并查明意图，不以文本相似为依据合并。
- 子域外部依赖经本域 `imports.ts` 直达真实声明或唯一实现；同域声明直接引用，禁止 imports 网关多跳。
- 不增加动态导入、兼容 barrel、模块级可变状态、工厂闭包状态、碎片 Host/Port、宽泛 `unknown` 或类型断言来隐藏依赖。
- 测试只放在 `app/test`；用户修改的 `app/src/layout/dock-utils.ts` 不修改、不暂存。

## 现状基线

- **2026-07-27**：磁盘中同时存在 `app/src/menus/commonMenuItem.ts` 和 `app/src/menus/commonMenuItem/index.ts`。当前所有 `./commonMenuItem` 调用均解析到根文件，目录入口不是这些调用的运行时实现。
- 根文件公开九项能力；目录中已存在复制、微信提醒、文件属性、打开方式和导出等拆分文件，但迁移未完成。
- 对 `exportMd`、`renameMenu`、`movePathToMenu` 的逐行读取确认两套代码并非等价：
  - 目录版 `renameMenu` 未为加密笔记本的文档信息请求添加 `notebook`，根实现会添加。
  - 目录版 `movePathToMenu` 在目标数组首项为空时提前返回，根实现直接透传首项。
  - 目录版 Markdown 导出直接调用 `/api/export/exportMd`，根实现调用 `exportMarkdownZip({id})`。
  - 目录版图片导出打开导出预览 Tab，根实现调用 `exportImage(id)`。
  - 若干压缩格式的进度消息隐藏和 `saveExportFile` 参数时序不同。
- 当前循环图基线为 `2339` 个生产节点、`171` 条代表环；首环经过 `menus/navigation -> menus/commonMenuItem -> protyle/export`。
- 当前工作树仅有用户修改 `app/src/layout/dock-utils.ts`。

## 目标架构

```text
menus/commonMenuItem/
  rename/                 # 重命名菜单唯一所有者
  movePath/               # 移动菜单唯一所有者
  export/                 # 导出菜单及格式动作唯一所有者
  copy.ts                 # 复制菜单唯一所有者
  fileAttr/               # 属性对话框唯一所有者
  openMenu.ts             # 打开方式唯一所有者
  ...

调用方 -> 对应真实所有者
真实所有者 -> 本子域 imports.ts -> 外部真实声明/唯一实现
```

## 分阶段计划

### Phase 1：行为证据

- [x] 读取根文件、目录入口、三个目标函数、调用点和历史提交。
- [x] 确认模块解析实际命中根文件，并登记两套实现的已观察差异。
- [x] 建立重命名、移动菜单行为测试。
- [x] 完整比较所有导出格式的菜单结构、请求、消息和平台动作。

### Phase 2：重命名与移动唯一化

- [x] 创建重命名菜单唯一实现，完整保留加密笔记本参数与请求后重命名时序。
- [x] 创建移动菜单唯一实现，完整保留 `rootIDs` 与目标参数透传。
- [x] 所有调用方直达真实所有者；目录入口和根文件删除对应重复定义，不保留重导出。

### Phase 3：导出唯一化

- [x] 按每项最新明确提交意图合并导出动作，不整体沿用任一漂移实现。
- [x] 建立桌面、移动、浏览器菜单顺序及关键动作测试。
- [x] 所有调用方直达导出菜单唯一所有者，删除根文件对应实现。

### Phase 4：剩余能力与旧入口删除

- [x] 核对并迁移 `copySubMenu`，删除缺少浏览器条目且快捷键语义漂移的旧目录实现。
- [ ] 逐项核对并迁移 `openAttr/openMenu/openWechatNotify/openFileWechatNotify/openFileAttr`。
- [ ] 删除 `app/src/menus/commonMenuItem.ts`；失活目录聚合入口已删除，不保留兼容 barrel。
- [ ] 确认所有调用点直达真实所有者，重复实现归零。

### Phase 5：回归与归档

- [ ] 专项菜单测试、Node、Vitest、类型检查、Protyle 契约、目标 lint、imports 多跳、循环图和 diff 检查通过。
- [ ] 检查成功路径、DOM、事件、异步顺序和错误传播无变化。
- [ ] 每批显式暂存，排除 `app/src/layout/dock-utils.ts`，原子提交并更新关联 TTT。

## 风险与验收

- 旧目录拆分实现已发生行为漂移，不能因其结构较新就视为权威实现。
- 导出菜单跨 Electron、移动原生桥与浏览器，必须按平台分别核对，不以共享参数抹平差异。
- 验收以实际调用图只有一个实现、专项行为证据通过和旧综合入口删除为准，不以文件移动完成为准。

## 关联任务

- [文件树导航菜单上帝模块拆分](./文件树导航菜单上帝模块拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)

## 已完成记录

- **2026-07-27**：创建专项 TTT。完成当前文件、调用点和历史核查；确认根文件是运行时基线，目录拆分版至少存在五类明确语义差异，因此后续采用逐能力守恒迁移，不直接切换旧目录入口。
- **2026-07-27**：重命名与移动菜单分别迁入 `rename/renameMenu.factory.ts`、`movePath/movePathToMenu.factory.ts` 唯一所有者，所有生产调用方直达新路径；根文件和失活目录入口中的重复定义删除，零消费者的 `commonMenuItem/index.ts` 整体删除。重命名保留加密 notebook 请求参数和响应后命令时序；移动保留输入顺序、root ID 与首目标透传，并对选择器违反非空协议显式抛错。专项 Vitest `4/4`、新子域 lint、目标类型诊断 `0`、Node `204/204`、Protyle 契约、imports 多跳 `0` 和 diff 检查通过；完整类型检查仍以仓库其他既有诊断退出。生产代表环 `171 -> 170`，首环仍由待迁移的 `navigation -> commonMenuItem.exportMd` 进入导出链。
- **2026-07-27**：导出契约核查发现 `showMessage` 于 2026-06-22 被无异步步骤地声明为 `async`，而导出等调用方需要同步消息 ID；新增 `messageIdentity.test.ts` 先复现返回 Promise 的失败，再恢复同步 ID 语义。修复后专项 `1/1`、Node `204/204` 与 Protyle 契约通过，完整类型检查中 CommonMenuItem 导出链的 Promise-ID 诊断归零；检查仍报告消息模块两项既有严格类型和三个内部 helper 参数规模诊断，未静默掩盖或扩大本批范围。
- **2026-07-28**：导出菜单完整迁入 `export/exportMenu.factory.ts` 唯一所有者，根 300 行实现删除。逐项历史确认：Markdown 使用 2026-06-25 参数对话框，图片使用 2026-03-19 导出预览 Tab，压缩格式使用 2026-06-10 `saveExportFile(uri, msgId)`，模板与移动打印保留后续上游交互顺序；没有把任一整文件先验视为权威。移动 PDF 对缺失 HTML 显式抛错，原生打印后三秒用户感知进度时序保留。专项累计 `9/9`、导出子域 lint、目标类型诊断 `0`、Node `204/204`、Protyle 契约、imports 多跳 `0` 与 diff 检查通过；代表环 `170 -> 161`，剩余导出环已收口为 `exportMenu -> protyle/export` 明确领域边。
- **2026-07-28**：导出预览创建页签不再经本域网关加载具体 `editor/open/openFile`，改为调用完整 `AppFacade.openTab()`。实际读取确认桌面与移动 App 原本均委托同一 `openFile`，其完成结果为既有完整 `LayoutTab | undefined`；因此外观及两个实现同步恢复真实 Promise 返回，没有创建局部 Host/Port 或碎片结果类型。新增专项测试证明预览调用会等待宿主完成，导出与预览回归 `5/5`、AppFacade 双向契约 `3/3`、imports 多跳 `0`、diff 检查通过；代表环 `161 -> 160`，首环不再经过 `export-preview`。完整类型检查仍被仓库既有严格诊断阻塞，本批外观、预览与测试文件无新增诊断；目标 lint 仅在两个应用组合根报告既有规模门禁及移动既有未使用参数。
- **2026-07-28**：逐行核对确认旧 `copy.ts` 与当前根实现不等价：缺少浏览器 `copyWebURL`，标准 Markdown accelerator 从 `undefined` 漂移为 `""`，并引入零复用局部上下文接口和数组断言。唯一实现迁入 `copy/copySubMenu.factory.ts`，使用当前根请求协议，完整保留八个调用点的菜单顺序、平台差异、快捷键、复制类型、Markdown 请求和复制后聚焦顺序；所有调用方直达 factory，旧 `copy.ts` 与根重复定义删除，四处多余 `IMenu[]` 断言同时移除。复制专项 `3/3`、CommonMenuItem 累计 `11/11`、Node `204/204`、新子域 lint、目标类型诊断 `0`、imports 多跳 `0` 与 diff 检查通过；代表环保持 `160` 且首环不变，说明该批消除的是综合入口消费者与重复实现，不虚报循环数量收益。
