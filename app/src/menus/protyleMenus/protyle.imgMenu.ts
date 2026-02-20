import * as dayjs from "dayjs";
import { fetchPost } from "../../ai/imports";
import { base64ToURL } from "../../util/image";
import { Constants } from "../../constants";
import { isElectron, isMobile } from "../../platform";
import { renameAsset } from "../../editor/rename";
import { emitOpenMenu } from "../../plugin/EventBus";
import { hideElements } from "../../protyle/ui/hideElements";
import { hasClosestBlock, hasTopClosestByClassName } from "../../protyle/util/hasClosest";
import { focusByWbr } from "../../protyle/util/selection";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import { openMenu } from "../commonMenuItem.openMenu";
import { MenuItem } from "../Menu.Item";
import {
    genAlignCenterItem,
    genAlignLeftItem,
    genCopyAssetItem,
    genCopyAsPNGItem,
    genCopyImageURLItem,
    genCopyItem,
    genCutItem,
    genDeleteItem,
    genExportItem,
    genRenameItem
} from "./protyle.imgMenu.actions";
import { genImageSettingsItem, genOCRItem } from "./protyle.imgMenu.items";
import { genHeightItem, genWidthItem } from "./protyle.imgMenu.size";

/**
 * @zh-CN
 * @作用: 显示图片上下文菜单
 * @意图: 为 Protyle 编辑器中的图片提供操作菜单，包括复制链接、修改标题、OSC 识别、星级评分等功能。
 * @调用时机: 当用户在图片上点击右键或进行特定交互时调用。
 */
export const imgMenu = (protyle: IProtyle, range: Range, assetElement: HTMLElement, position: {
    clientX: number;
    clientY: number;
}) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_IMG);
    const nodeElement = hasClosestBlock(assetElement);
    if (!nodeElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);
    const id = nodeElement.getAttribute("data-node-id") || "";
    const imgElement = assetElement.querySelector("img");
    if (!imgElement) {
        return;
    }
    const html = nodeElement.outerHTML;
    const src = imgElement.getAttribute("src") || "";

    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(genImageSettingsItem(assetElement, nodeElement, imgElement).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }

    getSiyuanGlobalMenusMenu().append(genCopyItem(protyle, assetElement).element);

    if (protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(genCopyImageURLItem(imgElement).element);
    }
    getSiyuanGlobalMenusMenu().append(genCopyAsPNGItem(imgElement).element);

    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(genCutItem(protyle, assetElement, nodeElement, id, html, range).element);
        getSiyuanGlobalMenusMenu().append(genDeleteItem(protyle, assetElement, nodeElement, id, html, range).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);

        const imagePath = imgElement.getAttribute("data-src") || "";
        if (imagePath.startsWith("assets/")) {
            getSiyuanGlobalMenusMenu().append(genRenameItem(imagePath).element);
        }
        getSiyuanGlobalMenusMenu().append(genOCRItem(imgElement).element);
        getSiyuanGlobalMenusMenu().append(genAlignCenterItem(protyle, nodeElement, assetElement, id, html).element);
        getSiyuanGlobalMenusMenu().append(genAlignLeftItem(protyle, nodeElement, assetElement, id, html).element);
        getSiyuanGlobalMenusMenu().append(genWidthItem(protyle, nodeElement, imgElement, assetElement).element);
        getSiyuanGlobalMenusMenu().append(genHeightItem(protyle, nodeElement, imgElement, assetElement).element);
    }

    if (src) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_3", type: "separator" }).element);
        openMenu(protyle.app, src, false, false);
    }

    const dataSrc = imgElement.getAttribute("data-src");
    if (dataSrc && dataSrc.startsWith("assets/")) {
        getSiyuanGlobalMenusMenu().append(genExportItem(dataSrc).element);
        // 仅 Electron 桌面端（Windows/macOS）支持复制资源文件到系统剪贴板
        if (isElectron && ["windows", "darwin"].includes(getSiyuanConfig().system.os)) {
            getSiyuanGlobalMenusMenu().append(genCopyAssetItem(dataSrc).element);
        }
    }

    if (protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-image",
            detail: {
                protyle,
                element: assetElement,
            },
            separatorPosition: "top",
        });
    }

    // 移动端使用全屏菜单
    if (isMobile) {
        getSiyuanGlobalMenusMenu().fullscreen();
    }
    // 非移动端使用弹出菜单
    if (!isMobile) {
        getSiyuanGlobalMenusMenu().popup({ x: position.clientX, y: position.clientY });
    }

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");

    if (!protyle.disabled) {
        bindMenuEvents(protyle, nodeElement, assetElement, imgElement, id, src, html);
    }
};

/**
 * @zh-CN
 * @作用: 绑定图片菜单关闭时的回调事件
 * @意图: 在菜单关闭时保存用户对图片属性的修改（src、alt、OCR文本），并处理 base64 图片源转换
 * @调用时机: imgMenu 中菜单弹出后、编辑器未禁用时调用
 */
const bindMenuEvents = (protyle: IProtyle, nodeElement: Element, assetElement: HTMLElement, imgElement: HTMLImageElement, id: string, src: string, html: string) => {
    const menu = getSiyuanGlobalMenusMenu();
    const textElements = menu.element.querySelectorAll("textarea");
    // 当 URL 输入框已有值时，聚焦标题输入框；否则聚焦 URL 输入框
    const urlInput = textElements[0];
    const titleInput = textElements[1];
    const focusTarget = (urlInput?.value) ? titleInput : urlInput;
    focusTarget?.select();

    menu.removeCB = async () => {
        const srcInput = textElements[0];
        const newSrc = srcInput?.value;
        // 当用户将图片源修改为 base64 内联数据时，将其上传转换为资源文件 URL
        if (newSrc && src !== newSrc && newSrc.startsWith("data:image/")) {
            const base64Src = await base64ToURL([newSrc]);
            const convertedSrc = base64Src[0] ?? "";
            imgElement.setAttribute("src", convertedSrc);
            imgElement.setAttribute("data-src", convertedSrc);
            const netIndicator = assetElement.querySelector(".img__net");
            netIndicator?.remove();
        }

        const ocrElement = menu.element.querySelector('[data-type="ocr"]');
        // 当 OCR 文本被用户修改时，同步更新到后端
        if (ocrElement instanceof HTMLTextAreaElement && ocrElement.dataset.ocrText !== ocrElement.value) {
            fetchPost("/api/asset/setImageOCRText", {
                path: imgElement.getAttribute("src"),
                text: ocrElement.value
            });
        }
        // 当存在 alt 文本输入框时，更新图片的 alt 属性
        const altInput = textElements[2];
        if (altInput) {
            imgElement.setAttribute("alt", altInput.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
        }
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, id, nodeElement.outerHTML, html);
    };
};

