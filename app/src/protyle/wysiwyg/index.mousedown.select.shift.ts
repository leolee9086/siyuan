/**
 * 用途：块级祖先查找
 * 使用范围：定位选区起点块节点、向父级跳转
 * 解耦评估：与 DOM 深度耦合，通过 imports.ts 转发
 */
import {hasClosestBlock} from "./imports";
/**
 * 用途：类名匹配查找
 * 使用范围：检查已选中状态
 * 解耦评估：与 DOM 深度耦合，通过 imports.ts 转发
 */
import {hasClosestByClassName} from "./imports";
/**
 * 用途：聚焦光标到指定块元素
 * 使用范围：选中块后聚焦到首块或尾块
 * 解耦评估：与选区模型耦合，通过 imports.ts 转发
 */
import {focusBlock} from "./imports";
/**
 * 用途：统计选中块总字数并更新状态栏
 * 使用范围：多选完成后调用
 * 解耦评估：可通过事件发射替代，通过 imports.ts 转发
 */
import {countBlockWord} from "./imports";
/**
 * 用途：显示消息提示
 * 使用范围：跨懒加载区域选中时给出提示
 * 解耦评估：可通过回调注入，通过 imports.ts 转发
 */
import {showMessage} from "./imports";
/**
 * 用途：国际化文案
 * 使用范围：跨懒加载提示消息参数
 * 解耦评估：可通过参数传递，通过 imports.ts 转发
 */
import {siyuanI18n} from "./imports";
/**
 * 用途：同步 Gallery DOM 与虚拟滚动选中状态。
 * 使用范围：仅处理 Shift 范围选择。
 * 解耦评估：这是同一选择状态机的共享实现，参数传递会复制状态同步逻辑，直接依赖更清晰。
 */
import {setGalleryItemSelected} from "./index.mousedown.select.gallery";
/**
 * 用途：刷新 Gallery 表头聚合选中态。
 * 使用范围：Shift 范围选择完成后调用一次。
 * 解耦评估：表头由 AV 渲染层持有，通过既有目录网关访问比向通用选择函数注入 UI 回调更细粒度。
 */
import {updateHeader} from "./imports";

/** 查找最近块元素，无则返回 null */
function getClosestBlock(node: Node | null) {
    if (!node) {
        return null;
    }
    const block = hasClosestBlock(node);
    return block instanceof HTMLElement ? block : null;
}

/** 收集 gallery 前向未选中兄弟 */
function collectPrevSiblings(element: HTMLElement) {
    const list: Element[] = [];
    let side = element.previousElementSibling;
    while (side) {
        if (side.classList.contains("av__gallery-item--select")) {
            break;
        }
        list.push(side);
        side = side.previousElementSibling;
        if (!side) {
            return [];
        }
    }
    return list;
}

/** 收集 gallery 后向未选中兄弟，遇到添加按钮时停止 */
function collectNextSiblings(element: HTMLElement) {
    const list: Element[] = [];
    let side = element.nextElementSibling;
    while (side) {
        if (side.classList.contains("av__gallery-item--select")) {
            break;
        }
        list.push(side);
        side = side.nextElementSibling;
        if (!(side instanceof HTMLElement) || side.classList.contains("av__gallery-add")) {
            return [];
        }
    }
    return list;
}

/** hasJump 跳转分支处理 */
function resolveJumpStep(ctx: {
    element: HTMLElement;
    result: Element[];
    endTop: number;
    endRect: DOMRect;
    startRect: DOMRect;
}) {
    const {element, result, endTop, endRect, startRect} = ctx;
    const next = element.nextElementSibling;
    // 下一个兄弟不存在或是属性块时，向父级跳转
    const usable = next && !next.classList.contains("protyle-attr");
    if (!usable) {
        return {current: getClosestBlock(element.parentElement), hasJump: true};
    }
    const nextRect = next.getBoundingClientRect();
    const isInRange = startRect.top === endRect.top
        ? (nextRect.left <= endTop && nextRect.bottom <= endRect.bottom)
        : (nextRect.top <= endTop);
    if (isInRange) {
        result.length = 0;
        result.push(element);
        return {current: next instanceof HTMLElement ? next : null, hasJump: false};
    }
    // 父节点是超级块时向上跳转
    if (element.parentElement?.classList.contains("sb")) {
        return {current: getClosestBlock(element.parentElement), hasJump: true};
    }
    return {current: null, hasJump: true};
}

/** 遍历兄弟链，收集 endTop 范围内的块元素。 */
function walkSiblings(ctx: {
    start: HTMLElement;
    endTop: number;
    endRect: DOMRect;
    startRect: DOMRect;
}) {
    const {start, endTop, endRect, startRect} = ctx;
    const result: Element[] = [];
    let currentElement: HTMLElement | null = start;
    let hasJump = false;
    while (currentElement) {
        // 跳过面包屑导航栏，转到下一个兄弟
        if (currentElement.classList.contains("protyle-breadcrumb__bar")) {
            currentElement = currentElement.nextElementSibling instanceof HTMLElement ? currentElement.nextElementSibling : null;
        }
        // 空节点或属性块，向父级跳转重新定位
        if (!currentElement || currentElement.classList.contains("protyle-attr")) {
            currentElement = currentElement ? getClosestBlock(currentElement.parentElement) : null;
            hasJump = true;
            continue;
        }
        const currentRect = currentElement.getBoundingClientRect();
        const inRange = startRect.top === endRect.top ? (currentRect.left <= endTop) : (currentRect.top <= endTop);
        // 不在范围内但父节点是超级块时跳转
        if (!inRange && currentElement.parentElement?.classList.contains("sb")) {
            currentElement = getClosestBlock(currentElement.parentElement);
            hasJump = true;
            continue;
        }
        // 不在范围内且父节点非超级块时结束遍历
        if (!inRange) {
            break;
        }
        // hasJump 状态时执行跳转决策
        if (hasJump) {
            const step = resolveJumpStep({element: currentElement, result, endTop, endRect, startRect});
            currentElement = step.current;
            hasJump = step.hasJump;
            continue;
        }
        // 跳过 sb 调整条
        if (!currentElement.classList.contains("sb__resize")) {
            result.push(currentElement);
        }
        currentElement = currentElement.nextElementSibling instanceof HTMLElement ? currentElement.nextElementSibling : null;
    }
    return result;
}

