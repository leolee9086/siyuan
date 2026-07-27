/** 用途：超级块 DOM 协议常量。使用范围：默认属性占位；解耦评估：经本域网关直达真实声明。 */
import {Constants} from "./imports";

/** 创建带完整节点身份、布局和属性容器的超级块 DOM。 @同步豁免: UI构建 - 调用方必须在同一拖拽事务中立即插入并读取该元素。 */
export const genSBElement = (layout: string, id?: string, attrHTML?: string) => {
    const sbElement = document.createElement("div");
    sbElement.setAttribute("data-node-id", id || Lute.NewNodeID());
    sbElement.setAttribute("data-type", "NodeSuperBlock");
    sbElement.setAttribute("class", "sb");
    sbElement.setAttribute("data-sb-layout", layout);
    sbElement.innerHTML = attrHTML || `<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return sbElement;
};

/** 统计超级块内受 Lute 管理的真实直属子块，排除手柄和属性等装饰元素。 @同步豁免: 需要绝对同步的DOM访问 - 结构判断必须读取当前事务内的 DOM。 */
export const getSbChildCount = (sbElement: Element) => {
    const childBlocks = sbElement.querySelectorAll(":scope > [data-node-id]");
    return childBlocks.length;
};

/** 刷新超级块列布局的直属拖拽手柄；非列布局只清除已有手柄。 @同步豁免: 需要绝对同步的DOM访问 - 后续宽度计算依赖本次立即写入的手柄。 */
export const refreshSbResize = (sbElement: Element) => {
    if (!sbElement.classList.contains("sb")) {
        return;
    }
    for (const handle of sbElement.querySelectorAll(":scope > .sb__resize")) {
        handle.remove();
    }
    if (sbElement.getAttribute("data-sb-layout") !== "col") {
        return;
    }
    const children = Array.from(sbElement.querySelectorAll(":scope > [data-node-id]"));
    for (const child of children.slice(0, -1)) {
        const resizeHandle = document.createElement("span");
        resizeHandle.setAttribute("class", "sb__resize");
        resizeHandle.setAttribute("contenteditable", "false");
        child.after(resizeHandle);
    }
};

/** 按现有比例重新分配列布局直属子块宽度，并返回每个可撤销的旧快照。 @同步豁免: 需要绝对同步的DOM访问 - 旧快照、布局读取和宽度写入必须原子连续。 */
export const rebalanceSbWidth = (sbElement: Element) => {
    if (sbElement.getAttribute("data-sb-layout") !== "col") {
        return [];
    }
    const children = Array.from(sbElement.querySelectorAll<HTMLElement>(":scope > [data-node-id]"));
    if (children.length < 2 || !children.some(child => child.style.width)) {
        return [];
    }
    const handle = sbElement.querySelector<HTMLElement>(":scope > .sb__resize");
    const handleStyle = handle ? getComputedStyle(handle) : undefined;
    const gapPx = handle && handleStyle
        ? handle.offsetWidth + parseFloat(handleStyle.marginLeft) + parseFloat(handleStyle.marginRight)
        : 20;
    const gapShare = ((children.length - 1) * gapPx) / children.length + 0.5;
    const averageRatio = 1 / children.length;
    const ratios = children.map((child) => {
        const match = child.style.width.match(/calc\(([\d.]+)%/);
        return match ? parseFloat(match[1] || "0") / 100 : averageRatio;
    });
    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) || 1;
    const changes: Array<{id: string; oldHTML: string}> = [];
    for (const [index, child] of children.entries()) {
        const id = child.getAttribute("data-node-id");
        const ratio = ratios[index];
        if (!id || ratio === undefined) {
            continue;
        }
        const oldHTML = child.outerHTML;
        const percent = Math.round((ratio / totalRatio) * 100 * 10) / 10;
        child.style.width = `calc(${percent}% - ${gapShare}px)`;
        child.style.flex = "none";
        changes.push({id, oldHTML});
    }
    return changes;
};

/** 刷新已连接超级块的手柄与宽度，并把宽度变化按原顺序并入 do/undo 操作。 @同步豁免: 生命周期 - DOM 变化与事务操作必须在提交前同步对齐。 */
export const refreshSbAndPersistWidth = (
    sbElement: Element,
    doOperations: IOperation[],
    undoOperations: IOperation[]
) => {
    if (!sbElement.parentElement) {
        return;
    }
    refreshSbResize(sbElement);
    for (const change of rebalanceSbWidth(sbElement)) {
        const targetElement = sbElement.querySelector(`[data-node-id="${change.id}"]`);
        if (!targetElement) {
            continue;
        }
        doOperations.push({action: "update", id: change.id, data: targetElement.outerHTML});
        undoOperations.unshift({action: "update", id: change.id, data: change.oldHTML});
    }
};
