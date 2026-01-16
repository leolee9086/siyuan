# 思源笔记 TypeScript 全局类型定义

`app/src/types` 目录存放了贯穿整个前端项目的 TypeScript 声明文件（`.d.ts`）及核心模型定义。

## 目录结构与功能说明

- **[index.d.ts](file:///d:/dev/siyuan-note/app/src/types/index.d.ts)**
  应用级全局变量声明（如 `window.siyuan` 对象）及通用工具类型的定义。
- **[protyle.d.ts](file:///d:/dev/siyuan-note/app/src/types/protyle.d.ts)**
  Protyle 编辑器内核相关的接口（`IProtyle`, `IOptions` 等）类型补充。
- **[i18n.types.ts](file:///d:/dev/siyuan-note/app/src/types/i18n.types.ts)**
  自动生成的国际化多语言 Key 值映射表，为 `siyuanI18n` 提供强类型提示。
- **[config.d.ts](file:///d:/dev/siyuan-note/app/src/types/config.d.ts)**: 系统及其各模块配置项的深度类型定义。

---

## 维护原则
- 修改全局类型定义时需谨慎，以免由于类型破坏导致大规模的编译报错。
- 所有的 `.d.ts` 文件都不应包含运行时代码（如常量定义，除非使用 `const enum`）。
