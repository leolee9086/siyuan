/**
 * 用途：转义字段名称。
 * 使用范围：排序字段 Select 的 option 文案。
 * 解耦评估：转义为通用 DOM 安全能力，继续通过本域网关复用最稳妥。
 */
import {escapeHtml} from "./imports";
/** 用途：读取列类型图标；使用范围：排序字段菜单；解耦评估：经本域网关直达列元数据。 */
import {getColIconByType} from "./imports";
/** 用途：提交封闭的排序列表事务；使用范围：添加与修改排序；解耦评估：经本域网关直达现有严格命令。 */
import {submitAVSortTransaction} from "./imports";
/** 用途：定位排序 Panel；使用范围：添加排序后刷新；解耦评估：经本域网关直达定位实现。 */
import {setPosition} from "./imports";
/** 用途：渲染列 Emoji；使用范围：菜单和排序 Select；解耦评估：经本域网关直达唯一实现。 */
import {unicode2Emoji} from "./imports";
/** 用途：读取视图字段原数组；使用范围：添加排序；解耦评估：经本域网关直达元数据所有者。 */
import {getFieldsByData} from "./imports";
/** 用途：读取排序文案；使用范围：排序 HTML；解耦评估：经本域网关直达只读环境。 */
import {siyuanI18n} from "./imports";
/** 用途：创建添加排序菜单；使用范围：addSort；解耦评估：实例化集中在无状态工厂，不持有菜单状态。 */
import {createSortMenu} from "./menu.factory";
/** 用途：标注 Sort 添加菜单的完整生命周期输入；使用范围：本领域实现；解耦评估：纯类型依赖。 */
import type {AddSortOptions} from "./sorting.types";
/** 用途：标注 Sort Panel 绑定的完整生命周期输入；使用范围：本领域实现；解耦评估：纯类型依赖。 */
import type {SortPanelBinding} from "./sorting.types";

/** 判断字段已参与排序或属于禁止排序的行号列，供菜单构建阶段排除无效选项。 */
const isColumnAlreadySorted = (data: IAV, column: IAVColumn) => {
    if (column.type === "lineNumber") {
        return true;
    }
    return data.view.sorts.some((sort) => sort.column === column.id);
};

/** 将 Select 值收窄为排序协议值，并让异常 DOM 值在事务提交前显式失败。 */
const parseSortOrder = (value: string) => {
    if (value !== "ASC" && value !== "DESC") {
        throw new Error(`Unsupported AV sort order: ${value}`);
    }
    return value;
};

/** 按列身份取得当前排序项，数据与 DOM 身份失配时在提交前明确失败。 */
const requireSortByColumn = (sorts: IAVSort[], columnId: string | null) => {
    const sort = sorts.find((candidate) => candidate.column === columnId);
    if (!sort) {
        throw new Error(`AV sort item does not exist for column: ${columnId ?? "<missing>"}`);
    }
    return sort;
};

/**
 * 作用：处理排序列变更，更新排序指向并清理日期端点
 * 意图：将列切换的副作用（data-id 同步、dateEndpoint 清理）收敛到独立函数，避免在主流程嵌套
 * 调用时机：handleSortChange 识别到 sortColumn 类型时调用
 * 问题/改进：当前通过额外查询 old/new 列类型决定是否清理，后续可由列元数据直接驱动
 * @参数豁免: 遗留代码
 */
const handleSortColumnChange = (sort: IAVSort, sortElement: HTMLElement, fields: IAVColumn[], item: HTMLSelectElement) => {
    const oldColumn = fields.find((column) => column.id === sort.column);
    const newColumn = fields.find((column) => column.id === item.value);
    sort.column = item.value;
    sortElement.setAttribute("data-id", item.value);
    const shouldClearDateEndpoint = oldColumn?.type !== "date" || newColumn?.type !== "date";
    if (shouldClearDateEndpoint) {
        delete sort.dateEndpoint;
    }
    return true;
};

/**
 * 作用：处理日期端点变更
 * 意图：将 end/start 的赋值与清理逻辑独立，避免在主流程使用 else
 * 调用时机：handleSortChange 识别到 sortDateEndpoint 类型时调用
 */
