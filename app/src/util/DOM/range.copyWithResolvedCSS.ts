/**
 * 获取选择范围HTML并复制CSS变量替换版本的工具
 * 用于提取当前选择范围的HTML，替换其中的CSS变量为计算值，并复制到剪贴板
 */

import { getContenteditableElement } from "../../ai/imports";
import { extractCSSVariables, replaceCSSVariables } from "../assets/extractCSSVariables";
import { getSelection } from "./range.global";
import { isSecureContext } from "../siyuanEnvironments/windowStandard.environment";

/**
 * 获取当前选择范围的HTML内容
 * @returns 选择范围的HTML字符串，如果没有选择则返回空字符串
 */
function getSelectedHTML(): string {
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0) {
        return "";
    }

    const range = selection.getRangeAt(0);
    const container = document.createElement("div");
    container.appendChild(range.cloneContents());

    return container.innerHTML;
}

/**
 * 创建临时DOM元素并处理CSS变量
 * @param html HTML字符串
 * @returns 处理后的HTML字符串
 */
function processCSSVariablesInHTML(html: string): string {
    // 创建临时容器
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = html;

    // 获取所有需要处理的元素
    const elements = tempContainer.querySelectorAll("*");

    // 处理每个元素的CSS变量
    elements.forEach(element => {
        const variables = extractCSSVariables(element);
        if (variables.length > 0) {
            replaceCSSVariables(element, variables);
        }
    });

    // 处理span标签转换为a标签
    convertSpanToLink(tempContainer);

    return tempContainer.innerHTML;
}

/**
 * 将特定格式的span标签转换为a标签
 * @param container DOM容器元素
 */
function convertSpanToLink(container: HTMLElement): void {
    // 查找所有span标签
    const spanElements = container.querySelectorAll("span[data-href]");

    spanElements.forEach(span => {
        const dataType = span.getAttribute("data-type") || "";
        const href = span.getAttribute("data-href");
        const textContent = span.textContent || "";

        // 检查data-type是否包含"a"（使用类似classList的解析方法）
        const typeClasses = dataType.split(/\s+/);
        const hasLinkType = typeClasses.some(type => type.includes("a"));

        if (!hasLinkType || !href) {
            return; // 跳过不符合条件的span
        }

        // 创建新的a标签
        const linkElement = document.createElement("a");
        linkElement.href = href;
        linkElement.textContent = textContent.replace(/\u200B/g, ""); // 移除零宽空格

        // 复制其他属性
        Array.from(span.attributes).forEach(attr => {
            if (attr.name !== "data-type" && attr.name !== "data-href") {
                linkElement.setAttribute(attr.name, attr.value);
            }
        });

        // 替换span标签
        span.parentNode?.replaceChild(linkElement, span);
    });
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise表示复制操作是否成功
 */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && isSecureContext()) {
            // 使用现代剪贴板API
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // 降级方案：使用document.execCommand
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const result = document.execCommand("copy");
            document.body.removeChild(textArea);
            return result;
        }
    } catch (error) {
        console.error("复制到剪贴板失败:", error);
        return false;
    }
}

/**
 * 获取当前选择范围的HTML，替换CSS变量为计算值，并复制到剪贴板
 * @returns Promise表示操作是否成功
 */
async function copySelectedHTMLWithResolvedCSS(container): Promise<boolean> {
    try {
        // 获取选择的HTML
        const selectedHTML = getSelectedHTML();
        if (!selectedHTML) {
            console.warn("没有选择任何内容");
            return false;
        }

        // 处理CSS变量
        const processedHTML = processCSSVariablesInHTML(selectedHTML);

        // 创建临时元素并使用execCommand复制
        const tempElement = document.createElement("span");
        tempElement.innerHTML = processedHTML;
        if (getContenteditableElement(container)) {
            container = getContenteditableElement(container);

        }
        document.body.appendChild(tempElement);

        // 选择临时元素的内容
        const range = document.createRange();
        range.selectNodeContents(tempElement);
        const selection = getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);

            // 使用execCommand复制
            const success = document.execCommand("copy");

            // 清理
            selection.removeAllRanges();
            document.body.removeChild(tempElement);

            return success;
        } else {
            // 如果无法获取selection，清理临时元素并返回失败
            document.body.removeChild(tempElement);
            return false;
        }

    } catch (error) {
        console.error("处理选择范围HTML时发生错误:", error);
        return false;
    }
}

// 导出函数
export {
    getSelectedHTML,
    processCSSVariablesInHTML,
    copyToClipboard,
    copySelectedHTMLWithResolvedCSS
};