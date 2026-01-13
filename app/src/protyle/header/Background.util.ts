import { hasClosestByClassName } from "../util/hasClosest";
import { getRandom, isMobile } from "../../util/functions";
import { hideElements } from "../ui/hideElements";
import { uploadFiles } from "../upload";
import { fetchPost } from "../../util/fetch";
import { getRandomEmoji, openEmojiPanel, unicode2Emoji, updateFileTreeEmoji, updateOutlineEmoji } from "../../emoji";
import { upDownHint } from "../../util/upDownHint";
/// #if !MOBILE
import { openGlobalSearch } from "../../search/util";
/// #else
import { popSearch } from "../../mobile/menu/search";
/// #endif
import { getEventName } from "../util/compatibility";
import { Dialog } from "../../dialog";
import { Constants } from "../../constants";
import { assetMenu } from "../../menus/protyleMenus/protyle.asset";
import { previewImages } from "../preview/image";
import { Menu } from "../../plugin/Menu";
import { escapeHtml } from "../../util/escape";
import { bgs } from "../../util/css/bgs";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanCtrlIsPressed } from "../../util/siyuanEnvironments/keyboardStatus.environment";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import type { Background } from "./Background";

/**
 * 作用：初始化 Background 组件的 DOM 结构。
 * 意图：构建题头图区域的 HTML，包括图片、图标、操作菜单等，并初始化对关键 DOM 元素的引用。
 * 调用时机：Background 类实例化时调用。
 * 问题/改进：HTML 结构硬编码在 JavaScript 中，维护成本较高，建议通过模板引擎或单独的组件文件管理。
 */
