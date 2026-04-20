/**
 * 统一列表状态提取函数
 *
 * 本文件实现了一次性提取所有列表操作所需状态的函数
 * 合并原有 4 个状态提取函数的逻辑，避免重复计算
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

/**
 * 用途：引入 unified 目录的快捷键匹配网关，用于把当前键盘事件与配置中的列表快捷键定义进行比较。
 * 使用范围：仅在本文件的 hotkeys 状态提取流程中使用；边界是不承担快捷键配置读取，也不向其他业务模块直接扩散 util 路径。
 * 解耦评估：理论上可把匹配函数作为参数传入 [`extractHotkeysState`](app/src/protyle/wysiwyg/keydown.list/unified/state.ts:111)，但当前它只在本文件内部被单点调用，额外参数化只会增加样板并扩大调用签名；通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/unified/imports.ts) 收敛依赖更合适。
 */
import { matchHotKey } from "./imports";
/**
 * 用途：引入 unified 目录的 DOM 属性祖先查询网关，用于识别当前选区是否位于任务列表项上下文。
 * 使用范围：仅在本文件的上下文状态提取流程中使用；边界是不封装新的 DOM 遍历策略，也不向状态对象写入额外结构。
 * 解耦评估：理论上可把“是否命中任务项”布尔值从上层传入 [`extractContextState`](app/src/protyle/wysiwyg/keydown.list/unified/state.ts:206)，但那会让中间件承担本应属于状态提取层的 DOM 判定职责；通过同层网关直接复用稳定工具函数更低耦合。
 */
import { hasClosestByAttribute } from "./imports";
/**
 * 用途：引入 unified 目录的配置读取网关，用于在快捷键状态提取时读取思源编辑器快捷键映射。
 * 使用范围：仅在本文件的 hotkeys 状态提取流程中使用；边界是不缓存配置、不订阅配置变更，也不在本文件外暴露配置系统细节。
 * 解耦评估：理论上可把 keymap 参数逐层传入 [`extractHotkeysState`](app/src/protyle/wysiwyg/keydown.list/unified/state.ts:111)，但当前 unified 键盘处理链路是同步静态调用，参数下沉会扩大接口面；通过同层网关收敛配置依赖更符合当前架构。
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：引入统一列表状态总类型，约束本文件对外导出的完整状态对象形状。
 * 使用范围：仅用于本文件的返回值与局部状态对象编排；边界是不参与运行时逻辑，也不提供 schema 校验实现。
 * 解耦评估：这是编译期类型契约，依赖注入、参数传递或事件发射都不适用于消除这类耦合；保持与同目录类型源文件同源引用，能避免类型重复定义造成漂移。
 */
import type { UnifiedListState } from "./types";
/**
 * 用途：引入快捷键状态类型，约束 hotkeys 状态提取结果结构。
 * 使用范围：仅用于本文件内部 hotkeys 相关局部数据；边界是不参与运行时导出值。
 * 解耦评估：该依赖纯属编译期类型信息，不存在通过运行时注入解耦的现实空间；继续从同目录类型文件单点引用是最准确且最低成本的方案。
 */
import type { HotkeysState } from "./types";
/**
 * 用途：引入选区状态类型，约束选区状态提取结果结构。
 * 使用范围：仅用于本文件内部 selection 状态组装；边界是不改变 DOM 查询或选区计算逻辑。
 * 解耦评估：这是静态类型依赖，无法通过事件或参数传递替代；维持与类型定义文件同源引用可避免重复声明。
 */
import type { SelectionState } from "./types";
/**
 * 用途：引入上下文状态类型，约束上下文状态提取结果结构与字面量联合范围。
 * 使用范围：仅用于本文件内部 context 状态组装；边界是不参与路由执行或命令分发。
 * 解耦评估：这是编译期契约而非运行时服务，所谓依赖注入对其不成立；从同目录类型文件引用是保持状态空间一致性的必要做法。
 */
import type { ContextState } from "./types";

/**
 * 检查选中元素是否连续
 *
 * @param selectElements - 选中的元素列表
 * @returns 是否连续
 */
const checkContinuousSelection = (selectElements: NodeListOf<Element>) => {
    for (let i = 0; i < selectElements.length - 1; i++) {
        const currentItem = selectElements[i];
        const nextItem = selectElements[i + 1];

        if (!currentItem || !nextItem) {
            continue;
        }

        if (currentItem.nextElementSibling && nextItem !== currentItem.nextElementSibling) {
            return false;
        }
    }
    return true;
};

/**
 * 检查选中元素中是否包含列表项
 *
 * @param selectElements - 选中的元素列表
 * @returns 是否包含列表项
 */
const checkHasListItem = (selectElements: NodeListOf<Element>) => {
    for (let i = 0; i < selectElements.length; i++) {
        const element = selectElements[i];
        if (element?.classList.contains("li")) {
            return true;
        }
    }
    return false;
};

/**
 * 解析块类型
 *
 * @param dataType - data-type 属性值
 * @returns 块类型
 */
const parseBlockType = (dataType: string) => {
    if (dataType === "NodeParagraph") {
        return "NodeParagraph";
    }
    if (dataType === "NodeList") {
        return "NodeList";
    }
    if (dataType === "NodeHeading") {
        return "NodeHeading";
    }
    return "other";
};

/**
 * 解析列表子类型
 *
 * @param dataSubtype - data-subtype 属性值
 * @returns 列表子类型
 */
const parseListSubtype = (dataSubtype: string) => {
    if (dataSubtype === "u" || dataSubtype === "o" || dataSubtype === "t") {
        return dataSubtype;
    }
    return null;
};

