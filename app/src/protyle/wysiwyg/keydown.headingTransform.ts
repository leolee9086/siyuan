import { matchHotKey } from "../util/hotKey";
import { turnsIntoTransaction, turnsIntoOneTransaction, turnsOneInto } from "./transaction";

/**
 * 标题转换中间件
 *
 * 处理各种标题转换相关的键盘快捷键，包括：
 * - 转换为段落 (Ctrl+0)
 * - 转换为H1-H6标题 (Ctrl+1-6)
 * - 处理单个或多个选中块的转换
 *
 * @param event - 键盘事件对象
 * @param protyle - 思源笔记编辑器实例
 * @param nodeElement - 当前操作的节点元素
 * @param controller - 中止控制器，用于停止后续的事件处理流程
 * @returns Promise<void> - 异步函数，无返回值
 */
export const headingTransformMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range:Range,
    controller: AbortController
): Promise<void> => {
    // 检查必要的对象是否存在
    if (!protyle?.wysiwyg?.element || !window.siyuan?.config?.keymap?.editor?.heading) {
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.paragraph.custom, event)) {
        const selectsElement = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
        if (selectsElement.length === 0) {
            selectsElement.push(nodeElement);
        }
        
        if (selectsElement.length > 1) {
            // 多个块转换为段落
            turnsIntoTransaction({
                protyle,
                selectsElement,
                type: "Blocks2Ps",
            });
        } else {
            // 单个块转换为段落
            const selectedElement = selectsElement[0];
            if (!selectedElement) return;
            
            const type = selectedElement.getAttribute("data-type");
            if (type === "NodeHeading") {
                turnsIntoTransaction({
                    protyle,
                    selectsElement,
                    type: "Blocks2Ps",
                });
            } else if (type === "NodeList") {
                const nodeId = selectedElement.getAttribute("data-node-id");
                if (nodeId) {
                    turnsOneInto({
                        protyle,
                        nodeElement: selectedElement,
                        id: nodeId,
                        type: "CancelList",
                    });
                }
            } else if (type === "NodeBlockquote") {
                const nodeId = selectedElement.getAttribute("data-node-id");
                if (nodeId) {
                    turnsOneInto({
                        protyle,
                        nodeElement: selectedElement,
                        id: nodeId,
                        type: "CancelBlockquote",
                    });
                }
            }
        }
        
        event.preventDefault();
        event.stopPropagation();
        controller.abort("标题转换为段落");
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading1.custom, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level: 1
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort("转换为H1标题");
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading2.custom, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level: 2
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort("转换为H2标题");
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading3.custom, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level: 3
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort("转换为H3标题");
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading4.custom, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level: 4
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort("转换为H4标题");
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading5.custom, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level: 5
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort("转换为H5标题");
        return;
    }

    if (matchHotKey(window.siyuan.config.keymap.editor.heading.heading6.custom, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level: 6
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort("转换为H6标题");
        return;
    }
};