import {getLabelByNumberFormat} from "../number";
import {getLabelByDateFormat} from "../dateFormat";
import {getRollupHTML} from "../rollup";
import {escapeAriaLabel, escapeAttr, escapeHtml} from "../../../../util/DOM/escape";
import {getColIconByType, getColNameByType} from "./col.typeUtils";
import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 生成列类型切换菜单中的单个类型选项 HTML
 *
 * 作用：为列编辑面板的"类型切换"子面板生成单个可选类型的按钮 HTML
 * 意图：复用于 getEditHTML 中 16 种列类型的选项渲染，避免重复拼接
 * 调用时机：getEditHTML 构建类型选择面板时，对每种列类型调用一次
 *
 * @param type - 要生成的目标列类型
 * @param oldType - 当前列的类型，用于标记选中状态
 * @returns 单个类型选项的 HTML 字符串
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const genUpdateColItem = (type: TAVCol, oldType: TAVCol) => {
    const checkedMark = type === oldType ? '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg></span>' : "";
    return `<button class="b3-menu__item" data-type="updateColType" data-old-type="${oldType}" data-new-type="${type}">
    <svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(type)}"></use></svg>
    <span class="b3-menu__label">${getColNameByType(type)}</span>
    ${checkedMark}
</button>`;
};

