/**
 * Block 模块外部依赖转发
 * 集中管理父级目录导入，便于依赖追踪和解耦
 */

// 用途：在新窗口中打开指定块；使用范围：Panel.actions.ts 中 Electron 环境下打开引用块；解耦评估：窗口管理功能，可通过事件机制解耦，但作为全局基础设施直接导入更合理
import { openNewWindowById } from "../window/openNewWindow";
// 用途：在编辑器中打开指定文件；使用范围：Panel.actions.ts 中粘贴标签页操作时打开文件；解耦评估：编辑器核心功能，可通过依赖注入解耦，但作为核心业务功能直接导入更合理
import { openFileById } from "../editor/utils.openFileById";
// 用途：检查块是否折叠并执行回调；使用范围：Panel.actions.ts 中粘贴标签页前检查折叠状态；解耦评估：平台相关工具函数，可通过参数传递解耦，但作为平台基础设施直接导入更合理
import { checkFold } from "../util/platform/noRelyPCFunction";
// 用途：判断当前是否为 Electron 环境；使用范围：Panel.actions.ts 中判断是否支持新窗口打开；解耦评估：平台检测工具，通过参数传递即可使用，已充分解耦
import { isElectron } from "../platform";
// 用途：获取国际化文本；使用范围：Panel.actions.ts 中设置固定按钮的 aria-label；解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
// 用途：App 类型定义；使用范围：Panel.actions.ts 中函数参数类型标注；解耦评估：核心类型定义，作为类型导入不影响运行时
import type { App } from "../index";

// 窗口管理工具导出
export { openNewWindowById };
// 编辑器工具导出
export { openFileById };
// 平台工具导出
export { checkFold };
// 平台检测工具导出
export { isElectron };
// 环境工具导出
export { siyuanI18n };
// 类型导出
export type { App };
