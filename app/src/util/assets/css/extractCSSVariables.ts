/**
 * CSS变量提取和替换工具
 * 用于提取元素中使用的CSS变量并将其替换为计算值
 */

import type { CSSVariableInfo, VariableCache } from "./extractCSSVariables.types";
import { isCSSStyleRule } from "./extractCSSVariables.guard";
import * as env from "./extractCSSVariables.environment";

// 全局缓存，避免重复计算
const variableValueCache: VariableCache = {};

/**
 * 提取元素中使用的CSS变量
 * @param element 要检查的DOM元素
 * @returns CSS变量信息数组
 */
/** @同步豁免: 需要绝对同步的DOM访问 - CSS变量提取必须立即返回结果用于样式计算 */
export function extractCSSVariables(element: Element): CSSVariableInfo[] {
    if (!element) {
        throw new Error("元素不能为空");
    }

    const variables: CSSVariableInfo[] = [];
    const processedVariableNames = new Set<string>();
    
    let computedStyle: CSSStyleDeclaration;
    try {
         
        computedStyle = window.getComputedStyle(element);
    } catch (error) {
        console.error("无法获取元素的计算样式:", error);
        return variables;
    }

    // 获取元素的所有CSS属性
    for (let i = 0; i < computedStyle.length; i++) {
        const propertyName = computedStyle[i];
        if (!propertyName) {
            continue;
        }
        
        const propertyValue = computedStyle.getPropertyValue(propertyName);

        // 检查属性值是否包含CSS变量
        if (!propertyValue.includes("var(")) {
            continue;
        }

        // 提取变量名
        const varMatches = propertyValue.match(/var\(--([^)\s]+)(?:,\s*([^)]+))?\)/g);
        if (!varMatches) {
            continue;
        }

        for (const varMatch of varMatches) {
            processVariableMatch(varMatch, propertyName, propertyValue, element, processedVariableNames, variables);
        }
    }

    return variables;
}

/**
 * 处理单个CSS变量匹配
 */
function processVariableMatch(
    varMatch: string,
    propertyName: string,
    propertyValue: string,
    element: Element,
    processedVariableNames: Set<string>,
    variables: CSSVariableInfo[]
): void {
    const varNameMatch = varMatch.match(/var\(--([^)\s]+)/);
    if (!varNameMatch) {
        return;
    }

    const varFullName = "--" + varNameMatch[1];
    
    // 避免重复处理同一个变量
    if (processedVariableNames.has(varFullName)) {
        return;
    }
    processedVariableNames.add(varFullName);
    
    const computedValue = getComputedVariableValue(element, varFullName);

    variables.push({
        name: varFullName,
        computedValue: computedValue || "未定义",
        property: propertyName,
        originalValue: propertyValue
    });
}

/**
 * 获取CSS变量的计算值
 * @param element DOM元素
 * @param variableName CSS变量名（包含--前缀）
 * @returns 变量的计算值，如果未定义则返回null
 */
function getComputedVariableValue(element: Element, variableName: string): string | null {
    // 检查缓存
    if (variableValueCache.hasOwnProperty(variableName)) {
        return variableValueCache[variableName] || null;
    }

    // 向上遍历DOM树，查找CSS变量的定义
    let currentElement: Element | null = element;

    while (currentElement) {
        const value = getVariableValueFromElement(currentElement, variableName);
        
        // 找到有效值则缓存并返回
        if (value && value.trim() !== "") {
            variableValueCache[variableName] = value;
            return value;
        }

        // 如果当前元素是根元素，停止遍历
        if (currentElement === env.getDocumentElement()) {
            break;
        }

        currentElement = currentElement.parentElement;
    }

    // 检查全局样式表中的变量定义
    const stylesheetValue = getVariableFromStylesheets(variableName);
    
    // 缓存结果（即使是null）
    variableValueCache[variableName] = stylesheetValue;
    return stylesheetValue;
}

/**
 * 从元素获取CSS变量值
 */
function getVariableValueFromElement(element: Element, variableName: string): string {
    try {
        const computedStyle = env.getComputedStyle(element);
        return computedStyle.getPropertyValue(variableName);
    } catch (error) {
        console.error("无法获取元素的计算样式:", error);
        return "";
    }
}

/**
 * 从样式表中查找CSS变量定义
 * @param variableName CSS变量名（包含--前缀）
 * @returns 变量值，如果未找到则返回null
 */
