/**
 * CSS变量提取工具的类型守卫
 */

/**
 * 类型守卫：检查是否为CSSStyleRule
 * @param rule CSS规则对象
 * @returns 如果是CSSStyleRule则返回true
 */
export function isCSSStyleRule(rule: CSSRule): rule is CSSStyleRule {
    return rule.type === CSSRule.STYLE_RULE;
}
