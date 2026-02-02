# API 请求重构执行跟踪 (TikTocTak)

> **目标**: 将项目中 300+ 处 `fetchPost`/`fetchPostSync` 调用迁移至类型安全的 kernelSDK，通过SDK层hooks和可配置性实现完整的业务逻辑兼容。量化指标：消除所有原始 API 调用，实现 100% 类型覆盖，性能无回归。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 📋 核心原则

### 问题定义

项目中存在 300+ 处 [`fetchPost`](../../app/src/util/fetch.ts) 和 [`fetchPostSync`](../../app/src/util/fetch.ts) 调用，缺乏类型安全保障：

```typescript
// 当前方式：缺乏类型安全
const response = await fetchPost('/api/block/getBlockInfo', { id: blockId });
// response.data 类型为 any，无编译时检查

// 目标方式：完整类型支持
const response = await kernelSDK.getBlockInfo({ id: blockId });
// response.data 有完整的 IBlock 类型定义
```

### 架构决策

**已确定方案：在SDK层补齐hooks和可配置性（方案B）**

**决策理由**：
- SDK直接提供完整能力，调用方无需额外封装
- 通过hooks机制实现可扩展性，适应不同业务场景
- 可配置性设计让SDK能够适配思源笔记的特殊需求

### SDK 能力差距分析

kernelSDK 需要直接补齐以下能力：

| fetchPost 特殊能力 | SDK 状态 | 影响 |
|-------------------|---------|------|
| 请求竞态控制 (reqId) | ❌ 缺失 | 高频搜索/图谱场景会出现响应覆盖 |
| FormData 支持 | ❌ 缺失 | 文件上传场景无法工作 |
| HTTP 401 自动重载 | ❌ 缺失 | 认证失效时用户体验下降 |
| HTTP 403/404 优雅降级 | ❌ 缺失 | 错误处理行为不一致 |
| getFile 202 状态码处理 | ❌ 缺失 | 文件获取场景异常 |
| 事务 API 网络失败处理 | ❌ 缺失 | 数据一致性风险 |
| Electron IPC 退出通知 | ❌ 缺失 | 桌面端退出流程异常 |
| processMessage 消息展示 | ❌ 缺失 | 用户无法看到操作反馈 |
| 响应格式类型守卫 | ❌ 缺失 | 类型安全性降低 |
| failCallback 机制 | ❌ 缺失 | 错误处理模式不兼容 |
| 自定义请求头 | ⚠️ 部分 | 仅支持 Authorization |

### fetchPost 调用分布

| 目录 | 调用数量 | 主要用途 | 复杂度 |
|------|---------|---------|--------|
| [`app/src/protyle/`](../../app/src/protyle/) | ~120+ | 编辑器核心功能 | 🔴 高 |
| [`app/src/mobile/`](../../app/src/mobile/) | ~50+ | 移动端设置和菜单 | 🔴 高 |
| [`app/src/layout/`](../../app/src/layout/) | ~30+ | 布局和Dock组件 | 🟡 中 |
| [`app/src/menus/`](../../app/src/menus/) | ~25+ | 菜单操作 | 🟡 中 |
| [`app/src/search/`](../../app/src/search/) | ~20+ | 搜索功能 | 🟡 中 |
| [`app/src/util/`](../../app/src/util/) | ~20+ | 工具函数 | 🟢 低 |
| [`app/src/sync/`](../../app/src/sync/) | ~10+ | 同步功能 | 🟢 低 |
| [`app/src/window/`](../../app/src/window/) | ~5+ | 窗口管理 | 🟢 低 |
| [`app/src/plugin/`](../../app/src/plugin/) | ~5+ | 插件系统 | 🟢 低 |

### 验收检查清单

- [ ] SDK API 签名与 fetchPost 兼容
- [ ] 所有特殊处理逻辑测试通过
- [ ] 性能基准无显著回归
- [ ] 所有 API 调用具有完整的 TypeScript 类型支持
- [ ] 消除所有 fetchPost/fetchPostSync 调用
- [ ] 功能行为与迁移前完全一致

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划 (立即聚焦，撸起袖子干)