export const initBackgroundElement = (background: Background) => {
    background.element = document.createElement("div");
    background.element.className = "protyle-background";
    background.element.innerHTML = `<div class="protyle-background__img">
    <img src="${background.transparentData}">
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

/**
 * 作用：处理题头图区域的拖拽上传事件。
 * 意图：允许用户将图片文件拖入题头图区域直接上传并设置为题头。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：与 bindUploadEvent 存在重复的上传后续处理逻辑（设置样式、请求后端），应提取公共函数。
 */
/**
 * 作用：处理上传成功后的回调。
 * 意图：统一处理题头图上传成功后的后续逻辑（更新 IAL、渲染背景、同步后端）。
 */
const onUploadSuccess = (background: Background, protyle: IProtyle, responseText: string) => {
    const response = JSON.parse(responseText);
    const style = `background-image:url("${response.data.succMap[Object.keys(response.data.succMap)[0]]}")`;
    background.ial["title-img"] = style;
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "title-img": style }
    });
};

/**
 * 作用：处理拖拽放置事件。
 * 意图：验证并处理拖入的图片文件。
 */
const handleDrop = (background: Background, protyle: IProtyle, event: DragEvent) => {
    if (!event.dataTransfer) {
        return;
    }
    const file = event.dataTransfer.files[0];
    if (event.dataTransfer.types[0] === "Files" && file && file.type.indexOf("image") !== -1) {
        uploadFiles(protyle, [file], undefined, (responseText) => onUploadSuccess(background, protyle, responseText));
    }
};

/**
 * 作用：处理题头图区域的拖拽上传事件。
 * 意图：允许用户将图片文件拖入题头图区域直接上传并设置为题头。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：已提取公共函数 onUploadSuccess。
 */
export const bindDropEvent = (background: Background, protyle: IProtyle) => {
    background.element.addEventListener("dragover", (event) => {
        event.preventDefault();
    });
    background.element.addEventListener("drop", (event: DragEvent) => handleDrop(background, protyle, event));
};

/**
 * 作用：处理题头图的拖拽位置调整。
 * 意图：允许用户通过鼠标拖拽上下调整图片的显示视口（object-position）。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：使用了 document.onmousemove 等全局事件处理器，建议使用 addEventListener 以避免覆盖其他全局事件；逻辑中计算位置的公式较复杂，缺少注释说明。
 */
export const bindImgMoveEvent = (background: Background) => {
    background.imgElement.addEventListener("mousedown", (event: MouseEvent) => {
        event.preventDefault();
        const icons = background.element.firstElementChild?.querySelector(".protyle-icons");
        if (icons && !icons.classList.contains("fn__none")) {
            return;
        }
        const y = event.clientY;
        const documentSelf = document;
        const height = background.imgElement.naturalHeight * background.imgElement.clientWidth / background.imgElement.naturalWidth - background.imgElement.clientHeight;
        let originalPositionY = parseFloat(background.imgElement.style.objectPosition.substring(7)) || 50;
        if (background.imgElement.style.objectPosition.endsWith("px")) {
            originalPositionY = -parseInt(background.imgElement.style.objectPosition.substring(7)) / height * 100;
        }
        documentSelf.onmousemove = (moveEvent: MouseEvent) => {
            background.imgElement.style.objectPosition = `center ${((y - moveEvent.clientY) / height * 100 + originalPositionY).toFixed(2)}%`;
            event.preventDefault();
        };

        documentSelf.onmouseup = () => {
            documentSelf.onmousemove = null;
            documentSelf.onmouseup = null;
            documentSelf.ondragstart = null;
            documentSelf.onselectstart = null;
            documentSelf.onselect = null;
        };
    });
};

/**
 * 作用：处理点击按钮上传题头图的事件。
 * 意图：监听隐藏的文件输入框变化，将用户选中的本地图片上传并设置为题头图。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：上传成功后的 DOM 更新和后端同步逻辑未封装，代码重复。
 */
/**
 * 作用：处理上传输入框变化事件。
 * 意图：当用户选择文件后触发上传。
 */
const handleUploadChange = (background: Background, protyle: IProtyle, event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.files && target.files.length > 0) {
        uploadFiles(protyle, target.files, target, (responseText) => onUploadSuccess(background, protyle, responseText));
    }
};

/**
 * 作用：处理点击按钮上传题头图的事件。
 * 意图：监听隐藏的文件输入框变化，将用户选中的本地图片上传并设置为题头。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：已提取公共函数 onUploadSuccess。
 */
export const bindUploadEvent = (background: Background, protyle: IProtyle) => {
    const input = background.element.querySelector("input");
    if (!input) {
        return;
    }
    input.addEventListener("change", (event: Event) => handleUploadChange(background, protyle, event));
};

/**
 * 作用：绑定全局点击事件以处理背景图区域的交互。
 * 意图：通过事件委托处理背景图内部元素的点击，如上传、移除、标签等操作。
 * 调用时机：组件初始化时调用。
 */
export const bindClickEvent = (background: Background, protyle: IProtyle) => {
    background.element.addEventListener(getEventName(), (event) => {
        let target = event.target as HTMLElement;
        hideElements(["gutter"], protyle);

        while (target && !target.isEqualNode(background.element)) {
            if (handleClickItem(background, protyle, target, event as MouseEvent & { detail: number })) {
                break;
            }
            target = target.parentElement;
        }
    });
};

/**
 * 作用：处理题头图点击事件。
 * 意图：如果是点击图片本身，触发预览。
 */
const clickImg = (target: HTMLElement, event: MouseEvent & { detail: number }) => {
    if (target.tagName !== "IMG" || !target.parentElement?.classList.contains("protyle-background__img")) {
        return false;
    }
    const imgSrc = target.getAttribute("src");
    if (event.detail > 1 && imgSrc && !imgSrc.startsWith("data:image/png;base64")) {
        previewImages([imgSrc]);
        event.preventDefault();
        event.stopPropagation();
    }
    // 点击题头图菜单无法消失
    getSiyuanGlobalMenusMenu()?.remove();
    return true;
};

/**
 * 作用：处理“位置调整”按钮点击。
 * 意图：进入图片位置调整模式。
 */
const clickPosition = (background: Background, event: MouseEvent) => {
    const iconContainer = background.element.firstElementChild;
    if (iconContainer) {
        const iconElements = iconContainer.querySelectorAll(".protyle-icons");
        const normalToolbar = iconElements[0];
        const dragHint = iconElements[1];
        const confirmCancel = iconElements[2];
        normalToolbar?.classList.add("fn__none");
        dragHint?.classList.remove("fn__none");
        confirmCancel?.classList.remove("fn__none");
    }
    background.imgElement.style.cursor = "move";
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“确认”或“取消”按钮点击。
 * 意图：保存或取消图片位置调整。
 */
const clickConfirmCancel = (background: Background, protyle: IProtyle, type: string, event: MouseEvent) => {
    background.imgElement.style.cursor = "";
    const iconContainer = background.element.firstElementChild;
    if (iconContainer) {
        const iconElements = iconContainer.querySelectorAll(".protyle-icons");
        const normalToolbar = iconElements[0];
        const dragHint = iconElements[1];
        const confirmCancel = iconElements[2];
        normalToolbar?.classList.remove("fn__none");
        dragHint?.classList.add("fn__none");
        confirmCancel?.classList.add("fn__none");
    }
    event.preventDefault();
    event.stopPropagation();
    if (type === "confirm") {
        const style = `background-image:url("${background.imgElement.getAttribute("src")}");object-position:${background.imgElement.style.objectPosition}`;
        background.ial["title-img"] = style;
        fetchPost("/api/attr/setBlockAttrs", {
            id: protyle.block.rootID,
            attrs: { "title-img": style }
        });
        return true;
    }
    renderBackground(background, background.ial, protyle.block.rootID);
    return true;
};

/**
 * 作用：处理打开表情面板点击。
 */
const clickOpenEmoji = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    const rect = background.iconElement.getBoundingClientRect();
    openEmojiPanel(protyle.block.rootID, "doc", {
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width
    }, undefined, target.querySelector("img") as HTMLImageElement);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理内置背景图对话框的点击事件。
 * 意图：用户选择背景图后更新题头图并关闭对话框。
 */
const onBackgroundDialogClick = (background: Background, protyle: IProtyle, dialog: Dialog, event: Event) => {
    const clickTarget = event.target;
    if (!(clickTarget instanceof HTMLElement)) {
        return;
    }
    if (clickTarget.classList.contains("b3-card")) {
        const index = clickTarget.getAttribute("data-index");
        if (index) {
            background.ial["title-img"] = bgs[parseInt(index)] || "";
            renderBackground(background, background.ial, protyle.block.rootID);
            fetchPost("/api/attr/setBlockAttrs", {
                id: protyle.block.rootID,
                attrs: { "title-img": background.ial["title-img"] }
            });
            dialog.destroy();
        }
    }
};

/**
 * 作用：处理“内置背景图”点击。
 */
const clickShowRandom = (background: Background, protyle: IProtyle, event: MouseEvent) => {
    let html = "";
    for (let index = 0; index < bgs.length; index++) {
        const item = bgs[index];
        html += `<div data-index="${index}" style="height: 128px;${item}" class="b3-card b3-card--wrap"></div>`;
    }
    const dialog = new Dialog({
        title: siyuanI18n.builtIn,
        content: `<div class="b3-cards">${html}</div>`,
        width: isMobile() ? "92vw" : "912px",
        height: isMobile() ? "80vh" : "70vh",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_BACKGROUNDRANDOM);
    dialog.element.addEventListener("click", (event) => {
        onBackgroundDialogClick(background, protyle, dialog, event);
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“随机背景图”点击。
 * 意图：从内置背景图列表中随机选择一张，作为文档的题头图。
 * 调用时机：点击题头图下方工具栏的随机按钮时调用。
 */
const clickRandom = (background: Background, protyle: IProtyle, event: MouseEvent) => {
    background.ial["title-img"] = bgs[getRandom(0, bgs.length - 1)] || "";
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "title-img": background.ial["title-img"] }
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理资源菜单中选择图片后的回调。
 * 意图：设置文档题头图为选中的图片。
 */
const handleAssetSelect = (background: Background, protyle: IProtyle, url: string) => {
    const safeUrl = url || "";
    background.ial["title-img"] = `background-image:url("${safeUrl}")`;
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "title-img": background.ial["title-img"] }
    });
    /// #if MOBILE
    getSiyuanGlobalMenusMenu()?.remove();
    /// #endif
};

/**
 * 作用：处理“上传/选择图片”点击。
 */
const clickAsset = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    const rect = target.getBoundingClientRect();
    const parentRect = target.parentElement?.getBoundingClientRect();
    assetMenu(protyle, {
        x: parentRect ? parentRect.right : rect.right,
        y: rect.bottom + 8,
        isLeft: true,
    }, (url) => handleAssetSelect(background, protyle, url), Constants.SIYUAN_ASSETS_IMAGE);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“移除背景图”点击。
 */
const clickRemove = (background: Background, protyle: IProtyle, event: MouseEvent) => {
    delete background.ial["title-img"];
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "title-img": "" }
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“添加图标”点击。
 */
const clickIcon = (background: Background, protyle: IProtyle, event: MouseEvent) => {
    const emoji = getRandomEmoji();
    if (typeof emoji === "string" && emoji) {
        updateFileTreeEmoji(emoji, protyle.block.rootID);
        updateOutlineEmoji(emoji, protyle.block.rootID);
        fetchPost("/api/attr/setBlockAttrs", {
            id: protyle.block.rootID,
            attrs: { "icon": emoji }
        });
        if (protyle.model) {
            protyle.model.parent.setDocIcon(emoji);
        }
        background.iconElement.classList.remove("fn__none");
        const rect = background.iconElement.getBoundingClientRect();
        openEmojiPanel(protyle.block.rootID, "doc", {
            x: rect.left,
            y: rect.bottom,
            h: rect.height,
            w: rect.width
        });
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“添加标签”点击。
 */
const clickTag = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    openTag(background, protyle, target);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理链接背景图确认。
 */
const handleLinkConfirm = (dialog: Dialog, background: Background, protyle: IProtyle) => {
    const input = dialog.element.querySelector("input");
    if (input) {
        const style = `background-image:url("${input.value}");`;
        background.ial["title-img"] = style;
        renderBackground(background, background.ial, protyle.block.rootID);
        fetchPost("/api/attr/setBlockAttrs", {
            id: protyle.block.rootID,
            attrs: { "title-img": background.ial["title-img"] }
        });
    }
    dialog.destroy();
};

/**
 * 作用：处理“链接背景图”点击。
 */
const clickLink = (background: Background, protyle: IProtyle, event: MouseEvent) => {
    const dialog = new Dialog({
        title: siyuanI18n.link,
        width: isMobile() ? "92vw" : "520px",
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="${background.imgElement.src.startsWith("data:") ? "" : background.imgElement.getAttribute("src")}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_BACKGROUNDLINK);
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const cancelBtn = btnsElement[0];
    const confirmBtn = btnsElement[1];
    cancelBtn?.addEventListener("click", () => {
        dialog.destroy();
    });
    confirmBtn?.addEventListener("click", () => {
        handleLinkConfirm(dialog, background, protyle);
    });
    const inputInit = dialog.element.querySelector("input");
    if (inputInit) {
        inputInit.focus();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理标签点击（打开搜索）。
 */
const clickOpenSearch = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    /// #if !MOBILE
    openGlobalSearch(protyle.app, `#${target.textContent}#`, !getSiyuanCtrlIsPressed(), { method: 0 });
    /// #else
    popSearch(protyle.app, {
        hasReplace: false,
        method: 0,
        hPath: "",
        idPath: [],
        k: `#${target.textContent}#`,
        r: "",
        page: 1,
    });
    /// #endif
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“移除标签”点击。
 */
const clickRemoveTag = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    target.parentElement?.remove();
    removeTag(background, protyle);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：分发处理题头图区域的点击事件。
 * 意图：根据点击元素的 data-type 属性调用相应的处理函数。
 */
const handleClickItem = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent & { detail: number }) => {
    if (clickImg(target, event)) {
        return true;
    }
    if (protyle.disabled) {
        return false;
    }
    const type = target.getAttribute("data-type");
    if (!type) {
        return false;
    }
    if (type === "position") {
        return clickPosition(background, event);
    }
    if (type === "cancel" || type === "confirm") {
        return clickConfirmCancel(background, protyle, type, event);
    }
    if (type === "open-emoji") {
        return clickOpenEmoji(background, protyle, target, event);
    }
    if (type === "show-random") {
        return clickShowRandom(background, protyle, event);
    }
    if (type === "random") {
        /** @简洁函数 委托调用 clickRandom */
        return clickRandom(background, protyle, event);
    }
    if (type === "asset") {
        return clickAsset(background, protyle, target, event);
    }
    if (type === "remove") {
        return clickRemove(background, protyle, event);
    }
    if (type === "icon") {
        return clickIcon(background, protyle, event);
    }
    if (type === "tag") {
        return clickTag(background, protyle, target, event);
    }
    if (type === "link") {
        return clickLink(background, protyle, event);
    }
    if (type === "open-search") {
        return clickOpenSearch(background, protyle, target, event);
    }
    if (type === "remove-tag") {
        return clickRemoveTag(background, protyle, target, event);
    }
    return false;
};

