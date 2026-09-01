import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { matchHotKey } from "../util/hotKey";
import {turnsIntoTransaction} from "./transaction/turns/multiple";
import {turnsOneInto} from "./transaction/turns/single";

/**
 * 处理标题转换的通用函数
 * @param event - 键盘事件对象
 * @param protyle - 思源笔记编辑器实例
 * @param nodeElement - 当前操作的节点元素
 * @param controller - 中止控制器
 * @param level - 标题级别 (1-6)
 * @param hotKeyConfig - 热键配置
 * @returns 是否处理了该事件
 */
const handleHeadingTransform = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    controller: AbortController,
    level: number,
    hotKeyConfig: string
): boolean => {
    if (matchHotKey(hotKeyConfig, event)) {
        turnsIntoTransaction({
            protyle,
            nodeElement,
            type: "Blocks2Hs",
            level
        });
        event.preventDefault();
        event.stopPropagation();
        controller.abort(`转换为H${level}标题`);
        return true;
    }
    return false;
};

/**
 * 处理段落转换的函数
 * @param event - 键盘事件对象
 * @param protyle - 思源笔记编辑器实例
 * @param nodeElement - 当前操作的节点元素
 * @param controller - 中止控制器
 * @returns 是否处理了该事件
 */
const handleParagraphTransform = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    controller: AbortController
): boolean => {
    const siyuanConfig = getSiyuanConfig();
    if (!siyuanConfig?.keymap?.editor?.heading?.paragraph?.custom ||
        !matchHotKey(siyuanConfig.keymap.editor.heading.paragraph.custom, event)) {
        return false;
    }

    if (!protyle?.wysiwyg?.element) {
        return false;
    }

    const selectsElement = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectsElement.length === 0) {
        selectsElement.push(nodeElement);
    }

    if (selectsElement.length > 1) {
        // 多个块转换为段落
        turnsIntoTransaction({
            protyle,
            nodeElement: selectsElement[0]!,
            type: "Blocks2Ps",
        });
    } else {
        // 单个块转换为段落
        const selectedElement = selectsElement[0];
        if (!selectedElement) {
return true;
}

        const type = selectedElement.getAttribute("data-type");
        if (type === "NodeHeading") {
            turnsIntoTransaction({
                protyle,
                nodeElement: selectedElement,
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
    return true;
};

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
    range: Range,
    controller: AbortController
): Promise<void> => {
    // 检查必要的对象是否存在
    const siyuanConfig = getSiyuanConfig();
    if (!protyle?.wysiwyg?.element || !siyuanConfig?.keymap?.editor?.heading) {
        return;
    }

    // 处理段落转换
    if (handleParagraphTransform(event, protyle, nodeElement, controller)) {
        return;
    }

    // 处理标题转换 (H1-H6)
    const headingConfigs = [
        { level: 1, config: siyuanConfig.keymap.editor.heading.heading1.custom },
        { level: 2, config: siyuanConfig.keymap.editor.heading.heading2.custom },
        { level: 3, config: siyuanConfig.keymap.editor.heading.heading3.custom },
        { level: 4, config: siyuanConfig.keymap.editor.heading.heading4.custom },
        { level: 5, config: siyuanConfig.keymap.editor.heading.heading5.custom },
        { level: 6, config: siyuanConfig.keymap.editor.heading.heading6.custom }
    ];

    for (const { level, config } of headingConfigs) {
        if (handleHeadingTransform(event, protyle, nodeElement, controller, level, config)) {
            return;
        }
    }
};