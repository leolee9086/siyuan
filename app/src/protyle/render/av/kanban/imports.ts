/**
 * 用途：提供标题文本转义能力，防止看板分组标题拼接时产生 XSS 风险。
 * 使用范围：仅供看板模块（如 getKanbanTitleHTML）构建标题 HTML 时调用。
 * 解耦评估：可通过调用方注入，但会让所有调用链重复传参与样板代码，当前在看板目录集中转发更利于边界治理。
 */
import { escapeHtml } from "../../../../util/DOM/escape";
/**
 * 用途：提供属性值转义能力，避免动态 data-* 属性拼接时提前闭合引号。
 * 使用范围：仅供看板模块（如 getKanbanTitleHTML）构造属性字符串时调用。
 * 解耦评估：可通过调用方注入，但会让所有调用链重复传参与样板代码，当前在看板目录集中转发更利于边界治理。
 */
import { escapeAttr } from "../../../../util/DOM/escape";
/**
 * 用途：提供看板标题中的国际化文案（如条目计数、新建按钮 aria 文案）。
 * 使用范围：仅供看板渲染模块输出可访问性文本时使用。
 * 解耦评估：可改为参数透传解耦，但调用方 render 链路会被迫扩展参数签名；当前通过同层 imports 转发可保持实现稳定。
 */
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 导出 HTML 文本转义能力 */
export { escapeHtml };
/** 导出 HTML 属性转义能力 */
export { escapeAttr };
/** 导出看板标题国际化文案 */
export { siyuanI18n };