/**
 * 提取快捷键状态
 *
 * @param event - 键盘事件
 * @returns 快捷键状态
 */
const extractHotkeysState = (event: KeyboardEvent) => {
    const config = getSiyuanConfig();
    const listKeymap = config.keymap?.editor?.list;
    const insertKeymap = config.keymap?.editor?.insert;
    // 提取有序列表快捷键配置，避免在属性访问链中使用下标操作
    const orderedListKeymap = insertKeymap ? insertKeymap["ordered-list"] : undefined;

    return {
        checkToggle: listKeymap?.checkToggle?.custom
            ? matchHotKey(listKeymap.checkToggle.custom, event)
            : false,
        outdent: listKeymap?.outdent?.custom
            ? matchHotKey(listKeymap.outdent.custom, event)
            : false,
        indent: listKeymap?.indent?.custom
            ? matchHotKey(listKeymap.indent.custom, event)
            : false,
        list: insertKeymap?.list?.custom
            ? matchHotKey(insertKeymap.list.custom, event)
            : false,
        oList: orderedListKeymap?.custom
            ? matchHotKey(orderedListKeymap.custom, event)
            : false,
        check: insertKeymap?.check?.custom
            ? matchHotKey(insertKeymap.check.custom, event)
            : false,
        quote: insertKeymap?.quote?.custom
            ? matchHotKey(insertKeymap.quote.custom, event)
            : false
    };
};

/**
 * 创建默认的最小状态
 * 用于快速路径：当没有按下任何快捷键时返回
 *
 * @param hotkeys - 快捷键状态
 * @returns 最小状态对象
 */
const createMinimalState = (hotkeys: HotkeysState) => ({
    hotkeys,
    selection: {
        hasMultiple: false,
        isContinuous: false,
        firstInList: false,
        hasListItem: false,
        isSingle: true
    },
    context: {
        inListItem: false,
        inCodeBlock: false,
        hasTaskItem: false,
        hasPreviousSibling: false,
        blockType: "other",
        listSubtype: null
    }
});

/**
 * 提取选区状态
 *
 * @param selectElements - 选中的元素列表
 * @returns 选区状态
 */
const extractSelectionState = (selectElements: NodeListOf<Element>) => {
    const selectCount = selectElements.length;
    const hasMultiple = selectCount > 0;

    let firstInList = false;
    // 只有当存在多选元素且第一个元素有效时，才检查其是否在列表中
    // 这是为了避免访问空数组或 undefined 元素导致的错误
    if (hasMultiple && selectElements[0]) {
        const firstElement = selectElements[0];
        firstInList =
            firstElement.classList.contains("li") ||
            (firstElement.parentElement?.classList.contains("li") ?? false);
    }

    return {
        hasMultiple,
        isContinuous: hasMultiple ? checkContinuousSelection(selectElements) : false,
        firstInList,
        hasListItem: checkHasListItem(selectElements),
        isSingle: selectCount <= 1
    };
};

/**
 * 提取上下文状态
 *
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区
 * @param selectElements - 选中的元素列表
 * @returns 上下文状态
 */
const extractContextState = (
    nodeElement: HTMLElement,
    range: Range,
    selectElements: NodeListOf<Element>
) => {
    const taskItemElement = hasClosestByAttribute(range.startContainer, "data-subtype", "t");
    const selectCount = selectElements.length;
    const targetElement = selectCount === 1 ? selectElements[0] : nodeElement;
    const dataType = targetElement?.getAttribute("data-type") || "";
    const dataSubtype = targetElement?.getAttribute("data-subtype") || "";

    return {
        inListItem: nodeElement.parentElement?.classList.contains("li") ?? false,
        inCodeBlock: nodeElement.getAttribute("data-type") === "NodeCodeBlock",
        hasTaskItem: !!taskItemElement,
        hasPreviousSibling: !!(nodeElement.parentElement?.previousElementSibling),
        blockType: parseBlockType(dataType),
        listSubtype: parseListSubtype(dataSubtype)
    };
};

/**
 * 提取统一列表状态
 *
 * 用途：一次性提取所有列表操作所需的状态
 * 使用场景：在 listUnifiedMiddleware 中调用，用于主路由器决策
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @returns UnifiedListState - 统一列表状态
 *
 * 优化策略：
 * 1. 快速路径：如果没有按下任何快捷键，返回最小状态
 * 2. 延迟计算：只在需要时才计算复杂状态
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 此函数必须同步执行，因为：
 * 1. 需要立即读取 DOM 元素的属性和类名
 * 2. 需要同步遍历 DOM 树查找选中元素
 * 3. 作为路由决策的输入，必须在事件处理的同一帧内完成
 * 4. 异步化会导致 DOM 状态不一致和竞态条件
 */
export const extractUnifiedListState = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range
) => {
    // 步骤 1: 提取快捷键状态
    const hotkeys = extractHotkeysState(event);

    // 快速路径：如果没有按下任何快捷键，返回最小状态
    const anyHotkeyPressed = Object.values(hotkeys).some(v => v);
    if (!anyHotkeyPressed) {
        return createMinimalState(hotkeys);
    }

    // 步骤 2: 安全检查
    if (!protyle.wysiwyg) {
        return createMinimalState(hotkeys);
    }

    // 步骤 3: 获取选中元素
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");

    // 步骤 4: 提取选区状态
    const selection = extractSelectionState(selectElements);

    // 步骤 5: 提取上下文状态
    const context = extractContextState(nodeElement, range, selectElements);

    return { hotkeys, selection, context };
};
