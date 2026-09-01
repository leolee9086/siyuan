import { isMobile } from "../../../platform";
import { getRandom } from "../../../util/platform/functions";
import { fetchPost } from "../../../util/network/fetch";
import { Dialog } from "../../runtime/dialog.port";
import { Constants } from "../../../constants";
import { assetMenu } from "../../../menus/protyleMenus/assetMenu/protyle.asset";
import { previewImages } from "../../preview/image";
import { bgs } from "../../../util/assets/backgrounds.ts";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import type {BackgroundDomain} from "./background.types";
import { renderBackground } from "./render";
import {fetchCoverData, getCategoryLabel} from "../coverData";

/** 将题头图对话框归属到所在块浮窗，确保浮窗层级关闭时能一并处理。 */
export const bindPopoverDialog = (dialog: Dialog, ownerElement: HTMLElement) => {
    const popoverElement = ownerElement.closest<HTMLElement>(".block__popover");
    const popoverOID = popoverElement?.dataset.oid;
    const popoverLevel = popoverElement?.dataset.level;
    if (!popoverOID || !popoverLevel) {
        return;
    }
    dialog.element.dataset.popoverOid = popoverOID;
    dialog.element.dataset.popoverLevel = popoverLevel;
};

/**
 * 作用：处理题头图点击事件。
 * 意图：如果是点击图片本身，触发预览。
 */
export const clickImg = (target: HTMLElement, event: MouseEvent & { detail: number }) => {
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
export const clickPosition = (background: BackgroundDomain, event: MouseEvent) => {
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
export const clickConfirmCancel = (background: BackgroundDomain, protyle: IProtyle, type: string, event: MouseEvent) => {
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
 * 作用：处理内置背景图对话框的点击事件。
 * 意图：用户选择背景图后更新题头图并关闭对话框。
 */
const onBackgroundDialogClick = (background: BackgroundDomain, protyle: IProtyle, dialog: Dialog, event: Event) => {
    const clickTarget = event.target;
    if (!(clickTarget instanceof HTMLElement)) {
        return;
    }
    if (!clickTarget.classList.contains("b3-card")) {
        return;
    }
    const index = clickTarget.getAttribute("data-index");
    if (!index) {
        return;
    }
    background.ial["title-img"] = bgs[parseInt(index, 10)] || "";
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "title-img": background.ial["title-img"] }
    });
    dialog.destroy();
};

/** 作用：持久化题头图样式并刷新当前背景；意图：内置图片和 CSS 图案共享唯一更新路径；调用时机：用户选择或随机生成题头图后。 */
const applyTitleImage = (background: BackgroundDomain, protyle: IProtyle, style: string) => {
    background.ial["title-img"] = style;
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: {"title-img": style},
    });
};

/** 作用：把内置封面资源复制到当前文档并设为题头图；意图：文档不直接依赖应用静态资源路径；调用时机：封面卡片被选中或随机选中时。 */
const insertCover = (background: BackgroundDomain, protyle: IProtyle, name: string) => {
    fetchPost("/api/asset/insertCover", {id: protyle.block.rootID, name}, (response) => {
        const succMap = response.data?.succMap;
        const firstKey = succMap ? Object.keys(succMap)[0] : undefined;
        if (!firstKey) {
            console.error(`insert cover failed: ${name}`);
            return;
        }
        applyTitleImage(background, protyle, `background-image:url("${succMap[firstKey]}")`);
    });
};

/** 作用：生成指定分类的封面卡片；意图：分类切换时只替换卡片区；调用时机：初始打开与分类切换时。 */
const buildCoverCards = (category: string, coverData: Awaited<ReturnType<typeof fetchCoverData>>) => {
    if (!coverData) {
        return "";
    }
    const covers = category === "all" ? coverData.allCovers : (coverData.coversByCategory.get(category) || []);
    return covers.map((cover) => `<div class="b3-card b3-cover__card" data-name="${cover.file}"><img src="/appearance/covers/${cover.file}" loading="lazy"></div>`).join("");
};

