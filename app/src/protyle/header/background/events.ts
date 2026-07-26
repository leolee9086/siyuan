import { hideElements } from "../../ui/hideElements";
import type {BackgroundDomain} from "./background.types";
import { clickImg, clickPosition, clickConfirmCancel, clickShowRandom, clickRandom, clickAsset, clickRemove, clickLink } from "./image";
import { clickOpenEmoji, clickIcon } from "./icon";
import { clickTag, clickOpenSearch, clickRemoveTag } from "./tags";

/**
 * 作用：分发处理题头图区域的点击事件。
 * 意图：根据点击元素的 data-type 属性调用相应的处理函数。
 */
const handlers: Record<string, (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => boolean | void> = {
    /** @简洁函数 委托调用 clickPosition */
    "position": (background, protyle, target, event) => clickPosition(background, event),
    /** @简洁函数 委托调用 clickConfirmCancel */
    "cancel": (background, protyle, target, event) => clickConfirmCancel(background, protyle, "cancel", event),
    /** @简洁函数 委托调用 clickConfirmCancel */
    "confirm": (background, protyle, target, event) => clickConfirmCancel(background, protyle, "confirm", event),
    /** @简洁函数 委托调用 clickOpenEmoji */
    "open-emoji": (background, protyle, target, event) => clickOpenEmoji(background, protyle, target, event),
    /** @简洁函数 委托调用 clickShowRandom */
    "show-random": (background, protyle, target, event) => clickShowRandom(background, protyle, event),
    /** @简洁函数 委托调用 clickRandom */
    "random": (background, protyle, target, event) => clickRandom(background, protyle, event),
    /** @简洁函数 委托调用 clickAsset */
    "asset": (background, protyle, target, event) => clickAsset(background, protyle, target, event),
    /** @简洁函数 委托调用 clickRemove */
    "remove": (background, protyle, target, event) => clickRemove(background, protyle, event),
    /** @简洁函数 委托调用 clickIcon */
    "icon": (background, protyle, target, event) => clickIcon(background, protyle, event),
    /** @简洁函数 委托调用 clickTag */
    "tag": (background, protyle, target, event) => clickTag(background, protyle, target, event),
    /** @简洁函数 委托调用 clickLink */
    "link": (background, protyle, target, event) => clickLink(background, protyle, event),
    /** @简洁函数 委托调用 clickOpenSearch */
    "open-search": (background, protyle, target, event) => clickOpenSearch(background, protyle, target, event),
    /** @简洁函数 委托调用 clickRemoveTag */
    "remove-tag": (background, protyle, target, event) => clickRemoveTag(background, protyle, target, event),
};

/**
 * 作用：分发处理题头图区域的点击事件。
 * 意图：根据点击元素的 data-type 属性调用相应的处理函数。
 */
const handleClickItem = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    // 强制转换 detail (兼容旧代码逻辑，假设需要) - 但为了 lint 尝试去掉
    // 如果 clickImg 需要 detail，这里会报错。暂时假设 MouseEvent 足够。
    if (clickImg(target, event)) {
        return true;
    }
    if (protyle.disabled) {
        return false;
    }
    const type = target.getAttribute("data-type");
    if (!type) {
        return false;
    }
    const handler = handlers[type];
    if (handler) {
        return handler(background, protyle, target, event);
    }
    return false;
};

/**
 * 作用：处理背景区域点击事件的具体逻辑。
 * 意图：执行事件委托循环，查找并处理点击目标。
 */
const handleBackgroundClick = (event: Event, background: BackgroundDomain, protyle: IProtyle) => {
    if (background.dragOccurred) {
        background.dragOccurred = false;
        return;
    }
    // 卫语句：确保事件类型
    if (!(event instanceof MouseEvent)) {
        return;
    }
    // 卫语句：确保目标类型
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    hideElements(["gutter"], protyle);

    let currentTarget: HTMLElement | null = target;
    while (currentTarget && !currentTarget.isEqualNode(background.element)) {
        // 此时 currentTarget 确认为 HTMLElement，event 确认为 MouseEvent
        if (handleClickItem(background, protyle, currentTarget, event)) {
            break;
        }
        currentTarget = currentTarget.parentElement;
    }
};

/**
 * 作用：绑定全局点击事件以处理背景图区域的交互。
 * 意图：通过事件委托处理背景图内部元素的点击，如上传、移除、标签等操作。
 * 调用时机：组件初始化时调用。
 */
export const bindClickEvent = (background: BackgroundDomain, protyle: IProtyle) => {
    background.element.addEventListener("click", (event) => {
        handleBackgroundClick(event, background, protyle);
    });
};
