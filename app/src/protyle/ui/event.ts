import { Constants } from "../../constants";
import { genUUID } from "../../util/platform/genID";
import { isMac } from "../util/compatibility";
import { isMobile } from "../../platform";
import {setInlineStyle} from "../../util/assets/setInlineStyle";
import { hideMessage, showMessage } from "../runtime/dialog.port";
import { fetchPost } from "../../util/network/fetch";
import { lineNumberRender } from "../render/highlightRender";
import { getContenteditableElement, getEmbedChildOperationContext, getLastBlock } from "../wysiwyg/getBlock";
import {transaction} from "../wysiwyg/transaction/submit";
import { genEmptyElement, genHeadingElement } from "../../block/element.factory";
import { focusByRange } from "../util/selection";
import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    isInEmbedBlock
} from "../util/hasClosest";
import { hideElements } from "./hideElements";
import {highlightGutterButtonTarget} from "./gutterHover";
import {callMobileAppShowKeyboard} from "../../mobile/keyboard/mobileAppUtil";

const focusMobileAppEditor = (element: HTMLElement) => {
    if (window.JSAndroid?.showKeyboard || window.JSHarmony?.showKeyboard) {
        element.focus();
        callMobileAppShowKeyboard();
    }
};

/**
 * 处理字体大小增减
 * @returns 是否成功调整（如果已到边界则返回false）
 */
const 调整字体大小 = (deltaY: number): boolean => {
    // 向上滚动，增大字体
    if (deltaY < 0 && window.siyuan.config.editor.fontSize < 72) {
        window.siyuan.config.editor.fontSize++;
        return true;
    }
    // 向下滚动，减小字体
    if (deltaY > 0 && window.siyuan.config.editor.fontSize > 9) {
        window.siyuan.config.editor.fontSize--;
        return true;
    }
    return false;
};

const 保存编辑器配置 = () => {
    fetchPost("/api/setting/setEditor", window.siyuan.config.editor, (response) => {
        window.siyuan.config.editor = response.data;
    });
};

/**
 * 绑定鼠标滚轮事件 - 用于字体缩放功能
 * Ctrl/Cmd + 滚轮可以调整编辑器字体大小
 */
export const 绑定滚轮缩放事件 = (protyle: IProtyle) => {
    let wheelTimeout: number;
    const wheelId = genUUID();

    // @内联回调 滚轮缩放事件处理
    protyle.contentElement?.addEventListener("wheel", (event: WheelEvent) => {
        // 检查是否满足缩放条件：开启了配置 + 按住Ctrl/Cmd + 纵向滚动
        const isMacOS = isMac();
        const config = window.siyuan.config.editor;
        const 不满足缩放条件 = !config.fontSizeScrollZoom ||
            (isMacOS && !event.metaKey) ||
            (!isMacOS && !event.ctrlKey) ||
            event.deltaX !== 0;
        if (不满足缩放条件) {
            return;
        }
        event.stopPropagation();

        // 调整字体大小
        if (!调整字体大小(event.deltaY)) {
            return;
        }

        setInlineStyle();
        clearTimeout(wheelTimeout);
        const languages = window.siyuan.languages;
        showMessage(`${languages.fontSize} ${config.fontSize}px<span class="fn__space"></span>
<button class="b3-button b3-button--white">${languages.reset} 16px</button>`, undefined, undefined, wheelId);

        // @内联回调 延时保存配置
        wheelTimeout = window.setTimeout(() => {
            保存编辑器配置();
            const lineNumbers = protyle.wysiwyg.element.querySelectorAll(".code-block .protyle-linenumber__rows");
            for (const block of Array.from(lineNumbers)) {
                if (block.parentElement) {
                    lineNumberRender(block.parentElement);
                }
            }
            const messageButton = document.querySelector(`#message [data-id="${wheelId}"] button`);
            if (messageButton) {
                // @内联回调 重置按钮处理
                messageButton.addEventListener("click", () => {
                    window.siyuan.config.editor.fontSize = 16;
                    setInlineStyle();
                    保存编辑器配置();
                    hideMessage(wheelId);
                    for (const block of Array.from(lineNumbers)) {
                        if (block.parentElement) {
                            lineNumberRender(block.parentElement);
                        }
                    }
                });
            }
        }, Constants.TIMEOUT_LOAD);
    }, { passive: true });
};

/**
 * 判断是否需要在文档末尾创建新的空块
 */
const 判断需要创建空块 = (protyle: IProtyle, lastElement: Element, lastEditElement: Element | null): boolean => {
    if (protyle.options.click.preventInsetEmptyBlock) {
        return false;
    }
    if (!lastEditElement) {
        return true;
    }
    const 是段落块 = lastElement.getAttribute("data-type") === "NodeParagraph";
    const 是列表项文档 = protyle.wysiwyg.element.getAttribute("data-doc-type") === "NodeListItem";
    if (!是段落块 && !是列表项文档) {
        return true;
    }
    const editElement = getContenteditableElement(lastEditElement);
    return 是段落块 && editElement && editElement.innerHTML !== "";
};

