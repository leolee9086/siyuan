import * as dayjs from "dayjs";
import { img3115 } from "../boot/compatibleVersion";
import { focusBlock } from "../protyle/util/selection";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "./Menu.Item";
import { genImageHeightMenu } from "./protyle.genImageHeightMenu";
import { genImageWidthMenu } from "./protyle.genImageWidthMenu";

/**
 * Generate the Width menu item.
 * @param protyle The protyle instance
 * @param nodeElement The node element
 * @param imgElement The image element
 * @param assetElement The asset element container
 * @returns MenuItem
 */
export const genWidthItem = (protyle: IProtyle, nodeElement: Element, imgElement: HTMLImageElement, assetElement: HTMLElement) => {
    const id = nodeElement.getAttribute("data-node-id") || "";
    const html = nodeElement.outerHTML;
    // Shared state object to allow communication between input and slider
    const context = { rangeElement: null as HTMLInputElement | null };

    return new MenuItem({
        id: "width",
        label: siyuanI18n.width,
        submenu: [
            genWidthInputItem(context, assetElement, imgElement, nodeElement, protyle, id, html),
            genImageWidthMenu("25%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageWidthMenu("33%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageWidthMenu("50%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageWidthMenu("67%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageWidthMenu("75%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageWidthMenu("100%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            { id: "separator_1", type: "separator" as const },
            genWidthSliderItem(context, assetElement, imgElement, nodeElement, protyle, id, html),
            { id: "separator_2", type: "separator" as const },
            genImageWidthMenu(siyuanI18n.default, imgElement, protyle, id, nodeElement as HTMLElement, html),
        ]
    });
};

/**
 * Generate the width input menu item.
 * @param context The shared context object
 * @param assetElement The asset element container
 * @param imgElement The image element
 * @param nodeElement The node element
 * @param protyle The protyle instance
 * @param id The node ID
 * @param html The node HTML
 * @returns Menu item configuration
 */
const genWidthInputItem = (context: { rangeElement: HTMLInputElement | null }, assetElement: HTMLElement, imgElement: HTMLImageElement, nodeElement: Element, protyle: IProtyle, id: string, html: string) => {
    const widthVal = imgElement.parentElement?.style.width.endsWith("px") ? parseInt(imgElement.parentElement.style.width) : "";
    return {
        id: "widthInput",
        iconHTML: "",
        type: "readonly" as const,
        label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" style="margin: 4px 8px 4px 0" value="${widthVal}" type="number" placeholder="${siyuanI18n.width}"><span class="fn__flex-center">px</span></div>`,
        bind(element: HTMLElement) {
            const inputElement = element.querySelector("input");
            if (!inputElement) {
                return;
            }
            // @内联回调
            inputElement.addEventListener("input", () => {
                if (context.rangeElement) {
                    context.rangeElement.value = "0";
                    if (context.rangeElement.parentElement) {
                        context.rangeElement.parentElement.setAttribute("aria-label", inputElement.value ? (inputElement.value + "px") : siyuanI18n.default);
                    }
                }
                img3115(assetElement);
                if (imgElement.parentElement) {
                    imgElement.parentElement.style.width = inputElement.value ? (inputElement.value + "px") : "";
                }
                imgElement.style.height = "";
            });
            // @内联回调
            inputElement.addEventListener("blur", () => {
                const parent = imgElement.parentElement;
                if (parent && inputElement.value === parent.style.width.replace("px", "")) {
                    return;
                }
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                getSiyuanGlobalMenusMenu().remove();
                focusBlock(nodeElement);
            });
        }
    };
};

/**
 * Generate the width slider menu item.
 * @param context The shared context object
 * @param assetElement The asset element container
 * @param imgElement The image element
 * @param nodeElement The node element
 * @param protyle The protyle instance
 * @param id The node ID
 * @param html The node HTML
 * @returns Menu item configuration
 */
const genWidthSliderItem = (context: { rangeElement: HTMLInputElement | null }, assetElement: HTMLElement, imgElement: HTMLImageElement, nodeElement: Element, protyle: IProtyle, id: string, html: string) => {
    const parentWidth = imgElement.parentElement?.style.width || "";
    const isPercentOrVw = parentWidth.indexOf("%") > -1 || parentWidth.endsWith("vw");
    const sliderValue = isPercentOrVw ? parseInt(parentWidth.replace("calc(", "")) : 0;
    const label = parentWidth ? parentWidth.replace("vw", "%").replace("calc(", "").replace(" - 8px)", "") : siyuanI18n.default;

    return {
        id: "widthDrag",
        iconHTML: "",
        type: "readonly" as const,
        label: `<div style="margin: 4px 0;" aria-label="${label}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${sliderValue}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
        bind(element: HTMLElement) {
            const rangeElement = element.querySelector("input");
            if (!rangeElement) {
                return;
            }
            context.rangeElement = rangeElement;
            // @内联回调
            rangeElement.addEventListener("input", () => {
                img3115(assetElement);
                if (imgElement.parentElement) {
                    imgElement.parentElement.style.width = `calc(${rangeElement.value}% - 8px)`;
                }
                imgElement.style.height = "";
                if (rangeElement.parentElement) {
                    rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}%`);
                }
            });
            // @内联回调
            rangeElement.addEventListener("change", () => {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                getSiyuanGlobalMenusMenu().remove();
                focusBlock(nodeElement);
            });
        }
    };
};

