/**
 * 用途: 获取所有已打开的编辑器实例，遍历更新动态链接锚文本。
 * 使用范围: `processSystem/setRefDynamicText` 锚文本更新流程，仅在此模块内使用。
 * 解耦评估: 编辑器实例获取是全局工具函数，当前模块仅做遍历访问，不持有编辑器引用；通过本目录 `./imports` 转发可避免直接耦合 `plugin/imports`。
 */
import { getAllEditor } from "./imports";
/**
 * 更新动态链接的锚文本
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 直接操作innerHTML更新DOM元素 */
export const setRefDynamicText = (data: {
    "blockID": string;
    "defBlockID": string;
    "refText": string;
    "rootID": string;
}) => {
    const allEditors = getAllEditor();
    for (const editor of allEditors) {
        // 不能按 rootId 过滤编辑器：嵌入块（`{{! blockID}}`）的内容渲染在宿主文档的编辑器中，
        // 其 editor.protyle.block.rootID 指向宿主文档而非原文档。若按 data.rootID 过滤，
        // 嵌入块中的动态引用锚文本将被跳过，无法更新。
        const wysiwygEl = editor.protyle.wysiwyg?.element;
        if (!wysiwygEl) {
            continue;
        }
        const dynamicRefItems = wysiwygEl.querySelectorAll(`[data-node-id="${data.blockID}"] span[data-type~="block-ref"][data-subtype="d"]`);
        for (const item of dynamicRefItems) {
            const ids = (item.getAttribute("data-id") || "").split(/\s+/);
            // 匹配到目标定义块 ID 时才更新锚文本，避免错误覆盖其他引用的显示内容
            if (ids.includes(data.defBlockID)) {
                item.innerHTML = data.refText;
            }
        }
    }
};


