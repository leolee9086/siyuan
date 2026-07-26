/** 用途：渲染字段自定义图标；使用范围：Properties 字段行；解耦评估：直达 Emoji 唯一实现。 */
import {unicode2Emoji} from "../../../../../emoji";
/** 用途：转义字段名称；使用范围：Properties 字段行；解耦评估：直达 DOM 转义唯一实现。 */
import {escapeHtml} from "../../../../../util/DOM/escape";
/** 用途：读取字段管理文案；使用范围：Properties 标题和显示/隐藏操作；解耦评估：直达 i18n 环境唯一所有者。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：读取列类型图标；使用范围：无自定义图标的字段行；解耦评估：直达列类型映射唯一实现。 */
import {getColIconByType} from "../col.typeUtils";

/** 供字段管理渲染复用 DOM 转义真实实现。 */
export {escapeHtml};
/** 供字段管理渲染复用列图标真实实现。 */
export {getColIconByType};
/** 供字段管理渲染复用 i18n 真实环境。 */
export {siyuanI18n};
/** 供字段管理渲染复用 Emoji 真实实现。 */
export {unicode2Emoji};
