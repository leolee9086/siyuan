/** 用途：导航历史容量协议；使用范围：后退栈写入；解耦评估：经本域网关直达常量。 */
import {Constants} from "./imports";
/** 用途：块祖先查询；使用范围：从 Range 确定历史块；解耦评估：经本域网关直达唯一实现。 */
import {hasClosestBlock} from "./imports";
/** 用途：可编辑元素查询；使用范围：光标位置计算；解耦评估：经本域网关直达唯一实现。 */
import {getContenteditableElement} from "./imports";
/** 用途：选区偏移算法；使用范围：光标位置计算；解耦评估：经本域网关直达唯一实现。 */
import {getSelectionOffset} from "./imports";
/** 用途：统一导航状态注册表；使用范围：桌面后退/前进栈；解耦评估：同域唯一可枚举状态所有者。 */
import {getNavigationHistoryState} from "./imports";

/** 从显式块或 Range 起点解析当前导航历史块。 */
const resolveHistoryBlock = (range: Range | undefined, blockElement: Element | undefined) => {
    if (blockElement || !range) {
        return blockElement;
    }
    return hasClosestBlock(range.startContainer) || undefined;
};

/** 弹出根据长度检查应当存在的前进历史，状态异常时显式失败。 */
const popRequiredForwardHistory = (forwardStack: IBackStack[]) => {
    const previous = forwardStack.pop();
    if (!previous) {
        throw new Error("Forward navigation history changed during pushBack");
    }
    return previous;
};

/** 取得桌面导航初始化后的后退栈；生命周期缺失时显式暴露错误。 */
const getDesktopBackStack = () => {
    const backStack = window.siyuan.backStack;
    if (!backStack) {
        throw new Error("Desktop navigation back stack is not initialized");
    }
    return backStack;
};

/** 在新历史位置产生时消费前进栈并同步前进按钮状态。 */
const consumeForwardHistory = (history: ReturnType<typeof getNavigationHistoryState>) => {
    const forwardStack = history.forwardStack;
    if (forwardStack.length === 0) {
        return;
    }
    if (history.previousIsBack) {
        getDesktopBackStack().push(popRequiredForwardHistory(forwardStack));
    }
    forwardStack.length = 0;
    const forwardButton = document.querySelector("#barForward");
    forwardButton?.classList.add("toolbar__item--disabled");
};

/** 构造当前位置的完整后退栈条目，只在缩放模式写入 zoomId。 */
const createBackStack = (protyle: IProtyle, id: string, position: IBackStack["position"]) => {
    const stack: IBackStack = {id, protyle};
    if (position) {
        stack.position = position;
    }
    // 仅缩放视图需要记录 zoomId，普通文档历史继续省略该可选字段。
    if (!protyle.block.showAll) {
        return stack;
    }
    const zoomId = protyle.block.id;
    if (!zoomId) {
        throw new Error("Zoom navigation history requires a block id");
    }
    stack.zoomId = zoomId;
    return stack;
};

/** 记录当前 Editor 块和光标位置到桌面导航历史，不加载实际前进/后退导航执行。 @同步豁免: 生命周期 - 光标快照与前后栈必须在当前导航动作内原子写入。 */
export const pushBack = (protyle: IProtyle, range?: Range, blockElement?: Element) => {
    const history = getNavigationHistoryState("desktop");
    if (!protyle.model) {
        return;
    }
    blockElement = resolveHistoryBlock(range, blockElement);
    if (!blockElement) {
        return;
    }
    const editElement = blockElement.classList.contains("protyle-title__input")
        ? blockElement
        : getContenteditableElement(blockElement);
    if (!editElement) {
        return;
    }
    const position = getSelectionOffset(editElement, undefined, range);
    const id = blockElement.getAttribute("data-node-id") || protyle.block.rootID;
    if (!id) {
        throw new Error("Navigation history requires a block identity");
    }
    const backStack = getDesktopBackStack();
    const lastStack = backStack[backStack.length - 1];
    // 同一普通文档或同一缩放视图连续记录时只更新光标，避免重复历史项。
    if (lastStack && lastStack.id === id && (
        (protyle.block.showAll && lastStack.zoomId === protyle.block.id) || (!lastStack.zoomId && !protyle.block.showAll)
    )) {
        lastStack.position = position;
        return;
    }
    consumeForwardHistory(history);
    backStack.push(createBackStack(protyle, id, position));
    // 历史超过统一 undo 容量时淘汰最旧位置。
    if (backStack.length > Constants.SIZE_UNDO) {
        backStack.shift();
    }
    history.previousIsBack = false;
    // 至少存在一个可返回的旧位置后才启用后退按钮。
    if (backStack.length > 1) {
        const backButton = document.querySelector("#barBack");
        backButton?.classList.remove("toolbar__item--disabled");
    }
};
