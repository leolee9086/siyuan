/** 用途：转义字段名；使用范围：Properties 字段行；解耦评估：经本子域网关直达唯一实现，参数注入会制造无语义差异的包装。 */
import {escapeHtml} from "./imports";
/** 用途：选择字段类型图标；使用范围：Properties 字段行；解耦评估：经本子域网关直达列映射唯一实现，不建立重复映射。 */
import {getColIconByType} from "./imports";
/** 用途：读取字段管理文案；使用范围：Properties 面板；解耦评估：经本子域网关直达全局语言环境，调用参数不重复承载同一环境。 */
import {siyuanI18n} from "./imports";
/** 用途：渲染字段自定义图标；使用范围：Properties 字段行；解耦评估：经本子域网关直达 Emoji 唯一实现，不建立渲染回调。 */
import {unicode2Emoji} from "./imports";

/**
 * 将 IAVColumn 预处理为字段按钮可直接使用的安全 HTML 数据。
 * 返回形状由实现推导，并由 buildColItemHTML 直接引用，避免建立只服务单个调用点的碎片类型。
 */
const toColItemSafeHTML = (item: IAVColumn, viewType?: TAVView) => ({
    id: item.id,
    iconHTML: item.icon
        ? unicode2Emoji(item.icon, "b3-menu__icon", true)
        : `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(item.type)}"></use></svg>`,
    nameHTML: escapeHtml(item.name) || "&nbsp;",
    // 画廊布局允许隐藏整块字段，因此 block 字段的隐藏按钮仅在非画廊视图下收起
    actionHTML: item.hidden
        ? "<svg class=\"b3-menu__action\" data-type=\"showCol\"><use xlink:href=\"#iconEye\"></use></svg>"
        : `<svg class="b3-menu__action${item.type === "block" && viewType !== "gallery" ? " fn__none" : ""}" data-type="hideCol"><use xlink:href="#iconEyeoff"></use></svg>`,
});

/**
 * 生成单个列项的 HTML 按钮
 *
 * 注意：所有字符串必须经由 toColItemSafeHTML 预处理后传入，
 * 本函数仅作模板填充，不做任何字符串转义/转换。
 * @同步豁免: UI构建
 */
const buildColItemHTML = (safe: ReturnType<typeof toColItemSafeHTML>) => `<button class="b3-menu__item" data-type="editCol" draggable="true" data-id="${safe.id}">
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
const buildHideSectionHTML = (hideHTML: string) => {
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
export const getPropertiesHTML = (fields: IAVColumn[], viewType?: TAVView) => {
    let showHTML = "";
    let hideHTML = "";
    for (const item of fields) {
        if (item.hidden) {
            hideHTML += buildColItemHTML(toColItemSafeHTML(item, viewType));
            continue;
        }
        showHTML += buildColItemHTML(toColItemSafeHTML(item, viewType));
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