/**
 * Generate the Height menu item.
 * @param protyle The protyle instance
 * @param nodeElement The node element
 * @param imgElement The image element
 * @param assetElement The asset element container
 * @returns MenuItem
 */
export const genHeightItem = (protyle: IProtyle, nodeElement: Element, imgElement: HTMLImageElement, assetElement: HTMLElement) => {
    const id = nodeElement.getAttribute("data-node-id") || "";
    const html = nodeElement.outerHTML;
    const context = { rangeHeightElement: null as HTMLInputElement | null };

    return new MenuItem({
        id: "height",
        label: siyuanI18n.height,
        submenu: [
            genHeightInputItem(context, assetElement, imgElement, nodeElement, protyle, id, html),
            genImageHeightMenu("25%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageHeightMenu("33%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageHeightMenu("50%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageHeightMenu("67%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageHeightMenu("75%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            genImageHeightMenu("100%", imgElement, protyle, id, nodeElement as HTMLElement, html),
            { id: "separator_1", type: "separator" as const },
            genHeightSliderItem(context, assetElement, imgElement, nodeElement, protyle, id, html),
            { id: "separator_2", type: "separator" as const },
            genImageHeightMenu(siyuanI18n.default, imgElement, protyle, id, nodeElement as HTMLElement, html),
        ]
    });
};

/**
 * Generate the height input menu item.
 * @param context The shared context object
 * @param assetElement The asset element container
 * @param imgElement The image element
 * @param nodeElement The node element
 * @param protyle The protyle instance
 * @param id The node ID
 * @param html The node HTML
 * @returns Menu item configuration
 */
const genHeightInputItem = (context: { rangeHeightElement: HTMLInputElement | null }, assetElement: HTMLElement, imgElement: HTMLImageElement, nodeElement: Element, protyle: IProtyle, id: string, html: string) => {
    const heightVal = imgElement.style.height.endsWith("px") ? parseInt(imgElement.style.height) : "";
    return {
        id: "heightInput",
        iconHTML: "",
        type: "readonly" as const,
        label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${heightVal}" type="number" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.height}"><span class="fn__flex-center">px</span></div>`,
        bind(element: HTMLElement) {
            const inputElement = element.querySelector("input");
            if (!inputElement) {
                return;
            }
            // @内联回调
            inputElement.addEventListener("input", () => {
                if (context.rangeHeightElement) {
                    context.rangeHeightElement.value = "0";
                    if (context.rangeHeightElement.parentElement) {
                        context.rangeHeightElement.parentElement.setAttribute("aria-label", inputElement.value ? (inputElement.value + "px") : siyuanI18n.default);
                    }
                }
                imgElement.style.height = inputElement.value ? (inputElement.value + "px") : "";
                img3115(assetElement);
                if (imgElement.parentElement) {
                    imgElement.parentElement.style.width = "";
                }
            });
            // @内联回调
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
    };
};

/**
 * Generate the height slider menu item.
 * @param context The shared context object
 * @param assetElement The asset element container
 * @param imgElement The image element
 * @param nodeElement The node element
 * @param protyle The protyle instance
 * @param id The node ID
 * @param html The node HTML
 * @returns Menu item configuration
 */
const genHeightSliderItem = (context: { rangeHeightElement: HTMLInputElement | null }, assetElement: HTMLElement, imgElement: HTMLImageElement, nodeElement: Element, protyle: IProtyle, id: string, html: string) => {
    const label = imgElement.style.height ? imgElement.style.height.replace("vh", "%") : siyuanI18n.default;
    const sliderValue = imgElement.style.height.endsWith("vh") ? parseInt(imgElement.style.height) : 0;

    return {
        id: "heightDrag",
        iconHTML: "",
        type: "readonly" as const,
        label: `<div style="margin: 4px 0;" aria-label="${label}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${sliderValue}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
        bind(element: HTMLElement) {
            const rangeHeightElement = element.querySelector("input");
            if (!rangeHeightElement) {
                return;
            }
            context.rangeHeightElement = rangeHeightElement;
            // @内联回调
            rangeHeightElement.addEventListener("input", () => {
                img3115(assetElement);
                if (imgElement.parentElement) {
                    imgElement.parentElement.style.width = "";
                }
                imgElement.style.height = rangeHeightElement.value + "vh";
                if (rangeHeightElement.parentElement) {
                    rangeHeightElement.parentElement.setAttribute("aria-label", `${rangeHeightElement.value}%`);
                }
            });
            // @内联回调
            rangeHeightElement.addEventListener("change", () => {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                getSiyuanGlobalMenusMenu().remove();
                focusBlock(nodeElement);
            });
        }
    };
};
