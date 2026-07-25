/**
 * 作用：让 AV 各分组记录的分页大小至少覆盖当前已渲染条目数。
 * 意图：新增行或卡片后保持后续刷新页大小稳定，并让表格与卡片插入逻辑同向复用。
 * 调用时机：前端插入占位记录并完成默认值填充后同步调用。
 * 问题/改进：仅同步 DOM 快照，不负责服务端分页请求。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const syncAVPageSize = (blockElement: Element) => {
    const viewType = blockElement.getAttribute("data-av-type");
    for (const body of blockElement.querySelectorAll<HTMLElement>(".av__body")) {
        const pageSize = body.dataset.pageSize;
        if (!pageSize) {
            continue;
        }
        const itemSelector = viewType === "table" ? ".av__row:not(.av__row--header)" : ".av__gallery-item";
        const items = body.querySelectorAll(itemSelector);
        const currentCount = items.length;
        // 前端插入使当前条目超过服务端页大小时，只扩张快照，避免后续刷新截掉新增项。
        if (parseInt(pageSize) < currentCount) {
            body.dataset.pageSize = currentCount.toString();
        }
    }
};
