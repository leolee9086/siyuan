/**
 * Block 模块外部依赖转发
 * 集中管理父级目录导入，便于依赖追踪和解耦
 */

// 用途：在新窗口中打开指定块；使用范围：Panel.actions.ts 中 Electron 环境下打开引用块；解耦评估：窗口管理功能，可通过事件机制解耦，但作为全局基础设施直接导入更合理
import { openNewWindowById } from "../window/openNewWindow";
// 用途：检查块是否折叠并执行回调；使用范围：Panel.actions.ts 中粘贴标签页前检查折叠状态；解耦评估：平台相关工具函数，可通过参数传递解耦，但作为平台基础设施直接导入更合理
import {checkFold} from "./fold/checkFold";
// 用途：判断当前是否为 Electron 环境；使用范围：Panel.actions.ts 中判断是否支持新窗口打开；解耦评估：平台检测工具，通过参数传递即可使用，已充分解耦
import { isElectron } from "../platform";
// 用途：获取国际化文本；使用范围：Panel.actions.ts 中设置固定按钮的 aria-label；解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
// 用途：系统常量配置；使用范围：block 模块使用全局常量；解耦评估：全局配置，可通过参数注入解耦，但作为全局基础设施直接导入更合理
import { Constants } from "../constants";
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
import { getEditorRange, getUndoFocusContext } from "../protyle/util/selection";
// 用途：将块元素提升到可独立操作的顶层块；使用范围：块插入目标解析流程中规范化插入锚点；解耦评估：可通过策略函数注入解耦，但该规则属于编辑器核心语义，集中复用该工具更一致
import { getTopAloneElement } from "../protyle/wysiwyg/getBlock";
// 用途：获取全局浮窗面板列表；使用范围：Panel.ts 中管理浮窗层级和清理；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanBlockPanels } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取全局菜单实例；使用范围：Panel.ts 中销毁浮窗时清理关联菜单；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanMenus } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：递增并获取全局z-index；使用范围：Panel.ts 中点击浮窗时提升层级；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { incrementSiyuanZIndex } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取 siyuan 配置；使用范围：block 模块读取配置；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：检查 siyuan 配置是否存在；使用范围：block 模块初始化守卫；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { hasSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取键盘修饰键状态；使用范围：block 模块交互判断；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanKeyboardState } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取当前拖拽元素；使用范围：block 模块拖拽状态；解耦评估：全局状态访问，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanDragElement } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：AppFacade 类型定义；使用范围：Panel.ts 和 Panel.actions.ts 中函数参数类型标注；解耦评估：核心类型定义，作为类型导入不影响运行时
import type { AppFacade } from "../app/AppFacade.types";
// 用途：Protyle 编辑器类；使用范围：Panel.ts 和 Panel.observer.types.ts 中编辑器实例类型标注；解耦评估：核心类型定义
import { Protyle } from "../protyle";
/*
 * 用途：生成列表项块元素。
 * 使用范围：block/util.createNewBlockElement.ts 的列表项插入分支。
 * 解耦评估：可通过工厂函数参数注入解耦，但该能力属于块构建核心语义，
 * 集中转发更便于统一维护。
 */
import { genListItemElement } from "../protyle/wysiwyg/list";
/*
 * 用途：在超级块取消时获取可编辑区域节点。
 * 使用范围：block/util.cancelSB.ts 光标回填分支。
 * 解耦评估：可通过参数传入目标元素解耦，但调用方统一基于块节点处理，
 * 由 block 模块集中转发可降低重复依赖声明。
 */
import {getContenteditableElement} from "../protyle/wysiwyg/getBlock";
/*
 * 用途：在嵌入块需要重建面包屑时触发块渲染。
 * 使用范围：block/util.cancelSB.ts 处理 NodeBlockQueryEmbed 分支。
 * 解耦评估：可通过事件发射触发渲染解耦，但当前渲染依赖 protyle 上下文，
 * 直接复用核心渲染函数可避免事件链路额外开销。
 */
import {blockRender} from "../protyle/render/blockRender";
/*
 * 用途：在超级块结构变更后重新渲染数学公式。
 * 使用范围：block/util.cancelSB.ts 完成节点移动后统一重绘。
 * 解耦评估：可通过渲染调度器注入解耦，但数学渲染是编辑器基础能力，
 * 集中转发可保持调用路径稳定。
 */
import { mathRender } from "../protyle/render/mathRender";
/*
 * 用途：在插入 wbr 锚点后恢复光标位置。
 * 使用范围：block/util.cancelSB.ts 子块提升流程中的焦点回填。
 * 解耦评估：可通过调用方传入聚焦策略解耦，但焦点恢复规则与编辑器实现强相关，
 * 保持直接依赖可降低行为偏差风险。
 */
import { focusByWbr } from "../protyle/util/selection.range";
/*
 * 用途：解析当前块的父级块节点。
 * 使用范围：block/util.cancelSB.ts 计算 move 操作 parentID。
 * 解耦评估：可通过参数传入父级 ID 解耦，但该信息与 DOM 结构同步变化，
 * 由函数内部实时解析更能保证一致性。
 */
import {
    getEmbedChildOperationParentID,
    getParentBlock,
    getPreviousBlockSibling,
} from "../protyle/wysiwyg/getBlock";
/*
 * 用途：在特殊视图下查询块的兄弟与父级 ID。
 * 使用范围：block/util.cancelSB.ts showAll/反链模式下兜底定位。
 * 解耦评估：可通过调用方预取后注入解耦，但会扩散网络编排职责，
 * 当前集中在 block 工具层调用可保持边界清晰。
 */
