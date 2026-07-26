import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type {BackgroundDomain} from "./background.types";

/**
 * 作用：初始化 Background 组件的 DOM 结构。
 * 意图：构建题头图区域的 HTML，包括图片、图标、操作菜单等，并初始化对关键 DOM 元素的引用。
 * 调用时机：Background 类实例化时调用。
 * 问题/改进：HTML 结构硬编码在 JavaScript 中，维护成本较高，建议通过模板引擎或单独的组件文件管理。
 */
export const initBackgroundElement = (background: BackgroundDomain) => {
    background.element = document.createElement("div");
    background.element.className = "protyle-background";
    background.element.innerHTML = getBackgroundHTML(background.transparentData);
    const tempTags = background.element.querySelector(".b3-chips");
    if (tempTags instanceof HTMLElement) {
        background.tagsElement = tempTags;
    }
    const tempIcon = background.element.querySelector(".protyle-background__icon");
    if (tempIcon instanceof HTMLElement) {
        background.iconElement = tempIcon;
    }
    const tempImg = background.element.querySelector(".protyle-background__img img");
    if (tempImg instanceof HTMLImageElement) {
        background.imgElement = tempImg;
    }
    background.actionElements = background.element.querySelectorAll(".protyle-background__action:not(.fn__flex-center) .b3-button");
};

const getBackgroundHTML = (transparentData: string) => {
    return `<div class="protyle-background__img">
    <img src="${transparentData}">
    <div class="protyle-icons">
        <span class="protyle-icon protyle-icon--first" style="position: relative;overflow: hidden"><input aria-label="${siyuanI18n.upload}" class="ariaLabel b3-form__upload" type="file"><svg><use xlink:href="#iconUpload"></use></svg></span>
        <span class="protyle-icon ariaLabel" data-type="link" aria-label="${siyuanI18n.link}"><svg><use xlink:href="#iconLink"></use></svg></span>
        <span class="protyle-icon ariaLabel" data-type="asset" aria-label="${siyuanI18n.assets}"><svg><use xlink:href="#iconImage"></use></svg></span>
        <span class="protyle-icon ariaLabel" data-type="show-random" aria-label="${siyuanI18n.builtIn}"><svg><use xlink:href="#iconRefresh"></use></svg></span>
        <span class="protyle-icon ariaLabel fn__none" data-type="position" aria-label="${siyuanI18n.dragPosition}"><svg><use xlink:href="#iconMove"></use></svg></span>
        <span class="protyle-icon protyle-icon--last ariaLabel" data-type="remove" aria-label="${siyuanI18n.remove}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
    </div>
    <div class="protyle-icons fn__none"><span class="protyle-icon protyle-icon--text">${siyuanI18n.dragPosition}</span></div>
    <div class="protyle-icons fn__none" style="opacity: .86;">
        <span class="protyle-icon protyle-icon--first" data-type="cancel">${siyuanI18n.cancel}</span>
        <span class="protyle-icon protyle-icon--last" data-type="confirm">${siyuanI18n.confirm}</span>
    </div>
</div>
<div class="protyle-background__ia">
    <div class="protyle-background__icon" data-menu="true" data-type="open-emoji"></div>
    <div class="b3-chips b3-chips__doctag fn__none"></div>
    <div class="protyle-background__action">
        <button class="b3-button b3-button--cancel" data-menu="true" data-type="tag">
            <svg><use xlink:href="#iconTags"></use></svg>
            ${siyuanI18n.addTag}
        </button>
        <button class="b3-button b3-button--cancel" data-type="icon">
            <svg><use xlink:href="#iconEmoji"></use></svg>
            ${siyuanI18n.addIcon}
        </button>
        <button class="b3-button b3-button--cancel" data-type="random">
            <svg><use xlink:href="#iconImage"></use></svg>
            ${siyuanI18n.titleBg}
        </button>
    </div>
</div>`;
};
