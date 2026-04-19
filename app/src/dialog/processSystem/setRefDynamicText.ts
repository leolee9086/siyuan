import { getAllEditor } from "../../plugin/imports";
/**
 * 更新动态链接的锚文本
 */
export const setRefDynamicText = (data: {
    "blockID": string;
    "defBlockID": string;
    "refText": string;
    "rootID": string;
}) => {
    const allEditors = getAllEditor();
    allEditors.forEach(editor => {
        // 不能对比 rootId，否则嵌入块中的锚文本无法更新
        const dynamicRefItems = editor.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.blockID}"] span[data-type~="block-ref"][data-subtype="d"][data-id="${data.defBlockID}"]`);
        dynamicRefItems.forEach(item => {
            item.innerHTML = data.refText;
        });
    });
};


