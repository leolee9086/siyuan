/** 用途：渲染视图图标；使用范围：AV 页签；解耦评估：通过同域网关使用 Emoji 唯一实现。 */
import {unicode2Emoji} from "./imports";
/** 用途：转义 aria 文案；使用范围：AV 页签；解耦评估：通过同域网关使用 DOM 转义实现。 */
import {escapeAriaLabel} from "./imports";
/** 用途：转义可见标题；使用范围：AV 页签；解耦评估：通过同域网关使用 DOM 转义实现。 */
import {escapeHtml} from "./imports";
/** 用途：提供视图操作文案；使用范围：AV Header；解耦评估：通过同域网关读取 i18n。 */
import {siyuanI18n} from "./imports";
/** 用途：读取视图字段；使用范围：过滤状态；解耦评估：通过同域网关使用 AV view 查询。 */
import {getFieldsByData} from "./imports";
/** 用途：读取视图类型图标；使用范围：AV 页签；解耦评估：通过同域网关使用 AV view 映射。 */
import {getViewIcon} from "./imports";

/** 判断过滤树是否包含指定字段与类型。 @显式返回类型原因: 递归函数需要固定布尔返回契约，避免自身调用导致隐式 any。 */
const hasLeafFilter = (nodes: IAVFilter[], columnId: string, columnType: string): boolean => {
    for (const node of nodes) {
        if (node.filters && hasLeafFilter(node.filters, columnId, columnType)) {
            return true;
        }
        if (node.filters) {
            continue;
        }
        if (node.value && node.value.type === columnType && node.column === columnId) {
            return true;
        }
    }
    return false;
};

/** 判断当前视图是否存在有效字段过滤。 */
const hasViewFilter = (data: IAV) => getFieldsByData(data).some((item) =>
    hasLeafFilter(data.view.filters, item.id, item.type));

/** 生成 AV 视图页签列表。 */
const getTabsHTML = (data: IAV) => data.views.map((item: IAVView) =>
    `<div draggable="true" data-position="north" data-av-type="${item.type}" data-id="${item.id}" data-page="${item.pageSize}" data-desc="${escapeAriaLabel(item.desc || "")}" class="ariaLabel item${item.id === data.viewID ? " item--focus" : ""}">
    ${item.icon ? unicode2Emoji(item.icon, "item__graphic", true) : `<svg class="item__graphic"><use xlink:href="#${getViewIcon(item.type)}"></use></svg>`}
    <span class="item__text">${escapeHtml(item.name)}</span>
</div>`).join("");

/** 生成新增、切换、过滤和排序操作。 */
const getViewActionsHTML = (data: IAV, hasFilter: boolean) => `<span data-type="av-add" class="block__icon ariaLabel" data-position="8south" aria-label="${siyuanI18n.newView}">
    <svg><use xlink:href="#iconAdd"></use></svg>
</span>
<div class="fn__flex-1"></div>
<div class="fn__space"></div>
<span data-type="av-switcher" aria-label="${siyuanI18n.allViews}" data-position="8south" class="ariaLabel block__icon${data.views.length > 0 ? "" : " fn__none"}">
    <svg><use xlink:href="#iconDown"></use></svg>
    <span class="fn__space"></span>
    <small>${data.views.length}</small>
</span>
<div class="fn__space"></div>
<span data-type="av-filter" aria-label="${siyuanI18n.filter}" data-position="8south" class="ariaLabel block__icon${hasFilter ? " block__icon--active" : ""}">
    <svg><use xlink:href="#iconFilter"></use></svg>
</span>
<div class="fn__space"></div>
<span data-type="av-sort" aria-label="${siyuanI18n.sort}" data-position="8south" class="ariaLabel block__icon${data.view.sorts.length > 0 ? " block__icon--active" : ""}">
    <svg><use xlink:href="#iconSort"></use></svg>
</span>`;

/** 生成搜索、设置、镜像提示和新增记录操作。 */
const getSearchActionsHTML = (data: IAV, showSearch: boolean, editable: boolean) => `<button data-type="av-search-icon" aria-label="${siyuanI18n.search}" data-position="8south" class="ariaLabel block__icon">
    <svg><use xlink:href="#iconSearch"></use></svg>
</button>
<div style="position: relative" class="fn__flex">
    <div contenteditable="plaintext-only" style="${showSearch ? "width:128px" : "width:0;padding-left: 0;padding-right: 0;"}" data-type="av-search" class="b3-text-field b3-text-field--text" placeholder="${siyuanI18n.search}"></div>
</div>
<div class="fn__space"></div>
<span data-type="av-more" aria-label="${siyuanI18n.config}" data-position="8south" class="ariaLabel block__icon">
    <svg><use xlink:href="#iconSettings"></use></svg>
</span>
<div class="fn__space"></div>
${data.isMirror ? `<span data-av-id="${data.id}" data-popover-url="/api/av/getMirrorDatabaseBlocks" class="popover__block block__icon block__icon--show ariaLabel" data-position="8south" aria-label="${siyuanI18n.mirrorTip}">
    <svg><use xlink:href="#iconSplitLR"></use></svg>
</span><div class="fn__space"></div>` : ""}
${editable ? `<div class="av__new fn__flex">
    <button data-type="av-add-more" class="b3-button">${siyuanI18n.new}</button>
    <button data-type="av-add-template" class="b3-button ariaLabel" data-position="8south" aria-label="${siyuanI18n.template}"><svg><use xlink:href="#iconDown"></use></svg></button>
</div>` : ""}`;

/** 同步生成 table、gallery 与 kanban 共用的 AV 视图标题栏。 @同步豁免: UI构建 - 调用方正在同步拼装同一段视图 HTML。 */
export const genTabHeaderHTML = (data: IAV, showSearch: boolean, editable: boolean) => {
    const viewData = data.views.find((item) => item.id === data.viewID) || data.view;
    const defaultTemplate = data.newItemTemplates?.find(item => item.id === data.defaultTemplateID);
    const defaultTemplateID = defaultTemplate && (defaultTemplate.targetType !== "detached" ||
        defaultTemplate.primaryKeyTemplate || Object.keys(defaultTemplate.fieldValues || {}).length) ? defaultTemplate.id : "";
    return `<div class="av__header" data-default-template-id="${defaultTemplateID}">
        <div class="fn__flex av__views${showSearch ? " av__views--show" : ""}">
            <div class="layout-tab-bar fn__flex">${getTabsHTML(data)}</div>
            <div class="fn__space"></div>
            ${getViewActionsHTML(data, hasViewFilter(data))}
            <div class="fn__space"></div>
            ${getSearchActionsHTML(data, showSearch, editable)}
        </div>
        <div contenteditable="${editable}" spellcheck="${window.siyuan.config.editor.spellcheck.toString()}" class="av__title${viewData.hideAttrViewName ? " fn__none" : ""}" data-title="${Lute.EscapeHTMLStr(data.name || "")}" data-tip="${siyuanI18n._kernel[267]}">${Lute.EscapeHTMLStr(data.name || "")}</div>
        <div class="av__counter fn__none"></div>
    </div>`;
};