/**
 * 生成单选/多选类型列的选项列表 HTML
 *
 * 作用：为 select/mSelect 类型列渲染"添加选项"输入框和已有选项列表
 * 意图：从 getEditHTML 的类型分支中提取，消除主函数的 if/else 链
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @returns 选项列表的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const getSelectTypeEditHTML = (colData: IAVColumn, _avData: IAV) => {
    let html = `<button class="b3-menu__separator" data-id="separator_2"></button>
<button class="b3-menu__item" data-type="nobg">
    <svg class="b3-menu__icon"><use xlink:href="#iconAdd"></use></svg>
    <input data-type="addOption" class="b3-text-field fn__block" type="text" placeholder="${siyuanI18n.enterKey} ${siyuanI18n.addAttr}" style="margin: 4px 0">
</button>`;
    const options = colData.options ?? [];
    colData.options = options;
    for (const item of options) {
        const airaLabel = item.desc ? `${escapeAriaLabel(item.name)}<div class='ft__on-surface'>${escapeAriaLabel(item.desc || "")}</div>` : "";
        html += `<button class="b3-menu__item${html ? "" : " b3-menu__item--current"}" draggable="true" data-name="${escapeAttr(item.name)}" data-desc="${escapeAttr(item.desc || "")}" data-color="${escapeAttr(item.color)}">
    <svg class="b3-menu__icon fn__grab"><use xlink:href="#iconDrag"></use></svg>
    <div class="fn__flex-1 ariaLabel" data-position="parentW" aria-label="${airaLabel}">
        <span class="b3-chip" style="background-color:var(--b3-font-background${escapeAttr(item.color)});color:var(--b3-font-color${escapeAttr(item.color)})">
            <span class="fn__ellipsis">${escapeHtml(item.name)}</span>
        </span>
    </div>
    <svg class="b3-menu__action" data-type="setColOption"><use xlink:href="#iconEdit"></use></svg>
</button>`;
    }
    return html;
};

/**
 * 生成数字类型列的格式化选项 HTML
 *
 * 作用：为 number 类型列渲染数字格式选择按钮
 * 意图：从 getEditHTML 的类型分支中提取，消除主函数的 if/else 链
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @returns 数字格式选项的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const getNumberTypeEditHTML = (colData: IAVColumn, _avData: IAV) => {
    return `<button class="b3-menu__separator" data-id="separator_2"></button>
<button class="b3-menu__item" data-type="numberFormat" data-format="${colData.numberFormat}">
    <svg class="b3-menu__icon"><use xlink:href="#iconFormat"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.format}</span>
    <span class="b3-menu__accelerator">${getLabelByNumberFormat(colData.numberFormat)}</span>
</button>`;
};

/**
 * 生成模板类型列的模板编辑区 HTML
 *
 * 作用：为 template 类型列渲染模板文本编辑区
 * 意图：从 getEditHTML 的类型分支中提取
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @returns 模板编辑区的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const getTemplateTypeEditHTML = (colData: IAVColumn, _avData: IAV) => {
    return `<button class="b3-menu__separator" data-id="separator_2"></button>
<button class="b3-menu__item" data-type="nobg">
    <textarea spellcheck="false" rows="${Math.min(colData.template.split("\n").length, 8)}" placeholder="${siyuanI18n.template}" data-type="updateTemplate" style="margin: 4px 0" rows="1" class="fn__block b3-text-field">${colData.template}</textarea>
</button>`;
};

/**
 * 生成关联类型列的关联配置 HTML
 *
 * 作用：为 relation 类型列渲染关联数据库选择、双向关联开关、列名输入等配置项
 * 意图：从 getEditHTML 的类型分支中提取
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @param avData - 当前数据视图数据，用于判断是否自关联
 * @returns 关联配置的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const getRelationTypeEditHTML = (colData: IAVColumn, avData: IAV) => {
    const isSelf = colData.relation?.avID === avData.id;
    return `<button class="b3-menu__separator" data-id="separator_2"></button>
<button class="b3-menu__item" data-type="goSearchAV" data-av-id="${colData.relation?.avID || ""}" data-old-value='${JSON.stringify(colData.relation || {})}'>
    <span class="b3-menu__label">${siyuanI18n.relatedTo}</span>
    <span class="b3-menu__accelerator">${isSelf ? siyuanI18n.thisDatabase : ""}</span>
    <svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>
</button>
<label class="b3-menu__item">
    <span class="fn__flex-center">${siyuanI18n.backRelation}</span>
    <svg class="b3-menu__icon b3-menu__icon--small fn__none"><use xlink:href="#iconHelp"></use></svg>
    <span class="fn__space fn__flex-1"></span>
    <input data-type="backRelation" type="checkbox" class="b3-switch b3-switch--menu" ${colData.relation?.isTwoWay ? "checked" : ""}>
</label>
<div class="b3-menu__item fn__flex-column fn__none" data-type="nobg">
    <input data-old-value="" data-type="colName" style="margin: 8px 0 4px" class="b3-text-field fn__block" placeholder="${avData.name} ${colData.name}">
</div>
<div class="b3-menu__item fn__flex-column fn__none" data-type="nobg">
    <button style="margin: 4px 0 8px;" class="b3-button fn__block" data-type="updateRelation">${siyuanI18n.confirm}</button>
</div>`;
};

/**
 * 生成日期类型列的自动填充配置 HTML
 *
 * 作用：为 date 类型列渲染"填充创建时间"和"填充指定时间"开关
 * 意图：从 getEditHTML 的类型分支中提取
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @returns 日期配置的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const getDateTypeEditHTML = (colData: IAVColumn, _avData: IAV) => {
    return `<button class="b3-menu__separator" data-id="separator_2"></button>
<button class="b3-menu__item" data-type="dateFormat" data-format="${colData.dateFormat || ""}">
    <svg class="b3-menu__icon"><use xlink:href="#iconFormat"></use></svg>
    <span class="b3-menu__label">${window.siyuan.languages._attrView.dateFormat}</span>
    <span class="b3-menu__accelerator">${getLabelByDateFormat(colData.dateFormat)}</span>
</button>
<label class="b3-menu__item">
    <span class="fn__flex-center">${siyuanI18n.fillCreated}</span>
    <span class="fn__space fn__flex-1"></span>
    <input data-type="fillCreated" type="checkbox" class="b3-switch b3-switch--menu" ${colData.date?.autoFillNow ? "checked" : ""}>
</label>
<label class="b3-menu__item">
    <span class="fn__flex-center">${siyuanI18n.fillSpecificTime}</span>
    <span class="fn__space fn__flex-1"></span>
    <input data-type="fillSpecificTime" type="checkbox" class="b3-switch b3-switch--menu" ${colData.date?.fillSpecificTime ? "checked" : ""}>
</label>`;
};

/**
 * 生成 created/updated 类型列的"包含时间"开关 HTML
 *
 * 作用：为 created/updated 类型列渲染是否包含时间的开关
 * 意图：从 getEditHTML 的类型分支中提取
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @returns 时间开关的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，无异步数据源 */
export const getTimestampTypeEditHTML = (colData: IAVColumn, _avData: IAV) => {
    const typeKey: "updated" | "created" = colData.type === "updated" ? "updated" : "created";
    const timestampData = colData[typeKey];
    const isChecked = !timestampData || timestampData.includeTime;
    return `<button class="b3-menu__separator" data-id="separator_2"></button>
<button class="b3-menu__item" data-type="dateFormat" data-format="${colData.dateFormat || ""}">
    <svg class="b3-menu__icon"><use xlink:href="#iconFormat"></use></svg>
    <span class="b3-menu__label">${window.siyuan.languages._attrView.dateFormat}</span>
    <span class="b3-menu__accelerator">${getLabelByDateFormat(colData.dateFormat)}</span>
</button>
<label class="b3-menu__item">
    <span class="fn__flex-center">${siyuanI18n.includeTime}</span>
    <span class="fn__space fn__flex-1"></span>
    <input data-type="includeTime" type="checkbox" class="b3-switch b3-switch--menu" ${isChecked ? "checked" : ""}>
</label>`;
};

