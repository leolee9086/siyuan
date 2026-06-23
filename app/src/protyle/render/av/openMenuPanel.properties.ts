/**
 * 用途：根据列类型获取对应的 SVG 图标标识。
 * 使用范围：仅在 toColItemSafeHTML 的 iconHTML 分支中使用。
 * 解耦评估：getColIconByType 是纯函数映射，当前调用位于本模块内，
 *           去耦成本远超收益，保持直接导入即可。
 */
import { getColIconByType } from "./col/col.typeUtils";
/**
 * 用途：ColItemSafeHTML 是 buildColItemHTML 的入参类型约束，确保只接收预处理后的安全字符串。
 * 使用范围：仅在本文件 toColItemSafeHTML 返回类型标注中使用。
 * 解耦评估：类型定义集中管理在 .types.ts 中，属于类型层依赖，不涉及运行时耦合，直接导入即可。
 */
import type { ColItemSafeHTML } from "./openMenuPanel.types";
/**
 * 用途：PropertiesHTMLDeps 是 getPropertiesHTML 的上下文依赖类型约束。
 * 使用范围：仅在本文件 toColItemSafeHTML/getPropertiesHTML/buildHideSectionHTML 的参数类型中使用。
 * 解耦评估：同 ColItemSafeHTML，属于类型层依赖，直接导入即可。
 */
import type { PropertiesHTMLDeps } from "./openMenuPanel.types";

/**
 * 将 IAVColumn 预处理为 ColItemSafeHTML
 * @显式返回类型原因 buildColItemHTML 的类型约束要求传入 ColItemSafeHTML，
 *                    显式标注确保调用方在插入新字段时获得编译期提示。
 */
const toColItemSafeHTML = (item: IAVColumn, deps: PropertiesHTMLDeps): ColItemSafeHTML => ({
    id: item.id,
    iconHTML: item.icon
        ? deps.unicode2Emoji(item.icon, "b3-menu__icon", true)
        : `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(item.type)}"></use></svg>`,
    nameHTML: deps.escapeHtml(item.name) || "&nbsp;",
    actionHTML: item.hidden
        ? "<svg class=\"b3-menu__action\" data-type=\"showCol\"><use xlink:href=\"#iconEye\"></use></svg>"
        : `<svg class="b3-menu__action${item.type === "block" ? " fn__none" : ""}" data-type="hideCol"><use xlink:href="#iconEyeoff"></use></svg>`,
});

/**
 * 生成单个列项的 HTML 按钮
 *
 * 注意：所有字符串必须经由 toColItemSafeHTML 预处理后传入，
 * 本函数仅作模板填充，不做任何字符串转义/转换。
 * @同步豁免: UI构建
 */
const buildColItemHTML = (safe: ColItemSafeHTML) => `<button class="b3-menu__item" data-type="editCol" draggable="true" data-id="${safe.id}">
    <svg class="b3-menu__icon fn__grab"><use xlink:href="#iconDrag"></use></svg>
    <div class="b3-menu__label fn__flex">
        ${safe.iconHTML}
        ${safe.nameHTML}
    </div>
    ${safe.actionHTML}
    <svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>
</button>`;

/**
 * 构建隐藏列区域的 HTML（含分隔线和标题）
 * @同步豁免: UI构建
 */
const buildHideSectionHTML = (hideHTML: string, deps: PropertiesHTMLDeps) => {
    if (!hideHTML) {
        return "";
    }
    return `<button class="b3-menu__separator"></button>
<button class="b3-menu__item" data-type="nobg">
    <span class="b3-menu__label">
        ${deps.siyuanI18n.hideCol} 
    </span>
    <span class="block__icon" data-type="showAllCol">
        ${deps.siyuanI18n.showAll}
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
export const getPropertiesHTMLWithDeps = (fields: IAVColumn[], deps: PropertiesHTMLDeps) => {
    let showHTML = "";
    let hideHTML = "";
    for (const item of fields) {
        if (item.hidden) {
            hideHTML += buildColItemHTML(toColItemSafeHTML(item, deps));
            continue;
        }
        showHTML += buildColItemHTML(toColItemSafeHTML(item, deps));
    }
    return `<div class="b3-menu__items">
<button class="b3-menu__item" data-type="nobg">
    <span class="block__icon" style="padding: 8px;margin-left: -4px;" data-type="go-config">
        <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span class="b3-menu__label ft__center">${deps.siyuanI18n.fields}</span>
</button>
<button class="b3-menu__separator"></button>
<button class="b3-menu__item" data-type="nobg">
    <span class="b3-menu__label">
        ${deps.siyuanI18n.showCol} 
    </span>
    <span class="block__icon" data-type="hideAllCol">
        ${deps.siyuanI18n.hideAll}
        <span class="fn__space"></span>
        <svg><use xlink:href="#iconEyeoff"></use></svg>
    </span>
</button>
${showHTML}
${buildHideSectionHTML(hideHTML, deps)}
<button class="b3-menu__separator"></button>
<button class="b3-menu__item" data-type="newCol">
    <svg class="b3-menu__icon"><use xlink:href="#iconAdd"></use></svg>
    <span class="b3-menu__label">${deps.siyuanI18n.new}</span>
</button>
</div>`;
};
