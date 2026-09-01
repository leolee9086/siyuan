/**
 * 用途：HTML属性转义函数
 * 使用范围：转义URL等属性值
 * 解耦评估：通过imports.ts统一管理
 */
/**
 * 用途：rollup类型单元格渲染函数
 * 使用范围：renderCell函数中处理rollup类型
 * 解耦评估：已解耦为独立模块
 */
import { renderRollup } from "./renderRollup";
/**
 * 用途：template类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderTemplateCell } from "./render.helpers";
/**
 * 用途：text类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderTextCell } from "./render.helpers";
/**
 * 用途：email/phone类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderContactCell } from "./render.helpers";
/**
 * 用途：block类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderBlockCell } from "./render.helpers";
/**
 * 用途：number类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderNumberCell } from "./render.helpers";
/**
 * 用途：select/mSelect类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderSelectCell } from "./render.helpers";
/**
 * 用途：date类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderDateCell } from "./render.helpers";
/**
 * 用途：created/updated类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderTimestampCell } from "./render.helpers";
/**
 * 用途：lineNumber类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderLineNumberCell } from "./render.helpers";
/**
 * 用途：mAsset类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderAssetCell } from "./render.helpers";
/**
 * 用途：checkbox类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderCheckboxCell } from "./render.helpers";
/**
 * 用途：rollup类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderRollupCell } from "./render.helpers";
/**
 * 用途：relation类型单元格渲染
 * 使用范围：renderCell函数
 * 解耦评估：已拆分到独立模块
 */
import { renderRelationCell } from "./render.helpers";
import {renderCellURL} from "./renderURL";

/**
 * 辅助函数：处理单个文本元素的文本提取
 * 作用：根据元素类型提取相应的文本内容
 * 意图：封装不同类型元素的文本提取逻辑
 * 调用时机：getCellText遍历文本元素时调用
 * @同步豁免: 需要绝对同步的DOM访问
 */
const extractTextFromElement = (item: Element) => {
    // 包含图标的元素，提取首尾子节点文本，firstChild和lastChild可能为null需要检查
    if (item.querySelector(".av__cellicon") && item.firstChild && item.lastChild) {
        return `${item.firstChild.textContent} → ${item.lastChild.textContent}`;
    }
    
    // URL类型元素，提取href属性
    if (item.getAttribute("data-type") === "url") {
        return item.getAttribute("data-href") || "";
    }
    
    // block-more类型不提取文本
    if (item.getAttribute("data-type") === "block-more") {
        return "";
    }
    
    // 其他类型提取textContent
    return item.textContent || "";
};

/**
 * 作用：从单元格DOM元素中提取纯文本内容
 * 意图：用于复制、搜索等需要纯文本的场景
 * 调用时机：用户复制单元格内容或需要获取单元格文本时
 * 问题/改进：需要处理各种单元格类型的文本提取逻辑
 * @同步豁免: 需要绝对同步的DOM访问 - 必须同步读取DOM元素内容
 */
export const getCellText = (cellElement: HTMLElement | false) => {
    if (!cellElement) {
        return "";
    }
    
    const textElements = cellElement.querySelectorAll(".b3-chip, .av__celltext--ref, .av__celltext");
    
    // 单元格包含结构化文本元素时，遍历提取
    if (textElements.length > 0) {
        const textParts: string[] = [];
        for (const item of textElements) {
            const text = extractTextFromElement(item);
            if (text) {
                textParts.push(text);
            }
        }
        return textParts.join(", ");
    }
    
    // 单元格为纯文本时，直接返回textContent
    return cellElement.textContent || "";
};

/**
 * 辅助函数：设置block类型单元格的id属性
 * @同步豁免: 需要绝对同步的DOM访问
 */
const setBlockCellId = (cellElement: Element, blockId: string) => {
    const cellTextElement = cellElement.querySelector(".av__celltext");
    if (!cellTextElement) {
        return;
    }
    cellTextElement.setAttribute("data-id", blockId);
};

/**
 * 作用：根据单元格值更新单元格DOM元素的属性
 * 意图：同步单元格的视觉状态与数据状态
 * 调用时机：单元格值变化后需要更新DOM属性时
 * 问题/改进：仅处理checkbox和block类型，其他类型无需更新属性
 * @同步豁免: 需要绝对同步的DOM访问 - 必须同步更新DOM属性
 */
export const renderCellAttr = (cellElement: Element, value: IAVCellValue) => {
    // checkbox类型：根据checked状态更新样式类
    if (value.type === "checkbox" && value.checkbox?.checked) {
        cellElement.classList.add("av__cell-check");
        cellElement.classList.remove("av__cell-uncheck");
        return;
    }
    
    // checkbox类型：未选中状态
    if (value.type === "checkbox") {
        cellElement.classList.remove("av__cell-check");
        cellElement.classList.add("av__cell-uncheck");
        return;
    }
    
    // block类型：detached状态标记
    if (value.type === "block" && value.isDetached) {
        cellElement.setAttribute("data-detached", "true");
        return;
    }
    
    // block类型：正常状态，设置block id
    if (value.type === "block" && value.block?.id) {
        setBlockCellId(cellElement, value.block.id);
        cellElement.removeAttribute("data-detached");
        return;
    }
    
    // block类型：无id时仅移除detached属性
    if (value.type === "block") {
        cellElement.removeAttribute("data-detached");
    }
};

