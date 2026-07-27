/** 用途：请求无效引用分页数据；使用范围：移动搜索无效引用面板；解耦评估：直达网络基础设施。 */
import {fetchPost} from "../../../util/network/fetch";
/** 用途：呈现块类型图标；使用范围：无效引用结果项；解耦评估：直达无状态图标映射。 */
import {getIconByType} from "../../../editor/getIcon";
/** 用途：呈现路径和笔记本名称；使用范围：无效引用结果元数据；解耦评估：直达纯路径显示算法。 */
import {getDisplayName, getNotebookName} from "../../../util/file/pathName";
/** 用途：转义结果路径；使用范围：无效引用列表 HTML；解耦评估：直达共享纯转义算法。 */
import {escapeHtml} from "../../../util/DOM/escape";
/** 用途：呈现块 Emoji；使用范围：无效引用结果项；解耦评估：直达唯一 Emoji 实现。 */
import {unicode2Emoji} from "../../../emoji";
/** 用途：移动搜索文案；使用范围：结果统计与空状态；解耦评估：直达只读 i18n 环境。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 导出分页请求。 */
export {fetchPost};
/** 导出块图标映射。 */
export {getIconByType};
/** 导出文档路径显示。 */
export {getDisplayName};
/** 导出笔记本名称显示。 */
export {getNotebookName};
/** 导出 HTML 转义。 */
export {escapeHtml};
/** 导出 Emoji 呈现。 */
export {unicode2Emoji};
/** 导出 i18n 环境。 */
export {siyuanI18n};
