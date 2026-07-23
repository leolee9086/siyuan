/** 用途：识别块引用拖放 MIME。使用范围：仅 DnD 块引用路由。解耦评估：常量是稳定协议标识，经本目录入口复用无需宿主参数。 */
import {Constants} from "../../../constants";
/** 用途：解析跨组件块引用载荷。使用范围：仅 DnD 块引用 drop。解耦评估：复用共享纯函数避免宿主重复解析。 */
import {parseBlockReferenceDropData} from "../../../util/blockReferenceDrop.guard";
/** 用途：排除嵌入块落点。使用范围：仅块引用光标指示。解耦评估：无状态 DOM 查询适合经本目录入口复用。 */
import {hasClosestByAttribute} from "../hasClosest";
/** 用途：阻断数据库目标。使用范围：仅块引用拖放。解耦评估：无状态 DOM 查询适合经本目录入口复用。 */
import {hasClosestByClassName} from "../hasClosest";
/** 用途：按鼠标位置创建 Range。使用范围：仅块引用光标指示。解耦评估：复用 Selection 既有算法避免重复实现。 */
import {getRangeByPoint} from "../selection";
/** 用途：隐藏块引用光标线。使用范围：仅 DnD 块引用反馈。解耦评估：复用统一拖拽提示运行时。 */
import {hideCaretLine} from "../dragTip";
/** 用途：隐藏块引用动作提示。使用范围：仅 DnD 块引用反馈。解耦评估：复用统一拖拽提示运行时。 */
import {hideDragTip} from "../dragTip";
/** 用途：显示块引用光标线。使用范围：仅 DnD 块引用反馈。解耦评估：复用统一拖拽提示运行时。 */
import {showCaretLine} from "../dragTip";
/** 用途：显示块引用动作提示。使用范围：仅 DnD 块引用反馈。解耦评估：复用统一拖拽提示运行时。 */
import {showDragTip} from "../dragTip";

/** 块引用拖放协议常量。 */
export {Constants};
/** 块引用载荷解析能力。 */
export {parseBlockReferenceDropData};
/** 块属性祖先查询能力。 */
export {hasClosestByAttribute};
/** 块类名祖先查询能力。 */
export {hasClosestByClassName};
/** 鼠标位置 Range 能力。 */
export {getRangeByPoint};
/** 隐藏光标线能力。 */
export {hideCaretLine};
/** 隐藏拖拽提示能力。 */
export {hideDragTip};
/** 显示光标线能力。 */
export {showCaretLine};
/** 显示拖拽提示能力。 */
export {showDragTip};
