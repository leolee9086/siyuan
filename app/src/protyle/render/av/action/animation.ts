/**
 * 用途：引入 action 子目录网关依赖。
 * 使用范围：仅在单元格动画刷新与列删除动画模块中使用。
 * 解耦评估：动画刷新需要组合 cell 渲染、DOM 查找和视图类型判断，集中从 imports.ts 取依赖更利于审计边界。
 */
import {addDragFill} from "./animation/imports";
/**
 * 用途：判断卡片式视图父容器是否应标记为空态。
 * 使用范围：仅在 gallery / kanban 局部重渲染后回写 `data-empty` 时使用。
 * 解耦评估：空态判定与单元格值结构强绑定，继续复用共享工具比在动画模块重新复制判定规则更稳妥。
 */
import {cellValueIsEmpty} from "./animation/imports";
/**
 * 用途：从当前单元格向上找到所属的属性视图根块。
 * 使用范围：仅在局部刷新时读取 `data-av-type` 以恢复正确的渲染模板。
 * 解耦评估：根块查找依赖当前 DOM 结构，放在共享工具中集中维护比在本文件手写选择器更易跟随结构变更。
 */
import {hasClosestBlock} from "./animation/imports";
/**
 * 用途：确认 emoji 图标节点和卡片父容器是否为可安全读写的 HTMLElement。
 * 使用范围：用于图标显隐判断和卡片布局空态回写两个局部 DOM 分支。
 * 解耦评估：这是通用 DOM 收窄能力，继续走共享 guard 能避免在业务模块里散布重复的 instanceof 判断。
 */
import {isHTMLElement} from "./animation/imports";
/**
 * 用途：按当前值重新生成单元格 HTML。
 * 使用范围：用于表格布局和卡片布局的局部重渲染，其中卡片布局会额外传入 viewType。
 * 解耦评估：renderCell 本身就是渲染边界，本模块只负责决定何时调用以及传什么上下文，不适合再做一层参数透传抽象。
 */
import {renderCell} from "./animation/imports";
/**
 * 用途：在替换单元格 HTML 后补回属性、快捷标记和辅助状态。
 * 使用范围：仅在普通单元格刷新分支收尾阶段使用。
 * 解耦评估：这是 renderCell 后固定存在的补充步骤，保留在当前模块串联能更完整地表达局部刷新链路。
 */
import {renderCellAttr} from "./animation/imports";
/**
 * 用途：处理列名、列图标等表头级别的局部刷新。
 * 使用范围：仅在外部传入 `headerValue` 时使用，与普通单元格刷新路径互斥。
 * 解耦评估：表头刷新和单元格刷新共享同一入口是历史约束，暂时在这里分流比拆成两个独立 action 更少侵入。
 */
import {updateHeaderCell} from "./animation/imports";
/**
 * 用途：按类型获取列图标。
 * 使用范围：属性面板列图标刷新时使用。
 * 解耦评估：列图标映射通过 animation 网关集中转发，避免直接依赖列工具。
 */
import {getColIconByType} from "./animation/imports";
/**
 * 用途：渲染 emoji 图标。
 * 使用范围：属性面板列图标为 emoji 时使用。
 * 解耦评估：emoji 渲染通过 animation 网关转发，避免直接依赖 emoji 模块。
 */
import {unicode2Emoji} from "./animation/imports";
/**
 * 用途：判断当前视图是否属于 gallery / kanban 这类卡片式布局。
 * 使用范围：用于决定 renderCell 参数签名，以及是否回写父容器的 `data-empty`。
 * 解耦评估：卡片布局判定是当前 action 子目录的本地规则，复用 guards 比在本文件维护字符串列表更不容易漂移。
 */
import { isCardLayoutView } from "./action.guards";
/**
 * 用途：把根块上的 `data-av-type` 字符串收窄为可判定的视图类型。
 * 使用范围：仅在局部刷新前读取视图类型后立即调用。
 * 解耦评估：DOM attribute 到业务类型的收窄应集中在 guard 文件，否则各模块会重复出现字符串回退逻辑。
 */
import { toAttrViewType } from "./action.guards";
/**
 * 用途：把列类型字符串收窄为 TAVCol。
 * 使用范围：属性面板列图标刷新时读取 data-type。
 * 解耦评估：通过 guard 集中收窄，避免在业务代码散落 as 断言。
 */
import { toAttrColType } from "./action.guards";

/**
 * 刷新卡片式视图中的 checkbox 值结构。
 *
 * 意图：gallery / kanban 的 aria-label 持有展示文本，局部重渲染 checkbox 时需要先把文本塞回 value。
 * 调用时机：在卡片式视图调用 renderCell 之前执行。
 * 问题/改进：这里仍依赖 aria-label 中的 HTML 片段切分，未来若 aria-label 结构调整应统一抽离解析函数。
 *
 * @param {HTMLElement} cellElement - 当前单元格元素
 * @param {IAVCellValue | undefined} value - 当前单元格值
 */
const normalizeCardLayoutCheckboxValue = (cellElement: HTMLElement, value: IAVCellValue | undefined) => {
    if (!value || value.type !== "checkbox") {
        return;
    }
    value.checkbox = {
        checked: value.checkbox?.checked || false,
        content: cellElement.getAttribute("aria-label")?.split('<div class="ft__on-surface">')[0] || "",
    };
};
/**
 * 计算当前单元格渲染时是否显示 emoji 图标。
 *
 * 意图：renderCell 需要一个布尔值表示当前是否应保留表头/卡片图标显隐状态。
 * 调用时机：在局部刷新单元格 HTML 前调用。
 * 问题/改进：如果未来图标显隐逻辑从 class 切到其它状态源，这里需要同步调整。
 *
 * @param {HTMLElement} cellElement - 当前单元格元素
 * @returns {boolean} 是否展示图标
 */