- [ ] **Phase 0.1.1: 定义可配置项 (P0)**
  - **背景**: SDK需要支持可配置的行为以适配不同业务场景
  - **可配置项清单**:
    | 配置项 | 描述 | 默认行为 |
    |--------|------|----------|
    | `onUnauthorized` | 401 响应处理 | 延迟 3 秒后刷新页面 |
    | `onForbidden` | 403 响应处理 | 返回 `{data: null, msg: statusText, code: -403}` |
    | `onNotFound` | 404 响应处理 | 返回 `{data: null, msg: statusText, code: -404}` |
    | `on202Response` | 202 响应处理 | 调用 failCallback |
    | `onTransactionError` | 事务 API 网络失败处理 | 调用 kernelError() |
    | `onExitApiError` | 退出 API 失败处理 | 通过 IPC 通知 Electron |
    | `showErrorMessage` | 是否显示错误消息 | code === -1 时显示 |
    | `showInfoMessage` | 是否显示提示消息 | code === -2 时显示 |
    | `messageTimeout` | 消息显示超时时间 | 由响应决定 |
    | `headers` | 自定义请求头 | 无 |
    | `timeout` | 请求超时时间 | 无（待实现） |
    | `validateResponse` | 是否验证响应格式 | 是 |
    | `processMessage` | 是否处理后端消息 | 是 |
  - **验收标准**:
    - 配置项接口定义完成
    - 支持全局默认配置和单次请求覆盖

- [ ] **Phase 0.1.2: 实现竞态控制机制 (P0)**
  - **背景**: 高频搜索/图谱场景需要防止响应覆盖
  - **实现原理**:
    1. 请求时注入时间戳作为 reqId
    2. 以 URL 为 key 存储最新 reqId
    3. 响应时比较 reqId，丢弃过期响应
  - **需要竞态控制的 API**:
    - `/api/search/searchRefBlock` - 引用块搜索
    - `/api/graph/getGraph` - 全局关系图
    - `/api/graph/getLocalGraph` - 局部关系图（非 local 类型）
    - `/api/block/getRecentUpdatedBlocks` - 最近更新块
    - `/api/search/fullTextSearchBlock` - 全文搜索
  - **特殊处理**:
    - 事务 API 始终注入 reqId 但不做竞态检查
  - **验收标准**:
    - 支持声明哪些 API 需要竞态控制
    - 正确丢弃过期响应
    - 事务 API 特殊处理正确

- [ ] **Phase 0.1.3: 定义钩子接口 (P0)**
  - **背景**: 通过钩子机制实现可扩展性
  - **钩子清单**:
    | 钩子名称 | 触发时机 | 参数 | 返回值 |
    |----------|----------|------|--------|
    | `beforeRequest` | fetch 调用前 | `{url, data, headers}` | 修改后的配置或 false 取消 |
    | `afterResponse` | 响应解析后 | `{url, response, rawResponse}` | 修改后的响应 |
    | `onRaceConditionCheck` | 竞态检查时 | `{url, responseReqId, currentReqId}` | true/false |
    | `onNetworkError` | fetch 异常时 | `{url, data, error}` | 无 |
    | `onHttpError` | HTTP 非 2xx 时 | `{url, status, statusText}` | 自定义响应或 undefined |
    | `onMessage` | processMessage 前 | `{response}` | true 继续/false 跳过 |
    | `onShowMessage` | 显示消息前 | `{msg, type, timeout}` | 修改内容或 false 阻止 |
    | `onKernelError` | 内核通信异常 | `{url, error}` | 无 |
    | `onAuthExpired` | 401 认证失效 | `{response}` | false 阻止自动刷新 |
  - **验收标准**:
    - 钩子接口类型定义完成
    - 支持注册多个钩子
    - 钩子执行顺序明确

