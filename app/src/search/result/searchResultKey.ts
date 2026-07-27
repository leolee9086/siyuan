/** 从搜索结果项的正文标记提取去重关键词；正文没有标记时再读取元数据标记。 @同步豁免: 需要绝对同步的DOM访问 - 替换请求必须使用当前聚焦结果的即时标记快照。 */
export const getKeyByLiElement = (element: HTMLElement) => {
    const contentKeys = Array.from(element.querySelectorAll(".b3-list-item__text mark"), item => item.textContent || "");
    const keys = contentKeys.length > 0
        ? contentKeys
        : Array.from(element.querySelectorAll(".b3-list-item__meta mark"), item => item.textContent || "");
    return [...new Set(keys)].join(" ");
};
