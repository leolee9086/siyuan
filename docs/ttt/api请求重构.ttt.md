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
| 请求竞态控制 (reqId) | ✅ 已实现 | [`raceController.ts`](../../kernelSDKTS/src/utils/raceController.ts) |
| FormData 支持 | ❌ 缺失 | 文件上传场景无法工作 |
| HTTP 401 自动重载 | ✅ 已实现 | [`config.ts`](../../kernelSDKTS/src/types/config.ts) onUnauthorized |
| HTTP 403/404 优雅降级 | ✅ 已实现 | [`config.ts`](../../kernelSDKTS/src/types/config.ts) onForbidden/onNotFound |
| getFile 202 状态码处理 | ✅ 已实现 | [`config.ts`](../../kernelSDKTS/src/types/config.ts) on202Response |
| 事务 API 网络失败处理 | ✅ 已实现 | [`transactionHandler.ts`](../../kernelSDKTS/src/handlers/transactionHandler.ts) |
| Electron IPC 退出通知 | ✅ 已实现 | [`electronHandler.ts`](../../kernelSDKTS/src/handlers/electronHandler.ts) |
| processMessage 消息展示 | ✅ 已实现 | [`messageHandler.ts`](../../kernelSDKTS/src/handlers/messageHandler.ts) |
| 响应格式类型守卫 | ✅ 已实现 | [`responseValidator.ts`](../../kernelSDKTS/src/handlers/responseValidator.ts) |
| failCallback 机制 | ✅ 已实现 | [`config.ts`](../../kernelSDKTS/src/types/config.ts) failCallback |
| 自定义请求头 | ✅ 已实现 | [`config.ts`](../../kernelSDKTS/src/types/config.ts) headers |

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

## 🟢 近期计划 

### 迁移执行原则

> **重要约束**：
> 1. **单文件迁移**：每次仅允许迁移一个文件中的 fetchPost/fetchPostSync 调用
> 2. **强制校验**：每个文件迁移完成后，必须进行代码逻辑一致性校验
> 3. **经验总结**：每次迁移后必须总结经验和教训，记录到本文档
> 4. **用户确认**：必须经过用户同意后，才能开始下一个文件的迁移

### 单文件迁移流程

每个文件的迁移必须遵循以下流程：

1. **迁移前分析**
   - 识别文件中所有 fetchPost/fetchPostSync 调用点
   - 分析每个调用的参数类型和返回值处理
   - 记录复杂的错误处理逻辑

2. **执行迁移**
   - 逐个替换 fetchPost 调用为 SDK 方法
   - 保持原有的参数结构和返回值处理
   - 确保类型安全

3. **迁移后校验**
   - TypeScript 编译验证（无错误）
   - 代码逻辑一致性检查
   - 功能行为对比验证

4. **总结归档**
   - 记录迁移过程中的问题和解决方案
   - 总结经验教训
   - 等待用户确认后继续

---

- [ ] **Phase 1.1: 工具函数模块迁移 - 单文件逐个迁移 (~20处) (P1)**
  - **背景**: 低风险模块，用于验证迁移流程，建立最佳实践
  - **待迁移文件清单**（按优先级排序）:
    1. [ ] [`app/src/util/cronjobApi.ts`](../../app/src/util/cronjobApi.ts) - 定时任务API
    2. [ ] 其他 util 目录文件（待分析后补充）
  - **单文件迁移行动**:
    1. 分析目标文件中的所有 fetchPost 调用
    2. 逐个替换为 SDK 方法调用
    3. 运行 TypeScript 编译验证
    4. 进行代码逻辑一致性校验
    5. 总结经验教训
    6. **等待用户确认后继续下一个文件**
  - **验收标准**:
    - 当前文件所有 fetchPost 调用已迁移
    - TypeScript 编译无错误
    - 代码逻辑与迁移前一致
    - 经验教训已记录

- [ ] **Phase 1.2: 同步功能模块迁移 - 单文件逐个迁移 (~10处) (P1)**
  - **背景**: 同步功能对时序敏感，需要仔细验证
  - **待迁移文件清单**（待分析后补充）:
    1. [ ] 待确定
  - **单文件迁移行动**:
    1. 分析目标文件中的所有 fetchPost 调用
    2. 逐个替换为 SDK 方法调用
    3. 运行 TypeScript 编译验证
    4. 进行代码逻辑一致性校验（重点关注时序）
    5. 总结经验教训
    6. **等待用户确认后继续下一个文件**
  - **验收标准**:
    - 当前文件所有 fetchPost 调用已迁移
    - 同步功能正常工作
    - 时序行为无变化
    - 经验教训已记录

---

## 🟡 中期计划 

> **注意**：中期计划同样遵循单文件迁移原则，进入近期计划时需要细化为具体文件清单