/** 作用：生成封面分类选择器；意图：保持 manifest 分类顺序与当前选中态；调用时机：封面对话框渲染时。 */
const buildCoverTabs = (activeCategory: string, categories: string[]) => {
    let tabs = `<span class="b3-chip b3-chip--hover${activeCategory === "all" ? " b3-chip--current" : ""}" data-category="all">${siyuanI18n.coverAll}</span>`;
    for (const category of categories) {
        tabs += `<span class="b3-chip b3-chip--hover${activeCategory === category ? " b3-chip--current" : ""}" data-category="${category}">${getCategoryLabel(category)}</span>`;
    }
    return `<div class="b3-cover__tabs">${tabs}</div>`;
};

/** 作用：打开现有 CSS 图案选择器；意图：当图片 manifest 未加载时仍保留原有内置图案能力；调用时机：封面数据请求无结果时。 */
const renderCssPatternDialog = (background: BackgroundDomain, protyle: IProtyle, dialog: Dialog) => {
    let html = "";
    for (let index = 0; index < bgs.length; index++) {
        html += `<div data-index="${index}" style="height: 128px;${bgs[index]}" class="b3-card"></div>`;
    }
    const bodyElement = dialog.element.querySelector(".b3-dialog__body");
    if (!bodyElement) {
        console.error("background dialog body is missing");
        return;
    }
    bodyElement.innerHTML = `<div class="b3-cards" style="padding: 16px">${html}</div>`;
    dialog.element.addEventListener("click", (event) => onBackgroundDialogClick(background, protyle, dialog, event));
};

/** 作用：以分类小组呈现图片封面并处理切换/选中；意图：使用事件委托支持内容重渲染；调用时机：manifest 成功加载后。 */
const renderCoverDialog = (
    background: BackgroundDomain,
    protyle: IProtyle,
    dialog: Dialog,
    coverData: NonNullable<Awaited<ReturnType<typeof fetchCoverData>>>,
) => {
    const bodyElement = dialog.element.querySelector<HTMLElement>(".b3-dialog__body");
    if (!bodyElement) {
        console.error("cover dialog body is missing");
        return;
    }
    let activeCategory = "all";
    const renderContent = () => {
        bodyElement.innerHTML = `${buildCoverTabs(activeCategory, coverData.categories)}
<div class="b3-cards b3-cover__cards" style="padding:16px">${buildCoverCards(activeCategory, coverData)}</div>`;
    };
    renderContent();
    bodyElement.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const categoryElement = target.closest<HTMLElement>("[data-category]");
        if (categoryElement) {
            activeCategory = categoryElement.dataset.category || "all";
            renderContent();
            bodyElement.scrollTop = 0;
            return;
        }
        const coverElement = target.closest<HTMLElement>(".b3-cover__card");
        const name = coverElement?.dataset.name;
        if (!name) {
            return;
        }
        insertCover(background, protyle, name);
        dialog.destroy();
    });
};

