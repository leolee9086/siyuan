# API Fetcher 执行跟踪 (TikTocTak)

> **目标**: 为 [`account.ts`](../../app/src/data/kernelAPI/account.ts) 创建类型安全的 API Fetcher，支持配置化、类型推断和中英文方法名调用
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

### 设计原则
- **类型安全**: 使用 TypeScript 类型推断和 zod schema 确保编译时和运行时类型安全
- **DRY 原则**: 避免重复代码，通过泛型和工厂函数实现代码复用
- **高性能**: 选择性能最优的实现方案
- **双语支持**: 同时支持英文和中文方法名调用

### 验证检查清单
- [ ] 类型推断是否正确工作
- [ ] zod schema 验证是否生效
- [ ] 中英文方法名是否都能正常调用
- [ ] 请求和响应类型是否正确推导
- [ ] 是否遵循项目编码规范

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划 

- [ ] **Phase 1: 创建 API Fetcher 核心类型定义 (P0)**
  - **背景**: 需要为 API Fetcher 建立类型基础，确保后续实现的类型安全
  - **行动**:
    1. 定义 API 配置接口（host、port、timeout 等）
    2. 定义 API Fetcher 接口（$use 方法、动态方法等）
    3. 定义泛型类型推断（从 API 定义推导方法签名）
  - **验收标准**:
    - [ ] API 配置接口包含所有必需字段
    - [ ] API Fetcher 接口支持泛型类型参数
    - [ ] 类型推断能够正确推导方法签名
  - **参考文档**: [`app/src/data/kernelAPI/account.ts`](../../app/src/data/kernelAPI/account.ts)

- [ ] **Phase 2: 实现 API Fetcher 核心逻辑 (P0)**
  - **背景**: 实现 API Fetcher 的核心功能，包括方法注册和请求发送
  - **行动**:
    1. 创建 [`createApiFetcher`](../../app/src/data/kernelAPI/apiFetcher.ts) 工厂函数
    2. 实现 `$use()` 方法注册 API 定义
    3. 动态生成 API 方法（英文和中文名称）
    4. 实现请求发送逻辑（fetch 封装）
  - **验收标准**:
    - [ ] [`createApiFetcher()`](../../app/src/data/kernelAPI/apiFetcher.ts) 能够创建 fetcher 实例
    - [ ] `$use()` 能够注册 API 定义
    - [ ] 动态生成的方法能够正常调用
    - [ ] 请求能够正确发送到指定的 host 和 port
  - **参考文档**: 无

---

## 🟡 中期计划 

- [ ] **Phase 3: 实现类型安全验证 (P1)**
  - **背景**: 使用 zod schema 进行运行时验证，确保数据安全
  - **行动**:
    1. 使用 zod schema 进行请求参数验证
    2. 使用 zod schema 进行响应数据验证
    3. 实现类型推导（从 zod schema 推导 TypeScript 类型）
    4. 添加错误处理和类型保护

- [ ] **Phase 4: 创建使用示例和文档 (P1)**
  - **背景**: 提供清晰的使用示例，方便其他开发者使用
  - **行动**:
    1. 创建 fetcher 实例示例
    2. 演示注册 [`accountApiDefs`](../../app/src/data/kernelAPI/account.ts) 的方法
    3. 演示各种调用方式（英文名、中文名）
    4. 编写 API 文档

---

## 🏁 已归档/已完成

_暂无已完成任务_

---

## 📊 进度跟踪

- **总任务数**: 4
- **已完成**: 0
- **进行中**: 0
- **待开始**: 4
- **完成率**: 0%

---

## 📁 相关文件

- [`app/src/data/kernelAPI/apiFetcher.ts`](../../app/src/data/kernelAPI/apiFetcher.ts) - API Fetcher 核心实现（待创建）
- [`app/src/data/kernelAPI/account.ts`](../../app/src/data/kernelAPI/account.ts) - Account API 定义

---

## 📝 技术要求

- 遵循 DRY 原则
- 确保高性能实现
- 类型安全（编译时 + 运行时）
- 支持中英文方法名
- 遵循项目编码规范

---

**文档创建**: 2026-01-26  
**最后更新**: 2026-01-26  
**文档类型**: TikTocTak 执行跟踪文档