- [ ] **Phase 1.3: 窗口管理模块迁移 - 单文件逐个迁移 (~5处) (P1)**
  - **背景**: 窗口管理涉及 Electron 集成
  - **待迁移文件清单**（进入近期计划时细化）:
    1. [ ] [`app/src/window/init.ts`](../../app/src/window/init.ts)
    2. [ ] [`app/src/window/setHeader.ts`](../../app/src/window/setHeader.ts)
    3. [ ] 其他文件待分析
  - **验收标准**:
    - 每个文件迁移后经过用户确认
    - 窗口操作正常
    - Electron 集成无异常

- [ ] **Phase 1.4: 插件系统模块迁移 - 单文件逐个迁移 (~5处) (P1)**
  - **背景**: 插件系统需要保持向后兼容性
  - **待迁移文件清单**（进入近期计划时细化）:
    1. [ ] 待分析
  - **验收标准**:
    - 每个文件迁移后经过用户确认
    - 插件加载正常
    - 插件 API 兼容

- [ ] **Phase 2.1: 搜索功能模块迁移 - 单文件逐个迁移 (~20处) (P1)**
  - **背景**: 搜索功能涉及竞态控制，是SDK hooks能力的重要验证场景
  - **待迁移文件清单**（进入近期计划时细化）:
    1. [ ] 待分析
  - **验收标准**:
    - 每个文件迁移后经过用户确认
    - 搜索功能正常
    - 竞态控制有效
    - 性能无回归

- [ ] **Phase 2.2: 菜单操作模块迁移 - 单文件逐个迁移 (~25处) (P1)**
  - **背景**: 菜单操作涉及多种 API 调用
  - **待迁移文件清单**（进入近期计划时细化）:
    1. [ ] 待分析
  - **验收标准**:
    - 每个文件迁移后经过用户确认
    - 所有菜单操作正常
    - 上下文菜单功能完整

- [ ] **Phase 2.3: 布局和Dock模块迁移 - 单文件逐个迁移 (~30处) (P1)**
  - **背景**: 布局模块涉及状态管理
  - **待迁移文件清单**（进入近期计划时细化）:
    1. [ ] 待分析
  - **验收标准**:
    - 每个文件迁移后经过用户确认
    - 布局切换正常
    - Dock 状态管理正确

---

## 🔴 远期计划 

> **注意**：远期计划同样遵循单文件迁移原则，进入中期/近期计划时需要细化为具体文件清单

- [ ] **Phase 3.1: 移动端模块迁移 - 单文件逐个迁移 (~50处) (P2)**
  - **愿景**: 完成移动端所有 API 调用迁移
  - **范围**: [`app/src/mobile/settings/`](../../app/src/mobile/settings/)、[`app/src/mobile/dock/`](../../app/src/mobile/dock/)、[`app/src/mobile/util/`](../../app/src/mobile/util/)
  - **迁移方式**: 进入近期计划时细化为具体文件清单，逐文件迁移

- [ ] **Phase 3.2: 编辑器核心模块迁移 - 单文件逐个迁移 (~120处) (P2)**
  - **愿景**: 完成编辑器核心所有 API 调用迁移
  - **范围**: [`app/src/protyle/render/`](../../app/src/protyle/render/)、[`app/src/protyle/toolbar/`](../../app/src/protyle/toolbar/)、[`app/src/protyle/breadcrumb/`](../../app/src/protyle/breadcrumb/)
  - **迁移方式**: 进入近期计划时细化为具体文件清单，逐文件迁移

- [ ] **Phase 4.1: 全面回归测试 (P3)**
  - **愿景**: 确保所有功能正常工作，无回归错误

- [ ] **Phase 4.2: 性能基准对比 (P3)**
  - **愿景**: 验证 API 调用性能无显著下降

- [ ] **Phase 4.3: 清理和文档更新 (P3)**
  - **愿景**: 清理遗留的 fetchPost 导入，更新相关文档和类型定义，建立长期维护机制

---

## 🏁 已归档/已完成

- [x] **Phase 0.3: SDK能力验证 (P0)** [2026-02-02 完成]
  - **背景**: 确保SDK具备替换 fetchPost 的完整能力
  - **完成情况**:
    - 创建了 [`kernelSDKTS/src/__tests__/testUtils.ts`](../../kernelSDKTS/src/__tests__/testUtils.ts) - 测试工具函数
    - 创建了 [`kernelSDKTS/src/__tests__/raceController.test.ts`](../../kernelSDKTS/src/__tests__/raceController.test.ts) - 竞态控制单元测试
    - 创建了 [`kernelSDKTS/src/__tests__/handlers.test.ts`](../../kernelSDKTS/src/__tests__/handlers.test.ts) - 处理器单元测试
    - TypeScript编译验证通过