- [ ] **Phase 0.2: 实现错误处理和消息展示 (P0)**
  - **背景**: 需要保持与原有错误处理逻辑的兼容性
  - **行动**:
    1. 实现事务 API 失败处理 (kernelError 调用)
    2. 实现 Electron IPC 集成
    3. 实现 processMessage 消息展示
    4. 实现响应格式类型守卫
  - **验收标准**:
    - 错误处理行为与 fetchPost 一致
    - 用户能看到操作反馈消息
    - Electron 退出流程正常

- [ ] **Phase 0.3: SDK能力验证 (P0)**
  - **背景**: 确保SDK具备替换 fetchPost 的完整能力
  - **行动**:
    1. 编写单元测试验证竞态控制
    2. 编写单元测试验证错误处理
    3. 编写集成测试验证 UI 消息展示
    4. 编写集成测试验证 Electron 集成
    5. 验证 FormData 文件上传场景
  - **验收标准**:
    - 所有单元测试通过
    - 集成测试覆盖关键场景
    - 性能基准无显著回归

---

## 🟡 中期计划 (架构演进，步步为营)

- [ ] **Phase 1.1: 工具函数模块迁移 (~20处) (P1)**
  - **背景**: 低风险模块，用于验证迁移流程，建立最佳实践
  - **行动**:
    1. 迁移 [`app/src/util/`](../../app/src/util/) 目录下的 fetchPost 调用
    2. 重点关注 [`cronjobApi.ts`](../../app/src/util/cronjobApi.ts)
    3. 验证工具函数的类型安全性
    4. 建立迁移模板和规范
  - **验收标准**:
    - 所有 util 目录 fetchPost 调用已迁移
    - 类型定义完整
    - 功能测试通过

- [ ] **Phase 1.2: 同步功能模块迁移 (~10处) (P1)**
  - **背景**: 同步功能对时序敏感，需要仔细验证
  - **行动**:
    1. 迁移 [`app/src/sync/`](../../app/src/sync/) 目录下的 API 调用
    2. 确保同步逻辑的时序正确性
    3. 验证错误处理的一致性
  - **验收标准**:
    - 同步功能正常工作
    - 时序行为无变化

- [ ] **Phase 1.3: 窗口管理模块迁移 (~5处) (P1)**
  - **背景**: 窗口管理涉及 Electron 集成
  - **行动**:
    1. 迁移 [`app/src/window/`](../../app/src/window/) 目录下的调用
    2. 重点关注 [`init.ts`](../../app/src/window/init.ts) 和 [`setHeader.ts`](../../app/src/window/setHeader.ts)
    3. 验证窗口操作的稳定性
  - **验收标准**:
    - 窗口操作正常
    - Electron 集成无异常

- [ ] **Phase 1.4: 插件系统模块迁移 (~5处) (P1)**
  - **背景**: 插件系统需要保持向后兼容性
  - **行动**:
    1. 迁移 [`app/src/plugin/`](../../app/src/plugin/) 目录下的调用
    2. 确保插件 API 的向后兼容性
    3. 测试插件加载和通信机制
  - **验收标准**:
    - 插件加载正常
    - 插件 API 兼容

- [ ] **Phase 2.1: 搜索功能模块迁移 (~20处) (P1)**
  - **背景**: 搜索功能涉及竞态控制，是SDK hooks能力的重要验证场景
  - **行动**:
    1. 迁移 [`app/src/search/`](../../app/src/search/) 目录下的调用
    2. 重点关注搜索结果的类型定义
    3. 验证搜索性能无回归
  - **验收标准**:
    - 搜索功能正常
    - 竞态控制有效
    - 性能无回归

- [ ] **Phase 2.2: 菜单操作模块迁移 (~25处) (P1)**
  - **背景**: 菜单操作涉及多种 API 调用
  - **行动**:
    1. 迁移 [`app/src/menus/`](../../app/src/menus/) 目录下的调用
    2. 确保菜单事件处理的正确性
    3. 验证上下文菜单的功能完整性
  - **验收标准**:
    - 所有菜单操作正常
    - 上下文菜单功能完整