import { fetchSyncPost } from "../util/network/fetch";

// 窗口管理工具导出
export { openNewWindowById };
// 平台工具导出
export { checkFold };
// 平台检测工具导出
export { isElectron };
// 环境工具导出
export { siyuanI18n };
// 常量导出
export { Constants };
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
// 撤销操作焦点上下文工具导出
export { getUndoFocusContext };
// 块归一化工具导出
export { getTopAloneElement };
// 全局浮窗面板列表访问导出
export { getSiyuanBlockPanels };
// 全局菜单访问导出
export { getSiyuanMenus };
// 全局z-index管理导出
export { incrementSiyuanZIndex };
// siyuan 配置获取导出
export { getSiyuanConfig };
// siyuan 配置存在检查导出
export { hasSiyuanConfig };
// 键盘状态获取导出
export { getSiyuanKeyboardState };
// 拖拽元素获取导出
export { getSiyuanDragElement };
// 类型导出
export type { AppFacade };
// Protyle 编辑器类导出
export { Protyle };
// 列表项元素构建工具导出
export { genListItemElement };
// 可编辑区域解析工具导出
export { getContenteditableElement };
// 块渲染工具导出
export { blockRender };
// 数学渲染工具导出
export { mathRender };
// 光标恢复工具导出
export { focusByWbr };
// 父块解析工具导出
export { getParentBlock };
// 嵌入块操作父级解析工具导出
export { getEmbedChildOperationParentID };
// 前序块解析工具导出
export { getPreviousBlockSibling };
// 同步请求工具导出
export { fetchSyncPost };

// 用途：隐藏 Tooltip 与读取当前触发元素；使用范围：Popover 相关模块；解耦评估：UI 工具函数
import { hideTooltip } from "../dialog/tooltip";
// 导出 hideTooltip
export { hideTooltip };

// 用途：触屏设备判断；使用范围：block 模块交互适配；解耦评估：平台检测工具
import { isTouchDevice } from "../util/platform/functions";
// 导出 isTouchDevice
export { isTouchDevice };

// 用途：安全的 setTimeout；使用范围：block 模块延迟操作；解耦评估：环境工具
import { setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
// 导出 setTimeout
export { setTimeout };

// 用途：通过属性值查找祖先元素；使用范围：block 模块 DOM 定位；解耦评估：DOM 工具函数
import { hasClosestByAttribute } from "../protyle/util/hasClosest";
// 导出 hasClosestByAttribute
export { hasClosestByAttribute };

// 用途：鼠标事件守卫（含事件路径）；使用范围：block 模块事件处理；解耦评估：类型守卫工具
import { asMouseEventWithPath } from "../util/lib/events/event.guard";
// 导出 asMouseEventWithPath
export { asMouseEventWithPath };
// 用途：鼠标事件 HTML 目标守卫；使用范围：block 模块事件处理；解耦评估：类型守卫工具
import { isMouseEventWithHTMLTarget } from "../util/lib/events/event.guard";
// 导出 isMouseEventWithHTMLTarget
export { isMouseEventWithHTMLTarget };

// 用途：鼠标事件路径类型；使用范围：block 模块类型标注；解耦评估：类型定义
import type { MouseEventWithPath } from "../util/lib/events/event.guard";
// 导出 MouseEventWithPath 类型
export type { MouseEventWithPath };
// 用途：HTML 目标鼠标事件类型；使用范围：block 模块类型标注；解耦评估：类型定义
import type { MouseEventWithHTMLTarget } from "../util/lib/events/event.guard";
// 导出 MouseEventWithHTMLTarget 类型
export type { MouseEventWithHTMLTarget };

// 用途：HTMLElement 类型守卫；使用范围：block 模块 DOM 类型安全；解耦评估：类型守卫工具
import { isHTMLElement } from "../util/DOM/element.guard";
// 导出 isHTMLElement
export { isHTMLElement };

// 用途：列表排序更新；使用范围：block 模块有序列表操作；解耦评估：Protyle 工具函数
import { updateListOrder } from "../protyle/wysiwyg/list.updateOrder";
// 导出 updateListOrder
export { updateListOrder };

// 用途：事务处理和合并；使用范围：block 模块块操作；解耦评估：Protyle 核心工具
import {transaction} from "../protyle/wysiwyg/transaction/submit";
// 导出 transaction
export { transaction };
// 用途：合并为单个事务；使用范围：block 模块合并操作；解耦评估：Protyle 核心工具
import {turnsIntoOneTransaction} from "../protyle/wysiwyg/transaction/turns/container";
// 导出 turnsIntoOneTransaction
export { turnsIntoOneTransaction };
// 用途：更新事务；使用范围：block 模块事务更新；解耦评估：Protyle 核心工具
import {updateTransaction} from "../protyle/wysiwyg/transaction/update";
// 导出 updateTransaction
export { updateTransaction };

// 用途：滚动居中到高亮块；使用范围：block 模块编辑器定位；解耦评估：DOM 工具函数
import { scrollCenter } from "../util/DOM/highlightById";
// 导出 scrollCenter
export { scrollCenter };

// 用途：网络请求（POST）；使用范围：block 模块数据获取；解耦评估：网络工具
import { fetchPost } from "../util/network/fetch";
// 导出 fetchPost
export { fetchPost };
