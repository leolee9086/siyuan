import { forgeI18n } from "../../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {updateHotkeyAfterTip} from "../../../util/platform/hotkey/format";

export const genForwardlinkHTML = (type: "pin" | "local", defaultSort: string) => {
    return `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconLink"></use></svg>${forgeI18n.正向链接 || "正向链接"}
    </div>
    <span class="counter listCount" style="margin-left: 0"></span>
    <span class="fn__flex-1"></span>
    <span class="fn__space"></span>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <span data-type="search" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.filter}"><svg><use xlink:href='#iconFilter'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="sort" data-sort="${defaultSort}" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.sort}"><svg><use xlink:href='#iconSort'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="expand" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.expand}${updateHotkeyAfterTip(window.siyuan.config.keymap.editor.general.expand.custom)}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.collapse}${updateHotkeyAfterTip(window.siyuan.config.keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="${type === "local" ? "fn__none " : ""}fn__space"></span>
    <span data-type="min" class="${type === "local" ? "fn__none " : ""}block__icon b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.min}${updateHotkeyAfterTip(window.siyuan.config.keymap.general.closeTab.custom)}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="forwardlinkList fn__flex-1"></div>`;
};
