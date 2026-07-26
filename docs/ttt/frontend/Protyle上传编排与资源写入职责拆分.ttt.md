# Protyle 上传编排与资源写入职责拆分（TikTocTak）

> **最终目标**：保持 Protyle 文件校验、确认、进度、上传、回调、默认编辑器插入、AV 批量写入、本地路径导入和错误反馈不变，将 512+ 行上传上帝模块拆为单向上传领域并消除其全部循环路径。
>
> **当前目标**：传输与必需响应调用方已退出 SCC；继续把默认结果投影和本地路径上传从 `upload/index.ts` 归入明确子域，使 Upload 状态根与默认结果分别退出主组件。
>
> **下一步任务**：补齐默认结果的普通编辑器、属性面板和 AV 多行投影测试，再将 200+ 行默认结果与本地路径上传迁入 `upload/result`、`upload/local`，根只保留具体 Upload 状态构造。

## 不变量

- FileList、DataTransferItemList、File[] 与文件夹路径识别顺序保持。
- 自定义 `handler/validate/file/format/success/error` 的优先级和短路行为保持。
- 文件大小、类型、文件名、extraData、fieldName、token、withCredentials 和 lite assets 路径保持。
- 确认弹窗、上传中消息、进度条、input 清空、销毁编辑器和失败反馈时机保持。
- 调用方传入 success callback 时不得加载或执行默认 Editor/AV 插入；未传时仍执行唯一默认后处理。
- DataTransfer 文件夹即使与显式 success callback 同次出现，仍按现实现调用本地路径上传和默认结果后处理；拆分前必须用测试固定该差异，不得把普通文件 callback 错套到文件夹。
- 功能完全相同只保留唯一传输实现，不复制 XHR、FormData 或校验流程。
- 不用动态导入、事件绕行、可选回退、回调 Port 或工厂闭包隐藏依赖；已有上传结果 callback 是公开行为协议，不扩张为通用宿主接口。
- 子域 `imports.ts` 直达真实声明或唯一实现，不串联其它网关。

## 现状基线

- `protyle/upload/index.ts` 超过 512 行，包含 `Upload` UI class、文件校验、本地路径导入、XHR 传输和 276 行默认结果编排。
- `genUploadedLabel` 同时处理普通编辑器 HTML、属性面板 Asset、AV 选中行、多行顺序映射、事务和滚动。
- `handleXHRStateChange` 在 `options.upload.success`、调用方 callback 与默认后处理之间分派，但三条路径静态共享整个模块依赖图。
- 建立任务时生产图为 `2236` 节点、`362` 条代表环、唯一 SCC `626`；首环从 AttributePanel/Asset 经上传返回 Cell Update。

## 目标架构

1. `upload/state`：完整 Upload 进度元素领域根；若 class 被跨域依赖，使用厂牌与 `PublicInstanceLooksLike` 双向校验。
2. `upload/validation`：文件归一化、文件名/大小/类型验证与 FormData 规划。
3. `upload/transport`：XHR 请求、headers、进度、销毁与确定响应分派。
4. `upload/result`：默认普通编辑器插入、AV 单元格写入和批量事务编排。
5. `upload/local`：本地路径确认、接口写入和默认结果投影。
6. `upload/index`：只在 Protyle 组合边界装配默认结果处理器，不保存闭包状态。

## 近期计划

- [x] 建立必需 callback、默认结果分派和目录分支测试。
- [x] 提取共享校验和 XHR 传输唯一实现。
- [x] 让 Asset、Background、Gutter 等已有 callback 消费者直达必需响应入口。
- [x] 使必需响应入口及 Asset 退出循环 SCC。

## 中期计划

- [ ] 分离普通编辑器 HTML 插入与 AV 资源值写入。
- [ ] 将 AV 多行资源更新改用封闭 Prepared 命令。
- [ ] 分离本地路径导入与 XHR 文件上传。
- [ ] 使各模块满足函数和文件规模门禁。

## 远期计划

- [ ] 上传领域全部退出循环 SCC，不保留旧综合实现或兼容 barrel。
- [ ] 桌面、Web、移动端的粘贴、拖放、面包屑、背景、Asset 菜单上传完成回归。
- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 一并完成全源码零循环验收。

## 风险与验收标准

- 测试必须观察 XHR method/url/headers/body、callback 选择、消息、input、进度和默认 DOM/事务结果。
- callback 与默认结果只能二选一，任何初始化或请求失败均保持可观察，禁止静默吞错。
- 新模块专项、完整 Node、Protyle 契约类型、新代码 lint、imports 多跳、Madge/Tarjan 和 diff 检查通过。
- 代表环数量只用于定位；以目标路径归零、SCC 缩小和无新增 SCC 为结构验收。

