import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {isBookmarkAttrsChange} from "./bookmark.guard";

export const shouldReloadBookmark = (item: IOperation) => {
    let needReload = false;
    const action = item.action;
    const itemContent = item.data;
    if ((action === "update" || action === "insert") && typeof itemContent === "string" && itemContent.indexOf('class="protyle-attr--bookmark"') > -1) {
        needReload = true;
    }
    if (action === "delete") {
        needReload = true;
    }
    if (action === "updateAttrs" && isBookmarkAttrsChange(item.data)) {
        needReload = item.data.old?.bookmark !== item.data.new?.bookmark;
    }
    return needReload;
};

export const getBookmarkPanelHTML = () => {
    const config = getSiyuanConfig();
    return `<div class="block__icons">
    <div class="block__logo fn__flex-1">${siyuanI18n.bookmark}</div>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <span data-type="search" class="block__icon ariaLabel" data-position="north" aria-label="${siyuanI18n.filter}"><svg><use xlink:href='#iconFilter'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="expand" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.expand}${updateHotkeyAfterTip(config.keymap.editor.general.expand.custom)}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.collapse}${updateHotkeyAfterTip(config.keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.min}${updateHotkeyAfterTip(config.keymap.general.closeTab.custom)}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="fn__flex-1" style="margin-bottom: 8px"></div>`;
};
