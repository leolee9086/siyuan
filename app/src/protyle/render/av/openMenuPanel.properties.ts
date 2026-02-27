import { getColIconByType } from "./col.typeUtils";
import { unicode2Emoji } from "../../../emoji";
import { escapeHtml } from "../../../util/DOM/escape";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 生成单个列项的 HTML 按钮
 * @同步豁免: UI构建
 */
const buildColItemHTML = (item: IAVColumn): string => `<button class="b3-menu__item" data-type="editCol" draggable="true" data-id="${item.id}">
    <svg class="b3-menu__icon fn__grab"><use xlink:href="#iconDrag"></use></svg>
    <div class="b3-menu__label fn__flex">
        ${item.icon ? unicode2Emoji(item.icon, "b3-menu__icon", true) : `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(item.type)}"></use></svg>`}
        ${escapeHtml(item.name) || "&nbsp;"}
    </div>
    <svg class="b3-menu__action${item.hidden ? "\" data-type=\"showCol\"><use xlink:href=\"#iconEye\"></use>" : `${item.type === "block" ? " fn__none" : ""}" data-type="hideCol"><use xlink:href="#iconEyeoff"></use>`}</svg>
    <svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>
</button>`;

/**
 * 构建隐藏列区域的 HTML（含分隔线和标题）
 * @同步豁免: UI构建
 */
const buildHideSectionHTML = (hideHTML: string): string => {
    if (!hideHTML) {
        return "";
    }
    return `<button class="b3-menu__separator"></button>
<button class="b3-menu__item" data-type="nobg">
    <span class="b3-menu__label">
        ${siyuanI18n.hideCol} 
    </span>
    <span class="block__icon" data-type="showAllCol">
        ${siyuanI18n.showAll}
        <span class="fn__space"></span>
        <svg><use xlink:href="#iconEye"></use></svg>
    </span>
</button>
${hideHTML}`;
};

/**
 * 生成属性视图"字段管理"面板的 HTML
 *
 * 作用：构建显示/隐藏列的管理面板 HTML，包含列拖拽排序、显示/隐藏切换、新建列等功能
 * 意图：属性视图的字段管理需要一个统一的面板来展示所有列的状态并提供操作入口
 * 调用时机：在 openMenuPanel 中 type="properties" 时调用，以及在 handleViewClick/handleColOpsClick 中刷新面板时调用
 * @同步豁免: UI构建
 */
export const getPropertiesHTML = (fields: IAVColumn[]) => {
    let showHTML = "";
    let hideHTML = "";
    for (const item of fields) {
        if (item.hidden) {
            hideHTML += buildColItemHTML(item);
            continue;
        }
        showHTML += buildColItemHTML(item);
    }
    return `<div class="b3-menu__items">
<button class="b3-menu__item" data-type="nobg">
    <span class="block__icon" style="padding: 8px;margin-left: -4px;" data-type="go-config">
        <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span class="b3-menu__label ft__center">${siyuanI18n.fields}</span>
</button>
<button class="b3-menu__separator"></button>
<button class="b3-menu__item" data-type="nobg">
    <span class="b3-menu__label">
        ${siyuanI18n.showCol} 
    </span>
    <span class="block__icon" data-type="hideAllCol">
        ${siyuanI18n.hideAll}
        <span class="fn__space"></span>
        <svg><use xlink:href="#iconEyeoff"></use></svg>
    </span>
</button>
${showHTML}
${buildHideSectionHTML(hideHTML)}
<button class="b3-menu__separator"></button>
<button class="b3-menu__item" data-type="newCol">
    <svg class="b3-menu__icon"><use xlink:href="#iconAdd"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.new}</span>
</button>
</div>`;
};