## 已归档/已完成区域

- **2026-07-27**：建立专项。确认 Asset 菜单显式传入响应 callback，却因综合 `uploadFiles` 静态加载默认 `genUploadedLabel` 的 Editor/AV/transaction 依赖；当前先分离确定响应路径，不复制上传协议。
- **2026-07-27**：Cell Update 已提为严格 Prepared 命令并退出 SCC，上传默认结果不再经 `cell.update -> select/relation/view -> transaction` 返回；当前唯一返回路径是默认 `genUploadedLabel` 的普通编辑器 `insertHTML -> AV action`。生产图 `2238 / 324 / SCC 624`，下一阶段按该实际分派拆分默认结果。
- **2026-07-27**：上传默认结果使用的 `insertHTML` 不再经 Action 根取得 AV 标题同步；`updateAVName` 直达专属网关和严格 Prepared 命令，Name/网关/命令退出 SCC。生产图 `2240 / 331 / SCC 623`，当前返回路径推进到 `insertHTML -> blockFold -> transaction`，继续按默认普通编辑器插入职责拆分。
- **2026-07-27**：`insertHTML` 展开标题时不再通过综合 `blockFold.ts` 静态加载通用 transaction；折叠状态唯一实现返回 do/undo，调用方继续把它组合进原插入事务。折叠专项 `2/2`、Node `193/193`、Protyle 契约类型、lint 与 imports 多跳门禁通过。当前生产图 `2243 / 299 / SCC 625`；返回路径已从 transaction 转为 State 内的 `scrollCenter -> Layout/Wnd`，两个新运行时节点仍在主 SCC，所以该阶段尚未满足上传解环验收，继续处理滚动副作用边界。
- **2026-07-27**：DOM 滚动 helper 的配置读取改为直达稳定环境层唯一安全实现，消除为可选 `window.siyuan?.config` 加载 Layout/Wnd 的错误所有权；折叠和滚动逻辑均未改变。生产图 `2243 / 282 / SCC 619`，`blockFold/state` 与完整高亮滚动子域退出 SCC，上传默认插入的折叠返回路径已关闭。上传仍经 `insertHTML -> table -> block/util -> editor` 返回主图，下一阶段按表格选区职责真实所有权继续拆分。
- **2026-07-27**：上传插入仅需的表格网格/范围投影迁入纯 `table/grid`，框选几何的两份重复实现统一为 `table/selection/geometry`；`insertHTML` 不再加载任一综合 table 模块。生产图 `2247 / 332 / SCC 619`，新子域均在 SCC 外；当前上传返回路径推进到 `insertHTML -> input -> blockFold -> transaction`，代表环反升仅作定位。
- **2026-07-27**：表格范围 HTML 重建也迁入同一 grid 子域，旧综合 `table.ts` 整体退出 SCC；专项 `7/7` 与完整门禁通过。生产图 `2248 / 332 / SCC 618`，上传路径继续聚焦 `insertHTML -> input -> blockFold -> transaction`。
- **2026-07-27**：完整 `ProtyleDomain` 增加默认上传结果应用与本地路径上传两个正式行为，具体 Protyle 组合根复用原唯一实现，目录分支和默认响应不通过 callback Port 隐藏；`IProtyle.upload` 同时改用覆盖 Upload class 全部公共表面的 `UploadDomain`，独立 `PublicInstanceLooksLike` 双向契约通过。文件规范化、验证、FormData、确认、XHR headers/credentials、进度、销毁、错误和固定成功优先级整体迁入 `upload/transport`，专属 `imports.ts` 全部直达基础设施；所有 `uploadFiles` 消费者直达传输实现，旧根代码删除且不转发。专项 `4/4` 固定 `options.success > callback > format + Protyle default`、token、表单、清理和目录委托；Node `194/194`、Protyle 契约类型、新模块 lint及 imports 多跳通过。生产图 `2254 / 335 / SCC 615`，Transport/网关、AV Asset 与题头图上传退出 SCC；上传根因默认结果/本地路径与 Protyle 组合仍留在组件内，近期传输阶段完成。

## 关联任务

- [AV 单元格值更新与批量编辑职责拆分](./AV单元格值更新与批量编辑职责拆分.ttt.md)
- [AV 属性面板与资源交互职责拆分](./AV属性面板与资源交互职责拆分.ttt.md)
- [事务提交与本地同步职责拆分](./事务提交与本地同步职责拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
