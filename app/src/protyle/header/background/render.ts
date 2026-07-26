import { isMobile } from "../../../platform";
import { escapeHtml } from "../../../util/DOM/escape";
import { unicode2Emoji } from "../../../emoji";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type {BackgroundDomain} from "./background.types";


/**
 * 作用：渲染 Background 组件
 * @param background Background instance
 * @param ial IObject attributes
 * @param rootId Root Block ID
 */
export const renderBackground = (background: BackgroundDomain, ial: IObject, rootId: string | undefined) => {
    background.ial = ial;
    background.element.setAttribute("data-node-id", rootId || "");

    renderTags(background, ial.tags || "");
    renderIcon(background, ial.icon);
    renderTitleImg(background, ial["title-img"]);

    if (ial["title-img"] || ial.icon) {
        background.iconElement.parentElement?.style.setProperty("margin-top", null); // Remove inline style
        return;
    }
    background.iconElement.parentElement?.style.setProperty("margin-top", "8px");
};

/**
 * 作用：渲染文档图标 DOM。
 * 意图：根据传入的 icon 字符渲染 emoji，处理图标区域显隐及“添加图标”按钮的互斥显示。
 * 调用时机：renderBackground 中调用。
 */
export const renderIcon = (background: BackgroundDomain, icon: string | undefined) => {
    const iconBtn = background.actionElements[1];
    if (icon) {
        background.iconElement.classList.remove("fn__none");
        background.iconElement.innerHTML = unicode2Emoji(icon);
        iconBtn?.classList.add("fn__none");
        return;
    }
    iconBtn?.classList.remove("fn__none");
    background.iconElement.classList.add("fn__none");
};

/**
 * 作用：渲染题头图区域的整体状态（图片 vs 按钮）。
 * 意图：根据 titleImg 存在与否，切换显示实际图片或“添加题头图”按钮，并调整 margin 布局。
 * 调用时机：renderBackground 中调用。
 */
const renderTitleImg = (background: BackgroundDomain, titleImg: string | undefined) => {
    const imgBtn = background.actionElements[2];
    // 无题头图时显示"添加题头图"按钮
    if (!titleImg) {
        background.imgElement?.parentElement?.classList.add("fn__none");
        imgBtn?.classList.remove("fn__none");
        background.iconElement.style.marginTop = "8px";
        return;
    }
    renderImg(background, titleImg);
    imgBtn?.classList.add("fn__none");
    background.imgElement?.parentElement?.classList.remove("fn__none");
    background.iconElement.style.marginTop = "";
    // 移动端键盘弹起和点击加号需保持滚动高度一致
    if (isMobile) {
        background.imgElement?.style.setProperty("height", "200px");
    }
};

/**
 * 作用：根据 tags 字符串渲染标签列表 DOM。
 * 意图：将逗号分隔的标签字符串解析并渲染为可视化 Chip 元素。
 * 调用时机：renderBackground 中调用。
 */
export const renderTags = (background: BackgroundDomain, tagsStr: string) => {
    const tagBtn = background.actionElements[0];
    if (!tagsStr) {
        background.tagsElement.classList.add("fn__none");
        tagBtn?.classList.remove("fn__none");
        return;
    }
    let html = "";
    const colors = ["secondary", "primary", "info", "success", "warning", "error", "pink"];
    const tags = Array.from(new Set(tagsStr.split(",").map(item => item.trim())));

    for (const [index, item] of tags.entries()) {
        if (!item.replace(/ /g, "")) {
            continue;
        }
        html += `<div class="b3-chip b3-chip--middle b3-chip--pointer b3-chip--${colors[index % 7]}" data-type="open-search">${escapeHtml(item)}<svg class="b3-chip__close" data-type="remove-tag"><use xlink:href="#iconCloseRound"></use></svg></div>`;
    }

    background.tagsElement.innerHTML = `${html}
    <div class="protyle-background__action fn__flex-center">
        <button class="b3-button b3-button--cancel" style="margin-bottom: 8px" data-menu="true" data-type="tag"><svg><use xlink:href="#iconAdd"></use></svg>${siyuanI18n.addTag}</button>
    </div>`;
    background.tagsElement.classList.remove("fn__none");
    if (tagBtn) {
        tagBtn.classList.add("fn__none");
    }
};

/**
 * 作用：渲染题头图，将图片 URL 和位置信息应用到 img 元素上。
 * 意图：解析 ial 中的 title-img 属性（通常是 CSS 样式字符串），提取有效的 URL 和 object-position 并应用，同时管理定位按钮的显隐。
 * 调用时机：在 renderBackground 中，当文档具备 title-img 属性时调用。
 * 改进：目前通过临时设置 style 属性来利用浏览器解析 CSS 字符串，随后提取值。
 */
export const renderImg = (background: BackgroundDomain, img: string) => {
    background.imgElement.setAttribute("style", Lute.UnEscapeHTMLStr(img));
    const positionElement = background.element.querySelector('[data-type="position"]');
    if (img.indexOf("url(") === -1) {
        background.imgElement.setAttribute("src", background.transparentData);
        positionElement?.classList.add("fn__none");
        return;
    }
    const position = background.imgElement.style.backgroundPosition || background.imgElement.style.objectPosition;
    const url = background.imgElement.style.backgroundImage?.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
    background.imgElement.removeAttribute("style");
    if (url) {
        background.imgElement.setAttribute("src", url);
    }
    background.imgElement.style.objectPosition = position;
    positionElement?.classList.remove("fn__none");
};
