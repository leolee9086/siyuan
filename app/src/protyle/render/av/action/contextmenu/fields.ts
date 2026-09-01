/** 用途：安全转义字段标题。使用范围：fields 子菜单标签。解耦评估：HTML 转义应继续复用共享工具。 */
import { escapeHtml } from "./imports";
/** 用途：读取列类型图标。使用范围：表格字段子菜单。解耦评估：图标映射由 col 模块维护更稳定。 */
import { getColIconByType } from "./imports";
/** 用途：收窄 DOM 查询结果。使用范围：字段图标和字段节点校验。解耦评估：DOM 守卫继续走共享网关即可。 */
import { isHTMLElement } from "./imports";
/** 用途：把字段单元格切入编辑态。使用范围：fields 子菜单点击。解耦评估：单元格编辑入口由 cell 模块维护更一致。 */
import { popTextCell } from "./imports";
/** 用途：读取字段菜单文案。使用范围：卡片字段编辑态提示文案。解耦评估：文案对象经共享网关转发即可。 */
import { siyuanI18n } from "./imports";
/** 用途：渲染 emoji 图标 HTML。使用范围：表格字段子菜单图标。解耦评估：图标渲染继续复用 emoji 模块能力即可。 */
import { unicode2Emoji } from "./imports";
/** 用途：把字段 data-dtype 收窄为业务列类型。使用范围：fields 子菜单构建阶段。解耦评估：列类型收窄不应在业务文件内重复实现。 */
import { toAttrColType } from "./imports";
/** 用途：读取右键菜单共享上下文类型。使用范围：fields 子菜单构建阶段。解耦评估：类型集中在同层 types.ts 能避免局部重复定义。 */
import type { AttrViewContextmenuState } from "./types";

/**
 * 作用：收集一组字段对应的已选单元格。
 * 意图：字段编辑菜单点击后要把同列或同字段的所有已选单元格一起送入编辑态，因此需要先稳定收集目标节点。
 * 调用时机：构建字段编辑子菜单时调用。
 * 问题/改进：当前仍通过 CSS selector 从 DOM 反查选择范围，后续可考虑复用显式选择状态。
 */
const collectSelectedFieldCells = (blockElement: Element, selector: string) => {
    const selectElements: HTMLElement[] = [];
    const selectCandidates = blockElement.querySelectorAll(selector);
    for (const selectCandidate of selectCandidates) {
        if (!isHTMLElement(selectCandidate)) {
            continue;
        }
        selectElements.push(selectCandidate);
    }
    return selectElements;
};

/**
 * 作用：读取表格字段菜单项的标题文本。
 * 意图：表头单元格的 `.av__celltext` 承载真实列名，需要在菜单里安全展示。
 * 调用时机：构建 table 字段子菜单时调用。
 * 问题/改进：当前只读取纯文本，未保留更复杂的富文本表头信息。
 */
const getTableFieldLabel = (cellElement: HTMLElement) => {
    const textCandidate = cellElement.querySelector(".av__celltext");
    if (!isHTMLElement(textCandidate)) {
        return "";
    }
    return escapeHtml(textCandidate.textContent?.trim() || "");
};

/**
 * 作用：生成表格字段菜单项图标。
 * 意图：优先复用列自定义 emoji，没有时回退到列类型图标，保持与旧菜单一致的视觉反馈。
 * 调用时机：构建 table 字段子菜单时调用。
 * 问题/改进：当前图标 HTML 仍由字符串拼装，后续如菜单组件支持节点型图标可再收敛。
 */
const getTableFieldIconHTML = (cellElement: HTMLElement, type: TAVCol) => {
    const icon = cellElement.dataset.icon;
    if (icon) {
        return unicode2Emoji(icon, "b3-menu__icon", true);
    }
    return `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(type)}"></use></svg>`;
};

/**
 * 作用：读取卡片字段菜单项的标题文本。
 * 意图：gallery / kanban 的 aria-label 同时承载展示文案和提示片段，这里沿用旧实现截掉附加说明部分。
 * 调用时机：构建卡片字段子菜单时调用。
 * 问题/改进：当前依赖 aria-label 里固定的 HTML 片段分隔符，后续若结构变化需同步调整。
 */
const getCardFieldLabel = (cellElement: HTMLElement) => {
    const ariaLabel = cellElement.getAttribute("aria-label") || "";
    return escapeHtml(ariaLabel.split('<div class="ft__on-surface">')[0] ?? "");
};

/**
 * 作用：生成卡片字段菜单项图标 HTML。
 * 意图：gallery / kanban 的字段图标来自字段标题区域的首个子节点，这里克隆后复用到菜单图标。
 * 调用时机：构建卡片字段子菜单时调用。
 * 问题/改进：当前仍依赖 `.av__gallery-tip, .av__gallery-name` 的 DOM 结构。
 */
const getCardFieldIconHTML = (cellElement: HTMLElement) => {
    const fieldHeaderElement = cellElement.parentElement?.querySelector(".av__gallery-tip, .av__gallery-name");
    if (!fieldHeaderElement) {
        return "";
    }
    const iconCandidate = fieldHeaderElement.firstElementChild?.cloneNode(true);
    if (!isHTMLElement(iconCandidate)) {
        return "";
    }
    iconCandidate.classList.add("b3-menu__icon");
    return iconCandidate.outerHTML;
};

/**
 * 作用：把卡片字段区域切入编辑展开态。
 * 意图：卡片视图字段编辑除了聚焦单元格外，还要同步显示字段区域和编辑按钮提示文案。
 * 调用时机：card 字段子菜单项点击后调用。
 * 问题/改进：当前仍直接改 DOM class/aria-label，未来若 gallery 字段区组件化可再收敛。
 */
