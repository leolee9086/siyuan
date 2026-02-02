# API 请求重构系统性迁移

## 问题描述

### 现象
项目中存在300+处 [`fetchPost`](app/src/util/fetch.ts) 和 [`fetchPostSync`](app/src/util/fetch.ts) 调用，缺乏类型安全保障，容易产生运行时错误。

### 根本原因
历史代码使用原始的 HTTP 请求方式，未采用类型化的 API 客户端：

```typescript
// 当前方式：缺乏类型安全
const response = await fetchPost('/api/block/getBlockInfo', { id: blockId });
// response.data 类型为 any，无编译时检查

// 目标方式：完整类型支持
const response = await kernelSDK.getBlockInfo({ id: blockId });
// response.data 有完整的 IBlock 类型定义
```

**类型安全问题**：
- API 请求参数无类型验证
- 响应数据结构无类型保障  
- 错误处理缺乏统一标准
- 重构时容易引入回归错误

---

## 影响范围

### SDK 实现状态
- ✅ [`kernelSDKTS`](kernelSDKTS/) 已实现 **465个API**，覆盖 **37个模块**
- ✅ 客户端工厂和类型系统已就绪
- ✅ 所有API已完成核对验证（100%覆盖率）

### fetchPost 调用分布（共 300+ 处）

| 目录 | 调用数量 | 主要用途 | 复杂度 |
|------|---------|---------|--------|
| [`app/src/protyle/`](app/src/protyle/) | ~120+ | 编辑器核心功能 | 🔴 高 |
| [`app/src/mobile/`](app/src/mobile/) | ~50+ | 移动端设置和菜单 | 🔴 高 |
| [`app/src/layout/`](app/src/layout/) | ~30+ | 布局和Dock组件 | 🟡 中 |
| [`app/src/menus/`](app/src/menus/) | ~25+ | 菜单操作 | 🟡 中 |
| [`app/src/search/`](app/src/search/) | ~20+ | 搜索功能 | 🟡 中 |
| [`app/src/util/`](app/src/util/) | ~20+ | 工具函数 | 🟢 低 |
| [`app/src/sync/`](app/src/sync/) | ~10+ | 同步功能 | 🟢 低 |
| [`app/src/window/`](app/src/window/) | ~5+ | 窗口管理 | 🟢 低 |
| [`app/src/plugin/`](app/src/plugin/) | ~5+ | 插件系统 | 🟢 低 |

---

## 修复方案

### 方案 A：渐进式迁移（推荐）

采用分批次、按模块迁移的策略：

```typescript
// 迁移模式示例
import { 创建客户端 } from '@siyuan/kernel-sdk';
import { blockApiDefs } from '@siyuan/kernel-sdk/apiDefs';

const blockClient = 创建客户端(blockApiDefs, {
  baseUrl: 'http://127.0.0.1:6806',
  apiToken: window.siyuan?.config?.api?.token
});

// 迁移前
const response = await fetchPost('/api/block/getBlockInfo', { id: blockId });

// 迁移后  
const response = await blockClient.getBlockInfo({ id: blockId });
```

**优势**：
- 风险可控，可逐步验证
- 保持系统稳定性
- 便于回滚和问题定位
- 团队学习成本分散

### 方案 B：模块级整体迁移

按功能模块一次性迁移所有相关调用。

**劣势**：风险较高，不推荐用于核心模块。

---

## 任务分解

### 阶段 1：低风险模块迁移 🟢
**目标**：验证迁移流程，建立最佳实践

#### 1.1 工具函数模块（~20处）
- [ ] 迁移 [`app/src/util/`](app/src/util/) 目录下的 fetchPost 调用
- [ ] 重点关注 [`cronjobApi.ts`](app/src/util/cronjobApi.ts) 和 [`fetch.ts`](app/src/util/fetch.ts)
- [ ] 验证工具函数的类型安全性
- [ ] 建立迁移模板和规范

#### 1.2 同步功能模块（~10处）  
- [ ] 迁移 [`app/src/sync/`](app/src/sync/) 目录下的API调用
- [ ] 确保同步逻辑的时序正确性
- [ ] 验证错误处理的一致性

