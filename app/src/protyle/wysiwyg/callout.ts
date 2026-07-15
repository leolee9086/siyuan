import {hasClosestBlock} from "../util/hasClosest";
import {transaction} from "./transaction";
import {focusByRange} from "../util/selection";
import {Dialog} from "../runtime/dialog.port";
import {Menu} from "../../plugin/Menu";
import {isMobile} from "../../util/platform/functions";
import {Constants} from "../../constants";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {openEmojiPanel, unicode2Emoji} from "../../emoji";

/**
 * 更新 Callout 块的类型和标题
 * @description 打开一个对话框让用户编辑 callout 的图标、类型和标题，支持单块和多块批量更新
 * @param target - callout 标题元素，或一组 callout 块元素
 * @param protyle - Protyle 编辑器实例
 */
export const updateCalloutType = (target: HTMLElement | HTMLElement[], protyle: IProtyle) => {
    const blockElements = normalizeCalloutBlocks(target);
    if (blockElements.length === 0) {
        return;
    }
    const blockCalloutElement = blockElements[0].querySelector(".callout-icon");
    const titleElement = blockElements[0].querySelector(".callout-title") as HTMLElement;
    if (!blockCalloutElement || !titleElement) {
        return;
    }
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : null;
    const currentSubtype = blockElements[0].getAttribute("data-subtype") || "";

    const dialog = new Dialog({
        title: siyuanI18n.callout,
        content: getCalloutDialogHTML(currentSubtype, blockCalloutElement.innerHTML),
        width: isMobile() ? "92vw" : "520px",
        destroyCallback() {
            if (range) {
                focusByRange(range);
            }
        }
    });

    const btnElements = dialog.element.querySelectorAll(".b3-button");
    const textElements: NodeListOf<HTMLInputElement> = dialog.element.querySelectorAll(".b3-text-field");
    const cancelBtn = btnElements[0];
    const confirmBtn = btnElements[1];
    const typeInput = textElements[0];
    const titleInput = textElements[1];
    const dialogCalloutIconElement = dialog.element.querySelector(".callout-icon");

    if (!cancelBtn || !confirmBtn || !typeInput || !titleInput || !protyle.lute || !dialogCalloutIconElement) {
        return;
    }

    cancelBtn.addEventListener("click", () => {
        dialog.destroy();
    });

    confirmBtn.addEventListener("click", () => {
        confirmCalloutUpdate(protyle, blockElements, typeInput, titleInput, dialogCalloutIconElement);
        dialog.destroy();
    });

    dialog.bindInput(titleInput, () => {
        confirmBtn.dispatchEvent(new CustomEvent("click"));
    });

    bindTypeInputKeydown(typeInput, dialog);

    typeInput.focus();
    typeInput.select();
    titleInput.value = protyle.lute.BlockDOM2StdMd(titleElement.innerHTML);

    dialogCalloutIconElement.addEventListener("click", () => {
        openEmojiPanelForCallout(dialogCalloutIconElement, typeInput);
    });

    const iconDownElement = dialog.element.querySelector(".b3-form__icona-icon");
    if (iconDownElement) {
        iconDownElement.addEventListener("click", (event) => {
            showCalloutTypeMenu(event, typeInput, titleInput, dialogCalloutIconElement);
        });
    }
};

const normalizeCalloutBlocks = (target: HTMLElement | HTMLElement[]): HTMLElement[] => {
    if (Array.isArray(target)) {
        return target.filter((item): item is HTMLElement => !!item);
    }
    const blockElement = hasClosestBlock(target);
    return blockElement ? [blockElement as HTMLElement] : [];
};

/**
 * 生成 Callout 对话框的 HTML 内容
 */
const getCalloutDialogHTML = (subtype: string, iconHTML: string) => {
    return `<div class="b3-dialog__content">
    <label class="fn__flex">
        <div class="fn__flex-center">
            ${siyuanI18n.icon}
        </div>
        <span class="fn__space"></span>
        <div class="protyle-wysiwyg" style="padding: 0" data-readonly="false">
            <span class="callout-icon">${iconHTML}</span>
        </div>
    </label>
    <div class="fn__hr"></div>
    <label class="fn__flex">
        <div class="fn__flex-center">
            ${siyuanI18n.type}
        </div>
        <span class="fn__space"></span>
        <div class="b3-form__icona fn__flex-1" style="overflow: visible">
            <input value="${subtype}" type="text" class="b3-text-field fn__block b3-form__icona-input">
            <svg class="b3-form__icona-icon"><use xlink:href="#iconDown"></use></svg>
        </div>
    </label>
    <div class="fn__hr"></div>
    <label class="fn__flex">
        <div class="fn__flex-center">
            ${siyuanI18n.title}
        </div>
        <span class="fn__space"></span>
        <input class="b3-text-field fn__flex-1" type="text">
    </label>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`;
};

/**
 * 格式化 Callout 标题
 * @description 将 Markdown 标题转换为 HTML
 */
const formatCalloutTitle = (protyle: IProtyle, title: string) => {
    if (!protyle.lute) {
        return title;
    }
    const template = document.createElement("template");
    template.innerHTML = protyle.lute.Md2BlockDOM(title);
    const firstChild = template.content.firstElementChild;
    if (firstChild?.firstElementChild) {
        return firstChild.firstElementChild.innerHTML;
    }
    return title;
};

/**
 * 确认 Callout 更新
 * @description 应用用户的修改到一个或多个 callout 块
 */