const shouldShowCellIcon = (cellElement: HTMLElement) => {
    const iconElement = cellElement.querySelector(".b3-menu__avemoji");
    if (!isHTMLElement(iconElement)) {
        return false;
    }
    return !iconElement.classList.contains("fn__none");
};

/**
 * 根据当前值刷新单元格 DOM。
 *
 * 意图：列编辑、关系回填、选择器修改等流程都需要复用同一套“最小重渲染”逻辑，而不是整块重绘。
 * 调用时机：外部已知某个单元格值变化或表头属性变化后调用。
 * 问题/改进：该实现仍依赖直接替换 innerHTML，未来若局部 diff 成本更低，可进一步细化更新粒度。
 *
 * @param {HTMLElement} cellElement - 需要刷新的单元格元素
 * @param {IAVCellValue | undefined} value - 单元格值；刷新表头时可为 undefined
 * @param {{icon?: string, name?: string, pin?: boolean, type?: TAVCol}} [headerValue] - 表头刷新时的补充信息
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const updateAttrViewCellAnimation = async (
    cellElement: HTMLElement,
    value: IAVCellValue | undefined,
    headerValue?: {
        icon?: string,
        name?: string,
        pin?: boolean,
        type?: TAVCol
    }
) => {
    if (!cellElement) {
        return;
    }
    if (headerValue) {
        updateHeaderCell(cellElement, headerValue);
        return;
    }
    if (!value) {
        return;
    }
    const hasDragFillElement = cellElement.querySelector(".av__drag-fill");
    const blockElement = hasClosestBlock(cellElement);
    if (!blockElement) {
        return;
    }

    const viewType = toAttrViewType(blockElement.getAttribute("data-av-type"));
    const isCardLayout = isCardLayoutView(viewType);
    const showIcon = shouldShowCellIcon(cellElement);
    let cardLayoutContainer: HTMLElement | null = null;
    // 卡片视图的空态标记位于单元格父容器，仅在父节点确实是可写 HTMLElement 时登记回写目标。
    if (isCardLayout && isHTMLElement(cellElement.parentElement)) {
        cardLayoutContainer = cellElement.parentElement;
    }

    // gallery 和 kanban 使用卡片式布局，刷新时需要同步 data-empty 并补齐 checkbox 展示文本。
    if (isCardLayout) {
        normalizeCardLayoutCheckboxValue(cellElement, value);
        cellElement.innerHTML = await renderCell(value, 0, showIcon, viewType);
    }

    // 卡片式布局的空态标记挂在父容器上，只有父节点确实存在且可写时才回写该状态。
    if (cardLayoutContainer) {
        const isEmpty = cellValueIsEmpty(value) ?? false;
        cardLayoutContainer.setAttribute("data-empty", isEmpty.toString());
    }

    // 普通表格布局沿用旧版 renderCell 签名，不传 viewType，避免误走卡片模板。
    if (!isCardLayout) {
        cellElement.innerHTML = await renderCell(value, 0, showIcon);
    }

    if (hasDragFillElement) {
        addDragFill(cellElement);
    }
    renderCellAttr(cellElement, value);
};

/** 把列元数据变更投影到一个数据库属性面板字段。 */
const updateAttributePanelColumn = (
    item: HTMLElement,
    headerValue: {icon?: string; name?: string; type?: TAVCol},
) => {
    const nameElement = item.querySelector(".block__logo span");
    // 名称刷新：仅当传入 name 且目标 span 存在时才回写，避免空值覆盖
    if (typeof headerValue.name !== "undefined" && nameElement) {
        nameElement.textContent = headerValue.name;
    }
    if (typeof headerValue.icon === "undefined") {
        return;
    }
    const iconElement = item.querySelector(".block__logoicon");
    const typeElement = item.querySelector<HTMLElement>(":scope > [data-type][data-col-id]");
    const rawType = typeElement?.dataset.type ?? null;
    if (!iconElement || !rawType) {
        return;
    }
    const type = toAttrColType(rawType);
    iconElement.outerHTML = headerValue.icon ?
        unicode2Emoji(headerValue.icon, "block__logoicon", true) :
        `<svg class="block__logoicon"><use xlink:href="#${getColIconByType(type)}"></use></svg>`;
};

/**
 * 同步同一数据库全部可见实例及属性面板中的字段名称和图标。
 * @同步豁免: UI构建
 */
export const updateAttrViewColAnimation = (options: {
    protyle: IProtyle,
    avID: string,
    colID: string,
    headerValue: {icon?: string; name?: string; type?: TAVCol},
}) => {
    const {protyle, avID, colID, headerValue} = options;
    // 使用 for...of 替代 forEach，保证可中断且与项目 no-for-each 规则一致
    for (const item of protyle.wysiwyg.element.querySelectorAll<HTMLElement>(
        `.av[data-av-id="${avID}"] .av__row--header .av__cell[data-col-id="${colID}"]`,
    )) {
        void updateAttrViewCellAnimation(item, undefined, headerValue);
    }
    for (const item of document.querySelectorAll<HTMLElement>(
        `.custom-attr [data-av-id="${avID}"] > .av__row[data-col-id="${colID}"]`,
    )) {
        updateAttributePanelColumn(item, headerValue);
    }
};