#### 1.3 窗口管理模块（~5处）
- [ ] 迁移 [`app/src/window/`](app/src/window/) 目录下的调用
- [ ] 重点关注 [`init.ts`](app/src/window/init.ts) 和 [`setHeader.ts`](app/src/window/setHeader.ts)
- [ ] 验证窗口操作的稳定性

#### 1.4 插件系统模块（~5处）
- [ ] 迁移 [`app/src/plugin/`](app/src/plugin/) 目录下的调用  
- [ ] 确保插件API的向后兼容性
- [ ] 测试插件加载和通信机制

### 阶段 2：中等复杂度模块迁移 🟡
**目标**：处理业务逻辑相对复杂的模块

#### 2.1 搜索功能模块（~20处）
- [ ] 迁移 [`app/src/search/`](app/src/search/) 目录下的调用
- [ ] 重点关注搜索结果的类型定义
- [ ] 验证搜索性能无回归

#### 2.2 菜单操作模块（~25处）  
- [ ] 迁移 [`app/src/menus/`](app/src/menus/) 目录下的调用
- [ ] 确保菜单事件处理的正确性
- [ ] 验证上下文菜单的功能完整性

#### 2.3 布局和Dock模块（~30处）
- [ ] 迁移 [`app/src/layout/`](app/src/layout/) 目录下的调用
- [ ] 重点关注Dock组件的状态管理
- [ ] 验证布局切换的稳定性

### 阶段 3：核心模块迁移 🔴  
**目标**：处理最复杂和最关键的模块

#### 3.1 移动端模块（~50处）
- [ ] 制定移动端专项迁移计划
- [ ] 迁移 [`app/src/mobile/settings/`](app/src/mobile/settings/) 配置相关调用
- [ ] 迁移 [`app/src/mobile/dock/`](app/src/mobile/dock/) Dock相关调用  
- [ ] 迁移 [`app/src/mobile/util/`](app/src/mobile/util/) 工具函数调用
- [ ] 全面测试移动端功能

#### 3.2 编辑器核心模块（~120处）
- [ ] 制定编辑器专项迁移计划
- [ ] 按子模块分批迁移：
  - [ ] [`app/src/protyle/render/`](app/src/protyle/render/) 渲染相关
  - [ ] [`app/src/protyle/toolbar/`](app/src/protyle/toolbar/) 工具栏相关  
  - [ ] [`app/src/protyle/breadcrumb/`](app/src/protyle/breadcrumb/) 面包屑相关
  - [ ] 其他编辑器子模块
- [ ] 重点验证编辑器性能和稳定性

### 阶段 4：验证和优化 ✅
- [ ] 全面回归测试
- [ ] 性能基准对比
- [ ] 清理遗留的 fetchPost 导入
- [ ] 更新相关文档和类型定义
- [ ] 建立长期维护机制

---

## 注意事项

### 类型安全要求
- **必须**使用 SDK 提供的类型定义，禁止使用 `any` 类型
- **必须**为所有 API 响应添加正确的类型注解
- **不得**使用 `@ts-ignore` 绕过类型检查

### 错误处理统一
- **必须**保持与原有错误处理逻辑的兼容性
- **应该**利用 SDK 的统一错误类型定义
- **不得**简化或忽略现有的错误处理机制

### 测试验证要求
- **必须**确保迁移前后功能行为完全一致
- **必须**运行相关单元测试并保持100%通过率
- **应该**进行充分的集成测试和用户验收测试

### 性能考虑
- **应该**监控 API 调用性能，避免显著回归
- **不宜**在高频调用场景引入额外延迟
- **应该**考虑批量调用的优化可能性

---

## 风险评估

**高风险点**：
- 编辑器核心功能的稳定性
- 移动端兼容性问题  
- 同步机制的时序正确性

**缓解措施**：
- 分阶段迁移，每阶段充分验证
- 建立回滚机制和应急预案
- 重点模块增加测试覆盖率

---

## 成功标准

1. **功能完整性**：所有现有功能正常工作，无回归错误
2. **类型安全性**：所有 API 调用具有完整的 TypeScript 类型支持  
3. **代码质量**：消除所有 fetchPost/fetchPostSync 调用
4. **性能稳定**：API 调用性能无显著下降
5. **维护性提升**：代码更易理解和维护，减少运行时错误

**任务状态：规划完成，等待执行** 📋