- [x] **Phase 0.2: 实现错误处理和消息展示 (P0)** [2026-02-02 完成]
  - **背景**: 需要保持与原有错误处理逻辑的兼容性
  - **完成情况**:
    - 创建了 [`kernelSDKTS/src/handlers/transactionHandler.ts`](../../kernelSDKTS/src/handlers/transactionHandler.ts) - 事务API失败处理
    - 创建了 [`kernelSDKTS/src/handlers/electronHandler.ts`](../../kernelSDKTS/src/handlers/electronHandler.ts) - Electron IPC集成
    - 创建了 [`kernelSDKTS/src/handlers/messageHandler.ts`](../../kernelSDKTS/src/handlers/messageHandler.ts) - processMessage消息展示
    - 创建了 [`kernelSDKTS/src/handlers/responseValidator.ts`](../../kernelSDKTS/src/handlers/responseValidator.ts) - 响应格式类型守卫

- [x] **Phase 0.1.3: 定义钩子接口 (P0)** [2026-02-02 完成]
  - **背景**: 通过钩子机制实现可扩展性
  - **完成情况**:
    - 创建了 [`kernelSDKTS/src/hooks/types.ts`](../../kernelSDKTS/src/hooks/types.ts) - 9种钩子类型定义
    - 创建了 [`kernelSDKTS/src/hooks/manager.ts`](../../kernelSDKTS/src/hooks/manager.ts) - 钩子管理器实现
    - 支持注册多个钩子，执行顺序明确

- [x] **Phase 0.1.2: 实现竞态控制机制 (P0)** [2026-02-02 完成]
  - **背景**: 高频搜索/图谱场景需要防止响应覆盖
  - **完成情况**:
    - 创建了 [`kernelSDKTS/src/utils/raceController.ts`](../../kernelSDKTS/src/utils/raceController.ts)
    - 实现了 IRaceController 接口和竞态控制逻辑
    - 支持声明哪些API需要竞态控制，正确丢弃过期响应

- [x] **Phase 0.1.1: 定义可配置项 (P0)** [2026-02-02 完成]
  - **背景**: SDK需要支持可配置的行为以适配不同业务场景
  - **完成情况**:
    - 创建了 [`kernelSDKTS/src/types/config.ts`](../../kernelSDKTS/src/types/config.ts)
    - 实现了 ISDKConfig、IRequestConfig、ISDKResponse 等接口
    - 设计文档：[`plans/sdk-config-interface-design.md`](../../plans/sdk-config-interface-design.md)
    - 支持全局默认配置和单次请求覆盖

- [x] **Phase 0: 架构方案决策** [已完成]
  - **背景**: 需要确定 SDK 能力补齐的技术方案
  - **完成情况**: 已确定采用SDK层补齐hooks和可配置性方案（方案B）
  - **决策理由**: SDK直接提供完整能力、通过hooks实现可扩展性、可配置性适配特殊需求

- [x] **Phase 0: SDK 实现和验证** [已完成]
  - **背景**: 需要完成 kernelSDKTS 的实现和验证
  - **完成情况**:
    - [`kernelSDKTS`](../../kernelSDKTS/) 已实现 **465个API**，覆盖 **37个模块**
    - 客户端工厂和类型系统已就绪
    - 所有 API 已完成核对验证（100%覆盖率）
  - **成果文件**: [`kernelSDKTS/`](../../kernelSDKTS/)

---

## 📊 进度跟踪

- **总体进度**: 15% (SDK基础实现完成，hooks/可配置性/错误处理已实现，待集成到实际迁移)
- **当前阶段**: Phase 1 - 模块迁移准备
- **下一里程碑**: 完成 Phase 1.1-1.2，迁移工具函数和同步功能模块

### 注意事项

#### 单文件迁移约束（新增）
- **必须**每次仅迁移一个文件中的调用
- **必须**每个文件迁移后进行代码逻辑一致性校验
- **必须**总结经验教训并记录到本文档
- **必须**等待用户确认后才能继续下一个文件
- **不得**批量迁移多个文件
- **不得**跳过用户确认步骤

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

## 📝 迁移经验教训记录

> 此区域用于记录每次单文件迁移后的经验和教训，供后续迁移参考

### 记录模板

```markdown
#### [文件名] - [日期]
- **迁移内容**: 迁移了 X 处 fetchPost 调用
- **遇到的问题**:
  - 问题1描述
  - 问题2描述
- **解决方案**:
  - 解决方案1
  - 解决方案2
- **经验总结**:
  - 经验1
  - 经验2
- **用户确认**: ✅ 已确认 / ⏳ 待确认
```

### 已记录的经验

（暂无记录，待首次迁移后补充）

---

**文档创建**: 2026-02-02
**最后更新**: 2026-02-03
