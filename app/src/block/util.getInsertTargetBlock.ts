/*
 * 用途：读取编辑器当前有效选区范围，作为插入目标定位基准。
 * 使用范围：仅在块插入目标计算流程中使用，不承担光标写入职责。
 * 解耦评估：可由调用方传入 Range 解耦，但当前调用链统一持有 protyle，
 * 直接引入可减少重复样板代码并保持调用一致性。
 */
import { getEditorRange } from "./imports";
/*
 * 用途：将候选块提升为可独立操作的顶层块，避免落在中间容器层。
 * 使用范围：仅在插入前计算锚点时使用，不处理事务或 DOM 写入。
 * 解耦评估：可注入策略函数解耦，但该规则属于编辑器核心语义，
 * 复用统一实现可避免各调用点出现语义漂移。
 */
import { getTopAloneElement } from "./imports";
/*
 * 用途：隐藏编辑器选中态相关 UI，防止插入后残留视觉状态。
 * 使用范围：仅在命中多选块并确定插入锚点后调用。
 * 解耦评估：可通过事件机制解耦，但该函数与编辑器 UI 生命周期强相关，
 * 在此直接调用可确保状态收敛及时。
 */
import { hideElements } from "./imports";
/*
 * 用途：从当前节点向上查找指定类名祖先元素。
 * 使用范围：用于列表场景回退到 li 级锚点，不参与其他块类型判断。
 * 解耦评估：可由调用方传入查找结果解耦，但会增加重复查询逻辑，
 * 在此集中调用更利于维护。
 */
import { hasClosestByClassName } from "./imports";
/*
 * 用途：定位当前节点最近的块级祖先。
 * 使用范围：用于常规块锚点解析以及引述/Callout 内层块回退。
 * 解耦评估：可通过参数注入查询函数解耦，但该能力为块模块共性依赖，
 * 通过转发层导入已将路径耦合降到最小。
 */
import { hasClosestBlock } from "./popover/imports";

/**
 * 作用：计算插入操作应落到的目标块，覆盖显式 id、多选块、光标块与特殊容器场景。
 * 意图：统一插入锚点决策，减少调用方重复编排 DOM 判断，保证插入语义一致。
 * 调用时机：在执行块插入前调用，例如快捷键插入、菜单插入与导航插入流程。
 * 问题/改进：当前逻辑依赖 DOM 状态，后续可考虑将容器回退策略抽离为可测试规则集。
 */
/** @同步豁免: UI构建 @显式返回类型原因: 不同分支可能返回 null 或 HTMLElement，调用方需要根据 null 判断是否中止插入流程，显式类型可确保调用方正确处理空值分支。 与编辑器事务插入链路依赖同步返回 HTMLElement，改为 Promise 会扩散到大量同步调用点并改变交互时序。 */
export const getInsertTargetBlock = (
    protyle: IProtyle,
    target?: string | Element,
    position?: InsertPosition
): HTMLElement | null => {
    if (!protyle.wysiwyg?.element) {
        return null;
    }

    if (typeof target === "string") {
        const targetElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${target}"]`);
        return targetElement instanceof HTMLElement ? targetElement : null;
    }
    if (target instanceof HTMLElement) {
        return target;
    }

    const selectElements = protyle.wysiwyg.element.querySelectorAll<HTMLElement>(".protyle-wysiwyg--select");
    // 当存在块多选时，插入应锚定选区边界块，并清理选中 UI，防止后续事务误判。
    if (selectElements.length > 0) {
        const blockElement = position === "beforebegin" ? selectElements[0] : selectElements[selectElements.length - 1];
        hideElements(["select"], protyle);
        return blockElement ?? null;
    }

    const range = getEditorRange(protyle.wysiwyg.element);
    const closest = hasClosestBlock(range.startContainer);
    if (!(closest instanceof HTMLElement)) {
        return null;
    }

    const topAloneElement = getTopAloneElement(closest);
    if (!(topAloneElement instanceof HTMLElement)) {
        return closest;
    }

    // https://github.com/siyuan-note/siyuan/issues/14720#issuecomment-2840665326
    const liElement = topAloneElement.classList.contains("list")
        ? hasClosestByClassName(range.startContainer, "li")
        : null;
    // 列表容器本身不是最终语义块，命中 list 时应回退到当前光标所在 li 作为插入锚点。
    if (liElement instanceof HTMLElement) {
        return liElement;
    }

    const innerBlock = hasClosestBlock(range.startContainer);
    const shouldUseInnerBlock = topAloneElement.classList.contains("bq") || topAloneElement.classList.contains("callout");
    // 引述块与 Callout 的容器层通常只承担结构作用，命中时回退内层块更符合用户插入预期。
    if (shouldUseInnerBlock && innerBlock instanceof HTMLElement) {
        return innerBlock;
    }

    return topAloneElement;
};
