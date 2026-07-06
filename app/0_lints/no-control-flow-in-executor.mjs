/**
 * 执行器层无控制流约束规则
 *
 * 设计理念：
 * 一旦状态空间在 calibur-router 的 universe + split + remain + build 中收集完成，
 * 执行器层（*.executor.ts）内的所有控制流逻辑都是代码腐化的征兆——
 * 该提升到 split 模式的分派被退化回命令式 if/else，绕过了路由层的编译期穷尽性保证。
 *
 * 约束：
 * - 在 *.executor.ts 文件内，禁止 IfStatement / SwitchStatement / ConditionalExpression
 * - 极少数必须保留的判断，通过显式豁免注释声明不提升的理由
 * - 豁免格式：// @执行器豁免: <不提升到 split 的理由>
 * - 理由最低长度 20 字符，强制写出实质原因
 * - 无文件级豁免，每个例外必须逐条声明
 * - 未被任何控制流节点使用的豁免注释会被报告为无效豁免
 */

import { FULL_FIX_REMINDER, 单文件检查提示 } from "./shared-constants.mjs";

/**
 * 豁免注释标记前缀
 */
const EXEMPTION_PREFIX = "@执行器豁免:";

/**
 * 豁免理由最低字符数（trim 后）
 */
const MIN_REASON_LENGTH = 20;

/**
 * 检查注释是否为有效的执行器豁免注释
 * @param {object} comment - ESLint 注释节点
 * @returns {{valid: boolean, reason: string, comment: object}|null} 解析结果，null 表示非豁免注释
 */
function parseExemptionComment(comment) {
    const value = comment.value.trim();
    if (!value.startsWith(EXEMPTION_PREFIX)) {
        return null;
    }
    const reason = value.substring(EXEMPTION_PREFIX.length).trim();
    return { valid: reason.length >= MIN_REASON_LENGTH, reason, comment };
}

/**
 * 收集节点及其语句级父节点的前置注释
 *
 * ConditionalExpression 嵌在表达式中间，行注释通常挂在包含它的语句前，
 * 因此需要向上查找最近的语句级节点一并检查。
 *
 * @param {object} node - AST 节点
 * @param {object} sourceCode - ESLint sourceCode
 * @returns {Array} 前置注释数组
 */
function collectCommentsBefore(node, sourceCode) {
    const comments = sourceCode.getCommentsBefore(node);
    if (comments.length > 0) {
        return comments;
    }
    // 向上查找语句级父节点
    let parent = node.parent;
    while (parent) {
        const parentType = parent.type;
        if (
            parentType === "ExpressionStatement" ||
            parentType === "VariableDeclaration" ||
            parentType === "ReturnStatement" ||
            parentType === "ExportNamedDeclaration" ||
            parentType === "ExportDefaultDeclaration"
        ) {
            return sourceCode.getCommentsBefore(parent);
        }
        parent = parent.parent;
    }
    return [];
}

/**
 * 在注释列表中查找有效的执行器豁免注释
 * @param {Array} comments - 注释数组
 * @returns {{valid: boolean, reason: string, comment: object}|null}
 */
function findExemption(comments) {
    for (const comment of comments) {
        const parsed = parseExemptionComment(comment);
        if (parsed) {
            return parsed;
        }
    }
    return null;
}

export const noControlFlowInExecutorPlugin = {
    rules: {
        "no-control-flow-in-executor": {
            meta: {
                type: "problem",
                docs: {
                    description: "执行器层 (*.executor.ts) 禁止控制流，分派必须提升到 calibur-router split 模式",
                    category: "Architecture",
                    recommended: true,
                },
                messages: {
                    forbiddenControlFlow: "❌ [执行器约束] *.executor.ts 文件内禁止控制流 ({{nodeType}})。\n" +
                        "状态空间分派必须提升到 calibur-router 的 split 模式，由类型系统保证穷尽性与互斥性。\n" +
                        "若极少数判断确需保留，在上一行添加豁免并写明不提升的理由：\n" +
                        "  // @执行器豁免: <不提升到 split 的实质理由>" +
                        FULL_FIX_REMINDER + 单文件检查提示,
                    invalidReason: "❌ [执行器约束] 豁免理由不充分。\n" +
                        "格式必须为: // @执行器豁免: <理由>\n" +
                        "理由至少 " + MIN_REASON_LENGTH + " 个字符，需说明为什么不将此判断提升到 split 模式。" +
                        FULL_FIX_REMINDER + 单文件检查提示,
                    unusedExemption: "❌ [执行器约束] 此处的 @执行器豁免 注释未紧邻任何控制流语句，请移除无用的豁免注释。" +
                        FULL_FIX_REMINDER + 单文件检查提示,
                },
                schema: [],
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                // 收集文件中所有豁免注释，用于最终检测未使用的豁免
                const allExemptionComments = [];
                for (const comment of sourceCode.getAllComments()) {
                    if (comment.type === "Line" && comment.value.trim().startsWith(EXEMPTION_PREFIX)) {
                        allExemptionComments.push(comment);
                    }
                }

                // 记录已被控制流节点使用的豁免注释
                const usedExemptions = new Set();

                /**
                 * 检查控制流节点是否拥有有效豁免
                 * @param {object} node - 控制流 AST 节点
                 * @param {string} nodeType - 节点类型描述
                 */
                function checkControlFlowNode(node, nodeType) {
                    const comments = collectCommentsBefore(node, sourceCode);
                    const exemption = findExemption(comments);

                    if (exemption) {
                        usedExemptions.add(exemption.comment);
                        if (!exemption.valid) {
                            context.report({
                                loc: exemption.comment.loc,
                                messageId: "invalidReason",
                            });
                        }
                    } else {
                        context.report({
                            node,
                            messageId: "forbiddenControlFlow",
                            data: { nodeType },
                        });
                    }
                }

                return {
                    IfStatement(node) {
                        checkControlFlowNode(node, "if");
                    },
                    SwitchStatement(node) {
                        checkControlFlowNode(node, "switch");
                    },
                    ConditionalExpression(node) {
                        checkControlFlowNode(node, "三元表达式");
                    },
                    "Program:exit"() {
                        // 检测未被任何控制流节点使用的豁免注释
                        for (const comment of allExemptionComments) {
                            if (!usedExemptions.has(comment)) {
                                context.report({
                                    loc: comment.loc,
                                    messageId: "unusedExemption",
                                });
                            }
                        }
                    },
                };
            },
        },
    },
};
