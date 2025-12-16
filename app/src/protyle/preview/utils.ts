
/**
 * 严格匹配一个DOM元素的属性
 * 严格匹配意味着：
 * 1. 元素必须包含mode中定义的所有属性
 * 2. mode中没有指定的属性****直接忽略不做检查
 * 3. 属性值必须完全匹配（只支持字符串和正则表达式还有函数）
 *
 * @param element 要匹配的DOM元素
 * @param mode 属性匹配模式，键为属性名，值为期望的属性值
 * @returns 是否匹配成功
 */
const matchAttributesStrict = (
  element: HTMLElement,
  mode: Record<string, string | RegExp | ((value: string) => boolean)> = {},
): boolean => {
  // 如果模式为空，直接返回true
  if (Object.keys(mode).length === 0) {
    return true;
  }
  // 遍历模式中的所有属性，检查元素是否包含这些属性且值匹配
  for (const [key, expectedValue] of Object.entries(mode)) {
    const actualValue = element.getAttribute(key);
    // 检查属性是否存在
    if (actualValue === null) {
      return false;
    }
    // 根据期望值的类型进行匹配
    if (expectedValue instanceof RegExp) {
      // 正则表达式匹配
      if (!expectedValue.test(actualValue)) {
        return false;
      }
    } else if (typeof expectedValue === "function") {
      // 函数匹配
      try {
        if (!expectedValue(actualValue)) {
          return false;
        }
      } catch (error) {
        // 函数执行出错，视为不匹配
        return false;
      }
    } else {
      // 字符串完全匹配
      if (actualValue !== expectedValue) {
        return false;
      }
    }
  }
  return true;
};