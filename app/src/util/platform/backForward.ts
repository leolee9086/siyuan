import { hasClosestBlock } from "../../protyle/util/hasClosest";
import { getContenteditableElement } from "../../protyle/wysiwyg/getBlock";
import { getSelectionOffset } from "../../protyle/util/selection";
import { Constants } from "../../constants";
import type { AppFacade } from "../../app/AppFacade.types";
import { focusStack } from "./focusStack";
import {getNavigationHistoryState} from "../../navigation/history/NavigationHistoryRegistry";

export const goBack = async (app: AppFacade) => {
    const history = getNavigationHistoryState("desktop");
    const forwardStack = history.forwardStack;
    if (window.siyuan.backStack.length === 0) {
        if (forwardStack.length > 0) {
            await focusStack(app, forwardStack[forwardStack.length - 1], forwardStack);
        }
        return;
    }
    document.querySelector("#barForward")?.classList.remove("toolbar__item--disabled");
    if (!history.previousIsBack &&
        // 页签被关闭时应优先打开该页签，页签存在时即可返回上一步，不用再重置光标到该页签上
        document.contains(window.siyuan.backStack[window.siyuan.backStack.length - 1].protyle.element)) {
        forwardStack.push(window.siyuan.backStack.pop());
    }
    let stack = window.siyuan.backStack.pop();
    while (stack) {
        const isFocus = await focusStack(app, stack, forwardStack);
        if (isFocus) {
            forwardStack.push(stack);
            break;
        } else {
            stack = window.siyuan.backStack.pop();
        }
    }
    history.previousIsBack = true;
    if (window.siyuan.backStack.length === 0) {
        document.querySelector("#barBack")?.classList.add("toolbar__item--disabled");
    }
};

export const goForward = async (app: AppFacade) => {
    const history = getNavigationHistoryState("desktop");
    const forwardStack = history.forwardStack;
    if (forwardStack.length === 0) {
        if (window.siyuan.backStack.length > 0) {
            await focusStack(app, window.siyuan.backStack[window.siyuan.backStack.length - 1], forwardStack);
        }
        return;
    }
    document.querySelector("#barBack")?.classList.remove("toolbar__item--disabled");
    if (history.previousIsBack) {
        window.siyuan.backStack.push(forwardStack.pop());
    }

    let stack = forwardStack.pop();
    while (stack) {
        const isFocus = await focusStack(app, stack, forwardStack);
        if (isFocus) {
            window.siyuan.backStack.push(stack);
            break;
        } else {
            stack = forwardStack.pop();
        }
    }
    history.previousIsBack = false;
    if (forwardStack.length === 0) {
        document.querySelector("#barForward")?.classList.add("toolbar__item--disabled");
    }
};

export const pushBack = (protyle: IProtyle, range?: Range, blockElement?: Element) => {
    const history = getNavigationHistoryState("desktop");
    const forwardStack = history.forwardStack;
    if (!protyle.model) {
        return;
    }
    if (!blockElement && range) {
        blockElement = hasClosestBlock(range.startContainer) as Element;
    }
    if (!blockElement) {
        return;
    }
    let editElement;
    if (blockElement.classList.contains("protyle-title__input")) {
        editElement = blockElement;
    } else {
        editElement = getContenteditableElement(blockElement);
    }
    if (editElement) {
        const position = getSelectionOffset(editElement, undefined, range);
        const id = blockElement.getAttribute("data-node-id") || protyle.block.rootID;
        const lastStack = window.siyuan.backStack[window.siyuan.backStack.length - 1];
        if (lastStack && lastStack.id === id && (
            (protyle.block.showAll && lastStack.zoomId === protyle.block.id) || (!lastStack.zoomId && !protyle.block.showAll)
        )) {
            lastStack.position = position;
        } else {
            if (forwardStack.length > 0) {
                if (history.previousIsBack) {
                    window.siyuan.backStack.push(forwardStack.pop());
                }
                forwardStack.length = 0;
                document.querySelector("#barForward")?.classList.add("toolbar__item--disabled");
            }
            window.siyuan.backStack.push({
                position,
                id,
                protyle,
                zoomId: protyle.block.showAll ? protyle.block.id : undefined,
            });
            if (window.siyuan.backStack.length > Constants.SIZE_UNDO) {
                window.siyuan.backStack.shift();
            }
            history.previousIsBack = false;
        }
        if (window.siyuan.backStack.length > 1) {
            document.querySelector("#barBack")?.classList.remove("toolbar__item--disabled");
        }
    }
};
