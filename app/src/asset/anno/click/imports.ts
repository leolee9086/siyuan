/** 用途：系统存储常量。使用范围：外部标注事件；解耦评估：稳定共享常量。 */
import {Constants} from "../../../constants";
/** 导出系统存储常量。 */
export {Constants};

/** 用途：写入持久化存储。使用范围：外部标注事件；解耦评估：稳定存储实现。 */
import {setStorageVal} from "../../../util/storage/setStorageVal";
/** 导出持久化存储写入。 */
export {setStorageVal};

/** 用途：读取运行时存储。使用范围：外部标注事件；解耦评估：稳定环境边界。 */
import {getSiyuanStorage} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出运行时存储读取。 */
export {getSiyuanStorage};

/** 用途：更新矩形选区状态。使用范围：外部标注事件；解耦评估：Anno 领域唯一状态实现。 */
import {setRectElement} from "../state/selection";
/** 导出矩形选区状态更新。 */
export {setRectElement};

/** 用途：标注常量。使用范围：外部颜色事件；解耦评估：Anno 领域常量。 */
import {AnnoConstants} from "../constants";
/** 导出标注常量。 */
export {AnnoConstants};

/** 用途：复制标注。使用范围：外部颜色事件完成后；解耦评估：Anno 领域唯一实现。 */
import {copyAnno} from "../anno.copy";
/** 导出复制标注动作。 */
export {copyAnno};

/** 用途：计算 Range 高亮坐标。使用范围：外部颜色事件；解耦评估：Anno 领域唯一实现。 */
import {getHightlightCoordsByRange} from "../anno.getHightlightCoordsByRange";
/** 导出 Range 高亮坐标计算。 */
export {getHightlightCoordsByRange};

/** 用途：隐藏标注工具栏。使用范围：外部事件收尾；解耦评估：Anno 领域唯一实现。 */
import {hideToolbar} from "../anno.hideToolbar";
/** 导出隐藏标注工具栏。 */
export {hideToolbar};

/** 用途：显示高亮标注。使用范围：外部颜色事件；解耦评估：Anno 领域唯一实现。 */
import {showHighlight} from "../anno.showHighlight";
/** 导出显示高亮标注。 */
export {showHighlight};

/** 用途：PDF 实例领域类型。使用范围：外部事件参数；解耦评估：纯类型依赖。 */
import type {IPdfInstance} from "../anno.types";
/** 导出 PDF 实例领域类型。 */
export type {IPdfInstance};
