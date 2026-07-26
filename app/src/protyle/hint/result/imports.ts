/** 用途：解析块类型图标；使用范围：提示结果项渲染；解耦评估：直达图标映射唯一实现。 */
import {getIconByType} from "../../../editor/getIcon";
/** 用途：渲染文档 Emoji 图标；使用范围：提示结果项渲染；解耦评估：直达 Emoji 渲染唯一实现。 */
import {unicode2Emoji} from "../../../emoji/emoji.render";
/** 用途：提供引用计数文案；使用范围：提示结果项渲染；解耦评估：直达 i18n 环境入口。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 导出块类型图标解析。 */
export {getIconByType};
/** 导出引用计数文案入口。 */
export {siyuanI18n};
/** 导出文档 Emoji 渲染。 */
export {unicode2Emoji};
