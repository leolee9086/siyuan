# API Fetcher 实现计划

## 任务目标
为 account.ts 创建一个类型安全的 API Fetcher，支持：
1. 传入 API 的 host 和端口等配置
2. 通过 `$use(accountApiDefs)` 注册 API 定义
3. 支持通过英文和中文名称调用 API 方法
4. 保证类型安全

## 实现步骤

### 1. 创建 API Fetcher 核心类型定义
- 定义 API 配置接口
- 定义 API Fetcher 接口
- 定义泛型类型推断

### 2. 实现 API Fetcher 核心逻辑
- 创建 createApiFetcher 工厂函数
- 实现 $use 方法注册 API 定义
- 动态生成 API 方法（英文和中文名称）
- 实现请求发送逻辑

### 3. 实现类型安全
- 使用 zod schema 进行运行时验证
- 使用 TypeScript 类型推断确保编译时类型安全
- 实现请求和响应的类型推导

### 4. 创建使用示例
- 创建 fetcher 实例
- 注册 accountApiDefs
- 演示各种调用方式

## 文件结构
- `app/src/data/kernelAPI/apiFetcher.ts` - 核心 API Fetcher 实现
## 技术要求
- 遵循 DRY 原则
- 确保高性能实现
- 类型安全
- 支持中英文方法名
- 遵循项目编码规范