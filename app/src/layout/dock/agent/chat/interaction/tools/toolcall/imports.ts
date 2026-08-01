/** 用途：转发工具卡片所需的 DOM 转义函数。使用范围：toolcall 渲染子领域。解耦评估：不可信输出只在 HTML 边界依赖统一转义实现。 */
import {escapeHtml} from "../../../../../../../util/DOM/escape";

/** 导出安全 HTML 转义函数，供本目录的工具卡片使用。 */
export {escapeHtml};
