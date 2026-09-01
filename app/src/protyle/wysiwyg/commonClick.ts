import { hasClosestBlock, hasClosestByClassName } from "../util/hasClosest";
import {openFileAttr} from "../../menus/commonMenuItem/fileAttr/openFileAttr";
import {openAttr} from "../../menus/commonMenuItem/fileAttr/openAttr";
import { isMobile } from "../../util/platform/functions";
import { isOnlyMeta } from "../util/compatibility";

/**
 * 处理 protyle 属性区域（书签、命名、别名、备注等）的点击事件。
 * 根据点击上下文决定打开全局搜索、文件属性面板或块属性面板。
 * 由 commonClick 在匹配到各类 protyle-attr 元素时调用。
 * @同步豁免: DOM 点击事件处理器，需同步返回以控制事件冒泡 */
const handleCommonAttrClick = (
    event: MouseEvent & { target: HTMLElement },
    protyle: IProtyle,
    type: string,
    element: HTMLElement,
    data?: IObject,
    searchText?: string
) => {
    event.stopPropagation();
    const isM = isMobile();
    // 桌面端按住 Meta/Ctrl 点击带文本的属性时，触发全局搜索而非打开属性面板
    if (searchText && !isM && isOnlyMeta(event)) {
        protyle.app.openGlobalSearch(searchText, true);
        return true;
    }

    if (data) {
        openFileAttr(data, type, protyle);
        return true;
    }

    // 回退到块级属性面板：属性元素的祖父节点即为块元素
    if (element.parentElement?.parentElement) {
        openAttr(element.parentElement.parentElement, type, protyle);
    }
    return true;
};

/** 取得数据库属性图标所属的块属性容器；DOM 不完整时直接暴露错误。 */
const getDatabaseAttrContainer = (element: HTMLElement) => {
    const attrContainer = element.parentElement?.parentElement;
    if (!attrContainer) {
        throw new Error("Cannot resolve the database attribute container");
    }
    return attrContainer;
};

/** 处理数据库属性入口：按配置优先使用编辑器内固定面板，必要时定位到对应块或展开具体视图。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 点击事件必须同步决定是否停止冒泡和切换面板。 */
const handleDatabaseAttrClick = (options: {
    event: MouseEvent & {target: HTMLElement};
    protyle: IProtyle;
    element: HTMLElement;
    data?: IObject;
}) => {
    const {event, protyle, element, data} = options;
    event.stopPropagation();
    // 点击目标可能落在某个具体数据库视图上，提取其 avID 以便精准展开该视图
    const avIDElement = event.target.closest("[data-av-id]") as HTMLElement;
    const avID = avIDElement && element.contains(avIDElement) ? avIDElement.dataset.avId : "";
    // 仅在启用固定数据库面板且点击模式为「聚焦块并展开数据库面板」时复用编辑器内面板
    const databaseAttributePanel = window.siyuan.config.editor.databaseAttrShow &&
        window.siyuan.config.editor.databaseAttrClickMode === 0 &&
        protyle.databaseAttributePanel;
    if (!databaseAttributePanel) {
        // 未启用固定面板：文件属性上下文打开文件级属性，否则回退到块级属性面板
        if (data) {
            openFileAttr(data, "av", protyle);
        } else {
            openAttr(getDatabaseAttrContainer(element), "av", protyle);
        }
        return true;
    }
    if (data) {
        // 文件属性上下文：存在具体数据库视图时直接展开该视图，否则切换整个面板
        if (avID) {
            databaseAttributePanel.expand(avID, true);
        } else {
            databaseAttributePanel.toggle();
        }
        return true;
    }
    const blockElement = hasClosestBlock(element);
    const blockID = blockElement?.getAttribute("data-node-id");
    if (!blockID) {
        throw new Error("Cannot resolve the block for a database attribute click");
    }
    // 当前显示全部内容且点击根块属性时直接切换固定面板，否则退出聚焦并在返回后展开对应视图
    if (protyle.block.showAll && blockID === protyle.block.id) {
        if (avID) {
            databaseAttributePanel.expand(avID, true);
        } else {
            databaseAttributePanel.toggle();
        }
        return true;
    }
    protyle.getInstance().zoomOut({
        id: blockID,
        callback: avID ? () => databaseAttributePanel.expand(avID, true) : undefined,
    });
    return true;
};

/**
 * protyle 属性区域的统一点击分发器。
 * 依次检测点击目标是否命中书签、命名、数据库视图、别名、备注等属性元素，
 * 命中后委托 handleCommonAttrClick 处理。
 * 在 wysiwyg 的 click 事件监听中调用，用于拦截属性区域的点击。
 * @同步豁免: 需要绝对同步的DOM访问 — 点击事件处理器，需同步返回以控制事件传播 */
export const commonClick = (event: MouseEvent & {
    target: HTMLElement
}, protyle: IProtyle, data?: IObject) => {
    let element = hasClosestByClassName(event.target, "protyle-attr--bookmark");
    if (element) {
        return handleCommonAttrClick(event, protyle, "bookmark", element, data, element.textContent.trim());
    }

    element = hasClosestByClassName(event.target, "protyle-attr--name");
    if (element) {
        return handleCommonAttrClick(event, protyle, "name", element, data, element.textContent.trim());
    }

    element = hasClosestByClassName(event.target, "protyle-attr--av");
    if (element) {
        return handleDatabaseAttrClick({event, protyle, element, data});
    }

    element = hasClosestByClassName(event.target, "protyle-attr--alias");
    if (element) {
        return handleCommonAttrClick(event, protyle, "alias", element, data, element.textContent.trim());
    }

    element = hasClosestByClassName(event.target, "protyle-attr--memo");
    if (element) {
        return handleCommonAttrClick(event, protyle, "memo", element, data, (element.getAttribute("aria-label") || "").trim());
    }
};
