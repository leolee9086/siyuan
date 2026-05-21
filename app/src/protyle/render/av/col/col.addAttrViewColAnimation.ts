/**
 * 用途：emoji 转换工具，用于在列头部显示自定义图标
 * 使用范围：在渲染列头部时将 unicode 转换为 HTML 元素
 * 解耦评估：纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { unicode2Emoji } from "./imports";

/**
 * 用途：设置浮动面板位置，用于定位编辑面板
 * 使用范围：在打开编辑面板后设置其显示位置
 * 解耦评估：纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { setPosition } from "./imports";

/**
 * 用途：获取列编辑的 HTML 内容
 * 使用范围：在需要显示列编辑界面时生成 HTML
 * 解耦评估：同一功能模块内的UI构建函数，直接导入合理
 */
import { getEditHTML } from "./imports";

/**
 * 用途：绑定列编辑事件
 * 使用范围：在列编辑界面渲染后绑定交互事件
 * 解耦评估：同一功能模块内的事件绑定函数，直接导入合理
 */
import { bindEditEvent } from "./imports";

/**
 * 用途：根据列类型获取对应的图标
 * 使用范围：在渲染列头部时显示类型图标
 * 解耦评估：纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { getColIconByType } from "./imports";

/**
 * 用途：根据列类型获取对应的名称
 * 使用范围：在渲染列信息时显示类型名称
 * 解耦评估：纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { getColNameByType } from "./imports";

/**
 * 用途：根据列类型生成默认的列数据
 * 使用范围：在创建新列时生成初始数据
 * 解耦评估：纯工具函数，通过参数传递即可，当前导入方式合理
 */
import { genColDataByType } from "./imports";

/**
 * 用途：打开属性视图面板，用于在添加列动画完成后打开列编辑面板
 * 使用范围：在 addAttrViewColAnimation 函数中，当列添加动画完成后需要打开编辑面板时调用
 * 解耦评估：当前通过 imports.ts 转发已实现模块边界管理。该函数是UI流程的核心操作，
 * 理论上可通过事件系统解耦，但会增加复杂度且收益有限，建议保持当前方式。
 */
import { openMenuPanel } from "./imports";

/**
 * 用途：从属性视图数据中获取字段列表
 * 使用范围：在需要访问视图字段信息时使用
 * 解耦评估：数据访问函数，直接导入合理
 */
import { getFieldsByData } from "./imports";

/**
 * 用途：获取全局菜单对象
 * 使用范围：在需要检查菜单是否存在时使用
 * 解耦评估：封装window.siyuan.menus访问，当前导入方式合理
 */
import { getSiyuanMenus } from "./imports";

/**
 * 用途：移除全局菜单
 * 使用范围：在打开新面板后清理旧菜单
 * 解耦评估：封装window.siyuan.menus.menu.remove()调用，当前导入方式合理
 */
import { removeSiyuanMenu } from "./imports";

/**
 * 作用：为表格视图的行添加单元格
 * 意图：在指定位置插入新列的单元格
 * @同步豁免: UI构建
 */
const addCellToTableRow = (params: {
    item: Element;
    previousID: string;
    icon: string | undefined;
    id: string;
    type: TAVCol;
    name: string;
}): void => {
    let previousElement: Element | null = params.item.querySelector(`[data-col-id="${params.previousID}"]`);
    
    if (!params.previousID) {
        const firstCell = params.item.querySelector(".av__cell");
        previousElement = firstCell ? firstCell.previousElementSibling : null;
    }
    
    if (!previousElement) {
        return;
    }
    
    const isHeaderRow = params.item.classList.contains("av__row--header");
    if (!isHeaderRow) {
        previousElement.insertAdjacentHTML("afterend", '<div class="av__cell" style="width: 200px"><span class="av__pulse"></span></div>');
        return;
    }
    
    const iconHTML = params.icon
        ? unicode2Emoji(params.icon, "av__cellheadericon", true)
        : `<svg class="av__cellheadericon"><use xlink:href="#${getColIconByType(params.type)}"></use></svg>`;
    const html = `<div class="av__cell av__cell--header" draggable="true" data-icon="${params.icon || ""}" data-col-id="${params.id}" data-dtype="${params.type}" data-wrap="false" style="width: 200px;">
    ${iconHTML}
    <span class="av__celltext fn__flex-1">${params.name}</span>
    <div class="av__widthdrag"></div>
</div>`;
    previousElement.insertAdjacentHTML("afterend", html);
};

/**
 * 作用：为表格视图添加新列
 * 意图：遍历所有行并添加单元格
 * @同步豁免: UI构建
 */
const addColumnToTableView = (params: {
    blockElement: Element;
    previousID: string;
    icon: string | undefined;
    id: string;
    type: TAVCol;
    name: string;
}): void => {
    const rows = params.blockElement.querySelectorAll(".av__row");
    for (const item of rows) {
        addCellToTableRow({
            item,
            previousID: params.previousID,
            icon: params.icon,
            id: params.id,
            type: params.type,
            name: params.name
        });
    }
};

/**
 * 作用：为自定义属性视图添加属性行
 * 意图：在自定义属性列表中添加新的属性项
 * @同步豁免: UI构建
 */
