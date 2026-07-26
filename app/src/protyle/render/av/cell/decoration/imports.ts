/** 用途：Unicode 图标渲染。使用范围：表头 Emoji 更新。解耦评估：直达 emoji 渲染唯一实现。 */
import {unicode2Emoji} from "../../../../../emoji/emoji.render";
/** 导出 Unicode 图标渲染 */
export {unicode2Emoji};

/** 用途：列类型图标与 DOM 值收窄。使用范围：表头默认图标和拖拽规则。解耦评估：直达 col 领域唯一实现。 */
import {getColIconByType, toTAVCol} from "../../col/col.typeUtils";
/** 导出列类型默认图标 */
export {getColIconByType};
/** 导出列类型收窄 */
export {toTAVCol};

/** 用途：拖拽填充文案。使用范围：手柄 aria-label。解耦评估：直达统一 i18n 环境。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化文案 */
export {siyuanI18n};
