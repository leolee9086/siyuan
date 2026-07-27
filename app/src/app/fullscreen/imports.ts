/** 用途：查询全部编辑器与递归窗口；使用范围：应用全屏协调；解耦评估：直达 Layout 查询实现。 */
import {getAllModels} from "../../layout/getAll";
/** 导出编辑器模型查询。 */
export {getAllModels};
/** 用途：递归收集布局窗口；使用范围：窗口拖拽区同步；解耦评估：直达 Layout 查询实现。 */
import {getAllWnds} from "../../layout/getAll";
/** 导出布局窗口查询。 */
export {getAllWnds};
/** 用途：完整布局窗口类型；使用范围：标题拖拽区更新；解耦评估：纯类型避免加载具体 Wnd。 */
import type {LayoutWindow} from "../../layout/layout.types";
/** 导出完整布局窗口类型。 */
export type {LayoutWindow};
/** 用途：平台判断；使用范围：移动端跳过桌面窗口协调；解耦评估：直达平台事实。 */
import {isMobile} from "../../platform";
/** 导出平台判断。 */
export {isMobile};
/** 用途：全屏过渡时长；使用范围：延迟隐藏 gutter；解耦评估：静态常量。 */
import {Constants} from "../../constants";
/** 导出应用常量。 */
export {Constants};
/** 用途：隐藏全部 gutter；使用范围：全屏动画结束后清理浮层；解耦评估：直达唯一 UI 实现。 */
import {hideAllElements} from "../../protyle/ui/hideElements";
/** 导出全局元素隐藏行为。 */
export {hideAllElements};
/** 用途：查找浮动 Dock 容器；使用范围：按钮式全屏变换；解耦评估：直达无状态 DOM 查询。 */
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
/** 导出 DOM 祖先查询。 */
export {hasClosestByClassName};
/** 用途：重算其它编辑器尺寸；使用范围：关闭冲突全屏实例；解耦评估：直达唯一 Protyle 行为。 */
import {resize} from "../../protyle/util/resize";
/** 导出编辑器尺寸重算。 */
export {resize};
/** 用途：独立窗口环境判断；使用范围：标题栏拖拽区同步；解耦评估：直达平台事实。 */
import {isWindow} from "../../util/platform/functions";
/** 导出独立窗口判断。 */
export {isWindow};
/** 用途：读取应用配置；使用范围：macOS 与窗口控件分支；解耦评估：直达环境访问器。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出应用配置读取。 */
export {getSiyuanConfig};
/** 用途：读取当前布局；使用范围：窗口拖拽区遍历；解耦评估：直达环境访问器。 */
import {getSiyuanLayout} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出应用布局读取。 */
export {getSiyuanLayout};
/** 用途：读取当前层级；使用范围：窗口控件恢复；解耦评估：直达环境访问器。 */
import {getSiyuanZIndex} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出当前层级读取。 */
export {getSiyuanZIndex};
/** 用途：递增全局层级；使用范围：窗口控件恢复；解耦评估：直达环境访问器。 */
import {incrementSiyuanZIndex} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出全局层级递增。 */
export {incrementSiyuanZIndex};
/** 用途：同步编辑器全屏状态；使用范围：普通 Protyle 全屏切换；解耦评估：直达环境访问器。 */
import {setSiyuanEditorIsFullscreen} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出编辑器全屏状态写入。 */
export {setSiyuanEditorIsFullscreen};