/**
 * 辅助函数：判断单元格是否需要添加复制按钮
 * @同步豁免: UI构建
 */
const shouldShowCopyButton = (cellValue: IAVCellValue) => {
    // url类型：有内容时显示
    if (cellValue.type === "url") {
        return !!(cellValue.url?.content);
    }
    
    // email类型：有内容时显示
    if (cellValue.type === "email") {
        return !!(cellValue.email?.content);
    }
    
    // phone类型：有内容时显示
    if (cellValue.type === "phone") {
        return !!(cellValue.phone?.content);
    }
    
    // text类型：有内容时显示
    if (cellValue.type === "text") {
        return !!(cellValue.text?.content);
    }
    
    // template类型：有内容时显示
    if (cellValue.type === "template") {
        return !!(cellValue.template?.content);
    }
    
    // date类型：有内容时显示
    if (cellValue.type === "date") {
        return !!(cellValue.date?.content);
    }
    
    // created类型：有内容时显示
    if (cellValue.type === "created") {
        return !!(cellValue.created?.content);
    }
    
    // updated类型：有内容时显示
    if (cellValue.type === "updated") {
        return !!(cellValue.updated?.content);
    }
    
    // lineNumber类型始终显示复制按钮
    if (cellValue.type === "lineNumber") {
        return true;
    }
    
    // number类型：有值时显示复制按钮
    if (cellValue.type === "number") {
        return !!cellValue.number?.isNotEmpty;
    }
    
    // block类型：有内容时显示复制按钮
    if (cellValue.type === "block") {
        return !!cellValue.block?.content;
    }
    
    return false;
};

/**
 * 作用：将单元格数据值渲染为HTML字符串
 * 意图：根据不同的单元格类型生成对应的HTML结构
 * 调用时机：表格视图渲染单元格内容时调用
 * 问题/改进：函数较长，已拆分为多个辅助函数处理不同类型
 * @同步豁免: UI构建 - 纯字符串拼接生成HTML，无异步操作需求
 */
export const renderCell = async (cellValue: IAVCellValue, rowIndex = 0, showIcon = true, type: TAVView = "table") => {
    let text = "";
    
    // template类型：模板内容
    if (cellValue.type === "template") {
        text = renderTemplateCell(cellValue);
    }
    
    // text类型：纯文本
    if (cellValue.type === "text") {
        text = renderTextCell(cellValue);
    }
    
    // email/phone类型：联系方式
    // @内联数组
    if (["email", "phone"].includes(cellValue.type)) {
        text = renderContactCell(cellValue);
    }
    
    // url类型：链接
    if (cellValue.type === "url") {
        text = renderCellURL(cellValue.url?.content || "");
    }
    
    // block类型：块引用
    if (cellValue.type === "block") {
        text = renderBlockCell(cellValue, showIcon);
    }
    
    // number类型：数字
    if (cellValue.type === "number") {
        text = renderNumberCell(cellValue);
    }
    
    // select/mSelect类型：选项
    if (cellValue.type === "mSelect" || cellValue.type === "select") {
        text = renderSelectCell(cellValue);
    }
    
    // date类型：日期
    if (cellValue.type === "date") {
        text = renderDateCell(cellValue);
    }
    
    // created/updated类型：时间戳
    // @内联数组
    if (["created", "updated"].includes(cellValue.type)) {
        text = renderTimestampCell(cellValue);
    }
    
    // lineNumber类型：行号
    // @内联数组
    if (["lineNumber"].includes(cellValue.type)) {
        text = renderLineNumberCell(rowIndex);
    }
    
    // mAsset类型：资源
    if (cellValue.type === "mAsset") {
        text = await renderAssetCell(cellValue);
    }
    
    // checkbox类型：复选框
    if (cellValue.type === "checkbox") {
        text = renderCheckboxCell(cellValue, type);
    }
    
    // rollup类型：汇总
    if (cellValue.type === "rollup") {
        text = await renderRollupCell({
            cellValue,
            rowIndex,
            showIcon,
            type,
            renderCell,
            renderRollup,
        });
    }
    
    // relation类型：关联
    if (cellValue.type === "relation") {
        text = renderRelationCell(cellValue, showIcon);
    }
    
    // 为支持复制的单元格类型添加复制按钮
    if (shouldShowCopyButton(cellValue)) {
        text += '<span data-type="copy" class="block__icon"><svg><use xlink:href="#iconCopy"></use></svg></span>';
    }
    
    return text;
};
