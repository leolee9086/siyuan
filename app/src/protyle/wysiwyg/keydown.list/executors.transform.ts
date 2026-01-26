/**
 * listRouter Transform 执行器
 *
 * 本文件包含列表转换操作的执行器函数
 * 由于 transform 执行器较为复杂，单独拆分为独立模块
 */

import { turnsIntoOneTransaction } from "../transaction";
import { LIST_COMMANDS } from "./commands";
import type { CommandExecutor } from "./types";
import { logCommandExecution } from "./logger";
import {
    getSelectElements,
    extractElementInfo,
    transformParagraphToList,
    transformListType,
    transformBatch
} from "./executors.transform.helpers";

/**
 * 处理单选场景的无序列表转换
 */
const handleSingleSelectToUL = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetElement: HTMLElement,
    type: string | null,
    subType: string | null,
    nodeId: string | null,
    event: KeyboardEvent,
    nodeElement: HTMLElement
) => {
    // 段落转换为无序列表
    if (type === "NodeParagraph") {
        await transformParagraphToList(
            protyle, selectsElement, "Blocks2ULs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL, nodeId, type
        );
        return;
    }
    
    // 列表类型转换：需要 nodeId 存在
    if (type !== "NodeList" || !nodeId) {
        return;
    }
    
    // 有序列表 -> 无序列表
    if (subType === "o") {
        await transformListType(
            protyle, targetElement, nodeId, "OL2UL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL, subType,
            "有序列表转换为无序列表"
        );
        return;
    }
    
    // 任务列表 -> 无序列表
    if (subType === "t") {
        await transformListType(
            protyle, targetElement, nodeId, "TL2UL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL, subType,
            "任务列表转换为无序列表"
        );
    }
};

/**
 * 执行转换为无序列表命令（Phase 4）
 */
const executeTransformToUL: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const isSingleSelect = selectsElement.length === 1;
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type, subType, nodeId } = extractElementInfo(targetElement);
    
    // 单选场景
    if (isSingleSelect) {
        await handleSingleSelectToUL(
            protyle, selectsElement, targetElement,
            type, subType, nodeId, event, nodeElement
        );
    }
    
    // 多选场景：批量转换为无序列表
    if (!isSingleSelect) {
        await transformBatch(
            protyle, selectsElement, "Blocks2ULs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_UL
        );
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表转换为无序列表操作");
};

/**
 * 处理单选场景的有序列表转换
 */
const handleSingleSelectToOL = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetElement: HTMLElement,
    type: string | null,
    subType: string | null,
    nodeId: string | null,
    event: KeyboardEvent,
    nodeElement: HTMLElement
) => {
    // 段落转换为有序列表
    if (type === "NodeParagraph") {
        await transformParagraphToList(
            protyle, selectsElement, "Blocks2OLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL, nodeId, type
        );
        return;
    }
    
    // 列表类型转换：需要 nodeId 存在
    if (type !== "NodeList" || !nodeId) {
        return;
    }
    
    // 无序列表 -> 有序列表
    if (subType === "u") {
        await transformListType(
            protyle, targetElement, nodeId, "UL2OL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL, subType,
            "无序列表转换为有序列表"
        );
        return;
    }
    
    // 任务列表 -> 有序列表
    if (subType === "t") {
        await transformListType(
            protyle, targetElement, nodeId, "TL2OL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL, subType,
            "任务列表转换为有序列表"
        );
    }
};

/**
 * 执行转换为有序列表命令（Phase 4）
 */
const executeTransformToOL: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const isSingleSelect = selectsElement.length === 1;
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type, subType, nodeId } = extractElementInfo(targetElement);
    
    // 单选场景
    if (isSingleSelect) {
        await handleSingleSelectToOL(
            protyle, selectsElement, targetElement,
            type, subType, nodeId, event, nodeElement
        );
    }
    
    // 多选场景：批量转换为有序列表
    if (!isSingleSelect) {
        await transformBatch(
            protyle, selectsElement, "Blocks2OLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_OL
        );
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表转换为有序列表操作");
};

