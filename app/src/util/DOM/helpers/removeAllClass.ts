/**
 * 批量移除容器内所有命中类名，避免面板聚焦逻辑反复书写查询与清理代码。
 * 调用时机：切换选中态、聚焦态或临时状态类前统一清场时调用。
 * 问题/改进：当前仅处理单一类名，如果未来需要按选择器批量清理可扩展独立工具。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const removeAllClass = (className: string, doc: Document | Element) => {
    for (const item of doc.querySelectorAll(`.${className}`)) {
        item.classList.remove(className);
    }
};
