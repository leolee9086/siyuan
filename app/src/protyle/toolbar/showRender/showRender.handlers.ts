/**
 * showRender 模块事件处理器
 */
import { hasClosestByClassName } from "../../util/hasClosest";
import { hideElements } from "../../ui/hideElements";
import { insertEmptyBlock } from "../../../block/util";
import { matchHotKey } from "../../util/hotKey";
import { electronUndo } from "../../undo/keyboard/electronUndo";
import { contentRendererRegistry } from "../../../registry/contentRenderer/ContentRendererRegistry";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getDOMPurify } from "../../../util/siyuanEnvironments/getDOMPurify.environment";
import type { 渲染面板上下文, 按钮处理器 } from "./showRender.types";
import { isHTMLElement } from "../../../util/DOM/element.guard";

/** 切换固定按钮状态 */
function 切换固定按钮(element: Element, 切换到固定: boolean): void {
    const svgUse = element.querySelector("svg use");
    if (!svgUse) {
        return;
    }
    if (切换到固定) {
        svgUse.setAttribute("xlink:href", "#iconPin");
        element.setAttribute("aria-label", siyuanI18n.pin);
        return;
    }
    svgUse.setAttribute("xlink:href", "#iconUnpin");
    element.setAttribute("aria-label", siyuanI18n.unpin);
}

/** 处理双击标题栏 */
function 处理双击标题栏(event: MouseEvent, headerElement: Element): void {
    if (event.detail !== 2) {
        return;
    }
    const pingElement = headerElement.querySelector('[data-type="pin"]');
    if (!pingElement) {
        return;
    }
    const 当前是取消固定 = pingElement.getAttribute("aria-label") === siyuanI18n.unpin;
    切换固定按钮(pingElement, 当前是取消固定);
    event.preventDefault();
    event.stopPropagation();
}

const 按钮处理映射: Record<string, 按钮处理器> = {
    close: (上下文) => {
        const pinElement = 上下文.subElement.querySelector('[data-type="pin"]');
        if (pinElement) {
            pinElement.setAttribute("aria-label", siyuanI18n.pin);
        }
        hideElements(["util"], 上下文.protyle);
    },
    pin: (上下文, btnElement) => {
        if (!btnElement) {
            return;
        }
        const 当前是取消固定 = btnElement.getAttribute("aria-label") === siyuanI18n.unpin;
        切换固定按钮(btnElement, 当前是取消固定);
    },
    refresh: (_上下文, btnElement) => {
        if (btnElement) {
            btnElement.classList.toggle("block__icon--active");
        }
    },
    before: (上下文) => {
        insertEmptyBlock(上下文.protyle, "beforebegin", 上下文.id);
        hideElements(["util"], 上下文.protyle);
    },
    after: (上下文) => {
        insertEmptyBlock(上下文.protyle, "afterend", 上下文.id);
        hideElements(["util"], 上下文.protyle);
    },
    export: (_上下文, _btnElement, 导出图片回调) => {
        导出图片回调();
    }
};

/**
 * 处理头部按钮点击事件
 */
export function 处理头部按钮点击(
    event: MouseEvent,
    headerElement: Element,
    上下文: 渲染面板上下文,
    导出图片回调: () => void
): void {
    const target = event.target;
    if (!isHTMLElement(target)) {
        return;
    }
    const btnElement = hasClosestByClassName(target, "b3-tooltips");

    if (!btnElement) {
        处理双击标题栏(event, headerElement);
        return;
    }

    event.stopPropagation();
    const btnType = btnElement.getAttribute("data-type") ?? "";
    const 处理器 = 按钮处理映射[btnType];
    if (处理器) {
        处理器(上下文, btnElement, 导出图片回调);
    }
}

/** 更新行内备注元素 */
function 更新行内备注元素(elements: Element[], value: string): void {
    const sanitizedValue = getDOMPurify().sanitize(value);
    for (const item of elements) {
        if (item.nodeType !== 3) {
            item.setAttribute("data-inline-memo-content", sanitizedValue);
        }
    }
}

/**
 * 处理文本输入事件
 */
export function 处理文本输入(
    event: Event,
    上下文: 渲染面板上下文,
    自动高度回调: () => void
): void {
    const { renderElement, textElement, types, 是否行内备注, updateElements, subElement } = 上下文;

    if (!renderElement.parentElement) {
        return;
    }

    if (textElement.clientHeight !== textElement.scrollHeight) {
        自动高度回调();
    }

    // 检查是否启用实时刷新
    const refreshBtn = subElement.querySelector('[data-type="refresh"]');
    if (!refreshBtn?.classList.contains("block__icon--active")) {
        return;
    }

    // 根据类型更新内容
    if (types.includes("NodeHTMLBlock")) {
        const htmlElement = renderElement.querySelector("protyle-html");
        htmlElement?.setAttribute("data-content", Lute.EscapeHTMLStr(textElement.value));
        event.stopPropagation();
        return;
    }

    if (是否行内备注) {
        const inlineMemoElements = updateElements ?? [renderElement];
        更新行内备注元素(inlineMemoElements, textElement.value);
        event.stopPropagation();
        return;
    }

    renderElement.setAttribute("data-content", Lute.EscapeHTMLStr(textElement.value));
    renderElement.removeAttribute("data-render");

    const 需要渲染 = !types.includes("NodeBlockQueryEmbed") || !types.includes("NodeHTMLBlock") || !是否行内备注;
    if (需要渲染) {
        contentRendererRegistry.renderElement(renderElement);
    }

    event.stopPropagation();
}

/**
 * 处理键盘事件
 */
export function 处理键盘事件(
    event: KeyboardEvent,
    上下文: 渲染面板上下文
): void {
    event.stopPropagation();

    // 阻止 ctrl+m 缩小窗口
    const config = getSiyuanConfig();
    const inlineMathConfig = config?.keymap?.editor?.insert?.["inline-math"];
    const inlineMathHotkey = inlineMathConfig?.custom;
    if (inlineMathHotkey && matchHotKey(inlineMathHotkey, event)) {
        event.preventDefault();
        return;
    }

    if (event.isComposing) {
        return;
    }

    if (event.key === "Escape" || matchHotKey("⌘↩", event)) {
        const pinElement = 上下文.subElement.querySelector('[data-type="pin"]');
        pinElement?.setAttribute("aria-label", siyuanI18n.pin);
        hideElements(["util"], 上下文.protyle);
        return;
    }

    if (event.key === "Tab") {
        // 支持在文本框中输入 Tab
        document.execCommand("insertText", false, "\t");
        event.preventDefault();
        return;
    }

    electronUndo(event);
}

/**
 * 发射插件打开事件
 * 通知插件系统非编辑块已打开
 */
export function 发射插件打开事件(
    protyle: IProtyle,
    toolbar: { subElement: HTMLElement; element: HTMLElement; range?: Range | undefined },
    nodeElement: HTMLElement,
    renderElement: Element
): void {
    const app = protyle.app;
    if (!app?.plugins) {
        return;
    }

    for (const plugin of app.plugins) {
        plugin.eventBus.emit("open-noneditableblock", {
            protyle,
            toolbar,
            blockElement: nodeElement,
            renderElement,
        });
    }
}
