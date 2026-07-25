/** 用途：编辑器模型类型，判断页签是否为编辑器实例。使用范围：isCurrentEditor 类型检查。解耦评估：同目录 barrel 导出，直接同层导入。 */
import { Editor } from ".";
/** 用途：页签类型定义，判断实例类型。使用范围：isCurrentEditor 类型守卫。解耦评估：通过 imports.ts 转发。 */
/** 用途：按 ID 获取页签实例。使用范围：isCurrentEditor 查找编辑器页签。解耦评估：通过 imports.ts 转发。 */
import { getInstanceById } from "./imports";
/** 用途：布局页签完整领域守卫。使用范围：收窄实例表查询结果。解耦评估：不加载具体 Tab class。 */
import {isLayoutTab} from "./imports";

/**
 * 判断指定块 ID 是否为当前编辑器的选中块
 * @作用 遍历所有激活窗口中的焦点页签，检查是否有与指定 blockId 匹配的编辑器
 * @意图 供需要判断当前编辑状态的模块使用（如更新大纲、反向链接等）
 * @调用时机 用户切换焦点或执行需要判断当前编辑器的操作时
 * @同步豁免: 生命周期 — 在同步 DOM 查询中判断当前编辑器状态
 */
export const isCurrentEditor = (blockId: string) => {
    const activeElements: Element[] = [];
    const classActiveElement = document.querySelector(".layout__wnd--active > .fn__flex > .layout-tab-bar > .item--focus");
    if (classActiveElement) {
        activeElements.push(classActiveElement);
    }
    const wndElement = document.activeElement?.closest('div[data-type="wnd"]');
    // 收集激活窗口中的焦点页签，避免重复
    const activeTabElement = wndElement?.querySelector(".layout-tab-bar > .item--focus");
    // 如果找到焦点页签且未在已收集列表中，则加入
    if (wndElement && activeTabElement && !activeElements.includes(activeTabElement)) {
        activeElements.push(activeTabElement);
    }
    if (activeElements.length === 0) {
        return false;
    }
    for (const activeElement of activeElements) {
        const tabDataID = activeElement.getAttribute("data-id");
        if (!tabDataID) {
            continue;
        }
        const tab = getInstanceById(tabDataID);
        // 检查页签是否为编辑器实例，并匹配目标 blockId
        if (isLayoutTab(tab) && tab.model instanceof Editor && (
            tab.model.editor.protyle.block.rootID === blockId ||
            tab.model.editor.protyle.block.parentID === blockId ||
            tab.model.editor.protyle.block.id === blockId
        )) {
            return true;
        }
    }
    return false;
};
