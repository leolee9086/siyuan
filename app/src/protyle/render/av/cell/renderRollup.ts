/**
 * 用途：从imports.ts导入dayjs日期库
 * 使用范围：renderRollup函数使用
 * 解耦评估：已通过imports.ts统一管理依赖
 */
import { dayjs } from "./imports";
/**
 * 用途：从imports.ts导入国际化文本
 * 使用范围：renderRollup函数使用
 * 解耦评估：已通过imports.ts统一管理依赖
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：从imports.ts导入Emoji转换函数
 * 使用范围：renderRollup函数使用
 * 解耦评估：已通过imports.ts统一管理依赖
 */
import { unicode2Emoji } from "./imports";
/**
 * 用途：从 imports.ts 导入属性转义函数。
 * 使用范围：renderRollup 的 block 图标 data-unicode 属性。
 * 解耦评估：通过 cell gateway 复用唯一 DOM 属性编码器。
 */
import {escapeAttr} from "./imports";

/**
 * 用途：从 render.ts 导入 URL 渲染函数
 * 使用范围：renderRollup中处理url类型单元格
 * 解耦评估：已经是独立函数，无需进一步解耦
 */
import {renderCellURL} from "./renderURL";
/**
 * 用途：从environment文件导入默认图标获取函数
 * 使用范围：renderRollup中渲染block类型单元格
 * 解耦评估：已通过environment文件封装window访问
 */
import { getDefaultFileIcon } from "./storage.environment";

/**
 * 渲染文本类型单元格
 * 作用：提取text类型单元格的内容
 * 意图：简化主函数逻辑，单一职责
 * 调用时机：renderRollup处理text类型时
 */
/** @同步豁免: UI构建 */
const renderTextCell = (cellValue: IAVCellValue) => {
    const textValue = cellValue.text;
    return Lute.EscapeHTMLStr(textValue?.content || "");
};

/**
 * 渲染邮箱或电话类型单元格
 * 作用：将email/phone类型单元格渲染为带样式的HTML
 * 意图：统一处理email和phone两种相似类型
 * 调用时机：renderRollup处理email或phone类型时
 */
/** @同步豁免: UI构建 */
const renderEmailOrPhoneCell = (cellValue: IAVCellValue) => {
    const type = cellValue.type;
    const value = type === "email" ? cellValue.email : cellValue.phone;
    const content = value?.content;
    
    if (!content) {
        return "";
    }
    
    return `<span class="av__celltext av__celltext--url" data-type="${type}">${Lute.EscapeHTMLStr(content)}</span>`;
};

/**
 * 渲染URL类型单元格
 * 作用：将url类型单元格渲染为链接HTML
 * 意图：封装URL渲染逻辑
 * 调用时机：renderRollup处理url类型时
 */
/** @同步豁免: UI构建 */
const renderUrlCell = (cellValue: IAVCellValue) => {
    const urlValue = cellValue.url;
    const urlContent = urlValue?.content || "";
    
    if (!urlContent) {
        return "";
    }
    
    return renderCellURL(urlContent);
};

/**
 * 渲染块引用类型单元格
 * 作用：将block类型单元格渲染为块引用HTML，支持分离和正常两种状态
 * 意图：处理复杂的块引用渲染逻辑
 * 调用时机：renderRollup处理block类型时
 */
/** @同步豁免: UI构建 */
const renderBlockCell = (cellValue: IAVCellValue, showIcon: boolean) => {
    const blockValue = cellValue.block;
    const blockContent = blockValue?.content || siyuanI18n.untitled;
    
    if (cellValue.isDetached) {
        return `<span class="av__celltext">${Lute.EscapeHTMLStr(blockContent)}</span>`;
    }
    
    const blockIcon = blockValue?.icon || getDefaultFileIcon();
    const blockId = blockValue?.id || "";
    const emojiClass = showIcon ? "" : " fn__none";
    
    return `<span class="b3-menu__avemoji${emojiClass}" data-unicode="${escapeAttr(blockIcon)}">${unicode2Emoji(blockIcon)}</span><span data-type="block-ref" data-id="${blockId}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(blockContent)}</span>`;
};

