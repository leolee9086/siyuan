/** 用途：删除前同步定位选区边界；使用范围：remove 焦点职责；解耦评估：Range 必须在 DOM 重排前同步更新，直接依赖唯一选区实现。 */
import {focusByWbr, setLastNodeRange} from "../../util/selection.range";
/** 用途：查询删除目标的前序块、末级块和可编辑节点；使用范围：remove 焦点职责；解耦评估：无状态 DOM 层级查询直接指向唯一实现，不经根删除编排器转发。 */
import {getContenteditableElement, getLastBlock, getPreviousBlock} from "../getBlock";

/** 导出前序块可编辑节点查询。 */
export {getContenteditableElement};
/** 导出块内末级业务块查询。 */
export {getLastBlock};
/** 导出前序业务块查询。 */
export {getPreviousBlock};
/** 导出 wbr 选区恢复能力。 */
export {focusByWbr};
/** 导出末端选区定位能力。 */
export {setLastNodeRange};
