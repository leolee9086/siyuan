/**
 * listRouter 状态提取函数
 * 
 * 本文件包含从事件和 DOM 中提取决策所需状态的纯函数
 * 状态提取函数应该是纯函数，无副作用，易于测试
 */

import { matchHotKey } from "../../util/hotKey";
import { hasClosestByAttribute } from "../../util/hasClosest";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { CheckToggleState } from "./types";

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
