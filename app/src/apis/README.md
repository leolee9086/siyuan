# 思源笔记 API 外部接口模块

`app/src/apis` 目录用于集成思源笔记与第三方外部服务的 API 交互逻辑。

## 目录结构与功能说明

### 1. ModelScope 集成
- **[modelscope/](file:///d:/dev/siyuan-note/app/src/apis/modelscope/)**
  专门负责与 [ModelScope (魔搭社区)](https://modelscope.cn/) 的 AI 模型服务进行交互。
  - **client.ts**: 实现 ModelScope 的请求客户端，处理身份验证与数据收发。
  - **types.ts**: 定义了 ModelScope 接口的请求与响应数据结构。
  - **utils.ts**: 包含 ModelScope 专用的辅助工具函数及数据校验逻辑。

---

## 注意事项
- 本目录下的模块通常作为底层服务，被 `app/src/ai` 或其他业务逻辑模块调用。
- 所有的外部请求均应遵循思源的网络请求规范，并支持必要的超时及重试机制。
