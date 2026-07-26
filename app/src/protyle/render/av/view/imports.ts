/** 用途：渲染视图图标；使用范围：AV Header；解耦评估：复用 Emoji 领域唯一实现。 */
import {unicode2Emoji} from "../../../../emoji";
/** 用途：转义 aria 文案；使用范围：AV Header；解耦评估：复用 DOM 转义唯一实现。 */
import {escapeAriaLabel} from "../../../../util/DOM/escape";
/** 用途：转义可见标题；使用范围：AV Header；解耦评估：复用 DOM 转义唯一实现。 */
import {escapeHtml} from "../../../../util/DOM/escape";
/** 用途：提供视图操作文案；使用范围：AV Header；解耦评估：读取既有 i18n 运行时。 */
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：读取视图字段；使用范围：AV Header 过滤状态；解耦评估：复用 AV view 领域查询。 */
import {getFieldsByData} from "./metadata";
/** 用途：读取视图类型图标；使用范围：AV Header 页签；解耦评估：复用 AV view 领域映射。 */
import {getViewIcon} from "./metadata";

/** AV Header 使用的 Emoji 渲染。 */
export {unicode2Emoji};
/** AV Header 使用的 aria 转义。 */
export {escapeAriaLabel};
/** AV Header 使用的 HTML 转义。 */
export {escapeHtml};
/** AV Header 使用的国际化文案。 */
export {siyuanI18n};
/** AV Header 使用的字段查询。 */
export {getFieldsByData};
/** AV Header 使用的视图图标映射。 */
export {getViewIcon};
