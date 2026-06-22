/**
 * 用途：DOM 冒泡查询工具函数。使用范围：沿 DOM 树向上查找匹配 CSS 类名的祖先元素。解耦评估：纯 DOM 操作，无业务依赖。
 */
/** @同步豁免: DOM访问 - DOM 遍历操作必须同步执行 */
/**
 * 沿 DOM 树向上查找匹配 CSS 类名的祖先元素
 * @param element - 起始元素
 * @param boundary - 冒泡边界
 * @param className - 要匹配的 CSS 类名
 */
export const getClosestByClassUpward = (element: HTMLElement | null, boundary: HTMLElement, className: string) => {
    let target = element;
    while (target && !target.isEqualNode(boundary)) {
        if (target.classList.contains(className)) {
            return target;
        }
        target = target.parentElement;
    }
    return null;
};

/**
 * 用途：生成自定义列表的 dock key。使用范围：CustomLists.ts 和 customLists.util.ts。解耦评估：纯字符串拼接。
 */
/** @同步豁免: 性能考虑 - 纯字符串拼接，无需异步 */
export const getCustomListKey = (type: string, id: string) => `custom_list:${type}:${id}`;
