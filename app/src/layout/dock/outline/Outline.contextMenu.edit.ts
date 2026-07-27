/**
 * Outline 右键菜单中的编辑相关功能
 * 从 Outline.contextMenu.ts 进一步拆分
 */
import { MenuItem } from "../../../menus/Menu.Item";

import { fetchPost } from "../../../util/network/fetch";
import { focusByWbr } from "../../../protyle/util/selection";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { confirmDialog } from "../../../dialog/confirmDialog";
import { isHTMLElement } from "../dock.guard";
import { 处理标题级别变换响应, genHeadingHTML, 创建插入同级标题后处理器, 创建添加子标题响应处理器, convertBlockToSubDocument } from "./Outline.contextMenu.edit.util";
import type {OutlineDomain} from "./types";
/** 用途：解析 Outline 对应的编辑器与标题块；使用范围：标题级别、插入和子文档菜单动作；解耦评估：直达独立编辑器上下文所有者，不加载剪贴板菜单。 */
import {getProtyleAndBlockElement} from "./editorContext/resolve";

/**
 * 作用：根据标题级别获取对应的文案。
 * 意图：将数字级别转换为可读的本地化字符串。
 * 调用时机：在生成标题转换菜单项时调用。
 */
function 获取标题文案(level: number) {
    const 文案映射: { [key: number]: string } = {
        1: siyuanI18n.heading1,
        2: siyuanI18n.heading2,
        3: siyuanI18n.heading3,
        4: siyuanI18n.heading4,
        5: siyuanI18n.heading5,
        6: siyuanI18n.heading6,
    };
    return 文案映射[level] || "";
}

/** 
 * 生成标题级别转换菜单项 
 * @同步豁免: UI构建
 */
export function genHeadingTransform(outline: OutlineDomain, id: string, level: number): IMenu {
    return {
        id: "heading" + level, iconHTML: "", icon: "iconHeading" + level,
        label: 获取标题文案(level),
        /**
         * 作用：处理标题级别转换菜单项的点击事件。
         * 意图：当用户选择特定的标题级别时，请求后端获取相应的事务数据，并执行标题级别的转换操作。
         * 调用时机：用户在外观大纲（Outline）的上下文菜单中点击“标题 x”选项时。
         * 编辑器查询通过 Outline 已持有的完整应用外观完成。
         */
        click: () => {
            const editItem = outline.app.getOpenModels().editor.find(item => item.editor.protyle.block.rootID === outline.blockId);
            /**
             * 作用：确保找到了对应的编辑器实例。
             * 意图：如果未找到与当前 blockId 关联的编辑器，则中止操作。
             * 生效场景：无法匹配到当前活动的编辑器时。
             */
            if (!editItem) {
                return;
            }
            const editor = editItem.editor;
            const protyle = editor.protyle;
            fetchPost("/api/block/getHeadingLevelTransaction", { id, level }, (response) => {
                /**
                 * 作用：验证响应数据和 Protyle 实例。
                 * 意图：确保后端返回了有效数据且编辑器实例仍然存活。
                 * 生效场景：请求失败、返回空数据或编辑器已被销毁时。
                 */
                if (!protyle || !response.data) {
                    return;
                }
                处理标题级别变换响应(editor, response.data);
            });
        }
    };
}

/** 
 * 生成标题级别转换菜单项 
 * @同步豁免: UI构建
 */
export function appendLevelMenuItems(outline: OutlineDomain, element: HTMLElement, id: string, currentLevel: number) {
    /**
     * 作用：仅在标题级别大于 1 时显示“升级”选项。
     * 意图：一级标题无法再升级，避免显示无用菜单项。
     * 生效场景：当前标题级别为 h2-h6 时。
     */
    if (currentLevel > 1) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "upgrade", icon: "iconUp", label: siyuanI18n.upgrade,
            /**
             * 作用：处理标题升级（减少级别）菜单项的点击事件。
             * 意图：将当前标题块的级别减少一级。
             * 调用时机：用户在菜单中点击“升级”选项时。
             */
            click: () => {
                const data = getProtyleAndBlockElement(outline, element);
                /**
                 * 作用：确保成功获取了 Protyle 实例和块元素。
                 * 意图：执行事务需要依赖有效的 Protyle 上下文和目标元素。
                 * 生效场景：`getProtyleAndBlockElement` 返回有效对象时。
                 */
                if (data) {
                    data.editor.turnElementsIntoTransaction([data.blockElement], "Blocks2Hs", currentLevel - 1);
                }
            }
        }).element);
    }
    /**
     * 作用：仅在标题级别小于 6 时显示“降级”选项。
     * 意图：六级标题无法再降级，避免显示无用菜单项。
     * 生效场景：当前标题级别为 h1-h5 时。
     */
    if (currentLevel < 6) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "downgrade", icon: "iconDown", label: siyuanI18n.downgrade,
            /**
             * 作用：处理标题降级（增加级别）菜单项的点击事件。
             * 意图：将当前标题块的级别增加一级。
             * 调用时机：用户在菜单中点击“降级”选项时。
             */
            click: () => {
                const data = getProtyleAndBlockElement(outline, element);
                /**
                 * 作用：确保成功获取了 Protyle 实例和块元素。
                 * 意图：执行事务需要依赖有效的 Protyle 上下文和目标元素。
                 * 生效场景：`getProtyleAndBlockElement` 返回有效对象时。
                 */
                if (data) {
                    data.editor.turnElementsIntoTransaction([data.blockElement], "Blocks2Hs", currentLevel + 1);
                }
            }
        }).element);
    }
    const headingSubMenu = [];
    for (let i = 1; i <= 6; i++) {
        /**
         * 作用：排除当前已经是的标题级别。
         * 意图：在生成“变换标题”菜单时，无需提供转换为当前级别的选项。
         * 生效场景：当循环生成的级别 `i` 与当前标题级别一致时。
         */
        if (currentLevel !== i) {
            headingSubMenu.push(genHeadingTransform(outline, id, i));
        }
    }
    /**
     * 作用：仅当有可用的转换选项时才显示子菜单。
     * 意图：如果当前级别包含了所有可能的级别（理论上不可能），则隐藏子菜单。
     * 生效场景：生成的子菜单项数量大于 0 时。
     */
    if (headingSubMenu.length > 0) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "tWithSubtitle", type: "submenu", icon: "iconRefresh", label: siyuanI18n.tWithSubtitle, submenu: headingSubMenu }).element);
    }
}



