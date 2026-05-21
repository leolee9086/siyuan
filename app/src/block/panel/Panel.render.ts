import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { setPosition } from "../../util/DOM/setPosition";
import { Constants } from "../../constants";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, incrementSiyuanZIndex } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowInnerHeight } from "../../util/siyuanEnvironments/getWindowInnerHeight.environment";
import { checkClassListContain } from "../../util/DOM/helpers/fnClasses";
import { 设置面板位置参数 } from "./Panel.render.types";
import { isElectron } from "../../platform";

/**
 * 构建面板的 HTML 内容
 */
export function 构建面板HTML(refDefs: IRefDefs[]): string {
    const config = getSiyuanConfig();
    let openHTML = "";
    if (refDefs.length === 1) {
        openHTML = `<span data-type="stickTab" class="block__icon block__icon--show b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.openInNewTab}${updateHotkeyAfterTip(config.keymap?.editor?.general?.openInNewTab?.custom || "")}"><svg><use xlink:href="#iconOpen"></use></svg></span>
<span class="fn__space"></span>`;
    }
    // Electron 环境下追加"在新窗口打开"按钮（原 /// #if !BROWSER）
    if (refDefs.length === 1 && isElectron) {
        openHTML += `<span data-type="open" class="block__icon block__icon--show b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.openByNewWindow}"><svg><use xlink:href="#iconOpenWindow"></use></svg></span>
<span class="fn__space"></span>`;
    }
    let html = `<div class="block__icons block__icons--menu">
    <span class="fn__space fn__flex-1 resize__move"></span>${openHTML}
    <span data-type="pin" class="block__icon block__icon--show b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.pin}"><svg><use xlink:href="#iconPin"></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="close" class="block__icon block__icon--show b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.close}${updateHotkeyAfterTip(config.keymap?.general?.closeTab?.custom || "")}"><svg><use xlink:href="#iconClose"></use></svg></span>
</div>
<div class="block__content">`;
    if (refDefs.length === 0) {
        html += `<div class="ft__smaller ft__smaller ft__secondary b3-form__space--small" contenteditable="false">${siyuanI18n.refExpired}</div>`;
    }
    for (let i = 0; i < refDefs.length; i++) {
        html += `<div class="block__edit fn__flex-1 protyle" data-index="${i}"></div>`;
    }
    if (html) {
        html += '</div><div class="resize__rd"></div><div class="resize__ld"></div><div class="resize__lt"></div><div class="resize__rt"></div><div class="resize__r"></div><div class="resize__d"></div><div class="resize__t"></div><div class="resize__l"></div>';
    }
    return html;
}



/**
 * 设置面板位置（首个编辑器加载完成后调用）
 */
export function 设置面板位置(参数: 设置面板位置参数): void {
    const { element, targetElement, x, y } = 参数;
    if (!document.contains(element)) {
        return;
    }
    const innerHeight = getWindowInnerHeight();


    if (!targetElement && typeof x === "number" && typeof y === "number") {
        setPosition(element, x, y);
        element.style.maxHeight = Math.floor(innerHeight - Math.max(y, Constants.SIZE_TOOLBAR_HEIGHT) - 12) + "px";
    }

    if (!targetElement) {
        完成定位(element, undefined, innerHeight);
        return;
    }

    if (checkClassListContain(targetElement, "protyle-wysiwyg__embed")) {
        处理嵌入块定位(element, targetElement, innerHeight);
        return;
    }

    const targetRect = 获取目标元素矩形(targetElement);
    if (targetRect) {
        处理普通目标定位(element, targetRect, innerHeight);
    }
    完成定位(element, targetRect, innerHeight);
}

function 处理嵌入块定位(element: HTMLElement, targetElement: HTMLElement, innerHeight: number): void {
    const targetRect = targetElement.getBoundingClientRect();
    // 嵌入块过长时，单击弹出的悬浮窗位置居下 https://ld246.com/article/1634292738717
    let top = targetRect.top;
    const contentElement = hasClosestByClassName(targetElement, "protyle-content", true);
    if (contentElement && targetRect.top < contentElement.getBoundingClientRect().top) {
        top = contentElement.getBoundingClientRect().top;
    }
    // 单击嵌入块悬浮窗的位置最好是覆盖嵌入块
    // 防止图片撑高后悬浮窗显示不下，只能设置高度
    element.style.height = Math.min(innerHeight - Constants.SIZE_TOOLBAR_HEIGHT, targetRect.height + 42) + "px";
    setPosition(element, targetRect.left, Math.max(top - 42, Constants.SIZE_TOOLBAR_HEIGHT), -42, 0);

    element.classList.add("block__popover--open");
    element.style.zIndex = incrementSiyuanZIndex().toString();
}

function 获取目标元素矩形(targetElement: HTMLElement): DOMRect | undefined {
    if (checkClassListContain(targetElement, "pdf__rect")) {
        return targetElement.firstElementChild?.getBoundingClientRect();
    }
    return targetElement.getBoundingClientRect();
}

function 处理普通目标定位(element: HTMLElement, targetRect: DOMRect, innerHeight: number): void {
    // 下部位置大的话就置于下部 https://ld246.com/article/1690333302147
    if (innerHeight - targetRect.bottom - 4 > targetRect.top + 12) {
        element.style.maxHeight = Math.floor(innerHeight - targetRect.bottom - 12) + "px";
    }
    // 靠边不宜拖拽 https://github.com/siyuan-note/siyuan/issues/2937
    setPosition(element, targetRect.left, targetRect.bottom + 4, targetRect.height + 12, 8);
}

function 完成定位(element: HTMLElement, targetRect: DOMRect | undefined, innerHeight: number): void {
    const elementRect = element.getBoundingClientRect();

    if (targetRect) {
        设置悬浮窗高度(element, elementRect, targetRect, innerHeight);
    }
    element.classList.add("block__popover--open");
    element.style.zIndex = incrementSiyuanZIndex().toString();
}

function 设置悬浮窗高度(element: HTMLElement, elementRect: DOMRect, targetRect: DOMRect, innerHeight: number): void {
    if (elementRect.top < targetRect.top) {
        element.style.maxHeight = Math.floor(targetRect.top - elementRect.top - 8) + "px";
        return;
    }
    element.style.maxHeight = Math.floor(innerHeight - elementRect.top - 8) + "px";
}