/**
 * 处理单选场景的任务列表转换
 */
const handleSingleSelectToTL = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetElement: HTMLElement,
    type: string | null,
    subType: string | null,
    nodeId: string | null,
    event: KeyboardEvent,
    nodeElement: HTMLElement
) => {
    // 段落转换为任务列表
    if (type === "NodeParagraph") {
        await transformParagraphToList(
            protyle, selectsElement, "Blocks2TLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL, nodeId, type
        );
        return;
    }
    
    // 列表类型转换：需要 nodeId 存在
    if (type !== "NodeList" || !nodeId) {
        return;
    }
    
    // 无序列表 -> 任务列表（注意：原代码中 u + isCheckKey 使用的是 OL2TL）
    if (subType === "u") {
        await transformListType(
            protyle, targetElement, nodeId, "OL2TL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL, subType,
            "无序列表转换为任务列表"
        );
        return;
    }
    
    // 有序列表 -> 任务列表（注意：原代码中 o + isCheckKey 使用的是 UL2TL）
    if (subType === "o") {
        await transformListType(
            protyle, targetElement, nodeId, "UL2TL",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL, subType,
            "有序列表转换为任务列表"
        );
    }
};

/**
 * 执行转换为任务列表命令（Phase 4）
 */
const executeTransformToTL: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const isSingleSelect = selectsElement.length === 1;
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type, subType, nodeId } = extractElementInfo(targetElement);
    
    // 单选场景
    if (isSingleSelect) {
        await handleSingleSelectToTL(
            protyle, selectsElement, targetElement,
            type, subType, nodeId, event, nodeElement
        );
    }
    
    // 多选场景：批量转换为任务列表
    if (!isSingleSelect) {
        await transformBatch(
            protyle, selectsElement, "Blocks2TLs",
            event, nodeElement, LIST_COMMANDS.TRANSFORM_TO_TL
        );
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表转换为任务列表操作");
};

/**
 * 执行转换为引用命令（Phase 4）
 */
const executeTransformToQuote: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectsElement = getSelectElements(protyle, nodeElement);
    const targetElement = selectsElement[0];
    
    if (!targetElement) {
        return;
    }
    
    const { type } = extractElementInfo(targetElement);
    
    // 只有段落、标题、列表可以转换为引用
    const canTransformToQuote = ["NodeHeading", "NodeParagraph", "NodeList"].includes(type || "");
    
    if (canTransformToQuote) {
        await turnsIntoOneTransaction({
            protyle,
            selectsElement,
            type: "Blocks2Blockquote"
        });
        
        const result = selectsElement.length === 1 
            ? `${type} 转换为引用块` 
            : `批量转换为引用块: ${selectsElement.length} 个元素`;
        
        logCommandExecution({
            command: LIST_COMMANDS.TRANSFORM_TO_QUOTE,
            event,
            nodeElement,
            result,
            context: { 
                selectCount: selectsElement.length,
                sourceType: type
            }
        });
    }
    
    // 其他类型：使用 hint 插入引用标记（需要 hint 存在）
    if (!canTransformToQuote && protyle.hint) {
        protyle.hint.splitChar = "/";
        protyle.hint.lastIndex = -1;
        protyle.hint.fill(">" + Lute.Caret, protyle);
        
        logCommandExecution({
            command: LIST_COMMANDS.TRANSFORM_TO_QUOTE,
            event,
            nodeElement,
            result: "插入引用标记（通过 hint）",
            context: { sourceType: type }
        });
    }
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("转换为引用块操作");
};

/**
 * Transform 执行器映射表
 */
export const transformExecutors = {
    [LIST_COMMANDS.TRANSFORM_TO_UL]: executeTransformToUL,
    [LIST_COMMANDS.TRANSFORM_TO_OL]: executeTransformToOL,
    [LIST_COMMANDS.TRANSFORM_TO_TL]: executeTransformToTL,
    [LIST_COMMANDS.TRANSFORM_TO_QUOTE]: executeTransformToQuote
};
