import {fetchPost} from "../../util/network/fetch";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {mathRender} from "../render/mathRender";
import {focusBlock} from "../util/selection";
import {transaction} from "../wysiwyg/transaction/submit";
import {getSameContainerHeadingLevel} from "./multiSelect";

export interface IMultipleHeadingTransformDependencies {
    fetchPost: (url: string, data: {ids: string[]; level: number}, callback: (response: IWebSocketData) => void) => unknown;
    focusBlock: (element: Element, root: HTMLElement, preserveSelection: boolean) => void;
    mathRender: (element: Element) => void;
    transaction: (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => void;
    labelForLevel: (level: number) => string;
}

const defaultDependencies: IMultipleHeadingTransformDependencies = {
    fetchPost: (url, data, callback) => fetchPost(url, data, callback),
    focusBlock,
    mathRender,
    transaction,
    labelForLevel: (level) => siyuanI18n[`heading${level}` as keyof typeof siyuanI18n] as string,
};

const getSelectedHeadingIDs = (selectsElement: Element[]) => {
    const ids = selectsElement.map((element) => element.getAttribute("data-node-id"));
    return ids.every((id): id is string => Boolean(id)) ? ids : [];
};

const applyMultipleHeadingLevelTransaction = (
    protyle: IProtyle,
    ids: string[],
    response: IWebSocketData,
    dependencies: IMultipleHeadingTransformDependencies,
) => {
    const doOperations = response.data?.doOperations as IOperation[] | undefined;
    if (!doOperations?.length) {
        return;
    }
    const wysiwygElement = protyle.wysiwyg?.element;
    if (!wysiwygElement) {
        return;
    }

    for (const operation of doOperations) {
        wysiwygElement.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement) => {
            (itemElement as HTMLElement).outerHTML = operation.data as string;
        });
        wysiwygElement.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement) => {
            dependencies.mathRender(itemElement);
        });
    }

    const focusElement = wysiwygElement.querySelector(`[data-node-id="${ids[0]}"]`);
    if (focusElement) {
        dependencies.focusBlock(focusElement, wysiwygElement, true);
    }
    dependencies.transaction(protyle, doOperations, (response.data?.undoOperations ?? []) as IOperation[]);
};

/** 为同一容器、同一等级的多标题生成保留子标题的等级转换菜单。 */
export const buildMultipleHeadingTransformMenu = (
    protyle: IProtyle,
    selectsElement: Element[],
    dependencies: IMultipleHeadingTransformDependencies = defaultDependencies,
): IMenu[] => {
    const headingLevel = getSameContainerHeadingLevel(selectsElement);
    const ids = getSelectedHeadingIDs(selectsElement);
    if (!headingLevel || ids.length !== selectsElement.length) {
        return [];
    }

    const submenu: IMenu[] = [];
    for (let level = 1; level <= 6; level++) {
        if (level === headingLevel) {
            continue;
        }
        submenu.push({
            id: `heading${level}`,
            iconHTML: "",
            icon: `iconHeading${level}`,
            label: dependencies.labelForLevel(level),
            click() {
                dependencies.fetchPost("/api/block/getHeadingLevelTransaction", {ids, level}, (response) => {
                    applyMultipleHeadingLevelTransaction(protyle, ids, response, dependencies);
                });
            },
        });
    }
    return submenu;
};
