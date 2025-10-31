import { JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS } from "../constants";
import { z } from "../deps";

/**
 * 工具调用检测器类型定义
 */
export interface ToolCallDetector {
    /**
     * 检测内容中是否包含完整的同步工具调用
     * @param content 待检测的内容
     * @returns 检测结果
     */
    detectCompleteToolCall(content: string): ToolCallDetectionResult;

    /**
     * 提取工具调用代码
     * @param content 包含工具调用的内容
     * @returns 提取的工具调用代码
     */
    extractToolCallCode(content: string): string | null;

}

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
 * 临时ESM模块信息
 */
export interface TemporaryModule {
    /** 模块URL */
    moduleUrl: string;
    /** 模块导出 */
    moduleExport: any;
    /** 清理函数 */
    cleanup: () => void;
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
 * 创建临时ESM模块
 */
export async function createTemporaryModule(code: string): Promise<TemporaryModule> {

    // 动态导入模块
    // 创建Blob URL
    const blob = new Blob([code], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);

    try {
        const moduleExport = await import(/* webpackIgnore: true */moduleUrl);

        // 返回模块信息和清理函数
        return {
            moduleUrl,
            moduleExport: moduleExport.default,
            cleanup: () => {
                URL.revokeObjectURL(moduleUrl);
            }
        };
    } catch (error) {
        // 如果导入失败，清理URL并重新抛出错误
        URL.revokeObjectURL(moduleUrl);
        throw new Error(`创建临时模块失败: ${error instanceof Error ? error.message : String(error)}`);
    }
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
/**
 * 执行工具调用代码
 * @param toolCode 工具调用代码
 * @returns Promise<void>
 */
export async function executeToolCall(toolCode: string): Promise<void> {
    try {
        const result = await createTemporaryModule(toolCode);
        console.log('工具调用执行结果:', result);
    } catch (error) {
        console.error('工具调用执行失败:', error);
        throw error;
    }
}

