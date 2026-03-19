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
// 用途：判断是否为移动端；使用范围：Panel.ts 中判断是否启用拖拽调整大小功能；解耦评估：平台检测工具，通过参数传递即可使用，已充分解耦
import { isMobile } from "../platform";
// 用途：获取国际化文本；使用范围：Panel.actions.ts 中设置固定按钮的 aria-label；解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
// 用途：查找最近的指定类名祖先元素；使用范围：Panel.ts 中查找父级浮窗和图标容器；解耦评估：DOM工具函数，可通过参数传递解耦，但作为基础工具直接导入更合理
import { hasClosestByClassName } from "../protyle/util/hasClosest";
// 用途：生成唯一ID；使用范围：Panel.ts 中为浮窗实例生成唯一标识；解耦评估：工具函数，可通过参数传递解耦，但作为基础工具直接导入更合理
import { genUUID } from "../util/platform/genID";
// 用途：隐藏编辑器工具栏元素；使用范围：Panel.ts 中销毁编辑器时隐藏工具栏；解耦评估：编辑器UI操作，可通过依赖注入解耦，但作为编辑器核心功能直接导入更合理
import { hideElements } from "../protyle/ui/hideElements";
// 用途：启用对话框拖拽和调整大小功能；使用范围：Panel.ts 中为浮窗添加拖拽调整大小能力；解耦评估：UI交互功能，可通过依赖注入解耦，但作为基础UI功能直接导入更合理
import { moveResize } from "../dialog/moveResize";
/*
 * 用途：获取编辑器当前有效选区 Range。
 * 使用范围：块插入目标解析流程中用于定位光标所在节点。
 * 解耦评估：可通过参数传入 Range 解耦，但当前调用方统一依赖 protyle 实例，
 * 直接导入可减少样板代码。
 */
import { getEditorRange } from "../protyle/util/selection";
// 用途：将块元素提升到可独立操作的顶层块；使用范围：块插入目标解析流程中规范化插入锚点；解耦评估：可通过策略函数注入解耦，但该规则属于编辑器核心语义，集中复用该工具更一致
import { getTopAloneElement } from "../protyle/wysiwyg/getBlock";
// 用途：获取全局浮窗面板列表；使用范围：Panel.ts 中管理浮窗层级和清理；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanBlockPanels } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取全局菜单实例；使用范围：Panel.ts 中销毁浮窗时清理关联菜单；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanMenus } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：递增并获取全局z-index；使用范围：Panel.ts 中点击浮窗时提升层级；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { incrementSiyuanZIndex } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：App 类型定义；使用范围：Panel.ts 和 Panel.actions.ts 中函数参数类型标注；解耦评估：核心类型定义，作为类型导入不影响运行时
import type { App } from "../index";
// 用途：Protyle 编辑器类型定义；使用范围：Panel.ts 和 Panel.observer.types.ts 中编辑器实例类型标注；解耦评估：核心类型定义，作为类型导入不影响运行时
import type { Protyle } from "../protyle";

// 窗口管理工具导出
export { openNewWindowById };
// 编辑器工具导出
export { openFileById };
// 平台工具导出
export { checkFold };
// 平台检测工具导出
export { isElectron };
// 移动端检测工具导出
export { isMobile };
// 环境工具导出
export { siyuanI18n };
// DOM工具导出
export { hasClosestByClassName };
// ID生成工具导出
export { genUUID };
// 编辑器UI工具导出
export { hideElements };
// 对话框工具导出
export { moveResize };
// 编辑器选区工具导出
export { getEditorRange };
// 块归一化工具导出
export { getTopAloneElement };
// 全局浮窗面板列表访问导出
export { getSiyuanBlockPanels };
// 全局菜单访问导出
export { getSiyuanMenus };
// 全局z-index管理导出
export { incrementSiyuanZIndex };
// 类型导出
export type { App };
// Protyle 编辑器类型导出
export type { Protyle };
