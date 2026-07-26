import {updateHotkeyTip} from "./imports";
import {isMobile} from "./imports";
import {siyuanI18n} from "./imports";

/**
 * 创建对话框标题HTML
 */
export const 创建对话框标题HTML = (title?: string): string => {
    return `<div style="padding: 8px;">
    ${title || siyuanI18n.move}
    <div style="max-height: 16px;line-height: 14px;-webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 0) 0, #000 6px);padding-bottom: 4px;margin-bottom: -4px" class="ft__smaller ft__on-surface fn__hidescrollbar"></div>
</div>`;
};

/**
 * 创建对话框内容HTML
 */
export const 创建对话框内容HTML = (): string => {
    const mobileClass = isMobile() ? " b3-list--mobile" : "";
    return `<div class="b3-form__icon" style="margin: 8px">
    <span data-menu="true" class="b3-form__icon-list fn__a b3-tooltips b3-tooltips__s" aria-label="${updateHotkeyTip("⌥↓")}">
        <svg class="svg--mid"><use xlink:href="#iconSearch"></use></svg>
        <svg class="svg--smaller"><use xlink:href="#iconDown"></use></svg>
    </span>
    <input class="b3-text-field fn__block" style="padding-left: 42px;" value="" placeholder="${siyuanI18n.search}">
</div>
<ul id="foldList" class="fn__flex-1 fn__none b3-list b3-list--background${mobileClass}" style="overflow: auto;position: relative"></ul>
<div id="foldTree" class="fn__flex-1${mobileClass}" style="overflow: auto;position: relative"></div>
<div class="fn__hr"></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`;
};
