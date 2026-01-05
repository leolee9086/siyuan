import * as dayjs from "dayjs";
import { fetchPost } from "../ai/imports";
import { img3115 } from "../boot/compatibleVersion";
import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { renameAsset } from "../editor/rename";
import { emitOpenMenu } from "../plugin/EventBus";
import { mathRender } from "../protyle/render/mathRender";
import { hideElements } from "../protyle/ui/hideElements";
import { writeText } from "../protyle/util/compatibility";
import { hasClosestBlock, hasTopClosestByClassName } from "../protyle/util/hasClosest";
import { focusByWbr, focusBlock } from "../protyle/util/selection";
import { alignImgCenter, alignImgLeft } from "../protyle/wysiwyg/commonHotkey";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { isMobile } from "../util/functions";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { openMenu } from "./commonMenuItem.openMenu";
import { MenuItem } from "./Menu.Item";
import { genImageWidthMenu, genImageHeightMenu } from "./protyle";
import { copyPNGByLink, exportAsset } from "./util";


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
    const id = nodeElement.getAttribute("data-node-id");
    const imgElement = assetElement.querySelector("img");
    const titleElement = assetElement.querySelector(".protyle-action__title span") as HTMLElement;
    const html = nodeElement.outerHTML;
    let src = imgElement.getAttribute("src");
    if (!src) {
        src = "";
    }
    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "imageUrlAndTitleAndTooltipText",
            iconHTML: "",
            type: "readonly",
            label: `<div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.imageURL}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea spellcheck="false" style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" rows="1" class="b3-text-field">${src}</textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.title}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" rows="1" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.tooltipText}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" rows="1" class="b3-text-field"></textarea>`,
            bind(element) {
                element.style.maxWidth = "none";
                const textElements = element.querySelectorAll("textarea");
                textElements[0].addEventListener("input", (event: InputEvent) => {
                    const value = (event.target as HTMLInputElement).value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
                    imgElement.setAttribute("src", value);
                    imgElement.setAttribute("data-src", value);
                    if (value.startsWith("assets/")) {
                        const imgNetElement = assetElement.querySelector(".img__net");
                        if (imgNetElement) {
                            imgNetElement.remove();
                        }
                    } else if (window.siyuan.config.editor.displayNetImgMark) {
                        assetElement.querySelector(".protyle-action__drag").insertAdjacentHTML("afterend", '<span class="img__net"><svg><use xlink:href="#iconLanguage"></use></svg></span>');
                    }
                });
                textElements[1].value = titleElement.innerText;
                textElements[1].addEventListener("input", (event) => {
                    const value = (event.target as HTMLInputElement).value;
                    imgElement.setAttribute("title", value);
                    titleElement.innerText = value;
                    mathRender(titleElement);
                });
                textElements[2].value = imgElement.getAttribute("alt") || "";
                element.addEventListener("click", (event) => {
                    let target = event.target as HTMLElement;
                    while (target) {
                        if (target.dataset.action === "copy") {
                            writeText((target.parentElement.nextElementSibling as HTMLTextAreaElement).value);
                            showMessage(siyuanI18n.copied);
                            break;
                        }
                        target = target.parentElement;
                    }
                });
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        accelerator: "⌘C",
        icon: "iconCopy",
        click() {
            let content = protyle.lute.BlockDOM2StdMd(assetElement.outerHTML);
            // The file name encoding is abnormal after copying the image and pasting it https://github.com/siyuan-note/siyuan/issues/11246
            content = content.replace(/%20/g, " ");
            writeText(content);
        }
    }).element);
    if (protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "copyImageURL",
            label: siyuanI18n.copy + " " + siyuanI18n.imageURL,
            icon: "iconLink",
            click() {
                writeText(imgElement.getAttribute("src"));
            }
        }).element);
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copyAsPNG",
        label: siyuanI18n.copyAsPNG,
        accelerator: window.siyuan.config.keymap.editor.general.copyBlockRef.custom,
        icon: "iconImage",
        click() {
            copyPNGByLink(imgElement.getAttribute("src"));
        }
    }).element);
    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "cut",
            icon: "iconCut",
            accelerator: "⌘X",
            label: siyuanI18n.cut,
            click() {
                let content = protyle.lute.BlockDOM2StdMd(assetElement.outerHTML);
                // The file name encoding is abnormal after copying the image and pasting it https://github.com/siyuan-note/siyuan/issues/11246
                content = content.replace(/%20/g, " ");
                writeText(content);
                (assetElement as HTMLElement).outerHTML = "<wbr>";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                focusByWbr(protyle.wysiwyg.element, range);
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "delete",
            icon: "iconTrashcan",
            accelerator: "⌫",
            label: siyuanI18n.delete,
            click: function () {
                (assetElement as HTMLElement).outerHTML = "<wbr>";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                focusByWbr(protyle.wysiwyg.element, range);
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
        const imagePath = imgElement.getAttribute("data-src");
        if (imagePath.startsWith("assets/")) {
            getSiyuanGlobalMenusMenu().append(new MenuItem({
                id: "rename",
                label: siyuanI18n.rename,
                icon: "iconEdit",
                click() {
                    renameAsset(imagePath);
                }
            }).element);
        }
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "ocr",
            label: "OCR",
            submenu: [{
                id: "ocrResult",
                iconHTML: "",
                type: "readonly",
                label: `<textarea spellcheck="false" data-type="ocr" style="margin: 4px 0" rows="1" class="b3-text-field fn__block" placeholder="${siyuanI18n.ocrResult}"></textarea>`,
                bind(element) {
                    element.style.maxWidth = "none";
                    fetchPost("/api/asset/getImageOCRText", {
                        path: imgElement.getAttribute("src")
                    }, (response) => {
                        const textarea = element.querySelector("textarea");
                        textarea.value = response.data.text;
                        textarea.dataset.ocrText = response.data.text;
                    });
                }
            }, {
                type: "separator"
            }, {
                id: "reOCR",
                iconHTML: "",
                label: siyuanI18n.reOCR,
                click() {
                    fetchPost("/api/asset/ocr", {
                        path: imgElement.getAttribute("src"),
                        force: true
                    });
                }
            }],
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "alignCenter",
            icon: "iconAlignCenter",
            label: siyuanI18n.alignCenter,
            accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
            click() {
                alignImgCenter(protyle, nodeElement, [assetElement], id, html);
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "alignLeft",
            icon: "iconAlignLeft",
            label: siyuanI18n.alignLeft,
            accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
            click() {
                alignImgLeft(protyle, nodeElement, [assetElement], id, html);
            }
        }).element);
        let rangeElement: HTMLInputElement;
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "width",
            label: siyuanI18n.width,
            submenu: [{
                id: "widthInput",
                iconHTML: "",
                type: "readonly",
                label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" style="margin: 4px 8px 4px 0" value="${imgElement.parentElement.style.width.endsWith("px") ? parseInt(imgElement.parentElement.style.width) : ""}" type="number" placeholder="${siyuanI18n.width}"><span class="fn__flex-center">px</span></div>`,
                bind(element) {
                    const inputElement = element.querySelector("input");
                    inputElement.addEventListener("input", () => {
                        rangeElement.value = "0";
                        rangeElement.parentElement.setAttribute("aria-label", inputElement.value ? (inputElement.value + "px") : siyuanI18n.default);

                        img3115(assetElement);
                        imgElement.parentElement.style.width = inputElement.value ? (inputElement.value + "px") : "";
                        imgElement.style.height = "";
                    });
                    inputElement.addEventListener("blur", () => {
                        if (inputElement.value === imgElement.parentElement.style.width.replace("px", "")) {
                            return;
                        }
                        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        updateTransaction(protyle, id, nodeElement.outerHTML, html);
                        getSiyuanGlobalMenusMenu().remove();
                        focusBlock(nodeElement);
                    });
                }
            },
            genImageWidthMenu("25%", imgElement, protyle, id, nodeElement, html),
            genImageWidthMenu("33%", imgElement, protyle, id, nodeElement, html),
            genImageWidthMenu("50%", imgElement, protyle, id, nodeElement, html),
            genImageWidthMenu("67%", imgElement, protyle, id, nodeElement, html),
            genImageWidthMenu("75%", imgElement, protyle, id, nodeElement, html),
            genImageWidthMenu("100%", imgElement, protyle, id, nodeElement, html), {
                id: "separator_1",
                type: "separator",
            }, {
                id: "widthDrag",
                iconHTML: "",
                type: "readonly",
                label: `<div style="margin: 4px 0;" aria-label="${imgElement.parentElement.style.width ? imgElement.parentElement.style.width.replace("vw", "%").replace("calc(", "").replace(" - 8px)", "") : siyuanI18n.default}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${(imgElement.parentElement.style.width.indexOf("%") > -1 || imgElement.parentElement.style.width.endsWith("vw")) ? parseInt(imgElement.parentElement.style.width.replace("calc(", "")) : 0}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
                bind(element) {
                    rangeElement = element.querySelector("input");
                    rangeElement.addEventListener("input", () => {
                        img3115(assetElement);
                        imgElement.parentElement.style.width = `calc(${rangeElement.value}% - 8px)`;
                        imgElement.style.height = "";
                        rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}%`);
                    });
                    rangeElement.addEventListener("change", () => {
                        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        updateTransaction(protyle, id, nodeElement.outerHTML, html);
                        getSiyuanGlobalMenusMenu().remove();
                        focusBlock(nodeElement);
                    });
                }
            }, {
                id: "separator_2",
                type: "separator",
            },
            genImageWidthMenu(siyuanI18n.default, imgElement, protyle, id, nodeElement, html),
            ]
        }).element);
        let rangeHeightElement: HTMLInputElement;
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "height",
            label: siyuanI18n.height,
            submenu: [{
                id: "heightInput",
                iconHTML: "",
                type: "readonly",
                label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${imgElement.style.height.endsWith("px") ? parseInt(imgElement.style.height) : ""}" type="number" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.height}"><span class="fn__flex-center">px</span></div>`,
                bind(element) {
                    const inputElement = element.querySelector("input");
                    inputElement.addEventListener("input", () => {
                        rangeHeightElement.value = "0";
                        rangeHeightElement.parentElement.setAttribute("aria-label", inputElement.value ? (inputElement.value + "px") : siyuanI18n.default);

                        imgElement.style.height = inputElement.value ? (inputElement.value + "px") : "";
                        img3115(assetElement);
                        imgElement.parentElement.style.width = "";
                    });
                    inputElement.addEventListener("blur", () => {
                        if (inputElement.value === imgElement.style.height.replace("px", "")) {
                            return;
                        }
                        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        updateTransaction(protyle, id, nodeElement.outerHTML, html);
                        getSiyuanGlobalMenusMenu().remove();
                        focusBlock(nodeElement);
                    });
                }
            },
            genImageHeightMenu("25%", imgElement, protyle, id, nodeElement, html),
            genImageHeightMenu("33%", imgElement, protyle, id, nodeElement, html),
            genImageHeightMenu("50%", imgElement, protyle, id, nodeElement, html),
            genImageHeightMenu("67%", imgElement, protyle, id, nodeElement, html),
            genImageHeightMenu("75%", imgElement, protyle, id, nodeElement, html),
            genImageHeightMenu("100%", imgElement, protyle, id, nodeElement, html), {
                id: "separator_1",
                type: "separator",
            }, {
                id: "heightDrag",
                iconHTML: "",
                type: "readonly",
                label: `<div style="margin: 4px 0;" aria-label="${imgElement.style.height ? imgElement.style.height.replace("vh", "%") : siyuanI18n.default}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${imgElement.style.height.endsWith("vh") ? parseInt(imgElement.style.height) : 0}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
                bind(element) {
                    rangeHeightElement = element.querySelector("input");
                    rangeHeightElement.addEventListener("input", () => {
                        img3115(assetElement);
                        imgElement.parentElement.style.width = "";
                        imgElement.style.height = rangeHeightElement.value + "vh";
                        rangeHeightElement.parentElement.setAttribute("aria-label", `${rangeHeightElement.value}%`);
                    });
                    rangeHeightElement.addEventListener("change", () => {
                        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        updateTransaction(protyle, id, nodeElement.outerHTML, html);
                        getSiyuanGlobalMenusMenu().remove();
                        focusBlock(nodeElement);
                    });
                }
            }, {
                id: "separator_2",
                type: "separator",
            },
            genImageHeightMenu(siyuanI18n.default, imgElement, protyle, id, nodeElement, html),
            ]
        }).element);
    }
    const imgSrc = imgElement.getAttribute("src");
    if (imgSrc) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_3", type: "separator" }).element);
        openMenu(protyle.app, imgSrc, false, false);
    }
    const dataSrc = imgElement.getAttribute("data-src");
    if (dataSrc && dataSrc.startsWith("assets/")) {
        getSiyuanGlobalMenusMenu().append(new MenuItem(exportAsset(dataSrc)).element);
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
        const textElements = getSiyuanGlobalMenusMenu().element.querySelectorAll("textarea");
        if (textElements[0].value) {
            textElements[1].select();
        } else {
            textElements[0].select();
        }
        getSiyuanGlobalMenusMenu().removeCB = () => {
            const ocrElement = getSiyuanGlobalMenusMenu().element.querySelector('[data-type="ocr"]') as HTMLTextAreaElement;
            if (ocrElement && ocrElement.dataset.ocrText !== ocrElement.value) {
                fetchPost("/api/asset/setImageOCRText", {
                    path: imgElement.getAttribute("src"),
                    text: ocrElement.value
                });
            }
            imgElement.setAttribute("alt", textElements[2].value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
        };
    }
};
