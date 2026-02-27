# util 目录剩余条目调查

调查时间: 2026-02-27  
调查路径: `app/src/util/`

## 顶层文件

- `assets.ts` — 资源加载与管理（样式、脚本、主题切换等），296行
- `README.md` — 模块说明文档
- `tiktoktac.zhinote.md` — 模块任务追踪笔记

## 子目录

| 目录 | 文件数 | 简要功能 |
|------|--------|----------|
| `assets/` | 8 | 资源相关工具：背景样式、颜色处理、CSS变量提取、图片处理、代码主题设置、内联样式 |
| `code/` | 11 | 代码执行引擎：配置管理、脚本执行器工厂、JSON宽松解析、包权限管理 |
| `dialog/` | 1 | Vue对话框创建（`createVueDialog.ts`） |
| `DOM/` | 18 | DOM操作工具集：清除按钮、块装饰、元素守卫、转义、高亮、Range操作、滚动、定位、上下提示 |
| `embedding/` | 3 | 向量嵌入：transformer、向量API及其类型 |
| `events/` | 6 | 事件系统：事件发射器核心、守卫、类型、工具函数 |
| `file/` | 16 | 文件操作：HTML生成、保存路径、挂载、移动路径（含多个子模块）、新建文件、路径名、树 |
| `logger/` | 4 | 日志系统：核心、格式化器、入口、类型定义 |
| `navigation/` | 2 | 导航功能：前进后退（`backForward.ts`）、焦点栈（`focusStack.ts`） |
| `network/` | 10 | 网络通信：cronjob API/认证/类型、fetch封装/守卫/类型、流式请求、消息处理、ServiceWorker |
| `noteDatas/` | 1 | 笔记数据：ID处理（`id.ts`） |
| `pathRouter/` | 15 | 路径路由器：基础层、路由匹配、HTTP方法路由、中间件注册等（含1个readme + core子目录14文件） |
| `platform/` | 6 | 平台适配：通用函数、ID生成、iOS购买、订阅判断、PC功能检测、拼音 |
| `ptrinet/` | 1 | Petri网：仅含设计文档（`core/design.md`） |
| `siyuanEnvironments/` | 27 | 思源环境抽象层：窗口、配置、快捷键、对话框、菜单、国际化、echarts、PDF.js等环境适配器 |
| `vue/` | 9 | Vue 3集成：上下文模型、挂载、wrapper子目录（断言类型、核心、工厂、IO、类型、工具） |
| `zodMethodDefinedClass/` | 9 | Zod方法定义类：深度比较、深度原始值、子类判断、层级、模式路由及其守卫/内部/类型 |

## 统计

- 顶层文件: 3个
- 子目录: 17个
- 子目录内文件总计: 约147个