const confirmCalloutUpdate = (
    protyle: IProtyle,
    blockElements: HTMLElement[],
    typeInput: HTMLInputElement,
    titleInput: HTMLInputElement,
    dialogCalloutIconElement: Element
) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const subtype = typeInput.value.trim();

    blockElements.forEach((blockElement) => {
        const id = blockElement.getAttribute("data-node-id");
        const titleElement = blockElement.querySelector(".callout-title") as HTMLElement;
        const blockCalloutElement = blockElement.querySelector(".callout-icon");
        if (!id || !titleElement || !blockCalloutElement) {
            return;
        }
        const oldHTML = blockElement.outerHTML;
        blockElement.setAttribute("data-subtype", subtype);

        let title = titleInput.value.trim();
        if (title) {
            title = formatCalloutTitle(protyle, title);
        }

        titleElement.innerHTML = title ||
            (subtype.substring(0, 1).toUpperCase() + subtype.substring(1).toLowerCase());
        blockCalloutElement.innerHTML = dialogCalloutIconElement.innerHTML;
        blockElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");

        doOperations.push({
            id,
            data: blockElement.outerHTML,
            action: "update"
        });
        undoOperations.push({
            id,
            data: oldHTML,
            action: "update"
        });
    });

    if (doOperations.length > 0) {
        transaction(protyle, doOperations, undoOperations);
    }
};

/**
 * 绑定类型输入框的键盘事件
 * @description 方向键触发下拉菜单
 */
const bindTypeInputKeydown = (typeInput: HTMLInputElement, dialog: Dialog) => {
    typeInput.addEventListener("keydown", (event: KeyboardEvent) => {
        handleTypeInputKeydown(event, typeInput, dialog);
    });
};

/**
 * 处理类型输入框的键盘事件
 */
const handleTypeInputKeydown = (event: KeyboardEvent, typeInput: HTMLInputElement, dialog: Dialog) => {
    if (event.isComposing) {
        return;
    }
    if (event.key.startsWith("Arrow")) {
        const iconElement = dialog.element.querySelector(".b3-form__icona-icon");
        iconElement?.dispatchEvent(new CustomEvent("click"));
        typeInput.blur();
        event.preventDefault();
        event.stopPropagation();
    }
};

/**
 * 打开 Callout 图标的 Emoji 选择面板
 */
const openEmojiPanelForCallout = (dialogCalloutIconElement: Element, typeInput: HTMLInputElement) => {
    const emojiRect = dialogCalloutIconElement.getBoundingClientRect();
    const imgElement = dialogCalloutIconElement.querySelector("img");
    openEmojiPanel("", "av", {
        x: emojiRect.left,
        y: emojiRect.bottom,
        h: emojiRect.height,
        w: emojiRect.width
    }, (unicode) => {
        handleEmojiSelect(unicode, typeInput, dialogCalloutIconElement);
    }, imgElement instanceof HTMLElement ? imgElement : undefined);
};

/**
 * 处理 Emoji 选择回调
 */
const handleEmojiSelect = (unicode: string, typeInput: HTMLInputElement, dialogCalloutIconElement: Element) => {
    if (unicode === "") {
        dialogCalloutIconElement.innerHTML = getDefaultIconByType(typeInput.value);
        return;
    }

    if (unicode.startsWith("api/icon/getDynamicIcon")) {
        dialogCalloutIconElement.innerHTML = `<img class="callout-img" src="${unicode}"/>`;
        return;
    }

    if (unicode.indexOf(".") > -1) {
        dialogCalloutIconElement.innerHTML = `<img class="callout-img" src="/emojis/${unicode}">`;
        return;
    }

    dialogCalloutIconElement.innerHTML = unicode2Emoji(unicode);
};

/**
 * 根据 callout 类型获取默认图标
 */
const getDefaultIconByType = (type: string): string => {
    const typeUpper = type.toUpperCase();
    const iconMap: Record<string, string> = {
        "NOTE": "✏️",
        "TIP": "💡",
        "IMPORTANT": "❗",
        "WARNING": "⚠️",
        "CAUTION": "🚨"
    };
    return iconMap[typeUpper] || "✏️";
};

/**
 * Callout 类型选项配置
 */
const CALLOUT_TYPE_ITEMS = [
    {icon: "✏️", type: "Note", color: "var(--b3-callout-note)"},
    {icon: "💡", type: "Tip", color: "var(--b3-callout-tip)"},
    {icon: "❗", type: "Important", color: "var(--b3-callout-important)"},
    {icon: "⚠️", type: "Warning", color: "var(--b3-callout-warning)"},
    {icon: "🚨", type: "Caution", color: "var(--b3-callout-caution)"}
];

/**
 * 显示 Callout 类型选择菜单
 */
const showCalloutTypeMenu = (
    event: Event,
    typeInput: HTMLInputElement,
    titleInput: HTMLInputElement,
    dialogCalloutIconElement: Element
) => {
    const menu = new Menu(Constants.MENU_CALLOUT_SELECT, () => {
        if (document.activeElement?.tagName === "BODY") {
            typeInput.focus();
        }
    });

    if (menu.isOpen) {
        menu.close();
        return;
    }

    for (const item of CALLOUT_TYPE_ITEMS) {
        menu.addItem({
            iconHTML: `<span class="b3-menu__icon">${item.icon.toUpperCase()}</span>`,
            label: `<span style="color: ${item.color}">${item.type}</span>`,
            click() {
                if (typeInput.value.toLowerCase() === titleInput.value.toLowerCase()) {
                    titleInput.value = item.type;
                }
                typeInput.value = item.type.toUpperCase();
                dialogCalloutIconElement.innerHTML = item.icon;
                titleInput.focus();
                titleInput.select();
            }
        });
    }

    const inputRect = typeInput.getBoundingClientRect();
    menu.open({
        x: inputRect.left,
        y: inputRect.bottom
    });

    event.stopPropagation();
    event.preventDefault();
};