/**
 * 创建空块元素
 */
const 创建空块元素 = (lastElement: Element): Element => {
    const 是折叠的标题 = lastElement.getAttribute("data-type") === "NodeHeading" &&
        lastElement.getAttribute("fold") === "1";
    if (是折叠的标题) {
        const headingElement = genHeadingElement(lastElement);
        if (headingElement instanceof Element) {
            return headingElement;
        }
    }
    return genEmptyElement(false, false);
};

/**
 * 在编辑器底部点击时自动创建新的空块
 * https://github.com/siyuan-note/siyuan/issues/12009
 */
const 处理底部点击创建空块 = (protyle: IProtyle, event: MouseEvent & { target: HTMLElement }) => {
    const lastElement = protyle.wysiwyg.element.lastElementChild;
    const lastRect = lastElement.getBoundingClientRect();
    const range = document.createRange();

    if (event.y <= lastRect.bottom) {
        return;
    }

    const lastEditElement = getContenteditableElement(getLastBlock(lastElement));

    if (判断需要创建空块(protyle, lastElement, lastEditElement)) {
        const emptyElement = 创建空块元素(lastElement);
        protyle.wysiwyg.element.insertAdjacentElement("beforeend", emptyElement);
        transaction(protyle, [{
            action: "insert",
            data: emptyElement.outerHTML,
            id: emptyElement.getAttribute("data-node-id"),
            previousID: emptyElement.previousElementSibling.getAttribute("data-node-id"),
            parentID: protyle.block.parentID
        }], [{
            action: "delete",
            id: emptyElement.getAttribute("data-node-id")
        }]);
        const emptyEditElement = getContenteditableElement(emptyElement) as HTMLElement;
        if (emptyEditElement) {
            range.selectNodeContents(emptyEditElement);
            range.collapse(true);
            focusByRange(range);
            focusMobileAppEditor(emptyEditElement);
        }
        // 需等待 range 更新再次进行渲染
        if (protyle.options.render?.breadcrumb) {
            setTimeout(() => {
                protyle.breadcrumb.render(protyle);
            }, Constants.TIMEOUT_TRANSITION);
        }
        protyle.toolbar.range = range;
        return;
    }

    if (lastEditElement) {
        range.selectNodeContents(lastEditElement as HTMLElement);
        range.collapse(false);
        focusByRange(range);
        focusMobileAppEditor(lastEditElement as HTMLElement);
        protyle.toolbar.range = range;
    }
};

/**
 * 检查是否有选中文本
 */
const 检查是否有选中文本 = (protyle: IProtyle): boolean => {
    if (window.getSelection().rangeCount <= 0) {
        return false;
    }
    const currentRange = window.getSelection().getRangeAt(0);
    return currentRange.toString() !== "" && protyle.wysiwyg.element.contains(currentRange.startContainer);
};

/**
 * 绑定 content 区域的点击事件
 */
export const 绑定底部点击事件 = (protyle: IProtyle) => {
    protyle.contentElement.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
        const eventProtyleElement = hasClosestByClassName(event.target, "protyle", true);
        if (eventProtyleElement && eventProtyleElement !== protyle.element) {
            return;
        }
        hideElements(["hint", "util"], protyle);
        // 禁止添加空块的条件检查
        const 禁止添加 = protyle.disabled ||
            protyle.contentElement.querySelector(".protyle-wysiwyg--select") ||
            (!event.target.classList.contains("protyle-content") &&
                !event.target.classList.contains("protyle-wysiwyg"));
        if (禁止添加) {
            return;
        }

        // https://github.com/siyuan-note/siyuan/issues/14190 最新测试无需 setTimeout，且会影响移动端键盘弹起故移除
        // 选中文本禁止添加空块 https://github.com/siyuan-note/siyuan/issues/13905
        if (检查是否有选中文本(protyle)) {
            return;
        }
        处理底部点击创建空块(protyle, event);
    });
};

/**
 * 移除高亮样式
 */
const 移除高亮 = (element: Element | null) => {
    if (element) {
        element.classList.remove("protyle-wysiwyg--hl");
    }
};

/**
 * 处理 attr 区域的鼠标悬停高亮
 */
