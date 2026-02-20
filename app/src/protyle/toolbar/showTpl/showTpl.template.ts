/**
 * 模板选择功能 - HTML 模板生成
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isElectron, isMobile } from "../../../platform";

/**
 * 生成模板列表项 HTML
 */
export function 生成模板列表项HTML(items: { path: string; content: string }[]): string {
    let html = "";
    for (const [index, item] of items.entries()) {
        html += `<div data-value="${item.path}" class="b3-list-item--hide-action b3-list-item${index === 0 ? " b3-list-item--focus" : ""}">
<span class="b3-list-item__text">${item.content}</span>`;
        if (isElectron) {
            html += `<span data-type="open" class="b3-list-item__action b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.showInFolder}">
    <svg><use xlink:href="#iconFolder"></use></svg>
</span>`;
        }
        html += `<span data-type="remove" class="b3-list-item__action b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.remove}">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
</span></div>`;
    }
    return html || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
}

/**
 * 生成模板选择面板的 HTML 结构
 */
export function 生成面板HTML(): string {
    return `<div style="max-height:50vh" class="fn__flex">
<div class="fn__flex-column" style="${isMobile ? "width: 100%" : "width: 256px"}">
    <div class="fn__flex" style="margin: 0 8px 4px 8px">
        <input class="b3-text-field fn__flex-1"/>
        <span class="fn__space"></span>
        <span data-type="previous" class="block__icon block__icon--show"><svg><use xlink:href="#iconLeft"></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="next" class="block__icon block__icon--show"><svg><use xlink:href="#iconRight"></use></svg></span>
    </div>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"><img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg"></div>
</div>
<div class="toolbarResize" style="    cursor: col-resize;
    box-shadow: 2px 0 0 0 var(--b3-theme-surface) inset, 3px 0 0 0 var(--b3-border-color) inset;
    width: 5px;
    margin-left: -2px;"></div>
<div style="width: 520px;${isMobile || window.outerWidth < window.outerWidth / 2 + 520 ? "display:none;" : ""}overflow: auto;"></div>
</div>`;
}
