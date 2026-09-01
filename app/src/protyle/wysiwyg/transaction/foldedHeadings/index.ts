/** 用途：读取折叠标题事务常量。使用范围：非视图折叠标题展开。解耦评估：通过同域 imports 网关访问基础协议。 */
import {Constants} from "./imports";
/** 用途：提交标题展开事务。使用范围：非视图折叠标题展开。解耦评估：通过同域 imports 网关访问网络协议。 */
import {fetchSyncPost} from "./imports";
/** 用途：识别视图级折叠上下文。使用范围：标题展开前分流。解耦评估：通过同域 imports 网关访问折叠状态。 */
import {hasViewFoldContext} from "./imports";
/** 用途：切换视图级临时折叠。使用范围：视图折叠标题展开。解耦评估：通过同域 imports 网关访问折叠状态。 */
import {setViewFoldTransient} from "./imports";

/** 作用：定位尚未展开的折叠标题。意图：递归转换前按 DOM 顺序解除内部折叠。调用时机：每次展开循环开始。 */
const findNextFoldedHeading = (nodeElements: Element[], unfoldedIDs: Set<string>) => {
    for (const nodeElement of nodeElements) {
        for (const heading of nodeElement.querySelectorAll('[data-type="NodeHeading"][fold="1"]')) {
            const id = heading.getAttribute("data-node-id");
            if (id && !unfoldedIDs.has(id)) {
                return heading;
            }
        }
    }
};

/** 作用：展开一个标题并保留可回滚的折叠状态。意图：使列表转换可访问被折叠的子内容。调用时机：定位到折叠标题后。 */
const unfoldHeading = async (protyle: IProtyle, heading: Element, id: string) => {
    // 视图折叠只影响当前 pane，不能写入文档事务。
    if (hasViewFoldContext(protyle)) {
        await setViewFoldTransient(protyle, heading, false);
        return;
    }
    heading.removeAttribute("fold");
    const response = await fetchSyncPost("/api/transactions", {
        session: protyle.id,
        app: Constants.SIYUAN_APPID,
        transactions: [{
            doOperations: [{action: "unfoldHeading", id}],
            undoOperations: [{action: "foldHeading", id}],
        }],
    });
    const transactionResult = response.data?.[0];
    const unfoldOperation = transactionResult?.doOperations?.[0];
    const unfoldedHTML = unfoldOperation?.retData;
    if (typeof unfoldedHTML === "string") {
        heading.insertAdjacentHTML("afterend", unfoldedHTML);
    }
};

/** 作用：展开列表范围内的折叠标题。意图：转换前取得完整子树并保留反向折叠操作。调用时机：递归列表和取消容器转换前。 */
export const unfoldListHeadings = async (protyle: IProtyle, nodeElements: Element[]) => {
    const unfoldedIDs = new Set<string>();
    const foldOperations: IOperation[] = [];
    while (true) {
        const heading = findNextFoldedHeading(nodeElements, unfoldedIDs);
        const id = heading?.getAttribute("data-node-id");
        if (!heading || !id) {
            break;
        }
        unfoldedIDs.add(id);
        await unfoldHeading(protyle, heading, id);
        foldOperations.push({action: "foldHeading", id});
    }
    return foldOperations.reverse();
};
