import { Constants } from "../../../constants";
import { focusBlock } from "../../util/selection";
import { matchHotKey } from "../../util/hotKey";
import { onGet } from "../../util/onGet";
import { copyTextByType } from "../../toolbar/util";

/**
 * 处理复制相关的快捷键操作。
 *
 * 该函数负责拦截键盘事件，检测是否匹配复制快捷键。如果匹配，则根据当前选区或鼠标悬停位置
 * 获取对应的块 ID，并按照指定的类型（如 markdown 协议链接、纯 ID、块嵌入代码等）调用复制功能。
 *
 * @param protyle - 当前的 Protyle 编辑器实例，提供上下文信息。
 * @param event - 触发的键盘事件对象，用于检测快捷键。
 * @param nodeElement - 当前鼠标悬停或光标所在的元素。如果未提供，则默认操作整个文档根节点。
 * @param hotkey - 预定义的快捷键组合字符串（如 "⌘C"）。
 * @param type - 复制的目标格式类型：
 *               - "protocolMd": 完整的 Markdown 链接 `[锚文本](siyuan://blocks/...)`。
 *               - "id": 仅复制块 ID。
 *               - "protocol": 仅复制协议链接 `siyuan://blocks/...`。
 *               - "blockEmbed": 复制为块嵌入形式 `{{...}}`。
 * @returns {boolean} - 如果快捷键匹配并处理了复制逻辑，返回 `true`；否则返回 `false`。
 */
export const handleCopyHotKey = (
    protyle: IProtyle,
    event: KeyboardEvent,
    nodeElement: HTMLElement | undefined,
    hotkey: string,
    type: "protocolMd" | "id" | "protocol" | "blockEmbed"
): boolean => {
    if (!matchHotKey(hotkey, event)) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!nodeElement) {
        copyTextByType([protyle.block.rootID || ""], type);
        return true;
    }

    if (!protyle.wysiwyg) {
        return true;
    }

    const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectElements.length === 0) {
        selectElements.push(nodeElement);
    }
    const ids: string[] = [];
    for (const item of selectElements) {
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
    }
    copyTextByType(ids, type);
    return true;
};

/**
 * 处理插件注册的自定义快捷键。
 *
 * 遍历应用中所有启用的插件，查找是否有插件定义的快捷键（`customHotkey`）与当前事件匹配。
 * 如果找到匹配项，则执行该插件命令定义的 `editorCallback`。
 *
 * @param protyle - 当前编辑器实例，将作为参数传递给插件的回调函数。
 * @param event - 键盘事件，用于匹配快捷键。
 * @returns {boolean} - 如果成功匹配并执行了任意插件的命令，则返回 `true`。
 */
export const handlePluginHotKey = (protyle: IProtyle, event: KeyboardEvent): boolean => {
    for (const plugin of protyle.app.plugins) {
        const command = plugin.commands.find(command => {
            return command.editorCallback && matchHotKey(command.customHotkey, event);
        });
        if (command && command.editorCallback) {
            command.editorCallback(protyle);
            return true;
        }
    }
    return false;
};

/**
 * 处理 `goEnd` 操作中 `fetchPost` 请求的回调。
 *
 * 当请求文档末尾数据成功后，调用 `onGet` 处理返回数据，并聚焦到文档末尾。
 *
 * @param protyle - 编辑器实例。
 * @param getResponse - `fetchPost` 返回的响应数据。
 */
export const handleGoEndResponse = (protyle: IProtyle, getResponse: IWebSocketData) => {
    onGet({
        data: getResponse,
        protyle,
        action: [Constants.CB_GET_FOCUS],
        /** @简洁函数 聚焦到编辑器末尾块的简单回调 */
        afterCB() {
            if (protyle.wysiwyg && protyle.wysiwyg.element.lastElementChild) {
                focusBlock(protyle.wysiwyg.element.lastElementChild, undefined, false);
            }
        }
    });
};
