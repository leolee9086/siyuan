import type { Wnd } from "./Wnd";
import type { Tab } from "./Tab";
import type { Layout } from "./index";
import { hasClosestBlock } from "../protyle/util/hasClosest";
import { focusByOffset, getSelectionOffset } from "../protyle/util/selection";

import { isElectron } from "../platform";
import { setTabPosition } from "../window/setHeader";
import { getAllWnds } from "./getAll";
import type { IEditorRangeData } from "./window-utils.types";
import { isEditorTab } from "./window-utils.guard";
export {getWndByLayout} from "./query/layoutInstance";

/**
 * 从编辑器标签页中收集选区位置信息
 *
 * 在DOM移动前调用，用于保存编辑器中选区的位置信息，以便后续恢复。
 * 因为DOM移动会导致range失效，所以需要预先保存这些位置数据。
 *
 * @param tab - 需要收集选区信息的标签页
 * @returns 选区位置数据，如果该标签页没有有效选区则返回undefined
 */
function collectEditorRange(tab: Tab): IEditorRangeData | undefined {
    // 检查标签页模型是否为编辑器类型
    if (!isEditorTab(tab)) {
        return undefined;
    }

    const editor = tab.model.editor;
    const toolbar = editor.protyle.toolbar;

    // 检查编辑器工具栏是否存在
    if (!toolbar) {
        return undefined;
    }

    const toolbarRange = toolbar.range;

    // 检查编辑器工具栏是否有有效的range对象
    if (!toolbarRange) {
        return undefined;
    }

    // 查找包含选区起始位置的块元素
    const blockElement = hasClosestBlock(toolbarRange.startContainer);
    if (!blockElement) {
        return undefined;
    }

    // 获取选区在块元素内的偏移量
    const startEnd = getSelectionOffset(blockElement, undefined, toolbarRange);

    // 返回收集到的选区位置数据
    return {
        id: blockElement.getAttribute("data-node-id") || "",
        start: startEnd.start,
        end: startEnd.end,
    };
}

/**
 * 恢复编辑器的选区位置
 *
 * 在DOM移动后调用，根据之前保存的位置数据恢复编辑器选区。
 *
 * @param tab - 需要恢复选区的标签页
 * @param rangeData - 之前保存的选区位置数据
 * @returns 恢复后的Range对象，如果恢复失败则返回undefined
 */
function restoreEditorRange(tab: Tab, rangeData: IEditorRangeData | undefined): Range | undefined {
    // 检查标签页模型是否为编辑器类型
    if (!isEditorTab(tab)) {
        return undefined;
    }

    // 检查是否有有效的位置数据
    if (!rangeData) {
        return undefined;
    }

    const editor = tab.model.editor;
    const wysiwyg = editor.protyle.wysiwyg;

    // 检查wysiwyg是否存在
    if (!wysiwyg) {
        return undefined;
    }

    // 在编辑器中查找对应的数据节点
    const targetElement = wysiwyg.element.querySelector(
        `[data-node-id="${rangeData.id}"]`
    );

    // 检查目标元素是否存在
    if (!targetElement) {
        return undefined;
    }

    // 使用偏移量恢复选区
    const range = focusByOffset(targetElement, rangeData.start, rangeData.end);

    // focusByOffset返回false或Range，需要过滤false值
    if (range === false) {
        return undefined;
    }

    return range;
}

/**
 * 交换两个窗口在父容器中的位置
 *
 * 同时交换它们的resize属性，保持窗口大小设置的一致性。
 *
 * @param newWnd - 新窗口
 */
function swapWindowPositions(newWnd: Wnd): void {
    // 检查parent是否存在
    const parent = newWnd.parent;
    if (!parent) {
        return;
    }

    // 查找新窗口在父容器中的索引位置
    const index = parent.children.findIndex((item) => item.id === newWnd.id);

    // 检查是否找到有效索引
    if (index === -1 || index === 0) {
        return;
    }

    // 获取当前元素和前一个元素
    const currentItem = parent.children[index];
    const previousItem = parent.children[index - 1];

    // 检查元素是否存在
    if (!currentItem || !previousItem) {
        return;
    }

    // 交换resize属性
    const tempResize = currentItem.resize;
    currentItem.resize = previousItem.resize;
    previousItem.resize = tempResize;

    // 交换数组中的元素位置
    parent.children[index] = previousItem;
    parent.children[index - 1] = currentItem;
}

/**
 * 更新编辑器工具栏的range
 *
 * @param tab - 编辑器标签页
 * @param range - 需要设置的range对象
 */
function updateEditorToolbarRange(tab: Tab, range: Range): void {
    if (!isEditorTab(tab)) {
        return;
    }

    const toolbar = tab.model.editor.protyle.toolbar;
    if (!toolbar) {
        return;
    }

    toolbar.range = range;
}

/**
 * 切换两个窗口的位置
 *
 * 该函数用于在布局中交换两个窗口的位置，同时保持编辑器中选区的有效性。
 * 主要操作包括：
 * 1. 保存目标窗口中所有编辑器的选区位置
 * 2. 移动DOM元素（交换窗口位置）
 * 3. 移动分隔线元素
 * 4. 交换窗口在父容器数组中的位置
 * 5. 恢复编辑器的选区位置
 * 6. 更新标签页位置（非浏览器环境）
 *
 * 在以下场景调用：
 * - 用户通过拖拽或其他方式交换窗口位置时
 * - 布局调整需要重新排列窗口时
 *
 * @同步豁免: 需要绝对同步的DOM访问
 *
 * @param newWnd - 新窗口（将被移动到目标窗口之后）
 * @param targetWnd - 目标窗口（将被移动到新窗口之前）
 */
export function switchWnd(newWnd: Wnd, targetWnd: Wnd): void {
    // 阶段1：在DOM移动前收集所有编辑器的选区位置信息
    // DOM移动会导致range失效，因此必须在移动前保存位置
    const rangeDatas: IEditorRangeData[] = [];

    for (const tab of targetWnd.children) {
        const rangeData = collectEditorRange(tab);
        if (rangeData) {
            rangeDatas.push(rangeData);
        }
    }

    // 阶段2：执行DOM元素位置交换
    // 将目标窗口移动到新窗口之后
    newWnd.element.after(targetWnd.element);

    // 阶段3：恢复所有编辑器的选区位置
    let rangeIndex = 0;
    for (const tab of targetWnd.children) {
        // 跳过非编辑器标签页
        if (!isEditorTab(tab)) {
            continue;
        }

        const rangeData = rangeDatas[rangeIndex];
        rangeIndex += 1;

        // 如果没有对应的位置数据，跳过恢复
        if (!rangeData) {
            continue;
        }

        const range = restoreEditorRange(tab, rangeData);

        // 成功恢复选区后，更新编辑器工具栏的range引用
        if (range) {
            updateEditorToolbarRange(tab, range);
        }
    }

    // 阶段4：移动分隔线元素到正确位置
    const separator = newWnd.element.previousElementSibling;
    if (separator) {
        newWnd.element.after(separator);
    }

    // 阶段5：交换窗口在父容器中的数组位置
    swapWindowPositions(newWnd);

    // 阶段6：更新标签页位置（仅在非浏览器环境中执行）
    if (isElectron) {
        setTabPosition();
    }
}

/**
 * 比较两个窗口的活跃时间
 *
 * 用于排序函数，比较两个窗口中激活标签页的活跃时间。
 *
 * @param a - 第一个窗口
 * @param b - 第二个窗口
 * @returns 比较结果，-1表示a更活跃，0表示相等或无法比较
 */
