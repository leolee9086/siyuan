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
 * 检测内容中是否包含完整的同步工具调用
 */
function detectCompleteToolCallFromPlainText(content: string): ToolCallDetectionResult {
    // 检测javascript-tools代码块
    const syncToolCallRegex = new RegExp("```" + JAVASCRIPT_TOOLS_CLASS + "\\s*\\n([\\s\\S]*?)\\n```", "g");
    const asyncToolCallRegex = new RegExp("```" + JAVASCRIPT_TOOLS_WAIT_CLASS + "\\s*\\n([\\s\\S]*?)\\n```", "g");

    // 检查是否有完整的同步工具调用
    const syncMatches = [...content.matchAll(syncToolCallRegex)];
    const asyncMatches = [...content.matchAll(asyncToolCallRegex)];

    // 优先检查同步工具调用
    if (syncMatches.length > 0) {
        const lastMatch = syncMatches[syncMatches.length - 1];
        return {
            hasCompleteToolCall: true,
            toolCallType: JAVASCRIPT_TOOLS_CLASS,
            codeBlock: lastMatch[1] || null,
            isSynchronous: true
        };
    }

    // 检查异步工具调用
    if (asyncMatches.length > 0) {
        const lastMatch = asyncMatches[asyncMatches.length - 1];
        return {
            hasCompleteToolCall: true,
            toolCallType: JAVASCRIPT_TOOLS_WAIT_CLASS,
            codeBlock: lastMatch[1] || null,
            isSynchronous: false
        };
    }
    return {
        hasCompleteToolCall: false,
        toolCallType: null,
        codeBlock: null,
        isSynchronous: false
    };
}






/**
 * 从DOM元素中检测工具调用
 * @param domElement 包含可能工具调用的DOM元素
 * @returns 检测到的工具调用代码，如果没有检测到则返回null
 */
export function detectToolCalls(domElement: Element): string | null {
    // 找到代表工具调用的代码块
    const spans = domElement.querySelectorAll('.protyle-action__language');
    const awaitToolSection = Array.from(spans).find(
        (element) => element.textContent === JAVASCRIPT_TOOLS_WAIT_CLASS
    );

    if (awaitToolSection) {
        // 只有输出完成的代码块才会有这个选项
        const isFullToolCall = awaitToolSection.parentElement?.parentElement?.getAttribute('custom-aitoolcall-fired') === 'false';
        if (isFullToolCall) {
            const data = awaitToolSection.parentElement?.nextElementSibling?.textContent;
            if (data) {
                return data;
            }
        }
    }

    return null;
}
/**
 * 从DOM元素中检测工具调用
 * @param domElement 包含可能工具调用的DOM元素
 * @returns 检测到的工具调用代码，如果没有检测到则返回null
 */
export function detectAsyncToolCalls(domElement: Element): string | null {
    // 找到代表工具调用的代码块
    const spans = domElement.querySelectorAll('.protyle-action__language');
    const awaitToolSection = Array.from(spans).find(
        (element) => element.textContent === JAVASCRIPT_TOOLS_CLASS
    );

    if (awaitToolSection) {
        // 只有输出完成的代码块才会有这个选项
        const isFullToolCall = awaitToolSection.parentElement?.parentElement?.getAttribute('custom-aitoolcall-fired') === 'false';
        if (isFullToolCall) {
            const data = awaitToolSection.parentElement?.nextElementSibling?.textContent;
            if (data) {
                return data;
            }
        }
    }

    return null;
}

