import {transaction} from "../wysiwyg/transaction/submit";
import {preventScroll} from "../scroll/preventScroll";
import {isInEmbedBlock} from "./hasClosest";
import {scrollCenter} from "../../util/DOM/highlightById";
import {getSbChildBlockCount, getTopAloneElement} from "../wysiwyg/getBlock";
import {applyFoldStateRequest} from "./blockFold/state";
import {fetchSyncPost} from "../../util/network/fetch";
import {
    getViewFoldOccurrenceID,
    hasViewFoldContext,
    setViewFold,
    setViewFoldState,
    setViewFoldTransient,
} from "./viewFold";

const getEmptyFoldResult = () => ({
    fold: -1,
    doOperations: [] as IOperation[],
    undoOperations: [] as IOperation[],
    ready: Promise.resolve(),
});

export const setFold = (protyle: IProtyle, nodeElement: Element, isOpen?: boolean,
                        isRemove?: boolean, addLoading = true, getOperations = false,
                        persistViewState = !getOperations) => {
    if (nodeElement.getAttribute("data-type") === "NodeListItem" && nodeElement.childElementCount < 4 &&
        // 该情况需要强制展开 https://github.com/siyuan-note/siyuan/issues/12327
        !isOpen) {
        // 没有子列表或多个块的列表项不进行折叠
        return getEmptyFoldResult();
    }
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return getEmptyFoldResult();
    }
    const hasFold = nodeElement.getAttribute("fold") === "1";
    if (hasViewFoldContext(protyle)) {
        if ((hasFold && typeof isOpen === "boolean" && !isOpen) ||
            (!hasFold && typeof isOpen === "boolean" && isOpen)) {
            return getEmptyFoldResult();
        }
        const folded = !hasFold;
        const ready = persistViewState ?
            (setViewFold(protyle, nodeElement, folded), Promise.resolve()) :
            setViewFoldTransient(protyle, nodeElement, folded, undefined, false);
        preventScroll(protyle);
        if (!getOperations) {
            return {fold: folded ? 1 : 0, undoOperations: [], doOperations: [], ready};
        }
        const id = nodeElement.getAttribute("data-node-id");
        if (nodeElement.getAttribute("data-type") === "NodeHeading") {
            return {
                fold: folded ? 1 : 0,
                doOperations: [{
                    action: folded ? "foldHeading" : "unfoldHeading",
                    id,
                    data: !folded && isRemove ? "remove" : undefined,
                }] as IOperation[],
                undoOperations: [{
                    action: folded ? "unfoldHeading" : "foldHeading",
                    id,
                }] as IOperation[],
                ready,
            };
        }
        return {
            fold: folded ? 1 : 0,
            doOperations: [{
                action: "setAttrs",
                id,
                data: JSON.stringify({fold: folded ? "1" : ""}),
            }] as IOperation[],
            undoOperations: [{
                action: "setAttrs",
                id,
                data: JSON.stringify({fold: folded ? "" : "1"}),
            }] as IOperation[],
            ready,
        };
    }
    // 普通编辑上下文：折叠状态网关负责同步 DOM 并构造可逆操作，此处只决定是否提交事务。
    const result = applyFoldStateRequest({protyle, nodeElement, isOpen, isRemove, addLoading});
    if (!result.doOperations) {
        return getEmptyFoldResult();
    }
    if (!getOperations) {
        transaction(protyle, result.doOperations, result.undoOperations);
    }
    // 折叠后，防止滚动条滚动后调用 get 请求 https://github.com/siyuan-note/siyuan/issues/2248
    preventScroll(protyle);
    return {...result, ready: Promise.resolve()};
};

/** 通过折叠状态网关把块调整到指定方向，供递归折叠在组合事务前同步各候选块的 DOM。 */
const applyFoldState = (protyle: IProtyle, nodeElement: Element, folded: boolean) => {
    applyFoldStateRequest({protyle, nodeElement, isOpen: !folded, addLoading: false});
};

const headingFoldingProtyles = new WeakSet<IProtyle>();

const getViewHeadingGroup = (protyle: IProtyle, nodeElement: Element, scope: "children" | "siblings") => {
    if (scope === "children" && nodeElement.getAttribute("fold") === "1") {
        return [nodeElement];
    }
    const occurrenceID = getViewFoldOccurrenceID(protyle, nodeElement);
    const level = Number(nodeElement.getAttribute("data-subtype")?.substring(1));
    const headings = Array.from(protyle.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"]')).filter(item => {
        return getViewFoldOccurrenceID(protyle, item) === occurrenceID;
    });
    if (scope === "siblings") {
        return headings.filter(item => Number(item.getAttribute("data-subtype")?.substring(1)) === level);
    }
    const startIndex = headings.indexOf(nodeElement);
    const children: Element[] = [];
    let directLevel = 7;
    for (let index = startIndex + 1; index < headings.length; index++) {
        const current = headings[index];
        const currentLevel = Number(current.getAttribute("data-subtype")?.substring(1));
        if (currentLevel <= level) {
            break;
        }
        if (currentLevel <= directLevel) {
            directLevel = currentLevel;
            children.push(current);
        }
    }
    return children;
};

