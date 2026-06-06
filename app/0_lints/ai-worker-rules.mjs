/**
 * AI Worker 自定义规则
 *
 * 用于检测代码中的 AI 任务标记
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

/**
 * 提示词字典
 */
export const PROMPTS = {
    AI_TODO_DETECTED: {
        id: 'AI-001: Pending Task',
        mode: 'GENERAL_AGENT',
        reason: "检测到文件包含 @AITODO 任务标记。",
        action: "请读取注释要求，执行相应任务，完成后将标记改为 @AIDONE。" + 全量修复提示 + 单文件检查提示
    }
};

/**
 * 生成 Agent 指令信息
 * (复制自 vue-custom-rules.ts 以解耦)
 */
export function generateAgentInstruction(prompt) {
    return `🤖 Agent指令: ${prompt.id} | ${prompt.mode}\n${prompt.reason}\n${prompt.action}`;
}

/**
 * AI Worker 规则插件
 */
export const aiWorkerPlugin = {
    rules: {
        'detect-ai-todo': {
            meta: { type: 'problem' },
            create(context) {
                return {
                    Program() {
                        const sourceCode = context.sourceCode || context.getSourceCode();
                        const comments = sourceCode.getAllComments();

                        comments.forEach((comment) => {
                            if (comment.value.includes('@AITODO')) {
                                context.report({
                                    loc: comment.loc,
                                    message: generateAgentInstruction(PROMPTS.AI_TODO_DETECTED)
                                });
                            }
                        });
                    }
                };
            }
        }
    }
};
