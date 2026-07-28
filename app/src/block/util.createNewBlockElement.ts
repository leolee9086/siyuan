/*
 * 用途：生成列表项元素以复用列表插入语义。
 * 使用范围：仅在 createNewBlockElement 的“列表项分支”中使用，不向外扩散列表实现细节。
 * 解耦评估：理论上可由调用方注入“列表元素工厂”解耦；但该逻辑是块插入核心路径，统一从 block/imports 转发可保持行为一致并降低调用样板。
 */
import { genListItemElement } from "./util/imports";
/*
 * 用途：生成默认段落块元素。
 * 使用范围：createNewBlockElement 的兜底分支与初始化默认值。
 * 解耦评估：可通过参数传入工厂函数解耦；当前属于 block 模块内部基础能力，直接依赖本目录 util 更直接。
 */
import {genEmptyElement} from "./element.factory";
/** 用途：生成折叠标题元素；使用范围：createNewBlockElement 的标题分支；解耦评估：直接依赖块元素工厂唯一实现。 */
import {genHeadingElement} from "./element.factory";
/*
 * 用途：根据标题块生成同级标题元素。
 * 使用范围：createNewBlockElement 在 beforebegin/afterend 且命中折叠标题条件时使用。
 * 解耦评估：可通过策略对象注入解耦；但其属于块语义核心逻辑，在 block 内部直接复用 util 实现更稳定。
 */
import { getPreviousBlockSibling } from "./util/imports";

/**
 * 导出说明：创建插入新块时所需的 DOM 元素与有序列表序号信息。
 */
/**
 * 作用：根据当前块类型与插入位置，生成最合适的新块元素，并返回列表场景下的顺序号。
 * 意图：将“普通块 / 列表项 / 折叠标题”三类插入前置逻辑集中，避免调用方重复分支判断。
 * 调用时机：在编辑器执行插入块操作（如回车新建块、在标题前后插入）时调用。
 * 问题/改进：目前通过 data-* 属性判断结构，后续可考虑以更强类型的块模型替代字符串属性比较。
 */
/** @同步豁免: UI构建 @显式返回类型原因: 返回对象包含新元素与列表序号两个字段，调用方依赖此结构进行后续 DOM 插入和序号更新，保持显式类型可防止重构时字段遗漏。 */
export const createNewBlockElement = (blockElement: Element, position: InsertPosition): { newElement: HTMLElement; orderIndex: number; } => {
    let newElement: HTMLElement = genEmptyElement(false, true);
    let orderIndex = 1;

    // 当当前块是列表项时，需要复用列表项结构并尽量继承当前列表序号，保证新项语义一致。
    if (blockElement.getAttribute("data-type") === "NodeListItem") {
        newElement = genListItemElement(blockElement, 0, true);
        const marker = blockElement.parentElement?.firstElementChild?.getAttribute("data-marker");
        const parsedMarker = marker ? Number.parseInt(marker, 10) : Number.NaN;
        orderIndex = Number.isNaN(parsedMarker) ? orderIndex : parsedMarker;
        return { newElement, orderIndex };
    }

    const previousElementSibling = getPreviousBlockSibling(blockElement);
    const beforeHeadingElement = position === "beforebegin" && previousElementSibling?.getAttribute("data-type") === "NodeHeading" &&
        previousElementSibling.getAttribute("fold") === "1"
        ? genHeadingElement(previousElementSibling, false, true)
        : null;
    // 在标题块之前插入且前一兄弟为折叠标题时，仅当生成结果是可插入的 HTMLElement 才替换默认段落，避免 null/字符串返回值破坏 DOM 插入流程。
    if (beforeHeadingElement instanceof HTMLElement) {
        newElement = beforeHeadingElement;
        return { newElement, orderIndex };
    }

    const afterHeadingElement = position === "afterend" && blockElement.getAttribute("data-type") === "NodeHeading" &&
        blockElement.getAttribute("fold") === "1"
        ? genHeadingElement(blockElement, false, true)
        : null;
    // 在折叠标题后插入时，同样需要确认返回值是 HTMLElement，确保插入逻辑对异常返回值具备安全兜底能力。
    if (afterHeadingElement instanceof HTMLElement) {
        newElement = afterHeadingElement;
        return { newElement, orderIndex };
    }

    return { newElement, orderIndex };
};
