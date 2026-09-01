/** 用途：恢复表格拖拽填充和刷新表头；使用范围：单元格动画完成阶段；解耦评估：直达装饰子域唯一实现。 */
import {addDragFill, updateHeaderCell} from "../../cell/decoration";
/** 用途：计算卡片单元格空态；使用范围：Gallery/Kanban 局部刷新；解耦评估：直达纯值规则。 */
import {cellValueIsEmpty} from "../../cell.value";
/** 用途：重新生成单元格 HTML 与属性；使用范围：局部动画刷新；解耦评估：直达渲染子域唯一实现。 */
import {renderCell, renderCellAttr} from "../../cell/render";
/** 用途：定位当前属性视图根；使用范围：读取视图类型；解耦评估：直达共享 DOM 查询原语。 */
import {hasClosestBlock} from "../../../../util/hasClosest";
/** 用途：收窄动画涉及的 DOM 节点；使用范围：图标与卡片父容器；解耦评估：直达通用元素守卫。 */
import {isHTMLElement} from "../../../../../util/DOM/element.guard";

/** 用途：渲染属性面板字段的自定义图标。使用范围：跨实例列元数据同步。 */
import {unicode2Emoji} from "../../../../../emoji";
/** 用途：回退到字段类型图标。使用范围：清空自定义字段图标时。 */
import {getColIconByType} from "../../col/col.typeUtils";
export {unicode2Emoji, getColIconByType};

/** 导出拖拽填充恢复实现。 */
export {addDragFill};
/** 导出表头刷新实现。 */
export {updateHeaderCell};
/** 导出单元格空态规则。 */
export {cellValueIsEmpty};
/** 导出单元格渲染实现。 */
export {renderCell};
/** 导出单元格属性补充实现。 */
export {renderCellAttr};
/** 导出属性视图根查询。 */
export {hasClosestBlock};
/** 导出 HTMLElement 守卫。 */
export {isHTMLElement};
