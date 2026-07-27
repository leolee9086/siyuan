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
