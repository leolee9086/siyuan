/** 用途：显示目标缺失消息；使用范围：完成阶段；解耦评估：直达消息唯一实现。 */
import {showMessage} from "../../../../../dialog/message";
/** 导出消息能力。 */
export {showMessage};

/** 用途：清除旧单元格选择；使用范围：表格目标选择；解耦评估：直达选择唯一实现。 */
import {clearSelect} from "../../../../util/clearSelect";
/** 导出清选能力。 */
export {clearSelect};

/** 用途：添加表格拖拽填充柄；使用范围：目标选择；解耦评估：直达装饰唯一实现。 */
import {addDragFill} from "../../cell/decoration";
/** 导出拖拽填充装饰。 */
export {addDragFill};

/** 用途：滚动明确目标到编辑器中心；使用范围：定位完成；解耦评估：直达无编辑器状态依赖的 DOM 滚动唯一实现。 */
import {scrollTargetIntoView} from "../../../../../util/DOM/scrollTarget";
/** 导出纯目标滚动能力。 */
export {scrollTargetIntoView};

/** 用途：读取当前定位请求；使用范围：完成呈现；解耦评估：直达状态真实所有者。 */
import {getAVLocateRequest} from "../state/state";
/** 导出定位请求读取。 */
export {getAVLocateRequest};

/** 用途：清除当前定位请求；使用范围：完成呈现；解耦评估：直达状态真实所有者。 */
import {clearAVLocateRequest} from "../state/state";
/** 导出定位请求清理。 */
export {clearAVLocateRequest};

/** 用途：读取统一定位状态；使用范围：高亮呈现；解耦评估：直达状态真实所有者。 */
import {getAVLocateRegistry} from "../state/state";
/** 导出统一定位状态读取。 */
export {getAVLocateRegistry};

/** 用途：清除旧定位高亮；使用范围：新高亮开始前；解耦评估：直达状态生命周期所有者。 */
import {clearLocatedHighlight} from "../state/state";
/** 导出高亮清理。 */
export {clearLocatedHighlight};

/** 用途：持久化视图切换；使用范围：完成呈现；解耦评估：直达定位状态真实所有者。 */
import {persistAVLocateView} from "../state/state";
/** 导出视图持久化能力。 */
export {persistAVLocateView};
