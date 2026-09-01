/**
 * 用途：日期格式化库
 * 使用范围：格式化date类型单元格
 * 解耦评估：通过imports.ts统一管理
 */
import { dayjs } from "./imports";
/**
 * 用途：Unicode转Emoji函数
 * 使用范围：渲染block类型单元格图标
 * 解耦评估：通过imports.ts统一管理
 */
import { unicode2Emoji } from "./imports";
/**
 * 用途：HTML内容转义函数
 * 使用范围：转义HTML内容
 * 解耦评估：通过imports.ts统一管理
 */
import { escapeHtml } from "./imports";
/**
 * 用途：HTML属性转义函数
 * 使用范围：转义属性值
 * 解耦评估：通过imports.ts统一管理
 */
import { escapeAttr } from "./imports";
/**
 * 用途：ARIA 标签转义函数
 * 使用范围：转义资源单元格可访问性标签
 * 解耦评估：通过imports.ts统一管理
 */
import { escapeAriaLabel } from "./imports";
/**
 * 用途：图片压缩URL生成函数
 * 使用范围：处理mAsset类型图片
 * 解耦评估：通过imports.ts统一管理
 */
import { getCompressURL } from "./imports";
/**
 * 用途：国际化文本
 * 使用范围：显示本地化文本
 * 解耦评估：通过imports.ts统一管理
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：获取默认图标
 * 使用范围：block和relation类型单元格
 * 解耦评估：通过storage.environment.ts封装window访问
 */
import { getDefaultFileIcon } from "./storage.environment";
import {getAVTemplateHTML} from "../value/render";

/**
 * 辅助函数：渲染template类型单元格
 * @同步豁免: UI构建
 */
export const renderTemplateCell = (cellValue: IAVCellValue) => {
    return `<span class="av__celltext">${getAVTemplateHTML(cellValue.template?.content || "")}</span>`;
};

/**
 * 辅助函数：渲染text类型单元格
 * @同步豁免: UI构建
 */
export const renderTextCell = (cellValue: IAVCellValue) => {
    return `<span class="av__celltext">${Lute.EscapeHTMLStr(cellValue.text?.content || "")}</span>`;
};

/**
 * 辅助函数：渲染email/phone类型单元格
 * @同步豁免: UI构建
 */
export const renderContactCell = (cellValue: IAVCellValue) => {
    const content = cellValue.type === "email" 
        ? (cellValue.email?.content || "")
        : (cellValue.phone?.content || "");
    return `<span class="av__celltext av__celltext--url" data-type="${cellValue.type}">${Lute.EscapeHTMLStr(content)}</span>`;
};

/**
 * 辅助函数：渲染block类型单元格
 * @同步豁免: UI构建
 */
export const renderBlockCell = (cellValue: IAVCellValue, showIcon: boolean) => {
    // 不可使用换行 https://github.com/siyuan-note/siyuan/issues/11365
    let text: string;
    if (cellValue.isDetached) {
        text = `<span class="av__celltext">${Lute.EscapeHTMLStr(cellValue.block?.content || "")}</span>`;
    }
    if (!cellValue.isDetached) {
        const icon = cellValue.block?.icon || getDefaultFileIcon();
        const content = cellValue.block?.content || "";
        const blockId = cellValue.block?.id || "";
        text = `<span class="b3-menu__avemoji${showIcon ? "" : " fn__none"}" data-unicode="${escapeAttr(cellValue.block?.icon || "")}">${unicode2Emoji(icon)}</span><span data-type="block-ref" data-id="${blockId}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(content)}</span>`;
    }
    const updateLabel = cellValue.isDetached ? siyuanI18n.bind : siyuanI18n.update;
    const updateIcon = cellValue.isDetached ? "iconLink" : "iconRefresh";
    return `${text}<span class="av__row-actions"><button class="av__row-action ariaLabel" type="button" data-position="4north" aria-label="${siyuanI18n.openBy}" data-type="av-row-open"><svg><use xlink:href="#iconOpen"></use></svg></button><button class="av__row-action ariaLabel" type="button" data-position="4north" aria-label="${updateLabel}" data-type="av-row-update"><svg><use xlink:href="#${updateIcon}"></use></svg></button></span>`;
};

