/** 用途：DOM 元素定位。使用范围：浮窗面板位置设置。解耦评估：通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：设置元素位置。使用范围：浮窗面板位置计算。解耦评估：通过 ./imports 转发。 */
import { setPosition } from "./imports";
/** 用途：系统常量。使用范围：面板配置和快捷键。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：更新快捷键提示。使用范围：面板按钮提示更新。解耦评估：通过 ./imports 转发。 */
import { updateHotkeyAfterTip } from "./imports";
/** 用途：国际化文案。使用范围：面板按钮文案。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：SiYuan 配置。使用范围：面板行为配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：递增 z-index。使用范围：面板层级提升。解耦评估：通过 ./imports 转发。 */
import { incrementSiyuanZIndex } from "./imports";
/** 用途：窗口内高度。使用范围：面板位置计算。解耦评估：通过 ./imports 转发。 */
import { getWindowInnerHeight } from "./imports";
/** 用途：检查类名包含。使用范围：面板 DOM 判断。解耦评估：通过 ./imports 转发。 */
import { checkClassListContain } from "./imports";
/** 用途：渲染参数类型。使用范围：面板位置参数。解耦评估：同目录模块直接导入。 */
import { 设置面板位置参数 } from "./Panel.render.types";
/** 用途：Electron 环境判断。使用范围：面板平台适配。解耦评估：通过 ./imports 转发。 */
import { isElectron } from "./imports";

/**
 * 构建面板的 HTML 内容
 */
export function 构建面板HTML(refDefs: IRefDefs[]) {
    const config = getSiyuanConfig();
    let openHTML = "";
    // 仅有单个引用时显示"新标签页打开"按钮
    if (refDefs.length === 1) {
        openHTML = `<span data-type="stickTab" class="block__icon block__icon--show b3-tooltips b3-tooltips__sw" aria-label="${siyuanI18n.openInNewTab}${updateHotkeyAfterTip(config.keymap?.editor?.general?.openInNewTab?.custom || "")}"><svg><use xlink:href="#iconOpen"></use></svg></span>
<span class="fn__space"></span>`;
    }
    // Electron 环境下追加"在新窗口打开"按钮
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
    // 引用已过期时显示提示
    if (refDefs.length === 0) {
        html += `<div class="ft__smaller ft__smaller ft__secondary b3-form__space--small" contenteditable="false">${siyuanI18n.refExpired}</div>`;
    }
    for (let i = 0; i < refDefs.length; i++) {
        html += `<div class="block__edit fn__flex-1 protyle" data-index="${i}"></div>`;
    }
    html += "</div>";
    return html;
}



/**
 * 设置面板位置（首个编辑器加载完成后调用）
 */
export function 设置面板位置(参数: 设置面板位置参数) {
    const { element, targetElement, x, y } = 参数;
    if (!document.contains(element)) {
        return;
    }
    const innerHeight = getWindowInnerHeight();


    // 鼠标位置定位（无目标元素时使用坐标）
    if (!targetElement && typeof x === "number" && typeof y === "number") {
        setPosition(element, x, y);
        element.style.maxHeight = Math.floor(innerHeight - Math.max(y, Constants.SIZE_TOOLBAR_HEIGHT) - 12) + "px";
    }

    if (!targetElement) {
        完成定位(element, undefined, innerHeight);
        return;
    }

    // 嵌入块特殊定位处理
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

/** 处理嵌入块定位 */
function 处理嵌入块定位(element: HTMLElement, targetElement: HTMLElement, innerHeight: number) {
    const targetRect = targetElement.getBoundingClientRect();
    // 嵌入块过长时，单击弹出的悬浮窗位置居下
    let top = targetRect.top;
    const contentElement = hasClosestByClassName(targetElement, "protyle-content", true);
    // 内容区域顶部高于目标时使用内容区域顶部
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

/** 获取目标元素矩形 */
function 获取目标元素矩形(targetElement: HTMLElement) {
    if (checkClassListContain(targetElement, "pdf__rect")) {
        return targetElement.firstElementChild?.getBoundingClientRect();
    }
    return targetElement.getBoundingClientRect();
}

/** 处理普通目标定位 */
function 处理普通目标定位(element: HTMLElement, targetRect: DOMRect, innerHeight: number) {
    // 下部位置大的话就置于下部
    if (innerHeight - targetRect.bottom - 4 > targetRect.top + 12) {
        element.style.maxHeight = Math.floor(innerHeight - targetRect.bottom - 12) + "px";
    }
    // 靠边不宜拖拽 https://github.com/siyuan-note/siyuan/issues/2937
    setPosition(element, targetRect.left, targetRect.bottom + 4, targetRect.height + 12, 8);
}

/** 完成定位 */
function 完成定位(element: HTMLElement, targetRect: DOMRect | undefined, innerHeight: number) {
    const elementRect = element.getBoundingClientRect();

    if (targetRect) {
        设置悬浮窗高度(element, elementRect, targetRect, innerHeight);
    }
    element.classList.add("block__popover--open");
    element.style.zIndex = incrementSiyuanZIndex().toString();
}

/** 设置悬浮窗高度 */
function 设置悬浮窗高度(element: HTMLElement, elementRect: DOMRect, targetRect: DOMRect, innerHeight: number) {
    // 悬浮窗在目标上方时限制最大高度
    if (elementRect.top < targetRect.top) {
        element.style.maxHeight = Math.floor(targetRect.top - elementRect.top - 8) + "px";
        return;
    }
    element.style.maxHeight = Math.floor(innerHeight - elementRect.top - 8) + "px";
}
