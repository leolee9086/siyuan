import { Constants, setStorageVal } from "../../../ai/imports";
import { getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setRectElement } from "../state/selection";
import { AnnoConstants } from "../constants";
import { copyAnno } from "../anno.copy";
import { getHightlightCoordsByRange } from "../anno.getHightlightCoordsByRange";
import { hideToolbar } from "../anno.hideToolbar";
import { showHighlight } from "../anno.showHighlight";
import { IPdfInstance } from "../anno.types";
import { isExternalEventContext, ICustomEventContext } from "./guard";

/**
 * @作用: 处理外部自定义事件，用于响应 PDF 标注颜色选择。
 * 当用户从外部触发颜色选择事件时，更新 PDF 标注主题颜色，
 * 获取当前选中文本的坐标，创建高亮标注并复制到剪贴板，最后隐藏工具栏。
 * 
 * @意图: 解耦颜色选择 UI 与标注创建逻辑。通过事件机制，允许外部组件
 * （如颜色选择器）触发标注创建，而不需要直接依赖标注创建的具体实现。
 * 
 * @调用时机: 当外部组件（通常是颜色选择器）触发 CustomEvent 时调用。
 * 事件的 detail 是一个字符串，表示颜色索引（"0" 表示使用当前颜色，其他值对应预设颜色）。
 * 由 externalEventProcessor 在 guard 验证通过后调用。
 * 
 * @问题/改进:
 * - 当前实现假设第一个高亮元素是主元素，这在多选场景下可能不够灵活
 * - 文件路径处理使用了多个字符串操作（substr、replace），可以考虑提取为工具函数
 * - copyAnno 的路径处理逻辑较复杂，建议在函数注释中说明路径格式要求
 */
const handleExternalEvent = (event: CustomEvent<string>, element: HTMLElement, pdf: IPdfInstance) => {
    const pdfTheme = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
    const eventDetail = event.detail;
    pdfTheme.annoColor = eventDetail === "0" ?
        (pdfTheme.annoColor || "var(--b3-pdf-background1)")
        : `var(--b3-pdf-background${eventDetail})`;
    setStorageVal(Constants.LOCAL_PDFTHEME, pdfTheme);
    const coords = getHightlightCoordsByRange(pdf, pdfTheme.annoColor);
    if (coords) {
        let isFirst = true;
        for (const item of coords) {
            const newElement = showHighlight(item, pdf);
            if (isFirst) {
                isFirst = false;
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        }
    }
    hideToolbar(element);
};

/**
 * @作用: 外部事件处理器的异步包装函数。
 * 处理通过类型守卫验证的外部自定义事件上下文，
 * 调用实际的事件处理逻辑并中止事件传播链。
 * 
 * @意图: 作为点击处理器注册系统的标准接口实现。
 * 统一事件处理器的签名（接收 context 和 controller），
 * 使外部事件处理能够集成到统一的事件处理流程中，
 * 并通过 AbortController 确保事件处理完成后不再传播到其他处理器。
 * 
 * @调用时机: 当点击事件通过 isExternalEventContext 类型守卫验证后调用。
 * 由事件分发系统在确认事件为有效的外部颜色选择事件后自动调用。
 * 这通常发生在用户通过外部颜色选择器选择标注颜色时。
 * 
 * @问题/改进:
 * - 当前函数声明为 async 但内部没有 await 操作，可以考虑移除 async 
 *   （除非未来计划添加异步操作）
 * - abort 的原因字符串 "Handled external event" 可以提取为常量以便统一管理
 * - 可以考虑添加错误处理，确保即使 handleExternalEvent 抛出异常也能正确 abort
 */
const externalEventProcessor = async (ctx: ICustomEventContext, controller: AbortController) => {
    handleExternalEvent(ctx.event, ctx.element, ctx.pdf);
    controller.abort("Handled external event");
};

export const externalEventClickHandler = {
    guard: isExternalEventContext,
    handler: externalEventProcessor,
};
