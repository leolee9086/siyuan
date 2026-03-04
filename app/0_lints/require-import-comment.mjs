/**
 * 要求 import 语句必须有注释说明 ESLint 规则
 *
 * 每条 import 必须带有紧邻的前置注释，注释需覆盖：
 * - 导入用途
 * - 使用范围
 * - 是否可改用依赖注入/参数传递等方式解耦
 */

import { FULL_FIX_REMINDER, SINGLE_FILE_LINT_TIP } from "./shared-constants.mjs";

/**
 * 获取紧邻节点的前置注释
 * 规则：注释必须在 import 同行或上一行，避免“远距离注释”误命中
 */
function 获取紧邻前置注释(sourceCode, node) {
    const comments = sourceCode.getCommentsBefore(node);
    if (!comments || comments.length === 0) {
        return null;
    }

    const lastComment = comments[comments.length - 1];
    if (!lastComment.loc || !node.loc) {
        return null;
    }

    const commentEndLine = lastComment.loc.end.line;
    const nodeStartLine = node.loc.start.line;

    if (nodeStartLine - commentEndLine <= 1) {
        return lastComment;
    }

    return null;
}

function 规范化注释文本(raw) {
    return raw
        .replace(/^\s*\*+\s*/gm, "")
        .replace(/^\/\*+\s*/, "")
        .replace(/\s*\*+\/$/, "")
        .trim();
}

function 构建错误信息(importSource, detail) {
    return [
        `❌ import "${importSource}" 缺少合规注释：${detail}`,
        "注释必须说明：",
        "  - 用途：为什么需要这个导入",
        "  - 使用范围：在哪些模块/流程中使用，边界是什么",
        "  - 解耦评估：是否可改为依赖注入、参数传递或其它方式降低耦合",
        FULL_FIX_REMINDER,
        SINGLE_FILE_LINT_TIP
    ].join("\n");
}

function 是否包含用途(text) {
    return /(用途|目的|作用|为什么需要)/.test(text);
}

function 是否包含范围(text) {
    return /(范围|使用范围|边界|适用场景|使用场景)/.test(text);
}

function 是否包含解耦评估(text) {
    const hasDecoupleKeyword = /(依赖注入|参数传递|解耦|注入|传参)/.test(text);
    const hasWhether = /是否/.test(text);
    return hasDecoupleKeyword && hasWhether;
}

/**
 * 要求 import 注释插件
 */
export const 要求导入注释插件 = {
    rules: {
        "require-import-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "要求每条 import 语句必须有说明注释，并覆盖用途/范围/解耦评估",
                    category: "Best Practices",
                    recommended: true
                },
                schema: []
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                return {
                    ImportDeclaration(node) {
                        const importSource = node.source && typeof node.source.value === "string"
                            ? node.source.value
                            : "<unknown>";

                        const comment = 获取紧邻前置注释(sourceCode, node);
                        if (!comment) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未找到紧邻前置注释")
                            });
                            return;
                        }

                        const text = 规范化注释文本(comment.value);
                        if (!text) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "注释内容为空")
                            });
                            return;
                        }

                        if (!是否包含用途(text)) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未说明导入用途")
                            });
                            return;
                        }

                        if (!是否包含范围(text)) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未说明使用范围")
                            });
                            return;
                        }

                        if (!是否包含解耦评估(text)) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未说明“是否可通过依赖注入/参数传递等方式解耦”")
                            });
                        }
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const requireImportCommentPlugin = 要求导入注释插件;

