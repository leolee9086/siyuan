/**
 * 构建块内容提示词的工具函数
 */
import { getPersonnaPrompt } from "./common/persona";
import { getSiyuanEnvironmentPrompt } from "./common/siyuan";
import { getDifferentOfToolsSection, getSharedToolUseSection } from "./toolList/tool-use";
import { getEchartsSection } from "./toolList/getEchartsSection";
import { getAbcjsSection } from "./toolList/abcjs.prompt";
import { getFlowchartSection } from "./toolList/flowchart.prompt";
import { getGraphvizSection } from "./toolList/graphviz.prompt";
import { getMermaidSection } from "./toolList/mermaid.prompt";
import { getMathSection } from "./toolList/math.prompt";
import { getHtmlSection } from "./toolList/html.prompt";
export const getPublicPrompts = () => {
    return `${getPersonnaPrompt()}
${getSiyuanEnvironmentPrompt()}
${getSharedToolUseSection()}
${getDifferentOfToolsSection()}
${getEchartsSection()}
${getAbcjsSection()}
${getFlowchartSection()}
${getGraphvizSection()}
${getMermaidSection()}
${getMathSection()}
${getHtmlSection()}`;
};
/**
 * 构建包含块内容的提示词
 * @param inputValue 用户输入的问题
 * @param blockContents 块内容数组
 * @returns 构建好的提示词
 */
export const buildBlockContentPrompt = (blockContents?: string[]): string => {


    // 构建块内容文本
    const blocksText = blockContents?.map((content, index) =>
        ` ${index + 1}：\n${content}`
    ).join("\n\n");

    // 构建完整的提示词

    return `${getPublicPrompts()}
在交流中,可以参考以下块内容,这是你的容器所在的思源笔记内的笔记数据。
你也可以调用工具获取更多参考：

${blocksText || ""}

`;
};

