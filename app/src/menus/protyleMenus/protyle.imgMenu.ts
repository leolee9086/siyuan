import * as dayjs from "dayjs";
import { fetchPost } from "../../ai/imports";
import { Constants } from "../../constants";
import { renameAsset } from "../../editor/rename";
import { emitOpenMenu } from "../../plugin/EventBus";
import { hideElements } from "../../protyle/ui/hideElements";
import { hasClosestBlock, hasTopClosestByClassName } from "../../protyle/util/hasClosest";
import { focusByWbr } from "../../protyle/util/selection";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import { openMenu } from "../commonMenuItem.openMenu";
import { MenuItem } from "../Menu.Item";
import {
    genAlignCenterItem,
    genAlignLeftItem,
    genCopyAsPNGItem,
    genCopyImageURLItem,
    genCopyItem,
    genCutItem,
    genDeleteItem,
    genExportItem,
    genRenameItem
} from "../protyle.imgMenu.actions";
import { genImageSettingsItem, genOCRItem } from "../protyle.imgMenu.items";
import { genHeightItem, genWidthItem } from "../protyle.imgMenu.size";

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

    /// #if MOBILE
    getSiyuanGlobalMenusMenu().fullscreen();
    /// #else
    getSiyuanGlobalMenusMenu().popup({ x: position.clientX, y: position.clientY });
    /// #endif

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");

    if (!protyle.disabled) {
        bindMenuEvents(protyle, nodeElement, imgElement, id, html);
    }
};

const bindMenuEvents = (protyle: IProtyle, nodeElement: Element, imgElement: HTMLImageElement, id: string, html: string) => {
    const menu = getSiyuanGlobalMenusMenu();
    const textElements = menu.element.querySelectorAll("textarea");
    // Focus title or url depending on content
    if (textElements.length > 1) {
        if (textElements[0].value) {
            textElements[1].select();
        } else {
            textElements[0].select();
        }
    }

    menu.removeCB = () => {
        const ocrElement = menu.element.querySelector('[data-type="ocr"]') as HTMLTextAreaElement;
        if (ocrElement && ocrElement.dataset.ocrText !== ocrElement.value) {
            fetchPost("/api/asset/setImageOCRText", {
                path: imgElement.getAttribute("src"),
                text: ocrElement.value
            });
        }
        if (textElements.length > 2) {
            imgElement.setAttribute("alt", textElements[2].value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
        }
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, id, nodeElement.outerHTML, html);
    };
};

