import {hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, isInEmbedBlock} from "../util/hasClosest";
import {focusSideBlock, getEditorRange} from "../util/selection";
import {isMobile} from "../../util/platform/functions";
import {isNotEditBlock} from "./getBlock";
import {submitAVViewTransaction} from "./transaction/prepared/av/view/avView";
import {hideElements} from "../ui/hideElements";
import {removeSearchMark} from "../toolbar/util";
import {refMenu} from "../../menus/protyleMenus/refMenu/protyle.refMenu";
import {fileAnnotationRefMenu} from "../../menus/protyleMenus/refMenu/protyle.fileAnnotationRefMenu";
import {tagMenu} from "../../menus/protyleMenus/refMenu/protyle.tagMenu";
import {linkMenu} from "../../menus/protyleMenus/linkMenu/protyle.linkMenu";
import {inlineMathMenu} from "../../menus/protyleMenus/editorMenu/protyle.inlineMathMenu";
import {imgMenu} from "../../menus/protyleMenus/imageMenu/protyle.imgMenu";
import {contentMenu} from "../../menus/protyleMenus/contentMenu/protyle.contentMenu";
import {avContextmenu} from "../render/av/action/contextmenu";
import {showColMenu} from "../render/av/col/menu/menu.factory";
import {openViewMenu} from "../render/av/openMenuPanel";
import {getTypeByCellElement} from "../render/av/cell/position";
import {editAssetItem} from "../render/av/asset";
import {openGalleryItemMenu} from "../render/av/gallery/util";
import {getSiyuanGlobalMenus} from "../../util/siyuanEnvironments/getMenu.environment";

