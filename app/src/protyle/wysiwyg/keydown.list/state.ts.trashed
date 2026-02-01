/**
 * listRouter 状态提取函数
 *
 * 本文件包含从事件和 DOM 中提取决策所需状态的纯函数
 * 状态提取函数应该是纯函数，无副作用，易于测试
 */

import { matchHotKey } from "../../util/hotKey";
import { hasClosestByAttribute } from "../../util/hasClosest";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { CheckToggleState, OutdentState, IndentState, TransformState } from "./types";

/**
 * 提取任务列表切换状态（Phase 1）
 *
 * 用途：从键盘事件和 Range 对象中提取任务列表切换所需的状态
 * 使用场景：在 listCheckToggleMiddleware 中调用，用于路由决策
 *
 * @param event - 键盘事件对象
 * @param range - 当前选区对象
 * @returns CheckToggleState - 包含快捷键匹配和任务列表项检测结果的状态对象
 *
 * 状态字段说明：
 * - isCheckToggleKey: 是否按下任务列表切换快捷键
 * - hasTaskItem: 光标是否在任务列表项中（data-subtype="t"）
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 Range 对象的 startContainer 属性
 * 2. 需要同步遍历 DOM 树查找祖先元素
 * 3. 作为路由决策的输入，必须在事件处理的同一帧内完成
 * 4. 异步化会导致 DOM 状态不一致和竞态条件
 */
export const extractCheckToggleState = (
    event: KeyboardEvent,
    range: Range
): CheckToggleState => {
    // 检查是否按下任务列表切换快捷键
    const isCheckToggleKey = matchHotKey(
        getSiyuanConfig().keymap.editor.list.checkToggle.custom,
        event
    );
    
    // 检查光标是否在任务列表项中
    // 通过查找最近的具有 data-subtype="t" 属性的祖先元素来判断
    const taskItemElement = hasClosestByAttribute(
        range.startContainer,
        "data-subtype",
        "t"
    );
    const hasTaskItem = !!taskItemElement;
    
    return {
        isCheckToggleKey,
        hasTaskItem
    };
};

/**
 * 检查选中元素是否连续
 *
 * 用途：判断多个选中的元素在 DOM 树中是否相邻
 * 使用场景：在列表操作中，只有连续选中的元素才能批量操作
 *
 * @param selectElements - 选中的元素列表
 * @returns 是否连续
 */
const checkContinuousSelection = (selectElements: NodeListOf<Element>): boolean => {
    // 遍历所有选中元素，检查相邻性
    for (let i = 0; i < selectElements.length - 1; i++) {
        const currentItem = selectElements[i];
        const nextItem = selectElements[i + 1];
        
        // 安全检查：确保当前元素和下一个元素都存在
        if (!currentItem || !nextItem) {
            continue;
        }
        
        // 检查下一个选中元素是否就是当前元素的下一个兄弟
        // 如果当前元素有下一个兄弟，但下一个选中元素不是它，说明选中不连续
        if (currentItem.nextElementSibling && nextItem !== currentItem.nextElementSibling) {
            return false;
        }
    }
    return true;
};

/**
 * 提取列表缩出状态（Phase 2）
 *
 * 用途：从键盘事件和 Protyle 实例中提取列表缩出所需的状态
 * 使用场景：在 listOutdentMiddleware 中调用，用于路由决策
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @returns OutdentState - 包含快捷键匹配和列表项检测结果的状态对象
 *
 * 状态字段说明：
 * - isOutdentKey: 是否按下列表缩出快捷键
 * - hasSelectElements: 是否有多选元素
 * - isContinuousSelection: 多选元素是否连续
 * - isFirstSelectInList: 第一个选中元素是否在列表中
 * - isInListItem: 当前元素是否在列表项中
 * - isInCodeBlock: 当前元素是否在代码块中
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 DOM 元素的属性和类名
 * 2. 需要同步遍历 DOM 树查找选中元素
 * 3. 作为路由决策的输入，必须在事件处理的同一帧内完成
 * 4. 异步化会导致 DOM 状态不一致和竞态条件
 */
