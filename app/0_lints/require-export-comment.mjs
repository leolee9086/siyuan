/**
 * 要求 export 语句必须有注释说明 ESLint 规则
 *
 * 用于 imports.ts 等网关文件，要求每条导出语句都有紧邻注释，
 * 防止通过批量导出隐藏依赖边界和用途说明。
 */

import { FULL_FIX_REMINDER, SINGLE_FILE_LINT_TIP } from "./shared-constants.mjs";

function hasAdjacentComment(node, sourceCode) {
    const comments = sourceCode.getCommentsBefore(node);
    if (!comments || comments.length === 0) {
        return false;
    }

    const lastComment = comments[comments.length - 1];
    if (!lastComment.loc || !node.loc) {
        return false;
    }

    return node.loc.start.line - lastComment.loc.end.line <= 1;
}

function buildMessage(detail) {
    return [
        `❌ export 语句缺少注释说明：${detail}`,
        "要求：每条导出语句前都必须有注释（不限制注释格式）。",
        FULL_FIX_REMINDER,
        SINGLE_FILE_LINT_TIP
    ].join("\n");
}

export const requireExportCommentPlugin = {
    rules: {
        "require-export-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "要求 export 语句前必须有注释说明",
                    category: "Best Practices",
                    recommended: true
                },
                schema: []
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                function checkExport(node) {
                    if (hasAdjacentComment(node, sourceCode)) {
                        return;
                    }

                    context.report({
                        node,
                        message: buildMessage("未找到紧邻前置注释")
                    });
                }

                return {
                    ExportNamedDeclaration: checkExport,
                    ExportDefaultDeclaration: checkExport,
                    ExportAllDeclaration: checkExport
                };
            }
        }
    }
};