/**
 * 作用：添加"转换为子文档"菜单项。
 * 意图：允许用户将当前块转换为一个新的子文档。
 * 调用时机：在右键菜单构建时调用。
 * @同步豁免: UI构建
 */
export function appendSubDocMenu(outline: OutlineDomain, element: HTMLElement) {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        label: "转换为子文档",
        icon: "iconFile",
        /**
         * 作用：处理“转换为子文档”菜单项的点击事件。
         * 意图：执行将当前块转换为子文档的逻辑。
         * 调用时机：用户点击菜单项时。
         */
        click: () => {
            const data = getProtyleAndBlockElement(outline, element);
            /**
             * 作用：确保成功获取了 Protyle 实例和块元素。
             * 意图：执行事务需要依赖有效的 Protyle 上下文和目标元素。
             * 生效场景：`getProtyleAndBlockElement` 返回有效对象时。
             */
            if (!data) {
                return;
            }
            // @内联回调
            confirmDialog("提示", "⚠️ 此操作无法撤销<br>确认将此块及其内容转换为子文档吗？", () => {
                convertBlockToSubDocument(data.editor, data.blockElement);
            });
        }
    }).element);
}
/** 
 * 添加插入标题菜单项
 * @同步豁免: UI构建
 */
export function appendInsertMenuItems(outline: OutlineDomain, element: HTMLElement, id: string, currentLevel: number) {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "insertSameLevelHeadingBefore", icon: "iconBefore", label: siyuanI18n.insertSameLevelHeadingBefore,
        /**
         * 作用：处理在当前标题前插入同级标题的点击事件。
         * 意图：在当前标题上方创建一个新的空标题块。
         * 调用时机：用户点击“在上方插入”菜单项时。
         */
        click: () => {
            const data = getProtyleAndBlockElement(outline, element);
            /**
             * 作用：处理上下文丢失的情况。
             * 意图：如果无法获取到操作所需的 Protyle 实例，则中止。
             * 生效场景：环境异常或元素已失效。
             */
            if (!data) {
                return;
            }
            const newId = Lute.NewNodeID();
            const html = genHeadingHTML(currentLevel, newId);
            data.editor.transaction(
                [{
                    action: "insert",
                    data: html,
                    id: newId,
                    previousID: data.blockElement.previousElementSibling?.getAttribute("data-node-id") ?? undefined,
                    parentID: data.blockElement.parentElement?.getAttribute("data-node-id") || data.protyle.block.parentID
                }],
                [{ action: "delete", id: newId }]
            );
            data.blockElement.insertAdjacentHTML("beforebegin", html);
            const 新插入的元素 = data.blockElement.previousElementSibling;
            /**
             * 作用：确保新插入的元素引用且是 HTMLElement。
             * 意图：调用 scrollIntoView 和 focustByWbr 等 DOM API 需要 HTMLElement 实例。
             * 生效场景：当成功获取到新插入的前一个兄弟节点且确实为元素时。
             */
            if (isHTMLElement(新插入的元素)) {
                新插入的元素.scrollIntoView();
                focusByWbr(新插入的元素, document.createRange());
            }
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "insertSameLevelHeadingAfter", icon: "iconAfter", label: siyuanI18n.insertSameLevelHeadingAfter,
        /**
         * 作用：处理在当前标题后插入同级标题的点击事件。
         * 意图：在当前标题下方创建一个新的空标题块。
         * 调用时机：用户点击“在下方插入”菜单项时。
         */
        click: () => {
            fetchPost("/api/block/getHeadingDeleteTransaction", { id }, 创建插入同级标题后处理器(() => getProtyleAndBlockElement(outline, element), currentLevel));
        }
    }).element);
    /**
     * 作用：仅在标题级别小于 6 时显示“添加子标题”选项。
     * 意图：六级标题不支持子标题（暂无 h7），限制层级深度。
     * 生效场景：当前标题级别为 h1-h5 时。
     */
    if (currentLevel < 6) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "addChildHeading", icon: "iconAdd", label: siyuanI18n.addChildHeading,
            /**
             * 作用：处理添加子标题菜单项的点击事件。
             * 意图：作为当前标题的子级，插入一个新的空标题块。
             * 调用时机：用户点击“添加子标题”菜单项时。
             */
            click: () => {
                fetchPost("/api/block/getHeadingDeleteTransaction", { id }, 创建添加子标题响应处理器(() => getProtyleAndBlockElement(outline, element), currentLevel));
            }
        }).element);
    }
}
