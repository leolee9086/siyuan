/** 用途：格式化日期；使用范围：AV 值 HTML；解耦评估：经 value 网关复用既有日期后端。 */
import {dayjs} from "./imports";
/** 用途：读取默认图标键；使用范围：关系值；解耦评估：经 value 网关复用全局常量。 */
import {Constants} from "./imports";
/** 用途：渲染关系图标；使用范围：关系值；解耦评估：经 value 网关复用 Emoji 唯一实现。 */
import {unicode2Emoji} from "./imports";
/** 用途：生成缩略图地址；使用范围：资源值；解耦评估：经 value 网关复用资源领域实现。 */
import {getCompressURL} from "./imports";
/** 用途：转义无障碍文案；使用范围：资源值；解耦评估：经 value 网关复用 DOM 转义实现。 */
import {escapeAriaLabel} from "./imports";
/** 用途：转义 HTML 属性；使用范围：属性输入和链接；解耦评估：经 value 网关复用 DOM 转义实现。 */
import {escapeAttr} from "./imports";
/** 用途：转义可见文本；使用范围：全部属性值；解耦评估：经 value 网关复用 DOM 转义实现。 */
import {escapeHtml} from "./imports";
/** 用途：提供属性编辑文案；使用范围：全部属性值；解耦评估：经 value 网关读取既有 i18n。 */
import {siyuanI18n} from "./imports";

/**
 * 根据编辑器安全设置返回模板字段 HTML，并在默认模式过滤可执行内容。
 * @同步豁免: UI构建 - 调用方正在同步拼装单元格 HTML，安全过滤结果必须在插入 DOM 前返回。
 */
export const getAVTemplateHTML = (content: string) => {
    if (window.siyuan.config.editor.allowHTMLBLockScript) {
        return content;
    }
    return window.DOMPurify.sanitize(content);
};

/** 渲染汇总中的块值。 */
const renderRollupBlockValue = (value: IAVCellValue) => value?.isDetached
    ? `<span>${escapeHtml(value.block?.content || siyuanI18n.untitled)}</span>`
    : `<span data-type="block-ref" data-id="${value.block.id}" data-subtype="s" class="av__celltext--ref">${escapeHtml(value.block?.content || siyuanI18n.untitled)}</span>`;