const activateCardFieldEditing = (rowElement: HTMLElement) => {
    const galleryFieldsElement = rowElement.querySelector(".av__gallery-fields");
    // 只有存在字段容器时才补上编辑态 class，避免在异常 DOM 上抛错。
    if (isHTMLElement(galleryFieldsElement)) {
        galleryFieldsElement.classList.add("av__gallery-fields--edit");
    }
    const galleryEditElement = rowElement.querySelector('[data-type="av-gallery-edit"]');
    // 只有当前卡片提供编辑按钮时，才同步更新按钮提示文案。
    if (isHTMLElement(galleryEditElement)) {
        galleryEditElement.setAttribute("aria-label", siyuanI18n.hideEmptyFields);
    }
};

/**
 * 作用：把卡片字段对应的已选单元格切入编辑态。
 * 意图：保持卡片视图右键字段菜单会先展开字段区，再进入对应字段编辑的原行为。
 * 调用时机：gallery / kanban 字段子菜单项点击后调用。
 * 问题/改进：当前仍共用当前右键行的字段展开状态，后续可评估是否需要同步所有已选卡片。
 */
const handleCardFieldClick = (protyle: IProtyle, rowElement: HTMLElement, selectElements: HTMLElement[]) => {
    activateCardFieldEditing(rowElement);
    popTextCell(protyle, selectElements);
};

/**
 * 作用：构建表格视图字段编辑子菜单项。
 * 意图：按表头定义生成可编辑字段列表，并把多选范围内同列单元格关联到同一个菜单动作。
 * 调用时机：字段菜单在 table 视图下构建时调用。
 * 问题/改进：当前字段顺序直接继承表头 DOM 顺序。
 */
const buildTableFieldSubmenu = (protyle: IProtyle, state: AttrViewContextmenuState) => {
    const editAttrSubmenu: IMenu[] = [];
    const rowParentElement = state.rowElement.parentElement;
    if (!rowParentElement) {
        return editAttrSubmenu;
    }
    const headerCellCandidates = rowParentElement.querySelectorAll(".av__row--header .av__cell");
    for (const headerCellCandidate of headerCellCandidates) {
        if (!isHTMLElement(headerCellCandidate)) {
            continue;
        }
        const type = toAttrColType(headerCellCandidate.getAttribute("data-dtype"));
        if (type === "updated" || type === "created") {
            continue;
        }
        const colId = headerCellCandidate.dataset.colId;
        if (!colId) {
            continue;
        }
        const selectElements = collectSelectedFieldCells(
            state.blockElement,
            `.av__row--select:not(.av__row--header) .av__cell[data-col-id="${colId}"]`
        );
        editAttrSubmenu.push({
            iconHTML: getTableFieldIconHTML(headerCellCandidate, type),
            label: getTableFieldLabel(headerCellCandidate),
            /** 点击编辑单元格文本内容 */
            click: () => {
                popTextCell(protyle, selectElements);
            },
        });
    }
    return editAttrSubmenu;
};

/**
 * 作用：构建卡片视图字段编辑子菜单项。
 * 意图：按当前卡片的字段展示顺序生成菜单项，并把同字段的已选卡片单元格关联到同一个编辑动作。
 * 调用时机：字段菜单在 gallery / kanban 视图下构建时调用。
 * 问题/改进：当前字段顺序直接继承当前右键卡片 DOM 顺序。
 */
const buildCardFieldSubmenu = (protyle: IProtyle, state: AttrViewContextmenuState) => {
    const editAttrSubmenu: IMenu[] = [];
    const fieldCellCandidates = state.rowElement.querySelectorAll(".av__cell");
    for (const fieldCellCandidate of fieldCellCandidates) {
        if (!isHTMLElement(fieldCellCandidate)) {
            continue;
        }
        const type = toAttrColType(fieldCellCandidate.getAttribute("data-dtype"));
        if (type === "updated" || type === "created") {
            continue;
        }
        const fieldId = fieldCellCandidate.dataset.fieldId;
        if (!fieldId) {
            continue;
        }
        const selectElements = collectSelectedFieldCells(
            state.blockElement,
            `.av__gallery-item--select .av__cell[data-field-id="${fieldId}"]`
        );
        editAttrSubmenu.push({
            iconHTML: getCardFieldIconHTML(fieldCellCandidate),
            label: getCardFieldLabel(fieldCellCandidate),
            /** 点击编辑卡片字段 */
            click: () => {
                handleCardFieldClick(protyle, state.rowElement, selectElements);
            },
        });
    }
    return editAttrSubmenu;
};

const FIELD_SUBMENU_BUILDERS = new Map<TAVView, (
    protyle: IProtyle,
    state: AttrViewContextmenuState,
) => IMenu[]>([
    ["table", buildTableFieldSubmenu],
    ["gallery", buildCardFieldSubmenu],
    ["kanban", buildCardFieldSubmenu],
]);

/**
 * 作用：构建右键菜单中的字段编辑子菜单。
 * 意图：把 table 与 card 视图的字段菜单构建规则隔离开，避免右键入口继续膨胀。
 * 调用时机：`appendEditableContextmenuItems` 在加入 fields 菜单项前调用。
 * 问题/改进：当前仍按 DOM 顺序构建字段菜单，若未来存在字段排序需求，应在这里统一调整。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const buildFieldEditSubmenu = (protyle: IProtyle, state: AttrViewContextmenuState) => {
    const submenuBuilder = FIELD_SUBMENU_BUILDERS.get(state.viewType);
    if (!submenuBuilder) {
        return [];
    }
    return submenuBuilder(protyle, state);
};
