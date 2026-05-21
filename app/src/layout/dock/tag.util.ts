import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { hasSubType } from "./tag.guard";
import { isMobile } from "../../util/platform/functions";
import { getIconByType } from "../../editor/getIcon";
import { unicode2Emoji } from "../../emoji";
import { Constants } from "../../constants";
import { escapeAriaLabel } from "../../util/DOM/escape";


/**
 * 生成 Tag 面板的 HTML 模板
 */
export function getTagPanelHTML(): string {
    const config = getSiyuanConfig();
    const readonlyClass = config?.readonly ? " fn__none" : "";
    const expandHotkey = updateHotkeyAfterTip(config?.keymap?.editor?.general?.expand?.custom ?? "");
    const collapseHotkey = updateHotkeyAfterTip(config?.keymap?.editor?.general?.collapse?.custom ?? "");
    const minHotkey = updateHotkeyAfterTip(config?.keymap?.general?.closeTab?.custom ?? "");

    return `<div class="block__icons">
    <div class="block__logo">${siyuanI18n.tag}
    </div>
    <span class="fn__flex-1"></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="sort" class="block__icon b3-tooltips b3-tooltips__sw${readonlyClass}" aria-label="${siyuanI18n.sort}">
        <svg><use xlink:href="#iconSort"></use></svg>
    </span>
    <span class="fn__space${readonlyClass}"></span>
    <span data-type="expand" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.expand}${expandHotkey}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.collapse}${collapseHotkey}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.min}${minHotkey}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="fn__flex-1" style="margin-bottom: 8px"></div>`;
}

/**
 * 获取 Tag 排序选项
 */
export function getTagSortOptions(currentSort: number) {
    return [
        { sortValue: 0, label: siyuanI18n.fileNameASC, isSelected: currentSort === 0 },
        { sortValue: 1, label: siyuanI18n.fileNameDESC, isSelected: currentSort === 1 },
        { sortValue: 4, label: siyuanI18n.fileNameNatASC, isSelected: currentSort === 4 },
        { sortValue: 5, label: siyuanI18n.fileNameNatDESC, isSelected: currentSort === 5 },
        { sortValue: 7, label: siyuanI18n.refCountASC, isSelected: currentSort === 7 },
        { sortValue: 8, label: siyuanI18n.refCountDESC, isSelected: currentSort === 8 },
    ];
}

/**
 * 判断 Tag 是否应该重新加载
 */
export function shouldReloadTag(item: IOperation): boolean {
    if (item.action === "delete") {
        return true;
    }
    if ((item.action === "update" || item.action === "insert") && typeof item.data === "string") {
        return item.data.includes('data-type="tag"');
    }
    return false;
}

/**
 * Protyle 编辑器渲染配置
 */
export const TAG_EDITOR_RENDER_CONFIG = {
    background: false,
    gutter: true,
    scroll: false,
    breadcrumb: false,
};

/**
 * 生成 Tag 块列表 HTML
 */
export function genTagBlockListHTML(blocks: IBlock[]): string {
    let html = "<ul>";
    const isMobileLayout = isMobile();
    const defaultIcon = getSiyuanStorage()[Constants.LOCAL_IMAGES].file;
    for (const item of blocks) {
        const subType = hasSubType(item) ? item.subType : undefined;
        const iconHTML = getIconHTML(item, subType, defaultIcon);

        const style = isMobileLayout ? "padding-left: 24px" : "padding-left: 22px;margin-right: 2px";

        const content = item.content || "";

        html += `<li class="b3-list-item${isMobileLayout ? "" : " b3-list-item--hide-action"}" 
style="--file-toggle-width: 36px" 
data-node-id="${item.id}" 
data-type="${item.type}" 
data-subtype="${subType}" 
data-treetype="tag-block">
<span style="${style}" class="b3-list-item__toggle b3-list-item__toggle--hl">
    <svg data-id="${item.id}" class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
</span>
${iconHTML}
<span class="b3-list-item__text ariaLabel" data-position="parentE" aria-label="${escapeAriaLabel(content.replace(/<[^>]+>/g, ""))}">${content}</span>
<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>
</li>`;
    }
    html += "</ul>";
    return html;
}

/**
 * 生成 Tag 图标 HTML
 * - 作用：根据 Block 类型生成对应的图标 HTML。
 * - 意图：将图标生成逻辑提取为辅助函数，以简化 `genTagBlockListHTML` 的逻辑并在循环中避免嵌套 if/else。
 * - 调用时机：在生成标签面板块列表 HTML 时为每个块调用。
 */
function getIconHTML(item: IBlock, subType: string | undefined, defaultIcon: string) {
    if (item.type === "NodeDocument") {
        return `<span data-showref="true" class="b3-list-item__graphic popover__block" data-id="${item.id}">${unicode2Emoji(item.ial?.icon || defaultIcon)}</span>`;
    }
    if (item.type) {
        return `<svg data-showref="true" class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type, subType || "")}"></use></svg>`;
    }
    return "";
}

