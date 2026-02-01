/**
 * listRouter Transform 状态提取函数
 * 
 * 本文件包含列表转换操作的状态提取逻辑
 * 由于 transform 状态提取较为复杂，单独拆分为独立模块
 */

import { matchHotKey } from "../../util/hotKey";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { TransformState } from "./types";

/**
 * 检查选中元素是否连续
 */
const checkContinuousSelection = (selectElements: NodeListOf<Element>): boolean => {
    for (let i = 0; i < selectElements.length - 1; i++) {
        const currentItem = selectElements[i];
        const nextItem = selectElements[i + 1];
        
        if (!currentItem || !nextItem) {
            continue;
        }
        
        if (currentItem.nextElementSibling && nextItem !== currentItem.nextElementSibling) {
            return false;
        }
    }
    return true;
};

/**
 * 检查选中元素中是否包含列表项
 */
const checkHasListItem = (selectElements: NodeListOf<Element>): boolean => {
    for (let i = 0; i < selectElements.length; i++) {
        const element = selectElements[i];
        // 检查元素是否是列表项（li 类）
        // 这用于判断是否可以对选中内容进行列表转换操作
        if (element?.classList.contains("li")) {
            return true;
        }
    }
    return false;
};

/**
 * 解析块类型
 */
const parseBlockType = (dataType: string): "NodeParagraph" | "NodeList" | "NodeHeading" | "other" => {
    // 根据 data-type 属性判断块的类型
    // 这决定了可以进行哪些类型的转换操作
    if (dataType === "NodeParagraph") {
        return "NodeParagraph";
    }
    if (dataType === "NodeList") {
        return "NodeList";
    }
    if (dataType === "NodeHeading") {
        return "NodeHeading";
    }
    return "other";
};

/**
 * 解析列表子类型
 */
const parseListSubtype = (dataSubtype: string): "u" | "o" | "t" | null => {
    // 根据 data-subtype 属性判断列表的子类型
    // u: 无序列表, o: 有序列表, t: 任务列表
    if (dataSubtype === "u" || dataSubtype === "o" || dataSubtype === "t") {
        return dataSubtype;
    }
    return null;
};

/**
 * 提取快捷键状态
 */
const extractHotKeyStates = (event: KeyboardEvent) => {
    const config = getSiyuanConfig();
    const insertKeymap = config.keymap?.editor?.insert;
    
    const isListKey = insertKeymap?.list?.custom 
        ? matchHotKey(insertKeymap.list.custom, event) 
        : false;
    
    const orderedListKeymap = insertKeymap ? insertKeymap["ordered-list"] : undefined;
    const isOListKey = orderedListKeymap?.custom 
        ? matchHotKey(orderedListKeymap.custom, event) 
        : false;
    
    const isCheckKey = insertKeymap?.check?.custom 
        ? matchHotKey(insertKeymap.check.custom, event) 
        : false;
    
    const isQuoteKey = insertKeymap?.quote?.custom 
        ? matchHotKey(insertKeymap.quote.custom, event) 
        : false;
    
    return { isListKey, isOListKey, isCheckKey, isQuoteKey };
};

/**
 * 提取列表转换状态（Phase 4）
 *
 * 用途：从键盘事件和 Protyle 实例中提取列表类型转换所需的状态
 * 使用场景：在 listTransformMiddleware 中调用，用于路由决策
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const extractTransformState = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement
): TransformState => {
    const hotKeyStates = extractHotKeyStates(event);
    
    // 安全检查：确保 wysiwyg 存在
    if (!protyle.wysiwyg) {
        return {
            ...hotKeyStates,
            isSingleSelect: true,
            isContinuousSelection: false,
            hasListItem: false,
            currentType: "other",
            currentSubtype: null
        };
    }
    
    // 获取选中的元素
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    const selectCount = selectElements.length;
    
    // 判断是否单选（selectCount <= 1）
    const isSingleSelect = selectCount <= 1;
    
    // 检查选中元素是否连续
    const isContinuousSelection = selectCount > 0
        ? checkContinuousSelection(selectElements)
        : false;
    
    // 检查是否包含列表项
    const hasListItem = checkHasListItem(selectElements);
    
    // 确定当前块类型和子类型
    const targetElement = selectCount === 1 ? selectElements[0] : nodeElement;
    const dataType = targetElement?.getAttribute("data-type") || "";
    const dataSubtype = targetElement?.getAttribute("data-subtype") || "";
    
    const currentType = parseBlockType(dataType);
    const currentSubtype = parseListSubtype(dataSubtype);
    
    return {
        ...hotKeyStates,
        isSingleSelect,
        isContinuousSelection,
        hasListItem,
        currentType,
        currentSubtype
    };
};