/** 为块添加选中样式、统计字数、聚焦首尾块。 */
function markSelected(ctx: {
    protyle: IProtyle;
    selectElements: Element[];
    hasSelectClassElement: Element | null;
    startElement: HTMLElement;
    endElement: HTMLElement;
    toDown: boolean;
}) {
    const {protyle, selectElements, hasSelectClassElement, startElement, endElement, toDown} = ctx;
    const contentHeight = protyle.contentElement?.clientHeight ?? 0;
    // 跨懒加载区域时给出提示
    if (!hasSelectClassElement && protyle.scroll
        && !protyle.scroll.element.classList.contains("fn__none")
        && !protyle.scroll.keepLoadedContent
        && (startElement.getBoundingClientRect().top < -contentHeight * 2 || endElement.getBoundingClientRect().bottom > contentHeight * 2)) {
        showMessage(siyuanI18n.crossKeepLazyLoad);
    }
    const ids: string[] = [];
    for (const item of selectElements) {
        if (hasClosestByClassName(item, "protyle-wysiwyg--select")) {
            continue;
        }
        item.classList.add("protyle-wysiwyg--select");
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
        for (const subItem of item.querySelectorAll(".protyle-wysiwyg--select")) {
            subItem.classList.remove("protyle-wysiwyg--select");
        }
    }
    countBlockWord(ids, protyle.block.rootID, false, protyle.options.status);
    const wysiwygElement = protyle.wysiwyg?.element;
    if (!wysiwygElement || selectElements.length === 0) {
        return;
    }
    const focusElement: Element | undefined = toDown ? selectElements[selectElements.length - 1] : selectElements[0];
    if (focusElement) {
        focusBlock(focusElement, wysiwygElement, false);
    }
}

/** 执行从 startElement 到 endElement 的 shift 区域选中。 */
function performAreaSelect(ctx: {
    protyle: IProtyle;
    startElement: HTMLElement;
    endElement: HTMLElement;
    hasSelectClassElement: Element | null;
}) {
    const {protyle, startElement, endElement, hasSelectClassElement} = ctx;
    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();
    let startTop = startRect.top;
    let endTop = endRect.top;
    // 横排布局时使用 left 比较
    if (startTop === endTop) {
        startTop = startRect.left;
        endTop = endRect.left;
    }
    let toDown = true;
    let effectiveStart: HTMLElement = startElement;
    // 确保 effectiveStart 是视觉上方的块
    if (startTop > endTop) {
        effectiveStart = endElement;
        [endTop, startTop] = [startTop, endTop];
        toDown = false;
    }
    const collected = walkSiblings({start: effectiveStart, endTop, endRect, startRect});
    // 选中多个块或单容器块时应用结果；单个非容器块（如 p）跳过
    if (collected.length !== 1) {
        markSelected({protyle, selectElements: collected, hasSelectClassElement, startElement, endElement, toDown});
        return;
    }
    const first = collected[0];
    if (!first) {
        return;
    }
    const isContainer = first.classList.contains("list")
        || first.classList.contains("bq")
        || first.classList.contains("callout")
        || first.classList.contains("sb");
    if (isContainer) {
        markSelected({protyle, selectElements: collected, hasSelectClassElement, startElement, endElement, toDown});
    }
}

/**
 * 处理 shift+click 多选逻辑。
 * @param {object} options 点击事件上下文：{ event, nodeElement, hasSelectClassElement, galleryItemElement }
 * @同步豁免: 需要绝对同步的DOM访问 — 点击事件处理器，需同步返回以控制事件传播
 */
export function handleShiftSelect(
    protyle: IProtyle,
    options: {
        event: MouseEvent;
        nodeElement: HTMLElement | false;
        hasSelectClassElement: Element | null;
        galleryItemElement: HTMLElement | false;
    },
) {
    const {event, nodeElement, hasSelectClassElement, galleryItemElement} = options;
    if (!event.shiftKey) {
        return false;
    }
    let startElement: HTMLElement | false = false;
    // 从浏览器选区获取起始块 https://github.com/siyuan-note/siyuan/issues/9334
    const selection = window.getSelection();
    // 存在选区且包含至少一个范围时获取起始块
    if (selection && selection.rangeCount > 0) {
        const block = getClosestBlock(selection.getRangeAt(0).startContainer);
        startElement = block || false;
    }
    // gallery 模式下 shift 选中
    if (galleryItemElement && !hasSelectClassElement) {
        const selectedItems: Element[] = [galleryItemElement,
            ...collectPrevSiblings(galleryItemElement),
            ...collectNextSiblings(galleryItemElement)];
        for (const item of selectedItems) {
            setGalleryItemSelected(item, true);
        }
        updateHeader(galleryItemElement);
        event.preventDefault();
        return true;
    }
    // 块区域多选：起始块存在且与点击块不同
    if (startElement && nodeElement && startElement !== nodeElement) {
        performAreaSelect({protyle, startElement, endElement: nodeElement, hasSelectClassElement});
        event.preventDefault();
    }
    return true;
}