/**
 * 作用：移除文档的标签。
 * 意图：更新后端属性并在前端移除标签显示。
 * 调用时机：用户点击移除标签或在菜单中取消选中时。
 */
const removeTag = (background: Background, protyle: IProtyle, cb?: () => void) => {
    const tags = getTags(background.tagsElement);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "tags": tags.toString() }
    }, () => {
        if (cb) {
            cb();
        }
    });
    if (tags.length === 0) {
        delete background.ial.tags;
    } else {
        background.ial.tags = tags.toString();
    }
    renderBackground(background, background.ial, protyle.block.rootID);
};

const openTag = (background: Background, protyle: IProtyle, target: HTMLElement) => {
    getSiyuanGlobalMenusMenu()?.remove();
    const menu = new Menu();
    menu.addItem({
        iconHTML: "",
        type: "empty",
        label: `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${siyuanI18n.tag}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
        <img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg">
    </div>
</div>`,
        bind: (element) => {
            const listElement = element.querySelector(".b3-list--background");
            fetchPost("/api/search/searchTag", {
                k: "",
            }, (response) => {
                let html = "";
                const currentTags = getTags(background.tagsElement);
                for (const [index, item] of response.data.tags.entries()) {
                    html += `<div class="b3-list-item b3-list-item--narrow${index === 0 ? " b3-list-item--focus" : ""}">
    <div class="fn__flex-1">${item}</div>
    ${currentTags.includes(Lute.UnEscapeHTMLStr(item)) ? '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>' : ""}
</div>`;
                }
                if (listElement) {
                    listElement.innerHTML = html;
                }
            });
            const inputElement = element.querySelector("input");
            if (!inputElement || !listElement) {
                return;
            }

            inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                event.stopPropagation();
                if (event.isComposing) {
                    return;
                }
                upDownHint(listElement, event);
                if (event.key === "Enter") {
                    const currentElement = listElement.querySelector(".b3-list-item--focus") as HTMLElement;
                    let tagText = inputElement.value.trim();
                    if (currentElement) {
                        const mark = currentElement.querySelector("mark");
                        if (currentElement.dataset.type === "new" && mark) {
                            tagText = mark.textContent?.trim() || "";
                        } else {
                            tagText = currentElement.textContent?.trim() || "";
                        }
                    }
                    toggleTag(background, tagText, protyle, () => {
                        inputElement.value = "";
                        inputElement.dispatchEvent(new CustomEvent("input"));
                    });
                } else if (event.key === "Escape") {
                    getSiyuanGlobalMenusMenu()?.remove();
                }
            });
            inputElement.addEventListener("input", (event) => {
                event.stopPropagation();
                fetchPost("/api/search/searchTag", {
                    k: inputElement.value.trim(),
                }, (response) => {
                    let searchHTML = "";
                    let hasKey = false;
                    const currentTags = getTags(background.tagsElement);
                    for (const [index, item] of response.data.tags.entries()) {
                        searchHTML += `<div class="b3-list-item b3-list-item--narrow${index === 0 ? " b3-list-item--focus" : ""}">
    <div class="fn__flex-1">${item}</div>
    ${currentTags.includes(Lute.UnEscapeHTMLStr(item.replace(/<mark>/g, "").replace(/<\/mark>/g, ""))) ? '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>' : ""}
</div>`;
                        if (item === `<mark>${response.data.k}</mark>`) {
                            hasKey = true;
                        }
                    }
                    if (!hasKey && response.data.k) {
                        searchHTML = `<div data-type="new" class="b3-list-item b3-list-item--narrow${searchHTML ? "" : " b3-list-item--focus"}"><div class="fn__flex-1">${siyuanI18n.new} <mark>${escapeHtml(response.data.k)}</mark></div></div>` + searchHTML;
                    }
                    if (listElement) {
                        listElement.innerHTML = searchHTML;
                    }
                });
            });
            listElement.addEventListener("click", (event) => {
                const target = event.target as HTMLElement;
                const listItemElement = hasClosestByClassName(target, "b3-list-item");
                if (!listItemElement) {
                    return;
                }
                let tagText = listItemElement.textContent?.trim() || "";
                if (listItemElement.dataset.type === "new") {
                    const mark = listItemElement.querySelector("mark");
                    if (mark) {
                        tagText = mark.textContent?.trim() || "";
                    }
                }
                toggleTag(background, tagText,
                    protyle, () => {
                        inputElement.value = "";
                        inputElement.dispatchEvent(new CustomEvent("input"));
                        inputElement.focus();
                    });
            });
        }
    });
    const itemsElement = menu.element.querySelector(".b3-menu__items");
    if (itemsElement) {
        itemsElement.setAttribute("style", "overflow: initial");
    }
    /// #if MOBILE
    menu.fullscreen();
    const firstChild = itemsElement?.firstElementChild;
    if (firstChild) {
        firstChild.setAttribute("style", "padding: 0 8px;height: 100%;");
    }
    /// #else
    const rect = target.getBoundingClientRect();
    menu.open({ x: rect.left, y: rect.top + rect.height });
    const input = menu.element.querySelector("input");
    if (input) {
        input.focus();
    }
    /// #endif
};

