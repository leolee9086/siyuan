/**
 * 列表拖拽辅助模块
 *
 * 作用：承接普通块拖拽中与列表项、列表块相关的特殊规则
 * 意图：保持 gutter 拖拽主流程简短，同时保留上游列表拖拽体验改进
 * 调用时机：gutter 普通拖拽落到块级目标时
 */
import { dragSame } from "./drag";

/**
 * 判断拖拽源是否为列表项或列表块
 *
 * 作用：统一识别列表类拖拽源
 * 意图：列表项与列表块需要共享无操作拦截和非法嵌套处理
 * 调用时机：普通块拖拽分支进入后
 *
 * @param gutterTypes 解析后的 gutter 类型数组
 * @returns 是否为列表项或列表块拖拽源
 */
export const isListSourceType = (gutterTypes: string[]): boolean => {
    return gutterTypes[0] === "nodelistitem" || gutterTypes[0] === "nodelist";
};

/**
 * 解析列表拖拽目标对应的列表项
 *
 * 作用：把列表容器、列表项内容块等目标归一到列表项
 * 意图：后续 no-op 判定需要围绕实际列表项进行
 * 调用时机：列表类普通拖拽处理开始时
 *
 * @param targetElement 拖拽目标元素
 * @param isBottom 是否命中目标下半部
 * @returns 对应列表项，不存在时返回 undefined
 */
/** @同步豁免: 需要绝对同步的DOM访问 - drop 路由必须在移动 DOM 前确定当前列表项。 */
export const resolveListTarget = (targetElement: Element, isBottom: boolean): Element | undefined => {
    if (targetElement.classList.contains("li")) {
        return targetElement;
    }
    if (!targetElement.classList.contains("list")) {
        return targetElement.closest(".li") || undefined;
    }
    const lis = targetElement.querySelectorAll(":scope > .li");
    return isBottom ? lis[lis.length - 1] : lis[0];
};

/**
 * 取得跳过属性元素后的紧邻兄弟
 *
 * 作用：列表拖拽 no-op 判定时忽略 protyle 属性占位元素
 * 意图：避免属性元素干扰“原位置”判断
 * 调用时机：检查列表层级相邻目标时
 *
 * @param element 起始兄弟元素
 * @param direction 查找方向
 * @returns 跳过属性元素后的兄弟元素
 */
const getListSibling = (element: Element | null, direction: "previous" | "next"): Element | null => {
    let sibling = element;
    while (sibling?.classList.contains("protyle-attr")) {
        sibling = direction === "previous" ? sibling.previousElementSibling : sibling.nextElementSibling;
    }
    return sibling;
};

/**
 * 判断列表层级外侧紧邻块是否应跳过
 *
 * 作用：检查源列表自身及祖先列表层级的前后紧邻目标
 * 意图：避免嵌套列表被拖到父列表外形成独立列表，同时允许顶层列表正常重排
 * 调用时机：列表源未解析到具体列表项目标时
 *
 * @param sourceSelected 首个源元素
 * @param targetElement 拖拽目标元素
 * @param editorElement 编辑器容器元素
 * @returns 是否应当跳过本次拖拽
 */
const shouldSkipListHierarchyAdjacentDrop = (
    sourceSelected: Element | undefined,
    targetElement: Element,
    editorElement: HTMLElement,
): boolean => {
    if (!sourceSelected ||
        (!sourceSelected.classList.contains("li") && !sourceSelected.classList.contains("list"))) {
        return false;
    }
    if (targetElement.classList.contains("list") && targetElement.contains(sourceSelected)) {
        return true;
    }
    let current: Element | null = sourceSelected;
    while (current && current !== editorElement) {
        const isListContext = current.classList.contains("list") || current.classList.contains("li");
        if (!isListContext) {
            current = current.parentElement;
            continue;
        }
        const previous = getListSibling(current.previousElementSibling, "previous");
        const next = getListSibling(current.nextElementSibling, "next");
        const isAdjacentTarget = targetElement === previous || targetElement === next;
        if (isAdjacentTarget) {
            return current.parentElement !== editorElement;
        }
        current = current.parentElement;
    }
    return false;
};

/**
 * 判断列表源拖拽是否应当作为无操作跳过
 *
 * 作用：拦截列表源拖到自身、子孙、原位置或内部容器的无效移动
 * 意图：保留上游列表拖拽体验修复，同时允许 Ctrl 复制落在原位置
 * 调用时机：普通块拖拽处理列表源时
 *
 * @param sourceElements 源元素列表
 * @param targetElement 拖拽目标元素
 * @param isChild 是否为列表子级插入
 * @param isBottom 是否命中目标下半部
 * @param ctrlKey 是否按住 Ctrl 键
 * @param editorElement 编辑器容器元素
 * @returns 是否应当跳过本次拖拽
 */
