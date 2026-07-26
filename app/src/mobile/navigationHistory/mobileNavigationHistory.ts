/** 用途：取得移动 scope 的统一历史状态；使用范围：移动历史清理和写入；解耦评估：通过本域 imports 暴露唯一注册表依赖。 */
import {getNavigationHistoryState} from "./imports";
/** 用途：取得当前移动编辑器；使用范围：记录当前历史位置；解耦评估：通过本域 imports 直达移动宿主查询，不加载导航恢复实现。 */
import {getCurrentEditor} from "./imports";

/** 清理全部或指定笔记本的移动导航历史，由工作空间消息关闭文档后调用。 @同步豁免: 遗留代码 */
export const clearMobileBackForward = (notebookId?: string) => {
    const forwardStack = getNavigationHistoryState("mobile").forwardStack;
    if (!notebookId) {
        window.siyuan.backStack = [];
        forwardStack.length = 0;
        return;
    }
    const backStack = window.siyuan.backStack;
    if (!backStack) {
        throw new Error("Mobile navigation back stack is not initialized");
    }
    window.siyuan.backStack = backStack.filter((item) => item.data?.notebookId !== notebookId);
    for (let index = forwardStack.length - 1; index >= 0; index--) {
        const stackItem = forwardStack[index];
        // 索引来自当前数组边界，缺项表示导航状态在同步清理期间被异常破坏。
        if (!stackItem) {
            throw new Error("Mobile navigation forward stack changed during cleanup");
        }
        // 同步移除前进栈中的同一笔记本，避免关闭后仍恢复已失效文档。
        if (stackItem.data?.notebookId === notebookId) {
            forwardStack.splice(index, 1);
        }
    }
};

/** 记录当前移动编辑器位置，在聚焦切换前建立可恢复的后退历史。 @同步豁免: 需要绝对同步的DOM访问 */
export const pushMobileBack = () => {
    const editor = getCurrentEditor();
    const protyle = editor?.protyle;
    const wysiwyg = protyle?.wysiwyg;
    const firstElement = wysiwyg?.element.firstElementChild;
    const lastElement = wysiwyg?.element.lastElementChild;
    const contentElement = protyle?.contentElement;
    const id = protyle?.block.showAll ? protyle.block.id : protyle?.block.rootID;
    const startId = firstElement?.getAttribute("data-node-id");
    const endId = lastElement?.getAttribute("data-node-id");
    const notebookId = protyle?.notebookId;
    const path = protyle?.path;
    const backStack = window.siyuan.backStack;
    if (!protyle || !contentElement || !id || !startId || !endId || !notebookId || !path || !backStack) {
        throw new Error("Mobile editor navigation state is incomplete");
    }
    const snapshot: IBackStack = {
        id,
        data: {
            startId,
            endId,
            notebookId,
            path,
        },
        scrollTop: contentElement.scrollTop,
    };
    // 仅在编辑器存在动作链时保存，保持 IBackStack 可选字段的精确语义。
    if (protyle.block.action) {
        snapshot.callback = protyle.block.action;
    }
    // 聚焦模式需要记录当前块，普通文档历史不携带 zoomId。
    if (protyle.block.showAll) {
        snapshot.zoomId = id;
    }
    backStack.push(snapshot);
};