function getVariableFromStylesheets(variableName: string): string | null {
    try {
        const styleSheets = env.getStyleSheets();
        
        // 遍历所有样式表查找变量定义
        for (let i = 0; i < styleSheets.length; i++) {
            const stylesheet = styleSheets[i];
            if (!stylesheet) {
                continue;
            }

            const value = getVariableFromStylesheet(stylesheet, variableName);
            if (value) {
                return value;
            }
        }
    } catch (error) {
        console.error("访问样式表时发生错误:", error);
    }

    return null;
}

/**
 * 从单个样式表中查找CSS变量
 */
function getVariableFromStylesheet(stylesheet: CSSStyleSheet, variableName: string): string | null {
    try {
        const rules = stylesheet.cssRules || stylesheet.rules;
        if (!rules) {
            return null;
        }

        for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (!rule || rule.type !== CSSRule.STYLE_RULE) {
                continue;
            }

            const value = getVariableFromStyleRule(rule, variableName);
            if (value) {
                return value;
            }
        }
    } catch (stylesheetError) {
        // 可能由于CORS策略无法访问某些样式表
        console.warn("无法访问样式表:", stylesheetError);
    }

    return null;
}

/**
 * 从样式规则中获取CSS变量值
 */
function getVariableFromStyleRule(rule: CSSRule, variableName: string): string | null {
    if (!isCSSStyleRule(rule)) {
        return null;
    }

    if (!rule.style) {
        return null;
    }

    const value = rule.style.getPropertyValue(variableName);
    if (!value || value.trim() === "") {
        return null;
    }

    return value;
}


/**
 * 替换元素样式中的CSS变量为计算值
 * @param element 要修改的DOM元素
 * @param variables CSS变量信息数组
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 样式替换必须立即生效 */
export function replaceCSSVariables(element: Element, variables: CSSVariableInfo[]): void {
    if (!element || !variables || variables.length === 0) {
        return;
    }

    // 获取元素的原始样式（内联样式）
    const originalStyle = element.getAttribute("style") || "";
    let newStyle = originalStyle;

    for (const variable of variables) {
        newStyle = replaceVariableInStyle(newStyle, originalStyle, variable);
    }

    // 应用新样式
    element.setAttribute("style", newStyle);
}

/**
 * 在样式字符串中替换单个CSS变量
 */
function replaceVariableInStyle(
    currentStyle: string,
    originalStyle: string,
    variable: CSSVariableInfo
): string {
    // 创建正则表达式来匹配变量使用
    const varRegex = new RegExp(`var\\(${variable.name}(?:,\\s*[^)]+)?\\)`, "g");

    // 检查原始样式中是否使用了该变量
    if (varRegex.test(originalStyle)) {
        // 重置正则表达式的lastIndex
        varRegex.lastIndex = 0;
        // 替换变量为计算值
        return currentStyle.replace(varRegex, variable.computedValue);
    }

    // 如果内联样式中没有该变量，检查是否需要添加属性
    return addPropertyIfNeeded(currentStyle, originalStyle, variable);
}

/**
 * 如果需要，添加CSS属性到样式字符串
 */
function addPropertyIfNeeded(
    currentStyle: string,
    originalStyle: string,
    variable: CSSVariableInfo
): string {
    // 检查属性是否已存在于内联样式中
    const propertyRegex = new RegExp(`\\b${variable.property}\\s*:[^;]*;?`, "g");
    const propertyMatch = originalStyle.match(propertyRegex);

    // 属性已存在，但值中不包含该变量，不需要修改
    if (propertyMatch) {
        return currentStyle;
    }

    // 属性不存在，添加它（只有当计算值不是'未定义'时）
    if (variable.computedValue === "未定义") {
        return currentStyle;
    }

    const separator = currentStyle.trim() && !currentStyle.endsWith(";") ? ";" : "";
    return `${currentStyle}${separator} ${variable.property}: ${variable.computedValue};`;
}

/**
 * 清除变量值缓存
 * 在样式表发生变化时可以调用此函数清除缓存
 */
/** @同步豁免: 性能考虑 - 缓存清理必须立即完成 */
export function clearVariableCache(): void {
    for (const key of Object.keys(variableValueCache)) {
        delete variableValueCache[key];
    }
}

// 导出类型
export type { CSSVariableInfo };