export const shouldSkipListSourceDrop = (
    sourceElements: Element[],
    targetElement: Element,
    isChild: boolean,
    isBottom: boolean,
    isCopy: boolean,
    editorElement: HTMLElement,
): boolean => {
    if (targetElement.classList.contains("list") &&
        sourceElements.some(sourceElement => targetElement.contains(sourceElement))) {
        return true;
    }
    const targetLi = resolveListTarget(targetElement, isBottom);
    if (targetLi) {
        const isNoOpDrop = sourceElements.some(sourceElement =>
            sourceElement === targetLi ||
            sourceElement.contains(targetLi) ||
            (!isChild && isBottom && sourceElement === targetLi.nextElementSibling) ||
            (!isChild && !isBottom && sourceElement === targetLi.previousElementSibling));
        return isNoOpDrop && !isCopy;
    }
    return shouldSkipListHierarchyAdjacentDrop(sourceElements[0], targetElement, editorElement);
};

/**
 * 展开拖到列表项上的列表块源
 *
 * 作用：把 NodeList 源转换为其直接列表项子节点
 * 意图：避免形成 list > list 非法嵌套
 * 调用时机：普通块拖拽目标为列表项时
 *
 * @param sourceElements 源元素列表，会被原地替换
 * @param targetElement 拖拽目标元素
 */
export const expandListBlockSources = (sourceElements: Element[], targetElement: Element): void => {
    if (targetElement.getAttribute("data-type") !== "NodeListItem") {
        return;
    }
    const expandedElements: Element[] = [];
    for (const item of sourceElements) {
        if (item.getAttribute("data-type") !== "NodeList") {
            expandedElements.push(item);
            continue;
        }
        for (const li of Array.from(item.children)) {
            if (li.classList.contains("li")) {
                expandedElements.push(li);
            }
        }
    }
    if (expandedElements.length > 0) {
        sourceElements.length = 0;
        sourceElements.push(...expandedElements);
    }
};

/**
 * 处理非列表源拖到子列表首项上方间隙
 *
 * 作用：把段落等非列表源插入父列表项内容末尾，位于子列表之前
 * 意图：保留上游对子列表首项上方间隙的语义修复，避免插成非法列表同级
 * 调用时机：普通块拖拽目标为列表项且不是列表源时
 *
 * @param protyle 编辑器实例
 * @param sourceElements 源元素列表
 * @param targetElement 拖拽目标元素
 * @param targetClass 目标元素 class 列表
 * @param isChild 是否为列表子级插入
 * @param isBottom 是否命中目标下半部
 * @param ctrlKey 是否按住 Ctrl 键
 * @returns 是否已处理该拖拽
 */
export const handleLiGapDrop = async (
    protyle: IProtyle,
    sourceElements: Element[],
    targetElement: Element,
    targetClass: string[],
    isChild: boolean,
    isBottom: boolean,
    isCopy: boolean,
) => {
    if (isChild || targetElement.getAttribute("data-type") !== "NodeListItem") {
        return false;
    }
    const parentLi = targetElement.parentElement?.parentElement;
    if (!targetClass.some(item => item.indexOf("dragover__top--sibling") === 0) ||
        !parentLi?.classList.contains("li")) {
        return false;
    }
    const contentBlocks = Array.from(parentLi.children).filter(item =>
        item.hasAttribute("data-node-id") && !item.classList.contains("list"));
    const anchorBlock = contentBlocks.length > 0 ? contentBlocks[contentBlocks.length - 1] : null;
    if (anchorBlock) {
        await dragSame(protyle, sourceElements, anchorBlock, true, isCopy);
        return true;
    }
    await dragSame(protyle, sourceElements, parentLi, isBottom, isCopy);
    return true;
};

/**
 * 处理列表项子级拖拽
 *
 * 作用：把拖拽源放入目标列表项的子列表或内容块之后
 * 意图：维持列表项作为子项插入的合法 DOM 结构
 * 调用时机：普通块拖拽目标为列表项且命中 child 插入区域时
 *
 * @param protyle 编辑器实例
 * @param sourceElements 源元素列表
 * @param targetElement 拖拽目标元素
 * @param isChild 是否为列表子级插入
 * @param isBottom 是否命中目标下半部
 * @param ctrlKey 是否按住 Ctrl 键
 * @returns 是否已处理该拖拽
 */
export const handleListItemChildDrop = async (
    protyle: IProtyle,
    sourceElements: Element[],
    targetElement: Element,
    isChild: boolean,
    isBottom: boolean,
    isCopy: boolean,
) => {
    if (!isChild || targetElement.getAttribute("data-type") !== "NodeListItem") {
        return false;
    }
    const nestedList = Array.from(targetElement.children).find(item => item.classList.contains("list"));
    let nestedTarget: Element | undefined;
    if (nestedList) {
        const liChildren = Array.from(nestedList.children).filter(item => item.classList.contains("li"));
        nestedTarget = isBottom ? liChildren[liChildren.length - 1] : liChildren[0];
    }
    if (nestedTarget && !sourceElements.includes(nestedTarget)) {
        await dragSame(protyle, sourceElements, nestedTarget, isBottom, isCopy);
        return true;
    }
    if (nestedTarget) {
        return true;
    }
    const contentBlocks = Array.from(targetElement.children).filter(item =>
        item.hasAttribute("data-node-id") && !item.classList.contains("list"));
    const lastContentBlock = contentBlocks[contentBlocks.length - 1];
    await dragSame(
        protyle,
        sourceElements,
        lastContentBlock || targetElement,
        Boolean(lastContentBlock) || isBottom,
        isCopy,
    );
    return true;
};
