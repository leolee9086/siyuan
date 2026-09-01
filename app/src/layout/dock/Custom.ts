/**
 * S-Forge 墓碑文件（Tombstone）。
 * 本文件在本地分支被有意删除：架构重构提交 93f5eee37b「refactor: isolate custom dock model domain」将 Custom 布局模型迁入独立领域目录，旧路径废弃。
 * 本地替代/迁移到：app/src/layout/dock/custom/Custom.ts。
 * 配套文件：app/src/layout/dock/custom/custom.types.ts、app/src/layout/dock/custom/imports.ts。
 * 上游 v3.8.0 对该文件的增量（经评审）：
 * 1. App 导入改为 import type {App}：纯类型导入，消除对 ../../index 的运行时依赖。
 * 2. 构造器内 destroy 赋值增加 if (typeof options.destroy === "function") 运行时守卫，避免以 undefined 覆盖回调字段。
 * 增量去向：
 * 1. 类型导入已被覆盖——custom/Custom.ts 以 import type {AppFacade} 引入宿主类型，无需移植。
 * 2. 守卫由类型系统承担——新实现的 destroy 字段类型为 (() => void) | undefined，undefined 是合法值且由调用侧判别，无需移植。
 * 冲突警告：app/src/protyle/render/av/openDatabaseRow.ts 第 12 行仍从本旧路径导入 {Custom}，会使该文件的模块解析失败。
 * 处置建议：将该导入改指 app/src/layout/dock/custom/Custom（参考 app/src/editor/databaseRow.ts 的现行用法）。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