/**
 * 辅助函数：渲染number类型单元格
 * @同步豁免: UI构建
 */
export const renderNumberCell = (cellValue: IAVCellValue) => {
    const dataContent = cellValue.number?.isNotEmpty ? cellValue.number.content : "";
    const displayContent = cellValue.number?.formattedContent || cellValue.number?.content || "";
    return `<span class="av__celltext" data-content="${dataContent}">${displayContent}</span>`;
};

/**
 * 辅助函数：渲染select/mSelect类型单元格
 * @同步豁免: UI构建
 */
export const renderSelectCell = (cellValue: IAVCellValue) => {
    let text = "";
    const items = cellValue.mSelect || [];
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (!item) {
            continue;
        }
        // select类型只显示第一项
        if (cellValue.type === "select" && index > 0) {
            break;
        }
        text += `<span class="b3-chip" style="background-color:var(--b3-font-background${escapeAttr(item.color)});color:var(--b3-font-color${escapeAttr(item.color)})">${escapeHtml(item.content)}</span>`;
    }
    return text;
};

/**
 * 辅助函数：渲染date类型单元格
 * @同步豁免: UI构建
 */
export const renderDateCell = (cellValue: IAVCellValue) => {
    const dataValue = cellValue.date;
    let text = `<span class="av__celltext" data-value='${JSON.stringify(dataValue)}'>`;
    
    // 有起始日期时显示
    if (dataValue?.isNotEmpty) {
        text += dayjs(dataValue.content).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
    }
    
    // 有结束日期时显示日期范围
    if (dataValue?.hasEndDate && dataValue.isNotEmpty && dataValue.isNotEmpty2) {
        text += `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(dataValue.content2).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
    }
    
    text += "</span>";
    return text;
};

/**
 * 辅助函数：渲染created/updated类型单元格
 * @同步豁免: UI构建
 */
export const renderTimestampCell = (cellValue: IAVCellValue) => {
    const dataValue = cellValue.type === "created" ? cellValue.created : cellValue.updated;
    let text = `<span class="av__celltext" data-value='${JSON.stringify(dataValue)}'>`;
    
    // 有时间戳时显示格式化内容
    if (dataValue?.isNotEmpty) {
        text += dataValue.formattedContent;
    }
    
    text += "</span>";
    return text;
};

/**
 * 辅助函数：渲染lineNumber类型单元格
 * @同步豁免: UI构建
 */
export const renderLineNumberCell = (rowIndex: number) => {
    const lineNumber = rowIndex + 1;
    return `<span class="av__celltext" data-value='${lineNumber}'>${lineNumber}</span>`;
};

/**
 * 辅助函数：渲染mAsset类型单元格
 * @同步豁免: UI构建
 */
export const renderAssetCell = async (cellValue: IAVCellValue) => {
    let text = "";
    const assets = cellValue.mAsset || [];
    
    for (const item of assets) {
        // 图片类型：渲染为img标签
        if (item.type === "image") {
            text += `<img loading="lazy" class="av__cellassetimg ariaLabel" aria-label="${escapeAriaLabel(item.content)}" src="${await getCompressURL(encodeURI(item.content))}">`;
            continue;
        }
        // 其他资源类型：渲染为链接chip
        text += `<span class="b3-chip av__celltext--url ariaLabel" aria-label="${escapeAriaLabel(item.content)}" data-name="${escapeAttr(item.name)}" data-url="${escapeAttr(item.content)}">${escapeHtml(item.name || item.content)}</span>`;
    }
    
    return text;
};

/**
 * 辅助函数：渲染checkbox类型单元格
 * @同步豁免: UI构建
 */
export const renderCheckboxCell = (cellValue: IAVCellValue, type: TAVView) => {
    const checked = cellValue.checkbox?.checked;
    let text = `<div class="fn__flex"><svg class="av__checkbox"><use xlink:href="#icon${checked ? "Check" : "Uncheck"}"></use></svg>`;
    
    // gallery和kanban视图显示checkbox的文本内容
    // @内联数组
    if (["gallery", "kanban"].includes(type) && cellValue.checkbox?.content) {
        text += `<span class="fn__space"></span>${escapeHtml(cellValue.checkbox.content)}`;
    }
    
    text += "</div>";
    return text;
};

// rollup类型中需要递归渲染的复杂类型列表
const ROLLUP_COMPLEX_TYPES = ["template", "select", "mSelect", "mAsset", "relation"];

/**
 * 辅助函数：渲染rollup类型单元格
 * @同步豁免: UI构建
 */
export const renderRollupCell = async (options: {
    cellValue: IAVCellValue,
    rowIndex: number,
    showIcon: boolean,
    type: TAVView,
    renderCell: (cellValue: IAVCellValue, rowIndex: number, showIcon: boolean, type: TAVView) => Promise<string>,
    renderRollup: (cellValue: IAVCellValue, showIcon: boolean) => string,
}) => {
    let text = "";
    let rollupType: string | undefined;
    const contents = options.cellValue.rollup?.contents || [];
    
    for (const item of contents) {
        // @内联数组
        const isComplexType = ROLLUP_COMPLEX_TYPES.includes(item.type);
        const rollupText = isComplexType
            ? await options.renderCell(item, options.rowIndex, options.showIcon, options.type)
            : options.renderRollup(item, options.showIcon);
        
        if (rollupText) {
            text += rollupText + (item.type === "checkbox" ? "" : ", ");
        }
        rollupType = item.type;
    }
    
    if (!text) {
        return "";
    }
    
    // checkbox类型需要flex容器
    if (rollupType === "checkbox") {
        return `<div class="fn__flex">${text}</div>`;
    }
    
    // 移除末尾的逗号分隔符
    if (text.endsWith(", ")) {
        return text.substring(0, text.length - 2);
    }
    
    return text;
};

/**
 * 辅助函数：渲染relation类型单元格
 * @同步豁免: UI构建
 */
export const renderRelationCell = (cellValue: IAVCellValue, showIcon: boolean) => {
    let text = "";
    const contents = cellValue.relation?.contents || [];
    const blockIDs = cellValue.relation?.blockIDs || [];
    
    for (let index = 0; index < contents.length; index++) {
        const item = contents[index];
        if (!item?.block) {
            continue;
        }
        
        const rowID = blockIDs[index];
        const content = item.block.content || siyuanI18n.untitled;
        
        // detached状态：关联的block已被删除
        if (item.isDetached) {
            text += `<span data-row-id="${rowID}" class="av__cell--relation"><span${showIcon ? "" : ' class="fn__none"'}><svg><use xlink:href="#iconLine"></use></svg><span class="fn__space--5"></span></span><span class="av__celltext">${Lute.EscapeHTMLStr(content)}</span></span>`;
            continue;
        }
        
        const icon = item.block.icon || getDefaultFileIcon();
        // data-block-id 用于更新 emoji
        text += `<span data-row-id="${rowID}" class="av__cell--relation" data-block-id="${item.block.id}"><span class="b3-menu__avemoji${showIcon ? "" : " fn__none"}" data-unicode="${escapeAttr(item.block.icon || "")}">${unicode2Emoji(icon)}</span><span data-type="block-ref" data-id="${item.block.id}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(content)}</span></span>`;
    }
    
    // 移除末尾的逗号分隔符
    if (text.endsWith(", ")) {
        return text.substring(0, text.length - 2);
    }
    
    return text;
};



