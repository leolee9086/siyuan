/**
 * listRouter Transform 执行器辅助函数
 *
 * 本文件包含列表转换操作的辅助函数
 */

import { turnsIntoOneTransaction, turnsOneInto } from "../transaction";
import type { ListCommand } from "./types";
import { logCommandExecution } from "./logger";

/**
 * 获取选中元素列表
 * 如果没有多选元素，返回包含当前元素的数组
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getSelectElements = (
    protyle: IProtyle,
    nodeElement: HTMLElement
): HTMLElement[] => {
    const selectsElement: HTMLElement[] = Array.from(
        protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select") || []
    );
    
    // 如果没有多选元素，使用当前元素作为默认选择
    if (selectsElement.length === 0) {
        selectsElement.push(nodeElement);
    }
    
    return selectsElement;
};

/**
 * 提取元素的类型信息
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const extractElementInfo = (element: HTMLElement | undefined) => {
    if (!element) {
        return { type: null, subType: null, nodeId: null };
    }
    
    return {
        type: element.getAttribute("data-type"),
        subType: element.getAttribute("data-subtype"),
        nodeId: element.getAttribute("data-node-id")
    };
};

/**
 * 执行段落到列表的转换
 */
export const transformParagraphToList = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetType: "Blocks2ULs" | "Blocks2OLs" | "Blocks2TLs",
    event: KeyboardEvent,
    nodeElement: HTMLElement,
    command: ListCommand,
    nodeId: string | null,
    type: string | null
) => {
    await turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: targetType
    });
    
    const typeNames = {
        "Blocks2ULs": "无序列表",
        "Blocks2OLs": "有序列表",
        "Blocks2TLs": "任务列表"
    };
    
    logCommandExecution({
        command,
        event,
        nodeElement,
        result: `段落转换为${typeNames[targetType]}`,
        context: { nodeId, sourceType: type }
    });
};

/**
 * 执行列表类型之间的转换
 */
export const transformListType = async (
    protyle: IProtyle,
    targetElement: HTMLElement,
    nodeId: string,
    transformType: "OL2UL" | "TL2UL" | "UL2OL" | "TL2OL" | "OL2TL" | "UL2TL",
    event: KeyboardEvent,
    nodeElement: HTMLElement,
    command: ListCommand,
    subType: string | null,
    description: string
) => {
    await turnsOneInto({
        protyle,
        nodeElement: targetElement,
        id: nodeId,
        type: transformType
    });
    
    logCommandExecution({
        command,
        event,
        nodeElement,
        result: description,
        context: { nodeId, sourceSubtype: subType }
    });
};

/**
 * 执行批量转换
 */
export const transformBatch = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetType: "Blocks2ULs" | "Blocks2OLs" | "Blocks2TLs",
    event: KeyboardEvent,
    nodeElement: HTMLElement,
    command: ListCommand
) => {
    await turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: targetType
    });
    
    const typeNames = {
        "Blocks2ULs": "无序列表",
        "Blocks2OLs": "有序列表",
        "Blocks2TLs": "任务列表"
    };
    
    logCommandExecution({
        command,
        event,
        nodeElement,
        result: `批量转换为${typeNames[targetType]}: ${selectsElement.length} 个元素`,
        context: { selectCount: selectsElement.length }
    });
};