const handleSortDateEndpointChange = (sort: IAVSort, item: HTMLSelectElement) => {
    // 日期端点为 end 时需显式标记，否则清理旧值以回退到 start
    if (item.value === "end") {
        sort.dateEndpoint = "end";
        return;
    }
    delete sort.dateEndpoint;
};

/**
 * 作用：处理排序方向变更
 * 意图：将方向解析与赋值独立，避免主流程分支膨胀
 * 调用时机：handleSortChange 识别到 sortOrder 类型时调用
 */
const handleSortOrderChange = (sort: IAVSort, item: HTMLSelectElement) => {
    sort.order = parseSortOrder(item.value);
};

/** 处理一个排序 Select 的字段或方向变更，并提交变更前后的完整列表。 */
const handleSortChange = ({protyle, menuElement, data, blockID}: SortPanelBinding, event: Event) => {
    if (!(event.currentTarget instanceof HTMLSelectElement)) {
        throw new Error("AV sort change target must be a select element");
    }
    const item = event.currentTarget;
    const sortElement = item.parentElement;
    if (!sortElement) {
        throw new Error("AV sort select must belong to a sort item");
    }
    const colId = sortElement.getAttribute("data-id");
    const oldSort = JSON.parse(JSON.stringify(data.view.sorts));
    const sort = requireSortByColumn(data.view.sorts, colId);
    const fields = getFieldsByData(data);
    let reRender = false;
    const type = item.dataset.type;
    // 列切换需同步 data-id 并决定是否重绘整个排序面板
    if (type === "sortColumn") {
        reRender = handleSortColumnChange(sort, sortElement, fields, item);
    }
    // 日期端点切换仅影响当前排序项的 dateEndpoint 字段
    if (type === "sortDateEndpoint") {
        handleSortDateEndpointChange(sort, item);
    }
    // 方向切换直接更新 order 字段
    if (type === "sortOrder") {
        handleSortOrderChange(sort, item);
    }
    const isSupportedType = type === "sortColumn" || type === "sortDateEndpoint" || type === "sortOrder";
    if (!isSupportedType) {
        throw new Error(`Unsupported AV sort control: ${type ?? "<missing>"}`);
    }
    submitAVSortTransaction(protyle, [{
        action: "setAttrViewSorts",
        avID: data.id,
        data: data.view.sorts,
        blockID
    }], [{
        action: "setAttrViewSorts",
        avID: data.id,
        data: oldSort,
        blockID
    }]);
    if (!reRender) {
        return;
    }
    menuElement.innerHTML = getSortsHTML(fields, data.view.sorts);
    bindSortsEvent({protyle, menuElement, data, blockID});
};

/** 为单个排序项生成保持字段顺序和当前选择状态的 option HTML。 */
const getSortOptionsHTML = (columns: IAVColumn[], selectedColumnId: string) => {
    let html = "";
    for (const column of columns) {
        html += `<option value="${column.id}" ${column.id === selectedColumnId ? "selected" : ""}>${column.icon && unicode2Emoji(column.icon)}${escapeHtml(column.name)}</option>`;
    }
    return html;
};

/** 按既有顺序追加排序、提交事务、重绘绑定并恢复 Panel 位置。 */
const appendSortAndRefreshPanel = (options: AddSortOptions, fields: IAVColumn[], column: IAVColumn) => {
    const oldSorts = Object.assign([], options.data.view.sorts);
    options.data.view.sorts.push({
        column: column.id,
        order: "ASC",
    });
    submitAVSortTransaction(options.protyle, [{
        action: "setAttrViewSorts",
        avID: options.data.id,
        data: options.data.view.sorts,
        blockID: options.blockID,
    }], [{
        action: "setAttrViewSorts",
        avID: options.data.id,
        data: oldSorts,
        blockID: options.blockID,
    }]);
    options.menuElement.innerHTML = getSortsHTML(fields, options.data.view.sorts);
    bindSortsEvent({
        blockID: options.blockID,
        data: options.data,
        menuElement: options.menuElement,
        protyle: options.protyle,
    });
    setPosition(options.menuElement, options.tabRect.right - options.menuElement.clientWidth,
        options.tabRect.bottom, options.tabRect.height, 0);
};

