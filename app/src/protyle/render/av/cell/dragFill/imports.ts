/** 用途：提交拖拽填充 do/undo 操作。使用范围：填充事务收尾。解耦评估：直达 Protyle 事务唯一实现。 */
import {transaction} from "../../../../wysiwyg/transaction";
/** 导出事务提交 */
export {transaction};

/** 用途：定位目标单元格所属行。使用范围：按 rowID 组织填充值。解耦评估：直达 Protyle DOM 查询唯一实现。 */
import {hasClosestByClassName} from "../../../../util/hasClosest";
/** 导出类名祖先查询 */
export {hasClosestByClassName};

/** 用途：事务前恢复属性视图焦点。使用范围：拖拽填充交互收尾。解耦评估：直达选区领域唯一实现。 */
import {focusBlock} from "../../../../util/selection";
/** 导出块聚焦 */
export {focusBlock};

/** 用途：生成并回写单元格渲染。使用范围：填充结果即时 DOM 更新。解耦评估：直达 cell 渲染唯一实现。 */
import {renderCell, renderCellAttr} from "../render";
/** 导出单元格 HTML 渲染 */
export {renderCell};
/** 导出单元格属性回写 */
export {renderCellAttr};

/** 用途：从目标 DOM 读取原单元格值。使用范围：构造 undo 数据。解耦评估：直达 cell 值领域唯一实现。 */
import {genCellValueByElement} from "../../cell.value";
/** 导出 DOM 单元格值解析 */
export {genCellValueByElement};

/** 用途：解析目标单元格列类型。使用范围：DOM 值读取。解耦评估：复用 cell 位置领域唯一实现。 */
import {getTypeByCellElement} from "../position";
/** 导出单元格列类型解析 */
export {getTypeByCellElement};