const addRowToCustomView = (params: {
    blockElement: Element;
    nodeId: string | null;
    id: string;
    type: TAVCol;
}): void => {
    const hrElement = params.blockElement.querySelector(".fn__hr");
    if (!hrElement) {
        return;
    }
    
    const html = `<div class="block__icons av__row" data-id="${params.nodeId}" data-col-id="${params.id}">
    <div class="block__icon" draggable="true"><svg><use xlink:href="#iconDrag"></use></svg></div>
    <div class="block__logo block__logo--icon ariaLabel fn__pointer" data-type="editCol" data-position="parentW" aria-label="${getColNameByType(params.type)}">
        <svg class="block__logoicon"><use xlink:href="#${getColIconByType(params.type)}"></use></svg>
        <span>${getColNameByType(params.type)}</span>
    </div>
    <div data-col-id="${params.id}" data-block-id="${params.nodeId}" data-type="${params.type}" data-options="[]" class="fn__flex-1 fn__flex">
        <div class="fn__flex-1"></div>
    </div>
</div>`;
    hrElement.insertAdjacentHTML("beforebegin", html);
};

/**
 * 作用：更新已存在的编辑面板
 * 意图：当面板已打开时更新其内容和位置
 * @同步豁免: UI构建
 */
const updateExistingPanel = (params: {
    menuElement: Element;
    protyle: IProtyle;
    data: IAV;
    colId: string;
    blockElement: Element;
    nodeId: string | null;
}): void => {
    if (!(params.menuElement instanceof HTMLElement)) {
        return;
    }
    
    params.menuElement.innerHTML = getEditHTML({
        protyle: params.protyle,
        data: params.data,
        colId: params.colId,
        isCustomAttr: false
    });
    
    bindEditEvent({
        protyle: params.protyle,
        data: params.data,
        menuElement: params.menuElement,
        isCustomAttr: false,
        blockID: params.nodeId || ""
    });
    
    const viewsElement = params.blockElement.querySelector(".av__views");
    if (!viewsElement) {
        return;
    }
    
    const tabRect = viewsElement.getBoundingClientRect();
    if (!tabRect) {
        return;
    }
    
    setPosition(params.menuElement, tabRect.right - params.menuElement.clientWidth, tabRect.bottom, tabRect.height);
};

/**
 * 作用：处理编辑面板的显示逻辑
 * 意图：更新现有面板或打开新面板，并清理旧菜单
 * @同步豁免: UI构建
 */
const handlePanelDisplay = (params: {
    menuElement: Element | null;
    protyle: IProtyle;
    data: IAV | undefined;
    colId: string;
    blockElement: Element;
    nodeId: string | null;
    isTableView: boolean;
    previousID: string;
    type: TAVCol;
    name: string;
}): void => {
    /* 检查是否可以更新现有面板：需要面板存在、有数据、且是表格视图 */
    if (params.menuElement && params.data && params.isTableView) {
        updateExistingPanel({
            menuElement: params.menuElement,
            protyle: params.protyle,
            data: params.data,
            colId: params.colId,
            blockElement: params.blockElement,
            nodeId: params.nodeId
        });
        return;
    }
    
    let colData: IAVColumn | undefined;
    if (params.data) {
        const fields = getFieldsByData(params.data);
        colData = fields.find((item) => item.id === params.colId);
    }
    
    openMenuPanel({
        protyle: params.protyle,
        blockElement: params.blockElement,
        type: "edit",
        colId: params.colId,
        editData: {
            previousID: params.previousID,
            colData: colData || genColDataByType(params.type, params.colId, params.name),
        }
    });
    
    const menus = getSiyuanMenus();
    
    /* 检查菜单对象是否存在：如果存在则移除旧菜单，避免多个菜单同时显示 */
    if (menus?.menu) {
        removeSiyuanMenu();
    }
};

/**
 * 作用：为属性视图添加新列并显示编辑动画
 * 意图：在用户添加新列时，动态插入列单元格并打开编辑面板
 * 调用时机：用户通过 UI 操作添加新列时调用
 * @同步豁免: UI构建 - 需要同步操作 DOM 以确保动画效果的连贯性
 */
export const addAttrViewColAnimation = (options: {
    blockElement: Element;
    protyle: IProtyle;
    type: TAVCol;
    name: string;
    id: string;
    icon?: string;
    previousID: string;
    data?: IAV;
}): void => {
    if (!options.blockElement) {
        return;
    }
    
    const nodeId = options.blockElement.getAttribute("data-node-id");
    const isTableView = options.blockElement.classList.contains("av");
    
    if (isTableView) {
        addColumnToTableView({
            blockElement: options.blockElement,
            previousID: options.previousID,
            icon: options.icon,
            id: options.id,
            type: options.type,
            name: options.name
        });
    }
    
    if (!isTableView) {
        addRowToCustomView({
            blockElement: options.blockElement,
            nodeId,
            id: options.id,
            type: options.type
        });
    }
    
    const menuElement = document.querySelector(".av__panel .b3-menu");
    
    handlePanelDisplay({
        menuElement,
        protyle: options.protyle,
        data: options.data,
        colId: options.id,
        blockElement: options.blockElement,
        nodeId,
        isTableView,
        previousID: options.previousID,
        type: options.type,
        name: options.name
    });
};
