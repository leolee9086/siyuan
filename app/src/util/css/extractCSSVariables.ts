/**
 * CSS变量提取和替换工具
 * 用于提取元素中使用的CSS变量并将其替换为计算值
 */

// 类型定义
interface CSSVariableInfo {
    name: string;
    computedValue: string;
    property: string;
    originalValue: string;
}

interface VariableCache {
    [variableName: string]: string | null;
}

// 全局缓存，避免重复计算
const variableValueCache: VariableCache = {};

/**
 * 提取元素中使用的CSS变量
 * @param element 要检查的DOM元素
 * @returns CSS变量信息数组
 */
function extractCSSVariables(element: Element): CSSVariableInfo[] {
    if (!element) {
        throw new Error('元素不能为空');
    }

    const variables: CSSVariableInfo[] = [];
    const processedVariableNames = new Set<string>();
    
    let computedStyle: CSSStyleDeclaration;
    try {
        computedStyle = window.getComputedStyle(element);
    } catch (error) {
        console.error('无法获取元素的计算样式:', error);
        return variables;
    }

    // 获取元素的所有CSS属性
    for (let i = 0; i < computedStyle.length; i++) {
        const propertyName = computedStyle[i];
        if (!propertyName) continue; // 确保属性名不为undefined
        
        const propertyValue = computedStyle.getPropertyValue(propertyName);

        // 检查属性值是否包含CSS变量
        if (propertyValue.includes('var(')) {
            // 提取变量名 - 修正正则表达式，确保正确匹配CSS变量名
            const varMatches = propertyValue.match(/var\(--([^)\s]+)(?:,\s*([^)]+))?\)/g);

            if (varMatches) {
                varMatches.forEach(varMatch => {
                    const varNameMatch = varMatch.match(/var\(--([^)\s]+)/);
                    if (varNameMatch) {
                        const varFullName = '--' + varNameMatch[1];
                        
                        // 避免重复处理同一个变量
                        if (processedVariableNames.has(varFullName)) {
                            return;
                        }
                        processedVariableNames.add(varFullName);
                        
                        const computedValue = getComputedVariableValue(element, varFullName);

                        variables.push({
                            name: varFullName,
                            computedValue: computedValue || '未定义',
                            property: propertyName,
                            originalValue: propertyValue
                        });
                    }
                });
            }
        }
    }

    return variables;
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
        let computedStyle: CSSStyleDeclaration;
        try {
            computedStyle = window.getComputedStyle(currentElement);
        } catch (error) {
            console.error('无法获取元素的计算样式:', error);
            currentElement = currentElement.parentElement;
            continue;
        }
        
        const value = computedStyle.getPropertyValue(variableName);

        if (value && value.trim() !== '') {
            // 缓存结果并返回
            variableValueCache[variableName] = value;
            return value;
        }

        // 如果当前元素是根元素，停止遍历
        if (currentElement === document.documentElement) {
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
 * 从样式表中查找CSS变量定义
 * @param variableName CSS变量名（包含--前缀）
 * @returns 变量值，如果未找到则返回null
 */
function getVariableFromStylesheets(variableName: string): string | null {
    try {
        // 遍历所有样式表查找变量定义
        for (let i = 0; i < document.styleSheets.length; i++) {
            const stylesheet = document.styleSheets[i];
            if (!stylesheet) continue;

            try {
                const rules = stylesheet.cssRules || stylesheet.rules;
                if (!rules) continue;

                for (let j = 0; j < rules.length; j++) {
                    const rule = rules[j];
                    if (!rule) continue;

                    // 检查是否是CSSStyleRule类型
                    if (rule.type === CSSRule.STYLE_RULE) {
                        const styleRule = rule as CSSStyleRule;
                        if (styleRule.style) {
                            const value = styleRule.style.getPropertyValue(variableName);
                            if (value && value.trim() !== '') {
                                return value;
                            }
                        }
                    }
                }
            } catch (stylesheetError) {
                // 可能由于CORS策略无法访问某些样式表
                console.warn('无法访问样式表:', stylesheetError);
                continue;
            }
        }
    } catch (error) {
        console.error('访问样式表时发生错误:', error);
    }

    return null;
}

/**
 * 替换元素样式中的CSS变量为计算值
 * @param element 要修改的DOM元素
 * @param variables CSS变量信息数组
 */
function replaceCSSVariables(element: Element, variables: CSSVariableInfo[]): void {
    if (!element || !variables || variables.length === 0) {
        return;
    }

    // 获取元素的原始样式（内联样式）
    const originalStyle = element.getAttribute('style') || '';
    let newStyle = originalStyle;

    variables.forEach(variable => {
        // 创建正则表达式来匹配变量使用
        const varRegex = new RegExp(`var\\(${variable.name}(?:,\\s*[^)]+)?\\)`, 'g');

        // 检查原始样式中是否使用了该变量
        if (varRegex.test(originalStyle)) {
            // 重置正则表达式的lastIndex
            varRegex.lastIndex = 0;
            // 替换变量为计算值
            newStyle = newStyle.replace(varRegex, variable.computedValue);
        } else {
            // 如果内联样式中没有该变量，但我们需要确保属性存在
            // 检查属性是否已存在于内联样式中
            const propertyRegex = new RegExp(`\\b${variable.property}\\s*:[^;]*;?`, 'g');
            const propertyMatch = originalStyle.match(propertyRegex);

            if (propertyMatch) {
                // 属性已存在，但值中不包含该变量，不需要修改
                // 这种情况通常意味着该属性使用了其他值或变量
                return;
            } else {
                // 属性不存在，添加它（只有当计算值不是'未定义'时）
                if (variable.computedValue !== '未定义') {
                    newStyle = `${newStyle}${newStyle.trim() && !newStyle.endsWith(';') ? ';' : ''} ${variable.property}: ${variable.computedValue};`;
                }
            }
        }
    });

    // 应用新样式
    element.setAttribute('style', newStyle);
}

/**
 * 清除变量值缓存
 * 在样式表发生变化时可以调用此函数清除缓存
 */
function clearVariableCache(): void {
    Object.keys(variableValueCache).forEach(key => {
        delete variableValueCache[key];
    });
}

// 导出函数
export {
    extractCSSVariables,
    getComputedVariableValue,
    getVariableFromStylesheets,
    replaceCSSVariables,
    clearVariableCache
};

// 导出类型
export type {
    CSSVariableInfo
};