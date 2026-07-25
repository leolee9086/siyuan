/** 用途：日期格式化；使用范围：AV 属性值；解耦评估：复用项目既有 dayjs 后端。 */
import * as dayjs from "dayjs";
/** 用途：读取默认文件图标键；使用范围：AV 关系值；解耦评估：复用全局常量。 */
import {Constants} from "../../../../constants";
/** 用途：渲染关系值图标；使用范围：AV 属性值；解耦评估：复用 Emoji 唯一实现。 */
import {unicode2Emoji} from "../../../../emoji";
/** 用途：生成图片缩略图地址；使用范围：AV 资源值；解耦评估：复用资源领域实现。 */
import {getCompressURL} from "../../../../util/assets/image";
/** 用途：安全生成属性值 HTML；使用范围：AV 属性值；解耦评估：复用 DOM 转义唯一实现。 */
import {escapeAriaLabel, escapeAttr, escapeHtml} from "../../../../util/DOM/escape";
/** 用途：属性编辑文案；使用范围：AV 属性值；解耦评估：读取既有 i18n 运行时。 */
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** AV 属性值使用的日期格式化后端。 */
export {dayjs};
/** AV 属性值使用的全局常量。 */
export {Constants};
/** AV 属性值使用的 Emoji 渲染器。 */
export {unicode2Emoji};
/** AV 属性值使用的图片地址生成器。 */
export {getCompressURL};
/** AV 属性值使用的 ARIA 转义器。 */
export {escapeAriaLabel};
/** AV 属性值使用的属性转义器。 */
export {escapeAttr};
/** AV 属性值使用的 HTML 转义器。 */
export {escapeHtml};
/** AV 属性值使用的国际化文案。 */
export {siyuanI18n};
