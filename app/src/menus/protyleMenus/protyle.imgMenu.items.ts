import { fetchPost } from "../../ai/imports";
import { showMessage } from "../../dialog/message";
import { mathRender } from "../../protyle/render/mathRender";
import { writeText } from "../../protyle/util/compatibility";
import { isMobile } from "../../util/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "../Menu.Item";
import { bindRatingEvents, genRatingHTML } from "./protyle.imgMenu.rating";

/**
 * Generate the settings menu item (URL, Title, Tooltip, Rating).
 * @param assetElement The asset element container
 * @param nodeElement The node element (block)
 * @param imgElement The image element
 * @returns MenuItem
 */
export const genImageSettingsItem = (assetElement: HTMLElement, nodeElement: Element, imgElement: HTMLImageElement) => {
    const src = imgElement.getAttribute("src") || "";
    return new MenuItem({
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
</div><textarea style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" rows="1" class="b3-text-field"></textarea>${genRatingHTML(src)}`,
        /** @简洁函数 */
        bind(element) {
            bindImageSettingsEvents(element, assetElement, imgElement, src);
        }
    });
};

/**
 * Bind events for image settings item.
 * @param element The menu item element
 * @param assetElement The asset container element
 * @param imgElement The image element
 * @param src The source of the image
 */

const bindImageSettingsEvents = (element: HTMLElement, assetElement: HTMLElement, imgElement: HTMLImageElement, src: string) => {
    element.style.maxWidth = "none";
    const textElements = element.querySelectorAll("textarea");
    const urlInput = textElements[0];
    const titleInput = textElements[1];
    const tooltipInput = textElements[2];
    if (!(urlInput instanceof HTMLTextAreaElement) || !(titleInput instanceof HTMLTextAreaElement) || !(tooltipInput instanceof HTMLTextAreaElement)) {
        return;
    }

    bindURLInput(urlInput, assetElement, imgElement);
    bindTitleInput(titleInput, assetElement, imgElement);
    tooltipInput.value = imgElement.getAttribute("alt") || "";
    bindCopyEvents(element);

    bindRatingEvents(element, src);
};

/**
 * Bind events for URL input.
 * @param urlInput The URL input element
 * @param assetElement The asset element container
 * @param imgElement The image element
 */
const bindURLInput = (urlInput: HTMLTextAreaElement, assetElement: HTMLElement, imgElement: HTMLImageElement) => {
    // @内联回调
    urlInput.addEventListener("input", (event: Event) => {
        const target = event.target;
        if (target instanceof HTMLTextAreaElement) {
            const value = target.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
            imgElement.setAttribute("src", value);
            imgElement.setAttribute("data-src", value);
            if (value.startsWith("assets/")) {
                const imgNetElement = assetElement.querySelector(".img__net");
                if (imgNetElement) {
                    imgNetElement.remove();
                }
            } else if (window.siyuan?.config?.editor?.displayNetImgMark) {
                assetElement.querySelector(".protyle-action__drag")?.insertAdjacentHTML("afterend", '<span class="img__net"><svg><use xlink:href="#iconLanguage"></use></svg></span>');
            }
        }
    });
};

/**
 * Bind events for Title input.
 * @param titleInput The Title input element
 * @param assetElement The asset element container
 * @param imgElement The image element
 */
const bindTitleInput = (titleInput: HTMLTextAreaElement, assetElement: HTMLElement, imgElement: HTMLImageElement) => {
    const titleElement = assetElement.querySelector(".protyle-action__title span");
    titleInput.value = (titleElement instanceof HTMLElement) ? titleElement.innerText : "";
    // @内联回调
    titleInput.addEventListener("input", (event: Event) => {
        const target = event.target;
        if (target instanceof HTMLTextAreaElement && titleElement instanceof HTMLElement) {
            const value = target.value;
            imgElement.setAttribute("title", value);
            titleElement.innerText = value;
            mathRender(titleElement);
        }
    });
};

/**
 * Bind copy events for the menu item.
 * @param element The menu item element
 */
const bindCopyEvents = (element: HTMLElement) => {
    // @内联回调
    element.addEventListener("click", (event: MouseEvent) => {
        let target = event.target;
        while (target instanceof HTMLElement) {
            if (target.dataset?.action === "copy") {
                const textarea = target.parentElement?.nextElementSibling;
                if (textarea instanceof HTMLTextAreaElement) {
                    writeText(textarea.value);
                    showMessage(siyuanI18n.copied);
                }
                break;
            }
            target = target.parentElement;
        }
    });
};

/**
 * Generate the OCR menu item.
 * @param imgElement The image element
 * @returns MenuItem
 */
export const genOCRItem = (imgElement: HTMLImageElement) => {
    return new MenuItem({
        id: "ocr",
        label: "OCR",
        submenu: [{
            id: "ocrResult",
            iconHTML: "",
            type: "readonly",
            label: `<textarea spellcheck="false" data-type="ocr" style="margin: 4px 0" rows="1" class="b3-text-field fn__block" placeholder="${siyuanI18n.ocrResult}"></textarea>`,
            /** @简洁函数 */
            bind(element) {
                element.style.maxWidth = "none";
                fetchPost("/api/asset/getImageOCRText", {
                    path: imgElement.getAttribute("src")
                }, (response) => {
                    const textarea = element.querySelector("textarea");
                    if (textarea && response && response.data) {
                        textarea.value = response.data.text;
                        textarea.dataset.ocrText = response.data.text;
                    }
                });
            }
        }, {
            type: "separator"
        }, {
            id: "reOCR",
            iconHTML: "",
            label: siyuanI18n.reOCR,
            /** @简洁函数 */
            click() {
                fetchPost("/api/asset/ocr", {
                    path: imgElement.getAttribute("src"),
                    force: true
                });
            }
        }],
    });
};