export const foldHeadingGroup = async (protyle: IProtyle, nodeElement: Element,
                                       scope: "children" | "siblings") => {
    if (headingFoldingProtyles.has(protyle) || nodeElement.getAttribute("data-type") !== "NodeHeading") {
        return;
    }

    headingFoldingProtyles.add(protyle);
    try {
        if (hasViewFoldContext(protyle)) {
            const headings = getViewHeadingGroup(protyle, nodeElement, scope);
            const foldAll = headings.some(item => item.getAttribute("fold") !== "1");
            headings.slice().reverse().forEach(item => {
                if ((item.getAttribute("fold") === "1") !== foldAll) {
                    setViewFold(protyle, item, foldAll);
                }
            });
            return;
        }
        const id = nodeElement.getAttribute("data-node-id");
        const response = await fetchSyncPost("/api/block/getHeadingFoldTransaction", {id, scope});
        const doOperations = response.data?.doOperations as IOperation[];
        const undoOperations = response.data?.undoOperations as IOperation[];
        if (!doOperations || !undoOperations || doOperations.length === 0) {
            return;
        }
        await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 10000);
            transaction(protyle, doOperations, undoOperations, {
                callback() {
                    window.clearTimeout(timeout);
                    const currentElement = nodeElement.isConnected ? nodeElement :
                        protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
                    const blockButtonElement = protyle.gutter.element.querySelector(`[data-node-id="${id}"]`);
                    const arrowElement = blockButtonElement?.parentElement?.querySelector("[data-type='fold'] > svg") as HTMLElement;
                    if (currentElement && arrowElement) {
                        arrowElement.style.transform = currentElement.getAttribute("fold") === "1" ? "" : "rotate(90deg)";
                    }
                    resolve();
                }
            });
            if (protyle.lite) {
                window.clearTimeout(timeout);
                resolve();
            }
        });
    } catch (error) {
        console.error(error);
    } finally {
        headingFoldingProtyles.delete(protyle);
    }
};

const isFoldable = (el: Element) => {
    const type = el.getAttribute("data-type");
    return type === "NodeHeading" ||
        (type === "NodeCallout" && el.querySelector(".callout-content").childElementCount > 1) ||
        ((type === "NodeListItem" || type === "NodeBlockquote") && el.childElementCount > 3) ||
        (type === "NodeSuperBlock" && getSbChildBlockCount(el) > 1);
};

