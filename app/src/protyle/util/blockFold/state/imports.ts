/** 用途：重绘展开后的代码行号；使用范围：折叠状态应用；解耦评估：直达高亮渲染实现。 */
import {lineNumberRender} from "../../../render/highlightRender";
/** 用途：阻止折叠后滚动触发读取；使用范围：折叠状态完成阶段；解耦评估：直达滚动生命周期实现。 */
import {preventScroll} from "../../../scroll/preventScroll";
/** 用途：定位当前光标所属块；使用范围：折叠列表项焦点修复；解耦评估：直达 DOM 查询原语。 */
import {hasClosestBlock} from "../../hasClosest";
/** 用途：恢复折叠后的焦点；使用范围：隐藏子列表光标；解耦评估：直达选择工具实现。 */
import {focusBlock} from "../../selection";
/** 用途：让折叠目标保持可见；使用范围：折叠状态应用；解耦评估：直达滚动实现。 */
import {scrollCenter} from "../../../../util/DOM/highlightById";
/** 用途：清理折叠块中的媒体和 AV 选择；使用范围：进入折叠状态；解耦评估：直达选择清理实现。 */
import {clearSelect} from "../../clearSelect";
/** 用途：移除标题折叠的附属 DOM；使用范围：折叠标题；解耦评估：直达标题实现。 */
import {removeFoldHeading} from "../../heading";

/** 导出行号重绘。 */
export {lineNumberRender};
/** 导出滚动读取抑制。 */
export {preventScroll};
/** 导出块查询原语。 */
export {hasClosestBlock};
/** 导出焦点恢复。 */
export {focusBlock};
/** 导出视口滚动实现。 */
export {scrollCenter};
/** 导出选择清理实现。 */
export {clearSelect};
/** 导出标题折叠清理。 */
export {removeFoldHeading};