/**
 * 作用：从 DOM 元素中获取标签列表。
 * 意图：解析当前的标签 DOM 结构获取数据。如果指定了 removeTag，则有副作用：会从 DOM 中移除对应的标签元素，且返回的列表中不包含该标签。
 * 调用时机：在移除标签、切换标签状态或需要从 DOM 同步标签数据时调用。
 * 改进：removeTag 参数导致函数具有修改 DOM 的副作用，且使得 toggleTag 逻辑中无法正确判断标签是否已存在（因为已被移除），导致无法通过切换操作移除标签。建议分离读取和修改逻辑。
 */
const getTags = (tagsElement: HTMLElement, removeTag?: string) => {
    const tags: string[] = [];
    const elements = tagsElement.querySelectorAll(".b3-chip");
    for (const item of elements) {
        const tagText = item.textContent?.trim();
        if (!tagText) {
            continue;
        }
        if (removeTag && tagText === removeTag) {
            item.remove();
            continue;
        }
        tags.push(tagText);
    }
    return tags;
};

/**
 * 作用：为当前文档添加指定标签，如果标签已存在则移除（Toggle 行为）。
 * 意图：处理用户在标签搜索/选择菜单中的操作，同步更新 DOM 和后端属性。
 * 调用时机：用户在标签菜单中按回车或点击选中某个标签时。
 */