export function handleContextmenu(
    protyle: IProtyle,
    event: MouseEvent & { detail: any },
    beforeContextmenuRange: Range | undefined,
) {
    if (event.shiftKey || protyle.toolbar.isMultiSelectMode()) {
        return;
    }
    event.stopPropagation();
    event.preventDefault();
    const x = event.clientX || event.detail.x;
    const y = event.clientY || event.detail.y;
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements.length > 1) {
        // 多选块
        hideElements(["util"], protyle);
        protyle.gutter.renderMenu(protyle, selectElements[0]);
        window.siyuan.menus.menu.popup({ x, y });
        return;
    }
    const target = event.detail.target || event.target as HTMLElement;
    const embedElement = isInEmbedBlock(target);
    if (embedElement) {
        if (getSelection().rangeCount === 0) {
            focusSideBlock(embedElement);
        }
        protyle.gutter.renderMenu(protyle, embedElement);
        if (isMobile()) {
            window.siyuan.menus.menu.fullscreen();
        } else {
            window.siyuan.menus.menu.popup({ x, y });
        }
        return false;
    }

    const nodeElement = hasClosestBlock(target);
    if (!nodeElement) {
        return false;
    }
    const avCellElement = hasClosestByClassName(target, "av__cell");
    if (avCellElement) {
        if (avCellElement.classList.contains("av__cell--header")) {
            if (!protyle.disabled) {
                showColMenu(protyle, nodeElement, avCellElement);
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        if (getTypeByCellElement(avCellElement) === "mAsset") {
            const assetImgElement = hasClosestByClassName(target, "av__cellassetimg") || hasClosestByClassName(target, "av__celltext--url");
            if (assetImgElement) {
                let index = 0;
                Array.from(avCellElement.children).find((item, i) => {
                    if (item === assetImgElement) {
                        index = i;
                        return true;
                    }
                });
                const isImage = assetImgElement.tagName === "IMG";
                editAssetItem({
                    protyle,
                    cellElements: [avCellElement],
                    blockElement: hasClosestBlock(assetImgElement) ?? nodeElement,
                    content: (isImage ? assetImgElement.getAttribute("src") : assetImgElement.getAttribute("data-url")) ?? "",
                    type: isImage ? "image" : "file",
                    name: isImage ? "" : assetImgElement.getAttribute("data-name") ?? "",
                    index,
                    rect: assetImgElement.getBoundingClientRect()
                });
                event.stopPropagation();
                event.preventDefault();
                return;
            }
        }
    }
    const avGalleryItemElement = hasClosestByClassName(target, "av__gallery-item");
    if (avGalleryItemElement) {
        openGalleryItemMenu({
            target: avGalleryItemElement.querySelector(".protyle-icon--last"),
            protyle,
            position: {
                x: event.clientX,
                y: event.clientY
            }
        });
        event.stopPropagation();
        event.preventDefault();
        return false;
    }
    // 在 span 前面，防止单元格哪 block-ref 被修改
    const avRowElement = hasClosestByClassName(target, "av__row");
    if (avRowElement && avContextmenu(protyle, avRowElement, {
        x: event.clientX,
        y: avRowElement.getBoundingClientRect().bottom,
        h: avRowElement.clientHeight
    })) {
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    const avTabHeaderElement = hasClosestByClassName(target, "item");
    if (nodeElement.classList.contains("av") && avTabHeaderElement) {
        if (avTabHeaderElement.classList.contains("item--focus")) {
            openViewMenu({ protyle, blockElement: nodeElement, element: avTabHeaderElement });
        } else {
            submitAVViewTransaction(protyle, [{
                action: "setAttrViewBlockView",
                blockID: nodeElement.getAttribute("data-node-id"),
                id: avTabHeaderElement.dataset.id,
                avID: nodeElement.getAttribute("data-av-id"),
            }], [{
                action: "setAttrViewBlockView",
                blockID: nodeElement.getAttribute("data-node-id"),
                id: avTabHeaderElement.parentElement.querySelector(".item--focus").getAttribute("data-id"),
                avID: nodeElement.getAttribute("data-av-id"),
            }]);
            window.siyuan.menus.menu.remove();
            openViewMenu({
                protyle,
                blockElement: nodeElement,
                element: avTabHeaderElement
            });
        }
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    protyle.toolbar.range = getEditorRange(protyle.element);

    if (target.tagName === "SPAN" && !isNotEditBlock(nodeElement)) { // https://ld246.com/article/1665141518103
        let types = target.getAttribute("data-type")?.split(" ") || [];
        if (types.length === 0) {
            // https://github.com/siyuan-note/siyuan/issues/8960
            types = (target.dataset.type || "").split(" ");
        }
        if (types.length > 0) {
            removeSearchMark(target);
        }
        if (types.includes("block-ref")) {
            refMenu(protyle, target);
            // 阻止 popover
            target.setAttribute("prevent-popover", "true");
            setTimeout(() => {
                target.removeAttribute("prevent-popover");
            }, 620);
            return false;
        } else if (types.includes("file-annotation-ref") && !protyle.disabled) {
            fileAnnotationRefMenu(protyle, target, getSiyuanGlobalMenus().menu);
            return false;
        } else if (types.includes("tag") && !protyle.disabled) {
            tagMenu(protyle, target);
            return false;
        } else if (types.includes("inline-memo")) {
            protyle.toolbar.showRender(protyle, target);
            return false;
        } else if (types.includes("a")) {
            linkMenu(protyle, target);
            if (window.siyuan.config.editor.floatWindowMode === 0 &&
                target.getAttribute("data-href")?.startsWith("siyuan://blocks")) {
                // 阻止 popover
                target.setAttribute("prevent-popover", "true");
                setTimeout(() => {
                    target.removeAttribute("prevent-popover");
                }, 620);
            }
            return false;
        }
    }
    const inlineMathElement = hasClosestByAttribute(target, "data-type", "inline-math");
    if (inlineMathElement) {
        inlineMathMenu(protyle, inlineMathElement);
        return false;
    }
    if (target.tagName === "IMG" && hasClosestByClassName(target, "img")) {
        imgMenu(protyle, protyle.toolbar.range, target.parentElement.parentElement, {
            clientX: x + 4,
            clientY: y
        });
        return false;
    }
    if (!isNotEditBlock(nodeElement) && !nodeElement.classList.contains("protyle-wysiwyg--select") &&
        !hasClosestByClassName(target, "protyle-action") && // https://github.com/siyuan-note/siyuan/issues/8983
        (isMobile() || event.detail.target || (beforeContextmenuRange && nodeElement.contains(beforeContextmenuRange.startContainer)))
    ) {
        if ((!isMobile() || protyle.toolbar?.element.classList.contains("fn__none")) && !nodeElement.classList.contains("av")) {
            contentMenu(protyle, nodeElement);
            window.siyuan.menus.menu.popup({ x, y: y + 13, h: 26 });
            protyle.toolbar?.element.classList.add("fn__none");
            if (nodeElement.classList.contains("table")) {
                nodeElement.querySelector(".table__select").removeAttribute("style");
            }
        }
    } else if (protyle.toolbar.range.toString() === "") {
        hideElements(["util"], protyle);
        if (protyle.gutter) {
            protyle.gutter.renderMenu(protyle, nodeElement);
        }
        if (isMobile()) {
            window.siyuan.menus.menu.fullscreen();
        } else {
            window.siyuan.menus.menu.popup({ x, y });
        }
        protyle.toolbar?.element.classList.add("fn__none");
    }
}
