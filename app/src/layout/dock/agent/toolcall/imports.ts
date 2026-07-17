/** 用途：转发工具卡片所需的 DOM 转义函数。使用范围：toolcall 渲染目录，避免业务渲染器直接跨目录依赖底层工具。解耦评估：保持与 websearch 渲染目录一致的入口，未来可替换转义实现而不改卡片逻辑。 */
import {escapeHtml} from "../../../../util/DOM/escape";

/** 导出安全 HTML 转义函数，供本目录的工具卡片使用。 */
export {escapeHtml};