const toggleTag = (background: Background, tag: string, protyle: IProtyle, cb: () => void) => {
    const tags = getTags(background.tagsElement, tag);
    if (tags.includes(tag)) {
        removeTag(background, protyle, cb);
        return;
    }
    tags.push(tag);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "tags": tags.toString() }
    }, () => {
        cb();
    });
    background.ial.tags = tags.toString();
    renderBackground(background, background.ial, protyle.block.rootID);
};

/**
 * 渲染 Background 组件
 * @param background Background instance
 * @param ial IObject attributes
 * @param rootId Root Block ID
 */
export const renderBackground = (background: Background, ial: IObject, rootId: string) => {
    background.ial = ial;
    background.element.setAttribute("data-node-id", rootId);

    // Render Tags
    const tagBtn = background.actionElements[0];
    if (ial.tags) {
        renderTags(background, ial.tags);
    }
    if (!ial.tags) {
        background.tagsElement.classList.add("fn__none");
        tagBtn?.classList.remove("fn__none");
    }

    // Render Icon
    const iconBtn = background.actionElements[1];
    if (ial.icon) {
        background.iconElement.classList.remove("fn__none");
        background.iconElement.innerHTML = unicode2Emoji(ial.icon);
        iconBtn?.classList.add("fn__none");
    }
    if (!ial.icon) {
        iconBtn?.classList.remove("fn__none");
        background.iconElement.classList.add("fn__none");
    }

    // Render Img
    const imgBtn = background.actionElements[2];
    if (ial["title-img"]) {
        renderImg(background, ial["title-img"]);
        imgBtn?.classList.add("fn__none");
        background.imgElement?.parentElement?.classList.remove("fn__none");
        background.iconElement.style.marginTop = "";
        /// #if MOBILE
        background.imgElement?.style.setProperty("height", "200px");
        /// #endif
    }
    if (!ial["title-img"]) {
        background.imgElement?.parentElement?.classList.add("fn__none");
        imgBtn?.classList.remove("fn__none");
        background.iconElement.style.marginTop = "8px";
    }

    if (ial["title-img"] || ial.icon) {
        background.iconElement.parentElement?.style.setProperty("margin-top", null); // Remove inline style
        return;
    }
    background.iconElement.parentElement?.style.setProperty("margin-top", "8px");
};

/**
 * 作用：根据 tags 字符串渲染标签列表 DOM。
 * 意图：将逗号分隔的标签字符串解析并渲染为可视化 Chip 元素。
 * 调用时机：renderBackground 中调用。
 */
const renderTags = (background: Background, tagsStr: string) => {
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
    const tagBtn = background.actionElements[0];
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
const renderImg = (background: Background, img: string) => {
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