/** 作用：创建并填充内置题头图对话框；意图：将数据加载与点击分发留在图片模块；调用时机：用户点击内置背景入口时。 */
const openBuiltInBackgroundDialog = async (background: BackgroundDomain, protyle: IProtyle) => {
    const dialog = new Dialog({
        title: siyuanI18n.builtIn,
        content: '<div class="b3-cards" style="padding:16px"><img style="margin:auto;width:64px;height:64px" src="/stage/loading-pure.svg"></div>',
        width: isMobile ? "92vw" : "912px",
        height: isMobile ? "80vh" : "70vh",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_BACKGROUNDRANDOM);
    bindPopoverDialog(dialog, protyle.element);
    const coverData = await fetchCoverData();
    if (!coverData) {
        renderCssPatternDialog(background, protyle, dialog);
        return;
    }
    renderCoverDialog(background, protyle, dialog, coverData);
};

/**
 * 作用：处理“内置背景图”点击。
 */
export const clickShowRandom = (background: BackgroundDomain, protyle: IProtyle, event: MouseEvent) => {
    void openBuiltInBackgroundDialog(background, protyle).catch((error) => {
        console.error("open built-in background dialog failed", error);
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
export const clickRandom = (background: BackgroundDomain, protyle: IProtyle, event: MouseEvent) => {
    void fetchCoverData().then((coverData) => {
        if (coverData && coverData.allCovers.length > 0) {
            const randomCover = coverData.allCovers[getRandom(0, coverData.allCovers.length - 1)];
            insertCover(background, protyle, randomCover.file);
            return;
        }
        applyTitleImage(background, protyle, bgs[getRandom(0, bgs.length - 1)] || "");
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理资源菜单中选择图片后的回调。
 * 意图：设置文档题头图为选中的图片。
 */
const handleAssetSelect = (background: BackgroundDomain, protyle: IProtyle, url: string) => {
    const safeUrl = url || "";
    background.ial["title-img"] = `background-image:url("${safeUrl}")`;
    renderBackground(background, background.ial, protyle.block.rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "title-img": background.ial["title-img"] }
    });
    // 移动端选择资源后关闭全屏菜单
    if (isMobile) {
        getSiyuanGlobalMenusMenu()?.remove();
    }
};

/**
 * 作用：处理“上传/选择图片”点击。
 */
export const clickAsset = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    const rect = target.getBoundingClientRect();
    const parentRect = target.parentElement?.getBoundingClientRect();
    assetMenu({
        protyle,
        position: {
            x: parentRect ? parentRect.right : rect.right,
            y: rect.bottom + 8,
            isLeft: true,
        },
        destination: {
            kind: "callback",
            select: (url) => handleAssetSelect(background, protyle, url),
        },
        exts: Constants.SIYUAN_ASSETS_IMAGE,
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“移除背景图”点击。
 */
export const clickRemove = (background: BackgroundDomain, protyle: IProtyle, event: MouseEvent) => {
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
 * 作用：处理链接背景图确认。
 */
const handleLinkConfirm = (dialog: Dialog, background: BackgroundDomain, protyle: IProtyle) => {
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
export const clickLink = (background: BackgroundDomain, protyle: IProtyle, event: MouseEvent) => {
    const dialog = new Dialog({
        title: siyuanI18n.link,
        width: isMobile ? "92vw" : "520px",
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="${background.imgElement.src.startsWith("data:") ? "" : background.imgElement.getAttribute("src")}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_BACKGROUNDLINK);
    bindPopoverDialog(dialog, protyle.element);
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
 * 作用：拖拽图片位置的辅助类。
 */
class ImagePositionDragger {
    constructor(
        private background: BackgroundDomain,
        private height: number,
        private originalPositionY: number,
        private startY: number
    ) { }

    /**
     * 作用：处理鼠标移动事件，更新图片位置。
     */
    public onMove = (moveEvent: MouseEvent) => {
        this.background.imgElement.style.objectPosition = `center ${((this.startY - moveEvent.clientY) / this.height * 100 + this.originalPositionY).toFixed(2)}%`;
        moveEvent.preventDefault();
    };

    /**
     * 作用：处理鼠标松开事件，清理事件监听。
     */
    public onUp = () => {
        document.removeEventListener("mousemove", this.onMove);
        document.removeEventListener("mouseup", this.onUp);
        document.ondragstart = null;
        document.onselectstart = null;
        document.onselect = null;
    };
}

/**
 * 作用：处理图片 mousedown 事件，初始化拖拽。
 */
const handleMouseDown = (event: MouseEvent, background: BackgroundDomain) => {
    event.preventDefault();
    const icons = background.element.firstElementChild?.querySelector(".protyle-icons");
    if (icons && !icons.classList.contains("fn__none")) {
        return;
    }
    const y = event.clientY;
    const height = background.imgElement.naturalHeight * background.imgElement.clientWidth / background.imgElement.naturalWidth - background.imgElement.clientHeight;
    let originalPositionY = parseFloat(background.imgElement.style.objectPosition.substring(7)) || 50;
    if (background.imgElement.style.objectPosition.endsWith("px")) {
        originalPositionY = -parseInt(background.imgElement.style.objectPosition.substring(7), 10) / height * 100;
    }

    const dragger = new ImagePositionDragger(background, height, originalPositionY, y);
    document.addEventListener("mousemove", dragger.onMove);
    document.addEventListener("mouseup", dragger.onUp);
};

/**
 * 作用：处理题头图的拖拽位置调整。
 * 意图：允许用户通过鼠标拖拽上下调整图片的显示视口（object-position）。
 * 调用时机：组件初始化时绑定事件。
 */
export const bindImgMoveEvent = (background: BackgroundDomain) => {
    background.imgElement.addEventListener("mousedown", (event: MouseEvent) => {
        handleMouseDown(event, background);
    });
};
