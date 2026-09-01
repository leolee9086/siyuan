/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构（commit 2c14808a25 "refactor: separate mobile and desktop host branches"）将单体 onboarding 模块按桌面/移动宿主拆分。
 * 本地替代/迁移到：onboarding/common.ts、onboarding/desktop.ts、onboarding/mobile.ts；辅助模块 onboarding/onboarding.guard.ts、onboarding/lifecycle/registry.ts、onboarding/lifecycle/state.types.ts
 * 上游 v3.8.0 对该文件的增量（经评审）：
 * 1. openDesktopOnboarding 在延时回调内复查 shouldShowOnboarding()，改为先渲染引导面板再打开引导文档；
 * 2. 仅当无已打开编辑器页签且无 URI 文档 ID 时才自动打开引导文档（新增 getAllTabs("Editor") 与 parseUriInfo 判断），避免会话恢复时重复弹引导；
 * 3. 新增模块级 openingOnboardingDocument 防重入标志，openFileById 失败时 console.warn 记录日志；
 * 4. 导入调整：util/pathName 增加 parseUriInfo，桌面分支新增 layout/getAll 的 getAllTabs。
 * 增量去向：防重复打开修复尚未移植，TODO 移植到 app/src/onboarding/desktop.ts 的 openDesktopOnboarding/showDesktopOnboarding；
 * 上游新增符号的本地对应位置：getAllTabs 位于 app/src/layout/getAll.ts；parseUriInfo 位于 app/src/util/uri/protocol.ts。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */

export {};