/** 渲染汇总中的日期或时间戳值。 */
const renderRollupDateValue = (value: IAVCellValue) => {
    const date = value.date ?? value.updated ?? value.created;
    let html = date.formattedContent || "";
    // 服务端没有提供格式化文本时，按既有本地日期格式补齐起始值。
    if (!html && date.isNotEmpty) {
        html = dayjs(date.content).format(date.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
    }
    // 范围日期继续以结束值覆盖起始值，并保留前向图标的原有汇总表现。
    if (!date.formattedContent && date.hasEndDate && date.isNotEmpty && date.isNotEmpty2) {
        html = `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(date.content2).format(date.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
    }
    return html ? `<span class="av__celltext">${html}</span>` : "";
};

/** 渲染汇总中的纯文本值。 */
const renderRollupTextValue = (value: IAVCellValue) => {
    const content = value.text.content;
    return escapeHtml(content);
};

/** 渲染汇总中的数字值，优先使用服务端格式化结果。 */
const renderRollupNumberValue = (value: IAVCellValue) => value.number.formattedContent || value.number.content.toString();

/** 渲染汇总中的 URL 链接。 */
const renderRollupURLValue = (value: IAVCellValue) => value.url.content
    ? `<a class="fn__a" href="${escapeAttr(value.url.content)}" target="_blank">${escapeHtml(value.url.content)}</a>`
    : "";

/** 渲染汇总中的电话链接。 */
const renderRollupPhoneValue = (value: IAVCellValue) => value.phone.content
    ? `<a class="fn__a" href="tel:${escapeAttr(value.phone.content)}" target="_blank">${escapeHtml(value.phone.content)}</a>`
    : "";

/** 渲染汇总中的邮件链接。 */
const renderRollupEmailValue = (value: IAVCellValue) => value.email.content
    ? `<a class="fn__a" href="mailto:${escapeAttr(value.email.content)}" target="_blank">${escapeHtml(value.email.content)}</a>`
    : "";

/** 按值类型创建隔离的汇总标量策略并返回匹配项。 */
const getRollupValueRenderer = (type: TAVCol) => {
    const renderers: Partial<Record<TAVCol, (value: IAVCellValue) => string>> = {
        block: renderRollupBlockValue,
        text: renderRollupTextValue,
        number: renderRollupNumberValue,
        date: renderRollupDateValue,
        updated: renderRollupDateValue,
        created: renderRollupDateValue,
        url: renderRollupURLValue,
        phone: renderRollupPhoneValue,
        email: renderRollupEmailValue,
    };
    return renderers[type];
};

/** 渲染汇总中的单个标量值。 */
const genAVRollupHTML = (value: IAVCellValue) => getRollupValueRenderer(value.type)?.(value) ?? "";

/** 渲染单选和多选标签；单选保留首个选项。 */
const renderSelectionValue = (value: IAVCellValue) => {
    let html = "";
    for (const [index, item] of (value.mSelect ?? []).entries()) {
        if (value.type === "select" && index > 0) {
            break;
        }
        html += `<span class="b3-chip b3-chip--middle" style="background-color:var(--b3-font-background${escapeAttr(item.color)});color:var(--b3-font-color${escapeAttr(item.color)})">${escapeHtml(item.content)}</span>`;
    }
    return html;
};

/** 渲染图片资源和普通资源标签。 */
const renderAssetValue = (value: IAVCellValue) => {
    let html = "";
    for (const item of value.mAsset ?? []) {
        // 图片使用缩略图，其余资源保持可编辑标签结构。
        if (item.type === "image") {
            html += `<img loading="lazy" class="av__cellassetimg ariaLabel" aria-label="${escapeAriaLabel(item.content)}" src="${getCompressURL(encodeURI(item.content))}">`;
            continue;
        }
        html += `<span class="b3-chip b3-chip--middle av__celltext--url ariaLabel" aria-label="${escapeAriaLabel(item.content)}" data-name="${escapeAttr(item.name)}" data-url="${escapeAttr(item.content)}">${escapeHtml(item.name || item.content)}</span>`;
    }
    return html;
};

/** 渲染日期范围编辑值。 */
const renderDateValue = (value: IAVCellValue) => {
    const date = value.date;
    let html = `<span class="av__celltext" data-value='${JSON.stringify(date)}' placeholder="${siyuanI18n.empty}">`;
    // 非空日期显示起始时间。
    if (date && date.isNotEmpty) {
        html += dayjs(date.content).format(date.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
    }
    // 范围日期在起始时间后追加结束时间。
    if (date && date.hasEndDate && date.isNotEmpty && date.isNotEmpty2) {
        html += `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(date.content2).format(date.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
    }
    return `${html}</span>`;
};

/** 渲染创建或更新时间只读值。 */
const renderTimestampValue = (value: IAVCellValue) => {
    const timestamp = value.type === "created" ? value.created : value.updated;
    return timestamp.isNotEmpty ? `<span data-content="${timestamp.content}">${dayjs(timestamp.content).format("YYYY-MM-DD HH:mm")}</span>` : "";
};

/** 渲染 URL、电话和邮件输入及其打开动作。 */
const renderLinkValue = (value: IAVCellValue) => {
    const type = value.type;
    const content = type === "phone" ? value.phone.content : type === "email" ? value.email.content : value.url.content;
    const prefix = type === "phone" ? "tel:" : type === "email" ? "mailto:" : "";
    const icon = type === "phone" ? "Phone" : type === "email" ? "Email" : "Link";
    return `<input value="${escapeAttr(content)}" class="b3-text-field b3-text-field--text fn__flex-1" placeholder="${siyuanI18n.empty}">
<span class="fn__space"></span>
<a ${content ? `href="${prefix}${escapeAttr(content)}"` : ""} target="_blank" aria-label="${siyuanI18n.openBy}" class="block__icon block__icon--show fn__flex-center b3-tooltips__w b3-tooltips"><svg><use xlink:href="#icon${icon}"></use></svg></a>`;
};

/** 渲染关系值，并保持分离引用和普通引用的既有 DOM 结构。 */
const renderRelationValue = (value: IAVCellValue) => {
    let html = "";
    for (const [index, item] of (value.relation?.contents ?? []).entries()) {
        if (!item?.block) {
            continue;
        }
        const rowID = value.relation.blockIDs[index];
        if (item.isDetached) {
            html += `<span data-row-id="${rowID}" class="av__cell--relation"><span><svg style="height: 26px"><use xlink:href="#iconLine"></use></svg><span class="fn__space--5"></span></span><span class="av__celltext">${Lute.EscapeHTMLStr(item.block.content || siyuanI18n.untitled)}</span></span>`;
            continue;
        }
        const localImages = window.siyuan.storage[Constants.LOCAL_IMAGES];
        const displayIcon = item.block.icon || localImages.file;
        html += `<span data-row-id="${rowID}" class="av__cell--relation" data-block-id="${item.block.id}"><span class="b3-menu__avemoji" data-unicode="${escapeAttr(item.block.icon || "")}">${unicode2Emoji(displayIcon)}</span><span data-type="block-ref" data-id="${item.block.id}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(item.block.content || siyuanI18n.untitled)}</span></span>`;
    }
    return html.endsWith(", ") ? html.substring(0, html.length - 2) : html;
};

/** 判断汇总项是否继续使用属性编辑渲染策略。 */
const isNestedEditableValueType = (type: TAVCol) => type === "template" || type === "select" ||
    type === "mSelect" || type === "mAsset" || type === "checkbox" || type === "relation";

/** 递归渲染汇总属性，并保留原有逗号与不换行空格分隔。 */
const renderNestedRollupValue = (value: IAVCellValue) => {
    let html = "";
    for (const item of value.rollup?.contents ?? []) {
        const nested = isNestedEditableValueType(item.type) ? genAVValueHTML(item) : genAVRollupHTML(item);
        if (nested) {
            html += `${nested.replace("fn__flex-1", "")},&nbsp;`;
        }
    }
    return html.endsWith(",&nbsp;") ? html.substring(0, html.length - 7) : html;
};

/** 渲染块属性输入。 */
const renderBlockValue = (value: IAVCellValue) => `<input data-id="${value.block.id}" value="${escapeAttr(value.block.content)}" type="text" class="b3-text-field b3-text-field--text fn__flex-1" placeholder="${siyuanI18n.empty}">`;

/** 渲染多行文本属性输入。 */
const renderTextValue = (value: IAVCellValue) => `<textarea style="resize: vertical" rows="${(value.text?.content || "").split("\n").length}" class="b3-text-field b3-text-field--text fn__flex-1" placeholder="${siyuanI18n.empty}">${escapeHtml(value.text?.content || "")}</textarea>`;

/** 渲染数字属性输入及其格式化提示。 */
const renderNumberValue = (value: IAVCellValue) => `<input value="${value.number.isNotEmpty ? value.number.content : ""}" type="number" class="b3-text-field b3-text-field--text fn__flex-1" placeholder="${siyuanI18n.empty}">
<span class="fn__space"></span><span class="fn__flex-center ft__on-surface b3-tooltips__w b3-tooltips" aria-label="${siyuanI18n.format}">${value.number.formattedContent}</span><span class="fn__space"></span>`;

/** 渲染复选框图标。 */
const renderCheckboxValue = (value: IAVCellValue) => `<svg class="av__checkbox"><use xlink:href="#icon${value.checkbox.checked ? "Check" : "Uncheck"}"></use></svg>`;

/** 渲染经过安全策略处理的模板属性。 */
const renderTemplateValue = (value: IAVCellValue) => `<div class="fn__flex-1" placeholder="${siyuanI18n.empty}">${getAVTemplateHTML(value.template.content)}</div>`;

/** 按值类型创建隔离的属性编辑策略并返回匹配项。 */
const getValueRenderer = (type: TAVCol) => {
    const renderers: Partial<Record<TAVCol, (value: IAVCellValue) => string>> = {
        block: renderBlockValue,
        text: renderTextValue,
        number: renderNumberValue,
        mSelect: renderSelectionValue,
        select: renderSelectionValue,
        mAsset: renderAssetValue,
        date: renderDateValue,
        created: renderTimestampValue,
        updated: renderTimestampValue,
        url: renderLinkValue,
        phone: renderLinkValue,
        email: renderLinkValue,
        checkbox: renderCheckboxValue,
        template: renderTemplateValue,
        relation: renderRelationValue,
        rollup: renderNestedRollupValue,
    };
    return renderers[type];
};

/**
 * 将 AV 属性编辑值渲染为既有表单、标签、资源、关系或汇总 HTML。
 * @同步豁免: UI构建 - 表格、属性面板和资源更新均同步设置 innerHTML，返回 Promise 会改变既有渲染时序。
 */
export const genAVValueHTML = (value: IAVCellValue) => getValueRenderer(value.type)?.(value) ?? "";
