/**
 * 禁止过长单行注释 ESLint 规则
 *
 * 规则目标：
 * - 禁止超过指定长度的 // 单行注释
 * - 引导改为多行注释（/* ... *\/）或拆分为多行注释
 */

import { FULL_FIX_REMINDER, SINGLE_FILE_LINT_TIP } from "./shared-constants.mjs";

const 默认最大长度 = 100;

function 获取单行注释源码(comment, sourceCode) {
    if (!Array.isArray(comment.range) || comment.range.length < 2) {
        return "";
    }
    return sourceCode.text.slice(comment.range[0], comment.range[1]).trimEnd();
}

function 是ESLint指令注释(commentText) {
    return /^\/\/\s*eslint-(disable|enable|disable-next-line|disable-line)\b/.test(commentText);
}

function 构建错误信息(actualLength, maxLength) {
    return [
        `❌ 单行注释长度超限：当前 ${actualLength}，最大允许 ${maxLength}。`,
        "请改用多行注释（/* ... */）或拆分为多行注释内容。",
        FULL_FIX_REMINDER,
        SINGLE_FILE_LINT_TIP
    ].join("\n");
}

/**
 * 禁止过长单行注释插件
 */
export const 禁止过长单行注释插件 = {
    rules: {
        "no-long-single-line-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "禁止超过指定长度的 // 单行注释",
                    category: "Stylistic Issues",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            max: {
                                type: "integer",
                                minimum: 1,
                                default: 默认最大长度
                            }
                        },
                        additionalProperties: false
                    }
                ]
            },
            create(context) {
                const sourceCode = context.getSourceCode();
                const options = context.options[0] || {};
                const maxLength = Number.isInteger(options.max) ? options.max : 默认最大长度;

                return {
                    Program() {
                        const comments = sourceCode.getAllComments();
                        for (const comment of comments) {
                            if (comment.type !== "Line") {
                                continue;
                            }

                            const commentText = 获取单行注释源码(comment, sourceCode);
                            if (!commentText || 是ESLint指令注释(commentText)) {
                                continue;
                            }

                            if (commentText.length > maxLength) {
                                context.report({
                                    loc: comment.loc,
                                    message: 构建错误信息(commentText.length, maxLength)
                                });
                            }
                        }
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const noLongSingleLineCommentPlugin = 禁止过长单行注释插件;
