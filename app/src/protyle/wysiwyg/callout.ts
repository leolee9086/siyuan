import { hasClosestBlock } from "../util/hasClosest";
import { updateTransaction } from "./transaction";
import { focusBlock } from "../util/selection";
import { Dialog } from "../../dialog";
import { Menu } from "../../plugin/Menu";
import { isMobile } from "../../util/functions";
import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { openEmojiPanel, unicode2Emoji } from "../../emoji";

/**
 * 更新 Callout 块的类型和标题
 * @description 打开一个对话框让用户编辑 callout 的图标、类型和标题
 * @param titleElement - callout 的标题元素
 * @param protyle - Protyle 编辑器实例
 */
export const updateCalloutType = (titleElement: HTMLElement, protyle: IProtyle) => {
    const blockElement = hasClosestBlock(titleElement);
    if (!blockElement) {
        return;
    }
    const blockCalloutElement = blockElement.querySelector(".callout-icon");
    if (!blockCalloutElement) {
        return;
    }
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : null;

    const currentSubtype = blockElement.getAttribute("data-subtype") || "";

    const dialog = new Dialog({
        title: siyuanI18n.callout,
        content: getCalloutDialogHTML(currentSubtype, blockCalloutElement.innerHTML),
        width: isMobile() ? "92vw" : "520px",
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

    // 取消按钮
    cancelBtn.addEventListener("click", () => {
        dialog.destroy();
    });

    // 确认按钮
    confirmBtn.addEventListener("click", () => {
        confirmCalloutUpdate(protyle, blockElement, titleElement, blockCalloutElement, typeInput, titleInput, dialogCalloutIconElement);
        dialog.destroy();
    });

    // 绑定回车确认
    dialog.bindInput(titleInput, () => {
        confirmBtn.dispatchEvent(new CustomEvent("click"));
    });

    // 类型输入框键盘事件
    bindTypeInputKeydown(typeInput, dialog);

    // 初始化值
    typeInput.focus();
    typeInput.select();
    titleInput.value = protyle.lute.BlockDOM2StdMd(titleElement.innerHTML);

    // 图标点击事件 - 打开 emoji 选择器
    dialogCalloutIconElement.addEventListener("click", () => {
        openEmojiPanelForCallout(dialogCalloutIconElement, typeInput);
    });

    // 类型下拉菜单
    const iconDownElement = dialog.element.querySelector(".b3-form__icona-icon");
    if (iconDownElement) {
        iconDownElement.addEventListener("click", (event) => {
            showCalloutTypeMenu(event, typeInput, titleInput, dialogCalloutIconElement);
        });
    }
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
        <div class="b3-form__icona fn__flex-1">
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
 * @description 应用用户的修改到 callout 块
 */
const confirmCalloutUpdate = (
    protyle: IProtyle,
    blockElement: Element,
    titleElement: HTMLElement,
    blockCalloutElement: Element,
    typeInput: HTMLInputElement,
    titleInput: HTMLInputElement,
    dialogCalloutIconElement: Element
) => {
    const oldHTML = blockElement.outerHTML;
    blockElement.setAttribute("data-subtype", typeInput.value.trim());

    let title = titleInput.value.trim();
    if (title) {
        title = formatCalloutTitle(protyle, title);
    }

    // 如果标题为空，使用类型名作为默认标题（首字母大写）
    titleElement.innerHTML = title ||
        (typeInput.value.trim().substring(0, 1).toUpperCase() + typeInput.value.trim().substring(1).toLowerCase());

    // 更新图标
    blockCalloutElement.innerHTML = dialogCalloutIconElement.innerHTML;

    updateTransaction(protyle, blockElement.getAttribute("data-node-id") || "", blockElement.outerHTML, oldHTML);
    focusBlock(blockElement);
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
    // 如果用户清空了 emoji，根据类型恢复默认图标
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
    { icon: "✏️", type: "Note", color: "var(--b3-callout-note)" },
    { icon: "💡", type: "Tip", color: "var(--b3-callout-tip)" },
    { icon: "❗", type: "Important", color: "var(--b3-callout-important)" },
    { icon: "⚠️", type: "Warning", color: "var(--b3-callout-warning)" },
    { icon: "🚨", type: "Caution", color: "var(--b3-callout-caution)" }
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
            /**
             * 选中类型后的回调
             */
            click() {
                // 如果类型和标题相同，同步更新标题
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
