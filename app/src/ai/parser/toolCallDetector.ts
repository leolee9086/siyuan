import { JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS } from "../constants";
import { z } from "../deps";


/**
 * 工具调用检测结果
 */
export interface ToolCallDetectionResult {
    /** 是否检测到完整的工具调用 */
    hasCompleteToolCall: boolean;
    /** 工具调用类型 */
    toolCallType: typeof JAVASCRIPT_TOOLS_CLASS | typeof JAVASCRIPT_TOOLS_WAIT_CLASS | null;
    /** 工具调用代码块 */
    codeBlock: string | null;
    /** 是否是同步调用 */
    isSynchronous: boolean;
}



/**
 * 工具调用检测器的Zod验证模式
 */
export const toolCallDetectionResultSchema = z.object({
    hasCompleteToolCall: z.boolean(),
    toolCallType: z.enum([JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS]).nullable(),
    codeBlock: z.string().nullable(),
    isSynchronous: z.boolean(),
});

/**
 * 临时ESM模块的Zod验证模式
 */
export const temporaryModuleSchema = z.object({
    moduleUrl: z.string().url(),
    moduleExport: z.any(),
    cleanup: z.function(),
});






/**
 * 通用工具调用代码块检测函数
 * @param domElement 包含可能工具调用的DOM元素
 * @param language 要检测的语言名
 * @returns 检测到的工具调用代码，如果没有检测到则返回null
 */
function 从块DOM检测特定语言(domElement: Element, language: string): string | null {
    // 找到代表工具调用的代码块
    const span = domElement.querySelector('.protyle-action__language');
    if(span?.textContent===language){
            // 只有输出完成的代码块才会有这个选项
        const isFullToolCall = span.parentElement?.parentElement?.getAttribute('custom-aitoolcall-fired') === 'false';
        if (isFullToolCall) {
            const data = span.parentElement?.nextElementSibling?.textContent;
            if (data) {
                return data;
            }
        }
    }
    return null;
}

/**
 * 从DOM元素中检测同步工具调用
 * @param domElement 包含可能工具调用的DOM元素
 * @returns 检测到的工具调用代码，如果没有检测到则返回null
 */
export function 检测同步工具调用代码块(domElement: Element): string | null {
    return 从块DOM检测特定语言(domElement, JAVASCRIPT_TOOLS_WAIT_CLASS);
}

/**
 * 从DOM元素中检测异步工具调用
 * @param domElement 包含可能工具调用的DOM元素
 * @returns 检测到的工具调用代码，如果没有检测到则返回null
 */
export function 检测异步工具调用代码块(domElement: Element): string | null {
    return 从块DOM检测特定语言(domElement, JAVASCRIPT_TOOLS_CLASS);
}