const 处理Attr高亮 = (
    protyle: IProtyle,
    target: HTMLElement,
    overAttr: { value: boolean }
): boolean => {
    const attrElement = hasClosestByClassName(target, "protyle-attr");
    const 是有效的Attr元素 = attrElement && !attrElement.parentElement.classList.contains("protyle-title");

    if (是有效的Attr元素) {
        移除高亮(protyle.wysiwyg.element.querySelector(".protyle-wysiwyg--hl"));
        overAttr.value = true;
        attrElement.parentElement.classList.add("protyle-wysiwyg--hl");
        return true;
    }

    if (overAttr.value) {
        移除高亮(protyle.wysiwyg.element.querySelector(".protyle-wysiwyg--hl"));
        overAttr.value = false;
    }
    return false;
};

/**
 * 检查是否应保持当前 gutter 显示
 */
const 应保持当前Gutter = (protyle: IProtyle, nodeElement: HTMLElement): boolean => {
    const nodeType = nodeElement.getAttribute("data-type");
    if (!["NodeBlockquote", "NodeCallout"].includes(nodeType || "")) {
        return false;
    }
    const currentGutterButton = protyle.gutter?.element.querySelector("button[data-node-id]");
    if (!currentGutterButton) {
        return false;
    }
    const currentNodeId = currentGutterButton.getAttribute("data-node-id");
    // 检查当前gutter显示的块是否是这个容器块的后代
    return currentNodeId && !!nodeElement.querySelector(`[data-node-id="${currentNodeId}"]`);
};

/**
 * 处理 gutter（块标记）区域的鼠标悬停
 */
const 处理Gutter悬停 = (protyle: IProtyle, nodeElement: HTMLElement, target: HTMLElement): boolean => {
    if (!protyle.options.render?.gutter || !nodeElement) {
        return false;
    }

    // 光标在列表下部应显示右侧的元素，而不是列表本身
    if (nodeElement.classList.contains("list") || nodeElement.classList.contains("li")) {
        return true;
    }

    // 当鼠标移到容器块区域（NodeBlockquote/NodeCallout）时，检查是否应保持当前gutter
    if (应保持当前Gutter(protyle, nodeElement)) {
        return true;
    }

    const embedElement = isInEmbedBlock(nodeElement);
    if (embedElement) {
        const embedContext = getEmbedChildOperationContext(nodeElement);
        protyle.gutter.render(protyle, embedContext ? nodeElement : embedElement, target);
        return true;
    }

    protyle.gutter.render(protyle, nodeElement, target);
    return true;
};

/**
 * 处理面包屑的鼠标悬停高亮
 */
const 处理面包屑高亮 = (protyle: IProtyle, target: HTMLElement) => {
    // 移动端不处理面包屑悬停高亮
    if (isMobile) {
        return;
    }
    if (!protyle.selectElement.classList.contains("fn__none")) {
        return;
    }

    const svgElement = hasClosestByAttribute(target, "data-node-id", null);
    if (!svgElement || !svgElement.parentElement.classList.contains("protyle-breadcrumb__bar")) {
        return;
    }

    protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--hl").forEach(item => {
        item.classList.remove("protyle-wysiwyg--hl");
    });

    const nodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${svgElement.getAttribute("data-node-id")}"]`);
    if (nodeElement) {
        nodeElement.classList.add("protyle-wysiwyg--hl");
    }
};

/**
 * 绑定鼠标悬停事件
 * 触摸设备使用 touchend 事件，非触摸设备使用 mouseover 事件
 * @同步豁免: UI构建 - 需要同步绑定 DOM 事件监听器
 */
export const 绑定悬停事件 = (protyle: IProtyle) => {
    const overAttr = { value: false };
    const eventName = isMobile ? "pointerover" : "mouseover";

    // @内联回调 悬停/触摸事件处理
    protyle.element.addEventListener(eventName, (event: PointerEvent & { target: HTMLElement }) => {
        const eventProtyleElement = hasClosestByClassName(event.target, "protyle", true);
        if (eventProtyleElement && eventProtyleElement !== protyle.element) {
            return;
        }
        // 移动宿主只响应外接鼠标悬停，手指/触控笔不应显示桌面 gutter。
        if (isMobile && event.pointerType !== "mouse") {
            return;
        }
        // 数据库属性面板拥有独立交互，禁止正文 gutter 高亮侵入。
        if (hasClosestByClassName(event.target, "protyle-db-attr")) {
            return;
        }
        // 1. 处理 attr 高亮
        if (处理Attr高亮(protyle, event.target, overAttr)) {
            return;
        }

        // 2. 处理 gutter 悬停
        const nodeElement = hasClosestBlock(event.target);
        if (nodeElement && 处理Gutter悬停(protyle, nodeElement, event.target)) {
            return;
        }

        // 3. 处理 gutter 按钮高亮
        if (highlightGutterButtonTarget(protyle, event.target, event)) {
            return;
        }

        // 4. 处理面包屑高亮
        处理面包屑高亮(protyle, event.target);
    });
};
