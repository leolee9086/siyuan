# Protyle 上传编排与资源写入职责拆分（TikTocTak）

> **最终目标**：保持 Protyle 文件校验、确认、进度、上传、回调、默认编辑器插入、AV 批量写入、本地路径导入和错误反馈不变，将 512+ 行上传上帝模块拆为单向上传领域并消除其全部循环路径。
>
> **当前目标**：分离调用方必需响应处理器的上传传输路径与默认编辑器/AV 后处理，解除 `Asset -> upload -> insertHTML -> blockFold -> transaction` 返回路径。
>
> **下一步任务**：建立 callback、默认后处理、校验失败、取消确认和 XHR 状态行为测试，先分离默认 `genUploadedLabel` 的普通编辑器插入与 AV 资源写入阶段。

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

- [ ] 建立必需 callback 与默认结果分支测试。
- [ ] 提取共享校验和 XHR 传输唯一实现。
- [ ] 让 Asset、Background、Gutter 等已有 callback 消费者直达必需响应入口。
- [ ] 使必需响应入口及 Asset 退出循环 SCC。

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

## 关联任务

- [AV 单元格值更新与批量编辑职责拆分](./AV单元格值更新与批量编辑职责拆分.ttt.md)
- [AV 属性面板与资源交互职责拆分](./AV属性面板与资源交互职责拆分.ttt.md)
- [事务提交与本地同步职责拆分](./事务提交与本地同步职责拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
