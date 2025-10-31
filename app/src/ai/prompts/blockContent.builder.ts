/**
 * 构建块内容提示词的工具函数
 */
import { getDifferentOfToolsSection, getSharedToolUseSection } from "./tool-use";

/**
 * 构建包含块内容的提示词
 * @param inputValue 用户输入的问题
 * @param blockContents 块内容数组
 * @returns 构建好的提示词
 */
export const buildBlockContentPrompt = (inputValue: string, blockContents?: string[]): string => {
    // 如果没有块内容，直接返回用户输入
    if (!blockContents || blockContents.length === 0) {
        return inputValue;
    }
    
    // 构建块内容文本
    const blocksText = blockContents.map((content, index) =>
        ` ${index + 1}：\n${content}`
    ).join('\n\n');
    
    // 构建完整的提示词
    return `${getSharedToolUseSection()}
${getDifferentOfToolsSection()}
    
请基于以下块内容回答用户的问题,你可以调用工具获取更多参考：

${blocksText}

用户问题：
${inputValue}`;
};