/**
 * 要求 import 语句必须有注释说明 ESLint 规则
 *
 * 每条 import 必须带有紧邻的前置注释，注释需覆盖：
 * - 导入用途
 * - 使用范围
 * - 运行时导入是否可改用依赖注入/参数传递等方式解耦
 *
 * 类型导入不会产生运行时耦合，因此无需解耦评估。
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

function 构建错误信息(importSource, detail, isTypeImport) {
    const requirements = [
        "注释必须说明：",
        "  - 用途：为什么需要这个导入",
        "  - 使用范围：在哪些模块/流程中使用，边界是什么",
    ];
    if (!isTypeImport) {
        requirements.push("  - 解耦评估：说明能否通过依赖注入/参数传递/事件发射等方式解耦,必须详细阅读相关代码,并给出真实准确的评估结果,审慎评估保证尽可能减少业务代码中的硬耦合");
    }
    return [
        `❌ import "${importSource}" 缺少合规注释：${detail}`,
        ...requirements,
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
    // 仅要求出现“解耦评估:”标签，不校验行内关键词
    return /解耦评估\s*[:：]/.test(text);
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
                    description: "要求 import 语句说明用途和范围，并要求运行时导入提供解耦评估",
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
                        const isTypeImport = node.importKind === "type";

                        const comment = 获取紧邻前置注释(sourceCode, node);
                        if (!comment) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未找到紧邻前置注释", isTypeImport)
                            });
                            return;
                        }

                        const text = 规范化注释文本(comment.value);
                        if (!text) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "注释内容为空", isTypeImport)
                            });
                            return;
                        }

                        if (!是否包含用途(text)) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未说明导入用途", isTypeImport)
                            });
                            return;
                        }

                        if (!是否包含范围(text)) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "未说明使用范围", isTypeImport)
                            });
                            return;
                        }

                        if (!isTypeImport && !是否包含解耦评估(text)) {
                            context.report({
                                node,
                                message: 构建错误信息(importSource, "缺少\"解耦评估:\"说明行", isTypeImport)
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
