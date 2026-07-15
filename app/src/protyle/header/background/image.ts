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
import type { Background } from "../Background";
import { renderBackground } from "./render";

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
export const clickPosition = (background: Background, event: MouseEvent) => {
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
export const clickConfirmCancel = (background: Background, protyle: IProtyle, type: string, event: MouseEvent) => {
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
const onBackgroundDialogClick = (background: Background, protyle: IProtyle, dialog: Dialog, event: Event) => {
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

/**
 * 作用：处理“内置背景图”点击。
 */
export const clickShowRandom = (background: Background, protyle: IProtyle, event: MouseEvent) => {
    let html = "";
    for (let index = 0; index < bgs.length; index++) {
        const item = bgs[index];
        html += `<div data-index="${index}" style="height: 128px;${item}" class="b3-card"></div>`;
    }
    const dialog = new Dialog({
        title: siyuanI18n.builtIn,
        content: `<div class="b3-cards" style="padding: 16px">${html}</div>`,
        width: isMobile ? "92vw" : "912px",
        height: isMobile ? "80vh" : "70vh",
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
export const clickRandom = (background: Background, protyle: IProtyle, event: MouseEvent) => {
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
    // 移动端选择资源后关闭全屏菜单
    if (isMobile) {
        getSiyuanGlobalMenusMenu()?.remove();
    }
};

/**
 * 作用：处理“上传/选择图片”点击。
 */
export const clickAsset = (background: Background, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
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
export const clickRemove = (background: Background, protyle: IProtyle, event: MouseEvent) => {
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
export const clickLink = (background: Background, protyle: IProtyle, event: MouseEvent) => {
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
        private background: Background,
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
const handleMouseDown = (event: MouseEvent, background: Background) => {
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
export const bindImgMoveEvent = (background: Background) => {
    background.imgElement.addEventListener("mousedown", (event: MouseEvent) => {
        handleMouseDown(event, background);
    });
};
