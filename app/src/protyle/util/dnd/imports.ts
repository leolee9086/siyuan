/** 用途：识别块引用拖放 MIME。使用范围：仅 DnD 块引用路由。解耦评估：常量是稳定协议标识，经本目录入口复用无需宿主参数。 */
import {Constants} from "../../../constants";
/** 用途：解析跨组件块引用载荷。使用范围：仅 DnD 块引用 drop。解耦评估：复用共享纯函数避免宿主重复解析。 */
import {parseBlockReferenceDropData} from "../../../util/blockReferenceDrop.guard";
/** 用途：排除嵌入块落点。使用范围：仅块引用光标指示。解耦评估：无状态 DOM 查询适合经本目录入口复用。 */
import {hasClosestByAttribute} from "../hasClosest";
/** 用途：定位最近的文档块；使用范围：属性视图画廊拖拽；解耦评估：复用统一块祖先算法，避免拖拽入口自行判断边界。 */
import {hasClosestBlock} from "../hasClosest";
/** 导出最近文档块查询能力。 */
export {hasClosestBlock};
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
/** 用途：维护超级块 DOM 与宽度操作。使用范围：块拖拽；解耦评估：直达 SuperBlock DOM 领域唯一实现。 */
import {genSBElement, refreshSbAndPersistWidth, refreshSbResize} from "../../../block/superBlock";

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
/** 创建超级块拖拽结构。 */
export {genSBElement};
/** 刷新超级块并持久化宽度。 */
export {refreshSbAndPersistWidth};
/** 刷新超级块尺寸。 */
export {refreshSbResize};

/** 用途：定位可编辑块内容；使用范围：块操作柄拖拽标题；解耦评估：编辑器结构查询由 wysiwyg 统一维护，参数传递无法替代 DOM 语义。 */
import {getContenteditableElement} from "../../wysiwyg/getBlock";
/** 导出可编辑元素查询能力，供 DnD 处理器复用。 */
export {getContenteditableElement};

/** 用途：设置原生拖拽提示 ghost；使用范围：块、分组和画廊拖拽；解耦评估：拖拽提示状态需走统一注册表，局部实现会破坏触摸桥接。 */
import {setDragTipGhost} from "../dragTip";
/** 导出拖拽 ghost 定位能力，供 DnD 处理器复用。 */
export {setDragTipGhost};
