/** 用途：校验标题块 DOM 身份；使用范围：Outline 标题块上下文解析；解耦评估：经本职责直达网关复用唯一 DOM 守卫。 */
import {isHTMLElement} from "./imports";
/** 用途：约束调用方为完整 Outline 领域根；使用范围：Outline 菜单与实例公共行为；解耦评估：纯类型依赖完整抽象，不加载具体 class。 */
import type {OutlineDomain} from "./imports";
/** 用途：固定解析结果的完整编辑器上下文；使用范围：Outline 编辑和剪贴板动作；解耦评估：纯类型依赖既有领域结果定义。 */
import type {OutlineEditorContext} from "./imports";

/**
 * 根据 Outline 文档身份解析对应 Protyle 与标题块 DOM。
 * @显式返回类型原因 该公共领域解析器必须固定无匹配时的 undefined 与完整 OutlineEditorContext 联合契约。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function getProtyleAndBlockElement(outline: OutlineDomain, element: HTMLElement): OutlineEditorContext | undefined {
    const id = element.getAttribute("data-node-id");
    const editItem = outline.app.getOpenModels().editor.find(item => item.editor.protyle.block.rootID === outline.blockId);
    if (!editItem) {
        return;
    }
    const editor = editItem.editor;
    const protyle = editor.protyle;
    if (!protyle.wysiwyg) {
        return;
    }
    const blockElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
    if (!blockElement || !isHTMLElement(blockElement)) {
        return;
    }
    return {editor, protyle, blockElement};
}