const foldBlocksRecursively0 = async (protyle: IProtyle, nodeElements: Element[]) => {
    const viewContext = hasViewFoldContext(protyle);
    const candidates = new Map<string, {element: Element, order: number, occurrenceID: string}>();
    let order = 0;
    const addCandidate = (element: Element, occurrenceID = getViewFoldOccurrenceID(protyle, element)) => {
        if (!isFoldable(element) ||
            (element.getAttribute("data-type") === "NodeHeading" &&
                element.parentElement?.getAttribute("data-type") === "NodeListItem")) {
            return;
        }
        const id = element.getAttribute("data-node-id");
        const key = viewContext ? `${encodeURIComponent(occurrenceID)}:${id}` : id;
        if (!id || candidates.has(key)) {
            return;
        }
        candidates.set(key, {element, order, occurrenceID});
        order++;
    };
    const addScope = (scope: ParentNode, occurrenceID?: string) => {
        if (scope instanceof Element) {
            addCandidate(scope, occurrenceID);
        }
        scope.querySelectorAll("[data-type='NodeHeading'], .li, .bq, .sb, .callout").forEach(element => {
            addCandidate(element, occurrenceID);
        });
    };

    const scopes = await Promise.all(nodeElements.map(async (element) => {
        let fullHTML = "";
        if (element.getAttribute("data-type") === "NodeHeading") {
            const response = await fetchSyncPost("/api/block/getHeadingChildrenDOM", {
                id: element.getAttribute("data-node-id"),
                removeFoldAttr: false,
            });
            fullHTML = response.data;
        } else if (element.querySelector('[data-type="NodeHeading"][fold="1"]')) {
            const response = await fetchSyncPost("/api/block/getBlockDOM", {
                id: element.getAttribute("data-node-id"),
                notebook: protyle.notebookId,
            });
            fullHTML = response.data.dom;
        }
        return {element, fullHTML, occurrenceID: getViewFoldOccurrenceID(protyle, element)};
    }));
    scopes.forEach(({element, fullHTML, occurrenceID}) => {
        if (fullHTML) {
            const template = document.createElement("template");
            template.innerHTML = fullHTML;
            addScope(template.content, occurrenceID);
        } else {
            addScope(element, occurrenceID);
        }
    });

    const foldCandidates = Array.from(candidates.values()).sort((a, b) => a.order - b.order).map((candidate) => {
        const id = candidate.element.getAttribute("data-node-id");
        if (viewContext) {
            const connectedElement = Array.from(protyle.wysiwyg.element.querySelectorAll(
                `[data-node-id="${id}"]`
            )).find(element => {
                return getViewFoldOccurrenceID(protyle, element) === candidate.occurrenceID;
            });
            return {...candidate, element: connectedElement || candidate.element};
        }
        return {
            ...candidate,
            element: protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) || candidate.element,
        };
    });
    if (foldCandidates.length === 0) {
        return;
    }

    // 任一候选块未折叠时执行全部折叠；全部已折叠时执行全部展开。
    let isFoldAll = foldCandidates.some(item => item.element.getAttribute("fold") !== "1");
    // 单个入口已折叠时以展开入口为准，后代状态不影响操作方向。
    if (isFoldAll && nodeElements.length === 1 && nodeElements[0].getAttribute("fold") === "1") {
        isFoldAll = false;
    }
    // 内层状态需要先写入内核，外层标题最后展开时返回的 DOM 才能包含后代块的最终折叠状态。
    const candidatesToProcess = Array.from(foldCandidates).reverse();
    const scrollElement = (isFoldAll ? candidatesToProcess : foldCandidates)
        .find(candidate => candidate.element.isConnected)?.element;

    if (hasViewFoldContext(protyle)) {
        candidatesToProcess.forEach(candidate => {
            const element = candidate.element;
            if (element.isConnected) {
                setViewFold(protyle, element, isFoldAll);
            } else {
                setViewFoldState(
                    protyle,
                    candidate.occurrenceID,
                    element.getAttribute("data-node-id"),
                    isFoldAll,
                );
            }
        });
        preventScroll(protyle);
        if (scrollElement) {
            scrollCenter(protyle, scrollElement);
        }
        return;
    }

    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    candidatesToProcess.forEach(({element}) => {
        const hasFold = element.getAttribute("fold") === "1";
        if ((isFoldAll && hasFold) || (!isFoldAll && !hasFold)) {
            return;
        }
        const id = element.getAttribute("data-node-id");
        if (element.getAttribute("data-type") === "NodeHeading") {
            doOperations.push({
                action: isFoldAll ? "foldHeading" : "unfoldHeading",
                id,
            });
            undoOperations.push({
                action: isFoldAll ? "unfoldHeading" : "foldHeading",
                id,
            });
        } else {
            doOperations.push({
                action: "setAttrs",
                id,
                data: JSON.stringify({fold: isFoldAll ? "1" : ""}),
            });
            undoOperations.push({
                action: "setAttrs",
                id,
                data: JSON.stringify({fold: isFoldAll ? "" : "1"}),
            });
        }
        if (element.isConnected) {
            applyFoldState(protyle, element, isFoldAll);
        }
    });

    if (doOperations.length > 0) {
        transaction(protyle, doOperations, undoOperations);
        preventScroll(protyle);
        if (scrollElement) {
            scrollCenter(protyle, scrollElement);
        }
    }
};

const recursiveFoldingProtyles = new WeakSet<IProtyle>();

export const foldBlocksRecursively = async (protyle: IProtyle, nodeElements: Element[]) => {
    if (recursiveFoldingProtyles.has(protyle)) {
        return;
    }

    recursiveFoldingProtyles.add(protyle);
    try {
        await foldBlocksRecursively0(protyle, nodeElements);
    } catch (error) {
        console.error(error);
    } finally {
        recursiveFoldingProtyles.delete(protyle);
    }
};

export const getFoldBlock = (protyle: IProtyle, nodeElement: HTMLElement, cb: (elements: Element[]) => void) => {
    const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectElements.length > 0) {
        cb(selectElements);
    } else if (nodeElement) {
        if (nodeElement.parentElement.getAttribute("data-type") === "NodeListItem") {
            if (nodeElement.parentElement.childElementCount > 3) {
                cb([nodeElement.parentElement]);
            } else {
                cb([nodeElement]);
            }
        } else if (nodeElement.getAttribute("data-type") === "NodeHeading") {
            cb([nodeElement]);
        } else {
            cb([getTopAloneElement(nodeElement)]);
        }
    }
    return true;
};

export const setFoldById = (data: {
    id: string;
    currentNodeID: string;
}, protyle: IProtyle) => {
    const elements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.id}"]`);
    for (const item of Array.from(elements)) {
        if (isInEmbedBlock(item)) {
            continue;
        }
        const operations = setFold(protyle, item, true, false, true, true);
        const firstOperation = operations.doOperations?.[0];
        if (firstOperation) {
            firstOperation.context = {focusId: data.currentNodeID};
        }
        transaction(protyle, operations.doOperations, operations.undoOperations);
        break;
    }
};