/**
 * 生成 rollup 类型列的汇总配置 HTML
 *
 * 作用：为 rollup 类型列渲染汇总配置面板
 * 意图：从 getEditHTML 的类型分支中提取，委托给 rollup 模块
 * 调用时机：getTypeSpecificEditHTML 通过策略映射表调用
 *
 * @param colData - 列配置数据
 * @returns 汇总配置的 HTML 片段
 */
/** @同步豁免: UI构建 — 纯 HTML 字符串拼接，委托给 getRollupHTML */
export const getRollupTypeEditHTML = (colData: IAVColumn, _avData: IAV) => {
    return '<button class="b3-menu__separator" data-id="separator_2"></button>' + getRollupHTML({colData});
};

/**
 * 根据列类型生成对应的类型特定编辑面板 HTML
 *
 * 作用：将列类型分派到对应的 HTML 构建函数，替代原 getEditHTML 中的 if/else 链
 * 意图：使用策略映射表消除分支嵌套，每种类型的 HTML 构建逻辑独立维护
 * 调用时机：col.ts 中 getEditHTML 构建编辑面板时调用
 *
 * @param colData - 列配置数据
 * @param avData - 当前数据视图数据
 * @returns 类型特定的 HTML 片段，无匹配类型时返回空字符串
 */
/** @同步豁免: UI构建 — 纯分派函数，委托给各类型的同步 HTML 构建函数 */
export const getTypeSpecificEditHTML = (colData: IAVColumn, avData: IAV) => {
    // 所有构建函数统一签名 (colData, avData)，映射表直接引用函数
    const typeBuilderMap: Partial<Record<TAVCol, (c: IAVColumn, a: IAV) => string>> = {
        select: getSelectTypeEditHTML,
        mSelect: getSelectTypeEditHTML,
        number: getNumberTypeEditHTML,
        template: getTemplateTypeEditHTML,
        relation: getRelationTypeEditHTML,
        rollup: getRollupTypeEditHTML,
        date: getDateTypeEditHTML,
        updated: getTimestampTypeEditHTML,
        created: getTimestampTypeEditHTML,
    };
    const builder = typeBuilderMap[colData.type];
    return builder ? builder(colData, avData) : "";
};
