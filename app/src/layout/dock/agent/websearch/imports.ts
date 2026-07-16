/** 用途：转发搜索卡片需要的 HTML 转义工具。使用范围：websearch 渲染模块。解耦评估：通过本目录入口隔离 UI 代码与底层 DOM 工具，未来可替换实现。 */
import {escapeHtml} from "../../../../util/DOM/escape";
/** 导出 escapeHtml，供搜索卡片渲染使用。 */
export {escapeHtml};