export const extractOutdentState = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement
): OutdentState => {
    // 检查是否按下列表缩出快捷键
    const isOutdentKey = matchHotKey(
        getSiyuanConfig().keymap.editor.list.outdent.custom,
        event
    );
    
    // 安全检查：确保 wysiwyg 存在
    if (!protyle.wysiwyg) {
        return {
            isOutdentKey,
            hasSelectElements: false,
            isContinuousSelection: false,
            isFirstSelectInList: false,
            isInListItem: false,
            isInCodeBlock: false
        };
    }
    
    // 获取所有选中的元素
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    const hasSelectElements = selectElements.length > 0;
    
    // 检查选中元素是否连续
    const isContinuousSelection = hasSelectElements
        ? checkContinuousSelection(selectElements)
        : false;
    
    // 检查第一个选中元素是否在列表中
    let isFirstSelectInList = false;
    // 只有当存在选中元素且第一个元素有效时，才检查其是否在列表中
    // 这是为了避免访问空数组导致的错误
    if (hasSelectElements && selectElements[0]) {
        const firstElement = selectElements[0];
        isFirstSelectInList =
            firstElement.classList.contains("li") ||
            (firstElement.parentElement?.classList.contains("li") ?? false);
    }
    
    // 检查当前元素是否在列表项中
    const isInListItem = nodeElement.parentElement?.classList.contains("li") ?? false;
    
    // 检查当前元素是否在代码块中
    const isInCodeBlock = nodeElement.getAttribute("data-type") === "NodeCodeBlock";
    
    return {
        isOutdentKey,
        hasSelectElements,
        isContinuousSelection,
        isFirstSelectInList,
        isInListItem,
        isInCodeBlock
    };
};

/**
 * 提取列表缩进状态（Phase 3）
 *
 * 用途：从键盘事件和 Protyle 实例中提取列表缩进所需的状态
 * 使用场景：在 listIndentMiddleware 中调用，用于路由决策
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @returns IndentState - 包含快捷键匹配和列表项检测结果的状态对象
 *
 * 状态字段说明：
 * - isIndentKey: 是否按下列表缩进快捷键
 * - hasSelectElements: 是否有多选元素
 * - isContinuousSelection: 多选元素是否连续
 * - isFirstSelectInList: 第一个选中元素是否在列表中
 * - isInListItem: 当前元素是否在列表项中
 * - isInCodeBlock: 当前元素是否在代码块中
 * - hasPreviousSibling: 是否有前一个兄弟元素（缩进需要）
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 DOM 元素的属性和类名
 * 2. 需要同步遍历 DOM 树查找选中元素
 * 3. 作为路由决策的输入，必须在事件处理的同一帧内完成
 * 4. 异步化会导致 DOM 状态不一致和竞态条件
 */
export const extractIndentState = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement
): IndentState => {
    // 检查是否按下列表缩进快捷键
    const isIndentKey = matchHotKey(
        getSiyuanConfig().keymap.editor.list.indent.custom,
        event
    );
    
    // 安全检查：确保 wysiwyg 存在
    if (!protyle.wysiwyg) {
        return {
            isIndentKey,
            hasSelectElements: false,
            isContinuousSelection: false,
            isFirstSelectInList: false,
            isInListItem: false,
            isInCodeBlock: false,
            hasPreviousSibling: false
        };
    }
    
    // 获取所有选中的元素
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    const hasSelectElements = selectElements.length > 0;
    
    // 检查选中元素是否连续
    const isContinuousSelection = hasSelectElements
        ? checkContinuousSelection(selectElements)
        : false;
    
    // 检查第一个选中元素是否在列表中
    let isFirstSelectInList = false;
    // 只有当存在选中元素且第一个元素有效时，才检查其是否在列表中
    // 这是为了避免访问空数组导致的错误
    if (hasSelectElements && selectElements[0]) {
        const firstElement = selectElements[0];
        isFirstSelectInList =
            firstElement.classList.contains("li") ||
            (firstElement.parentElement?.classList.contains("li") ?? false);
    }
    
    // 检查当前元素是否在列表项中
    const isInListItem = nodeElement.parentElement?.classList.contains("li") ?? false;
    
    // 检查当前元素是否在代码块中
    const isInCodeBlock = nodeElement.getAttribute("data-type") === "NodeCodeBlock";
    
    // 检查是否有前一个兄弟元素（缩进需要有前一个元素作为父级）
    const hasPreviousSibling = !!(nodeElement.parentElement?.previousElementSibling);
    
    return {
        isIndentKey,
        hasSelectElements,
        isContinuousSelection,
        isFirstSelectInList,
        isInListItem,
        isInCodeBlock,
        hasPreviousSibling
    };
};

/**
 * Phase 4: 列表转换状态提取（已移至 state.transform.ts）
 *
 * 由于 transform 状态提取逻辑较为复杂，已拆分到独立模块
 * 请从 state.transform.ts 导入 extractTransformState
 */
export { extractTransformState } from "./state.transform";