/**
 * 创建可用字段菜单，并在字段点击时追加排序和刷新当前排序 Panel。
 * @同步豁免: UI构建
 */
export const addSort = (options: AddSortOptions) => {
    const menu = createSortMenu();
    const fields = getFieldsByData(options.data);
    for (const column of fields) {
        // 已排序字段和行号列没有可重复添加的排序语义，仅为其余字段创建菜单项。
        if (!isColumnAlreadySorted(options.data, column)) {
            menu.addItem({
                label: column.name,
                iconHTML: column.icon ? unicode2Emoji(column.icon, "b3-menu__icon", true) : `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(column.type)}"></use></svg>`,
                /** @内联回调 */
                click: () => appendSortAndRefreshPanel(options, fields, column)
            });
        }
    }
    menu.open({
        x: options.rect.left,
        y: options.rect.bottom,
        h: options.rect.height,
    });
};

/**
 * 为当前排序 Panel 绑定字段和方向 Select，变更后原地更新视图数据并提交精确快照。
 * @同步豁免: 生命周期
 */
export const bindSortsEvent = ({protyle, menuElement, data, blockID}: SortPanelBinding) => {
    for (const item of menuElement.querySelectorAll<HTMLSelectElement>("select")) {
        item.addEventListener("change", handleSortChange.bind(null, {protyle, menuElement, data, blockID}));
    }
};

/**
 * 将列和排序列表投影为排序 Panel HTML，保持列表顺序和当前选择状态。
 * @同步豁免: UI构建
 */
export const getSortsHTML = (columns: IAVColumn[], sorts: IAVSort[]) => {
    let html = "";
    for (const item of sorts) {
        const column = columns.find((candidate) => candidate.id === item.column);
        const dateEndpointHTML = column?.type === "date" ? `
    <span class="fn__space"></span>
    <select class="b3-select" data-type="sortDateEndpoint" style="margin: 4px 0">
        <option value="start" ${item.dateEndpoint !== "end" ? "selected" : ""}>${siyuanI18n.startDate}</option>
        <option value="end" ${item.dateEndpoint === "end" ? "selected" : ""}>${siyuanI18n.endDate}</option>
    </select>` : "";
        html += `<button draggable="true" class="b3-menu__item" data-id="${item.column}">
    <svg class="b3-menu__icon fn__grab"><use xlink:href="#iconDrag"></use></svg>
    <select class="b3-select fn__flex-1" data-type="sortColumn" style="margin: 4px 0">
        ${getSortOptionsHTML(columns, item.column)}
    </select>${dateEndpointHTML}
    <span class="fn__space"></span>
    <select class="b3-select" data-type="sortOrder" style="margin: 4px 0">
        <option value="ASC" ${item.order === "ASC" ? "selected" : ""}>${siyuanI18n.asc}</option>
        <option value="DESC" ${item.order === "DESC" ? "selected" : ""}>${siyuanI18n.desc}</option>
    </select>
    <svg class="b3-menu__action" data-type="removeSort"><use xlink:href="#iconTrashcan"></use></svg>
</button>`;
    }
    return `<div class="b3-menu__items">
<button class="b3-menu__item" data-type="nobg">
    <span class="block__icon" style="padding: 8px;margin-left: -4px;" data-type="go-config">
        <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span class="b3-menu__label ft__center">${siyuanI18n.sort}</span>
</button>
<button class="b3-menu__separator"></button>
${html}
<button class="b3-menu__item${sorts.length === columns.length ? " fn__none" : ""}" data-type="addSort">
    <svg class="b3-menu__icon"><use xlink:href="#iconAdd"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.addSort}</span>
</button>
<button class="b3-menu__item b3-menu__item--warning${html ? "" : " fn__none"}" data-type="removeSorts">
    <svg class="b3-menu__icon"><use xlink:href="#iconTrashcan"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.removeSorts}</span>
</button>
</div>`;
};