- [ ] **Phase 2.3: 布局和Dock模块迁移 (~30处) (P1)**
  - **背景**: 布局模块涉及状态管理
  - **行动**:
    1. 迁移 [`app/src/layout/`](../../app/src/layout/) 目录下的调用
    2. 重点关注 Dock 组件的状态管理
    3. 验证布局切换的稳定性
  - **验收标准**:
    - 布局切换正常
    - Dock 状态管理正确

---

## 🔴 远期计划 (北极星目标，星辰大海)

- [ ] **Phase 3.1: 移动端模块迁移 (~50处) (P2)**
  - **愿景**: 完成移动端所有 API 调用迁移
  - **范围**: [`app/src/mobile/settings/`](../../app/src/mobile/settings/)、[`app/src/mobile/dock/`](../../app/src/mobile/dock/)、[`app/src/mobile/util/`](../../app/src/mobile/util/)

- [ ] **Phase 3.2: 编辑器核心模块迁移 (~120处) (P2)**
  - **愿景**: 完成编辑器核心所有 API 调用迁移
  - **范围**: [`app/src/protyle/render/`](../../app/src/protyle/render/)、[`app/src/protyle/toolbar/`](../../app/src/protyle/toolbar/)、[`app/src/protyle/breadcrumb/`](../../app/src/protyle/breadcrumb/)

- [ ] **Phase 4.1: 全面回归测试 (P3)**
  - **愿景**: 确保所有功能正常工作，无回归错误

- [ ] **Phase 4.2: 性能基准对比 (P3)**
  - **愿景**: 验证 API 调用性能无显著下降

- [ ] **Phase 4.3: 清理和文档更新 (P3)**
  - **愿景**: 清理遗留的 fetchPost 导入，更新相关文档和类型定义，建立长期维护机制

---

## 🏁 已归档/已完成

- [x] **Phase 0: SDK 实现和验证** [已完成]
  - **背景**: 需要完成 kernelSDKTS 的实现和验证
  - **完成情况**: 
    - [`kernelSDKTS`](../../kernelSDKTS/) 已实现 **465个API**，覆盖 **37个模块**
    - 客户端工厂和类型系统已就绪
    - 所有 API 已完成核对验证（100%覆盖率）
  - **成果文件**: [`kernelSDKTS/`](../../kernelSDKTS/)

- [x] **Phase 0: 架构方案决策** [已完成]
  - **背景**: 需要确定 SDK 能力补齐的技术方案
  - **完成情况**: 已确定采用SDK层补齐hooks和可配置性方案（方案B）
  - **决策理由**: SDK直接提供完整能力、通过hooks实现可扩展性、可配置性适配特殊需求

---

## 📊 进度跟踪

- **总体进度**: 5% (SDK 基础实现完成，hooks和可配置性待开发)
- **当前阶段**: Phase 0 - 能力补齐与验证
- **下一里程碑**: 完成 Phase 0.1-0.3，实现SDK扩展并通过验证

### 注意事项

#### 类型安全要求
- **必须**使用 SDK 提供的类型定义，禁止使用 `any` 类型
- **必须**为所有 API 响应添加正确的类型注解
- **不得**使用 `@ts-ignore` 绕过类型检查

#### 错误处理统一
- **必须**保持与原有错误处理逻辑的兼容性
- **应该**利用 SDK 的统一错误类型定义
- **不得**简化或忽略现有的错误处理机制

#### 测试验证要求
- **必须**确保迁移前后功能行为完全一致
- **必须**运行相关单元测试并保持 100% 通过率
- **应该**进行充分的集成测试和用户验收测试

#### 性能考虑
- **应该**监控 API 调用性能，避免显著回归
- **不宜**在高频调用场景引入额外延迟
- **应该**考虑批量调用的优化可能性

### 风险评估

**高风险点**：
- 编辑器核心功能的稳定性
- 移动端兼容性问题
- 同步机制的时序正确性

**缓解措施**：
- 分阶段迁移，每阶段充分验证
- 建立回滚机制和应急预案
- 重点模块增加测试覆盖率

---

**文档创建**: 2026-02-02  
**最后更新**: 2026-02-02
