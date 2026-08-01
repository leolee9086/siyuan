/** 用途：转发搜索卡片需要的 HTML 转义工具。使用范围：websearch 工具子领域。解耦评估：不可信搜索结果只在 HTML 边界依赖统一转义实现。 */
import {escapeHtml} from "../../../../../../../util/DOM/escape";
/** 导出 escapeHtml，供搜索卡片渲染使用。 */
export {escapeHtml};
