/**
 * 从当前颜色主题的css元素中获取所有颜色变量
 * 主题的css元素有两个,一个是默认主题的#themeDefaultStyle
 * 另一个是自定义主题的#themeStyle
 * 获取其中所有的css变量中类型为颜色的(变量之间可能互相引用)
 * 同名变量定义themeStyle优先级高于themeDefaultStyle
*/

function 获取当前主题颜色变量() {
    const defaultThemeStyles = document.getElementById('themeDefaultStyle');
    const customThemeStyles = document.getElementById('themeStyle');
    const colorVariables = {};
    // Extract variables from default theme
    if (defaultThemeStyles) {
        extractColorVariables(defaultThemeStyles, colorVariables);
    }
    // Extract variables from custom theme, overriding defaults
    if (customThemeStyles) {
        extractColorVariables(customThemeStyles, colorVariables);
    }

    return colorVariables;
}
// Function to extract color variables from a style element
function extractColorVariables(styleElement, colorVariables) {
    if (!styleElement.sheet) return;

    // Helper function to resolve variable references to actual values
    function resolveVariableValue(value, style) {
        let resolvedValue = value.trim();
        while (resolvedValue.startsWith('var(--')) {
            const match = resolvedValue.match(/var\((--[\w-]+)\)/);
            if (match && match[1]) {
                const innerVariable = match[1];
                resolvedValue = style.getPropertyValue(innerVariable).trim() || resolvedValue;
                // Prevent infinite loops if a variable refers to itself or cyclic references
                if (resolvedValue === 'var(' + innerVariable + ')') break;
            } else {
                break;
            }
        }
        return resolvedValue;
    }

    // Iterate over CSS rules
    for (const rule of styleElement.sheet.cssRules) {
        if (rule.style) {
            // Iterate over all CSS properties in the rule
            for (let i = 0; i < rule.style.length; i++) {
                const propertyName = rule.style[i];
                if (propertyName.startsWith('--')) { // Check if the property is a CSS variable
                    let value = rule.style.getPropertyValue(propertyName);
                    value = resolveVariableValue(value, rule.style);
                    if (isColor(value)) {
                        colorVariables[propertyName] = value;
                    }
                }
            }
        }
    }
}
// Check if a value is likely a color
function isColor(value) {
    return value.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgba?\([^)]+\)|hsla?\([^)]+\)/);
}
