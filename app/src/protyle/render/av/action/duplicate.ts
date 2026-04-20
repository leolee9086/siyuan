/**
 * 用途：引入 action 子目录网关依赖。
 * 使用范围：仅在完整复制模块中使用，负责复制接口、渲染、焦点和事务依赖。
 * 解耦评估：完整复制跨越网络、DOM 与事务，是一个完整副作用链，集中在单模块内比拆散更利于维护。
 */
import { avRender } from "./imports";
/**
 * 用途：调用“复制为完整副本”的后端接口。
 * 使用范围：仅在 duplicateCompletely 发起复制请求时使用。
 * 解耦评估：接口路径和请求体都属于当前动作语义，若改由调用方注入只会让外部承担不必要的协议细节。
 */
import { fetchPost } from "./imports";
/**
 * 用途：在新副本渲染完成后把焦点切到新块。
 * 使用范围：仅在复制成功后的首渲染回调中使用。
 * 解耦评估：焦点恢复是完整复制交互闭环的一部分，放在当前模块串联比拆到调用方更能保证行为一致。
 */
import { focusBlock } from "./imports";
/**
 * 用途：确认模板生成出的首个节点确实是可插入 DOM 的 HTMLElement。
 * 使用范围：仅在接口成功后构造临时 AV 壳节点时使用。
 * 解耦评估：这是通用 DOM 收窄能力，继续复用共享 guard 比在此重复声明判断逻辑更可靠。
 */
import { isHTMLElement } from "./imports";
/**
 * 用途：在焦点切换到新副本后把编辑区域滚动到合适位置。
 * 使用范围：仅在 avRender 完成后的首屏呈现阶段调用。
 * 解耦评估：滚动与焦点同属复制后的即时反馈，继续由当前动作集中调度比拆散到外层更直观。
 */
import { scrollCenter } from "./imports";
/**
 * 用途：登记复制插入和撤销删除所需的事务记录。
 * 使用范围：仅在新副本 DOM 成功插入并拿到 outerHTML 后调用。
 * 解耦评估：事务数据直接依赖复制接口响应和新节点 HTML，当前模块最清楚这些上下文，不适合再额外穿透给外部。
 */
import { transaction } from "./imports";

/**
 * 构造完整复制后的临时 AV 节点。
 *
 * 意图：服务端返回新的 blockID / avID 后，需要先生成最小 AV 壳节点，再交给 avRender 补全内容。
 * 调用时机：duplicateCompletely 收到复制接口响应后立即调用。
 * 问题/改进：当前默认复制为 table 视图壳节点，若未来后端返回实际视图类型，可改为动态注入。
 *
 * @param {IProtyle} protyle - 当前编辑器实例
 * @param {{ blockID: string, avID: string }} responseData - 接口返回的复制结果
 * @returns {HTMLElement | null} 生成的新节点
 */
const buildDuplicatedAttrViewElement = (
    protyle: IProtyle,
    responseData: { blockID: string, avID: string },
) => {
    if (!protyle.lute) {
        return null;
    }
    const templateElement = document.createElement("template");
    templateElement.innerHTML = protyle.lute.SpinBlockDOM(
        `<div class="av" data-node-id="${responseData.blockID}" data-av-id="${responseData.avID}" data-type="NodeAttributeView" data-av-type="table"></div>`
    );
    const firstChild = templateElement.content.firstElementChild;
    if (!isHTMLElement(firstChild)) {
        return null;
    }
    return firstChild;
};

/**
 * 处理完整复制接口成功后的本地更新链路。
 *
 * 意图：把接口返回值转换为真实 DOM 插入、首渲染、焦点滚动和事务登记。
 * 调用时机：duplicateCompletely 的 fetchPost 成功回调内调用。
 * 问题/改进：这里仍把渲染和事务耦合在一起，若未来支持后台复制队列，可再拆成更细粒度步骤。
 *
 * @param {IProtyle} protyle - 当前编辑器实例
 * @param {HTMLElement} nodeElement - 原始属性视图块
 * @param {{ data: { blockID: string, avID: string } }} response - 复制接口响应
 */
const handleDuplicateCompletelyResponse = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    response: IWebSocketData,
) => {
    const responseData = response.data as { blockID?: unknown, avID?: unknown } | undefined;
    if (typeof responseData?.blockID !== "string" || typeof responseData.avID !== "string") {
        return;
    }
    nodeElement.classList.remove("protyle-wysiwyg--select");
    const duplicateElement = buildDuplicatedAttrViewElement(protyle, {
        blockID: responseData.blockID,
        avID: responseData.avID,
    });
    if (!duplicateElement) {
        return;
    }

    nodeElement.after(duplicateElement);
    avRender(duplicateElement, protyle, () => {
        focusBlock(duplicateElement);
        scrollCenter(protyle);
    });

    transaction(protyle, [{
        action: "insert",
        data: duplicateElement.outerHTML,
        id: responseData.blockID,
        previousID: nodeElement.dataset.nodeId,
    }], [{
        action: "delete",
        id: responseData.blockID,
    }]);
};

/**
 * 复制当前属性视图为完整副本。
 *
 * 意图：与“镜像副本”不同，完整副本会创建新的属性视图块和新的 AV 数据实体，供用户独立编辑。
 * 调用时机：gutter 菜单或快捷键触发“复制为完整副本”时调用。
 * 问题/改进：当前复制成功后的首屏视图类型固定为 table；若后端未来返回更多元数据，应同步丰富本地渲染壳。
 *
 * @param {IProtyle} protyle - 当前编辑器实例
 * @param {HTMLElement} nodeElement - 当前属性视图块
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const duplicateCompletely = (protyle: IProtyle, nodeElement: HTMLElement) => {
    const avID = nodeElement.getAttribute("data-av-id");
    if (!avID) {
        return;
    }
    fetchPost("/api/av/duplicateAttributeViewBlock", { avID }, (response) => {
        handleDuplicateCompletelyResponse(protyle, nodeElement, response);
    });
};
