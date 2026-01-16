# 思源笔记 Data (数据层) 模块

`app/src/data` 目录负责前端与后端（内核）之间的数据交换、底层持久化存储。

## 目录结构与功能说明

### 1. 内核 API 通讯
- **[kernelAPI/](file:///d:/dev/siyuan-note/app/src/data/kernelAPI/)**
  自动生成或手工维护的内核接口定义。包含了所有 `/api/...` 请求的输入输出类型约束及其对应的 Fetch 封装。

### 2. 浏览器持久化
- **[localStorage.ts](file:///d:/dev/siyuan-note/app/src/data/localStorage.ts)**
  封装了对 `Window.localStorage` 的访问，用于存储非文档数据（如 UI 折叠状态、搜索历史、临时配置等）。

---

## 注意事项
- 所有的内核请求都应当通过 `kernelAPI` 进行调用，以确保 TypeScript 类型的一致性。
- 修改 `localStorage` 键名时务必注意数据迁移与旧版本兼容问题。