/**
 * 渲染数字类型单元格
 * 作用：将number类型单元格渲染为格式化的数字文本
 * 意图：优先使用格式化内容，回退到原始数字
 * 调用时机：renderRollup处理number类型时
 */
/** @同步豁免: UI构建 */
const renderNumberCell = (cellValue: IAVCellValue) => {
    const numberValue = cellValue.number;
    
    if (!numberValue) {
        return "";
    }
    
    return numberValue.formattedContent || numberValue.content?.toString() || "";
};

/**
 * 渲染复选框类型单元格
 * 作用：将checkbox类型单元格渲染为SVG图标
 * 意图：根据选中状态显示不同图标
 * 调用时机：renderRollup处理checkbox类型时
 */
/** @同步豁免: UI构建 */
const renderCheckboxCell = (cellValue: IAVCellValue) => {
    const checkboxValue = cellValue.checkbox;
    const isChecked = checkboxValue?.checked;
    const iconType = isChecked ? "Check" : "Uncheck";
    
    return `<svg class="av__checkbox"><use xlink:href="#icon${iconType}"></use></svg><span class="fn__space"></span>`;
};

/**
 * 渲染日期类型单元格
 * 作用：将date/updated/created类型单元格渲染为格式化的日期时间HTML
 * 意图：支持日期范围显示，优先使用预格式化内容
 * 调用时机：renderRollup处理date/updated/created类型时
 */
/** @同步豁免: UI构建 */
const renderDateCell = (cellValue: IAVCellValue) => {
    const dateValue = cellValue.type === "date" ? cellValue.date : 
                     cellValue.type === "updated" ? cellValue.updated : 
                     cellValue.created;
    
    if (!dateValue) {
        return "";
    }
    
    if (dateValue.formattedContent) {
        return `<span class="av__celltext">${dateValue.formattedContent}</span>`;
    }
    
    let text = "";
    
    if (dateValue.isNotEmpty) {
        const format = dateValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm";
        text = dayjs(dateValue.content).format(format);
    }
    
    // 当日期有结束日期且开始和结束日期都有效时，追加结束日期显示
    if (dateValue.hasEndDate && dateValue.isNotEmpty && dateValue.isNotEmpty2) {
        const format = dateValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm";
        const endDateText = dayjs(dateValue.content2).format(format);
        text += `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${endDateText}`;
    }
    
    if (!text) {
        return "";
    }
    
    return `<span class="av__celltext">${text}</span>`;
};

/**
 * 渲染汇总单元格内容
 * 作用：将IAVCellValue对象渲染为HTML字符串，用于属性视图的汇总行显示
 * 意图：提供统一的单元格渲染入口，根据类型分发到具体渲染函数
 * 调用时机：在属性视图渲染汇总行时调用
 */
/** @同步豁免: UI构建 */
export const renderRollup = (cellValue: IAVCellValue, showIcon: boolean) => {
    if (cellValue.type === "text") {
        return renderTextCell(cellValue);
    }
    
    if (cellValue.type === "email" || cellValue.type === "phone") {
        return renderEmailOrPhoneCell(cellValue);
    }
    
    if (cellValue.type === "url") {
        return renderUrlCell(cellValue);
    }
    
    if (cellValue.type === "block") {
        return renderBlockCell(cellValue, showIcon);
    }
    
    if (cellValue.type === "number") {
        return renderNumberCell(cellValue);
    }
    
    if (cellValue.type === "checkbox") {
        return renderCheckboxCell(cellValue);
    }
    
    if (cellValue.type === "date" || cellValue.type === "updated" || cellValue.type === "created") {
        return renderDateCell(cellValue);
    }
    
    return "";
};
